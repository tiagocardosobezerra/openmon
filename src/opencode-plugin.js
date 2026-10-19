// Openmon plugin for OpenCode (https://opencode.ai/docs/plugins/).
// `openmon install --agent opencode` copies this file to
// ~/.config/opencode/plugins/openmon.js.
//
// It only tells the local Openmon pet (127.0.0.1) what the agent is doing.
// It never throws (a throwing tool hook would block the tool), never waits
// for an answer, and sends nothing anywhere else.

const PORT = Number(process.env.OPENMON_PORT) || 4747;

const TOOLS = {
  bash: 'Bash',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  patch: 'Edit',
  multiedit: 'MultiEdit',
  grep: 'Grep',
  glob: 'Glob',
  list: 'LS',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  task: 'Task',
  todowrite: 'TodoWrite',
};

function send(payload) {
  try {
    fetch(`http://127.0.0.1:${PORT}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, _agent: 'opencode', _ts: Date.now() }),
    }).catch(() => {});
  } catch {}
}

// OpenCode's argument names (filePath) in the shape Openmon reads (file_path).
function args(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return { ...a, file_path: a.filePath || a.file_path || a.path, command: a.command, pattern: a.pattern, url: a.url, query: a.query };
}

function sessionOf(props) {
  const p = props || {};
  return p.sessionID || p.sessionId || (p.info && (p.info.sessionID || p.info.id)) || 'opencode';
}

export const Openmon = async ({ directory }) => ({
  'tool.execute.before': async (input, output) => {
    send({ hook_event_name: 'PreToolUse', session_id: (input && input.sessionID) || 'opencode', cwd: directory, tool_name: TOOLS[input && input.tool] || (input && input.tool), tool_input: args(output && output.args) });
  },
  'tool.execute.after': async (input, output) => {
    send({ hook_event_name: 'PostToolUse', session_id: (input && input.sessionID) || 'opencode', cwd: directory, tool_name: TOOLS[input && input.tool] || (input && input.tool), tool_input: args(output && output.args), tool_response: output && typeof output.output === 'string' ? output.output.slice(-4000) : '' });
  },
  event: async ({ event }) => {
    const type = event && event.type;
    const session = sessionOf(event && event.properties);
    if (type === 'session.created') send({ hook_event_name: 'SessionStart', session_id: session, cwd: directory, source: 'startup' });
    else if (type === 'session.idle') send({ hook_event_name: 'Stop', session_id: session, cwd: directory });
    else if (type === 'session.compacted') send({ hook_event_name: 'PreCompact', session_id: session, cwd: directory });
    else if (type === 'session.deleted') send({ hook_event_name: 'SessionEnd', session_id: session, cwd: directory });
    else if (type === 'permission.asked') send({ hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'OpenCode needs your permission', session_id: session, cwd: directory });
  },
});
