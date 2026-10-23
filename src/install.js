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
// The agent's questions (AskUserQuestion) get a foreground hook too, so you
// can pick an answer on the pet. Same setting, same rule: no answer in
// time and Claude Code asks you as usual.
const QUESTION_TOOL = 'AskUserQuestion';
// Background hooks run with asyncRewake: one that exits with code 2 wakes
// Claude Code with its message. That is how a message you write on the pet
// reaches the conversation. When a session goes idle (Stop) or starts, the
// hook stays in the background up to an hour, waiting for one.
const LISTEN_EVENTS = ['SessionStart', 'Stop'];
const LISTEN_SEC = 3600;

function defaultSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function hookScript() {
  // Inside an installed app the hook is unpacked next to the asar archive,
  // because the agent runs it with plain Node.
  return path.join(__dirname, 'hook.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`).replace(/\\/g, '/');
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
  const handler = { type: 'command', command: `${command} --rewake`, async: true, asyncRewake: true, timeout: 5 };
  for (const event of TOOL_EVENTS) (hooks[event] ||= []).push({ matcher: '*', hooks: [handler] });
  (hooks.PreToolUse ||= []).push({ matcher: QUESTION_TOOL, hooks: [{ type: 'command', command: `${command} --question`, timeout: 90 }] });
  (hooks[PERMISSION_EVENT] ||= []).push({ matcher: '*', hooks: [{ type: 'command', command: `${command} --permission`, timeout: 90 }] });
  for (const event of OTHER_EVENTS) (hooks[event] ||= []).push({ hooks: [{ ...handler, timeout: LISTEN_EVENTS.includes(event) ? LISTEN_SEC : 5 }] });
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

// Whether the hooks for questions and messages from the pet are installed
// (installs before v0.5 had neither).
function hasContactHooks({ settingsPath = defaultSettingsPath() } = {}) {
  try {
    const hooks = readSettings(settingsPath).settings.hooks || {};
    const ours = (event) => (hooks[event] || []).flatMap((g) => g.hooks || []).filter(isOurs);
    return ours('PreToolUse').some((h) => / --question$/.test(h.command) && !h.async) && ours('Stop').some((h) => h.asyncRewake && / --rewake$/.test(h.command));
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

// --- other agents -------------------------------------------------------------

function geminiSettingsPath() {
  return path.join(os.homedir(), '.gemini', 'settings.json');
}

function cursorHooksPath() {
  return path.join(os.homedir(), '.cursor', 'hooks.json');
}

const GEMINI_HOOK_EVENTS = ['BeforeTool', 'AfterTool', 'BeforeAgent', 'AfterAgent', 'SessionStart', 'SessionEnd', 'Notification', 'PreCompress'];
// Not preToolUse or subagentStart: there Cursor treats a hook's answer as
// a permission decision.
const CURSOR_HOOK_EVENTS = ['sessionStart', 'sessionEnd', 'postToolUse', 'postToolUseFailure', 'beforeSubmitPrompt', 'stop', 'subagentStop', 'preCompact'];

function installGemini({ settingsPath = geminiSettingsPath() } = {}) {
  const { settings, existed } = readSettings(settingsPath);
  if (existed) fs.copyFileSync(settingsPath, `${settingsPath}.openmon-backup`);
  const { hooks } = strip(settings.hooks);
  const command = `${hookCommand()} --gemini`;
  for (const event of GEMINI_HOOK_EVENTS) (hooks[event] ||= []).push({ matcher: '*', hooks: [{ name: 'openmon', type: 'command', command, timeout: 3000 }] });
  write(settingsPath, { ...settings, hooks });
  return { settingsPath, backupPath: existed ? `${settingsPath}.openmon-backup` : null };
}

function installCursor({ settingsPath = cursorHooksPath() } = {}) {
  const { settings, existed } = readSettings(settingsPath);
  if (existed) fs.copyFileSync(settingsPath, `${settingsPath}.openmon-backup`);
  const hooks = {};
  for (const [event, list] of Object.entries(settings.hooks || {})) hooks[event] = (Array.isArray(list) ? list : []).filter((h) => !isOurs(h));
  const command = `${hookCommand()} --cursor`;
  for (const event of CURSOR_HOOK_EVENTS) (hooks[event] ||= []).push({ command, timeout: 3 });
  write(settingsPath, { version: settings.version || 1, ...settings, hooks });
  return { settingsPath, backupPath: existed ? `${settingsPath}.openmon-backup` : null };
}

function uninstallCursor({ settingsPath = cursorHooksPath() } = {}) {
  const { settings, existed } = readSettings(settingsPath);
  if (!existed) return { settingsPath, removed: 0 };
  let removed = 0;
  const hooks = {};
  for (const [event, list] of Object.entries(settings.hooks || {})) {
    const kept = (Array.isArray(list) ? list : []).filter((h) => !isOurs(h));
    removed += (Array.isArray(list) ? list.length : 0) - kept.length;
    if (kept.length) hooks[event] = kept;
  }
  write(settingsPath, { ...settings, hooks });
  return { settingsPath, removed };
}

// OpenCode loads plugins from ~/.config/opencode/plugins (all systems).
function openCodePluginPath() {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins', 'openmon.js');
}

function installOpenCode({ pluginPath = openCodePluginPath() } = {}) {
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'opencode-plugin.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`), pluginPath);
  return { settingsPath: pluginPath };
}

function uninstallOpenCode({ pluginPath = openCodePluginPath() } = {}) {
  if (!fs.existsSync(pluginPath)) return { settingsPath: pluginPath, removed: 0 };
  fs.rmSync(pluginPath);
  return { settingsPath: pluginPath, removed: 1 };
}

function aiderLine() {
  return `aider --notifications --notifications-command "${hookCommand()} --aider"`;
}

module.exports = { installOpenCode, uninstallOpenCode, openCodePluginPath, installGemini, installCursor, uninstallCursor, geminiSettingsPath, cursorHooksPath, aiderLine, GEMINI_HOOK_EVENTS, CURSOR_HOOK_EVENTS, install, uninstall, isInstalled, hasPermissionHook, hasContactHooks, withHooks, strip, hookCommand, codexNotifyLine, MARKER, TOOL_EVENTS, OTHER_EVENTS, PERMISSION_EVENT, QUESTION_TOOL, LISTEN_EVENTS, LISTEN_SEC };
