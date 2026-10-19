'use strict';

// Turns a raw agent payload into a small, agent-agnostic signal. Claude Code
// hook payloads are the native format; other agents get their own adapter
// function below. Everything downstream only sees signals.
//
// Signal kinds: session-start, session-end, turn-start, turn-end,
// tool-start, tool-done, tool-fail, test-start, test-end, attention,
// subagent-start, subagent-end, compact, api-error.

const path = require('node:path');
const { redact } = require('./redact');

const FAMILIES = {
  craft: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'],
  lore: ['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'TodoWrite', 'TodoRead'],
  shell: ['Bash', 'PowerShell', 'BashOutput', 'KillShell', 'KillBash', 'Monitor'],
  roam: ['WebFetch', 'WebSearch'],
  swarm: ['Task', 'Agent', 'SendMessage'],
};

const TOOL_FAMILY = new Map();
for (const [family, tools] of Object.entries(FAMILIES)) for (const t of tools) TOOL_FAMILY.set(t, family);

const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

// Notification types that mean "a human must act now".
const ATTENTION_TYPES = new Set(['permission_prompt', 'idle_prompt', 'elicitation_dialog', 'agent_needs_input']);

const TEST_COMMAND = new RegExp(
  [
    String.raw`\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b`,
    String.raw`\b(npx\s+)?(jest|vitest|mocha|ava|playwright\s+test|cypress\s+run)\b`,
    String.raw`\bpytest\b`,
    String.raw`\bpython3?\s+-m\s+(pytest|unittest)\b`,
    String.raw`\b(tox|nox)\b`,
    String.raw`\bgo\s+test\b`,
    String.raw`\bcargo\s+(test|nextest)\b`,
    String.raw`\bdotnet\s+test\b`,
    String.raw`\bdeno\s+test\b`,
    String.raw`\bnode\s+--test\b`,
    String.raw`\bmix\s+test\b`,
    String.raw`\b(rspec|phpunit|ctest)\b`,
    String.raw`\bmvnw?\b.*\b(test|verify)\b`,
    String.raw`\bgradlew?\b.*\b(test|check)\b`,
    String.raw`\bmake\s+(test|check)\b`,
  ].join('|'),
  'i',
);

// Order matters: "1 failed, 12 passed" is a failure.
const FAIL_MARKERS = [
  /\b[1-9]\d*\s+(failed|failing|failures?|errors?)\b/i,
  /\bfailures?:\s*[1-9]/i,
  /\bFAIL(ED)?\b/,
  /Traceback \(most recent call last\)/,
  /\bnpm (ERR!|error)/,
  /\bexit(ed)?( with)? code:?\s*[1-9]/i,
  /\btest result: FAILED/,
  /^not ok\b/m,
  /^# fail [1-9]/m,
];

const PASS_MARKERS = [
  /\b[1-9]\d*\s+(passed|passing|tests? passed)\b/i,
  /\bPASS\b/,
  /\btest result: ok\b/,
  /^ok\s+\S+/m,
  /^OK( \(|$)/m,
  /\ball tests passed\b/i,
  /^# pass [1-9]/m,
];

const MAX_OUTPUT = 20000;

function isTestCommand(command) {
  return typeof command === 'string' && TEST_COMMAND.test(command);
}

function responseText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;
  const parts = [];
  for (const key of ['stdout', 'stderr', 'output', 'error', 'content', 'result']) {
    if (typeof response[key] === 'string') parts.push(response[key]);
  }
  return parts.length ? parts.join('\n') : JSON.stringify(response);
}

// true = green, false = red, null = could not tell.
function judgeTestOutput(text) {
  const tail = text.length > MAX_OUTPUT ? text.slice(-MAX_OUTPUT) : text;
  if (FAIL_MARKERS.some((re) => re.test(tail))) return false;
  if (PASS_MARKERS.some((re) => re.test(tail))) return true;
  return null;
}

function toolFamily(name) {
  if (!name) return null;
  if (TOOL_FAMILY.has(name)) return TOOL_FAMILY.get(name);
  if (name.startsWith('mcp__')) return 'roam';
  return null;
}

function sessionLabel(payload) {
  // The hook adds _projectDir (CLAUDE_PROJECT_DIR), which stays fixed when
  // the agent cds around or enters a worktree.
  const dir = payload._projectDir || payload.cwd;
  if (dir) return path.basename(String(dir).replace(/[\\/]+$/, '')) || String(dir);
  if (payload.session_id) return String(payload.session_id).slice(0, 8);
  return 'agent';
}

function describeTool(name, input = {}) {
  // Commands are shown as typed, never cut at a slash: "rm -rf ./x" must
  // stay readable in a permission prompt. Paths are shortened to the file.
  if (typeof input.command === 'string') {
    const line = redact(input.command.split('\n')[0].trim());
    return `${name}: ${line.length > 90 ? `${line.slice(0, 89)}…` : line}`;
  }
  const target = input.file_path || input.notebook_path || input.path || input.pattern || input.url || input.query || input.description || '';
  const short = redact(String(target).split(/[\\/]/).pop().split('\n')[0]).slice(0, 48);
  return short ? `${name} ${short}` : name || 'tool';
}

// The language of the file a tool touched, for regional forms.
const LANGS = {
  js: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'vue', 'svelte'],
  py: ['py', 'pyi', 'ipynb'],
  rs: ['rs'],
  go: ['go'],
  jvm: ['java', 'kt', 'kts', 'scala', 'groovy'],
  cs: ['cs', 'fs', 'vb', 'razor', 'cshtml'],
};
const EXT_LANG = Object.fromEntries(Object.entries(LANGS).flatMap(([lang, exts]) => exts.map((e) => [e, lang])));
function fileLang(input) {
  const file = input.file_path || input.notebook_path || input.path || '';
  const m = /\.([a-z0-9]+)$/i.exec(String(file));
  return m ? EXT_LANG[m[1].toLowerCase()] || null : null;
}

