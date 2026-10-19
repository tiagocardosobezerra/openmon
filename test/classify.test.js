'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, judgeTestOutput, isTestCommand } = require('../src/classify');

const hook = (hook_event_name, extra = {}) => ({ session_id: 's1', cwd: '/work/my-app', hook_event_name, ...extra });

test('tool calls map to stat families', () => {
  assert.equal(classify(hook('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: 'a.js' } })).family, 'craft');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'Grep', tool_input: {} })).family, 'lore');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' } })).family, 'shell');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'WebSearch', tool_input: {} })).family, 'roam');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'Task', tool_input: {} })).family, 'swarm');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'mcp__github__get_issue', tool_input: {} })).family, 'roam');
  assert.equal(classify(hook('PostToolUse', { tool_name: 'SomethingNew', tool_input: {} })).family, null);
});

test('labels come from the project dir, then cwd', () => {
  assert.equal(classify(hook('Stop')).label, 'my-app');
  assert.equal(classify(hook('Stop', { _projectDir: 'C:\\code\\api\\' })).label, 'api');
});

test('test runs are detected and judged', () => {
  assert.ok(isTestCommand('npm test'));
  assert.ok(isTestCommand('python -m pytest -q'));
  assert.ok(!isTestCommand('npm install'));
  const start = classify(hook('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }));
  assert.equal(start.kind, 'test-start');
  assert.equal(start.family, 'test');
  const green = classify(hook('PostToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: { stdout: '12 passed' } }));
  assert.deepEqual([green.kind, green.passed], ['test-end', true]);
  const red = classify(hook('PostToolUseFailure', { tool_name: 'Bash', tool_input: { command: 'go test ./...' } }));
  assert.deepEqual([red.kind, red.passed], ['test-end', false]);
  assert.equal(judgeTestOutput('1 failed, 12 passed'), false);
  assert.equal(judgeTestOutput('nothing useful'), null);
});

test('waits for the user become attention signals', () => {
  const perm = classify(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf build' }, tool_use_id: 'x' }));
  assert.deepEqual([perm.kind, perm.reason, perm.toolUseId], ['attention', 'permission', 'x']);
  assert.equal(classify(hook('Notification', { notification_type: 'idle_prompt', message: 'waiting' })).reason, 'idle');
  assert.equal(classify(hook('Notification', { message: 'old version, no type' })).kind, 'attention');
  assert.equal(classify(hook('Notification', { notification_type: 'auth_success' })), null);
});

test('lifecycle events', () => {
  assert.equal(classify(hook('UserPromptSubmit', { prompt: 'hi' })).kind, 'turn-start');
  assert.equal(classify(hook('Stop')).kind, 'turn-end');
  assert.equal(classify(hook('StopFailure', { error: 'rate_limit' })).kind, 'api-error');
  assert.equal(classify(hook('SubagentStart', { agent_id: 'a1' })).agentId, 'a1');
  assert.equal(classify(hook('PreCompact')).kind, 'compact');
  assert.equal(classify(hook('SessionEnd', { reason: 'other' })).kind, 'session-end');
  assert.equal(classify(hook('SomeFutureEvent')), null);
});

test('codex notify and junk', () => {
  const codex = classify({ type: 'agent-turn-complete', 'thread-id': 'th', cwd: '/x/proj', _agent: 'codex' });
  assert.deepEqual([codex.kind, codex.session, codex.label], ['turn-end', 'codex:th', 'proj']);
  assert.equal(classify(null), null);
  assert.equal(classify({ hello: 1 }), null);
});

test('commands are described in full, never cut at a slash', () => {
  const sig = classify(hook('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf ./build && npm run deploy' } }));
  assert.equal(sig.detail, 'Allow Bash: rm -rf ./build && npm run deploy?');
  const edit = classify(hook('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: '/code/src/auth.js' } }));
  assert.equal(edit.detail, 'Edit auth.js');
});

test('docs, style, data and git work get their own families', () => {
  const fam = (tool_name, tool_input) => classify(hook('PostToolUse', { tool_name, tool_input })).family;
  assert.equal(fam('Edit', { file_path: '/w/README.md' }), 'docs');
  assert.equal(fam('Write', { file_path: '/w/app.scss' }), 'style');
  assert.equal(fam('Edit', { file_path: '/w/q.sql' }), 'data');
  assert.equal(fam('Read', { file_path: '/w/sales.csv' }), 'data');
  assert.equal(fam('Read', { file_path: '/w/README.md' }), 'lore');
  assert.equal(fam('Bash', { command: 'git commit -m "x"' }), 'git');
  assert.equal(fam('Bash', { command: 'GIT_PAGER=cat gh pr list' }), 'git');
  assert.equal(fam('Bash', { command: 'github-cli x' }), 'shell');
  assert.equal(fam('Bash', { command: 'psql -c "select 1"' }), 'data');
  assert.equal(fam('Bash', { command: 'npm test' }), 'test');
  // Every edit still counts as an edit.
  assert.equal(classify(hook('PostToolUse', { tool_name: 'Edit', tool_input: { file_path: '/w/README.md' } })).edit, true);
});
