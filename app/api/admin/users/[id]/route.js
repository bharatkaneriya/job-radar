import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Profile, UserJob } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';

export const dynamic = 'force-dynamic';

const findUser = async (id) => {
  const user = mongoose.isValidObjectId(id) && (await User.findById(id));
  if (!user) throw new HttpError(404, 'User not found');
  return user;
};

const patchSchema = z.object({ role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'disabled']).optional(), name: z.string().trim().min(1).max(100).optional() });

export const GET = route(
  async ({ params }) => {
    const user = await findUser(params.id);
    const [profile, byStatus] = await Promise.all([
      Profile.findOne({ userId: user._id }).lean(),
      UserJob.aggregate([{ $match: { userId: user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);
    return { user: { ...user.toPublic(), google: !!user.googleId }, profile, counts: Object.fromEntries(byStatus.map((r) => [r._id, r.n])) };
  },
  { role: 'admin' }
);

export const PATCH = route(
  async (ctx) => {
    const body = parse(patchSchema, ctx.body);
    const user = await findUser(ctx.params.id);
    const self = String(user._id) === String(ctx.user._id);
    if (self && ((body.role && body.role !== 'admin') || body.status === 'disabled')) {
      throw new HttpError(400, "You can't remove your own admin access or disable yourself");
    }
    Object.assign(user, body);
    await user.save();
    return user.toPublic();
  },
  { role: 'admin' }
);

export const DELETE = route(
  async (ctx) => {
    const user = await findUser(ctx.params.id);
    if (String(user._id) === String(ctx.user._id)) throw new HttpError(400, "You can't delete your own account here");
    await Promise.all([UserJob.deleteMany({ userId: user._id }), Profile.deleteOne({ userId: user._id }), user.deleteOne()]);
    return { ok: true };
  },
  { role: 'admin' }
);
