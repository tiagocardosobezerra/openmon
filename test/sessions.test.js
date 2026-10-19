'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessions, SLEEP_AFTER_MS, ERROR_SHOW_MS } = require('../src/sessions');

const sig = (kind, extra = {}) => ({ session: 's1', label: 'app', kind, ...extra });

test('pose follows the work', () => {
  const s = createSessions();
  s.apply(sig('turn-start'), 1000);
  assert.equal(s.snapshot(1000).pose, 'working');
  s.apply(sig('tool-start', { family: 'craft', detail: 'Edit a.js' }), 2000);
  const snap = s.snapshot(2000);
  assert.equal(snap.family, 'craft');
  assert.equal(snap.focus.detail, 'Edit a.js');
  s.apply(sig('turn-end'), 3000);
  assert.equal(s.snapshot(3000).pose, 'done');
  s.apply(sig('turn-start'), 4000);
  assert.equal(s.snapshot(4000).pose, 'working');
});

test('attention wins over everything and measures the answer time', () => {
  const s = createSessions();
  s.apply(sig('turn-start'), 0);
  s.apply({ ...sig('turn-start'), session: 's2', label: 'other' }, 0);
  s.apply(sig('attention', { reason: 'permission', detail: 'Allow Bash?', toolUseId: 't1' }), 10_000);
  const snap = s.snapshot(10_000);
  assert.equal(snap.pose, 'attention');
  assert.equal(snap.focus.label, 'app');
  assert.equal(snap.counts.waiting, 1);
  const ctx = s.apply(sig('tool-done', { toolUseId: 't1' }), 14_000);
  assert.deepEqual(ctx.reaction, { ms: 4000, reason: 'permission' });
  assert.equal(s.snapshot(14_000).pose, 'working');
});

test('a late PreToolUse from the same call does not end the wait', () => {
  const s = createSessions();
  s.apply(sig('attention', { reason: 'permission', toolUseId: 't1', ts: 5000 }), 5000);
  // Same call, arrived late.
  s.apply(sig('tool-start', { toolUseId: 't1', ts: 5100 }), 5200);
  // Earlier timestamp than the wait.
  s.apply(sig('tool-start', { toolUseId: 't0', ts: 4900 }), 5300);
  assert.equal(s.snapshot(5300).pose, 'attention');
});

test('subagent work does not end the main agent wait', () => {
  const s = createSessions();
  s.apply(sig('attention', { reason: 'permission' }), 1000);
  s.apply(sig('tool-done', { agentId: 'sub1' }), 5000);
  assert.equal(s.snapshot(5000).pose, 'attention');
  s.apply(sig('turn-start'), 6000);
  assert.equal(s.snapshot(6000).pose, 'working');
});

test('errors show briefly, then the pet goes back to work', () => {
  const s = createSessions();
  s.apply(sig('turn-start'), 0);
  s.apply(sig('tool-fail', { detail: 'Bash' }), 1000);
  assert.equal(s.snapshot(1500).pose, 'error');
  assert.equal(s.snapshot(1000 + ERROR_SHOW_MS + 1).pose, 'working');
});

test('subagents are counted and sessions end', () => {
  const s = createSessions();
  s.apply(sig('subagent-start', { agentId: 'a' }), 0);
  s.apply(sig('subagent-start', { agentId: 'b' }), 0);
  assert.equal(s.snapshot(0).counts.subagents, 2);
  s.apply(sig('subagent-end', { agentId: 'a' }), 1);
  assert.equal(s.snapshot(1).counts.subagents, 1);
  s.apply(sig('session-end'), 2);
  assert.equal(s.size(), 0);
});

test('the pet falls asleep when nothing happens', () => {
  const s = createSessions();
  assert.equal(s.snapshot(0).pose, 'sleep');
  s.apply(sig('session-start'), 1000);
  assert.equal(s.snapshot(2000).pose, 'idle');
  assert.equal(s.snapshot(1000 + SLEEP_AFTER_MS + 1).pose, 'sleep');
});

test('working sessions count for the swarm achievement', () => {
  const s = createSessions();
  let ctx;
  for (let i = 0; i < 5; i++) ctx = s.apply({ session: `s${i}`, label: 'x', kind: 'turn-start' }, i);
  assert.equal(ctx.workingSessions, 5);
});

test('idle prompts after a finished turn do not raise the alarm', () => {
  const s = createSessions();
  s.apply(sig('turn-start'), 0);
  s.apply(sig('turn-end'), 1000);
  s.apply(sig('attention', { reason: 'idle', detail: 'Claude is waiting for your input' }), 61_000);
  const snap = s.snapshot(61_000);
  assert.equal(snap.pose, 'done');
  assert.equal(snap.counts.waiting, 0);
});
