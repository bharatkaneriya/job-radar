// Shared plumbing for the route handlers in app/api: auth, body parsing, rate limit, errors.
// Uses the standard Request/Response so the handlers also run under node:test.
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { connectDb } from './db.js';
import { logger } from './logger.js';
import { User } from './models/index.js';

export const COOKIE = 'token';
const MAX_AGE_MS = 7 * 864e5;
const MAX_BODY_BYTES = 200 * 1024;

export const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function setAuthCookie(ctx, user) {
  const token = jwt.sign({ sub: String(user._id), role: user.role, sv: user.sessionVersion || 0 }, secret(), { expiresIn: MAX_AGE_MS / 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  ctx.headers.append('set-cookie', `${COOKIE}=${token}; Max-Age=${MAX_AGE_MS / 1000}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}

export const clearAuthCookie = (ctx) => ctx.headers.append('set-cookie', `${COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);

function readCookie(req, name) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

// Loads the user on every request so a disabled account or role change takes effect immediately.
async function requireAuth(ctx) {
  const token = readCookie(ctx.req, COOKIE);
  if (!token) throw new HttpError(401, 'Please log in');
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    clearAuthCookie(ctx);
    throw new HttpError(401, 'Session expired, please log in again');
  }
  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user || user.status !== 'active') {
    clearAuthCookie(ctx);
    throw new HttpError(401, user ? 'This account is disabled' : 'Please log in');
  }
  if ((payload.sv || 0) !== (user.sessionVersion || 0)) {
    clearAuthCookie(ctx);
    throw new HttpError(401, 'Session expired, please log in again');
  }
  ctx.user = user;
}

// Parses a body/query object with a zod schema; 400 with field errors on failure.
export const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = Object.fromEntries(r.error.issues.map((i) => [i.path.join('.') || '_', i.message]));
    throw new HttpError(400, Object.values(fields)[0] || 'Invalid input', fields);
  }
  return r.data;
};

// Only JSON bodies are read, so a cross-site form post can't reach a handler with data.
async function readBody(req) {
  if (!(req.headers.get('content-type') || '').includes('json')) return undefined;
  const text = await req.text();
  if (!text) return undefined;
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError(413, 'Request is too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

// Per-instance login throttle: 20 attempts per IP per 15 minutes.
const LIMIT = 20;
const WINDOW_MS = 15 * 60e3;
const hits = new Map();

// Each proxy appends the address it saw, so entries further left can be faked by the client.
// TRUST_PROXY_HOPS is how many proxies you run in front of the app (nginx = 1, CDN + nginx = 2).
function clientIp(req) {
  const hops = Number(process.env.TRUST_PROXY_HOPS) || 1;
  const chain = (req.headers.get('x-forwarded-for') || 'local').split(',');
  return (chain.at(-hops) ?? chain[0]).trim();
}

function rateLimit(req) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  const ip = clientIp(req);
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (++entry.n > LIMIT) throw new HttpError(429, 'Too many attempts, try again in a few minutes');
}

function errorResponse(err, headers, log) {
  if (err instanceof HttpError) return Response.json({ error: err.message, fields: err.details }, { status: err.status, headers });
  if (err?.code === 11000) return Response.json({ error: 'Already exists' }, { status: 409, headers });
  log.error({ err }, 'Request failed');
  return Response.json({ error: 'Something went wrong' }, { status: 500, headers });
}

// Wraps a handler: ctx is { req, params, query, body, user, status, headers }, and whatever
// the handler returns is sent as JSON. Options: auth (needs a session), role (implies auth),
// limited (rate limited).
export function route(handler, { auth = false, role, limited = false } = {}) {
  return async (req, segment) => {
    const headers = new Headers();
    const url = new URL(req.url);
    const started = Date.now();
    // Path only: query strings and bodies can hold search terms or personal details.
    // Reuses the id from the host or proxy when there is one, so logs can be matched up with theirs.
    const reqId = (req.headers.get('x-request-id') || req.headers.get('x-vercel-id') || randomUUID()).slice(0, 100);
    const log = logger.child({ reqId, method: req.method, path: url.pathname });
    const finish = (res, userId) => {
      log.info({ status: res.status, ms: Date.now() - started, userId }, 'Request');
      return res;
    };
    const ctx = { req, headers, status: 200, query: Object.fromEntries(url.searchParams) };
    try {
      ctx.params = await segment?.params;
      if (limited) rateLimit(req);
      ctx.body = await readBody(req);
      await connectDb();
      if (auth || role) await requireAuth(ctx);
      if (role && ctx.user.role !== role) throw new HttpError(403, 'Not allowed');
      const data = await handler(ctx);
      return finish(Response.json(data, { status: ctx.status, headers }), ctx.user?.id);
    } catch (err) {
      return finish(errorResponse(err, headers, log), ctx.user?.id);
    }
  };
}
