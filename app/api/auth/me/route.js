import { Profile } from '#server/models/index.js';
import { route } from '#server/http.js';

export const dynamic = 'force-dynamic';

export const GET = route(
  async ({ user }) => {
    const profile = await Profile.findOne({ userId: user._id }, { completed: 1 }).lean();
    return { user: user.toPublic(), profileCompleted: !!profile?.completed };
  },
  { auth: true }
);
