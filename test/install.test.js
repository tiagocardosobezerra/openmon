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
  assert.equal(s.hooks.PreToolUse.length, 2);
  assert.deepEqual(s.hooks.PreToolUse[0].hooks[0], other);
  for (const event of [...installer.TOOL_EVENTS, ...installer.OTHER_EVENTS]) {
    const ours = s.hooks[event].flatMap((g) => g.hooks).filter((h) => h.command.includes(installer.MARKER));
    assert.equal(ours.length, 1, event);
    assert.equal(ours[0].async, true);
  }
  assert.ok(fs.existsSync(backupPath));
  assert.ok(installer.isInstalled({ settingsPath: file }));
});

test('install twice does not duplicate', () => {
  const file = tmpSettings({});
  installer.install({ settingsPath: file });
  installer.install({ settingsPath: file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(s.hooks.Stop.length, 1);
});

test('uninstall removes only ours', () => {
  const file = tmpSettings({ hooks: { Stop: [{ hooks: [other] }] } });
  installer.install({ settingsPath: file });
  const { removed } = installer.uninstall({ settingsPath: file });
  assert.equal(removed, installer.TOOL_EVENTS.length + installer.OTHER_EVENTS.length);
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
