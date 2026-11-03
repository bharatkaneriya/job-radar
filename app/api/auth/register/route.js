import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { createUser, signIn, emailSchema } from '#server/account.js';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const POST = route(
  async (ctx) => {
    const body = parse(registerSchema, ctx.body);
    if (await User.exists({ email: body.email.toLowerCase() })) throw new HttpError(409, 'An account with this email already exists');
    const user = await createUser({ name: body.name, email: body.email, passwordHash: await bcrypt.hash(body.password, 10) });
    ctx.status = 201;
    return signIn(ctx, user);
  },
  { limited: true }
);
