import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { createLogger } from '../lib/server/logger.js';

// A logger writing to memory; LOG_LEVEL is set per call because helpers.js silences logs.
function capture(level = 'info') {
  const lines = [];
  const saved = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const log = createLogger({ write: (line) => lines.push(JSON.parse(line)) });
  process.env.LOG_LEVEL = saved;
  return { log, lines };
}

test('writes one JSON object with a readable level and time, without pid or hostname', () => {
  const { log, lines } = capture();
  log.info({ source: 'remotive' }, 'Fetched');
  const [line] = lines;
  assert.equal(line.level, 'info');
  assert.equal(line.msg, 'Fetched');
  assert.equal(line.source, 'remotive');
  assert.match(line.time, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(line.pid, undefined);
  assert.equal(line.hostname, undefined);
});

test('LOG_LEVEL filters what gets written', () => {
  const { log, lines } = capture('warn');
  log.info('hidden');
  log.warn('shown');
  assert.deepEqual(lines.map((l) => l.msg), ['shown']);
  const silent = capture('silent');
  silent.log.fatal('hidden');
  assert.equal(silent.lines.length, 0);
});

test('secret fields are masked, at the top level and one level down', () => {
  const { log, lines } = capture();
  const secrets = { password: 'p4ss', passwordHash: 'h4sh', token: 't0ken', credential: 'cr3d', authorization: 'Bearer x1', cookie: 'token=c00kie', secret: 's3cret' };
  log.info({ ...secrets, code: '123456', body: secrets, email: 'kept@example.com' }, 'Check');
  const text = JSON.stringify(lines[0]);
  for (const value of [...Object.values(secrets), '123456']) assert.ok(!text.includes(value), `${value} leaked`);
  assert.equal(lines[0].password, '[redacted]');
  assert.equal(lines[0].body.token, '[redacted]');
  assert.equal(lines[0].email, 'kept@example.com');
});

test('errors keep their message, stack and code', () => {
  const { log, lines } = capture();
  const err = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  log.error({ err }, 'Send failed');
  assert.equal(lines[0].err.message, 'connect refused');
  assert.equal(lines[0].err.code, 'ECONNREFUSED');
  assert.match(lines[0].err.stack, /connect refused/);
});

test('a child logger carries its fields on every line', () => {
  const { log, lines } = capture();
  log.child({ reqId: 'abc' }).info('Request');
  assert.equal(lines[0].reqId, 'abc');
});
