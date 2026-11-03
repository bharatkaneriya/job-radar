import { z } from 'zod';
import { route, parse } from '#server/http.js';
import { emailSchema } from '#server/account.js';
import { verifyCode } from '#server/services/passwordReset.js';

const verifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const POST = route(
  async (ctx) => {
    const { email, code } = parse(verifySchema, ctx.body);
    return { token: await verifyCode(email.toLowerCase(), code) };
  },
  { limited: true }
);
