// Shared by the register, login and Google sign-in routes.
import { z } from 'zod';
import { User, Profile } from './models/index.js';
import { HttpError, setAuthCookie } from './http.js';
import { SUGGESTED_SKILLS } from './services/defaults.js';

export const emailSchema = z.email('Enter a valid email').max(200);

const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function createUser({ name, email, passwordHash, googleId, avatar }) {
  const user = await User.create({ name, email, passwordHash, googleId, avatar, role: adminEmails().includes(email.toLowerCase()) ? 'admin' : 'user' });
  await Profile.create({ userId: user._id, skills: SUGGESTED_SKILLS });
  return user;
}

export async function signIn(ctx, user) {
  if (user.status !== 'active') throw new HttpError(403, 'This account is disabled');
  user.lastLoginAt = new Date();
  await user.save();
  setAuthCookie(ctx, user);
  const profile = await Profile.findOne({ userId: user._id }, { completed: 1 }).lean();
  return { user: user.toPublic(), profileCompleted: !!profile?.completed };
}
