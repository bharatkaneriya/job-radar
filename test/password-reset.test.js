// Forgot password flow against an in-memory MongoDB and a real local SMTP server,
// so the mail really goes over SMTP, with auth, and is read back from what the server got.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { SMTPServer } from 'smtp-server';
import { client } from './helpers.js';
import { User } from '../lib/server/models/index.js';
import { MAX_ATTEMPTS, MAX_CODES_PER_HOUR } from '../lib/server/services/passwordReset.js';

const OLD = 'old-password-1';
const NEW = 'new-password-2';

let mongo, smtp, smtpPort;
let inbox = [];
let seq = 0;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret';
  smtp = new SMTPServer({
    hideSTARTTLS: true,
    allowInsecureAuth: true,
    onAuth: (auth, session, cb) => (auth.username === 'mailer' && auth.password === 'mail-pass' ? cb(null, { user: 'mailer' }) : cb(new Error('Bad login'))),
    onData(stream, session, cb) {
      let raw = '';
      stream.on('data', (d) => (raw += d));
      stream.on('end', () => {
        inbox.push({ to: session.envelope.rcptTo[0].address, from: session.envelope.mailFrom.address, raw, code: raw.match(/reset code is: (\d{6})/)?.[1] });
        cb();
      });
    },
  });
  await new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  smtpPort = smtp.server.address().port;
});

after(async () => {
  await new Promise((resolve) => smtp.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(() => {
  inbox = [];
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_USER: 'mailer', SMTP_PASS: 'mail-pass', SMTP_FROM: 'Job Radar <no-reply@example.com>' });
});

// Each test gets its own account and ip, so limits don't carry over between tests.
async function account() {
  seq += 1;
  const api = client(`10.0.0.${seq}`);
  const email = `user${seq}@example.com`;
  const reg = await api('POST', '/auth/register', { name: 'User', email, password: OLD });
  assert.equal(reg.status, 201);
  return { api, email };
}

const forgot = (api, email) => api('POST', '/auth/forgot-password', { email });
const verify = (api, email, code) => api('POST', '/auth/verify-reset-code', { email, code });
const reset = (api, email, token, password = NEW) => api('POST', '/auth/reset-password', { email, token, password });
const wrongCode = (code) => (code === '000000' ? '000001' : '000000');
const elapse = (email, fields) => User.updateOne({ email }, { $set: fields });
const stored = (email) => User.findOne({ email }).select('+resetCodeHash +resetTokenHash +passwordHash').lean();

// Forgot + verify: returns a live token.
async function verified(api, email) {
  inbox = [];
  await forgot(api, email);
  const res = await verify(api, email, inbox[0].code);
  assert.equal(res.status, 200);
  return res.body.token;
}

test('email → code → token → new password; old password and old sessions stop working', async () => {
  const { api, email } = await account();
  assert.equal((await api('GET', '/auth/me')).status, 200);

  const res = await forgot(api, email.toUpperCase());
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true }, 'the code is never in the response');

  assert.equal(inbox.length, 1);
  const [mail] = inbox;
  assert.equal(mail.to, email);
  assert.equal(mail.from, 'no-reply@example.com');
  assert.match(mail.code, /^\d{6}$/);
  assert.ok(!(await stored(email)).resetCodeHash.includes(mail.code), 'only a hash is stored');

  const ok = await verify(api, email, mail.code);
  assert.equal(ok.status, 200);
  const { token } = ok.body;
  assert.ok(token.length >= 32);
  const doc = await stored(email);
  assert.equal(doc.resetCodeHash, undefined, 'the code is used up');
  assert.ok(doc.resetTokenHash && doc.resetTokenHash !== token, 'only a hash of the token is stored');

  assert.equal((await api('POST', '/auth/login', { email, password: OLD })).status, 200, 'verifying alone changes nothing');
  assert.equal((await reset(api, email, token)).status, 200);

  assert.equal((await api('GET', '/auth/me')).status, 401, 'the old session is logged out');
  const fresh = client(`10.1.0.${seq}`);
  assert.equal((await fresh('POST', '/auth/login', { email, password: OLD })).status, 401);
  assert.equal((await fresh('POST', '/auth/login', { email, password: NEW })).status, 200);
  assert.equal((await fresh('GET', '/auth/me')).status, 200, 'a new login works');
});

