'use strict';

// Other agents, translated into the Claude Code hook shape the rest of
// Openmon understands. Only documented hook payloads are used:
//
//   Gemini CLI  https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
//   Cursor      https://cursor.com/docs/agent/hooks
//   Aider       --notifications-command (runs when Aider waits for you)
//   OpenCode    src/opencode-plugin.js already sends the Claude Code shape

const GEMINI_EVENTS = {
  BeforeTool: 'PreToolUse',
  AfterTool: 'PostToolUse',
  BeforeAgent: 'UserPromptSubmit',
  AfterAgent: 'Stop',
  SessionStart: 'SessionStart',
  SessionEnd: 'SessionEnd',
  PreCompress: 'PreCompact',
  Notification: 'Notification',
};

const GEMINI_TOOLS = {
  run_shell_command: 'Bash',
  write_file: 'Write',
  replace: 'Edit',
  read_file: 'Read',
  read_many_files: 'Read',
  list_directory: 'LS',
  glob: 'Glob',
  search_file_content: 'Grep',
  web_fetch: 'WebFetch',
  google_web_search: 'WebSearch',
};

function geminiTool(name) {
  if (!name) return name;
  if (GEMINI_TOOLS[name]) return GEMINI_TOOLS[name];
  // MCP tools are mcp_<server>_<tool>; Openmon's are mcp__<server>__<tool>.
  const m = /^mcp_([^_]+)_(.+)$/.exec(name);
  return m ? `mcp__${m[1]}__${m[2]}` : name;
}

function fromGemini(p) {
  const event = GEMINI_EVENTS[p.hook_event_name];
  if (!event) return null;
  const out = { ...p, hook_event_name: event, tool_name: geminiTool(p.tool_name), _agent: 'gemini' };
  const input = p.tool_input || {};
  if (input.absolute_path && !input.file_path) out.tool_input = { ...input, file_path: input.absolute_path };
  if (event === 'PostToolUse' && p.tool_response && p.tool_response.error) out.hook_event_name = 'PostToolUseFailure';
  if (event === 'PostToolUse' && p.tool_response) out.tool_response = p.tool_response.returnDisplay || p.tool_response.llmContent || '';
  // The only documented notification is a tool permission prompt.
  if (event === 'Notification') out.notification_type = p.notification_type === 'ToolPermission' ? 'permission_prompt' : 'other';
  return out;
}

const CURSOR_EVENTS = {
  sessionStart: 'SessionStart',
  sessionEnd: 'SessionEnd',
  postToolUse: 'PostToolUse',
  postToolUseFailure: 'PostToolUseFailure',
  beforeSubmitPrompt: 'UserPromptSubmit',
  stop: 'Stop',
  subagentStop: 'SubagentStop',
  preCompact: 'PreCompact',
};

const CURSOR_TOOLS = { Shell: 'Bash', Terminal: 'Bash', ReadFile: 'Read', Read: 'Read', Write: 'Write', Edit: 'Edit', StrReplace: 'Edit', Grep: 'Grep', Glob: 'Glob', WebSearch: 'WebSearch', WebFetch: 'WebFetch', Delete: 'Edit' };

function fromCursor(p) {
  const event = CURSOR_EVENTS[p.hook_event_name];
  if (!event) return null;
  const roots = Array.isArray(p.workspace_roots) ? p.workspace_roots : [];
  return {
    ...p,
    hook_event_name: event,
    session_id: p.session_id || p.conversation_id,
    cwd: p.cwd || roots[0] || null,
    tool_name: p.tool_name ? CURSOR_TOOLS[p.tool_name] || p.tool_name : undefined,
    tool_response: p.tool_output,
    duration_ms: p.duration,
    _agent: 'cursor',
  };
}

// Aider runs its notifications command when it waits for your next message.
function fromAider(p) {
  return { hook_event_name: 'Stop', session_id: `aider:${p.cwd || 'default'}`, cwd: p.cwd || null, _agent: 'aider', _ts: p._ts };
}

function normalize(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload._agent === 'gemini') return fromGemini(payload);
  if (payload._agent === 'cursor') return fromCursor(payload);
  if (payload._agent === 'aider') return fromAider(payload);
  return payload;
}

// What a synchronous agent's hook must print: valid JSON, never a decision.
function reply(agent, event) {
  if (agent === 'cursor' && event === 'beforeSubmitPrompt') return '{"continue":true}';
  return '{}';
}

module.exports = { normalize, reply, GEMINI_EVENTS, CURSOR_EVENTS };
