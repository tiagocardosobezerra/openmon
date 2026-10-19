#!/usr/bin/env node
'use strict';

// Agent hook entry point. Forwards the payload to the local Openmon
// daemon and gets out of the way: it never prints (stdout of some Claude
// Code hooks is added to the agent's context), never blocks and always
// exits 0, even when the daemon is not running.
//
//   Claude Code: payload on stdin.
//   Codex CLI:   `notify` passes the payload as the last argument (--codex).

const http = require('node:http');

const port = Number(process.env.OPENMON_PORT) || 4747;
const done = () => process.exit(0);
let deadline = setTimeout(done, 1500);
deadline.unref();

function post(path, payload, onReply) {
  const body = Buffer.from(JSON.stringify(payload));
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      timeout: 1000,
    },
    (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => onReply(res.statusCode, Buffer.concat(chunks).toString('utf8')));
    },
  );
  req.on('error', done);
  req.on('timeout', () => req.destroy());
  req.end(body);
}

function send(raw, extra) {
  let payload;
  try {
    payload = { ...JSON.parse(raw), ...extra };
  } catch {
    return done();
  }
  post('/event', payload, (status, text) => {
    let reply = {};
    try {
      if (status === 200) reply = JSON.parse(text);
    } catch {}
    if (!reply.findWindow) return done();
    // Once per session: find the window this agent runs in, while our parent
    // processes are still alive, so a click on the pet can bring it forward.
    // The hook runs async, so this never slows the agent down.
    clearTimeout(deadline);
    deadline = setTimeout(done, 4500);
    deadline.unref();
    const { drivers } = require('./focus');
    const driver = drivers[process.platform];
    if (!driver) return done();
    driver
      .find(process.ppid)
      .then((window) => (window ? post('/api/window', { session_id: payload.session_id, window }, done) : done()))
      .catch(done);
  });
}

// Process start time, not "now": hooks for back-to-back events start in
// parallel, and start time keeps their order better than Node's startup.
// The parent process id lets the pet find the agent's window (terminal,
// editor, app) and bring it to the front when the agent needs you.
const extra = { _ts: Math.round(performance.timeOrigin), _ppid: process.ppid };
if (process.env.CLAUDE_PROJECT_DIR) extra._projectDir = process.env.CLAUDE_PROJECT_DIR;

if (process.argv.includes('--codex')) {
  send(process.argv[process.argv.length - 1], { ...extra, _agent: 'codex' });
} else {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('error', done);
  process.stdin.on('end', () => send(Buffer.concat(chunks).toString('utf8'), extra));
}