test('a code and a token each work only once', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  const { code } = inbox[0];
  const { token } = (await verify(api, email, code)).body;
  assert.equal((await verify(api, email, code)).status, 400);
  assert.equal((await reset(api, email, token)).status, 200);
  assert.equal((await reset(api, email, token, 'another-password')).status, 400);
});

test('the password step needs the token: a code or a made-up value is refused', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  const { code } = inbox[0];
  assert.equal((await reset(api, email, code)).status, 400, 'no token yet');
  await verify(api, email, code);
  assert.equal((await reset(api, email, code)).status, 400, 'the code is not the token');
  assert.equal((await reset(api, email, 'x'.repeat(43))).status, 400);
  assert.equal((await api('POST', '/auth/login', { email, password: OLD })).status, 200, 'password unchanged');
});

test('a token only works for its own account', async () => {
  const a = await account();
  const b = await account();
  const tokenA = await verified(a.api, a.email);
  const tokenB = await verified(b.api, b.email);
  assert.equal((await reset(b.api, b.email, tokenA)).status, 400);
  assert.equal((await reset(a.api, a.email, tokenA)).status, 200);
  assert.equal((await reset(b.api, b.email, tokenB)).status, 200);
});

test('an expired token is refused', async () => {
  const { api, email } = await account();
  const token = await verified(api, email);
  await elapse(email, { resetTokenExpiresAt: new Date(Date.now() - 1000) });
  assert.equal((await reset(api, email, token)).status, 400);
});

test('asking for a new code cancels an unused token', async () => {
  const { api, email } = await account();
  const token = await verified(api, email);
  await elapse(email, { resetSentAt: new Date(Date.now() - 61e3) });
  await forgot(api, email);
  assert.equal((await reset(api, email, token)).status, 400);
});

test('unknown and disabled accounts get the same answer and no email', async () => {
  const { api, email } = await account();
  const unknown = await forgot(api, 'nobody@example.com');
  await User.updateOne({ email }, { status: 'disabled' });
  const disabled = await forgot(api, email);
  for (const r of [unknown, disabled]) {
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
  }
  assert.equal(inbox.length, 0);
  assert.equal((await verify(api, 'nobody@example.com', '123456')).status, 400);
  assert.equal((await reset(api, 'nobody@example.com', 'x'.repeat(43))).status, 400);
});

test('a disabled account can not use a token it already has', async () => {
  const { api, email } = await account();
  const token = await verified(api, email);
  await User.updateOne({ email }, { status: 'disabled' });
  assert.equal((await reset(api, email, token)).status, 400);
});

test('a code stops working after too many wrong guesses, even the right one', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  const { code } = inbox[0];
  for (let i = 0; i < MAX_ATTEMPTS; i++) assert.equal((await verify(api, email, wrongCode(code))).status, 400);
  assert.equal((await verify(api, email, code)).status, 400);
});

test('getting it right on the last allowed guess still reaches the new password', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  const { code } = inbox[0];
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) await verify(api, email, wrongCode(code));
  const ok = await verify(api, email, code);
  assert.equal(ok.status, 200);
  assert.equal((await reset(api, email, ok.body.token)).status, 200);
});

test('an expired code is rejected', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  await elapse(email, { resetCodeExpiresAt: new Date(Date.now() - 1000) });
  assert.equal((await verify(api, email, inbox[0].code)).status, 400);
});

