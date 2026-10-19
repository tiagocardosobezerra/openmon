'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createUsage, trusted } = require('../src/usage');

const line = (id, input, output, extra = {}) => JSON.stringify({ type: 'assistant', message: { id, model: 'claude-x', usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 100, cache_creation_input_tokens: 10, ...extra } } });

test('tokens: each message counts once, by how much it grew; files are read incrementally', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-usage-')), '.claude', 'projects');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 's.jsonl');
  fs.writeFileSync(file, `${line('m1', 5, 100)}\n${line('m1', 5, 100)}\n{"type":"user"}\n${line('m2', 3, 50)}\n`);
  const u = createUsage();
  assert.deepEqual(u.read(file), { input: 8, output: 150, cacheRead: 200, cacheWrite: 20 });
  assert.deepEqual(u.read(file), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  // The streamed message grew; a half-written last line waits for the rest.
  fs.appendFileSync(file, `${line('m2', 3, 80)}\n${line('m3', 1, 1).slice(0, 20)}`);
  assert.deepEqual(u.read(file), { input: 0, output: 30, cacheRead: 0, cacheWrite: 0 });
});

test('only conversation files inside a .claude folder are read', () => {
  assert.equal(trusted('/home/x/.claude/projects/a/b.jsonl'), true);
  assert.equal(trusted('/etc/passwd'), false);
  assert.equal(trusted('/home/x/notes.jsonl'), false);
  assert.equal(createUsage().read('/home/x/secret.txt'), null);
});
