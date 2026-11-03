import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreJob, buildScoreConfig, keywordPattern, passesFilters } from '../lib/server/services/score.js';

const profile = (over = {}) => ({
  skills: [
    { name: 'Laravel', weight: 10 },
    { name: 'React', weight: 8 },
    { name: 'Node.js', weight: 6 },
  ],
  preferences: { includeKeywords: [], excludeKeywords: [], preferredLocations: ['India'], remoteOnly: true, jobTypes: [], minScore: 15, maxAgeDays: 14, ...over },
});

test('skill in the title counts double', () => {
  const cfg = buildScoreConfig(profile());
  const t = scoreJob({ title: 'Laravel Developer', description: '' }, cfg);
  const b = scoreJob({ title: 'Developer', description: 'We use Laravel' }, cfg);
  assert.equal(t.score, 20);
  assert.equal(b.score, 10);
  assert.deepEqual(t.matched, ['Laravel']);
});

test('special skill names map to good patterns', () => {
  assert.ok(new RegExp(keywordPattern('React'), 'i').test('ReactJS app'));
  assert.ok(new RegExp(keywordPattern('Node.js'), 'i').test('NestJS backend'));
  assert.ok(new RegExp(keywordPattern('C#'), 'i').test('Senior C# dev'));
  assert.ok(!new RegExp(keywordPattern('Go'), 'i').test('Google'));
});

test('US-only posts are pushed down; preferred locations get a bonus', () => {
  const cfg = buildScoreConfig(profile());
  const us = scoreJob({ title: 'React Developer', location: 'USA', description: '' }, cfg);
  const india = scoreJob({ title: 'React Developer', location: 'India', description: '' }, cfg);
  const body = scoreJob({ title: 'React Developer', location: 'Remote', description: 'Applicants must be US citizens.' }, cfg);
  assert.equal(us.score, 16 - 35);
  assert.equal(india.score, 16 + 4);
  assert.ok(body.flags.some((f) => f.startsWith('Location rule')));
});

test('a preferred region is not blocked', () => {
  const cfg = buildScoreConfig(profile({ preferredLocations: ['Europe'] }));
  const r = scoreJob({ title: 'React Developer', location: 'Europe', description: '' }, cfg);
  assert.equal(r.score, 16 + 4);
});

test('exclude keywords and other stacks penalise; own stack is not penalised', () => {
  const cfg = buildScoreConfig(profile({ excludeKeywords: ['crypto'] }));
  assert.ok(scoreJob({ title: 'React Dev', description: 'crypto exchange' }, cfg).flags.includes('Excluded: crypto'));
  assert.ok(scoreJob({ title: 'Python Engineer', description: 'React' }, cfg).flags.includes('Different main stack'));
  const py = buildScoreConfig({ ...profile(), skills: [{ name: 'Python', weight: 8 }] });
  assert.ok(!scoreJob({ title: 'Python Engineer', description: '' }, py).flags.includes('Different main stack'));
});

test('filters: job types and remote-only', () => {
  const cfg = buildScoreConfig(profile({ jobTypes: ['contract'] }));
  assert.equal(passesFilters({ title: 'Dev', jobType: 'Full-Time' }, cfg), false);
  assert.equal(passesFilters({ title: 'Dev', jobType: 'Contract' }, cfg), true);
  assert.equal(passesFilters({ title: 'Dev', jobType: '' }, cfg), true);
  assert.equal(passesFilters({ title: 'Dev (On-site)', location: 'Berlin', jobType: '' }, cfg), false);
});
