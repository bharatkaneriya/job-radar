import { z } from 'zod';
import { route, parse } from '#server/http.js';
import { emailSchema } from '#server/account.js';
import { resetPassword } from '#server/services/passwordReset.js';

const resetSchema = z.object({
  email: emailSchema,
  token: z.string().min(1, 'Please start again').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const POST = route(
  async (ctx) => {
    const { email, token, password } = parse(resetSchema, ctx.body);
    await resetPassword(email.toLowerCase(), token, password);
    return { ok: true };
  },
  { limited: true }
);
