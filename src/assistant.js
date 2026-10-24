'use strict';

// The assistant: conversations with Claude that live in Openmon, without
// Claude's own window. Each one runs your own Claude Code (`claude -p`, with
// your login, settings, MCP servers and CLAUDE.md) in a folder you pick,
// talking JSON on its standard input and output:
//
//   - your messages go in as they are written, and answers stream back;
//   - before a tool needs your OK, Claude Code asks Openmon (can_use_tool),
//     and the answer comes from you: the pet, the notification or the chat;
//   - a conversation that went quiet for a while is closed, and comes back
//     with --resume when you write again.
//
// Openmon keeps its own copy of what was said (chats/<id>.json), so the chat
// opens at once; Claude Code keeps the real conversation, as always.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn: spawnProcess } = require('node:child_process');
const { toolLine, QUIET_TOOLS } = require('./transcript');

const IDLE_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 500;
const MAX_CHATS = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Models you can pick per conversation (aliases Claude Code knows).
const MODELS = ['haiku', 'sonnet', 'opus'];
const SAFE_PATH = /^[^"\0\r\n%!^&|<>]+$/;

function claudeArgs({ sessionId, resume = false, model = null, systemFile = null, mcpConfig = null, allowedTools = [] }) {
  if (!UUID.test(String(sessionId))) throw new Error('bad session id');
  const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio'];
  args.push(resume ? '--resume' : '--session-id', sessionId);
  if (model && MODELS.includes(model)) args.push('--model', model);
  // Files Openmon wrote itself (who the assistant is; its tools).
  if (systemFile && SAFE_PATH.test(systemFile)) args.push('--append-system-prompt-file', systemFile);
  if (mcpConfig && SAFE_PATH.test(mcpConfig)) args.push('--mcp-config', mcpConfig);
  const allowed = allowedTools.filter((t) => /^[A-Za-z_][\w-]*$/.test(t));
  if (allowed.length) args.push('--allowedTools', allowed.join(','));
  return args;
}

// Your own Claude Code. On Windows `claude` is a .cmd launcher, which only a
// shell can start; every argument is a fixed flag, a UUID, a model alias, a
// tool name or a path Openmon chose (quoted, never with shell characters).
function defaultSpawn(args, cwd, env) {
  if (process.platform !== 'win32') return spawnProcess('claude', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  // One command line for the shell, every argument already quoted.
  const line = ['claude', ...args.map((a) => (/[\s()]/.test(a) ? `"${a}"` : a))].join(' ');
  return spawnProcess(line, { cwd, env, shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

// The whole process tree: on Windows the shell's child (Claude Code) too.
function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32' && child.pid) require('node:child_process').spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
    else child.kill();
  } catch {}
}

// Claude Code says so when it is not signed in.
const LOGIN = /not logged in|please run \/login|invalid api key|authenticat|\/login/i;
// An answer that is really the API failing: "API Error: 529 Overloaded…".
// 529 / 503: Claude is busy; 429: a usage limit; anything else, an API error.
function apiError(text) {
  const m = /^API Error:\s*(\d{3})/.exec(String(text || '').trim());
  if (!m) return null;
  const status = Number(m[1]);
  return status === 529 || status === 503 ? 'busy' : status === 429 ? 'limit' : 'api';
}

// A conversation's name from its first message: the first sentence, cut at
// a word, short enough for the list.
function shortTitle(text, max = 48) {
  const first = String(text || '').split('\n').find((l) => l.trim()) || '';
  const sentence = first.split(/(?<=[.!?:;])\s/)[0].trim();
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.5 ? cut.lastIndexOf(' ') : max).replace(/[\s,;:.-]+$/, '')}…`;
}

function createAssistant({ dir, now = Date.now, spawn = defaultSpawn, log = () => {}, onChange = () => {}, askPermission = async () => ({ behavior: 'deny', message: 'No one to ask.' }), askQuestion = async () => null, onDone = () => {}, prepare = () => ({}), idleMs = IDLE_MS } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const indexFile = path.join(dir, 'chats.json');
  const chats = new Map(); // id -> chat (without messages)
  const messagesOf = new Map(); // id -> messages, loaded on demand
  const procs = new Map(); // id -> running process state

  try {
    for (const c of JSON.parse(fs.readFileSync(indexFile, 'utf8'))) if (c && c.id && UUID.test(c.sessionId)) chats.set(c.id, { ...c, status: 'idle' });
  } catch {}

  let saveTimer = null;
  const dirty = new Set();
  function save(id) {
    if (id) dirty.add(id);
    if (saveTimer) return;
    saveTimer = setTimeout(flush, 400);
    if (saveTimer.unref) saveTimer.unref();
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const list = [...chats.values()].filter((c) => !c.spare).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
    try {
      fs.writeFileSync(indexFile, JSON.stringify(list.map(({ status, ...c }) => c), null, 1));
      for (const id of dirty) if (messagesOf.has(id)) fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(messagesOf.get(id)));
    } catch (err) {
      log(`assistant: could not save (${err.message})`);
    }
    dirty.clear();
  }

  function messages(id) {
    if (!messagesOf.has(id)) {
      let list = [];
      try {
        list = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
      } catch {}
      messagesOf.set(id, Array.isArray(list) ? list : []);
    }
    return messagesOf.get(id);
  }

  function view(c) {
    const p = procs.get(c.id);
    return { id: c.id, sessionId: c.sessionId, cwd: c.cwd, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt, costUsd: c.costUsd || 0, plan: Boolean(c.plan), model: c.model || null, pinned: Boolean(c.pinned), status: c.status, draft: (p && p.draft) || '', activity: (p && c.status !== 'idle' && p.activity) || null };
  }

  function add(id, message) {
    const list = messages(id);
    list.push({ ...message, at: message.at || now() });
    if (list.length > MAX_MESSAGES) list.splice(0, list.length - MAX_MESSAGES);
    const c = chats.get(id);
    if (c) c.updatedAt = now();
    save(id);
    onChange(id, { op: 'message', message: list[list.length - 1] });
  }

  function setStatus(id, status) {
    const c = chats.get(id);
    if (!c || c.status === status) return;
    c.status = status;
    onChange(id, { op: 'status', status, costUsd: c.costUsd || 0 });
  }

  // What the conversation is doing right now, for the chat and the quick box:
  // { kind: 'waking' | 'thinking' | 'tool', text }.
  function activity(id, p, kind, text = '') {
    p.activity = { kind, text };
    onChange(id, { op: 'activity', activity: p.activity });
  }

  function write(p, obj) {
    if (p.child.stdin.writable) p.child.stdin.write(`${JSON.stringify(obj)}\n`);
  }

  function armIdle(id) {
    const p = procs.get(id);
    if (!p) return;
    clearTimeout(p.idle);
    p.idle = setTimeout(() => close(id), idleMs);
    if (p.idle.unref) p.idle.unref();
  }

  // Starts (or resumes) Claude Code for this conversation.
  function start(id) {
    const c = chats.get(id);
    let extra = {};
    try {
      extra = prepare(view(c)) || {};
    } catch (err) {
      log(`assistant: could not prepare (${err.message})`);
    }
    const args = claudeArgs({ sessionId: c.sessionId, resume: Boolean(c.started), model: c.model, ...extra });
    let child;
    try {
      child = spawn(args, c.cwd, { ...process.env, OPENMON_ASSISTANT: '1' });
    } catch (err) {
      add(id, { role: 'error', code: 'missing', text: err.message });
      return null;
    }
    const p = { child, buf: '', draft: '', lastCost: 0, err: '', gotResult: false, pending: new Set(), ready: false, activity: { kind: 'waking', text: '' } };
    procs.set(id, p);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      p.buf += d;
      const lines = p.buf.split('\n');
      p.buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        handle(id, p, event);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (d) => (p.err = (p.err + d).slice(-2000)));
    child.on('error', (err) => {
      add(id, { role: 'error', code: err.code === 'ENOENT' ? 'missing' : 'exit', text: err.message });
    });
    child.on('exit', (code) => {
      clearTimeout(p.idle);
      procs.delete(id);
      // A spare that was never used goes with its process.
      if (c.spare) {
        chats.delete(id);
        if (spare === id) spare = null;
        return;
      }
      for (const settle of p.pending) settle();
      if (code && !p.closing) add(id, { role: 'error', code: /not recognized|not found|ENOENT/i.test(p.err) ? 'missing' : LOGIN.test(p.err) ? 'login' : 'exit', text: p.err.trim().split('\n').slice(-3).join('\n') || `exit ${code}` });
      if (p.draft) add(id, { role: 'assistant', text: p.draft });
      setStatus(id, 'idle');
    });
    // The handshake that makes Claude Code ask us before a tool runs.
    write(p, { type: 'control_request', request_id: `init-${id}`, request: { subtype: 'initialize' } });
    return p;
  }

  function handle(id, p, event) {
    const c = chats.get(id);
    if (!c) return;
    // Claude Code is up (its answer to the handshake, or its first word).
    if (!p.ready && (event.type === 'control_response' || (event.type === 'system' && event.subtype === 'init'))) {
      p.ready = true;
      if (c.status === 'working') activity(id, p, 'thinking');
    }
    if (event.type === 'stream_event' && event.event) {
      const e = event.event;
      if (e.type === 'message_start') {
        p.draft = '';
        activity(id, p, 'thinking');
      }
      if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta' && e.delta.text) {
        p.draft += e.delta.text;
        onChange(id, { op: 'delta', text: e.delta.text });
      }
      return;
    }
    if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
      for (const b of event.message.content) {
        if (b.type === 'text' && b.text && b.text.trim()) {
          p.draft = '';
          const failed = apiError(b.text);
          if (failed) add(id, { role: 'error', code: failed, text: b.text.trim().slice(0, 500) });
          else add(id, { role: 'assistant', text: b.text.trim() });
        } else if (b.type === 'tool_use' && !QUIET_TOOLS.has(b.name)) {
          const line = toolLine(b.name, b.input);
          add(id, { role: 'tool', text: line, tool: b.name });
          activity(id, p, 'tool', line);
        }
      }
      return;
    }
    if (event.type === 'control_request' && event.request) return control(id, p, event);
    // Only a Claude plan (Pro, Max, Team) reports its usage limits: then
    // there is no bill per token, and the cost is not shown as one.
    if (event.type === 'rate_limit_event' && !c.plan) {
      c.plan = true;
      save(id);
    }
    if (event.type === 'result') {
      const total = Number(event.total_cost_usd) || 0;
      if (total > p.lastCost) c.costUsd = (c.costUsd || 0) + (total - p.lastCost);
      p.lastCost = Math.max(p.lastCost, total);
      if (event.is_error && event.result) add(id, { role: 'error', code: LOGIN.test(String(event.result)) ? 'login' : 'turn', text: String(event.result).slice(0, 2000) });
      p.draft = '';
      save(id);
      c.status = 'idle';
      onChange(id, { op: 'status', status: 'idle', costUsd: c.costUsd || 0 });
      // The answer of this turn (none if the turn ended in an error).
      const list = messages(id);
      const lastUser = list.map((m) => m.role).lastIndexOf('user');
      const turn = list.slice(lastUser + 1);
      const last = [...turn].reverse().find((m) => m.role === 'assistant');
      const failed = [...turn].reverse().find((m) => m.role === 'error');
      onDone(view(c), last && !(failed && turn.indexOf(failed) > turn.indexOf(last)) ? last.text : '', failed ? failed.code : null);
      armIdle(id);
    }
  }

  // Claude Code asks before a tool runs (or with a question for you).
  function control(id, p, event) {
    const req = event.request;
    const reply = (response) => write(p, { type: 'control_response', response: { subtype: 'success', request_id: event.request_id, response } });
    if (req.subtype !== 'can_use_tool') {
      write(p, { type: 'control_response', response: { subtype: 'error', request_id: event.request_id, error: `Unsupported: ${req.subtype}` } });
      return;
    }
    const c = chats.get(id);
    const input = req.input && typeof req.input === 'object' ? req.input : {};
    let done = false;
    const settle = (response = { behavior: 'deny', message: 'The conversation was closed.' }) => {
      if (done) return;
      done = true;
      p.pending.delete(settle);
      reply(response);
      if (c.status === 'waiting') setStatus(id, 'working');
    };
    p.pending.add(settle);
    setStatus(id, 'waiting');
    if (req.tool_name === 'AskUserQuestion') {
      askQuestion(view(c), { input }).then((answers) => settle(answers ? { behavior: 'allow', updatedInput: { ...input, answers } } : { behavior: 'deny', message: 'The user did not answer.' }), () => settle());
      return;
    }
    askPermission(view(c), { tool: req.tool_name, input, suggestions: Array.isArray(req.permission_suggestions) && req.permission_suggestions.length ? req.permission_suggestions : null }).then((d) => {
      if (d && d.decision === 'allow') settle({ behavior: 'allow', updatedInput: input });
      else if (d && d.decision === 'always') settle({ behavior: 'allow', updatedInput: input, updatedPermissions: req.permission_suggestions || [] });
      else settle({ behavior: 'deny', message: (d && d.message) || 'Denied in Openmon.', ...(d && d.interrupt ? { interrupt: true } : {}) });
    }, () => settle());
  }

  function userContent(text, images) {
    const content = [];
    if (text) content.push({ type: 'text', text });
    for (const img of images || []) if (img && IMAGE_TYPES.has(img.type) && typeof img.data === 'string') content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } });
    return content;
  }

  function send(id, { text = '', images = [] } = {}) {
    const c = chats.get(id);
    if (!c) return { ok: false, reason: 'unknown' };
    const content = userContent(String(text).trim(), images);
    if (!content.length) return { ok: false, reason: 'empty' };
    let p = procs.get(id);
    if (!p) p = start(id);
    if (!p) return { ok: false, reason: 'missing' };
    clearTimeout(p.idle);
    if (!c.started) {
      c.started = true;
      save(id);
    }
    add(id, { role: 'user', text: String(text).trim(), images: content.filter((b) => b.type === 'image').length });
    write(p, { type: 'user', message: { role: 'user', content } });
    setStatus(id, 'working');
    activity(id, p, p.ready ? 'thinking' : 'waking');
    return { ok: true };
  }

  function create({ cwd, text = '', images = [], title = null, sessionId = null, resume = false, model = null, seed = [] } = {}) {
    let stat;
    try {
      stat = fs.statSync(String(cwd));
    } catch {}
    if (!stat || !stat.isDirectory()) return { ok: false, reason: 'folder' };
    if (sessionId && !UUID.test(sessionId)) return { ok: false, reason: 'session' };
    const first = String(text).trim();
    const folder = path.resolve(String(cwd));
    const name = (title || shortTitle(first) || path.basename(String(cwd))).slice(0, 80);
    // A Claude Code already warmed up for this folder becomes this conversation.
    const warm = !sessionId && !model && spare && chats.get(spare);
    if (warm && warm.cwd === folder) {
      spare = null;
      delete warm.spare;
      Object.assign(warm, { title: name, createdAt: now(), updatedAt: now() });
      messagesOf.set(warm.id, []);
      save(warm.id);
      onChange(warm.id, { op: 'list' });
      if (first || images.length) {
        const r = send(warm.id, { text: first, images });
        if (!r.ok) return { ...r, id: warm.id };
      }
      return { ok: true, id: warm.id };
    }
    const id = crypto.randomBytes(8).toString('hex');
    const c = { id, sessionId: sessionId || crypto.randomUUID(), cwd: folder, title: name, createdAt: now(), updatedAt: now(), costUsd: 0, status: 'idle', started: Boolean(resume), model };
    chats.set(id, c);
    messagesOf.set(id, seed.slice(-MAX_MESSAGES));
    save(id);
    onChange(id, { op: 'list' });
    if (first || images.length) {
      const r = send(id, { text: first, images });
      if (!r.ok) return { ...r, id };
    }
    return { ok: true, id };
  }

  // A conversation about to get a message (the quick box opened): its Claude
  // Code starts now, so the answer does not wait for it to wake up.
  function warm(id) {
    const c = chats.get(id);
    if (!c || procs.has(id)) return false;
    if (!start(id)) return false;
    armIdle(id);
    return true;
  }

  // A spare Claude Code for a new conversation in this folder (the chat
  // window opened on "New conversation"); unused, it goes after a while.
  let spare = null;
  function prewarm(cwd) {
    let stat;
    try {
      stat = fs.statSync(String(cwd));
    } catch {}
    if (!stat || !stat.isDirectory()) return false;
    const folder = path.resolve(String(cwd));
    if (spare && chats.get(spare) && chats.get(spare).cwd === folder) return true;
    if (spare) close(spare);
    const id = crypto.randomBytes(8).toString('hex');
    chats.set(id, { id, sessionId: crypto.randomUUID(), cwd: folder, title: '', createdAt: now(), updatedAt: now(), costUsd: 0, status: 'idle', started: false, model: null, spare: true });
    if (!start(id)) {
      chats.delete(id);
      return false;
    }
    spare = id;
    armIdle(id);
    return true;
  }

  function stop(id) {
    const p = procs.get(id);
    if (!p) return false;
    write(p, { type: 'control_request', request_id: `stop-${now()}`, request: { subtype: 'interrupt' } });
    for (const settle of [...p.pending]) settle({ behavior: 'deny', message: 'Stopped from Openmon.', interrupt: true });
    return true;
  }

  function close(id) {
    const p = procs.get(id);
    if (!p) return;
    p.closing = true;
    for (const settle of [...p.pending]) settle();
    try {
      p.child.stdin.end();
    } catch {}
    const kill = setTimeout(() => {
      try {
        p.child.kill();
      } catch {}
    }, 5000);
    if (kill.unref) kill.unref();
  }

  function remove(id) {
    close(id);
    chats.delete(id);
    messagesOf.delete(id);
    try {
      fs.rmSync(path.join(dir, `${id}.json`), { force: true });
    } catch {}
    save();
    onChange(id, { op: 'list' });
    return true;
  }

  // Model for the next answers: a running conversation restarts with it.
  function setModel(id, model) {
    const c = chats.get(id);
    if (!c || (model !== null && !MODELS.includes(model))) return false;
    c.model = model;
    save(id);
    if (procs.has(id) && c.status === 'idle') close(id);
    onChange(id, { op: 'list' });
    return true;
  }

  function pin(id, on) {
    const c = chats.get(id);
    if (!c) return false;
    c.pinned = Boolean(on);
    save(id);
    onChange(id, { op: 'list' });
    return true;
  }

  // Conversations whose title or text has these words.
  function search(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    if (!words.length) return [];
    const hits = [];
    for (const c of chats.values()) {
      const text = `${c.title}\n${messages(c.id).map((m) => m.text).join('\n')}`.toLowerCase();
      if (words.every((w) => text.includes(w))) hits.push(c.id);
    }
    return hits;
  }

  // One conversation as Markdown, to keep or share.
  function markdown(id) {
    const c = chats.get(id);
    if (!c) return null;
    const who = { user: '**You**', assistant: '**Claude**' };
    const lines = [`# ${c.title}`, '', `${c.cwd} · ${new Date(c.createdAt).toISOString().slice(0, 16).replace('T', ' ')}`, ''];
    for (const m of messages(id)) {
      if (m.role === 'tool') lines.push(`> ${m.text}`, '');
      else if (who[m.role]) lines.push(`${who[m.role]}:`, '', m.text, '');
    }
    return lines.join('\n');
  }

  function rename(id, title) {
    const c = chats.get(id);
    const t = String(title || '').trim().slice(0, 80);
    if (!c || !t) return false;
    c.title = t;
    save(id);
    onChange(id, { op: 'list' });
    return true;
  }

  return {
    list: () => [...chats.values()].filter((c) => !c.spare).sort((a, b) => Boolean(b.pinned) - Boolean(a.pinned) || b.updatedAt - a.updatedAt).map(view),
    get: (id) => (chats.has(id) && !chats.get(id).spare ? { ...view(chats.get(id)), messages: messages(id) } : null),
    // Is this Claude Code session one of ours (its hooks then stay out of the way)?
    owns: (sessionId) => [...chats.values()].find((c) => c.sessionId === sessionId && procs.has(c.id)) || null,
    bySession: (sessionId) => [...chats.values()].find((c) => c.sessionId === sessionId && !c.spare) || null,
    running: () => procs.size,
    create,
    send,
    warm,
    prewarm,
    stop,
    remove,
    rename,
    setModel,
    pin,
    search,
    markdown,
    closeAll() {
      for (const id of [...procs.keys()]) close(id);
      flush();
    },
    // Openmon is going away: no Claude Code is left behind, even mid-answer.
    killAll() {
      for (const p of procs.values()) {
        p.closing = true;
        killTree(p.child);
      }
      flush();
    },
    flush,
  };
}

module.exports = { createAssistant, claudeArgs, MODELS, shortTitle };
