'use strict';

// Openmon's tools for Claude: a small MCP server (JSON-RPC over standard
// input and output) that Claude Code starts for the conversations Openmon
// opens. Each tool call is passed on to the Openmon daemon, which does it:
// a reminder, a scheduled task, a note in the assistant's memory, a line in
// the pet's bubble, a notification, a summary of the agents' work.
//
//   OPENMON_PORT       the daemon's port
//   OPENMON_TOOL_KEY   the key for these tools only (it changes every start)

const http = require('node:http');

const TOOLS = [
  {
    name: 'remind',
    description: 'Set a reminder: at that time the Openmon pet tells the user (bubble and notification). Give in_minutes, or at ("HH:MM", today or tomorrow), optionally repeat ("daily" or "weekdays") with at.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'What to remind, in the user\'s language.' }, in_minutes: { type: 'number' }, at: { type: 'string', description: 'HH:MM, 24 h, local time' }, repeat: { type: 'string', enum: ['daily', 'weekdays'] } }, required: ['text'] },
  },
  {
    name: 'schedule_task',
    description: 'Schedule work for Claude: at that time Openmon starts a new conversation with this prompt (in the assistant folder unless a folder is given) and the pet tells the user when it is done. Same timing fields as remind.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, in_minutes: { type: 'number' }, at: { type: 'string' }, repeat: { type: 'string', enum: ['daily', 'weekdays'] }, folder: { type: 'string', description: 'Absolute path; default the assistant folder.' } }, required: ['prompt'] },
  },
  { name: 'list_schedule', description: 'List the reminders and scheduled tasks, with their ids and next times.', inputSchema: { type: 'object', properties: {} } },
  { name: 'cancel_scheduled', description: 'Cancel a reminder or scheduled task by id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  {
    name: 'remember',
    description: 'Save a lasting fact about the user (a preference, a name, how they like things) in the assistant\'s memory (CLAUDE.md of the assistant folder). Only things the user would want remembered.',
    inputSchema: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] },
  },
  { name: 'say', description: 'Show a short line in the Openmon pet\'s bubble (and read it aloud if the user turned voice on).', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'notify', description: 'Show a system notification on the user\'s computer.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
  {
    name: 'work_summary',
    description: 'What the user\'s coding agents did lately, from the Openmon journal: per day, the projects, kinds of work, time and tokens. Good for a daily brief or an end-of-day summary.',
    inputSchema: { type: 'object', properties: { days: { type: 'number', description: '1 = today only; up to 14.' } } },
  },
  {
    name: 'next_step',
    description: 'End your answer with a "next step" box when it leaves the user a decision: a short recap, one question, and up to two buttons that answer it (the first is your recommendation). A click sends the message of that button as the next message of the user. Call it last, once per answer, and only when there is a real choice to make.',
    inputSchema: {
      type: 'object',
      properties: {
        recap: { type: 'string', description: 'What is done and where it stands, one or two sentences.' },
        ask: { type: 'string', description: 'The one question, at most 160 characters.' },
        actions: { type: 'array', maxItems: 2, items: { type: 'object', properties: { label: { type: 'string', description: '1 to 3 words.' }, message: { type: 'string', description: 'What a click sends, in the words of the user.' } }, required: ['label'] } },
      },
      required: ['ask'],
    },
  },
];

function callDaemon(name, args) {
  const body = JSON.stringify({ name, args: args || {} });
  return new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port: Number(process.env.OPENMON_PORT) || 4747, path: '/api/assistant/tool', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Openmon-Tool-Key': process.env.OPENMON_TOOL_KEY || '' }, timeout: 10000 },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ ok: false, error: `Openmon answered ${res.statusCode}` });
          }
        });
      },
    );
    req.on('error', () => resolve({ ok: false, error: 'Openmon is not running.' }));
    req.on('timeout', () => req.destroy());
    req.end(body);
  });
}

async function handle(msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  if (msg.method === 'initialize') return reply({ protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'openmon', version: '1.0.0' } });
  if (msg.method === 'ping') return reply({});
  if (msg.method === 'tools/list') return reply({ tools: TOOLS });
  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    if (!TOOLS.some((t) => t.name === name)) return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown tool: ${name}` } };
    const r = await callDaemon(name, args);
    const text = r.ok ? r.text || 'Done.' : `Could not do it: ${r.error || 'unknown error'}`;
    return reply({ content: [{ type: 'text', text }], isError: !r.ok });
  }
  if (msg.id === undefined) return null; // a notification
  return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Unknown method: ${msg.method}` } };
}

function serve(input = process.stdin, output = process.stdout) {
  let buf = '';
  input.setEncoding('utf8');
  input.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      handle(msg).then((out) => out && output.write(`${JSON.stringify(out)}\n`));
    }
  });
  input.on('end', () => process.exit(0));
}

if (require.main === module) serve();

module.exports = { TOOLS, handle };
