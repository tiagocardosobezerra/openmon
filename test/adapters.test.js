'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { normalize } = require('../src/adapters');
const { classify } = require('../src/classify');
const installer = require('../src/install');

const HOOK = path.join(__dirname, '..', 'src', 'hook.js');

test('Gemini CLI: tools, failures and permission prompts in Claude Code terms', () => {
  const after = normalize({ _agent: 'gemini', hook_event_name: 'AfterTool', session_id: 'g1', cwd: '/w/app', tool_name: 'run_shell_command', tool_input: { command: 'npm test' }, tool_response: { llmContent: 'ok', returnDisplay: '3 passed' } });
  assert.equal(after.hook_event_name, 'PostToolUse');
  assert.equal(after.tool_name, 'Bash');
  const sig = classify(after);
  assert.equal(sig.agent, 'gemini');
  assert.equal(sig.label, 'app');
  const failed = normalize({ _agent: 'gemini', hook_event_name: 'AfterTool', tool_name: 'replace', tool_input: { file_path: 'a.js' }, tool_response: { error: 'nope' } });
  assert.equal(failed.hook_event_name, 'PostToolUseFailure');
  assert.equal(failed.tool_name, 'Edit');
  const ask = normalize({ _agent: 'gemini', hook_event_name: 'Notification', notification_type: 'ToolPermission', message: 'Allow shell?' });
  assert.equal(classify(ask).kind, 'attention');
  assert.equal(normalize({ _agent: 'gemini', hook_event_name: 'AfterTool', tool_name: 'mcp_github_create_issue' }).tool_name, 'mcp__github__create_issue');
  assert.equal(normalize({ _agent: 'gemini', hook_event_name: 'BeforeModel' }), null);
});

test('Cursor: conversation, workspace and tools in Claude Code terms', () => {
  const p = normalize({ _agent: 'cursor', hook_event_name: 'postToolUse', conversation_id: 'c1', workspace_roots: ['/w/site'], tool_name: 'Shell', tool_input: { command: 'ls' }, tool_output: '{}', duration: 12 });
  assert.equal(p.hook_event_name, 'PostToolUse');
  assert.equal(p.session_id, 'c1');
  assert.equal(classify(p).label, 'site');
  assert.equal(classify(p).family, 'shell');
  assert.equal(classify(normalize({ _agent: 'cursor', hook_event_name: 'stop', conversation_id: 'c1', workspace_roots: ['/w/site'] })).kind, 'turn-end');
  assert.equal(normalize({ _agent: 'cursor', hook_event_name: 'preToolUse' }), null);
});

test('synchronous agents always get valid JSON back, even with no pet running', () => {
  const env = { ...process.env, OPENMON_PORT: '1' };
  const gemini = spawnSync(process.execPath, [HOOK, '--openmon', '--gemini'], { input: JSON.stringify({ hook_event_name: 'AfterTool', tool_name: 'read_file' }), env });
  assert.equal(gemini.status, 0);
  assert.deepEqual(JSON.parse(gemini.stdout.toString()), {});
  const cursor = spawnSync(process.execPath, [HOOK, '--openmon', '--cursor'], { input: JSON.stringify({ hook_event_name: 'beforeSubmitPrompt', prompt: 'hi' }), env });
  assert.deepEqual(JSON.parse(cursor.stdout.toString()), { continue: true });
});

test('installs into Gemini CLI settings and Cursor hooks.json, keeping what was there', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-agents-'));
  const gemini = path.join(dir, 'settings.json');
  fs.writeFileSync(gemini, JSON.stringify({ theme: 'x', hooks: { AfterTool: [{ matcher: '*', hooks: [{ type: 'command', command: 'other.sh' }] }] } }));
  installer.installGemini({ settingsPath: gemini });
  installer.installGemini({ settingsPath: gemini });
  const g = JSON.parse(fs.readFileSync(gemini, 'utf8'));
  assert.equal(g.theme, 'x');
  assert.equal(g.hooks.AfterTool.length, 2);
  assert.match(g.hooks.AfterTool[1].hooks[0].command, /--gemini$/);
  const cursor = path.join(dir, 'hooks.json');
  fs.writeFileSync(cursor, JSON.stringify({ version: 1, hooks: { stop: [{ command: './audit.sh' }] } }));
  installer.installCursor({ settingsPath: cursor });
  const c = JSON.parse(fs.readFileSync(cursor, 'utf8'));
  assert.equal(c.hooks.stop.length, 2);
  assert.equal(c.hooks.preToolUse, undefined);
  assert.equal(installer.uninstallCursor({ settingsPath: cursor }).removed, installer.CURSOR_HOOK_EVENTS.length);
  assert.deepEqual(JSON.parse(fs.readFileSync(cursor, 'utf8')).hooks.stop, [{ command: './audit.sh' }]);
});
