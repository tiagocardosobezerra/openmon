'use strict';

// Adds/removes Openmon hooks in a Claude Code settings file. Every other
// setting and every other tool's hooks stay as they are; our entries are
// found by MARKER in the command.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MARKER = '--openmon';
// Markers of earlier names; install and uninstall clean these up too.
const LEGACY_MARKERS = ['--bytelings'];
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure'];
// Permission requests get a foreground hook, so that (only when you turn on
// "Answer permissions from the pet") it can hand your answer to Claude Code.
// With the setting off it returns at once and prints nothing.
const PERMISSION_EVENT = 'PermissionRequest';
const OTHER_EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact'];

function defaultSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function hookScript() {
  return path.join(__dirname, 'hook.js').replace(/\\/g, '/');
}

function hookCommand() {
  return `node "${hookScript()}" ${MARKER}`;
}

function codexNotifyLine() {
  return `notify = ["node", "${hookScript()}", "--codex"]`;
}

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return { settings: {}, existed: false };
  const text = fs.readFileSync(settingsPath, 'utf8');
  if (!text.trim()) return { settings: {}, existed: true };
  try {
    return { settings: JSON.parse(text), existed: true };
  } catch {
    throw new Error(`${settingsPath} is not valid JSON. Fix it first; Openmon did not change it.`);
  }
}

function isOurs(hook) {
  return Boolean(hook && typeof hook.command === 'string' && [MARKER, ...LEGACY_MARKERS].some((m) => hook.command.includes(m)));
}

// Returns a copy of `hooks` without our entries, plus how many were removed.
function strip(hooks = {}) {
  let removed = 0;
  const out = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) {
      out[event] = groups;
      continue;
    }
    const kept = [];
    for (const group of groups) {
      const inner = Array.isArray(group && group.hooks) ? group.hooks : [];
      const rest = inner.filter((h) => !isOurs(h));
      removed += inner.length - rest.length;
      if (rest.length || !inner.length) kept.push(rest.length === inner.length ? group : { ...group, hooks: rest });
    }
    if (kept.length) out[event] = kept;
  }
  return { hooks: out, removed };
}

function withHooks(settings, command = hookCommand()) {
  const { hooks } = strip(settings.hooks);
  const handler = { type: 'command', command, async: true, timeout: 5 };
  for (const event of TOOL_EVENTS) (hooks[event] ||= []).push({ matcher: '*', hooks: [handler] });
  (hooks[PERMISSION_EVENT] ||= []).push({ matcher: '*', hooks: [{ type: 'command', command: `${command} --permission`, timeout: 90 }] });
  for (const event of OTHER_EVENTS) (hooks[event] ||= []).push({ hooks: [{ ...handler }] });
  return { ...settings, hooks };
}

function write(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.openmon-tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  fs.renameSync(tmp, settingsPath);
}

function install({ settingsPath = defaultSettingsPath() } = {}) {
  const { settings, existed } = readSettings(settingsPath);
  let backupPath = null;
  if (existed) {
    backupPath = `${settingsPath}.openmon-backup`;
    fs.copyFileSync(settingsPath, backupPath);
  }
  write(settingsPath, withHooks(settings));
  return { settingsPath, backupPath };
}

function uninstall({ settingsPath = defaultSettingsPath() } = {}) {
  const { settings, existed } = readSettings(settingsPath);
  if (!existed) return { settingsPath, removed: 0 };
  const { hooks, removed } = strip(settings.hooks);
  if (removed) {
    const next = { ...settings, hooks };
    if (!Object.keys(hooks).length) delete next.hooks;
    write(settingsPath, next);
  }
  return { settingsPath, removed };
}

// Whether the foreground permission hook is installed (older installs had
// only background hooks).
function hasPermissionHook({ settingsPath = defaultSettingsPath() } = {}) {
  try {
    const { settings } = readSettings(settingsPath);
    return ((settings.hooks || {})[PERMISSION_EVENT] || []).some((g) => (g.hooks || []).some((h) => isOurs(h) && / --permission$/.test(h.command) && !h.async));
  } catch {
    return false;
  }
}

function isInstalled({ settingsPath = defaultSettingsPath() } = {}) {
  try {
    const { settings } = readSettings(settingsPath);
    return Object.values(settings.hooks || {}).some((groups) => Array.isArray(groups) && groups.some((g) => (g.hooks || []).some(isOurs)));
  } catch {
    return false;
  }
}

module.exports = { install, uninstall, isInstalled, hasPermissionHook, withHooks, strip, hookCommand, codexNotifyLine, MARKER, TOOL_EVENTS, OTHER_EVENTS, PERMISSION_EVENT };
