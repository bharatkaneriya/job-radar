import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOURCES } from '../lib/server/services/sources/index.js';
import { DEFAULT_SOURCES } from '../lib/server/services/defaults.js';

for (const [name, src] of Object.entries(SOURCES)) {
  test(`${name} parses its fixture`, () => {
    const raw = JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
    const jobs = src.parse(raw, DEFAULT_SOURCES[name]);
    assert.ok(jobs.length > 0, 'no jobs parsed');
    for (const j of jobs) {
      assert.ok(j.sourceId && j.title && j.url, `missing fields in ${JSON.stringify(j).slice(0, 120)}`);
    }
  });
}
