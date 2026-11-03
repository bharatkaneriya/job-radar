// End-to-end API flow against an in-memory MongoDB, with sources read from fixtures.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { base, client, dispatch } from './helpers.js';

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_EMAILS = 'boss@example.com';
  process.env.CRON_SECRET = 'cron-secret';
  process.env.SOURCES_DEMO = '1';
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

const profileBody = {
  headline: 'Full-stack dev',
  experienceYears: 8,
  skills: [
    { name: 'React', weight: 8 },
    { name: 'Node.js', weight: 6 },
    { name: 'Laravel', weight: 10 },
    { name: 'PHP', weight: 6 },
  ],
  preferences: { includeKeywords: [], excludeKeywords: [], preferredLocations: ['India'], remoteOnly: true, jobTypes: [], minScore: 5, maxAgeDays: 60 },
  sources: [],
};

test('user flow: register → profile → jobs → status', async () => {
  const api = client();
  assert.equal((await api('GET', '/auth/me')).status, 401);

  const reg = await api('POST', '/auth/register', { name: 'Ann', email: 'ann@example.com', password: 'password123' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.role, 'user');
  assert.equal(reg.body.profileCompleted, false);
  assert.equal((await api('POST', '/auth/register', { name: 'Ann', email: 'ann@example.com', password: 'password123' })).status, 409);

  const prof = await api('GET', '/profile');
  assert.ok(prof.body.profile.skills.length > 0, 'suggested skills pre-filled');

  assert.equal((await api('PUT', '/profile', { ...profileBody, skills: [] })).status, 400);
  assert.equal((await api('POST', '/jobs/search', {})).status, 400, 'live search needs a profile');
  const saved = await api('PUT', '/profile', profileBody);
  assert.equal(saved.status, 200);

  // Live search pulls the fixtures into the pool and matches them.
  const live = await api('POST', '/jobs/search', {});
  assert.equal(live.status, 200);
  assert.ok(live.body.live.sources.every((s) => !s.error), JSON.stringify(live.body.live.sources));
  assert.ok(live.body.total > 0, 'some matches');
  const again = await api('POST', '/jobs/search', {});
  assert.equal(again.body.live.throttled, true);

  const list = await api('GET', '/jobs?sort=score&limit=5');
  assert.ok(list.body.items.length > 0);
  const scores = list.body.items.map((i) => i.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  const first = list.body.items[0];
  assert.ok(first.job.title);

  const upd = await api('PATCH', `/jobs/${first._id}`, { status: 'applied', notes: 'sent CV' });
  assert.equal(upd.body.status, 'applied');
  assert.equal((await api('GET', '/jobs?status=applied')).body.total, 1);
  assert.equal((await api('PATCH', `/jobs/${first._id}`, { status: 'bogus' })).status, 400);

  // Re-saving the profile keeps status and notes.
  await api('PUT', '/profile', profileBody);
  const detail = await api('GET', `/jobs/${first._id}`);
  assert.equal(detail.body.status, 'applied');
  assert.equal(detail.body.notes, 'sent CV');
  assert.ok(detail.body.job.description);

  const stats = await api('GET', '/jobs/stats');
  assert.equal(stats.body.counts.applied, 1);

  assert.equal((await api('GET', '/admin/users')).status, 403);
  await api('POST', '/auth/logout');
  assert.equal((await api('GET', '/jobs')).status, 401);
});

test('admin flow and disabled users', async () => {
  const admin = client();
  const reg = await admin('POST', '/auth/register', { name: 'Boss', email: 'Boss@example.com', password: 'password123' });
  assert.equal(reg.body.user.role, 'admin');

  const users = await admin('GET', '/admin/users?q=ann');
  assert.equal(users.body.total, 1);
  const ann = users.body.items[0];
  assert.equal(ann.applied, 1);

  assert.equal((await admin('PATCH', `/admin/users/${reg.body.user.id}`, { role: 'user' })).status, 400, 'cannot demote self');
  assert.equal((await admin('PATCH', `/admin/users/${ann.id}`, { status: 'disabled' })).status, 200);

  const ann2 = client();
  assert.equal((await ann2('POST', '/auth/login', { email: 'ann@example.com', password: 'password123' })).status, 403);

  const sources = await admin('GET', '/admin/sources');
  assert.equal(sources.body.items.length, 6);
  assert.ok(sources.body.items.every((s) => s.lastFetch?.ok));
  assert.equal((await admin('PUT', '/admin/sources', { remotive: { enabled: false } })).body.sources.remotive.enabled, false);

  const stats = await admin('GET', '/admin/stats');
  assert.equal(stats.body.users, 2);

  assert.equal((await admin('DELETE', `/admin/users/${ann.id}`)).status, 200);
  assert.equal((await admin('GET', '/admin/stats')).body.matches, 0);
});

test('cron needs the secret', async () => {
  const api = client();
  assert.equal((await api('GET', '/cron/daily')).status, 401);
  const res = await dispatch(new Request(`${base}/cron/daily`, { headers: { authorization: 'Bearer cron-secret' } }));
  assert.equal(res.status, 200);
});

test('bad JSON and unknown paths', async () => {
  const bad = await dispatch(new Request(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' }));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'Invalid JSON');
  assert.equal((await client()('GET', '/nope')).status, 404);
});
