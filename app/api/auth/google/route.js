import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { User } from '#server/models/index.js';
import { route, parse, HttpError } from '#server/http.js';
import { createUser, signIn } from '#server/account.js';

let google;

export const POST = route(
  async (ctx) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new HttpError(501, 'Google sign-in is not configured');
    const { credential } = parse(z.object({ credential: z.string().min(10) }), ctx.body);
    google ??= new OAuth2Client(clientId);
    let p;
    try {
      p = (await google.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
    } catch {
      throw new HttpError(401, 'Google sign-in failed');
    }
    if (!p?.email || !p.email_verified) throw new HttpError(401, 'Google account email is not verified');

    let user = (await User.findOne({ googleId: p.sub })) || (await User.findOne({ email: p.email.toLowerCase() }));
    if (user) {
      user.googleId ??= p.sub;
      user.avatar ||= p.picture;
    } else {
      user = await createUser({ name: p.name || p.email.split('@')[0], email: p.email, googleId: p.sub, avatar: p.picture });
      ctx.status = 201;
    }
    return signIn(ctx, user);
  },
  { limited: true }
);
