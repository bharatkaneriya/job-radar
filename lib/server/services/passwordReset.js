// Forgot password: a 6-digit code sent by email, swapped for a one-time token once verified,
// and the token sets the new password. Only hashes are stored. A code dies after a few wrong
// guesses, and new codes per account are limited, so guessing doesn't pay.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { HttpError, secret } from '../http.js';
import { logger } from '../logger.js';
import { mailConfigured, sendMail } from './mailer.js';

export const CODE_TTL_MS = 10 * 60e3;
export const TOKEN_TTL_MS = 10 * 60e3;
export const RESEND_COOLDOWN_MS = 60e3;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60e3;

const hashCode = (userId, code) => createHmac('sha256', secret()).update(`${userId}:${code}`).digest('hex');
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

async function deliverCode(email, code) {
  // Without SMTP, local dev prints the code; production refuses earlier in requestReset.
  if (!mailConfigured()) {
    logger.info(`[dev] Password reset code for ${email}: ${code}`);
    return;
  }
  const minutes = CODE_TTL_MS / 60e3;
  await sendMail({
    to: email,
    subject: `${code} is your Job Radar password reset code`,
    text: `Your Job Radar password reset code is: ${code}\n\nIt expires in ${minutes} minutes. If you didn't ask for this, you can ignore this email; your password hasn't changed.`,
    html: `<p>Your Job Radar password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in ${minutes} minutes. If you didn't ask for this, you can ignore this email; your password hasn't changed.</p>`,
  });
}

// Returns quietly when no code is sent (unknown email, cooldown, limit), so the response
// doesn't say whether the account exists.
export async function requestReset(email) {
  if (!mailConfigured() && process.env.NODE_ENV === 'production') {
    logger.error('Password reset requested but SMTP_HOST is not set');
    throw new HttpError(503, 'Password reset is not available right now');
  }
  const user = await User.findOne({ email, status: 'active' }).select('+resetSentAt +resetWindowAt +resetCount');
  if (!user) return;

  const now = Date.now();
  if (user.resetSentAt && now - user.resetSentAt < RESEND_COOLDOWN_MS) return;
  const inWindow = user.resetWindowAt && now - user.resetWindowAt < HOUR_MS;
  if (inWindow && user.resetCount >= MAX_CODES_PER_HOUR) return;

  const code = String(randomInt(0, 1e6)).padStart(6, '0');
  user.resetCodeHash = hashCode(user._id, code);
  user.resetCodeExpiresAt = new Date(now + CODE_TTL_MS);
  user.resetAttempts = 0;
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  user.resetSentAt = new Date(now);
  user.resetWindowAt = inWindow ? user.resetWindowAt : new Date(now);
  user.resetCount = inWindow ? user.resetCount + 1 : 1;
  await user.save();

  try {
    await deliverCode(user.email, code);
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Password reset email failed');
    await User.updateOne({ _id: user._id }, { $unset: { resetCodeHash: 1, resetCodeExpiresAt: 1, resetSentAt: 1 } });
    throw new HttpError(503, "We couldn't send the email. Please try again in a moment.");
  }
}

// A correct code is used up here, so the password step can't fail on the guess limit.
export async function verifyCode(email, code) {
  const invalid = new HttpError(400, 'That code is wrong or has expired');
  // The attempt is counted atomically, before comparing, so parallel guesses can't beat the limit.
  const user = await User.findOneAndUpdate(
    { email, status: 'active', resetCodeExpiresAt: { $gt: new Date() }, resetAttempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { resetAttempts: 1 } },
    { returnDocument: 'after' }
  ).select('+resetCodeHash');
  if (!user?.resetCodeHash) throw invalid;
  if (!timingSafeEqual(Buffer.from(hashCode(user._id, code)), Buffer.from(user.resetCodeHash))) throw invalid;

  const token = randomBytes(32).toString('base64url');
  // Matching on the hash makes the code single-use.
  const res = await User.updateOne(
    { _id: user._id, resetCodeHash: user.resetCodeHash },
    {
      $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      $unset: { resetCodeHash: 1, resetCodeExpiresAt: 1, resetAttempts: 1 },
    }
  );
  if (!res.modifiedCount) throw invalid;
  return token;
}

export async function resetPassword(email, token, password) {
  const expired = new HttpError(400, 'This reset has expired. Please start again.');
  const filter = { email, status: 'active', resetTokenHash: hashToken(token), resetTokenExpiresAt: { $gt: new Date() } };
  if (!(await User.exists(filter))) throw expired;

  const passwordHash = await bcrypt.hash(password, 10);
  // The token is used up in the same write; the version bump logs out old sessions.
  const res = await User.updateOne(filter, { $set: { passwordHash }, $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 } });
  if (!res.modifiedCount) throw expired;
}
