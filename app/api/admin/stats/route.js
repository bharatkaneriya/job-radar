import { User, UserJob, Job } from '#server/models/index.js';
import { route } from '#server/http.js';

export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    const [users, active, admins, jobs, matches, applied, newUsersWeek] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'admin' }),
      Job.countDocuments(),
      UserJob.countDocuments(),
      UserJob.countDocuments({ status: { $in: ['applied', 'interview', 'offer'] } }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } }),
    ]);
    return { users, active, admins, jobs, matches, applied, newUsersWeek };
  },
  { role: 'admin' }
);
