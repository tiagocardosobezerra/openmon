'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const installer = require('../src/install');

function tmpSettings(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-'));
  const file = path.join(dir, 'settings.json');
  if (content !== undefined) fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

const other = { type: 'command', command: 'node other.js --agent-fever', async: true };

test('install keeps other settings and other tools hooks, and backs up', () => {
  const file = tmpSettings({ theme: 'dark', hooks: { PreToolUse: [{ matcher: '*', hooks: [other] }] } });
  const { backupPath } = installer.install({ settingsPath: file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.theme, 'dark');
  // Theirs, ours for every tool, ours for the agent's questions.
  assert.equal(s.hooks.PreToolUse.length, 3);
  assert.deepEqual(s.hooks.PreToolUse[0].hooks[0], other);
  for (const event of [...installer.TOOL_EVENTS, ...installer.OTHER_EVENTS]) {
    const ours = s.hooks[event].flatMap((g) => g.hooks).filter((h) => h.command.includes(installer.MARKER) && !h.command.endsWith('--question'));
    assert.equal(ours.length, 1, event);
    assert.equal(ours[0].async, true);
    // Background hooks can wake the agent with a message from the pet.
    assert.equal(ours[0].asyncRewake, true);
    assert.match(ours[0].command, /--rewake$/);
    assert.equal(ours[0].timeout, installer.LISTEN_EVENTS.includes(event) ? installer.LISTEN_SEC : 5, event);
  }
  // The agent's questions: one foreground hook, only for AskUserQuestion.
  const question = s.hooks.PreToolUse.filter((g) => g.matcher === installer.QUESTION_TOOL).flatMap((g) => g.hooks);
  assert.equal(question.length, 1);
  assert.equal(question[0].async, undefined);
  assert.match(question[0].command, /--openmon --question$/);
  assert.ok(installer.hasContactHooks({ settingsPath: file }));
  // Permission requests: one foreground hook that can hand back your answer.
  const perm = s.hooks.PermissionRequest.flatMap((g) => g.hooks).filter((h) => h.command.includes(installer.MARKER));
  assert.equal(perm.length, 1);
  assert.equal(perm[0].async, undefined);
  assert.match(perm[0].command, /--permission$/);
  assert.ok(fs.existsSync(backupPath));
  assert.ok(installer.isInstalled({ settingsPath: file }));
});

test('install twice does not duplicate', () => {
  const file = tmpSettings({});
  installer.install({ settingsPath: file });
  installer.install({ settingsPath: file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.hooks.Stop.length, 1);
  assert.equal(s.hooks.PreToolUse.length, 2);
});

test('hooks from before questions and messages are seen as out of date', () => {
  const old = { type: 'command', command: 'node "x/hook.js" --openmon', async: true, timeout: 5 };
  const file = tmpSettings({ hooks: { Stop: [{ hooks: [old] }], PermissionRequest: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "x/hook.js" --openmon --permission', timeout: 90 }] }] } });
  assert.ok(installer.hasPermissionHook({ settingsPath: file }));
  assert.ok(!installer.hasContactHooks({ settingsPath: file }));
  installer.install({ settingsPath: file });
  assert.ok(installer.hasContactHooks({ settingsPath: file }));
});

test('uninstall removes only ours', () => {
  const file = tmpSettings({ hooks: { Stop: [{ hooks: [other] }] } });
  installer.install({ settingsPath: file });
  const { removed } = installer.uninstall({ settingsPath: file });
  assert.equal(removed, installer.TOOL_EVENTS.length + installer.OTHER_EVENTS.length + 2);
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(s.hooks, { Stop: [{ hooks: [other] }] });
  assert.ok(!installer.isInstalled({ settingsPath: file }));
});

test('missing file is created; broken JSON is refused untouched', () => {
  const fresh = tmpSettings();
  installer.install({ settingsPath: fresh });
  assert.ok(JSON.parse(fs.readFileSync(fresh, 'utf8')).hooks.Stop);
  const broken = tmpSettings('{ nope');
  assert.throws(() => installer.install({ settingsPath: broken }), /not valid JSON/);
  assert.equal(fs.readFileSync(broken, 'utf8'), '{ nope');
});

test('install replaces hooks left by the old Bytelings name', () => {
  const legacy = { type: 'command', command: 'node old/hook.js --bytelings', async: true };
  const file = tmpSettings({ hooks: { Stop: [{ hooks: [legacy] }, { hooks: [other] }] } });
  installer.install({ settingsPath: file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  const commands = s.hooks.Stop.flatMap((g) => g.hooks).map((h) => h.command);
  assert.ok(!commands.some((c) => c.includes('--bytelings')));
  assert.ok(commands.some((c) => c.includes('--openmon')));
  assert.ok(commands.includes(other.command));
});
