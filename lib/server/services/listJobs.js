import mongoose from 'mongoose';
import { z } from 'zod';
import { UserJob } from '../models/index.js';
import { STATUSES } from './defaults.js';
import { escapeRe } from './util.js';

export const listSchema = z.object({
  status: z.enum([...STATUSES, 'all', 'active']).default('active'),
  q: z.string().trim().max(100).optional(),
  source: z.string().max(40).optional(),
  minScore: z.coerce.number().optional(),
  sort: z.enum(['score', 'date', 'updated']).default('score'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// UserJob ⨝ Job with filters; shared by the DB list and live search.
export async function listJobs(userId, f) {
  const match = { userId: new mongoose.Types.ObjectId(String(userId)) };
  if (f.status === 'active') match.status = { $ne: 'skipped' };
  else if (f.status !== 'all') match.status = f.status;
  if (f.minScore !== undefined) match.score = { $gte: f.minScore };

  const jobMatch = {};
  if (f.source) jobMatch['job.source'] = f.source;
  if (f.q) {
    const r = new RegExp(escapeRe(f.q), 'i');
    jobMatch.$or = [{ 'job.title': r }, { 'job.company': r }, { 'job.location': r }, { 'job.tags': r }, { 'job.description': r }];
  }
  const sort = { score: { score: -1, 'job.postedAt': -1 }, date: { 'job.postedAt': -1, score: -1 }, updated: { statusChangedAt: -1, score: -1 } }[f.sort];

  const [out] = await UserJob.aggregate([
    { $match: match },
    { $lookup: { from: 'jobs', localField: 'jobId', foreignField: '_id', as: 'job' } },
    { $unwind: '$job' },
    { $match: jobMatch },
    { $sort: { ...sort, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (f.page - 1) * f.limit },
          { $limit: f.limit },
          { $project: { 'job.description': 0 } },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  const total = out.total[0]?.n || 0;
  return { items: out.items, total, page: f.page, pages: Math.max(1, Math.ceil(total / f.limit)) };
}
