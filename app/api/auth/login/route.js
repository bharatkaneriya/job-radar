import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { signIn, emailSchema } from '#server/account.js';

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required') });

export const POST = route(
  async (ctx) => {
    const body = parse(loginSchema, ctx.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+passwordHash');
    if (!user?.passwordHash) {
      throw new HttpError(401, user?.googleId ? 'This account uses Google sign-in' : 'Wrong email or password');
    }
    if (!(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Wrong email or password');
    return signIn(ctx, user);
  },
  { limited: true }
);
