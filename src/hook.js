#!/usr/bin/env node
'use strict';

// Agent hook entry point. Forwards the payload to the local Openmon
// daemon and gets out of the way: it never blocks the agent and always
// exits 0, even when the daemon is not running.
//
//   Claude Code: payload on stdin.
//   Codex CLI:   `notify` passes the payload as the last argument (--codex).
//
// Every hook runs in the background and prints nothing, except one: the
// permission hook (--permission) runs in the foreground so that, when you
// turned on "Answer permissions from the pet", it can wait a few seconds
// for your Allow or Deny on the pet and hand that decision to Claude Code.
// With the setting off, or with no answer in time, it prints nothing and
// Claude Code asks you as usual.

const http = require('node:http');

const port = Number(process.env.OPENMON_PORT) || 4747;
const permissionMode = process.argv.includes('--permission');
// Gemini CLI and Cursor wait for their hooks and read stdout as JSON: answer
// fast, print an empty object (never a decision), skip the window lookup.
const syncAgent = process.argv.includes('--gemini') ? 'gemini' : process.argv.includes('--cursor') ? 'cursor' : null;
let finished = false;
let event = null;
const done = () => {
  if (finished) return;
  finished = true;
  if (syncAgent) {
    const { reply } = require('./adapters');
    return process.stdout.write(reply(syncAgent, event), () => process.exit(0));
  }
  process.exit(0);
};
let deadline = setTimeout(done, 1500);
deadline.unref();

function extendDeadline(ms) {
  clearTimeout(deadline);
  deadline = setTimeout(done, ms);
  deadline.unref();
}

function post(path, payload, onReply, timeout = 1000) {
  const body = Buffer.from(JSON.stringify(payload));
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      timeout,
    },
    (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => onReply(res.statusCode, Buffer.concat(chunks).toString('utf8')));
    },
  );
  req.on('error', () => onReply(0, ''));
  req.on('timeout', () => req.destroy());
  req.end(body);
}

const parse = (status, text) => {
  try {
    return status === 200 ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};

// Once per session: find the window this agent runs in, while our parent
// processes are still alive, so a click on the pet can bring it forward.
function findWindow(sessionId) {
  const { drivers } = require('./focus');
  const driver = drivers[process.platform];
  if (!driver) return Promise.resolve();
  return driver
    .find(process.ppid)
    .then((window) => window && new Promise((resolve) => post('/api/window', { session_id: sessionId, window }, resolve)))
    .catch(() => {});
}

// Waits for your answer on the pet. Prints Claude Code's decision object
// only for an explicit Allow or Deny.
function awaitDecision(ask) {
  return new Promise((resolve) => {
    post('/api/permission/wait', { id: ask.id }, (status, text) => {
      const { decision, updatedPermissions } = parse(status, text);
      if (decision === 'allow' || decision === 'deny') {
        const out = { behavior: decision };
        if (decision === 'deny') out.message = 'Denied from the Openmon pet.';
        // "Always allow": Claude Code's own suggested rule, applied.
        if (decision === 'allow' && Array.isArray(updatedPermissions) && updatedPermissions.length) out.updatedPermissions = updatedPermissions;
        // Exit only once the decision is fully written.
        return process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: out } }), () => resolve());
      }
      resolve();
    }, ask.waitMs + 1000);
  });
}

function send(raw, extra) {
  let payload;
  try {
    payload = { ...JSON.parse(raw), ...extra };
  } catch {
    return done();
  }
  if (permissionMode) payload._permission = true;
  event = payload.hook_event_name || null;
  if (syncAgent) {
    payload._agent = syncAgent;
    if (!payload.cwd && process.env.GEMINI_CWD) payload.cwd = process.env.GEMINI_CWD;
  }
  post('/event', payload, async (status, text) => {
    const reply = parse(status, text);
    const work = [];
    if (reply.findWindow && !syncAgent) {
      extendDeadline(4500);
      work.push(findWindow(payload.session_id));
    }
    if (permissionMode && reply.askPermission && reply.askPermission.id) {
      extendDeadline(Math.max(4500, reply.askPermission.waitMs + 3000));
      work.push(awaitDecision(reply.askPermission));
    }
    await Promise.all(work);
    if (!finished) done();
  });
}

// Process start time, not "now": hooks for back-to-back events start in
// parallel, and start time keeps their order better than Node's startup.
// The parent process id lets the pet find the agent's window (terminal,
// editor, app) and bring it to the front when the agent needs you.
const extra = { _ts: Math.round(performance.timeOrigin), _ppid: process.ppid };
if (process.env.CLAUDE_PROJECT_DIR) extra._projectDir = process.env.CLAUDE_PROJECT_DIR;
else if (process.env.GEMINI_PROJECT_DIR) extra._projectDir = process.env.GEMINI_PROJECT_DIR;
else if (process.env.CURSOR_PROJECT_DIR) extra._projectDir = process.env.CURSOR_PROJECT_DIR;

if (process.argv.includes('--codex')) {
  send(process.argv[process.argv.length - 1], { ...extra, _agent: 'codex' });
} else if (process.argv.includes('--aider')) {
  // Aider's --notifications-command: no payload, just "waiting for you".
  send(JSON.stringify({ cwd: process.cwd() }), { ...extra, _agent: 'aider' });
} else {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('error', done);
  process.stdin.on('end', () => send(Buffer.concat(chunks).toString('utf8'), extra));
}
