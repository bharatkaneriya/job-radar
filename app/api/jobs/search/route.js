import { Profile } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { fetchJobs } from '#server/services/fetchJobs.js';
import { matchUser } from '#server/services/matchUser.js';
import { listJobs, listSchema } from '#server/services/listJobs.js';

export const maxDuration = 60;

const LIVE_THROTTLE_MS = 5 * 60e3;

// Live mode: refresh sources (each still respects its own interval), re-match, then list.
export const POST = route(
  async ({ user, query, body }) => {
    const f = parse(listSchema, { ...query, ...body });
    const profile = await Profile.findOne({ userId: user._id }).lean();
    if (!profile?.completed) throw new HttpError(400, 'Complete your profile first');

    const since = user.lastLiveSearchAt ? Date.now() - user.lastLiveSearchAt : Infinity;
    let sources = null;
    let throttled = false;
    if (since < LIVE_THROTTLE_MS) {
      throttled = true;
    } else {
      user.lastLiveSearchAt = new Date();
      await user.save();
      sources = await fetchJobs();
    }
    const match = await matchUser(user._id, profile);
    const retryInSec = throttled ? Math.ceil((LIVE_THROTTLE_MS - since) / 1000) : 0;
    return { ...(await listJobs(user._id, f)), live: { sources, match, throttled, retryInSec } };
  },
  { auth: true }
);
