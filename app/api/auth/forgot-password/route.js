import { z } from 'zod';
import { route, parse } from '#server/http.js';
import { emailSchema } from '#server/account.js';
import { requestReset } from '#server/services/passwordReset.js';

export const maxDuration = 60;

export const POST = route(
  async (ctx) => {
    const { email } = parse(z.object({ email: emailSchema }), ctx.body);
    await requestReset(email.toLowerCase());
    return { ok: true };
  },
  { limited: true }
);
