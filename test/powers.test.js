'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPowers, unlockedPowers, testSummary } = require('../src/powers');

const T = 1_000_000;
const hook = (hook_event_name, extra = {}) => ({ session_id: 's1', cwd: '/w/app', hook_event_name, ...extra });

test('each lineage power keeps its own log', () => {
  const p = createPowers();
  p.record(hook('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: '/w/app/a.js', old_string: 'x', new_string: 'y\nz' } }), 'app', T);
  p.record(hook('PostToolUse', { tool_name: 'Write', tool_input: { file_path: '/w/app/b.js', content: '1\n2\n3' } }), 'app', T + 1);
  p.record(hook('PostToolUse', { tool_name: 'Read', tool_input: { file_path: '/w/app/a.js' } }), 'app', T + 2);
  p.record(hook('PostToolUse', { tool_name: 'Read', tool_input: { file_path: '/w/app/a.js' } }), 'app', T + 3);
  p.record(hook('PostToolUse', { tool_name: 'Grep', tool_input: { pattern: 'todo' } }), 'app', T + 4);
  p.record(hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { stdout: 'Tests: 2 failed, 5 passed' }, duration_ms: 1200 }), 'app', T + 5);
  p.record(hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { stdout: 'Tests: 7 passed' } }), 'app', T + 6);
  p.record(hook('PostToolUseFailure', { tool_name: 'Bash', tool_input: { command: 'git push' } }), 'app', T + 7);
  p.record(hook('PostToolUse', { tool_name: 'WebFetch', tool_input: { url: 'https://example.com/docs' } }), 'app', T + 8);
  p.record(hook('PostToolUse', { tool_name: 'mcp__github__get_issue', tool_input: {} }), 'app', T + 9);
  p.record(hook('SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }), 'app', T + 10);
  p.record(hook('SubagentStop', { agent_id: 'a1', agent_type: 'Explore' }), 'app', T + 20);
  const [s] = p.view();
  assert.equal(s.label, 'app');
  assert.deepEqual(s.craft.map((x) => [x.name, x.edits, x.added, x.removed]), [['b.js', 1, 3, 0], ['a.js', 1, 2, 1]]);
  assert.equal(s.lore.reads[0].count, 2);
  assert.equal(s.lore.searches[0].pattern, 'todo');
  assert.deepEqual(s.shell.map((c) => [c.command, c.ok]), [['git push', false], ['npm test', true], ['npm test', true]]);
  assert.deepEqual(s.test.runs.map((r) => r.passed), [true, false]);
  assert.equal(s.test.runs[1].summary, 'Tests: 2 failed, 5 passed');
  assert.equal(s.test.streak, 1);
  assert.deepEqual(s.roam.map((w) => w.kind), ['mcp', 'page']);
  assert.equal(s.swarm[0].endedAt, T + 20);
});

test('only the most recent sessions are kept', () => {
  const p = createPowers();
  for (let i = 0; i < 9; i++) p.record({ session_id: 's' + i, hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'x' } }, 'x', T + i);
  assert.equal(p.size(), 6);
  assert.equal(p.view()[0].id, 's8');
});

test('powers unlock with every lineage ever grown, plus a Chimera pair', () => {
  assert.deepEqual(unlockedPowers({ dex: { egg: 1, sprout: 2 } }), []);
  assert.deepEqual(unlockedPowers({ dex: { 'test-adult': 1, 'craft-juvenile': 1 } }), ['craft', 'test']);
  assert.deepEqual(unlockedPowers({ dex: { 'chimera-adult': 1 }, chimera: ['roam', 'lore'] }), ['lore', 'roam']);
});

test('test summary line', () => {
  assert.equal(testSummary('lots\nof\noutput\nTests: 1 failed, 3 passed\nTime: 2s'), 'Tests: 1 failed, 3 passed');
  assert.equal(testSummary('nothing here'), null);
});

test('each turn has a recap: files, commands, tests, time', () => {
  const p = createPowers();
  p.record(hook('UserPromptSubmit'), 'app', T);
  p.record(hook('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'a.js', old_string: 'x', new_string: 'y' } }), 'app', T + 1000);
  p.record(hook('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'a.js', old_string: 'y', new_string: 'z' } }), 'app', T + 2000);
  p.record(hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { stdout: '3 passed' } }), 'app', T + 3000);
  p.record(hook('Stop'), 'app', T + 65_000);
  const r = p.recap('s1');
  assert.deepEqual([r.files, r.edits, r.commands, r.green, r.red, r.ms, r.done], [1, 2, 1, 1, 0, 65_000, true]);
  p.record(hook('UserPromptSubmit'), 'app', T + 70_000);
  assert.equal(p.recap('s1').edits, 0);
});

test('docs, git, debug, data and style views', () => {
  const p = createPowers();
  let t = T;
  const ev = (e, tool_name, tool_input, extra = {}) => p.record(hook(e, { tool_name, tool_input, ...extra }), 'app', t++);
  ev('PostToolUse', 'Edit', { file_path: '/w/app/README.md', old_string: 'a', new_string: 'b\nc' });
  ev('PostToolUse', 'Write', { file_path: '/w/app/ui.css', content: 'a' });
  ev('PostToolUse', 'Bash', { command: 'git commit -m x' });
  ev('PostToolUse', 'Bash', { command: 'git status' });
  ev('PostToolUse', 'Bash', { command: 'sqlite3 a.db .tables' });
  ev('PostToolUse', 'Read', { file_path: '/w/app/d.csv' });
  ev('PostToolUseFailure', 'Bash', { command: 'make build' });
  ev('PostToolUse', 'Bash', { command: 'ls' });
  ev('PostToolUse', 'Bash', { command: 'make build' });
  const v = p.view()[0];
  assert.deepEqual(v.docs.map((f) => f.name), ['README.md']);
  assert.deepEqual(v.style.map((f) => f.name), ['ui.css']);
  assert.equal(v.git.commands.length, 2);
  assert.equal(v.git.commits, 1);
  assert.equal(v.data.queries.length, 1);
  assert.deepEqual(v.data.files.map((f) => [f.name, f.reads]), [['d.csv', 1]]);
  assert.equal(v.debug.fixes.length, 1);
  assert.equal(v.debug.fixes[0].target, 'make build');
  assert.equal(v.debug.open, null);
});

test('generated shiny and night art is up to date', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { build } = require('../tools/build-variants');
  for (const [name, text] of Object.entries(build())) {
    assert.equal(fs.readFileSync(path.join(__dirname, '..', 'art', 'official', name), 'utf8'), text, name);
  }
});
