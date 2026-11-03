import { UserJob } from '#server/models/index.js';
import { route } from '#server/http.js';
import { STATUSES } from '#server/services/defaults.js';

export const dynamic = 'force-dynamic';

export const GET = route(
  async ({ user }) => {
    const userId = user._id;
    const [byStatus, newThisWeek] = await Promise.all([
      UserJob.aggregate([{ $match: { userId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      UserJob.countDocuments({ userId, firstSeen: { $gte: new Date(Date.now() - 7 * 864e5) } }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of byStatus) counts[r._id] = r.n;
    return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0), newThisWeek };
  },
  { auth: true }
);
