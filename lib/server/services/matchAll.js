import { logger } from '../logger.js';
import { Profile, User } from '../models/index.js';
import { matchUser } from './matchUser.js';

// Re-scores every active user with a completed profile. Sequential on purpose:
// it runs in the daily cron or an admin action, and keeps DB load predictable.
export async function matchAllUsers() {
  const active = await User.find({ status: 'active' }, { _id: 1 }).lean();
  const profiles = await Profile.find({ completed: true, userId: { $in: active.map((u) => u._id) } }).lean();
  let added = 0;
  const errors = [];
  for (const p of profiles) {
    try {
      added += (await matchUser(p.userId, p)).added;
    } catch (e) {
      logger.error({ userId: String(p.userId), err: e }, 'Matching failed');
      errors.push({ userId: String(p.userId), error: e.message });
    }
  }
  return { users: profiles.length, added, errors };
}
