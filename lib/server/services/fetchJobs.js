// Fetches every enabled source into the shared Job pool.
// Each source keeps its own minIntervalHours (Remotive asks for ≤4 calls a day),
// tracked in SourceFetch so it holds across users and serverless instances.
// SOURCES_DEMO=1 reads test/fixtures instead of the network.

import fs from 'node:fs/promises';
import path from 'node:path';
import { SOURCES } from './sources/index.js';
import { normKey } from './util.js';
import { Job, SourceFetch, Setting } from '../models/index.js';

const FIXTURES = path.join(process.cwd(), 'test', 'fixtures');
const isDemo = () => process.env.SOURCES_DEMO === '1';

async function loadRaw(src, srcCfg) {
  if (isDemo()) return JSON.parse(await fs.readFile(path.join(FIXTURES, `${src.name}.json`), 'utf8'));
  return src.fetchRaw(srcCfg);
}

async function fetchOne(name, srcCfg, { force }) {
  const src = SOURCES[name];
  const last = await SourceFetch.findById(name).lean();
  const ageH = last?.fetchedAt ? (Date.now() - new Date(last.fetchedAt)) / 36e5 : Infinity;
  if (!force && last?.ok && ageH < src.minIntervalHours) {
    return { source: name, skipped: true, reason: `fetched ${ageH.toFixed(1)}h ago` };
  }

  const started = Date.now();
  try {
    const raw = await loadRaw(src, srcCfg);
    const jobs = src.parse(raw, srcCfg).filter((j) => j.title && j.url);
    const now = new Date();
    const ops = jobs.map((j) => ({
      updateOne: {
        filter: { _id: `${name}:${j.sourceId}` },
        update: {
          $set: {
            ...j,
            postedAt: j.postedAt ? new Date(j.postedAt) : null,
            source: name,
            sourceLabel: src.label,
            sourceHome: src.homepage,
            dedupeKey: `${normKey(j.company)}|${normKey(j.title)}`,
            lastSeenAt: now,
          },
        },
        upsert: true,
      },
    }));
    const res = ops.length ? await Job.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0 };
    await SourceFetch.updateOne({ _id: name }, { fetchedAt: now, ok: true, count: jobs.length, error: '', durationMs: Date.now() - started }, { upsert: true });
    return { source: name, count: jobs.length, added: res.upsertedCount };
  } catch (e) {
    await SourceFetch.updateOne({ _id: name }, { fetchedAt: new Date(), ok: false, error: e.message, durationMs: Date.now() - started }, { upsert: true });
    return { source: name, error: e.message };
  }
}

// Sources run in parallel so a full refresh fits inside a serverless time limit.
export async function fetchJobs({ force = false, only } = {}) {
  const setting = await Setting.load();
  const names = Object.entries(setting.sources)
    .filter(([name, c]) => SOURCES[name] && (only ? only.includes(name) : c.enabled))
    .map(([name]) => name);
  const settled = await Promise.allSettled(names.map((n) => fetchOne(n, setting.sources[n], { force })));
  return settled.map((s, i) => (s.status === 'fulfilled' ? s.value : { source: names[i], error: String(s.reason) }));
}

export const sourceList = () =>
  Object.values(SOURCES).map(({ name, label, homepage, minIntervalHours }) => ({ name, label, homepage, minIntervalHours }));
