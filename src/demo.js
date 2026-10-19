'use strict';

// A scripted Claude Code session, as raw hook payloads. It touches every
// pose: thinking, reading, editing, a permission prompt, a red test run,
// subagents, the web, a green run, done, and a hatch along the way.

const DEMO_START_XP = 20;

function demoScript() {
  const session_id = 'demo';
  const cwd = '/home/you/todo-app';
  const at = (delay, hook_event_name, extra = {}) => ({ delay, payload: { session_id, cwd, hook_event_name, ...extra } });
  const tool = (delay, event, tool_name, tool_input, extra = {}) => at(delay, event, { tool_name, tool_input, tool_use_id: `t${delay}`, ...extra });

  return [
    at(0, 'SessionStart', { source: 'startup' }),
    at(800, 'UserPromptSubmit', { prompt: 'demo' }),
    tool(2000, 'PreToolUse', 'Read', { file_path: 'src/auth.js' }),
    tool(3500, 'PostToolUse', 'Read', { file_path: 'src/auth.js' }),
    tool(3700, 'PreToolUse', 'Grep', { pattern: 'session' }),
    tool(5000, 'PostToolUse', 'Grep', { pattern: 'session' }),
    tool(5200, 'PreToolUse', 'Edit', { file_path: 'src/auth.js' }),
    tool(8000, 'PostToolUse', 'Edit', { file_path: 'src/auth.js' }),
    tool(8300, 'PreToolUse', 'Bash', { command: 'npm test' }, { tool_use_id: 'test1' }),
    tool(8500, 'PermissionRequest', 'Bash', { command: 'npm test' }, { tool_use_id: 'test1' }),
    at(8600, 'Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
    tool(13500, 'PostToolUse', 'Bash', { command: 'npm test' }, { tool_use_id: 'test1', tool_response: { stdout: 'Tests: 1 failed, 11 passed, 12 total' } }),
    tool(15000, 'PreToolUse', 'Edit', { file_path: 'src/session.js' }),
    tool(17500, 'PostToolUse', 'Edit', { file_path: 'src/session.js' }),
    at(17800, 'SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }),
    at(18000, 'SubagentStart', { agent_id: 'a2', agent_type: 'Explore' }),
    tool(18400, 'PreToolUse', 'WebSearch', { query: 'cookie sameSite lax' }),
    tool(20500, 'PostToolUse', 'WebSearch', { query: 'cookie sameSite lax' }),
    at(21500, 'SubagentStop', { agent_id: 'a1', agent_type: 'Explore' }),
    at(22300, 'SubagentStop', { agent_id: 'a2', agent_type: 'Explore' }),
    tool(22600, 'PreToolUse', 'Bash', { command: 'npm test' }),
    tool(26000, 'PostToolUse', 'Bash', { command: 'npm test' }, { tool_response: { stdout: 'Tests: 12 passed, 12 total' } }),
    at(28000, 'Stop', { stop_hook_active: false }),
  ];
}

module.exports = { demoScript, DEMO_START_XP };
