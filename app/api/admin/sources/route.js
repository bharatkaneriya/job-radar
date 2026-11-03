import { z } from 'zod';
import { Job, SourceFetch, Setting } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { sourceList } from '#server/services/fetchJobs.js';

export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    const [setting, fetches, counts] = await Promise.all([
      Setting.load(),
      SourceFetch.find().lean(),
      Job.aggregate([{ $group: { _id: '$source', n: { $sum: 1 } } }]),
    ]);
    const last = new Map(fetches.map((f) => [f._id, f]));
    const n = new Map(counts.map((c) => [c._id, c.n]));
    return {
      items: sourceList().map((s) => ({ ...s, config: setting.sources[s.name] || { enabled: false }, lastFetch: last.get(s.name) || null, jobs: n.get(s.name) || 0 })),
    };
  },
  { role: 'admin' }
);

export const PUT = route(
  async (ctx) => {
    const body = parse(z.record(z.string(), z.record(z.string(), z.any())), ctx.body);
    const setting = await Setting.load();
    const names = new Set(sourceList().map((s) => s.name));
    for (const [name, cfg] of Object.entries(body)) {
      if (!names.has(name)) throw new HttpError(400, `Unknown source: ${name}`);
      setting.sources[name] = { ...setting.sources[name], ...cfg };
    }
    setting.markModified('sources');
    await setting.save();
    return { sources: setting.sources };
  },
  { role: 'admin' }
);
