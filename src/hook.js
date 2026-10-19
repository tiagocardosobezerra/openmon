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
setTimeout(done, 1500).unref();

function send(raw, extra) {
  let body;
  try {
    body = Buffer.from(JSON.stringify({ ...JSON.parse(raw), ...extra }));
  } catch {
    return done();
  }
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      path: '/event',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      timeout: 1000,
    },
    (res) => {
      res.resume();
      res.on('end', done);
    },
  );
  req.on('error', done);
  req.on('timeout', () => req.destroy());
  req.end(body);
}

// Process start time, not "now": hooks for back-to-back events start in
// parallel, and start time keeps their order better than Node's startup.
const extra = { _ts: Math.round(performance.timeOrigin) };
if (process.env.CLAUDE_PROJECT_DIR) extra._projectDir = process.env.CLAUDE_PROJECT_DIR;

if (process.argv.includes('--codex')) {
  send(process.argv[process.argv.length - 1], { ...extra, _agent: 'codex' });
} else {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('error', done);
  process.stdin.on('end', () => send(Buffer.concat(chunks).toString('utf8'), extra));
}