test('a code from another account is rejected', async () => {
  const a = await account();
  const b = await account();
  await forgot(a.api, a.email);
  await forgot(b.api, b.email);
  const [codeA, codeB] = inbox.map((m) => m.code);
  // Both accounts have a live code; only each one's own may work (1 in a million they match).
  if (codeA !== codeB) assert.equal((await verify(b.api, b.email, codeA)).status, 400);
  assert.equal((await verify(b.api, b.email, codeB)).status, 200);
  assert.equal((await verify(a.api, a.email, codeA)).status, 200);
});

test('one code a minute; a new code replaces the old one', async () => {
  const { api, email } = await account();
  await forgot(api, email);
  assert.equal((await forgot(api, email)).status, 200);
  assert.equal(inbox.length, 1, 'no second email inside the cooldown');

  await elapse(email, { resetSentAt: new Date(Date.now() - 61e3) });
  await forgot(api, email);
  assert.equal(inbox.length, 2);
  const [first, second] = inbox;
  if (first.code !== second.code) assert.equal((await verify(api, email, first.code)).status, 400);
  assert.equal((await verify(api, email, second.code)).status, 200);
});

test('new codes per hour are limited', async () => {
  const { api, email } = await account();
  const send = async () => {
    await elapse(email, { resetSentAt: new Date(Date.now() - 61e3) });
    await forgot(api, email);
  };
  await forgot(api, email);
  for (let i = 1; i < MAX_CODES_PER_HOUR; i++) await send();
  assert.equal(inbox.length, MAX_CODES_PER_HOUR);
  await send();
  assert.equal(inbox.length, MAX_CODES_PER_HOUR, 'over the limit');

  await elapse(email, { resetWindowAt: new Date(Date.now() - 61 * 60e3) });
  await send();
  assert.equal(inbox.length, MAX_CODES_PER_HOUR + 1, 'allowed again after an hour');
});

test('when SMTP fails the user is told, and can retry straight away', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { api, email } = await account();
  process.env.SMTP_PORT = '1'; // nothing listens here
  assert.equal((await forgot(api, email)).status, 503);
  assert.equal((await stored(email)).resetCodeHash, undefined, 'no unsent code is left behind');

  process.env.SMTP_PORT = String(smtpPort);
  assert.equal((await forgot(api, email)).status, 200);
  assert.equal(inbox.length, 1);
});

test('wrong SMTP credentials count as a failed send', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { api, email } = await account();
  process.env.SMTP_PASS = 'wrong';
  assert.equal((await forgot(api, email)).status, 503);
  assert.equal(inbox.length, 0);
});

test('without SMTP: dev prints the code, production refuses', async (t) => {
  const { api, email } = await account();
  delete process.env.SMTP_HOST;

  const error = t.mock.method(console, 'error', () => {});
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await forgot(api, email)).status, 503);
    assert.equal(error.mock.callCount(), 1);
  } finally {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }

  const log = t.mock.method(console, 'log', () => {});
  assert.equal((await forgot(api, email)).status, 200);
  const code = log.mock.calls.map((c) => String(c.arguments[0]).match(/reset code for .*: (\d{6})/)?.[1]).find(Boolean);
  assert.ok(code, 'code printed');
  assert.equal((await verify(api, email, code)).status, 200);
});

test('input is validated', async () => {
  const { api, email } = await account();
  assert.equal((await forgot(api, 'not-an-email')).status, 400);
  assert.equal((await verify(api, email, '12345')).status, 400);
  assert.equal((await verify(api, email, 'abcdef')).status, 400);
  assert.equal((await reset(api, email, '')).status, 400);
  const token = await verified(api, email);
  assert.equal((await reset(api, email, token, 'short')).status, 400);
  assert.equal((await reset(api, email, token)).status, 200, 'a refused password does not use up the token');
});

test('requests per ip are rate limited', async () => {
  const api = client('10.9.9.9');
  let last;
  for (let i = 0; i < 21; i++) last = await forgot(api, 'nobody@example.com');
  assert.equal(last.status, 429);
});
