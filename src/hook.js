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
// Claude Code asks you as usual. The question hook (--question) does the
// same for the agent's questions (AskUserQuestion).
//
// Background hooks installed with --rewake (Claude Code's asyncRewake) can
// also hand the agent a message you wrote on the pet: they print it on
// stderr and exit with code 2, which wakes Claude Code with it. Only then
// does a hook exit with anything but 0.

const http = require('node:http');

const port = Number(process.env.OPENMON_PORT) || 4747;
const permissionMode = process.argv.includes('--permission');
const questionMode = process.argv.includes('--question');
const rewake = process.argv.includes('--rewake');
// Gemini CLI and Cursor wait for their hooks and read stdout as JSON: answer
// fast, print an empty object (never a decision), skip the window lookup.
const syncAgent = process.argv.includes('--gemini') ? 'gemini' : process.argv.includes('--cursor') ? 'cursor' : null;
let finished = false;
let event = null;
// A message from the pet: on stderr, exit code 2 (asyncRewake).
const deliver = (text) => {
  if (finished) return;
  finished = true;
  process.stderr.write(`Message from the user, sent from the Openmon desktop pet. Treat it as the user's next message:

${text}`, () => process.exit(2));
};
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
      ask.reply = parse(status, text);
      const { decision, updatedPermissions } = ask.reply;
      if (decision === 'allow' || decision === 'deny') {
        const out = { behavior: decision };
        if (decision === 'deny') out.message = typeof ask.reply.message === 'string' && ask.reply.message ? `Denied from the Openmon pet: ${ask.reply.message}` : 'Denied from the Openmon pet.';
        if (decision === 'deny' && ask.reply.interrupt === true) out.interrupt = true;
        // "Always allow": Claude Code's own suggested rule, applied.
        if (decision === 'allow' && Array.isArray(updatedPermissions) && updatedPermissions.length) out.updatedPermissions = updatedPermissions;
        // Exit only once the decision is fully written.
        return process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: out } }), () => resolve());
      }
      resolve();
    }, ask.waitMs + 1000);
  });
}

// Waits for your answer to the agent's question on the pet. Prints Claude
// Code's PreToolUse answer only when you picked or wrote one.
function awaitAnswer(ask, input) {
  return new Promise((resolve) => {
    post('/api/question/wait', { id: ask.id }, (status, text) => {
      const { answers } = parse(status, text);
      if (!answers || typeof answers !== 'object' || !Object.keys(answers).length) return resolve();
      const out = { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...input, answers } };
      process.stdout.write(JSON.stringify({ hookSpecificOutput: out }), () => resolve());
    }, ask.waitMs + 1000);
  });
}

function question(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return done();
  }
  post('/api/question/ask', payload, async (status, text) => {
    const ask = parse(status, text);
    if (ask.id) {
      extendDeadline(Math.max(4500, ask.waitMs + 3000));
      await awaitAnswer(ask, payload.tool_input || {});
    }
    done();
  });
}

// An idle session: wait in the background for a message from the pet.
function listen(sessionId, waitMs) {
  extendDeadline(waitMs + 2000);
  post('/api/inbox/wait', { session: sessionId }, (status, text) => {
    const { text: message } = parse(status, text);
    if (typeof message === 'string' && message) deliver(message);
    else done();
  }, waitMs + 1000);
}

function send(raw, extra) {
  let payload;
  try {
    payload = { ...JSON.parse(raw), ...extra };
  } catch {
    return done();
  }
  if (permissionMode) payload._permission = true;
  if (rewake) payload._rewake = true;
  event = payload.hook_event_name || null;
  if (syncAgent) {
    payload._agent = syncAgent;
    if (!payload.cwd && process.env.GEMINI_CWD) payload.cwd = process.env.GEMINI_CWD;
  }
  post('/event', payload, async (status, text) => {
    const reply = parse(status, text);
    // A message from the pet for this session, waiting to be delivered.
    if (rewake && typeof reply.deliver === 'string' && reply.deliver) return deliver(reply.deliver);
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
    if (rewake && reply.listen && reply.listen.waitMs > 0 && !finished) return listen(payload.session_id, reply.listen.waitMs);
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
} else if (questionMode) {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('error', done);
  process.stdin.on('end', () => question(Buffer.concat(chunks).toString('utf8')));
} else {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('error', done);
  process.stdin.on('end', () => send(Buffer.concat(chunks).toString('utf8'), extra));
}
