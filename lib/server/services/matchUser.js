// Scores the shared Job pool for one user and keeps their UserJob list in sync.
// Status and notes are never overwritten; untouched "new" matches that no longer
// qualify (profile changed, post too old) are removed.

import { Job, UserJob, Profile } from '../models/index.js';
import { buildScoreConfig, scoreJob, passesFilters } from './score.js';
import { normKey } from './util.js';

export async function matchUser(userId, profile) {
  profile ??= await Profile.findOne({ userId }).lean();
  if (!profile?.skills?.length) return { matched: 0, added: 0 };

  const cfg = buildScoreConfig(profile);
  const since = new Date(Date.now() - cfg.maxAgeDays * 864e5);
  const query = { $or: [{ postedAt: { $gte: since } }, { postedAt: null, lastSeenAt: { $gte: since } }] };
  if (profile.sources?.length) query.source = { $in: profile.sources };

  const jobs = await Job.find(query, { title: 1, company: 1, location: 1, tags: 1, description: 1, jobType: 1, postedAt: 1, dedupeKey: 1 }).lean();

  // Same company + title on several boards → keep one (newest post).
  jobs.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  const seen = new Set();
  const results = [];
  for (const j of jobs) {
    const key = j.dedupeKey || `${normKey(j.company)}|${normKey(j.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!passesFilters(j, cfg)) continue;
    const s = scoreJob(j, cfg);
    if (s.score >= cfg.minScore) results.push({ jobId: j._id, ...s });
  }

  const ids = results.map((r) => r.jobId);
  const res = results.length
    ? await UserJob.bulkWrite(
        results.map((r) => ({
          updateOne: {
            filter: { userId, jobId: r.jobId },
            update: { $set: { score: r.score, matched: r.matched, flags: r.flags }, $setOnInsert: { status: 'new', firstSeen: new Date() } },
            upsert: true,
          },
        })),
        { ordered: false }
      )
    : { upsertedCount: 0 };
  const removed = await UserJob.deleteMany({ userId, status: 'new', notes: '', jobId: { $nin: ids } });
  await Profile.updateOne({ userId }, { lastMatchedAt: new Date() });

  return { matched: results.length, added: res.upsertedCount, removed: removed.deletedCount };
}
