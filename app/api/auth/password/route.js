import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';

const passwordSchema = z.object({ current: z.string().optional(), next: z.string().min(8, 'Password must be at least 8 characters').max(200) });

export const PUT = route(
  async (ctx) => {
    const body = parse(passwordSchema, ctx.body);
    const user = await User.findById(ctx.user._id).select('+passwordHash');
    if (user.passwordHash && !(await bcrypt.compare(body.current || '', user.passwordHash))) throw new HttpError(400, 'Current password is wrong');
    user.passwordHash = await bcrypt.hash(body.next, 10);
    await user.save();
    return { ok: true };
  },
  { auth: true }
);