function claudeSignal(payload) {
  const tool = payload.tool_name || null;
  const input = payload.tool_input || {};
  const testing = SHELL_TOOLS.has(tool) && isTestCommand(input.command);
  const base = {
    agent: 'claude',
    session: payload.session_id || 'default',
    label: sessionLabel(payload),
    ts: Number(payload._ts) || null,
    tool,
    toolUseId: payload.tool_use_id || null,
    family: testing ? 'test' : toolFamily(tool),
    // Set when the event comes from inside a subagent; null for the main agent.
    agentId: payload.agent_id || null,
    lang: fileLang(input),
  };

  switch (payload.hook_event_name) {
    case 'SessionStart':
      return { ...base, kind: 'session-start', detail: payload.source || null };
    case 'SessionEnd':
      return { ...base, kind: 'session-end', detail: payload.reason || null };
    case 'UserPromptSubmit':
      return { ...base, kind: 'turn-start' };
    case 'Stop':
      return { ...base, kind: 'turn-end' };
    case 'StopFailure':
      return { ...base, kind: 'api-error', detail: payload.error || 'API error' };
    case 'PreToolUse':
      return { ...base, kind: testing ? 'test-start' : 'tool-start', detail: describeTool(tool, input) };
    case 'PostToolUse':
      if (testing) {
        return { ...base, kind: 'test-end', passed: judgeTestOutput(responseText(payload.tool_response)), detail: describeTool(tool, input) };
      }
      return { ...base, kind: 'tool-done', detail: describeTool(tool, input) };
    case 'PostToolUseFailure':
      if (testing) return { ...base, kind: 'test-end', passed: false, detail: describeTool(tool, input) };
      return { ...base, kind: 'tool-fail', detail: describeTool(tool, input) };
    case 'PermissionRequest':
      return { ...base, kind: 'attention', reason: 'permission', detail: `Allow ${describeTool(tool, input)}?` };
    case 'Notification': {
      const type = payload.notification_type || null;
      // Old versions send no type; every notification then means "look here".
      if (type && !ATTENTION_TYPES.has(type)) return null;
      const reason = type === 'idle_prompt' ? 'idle' : type === 'permission_prompt' ? 'permission' : 'input';
      return { ...base, kind: 'attention', reason, detail: redact(payload.message) || 'Your agent needs you' };
    }
    // For these two, agentId names the subagent being started or stopped.
    case 'SubagentStart':
      return { ...base, kind: 'subagent-start', detail: payload.agent_type || null };
    case 'SubagentStop':
      return { ...base, kind: 'subagent-end', detail: payload.agent_type || null };
    case 'PreCompact':
      return { ...base, kind: 'compact' };
    default:
      return null;
  }
}

// Codex CLI `notify` program: receives one JSON argument per event.
// Today it only reports finished turns.
function codexSignal(payload) {
  if (payload.type !== 'agent-turn-complete') return null;
  const cwd = payload.cwd;
  return {
    agent: 'codex',
    session: `codex:${payload['thread-id'] || payload.thread_id || 'default'}`,
    label: cwd ? path.basename(String(cwd)) : 'codex',
    ts: Number(payload._ts) || null,
    kind: 'turn-end',
    family: null,
    tool: null,
  };
}

// Already-normalised signals (from custom adapters) pass through.
function genericSignal(payload) {
  if (typeof payload.kind !== 'string' || !payload.session) return null;
  return { agent: 'custom', label: String(payload.session), family: null, tool: null, ...payload, ts: Number(payload.ts) || null };
}

function classify(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.hook_event_name) return claudeSignal(payload);
  if (payload._agent === 'codex' || payload.type === 'agent-turn-complete') return codexSignal(payload);
  if (payload._agent === 'signal') return genericSignal(payload);
  return null;
}

module.exports = {
  fileLang, classify, toolFamily, isTestCommand, judgeTestOutput, responseText, FAMILIES };
