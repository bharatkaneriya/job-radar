import { z } from 'zod';
import { User, UserJob } from '#server/models/index.js';
import { route, parse } from '#server/http.js';
import { escapeRe } from '#server/services/util.js';

export const dynamic = 'force-dynamic';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = route(
  async ({ query }) => {
    const f = parse(listSchema, query);
    const filter = {};
    if (f.role) filter.role = f.role;
    if (f.status) filter.status = f.status;
    if (f.q) {
      const r = new RegExp(escapeRe(f.q), 'i');
      filter.$or = [{ name: r }, { email: r }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select('+passwordHash').sort({ createdAt: -1 }).skip((f.page - 1) * f.limit).limit(f.limit),
      User.countDocuments(filter),
    ]);
    const ids = users.map((u) => u._id);
    const counts = await UserJob.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', matches: { $sum: 1 }, applied: { $sum: { $cond: [{ $in: ['$status', ['applied', 'interview', 'offer']] }, 1, 0] } } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    return {
      items: users.map((u) => ({ ...u.toPublic(), google: !!u.googleId, matches: byId.get(String(u._id))?.matches || 0, applied: byId.get(String(u._id))?.applied || 0 })),
      total,
      page: f.page,
      pages: Math.max(1, Math.ceil(total / f.limit)),
    };
  },
  { role: 'admin' }
);
