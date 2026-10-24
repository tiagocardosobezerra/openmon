'use strict';

// The daemon. Agent hooks POST raw payloads to /event; renderers subscribe
// to /stream (Server-Sent Events). Bound to 127.0.0.1, and requests from
// other web pages are refused, so a random site cannot feed the pet.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { classify } = require('./classify');
const { createSessions } = require('./sessions');
const pet = require('./pet');
const species = require('./species');
const { createStore, homeDir } = require('./store');
const { demoScript, DEMO_START_XP } = require('./demo');
const installer = require('./install');
const { localizeSpecies } = require('./i18n');
const { createPlayground } = require('./playground');
const { createFocus } = require('./focus');
const party = require('./party');
const wild = require('./wild');
const { createUsage } = require('./usage');
const adapters = require('./adapters');
const { createBackups, unwrap } = require('./backup');
const { createPowers, unlockedPowers } = require('./powers');
const { redact } = require('./redact');
const { createAssistant } = require('./assistant');
const { readTranscript } = require('./transcript');
const { createSchedule } = require('./schedule');

// ntfy.sh topics: letters, digits, _ and -, long enough to be private.
const PHONE_TOPIC = /^[A-Za-z0-9_-]{8,64}$/;
const DEFAULT_PORT = Number(process.env.OPENMON_PORT) || 4747;
const MAX_BODY = 2 * 1024 * 1024;
// A chat message can carry pictures (a screenshot, pasted images).
const MAX_CHAT_BODY = 16 * 1024 * 1024;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function createWorld(petState) {
  return { pet: petState, sessions: createSessions() };
}

// Art packs: images named after forms (craft-adult.png, egg@sleep.svg…)
// in this folder replace the procedural art. See docs/ART-PACKS.md.
const ART_FILE = /^[a-z0-9-]+(\.[a-z]+(-[a-z]+)?)*(@[a-z]+)?\.(png|svg|webp)$/;

// The official art ships with Openmon; a user's own pack overrides it file
// by file. OPENMON_CLASSIC=1 goes back to the art drawn in code.
const BUNDLED_ART = path.join(__dirname, '..', 'art', 'official');
const BRAND_DIR = path.join(__dirname, '..', 'assets', 'brand');
const BRAND_FILE = /^[a-z0-9@-]+\.(svg|png|ico)$/i;

function readPack(dir) {
  try {
    const files = fs.readdirSync(dir).filter((f) => ART_FILE.test(f));
    let pack = null;
    try {
      pack = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'));
    } catch {}
    // Colour changes for poses drawn only in normal colours (tools/build-tints.js).
    let tints = null;
    try {
      tints = JSON.parse(fs.readFileSync(path.join(dir, 'tints.json'), 'utf8'));
    } catch {}
    return { files, pack, tints };
  } catch {
    return { files: [], pack: null, tints: null };
  }
}

// Returns { files, pack, where: name -> folder }, user folder first.
function listArt(dirs) {
  const where = {};
  let pack = null;
  // Per form: a user pack's tints win over the official ones.
  const tints = { forms: {} };
  for (const dir of [...dirs].reverse()) {
    const p = readPack(dir);
    if (p.tints) Object.assign(tints.forms, p.tints.forms || {});
  }
  for (const dir of dirs) {
    const p = readPack(dir);
    for (const f of p.files) if (!where[f]) where[f] = dir;
    if (!pack && p.files.length) pack = p.pack;
  }
  return { files: Object.keys(where).sort(), pack, tints, where };
}

// Hooks from before questions and messages on the pet are brought up to
// date (only Openmon's own entries change; the installer keeps a backup).
function defaultUpgradeHooks() {
  try {
    if (installer.isInstalled() && (!installer.hasPermissionHook() || !installer.hasContactHooks())) installer.install();
  } catch {}
}

// What the agent asks, as the pet shows it: 1 to 4 questions, each with
// its options. Anything else is not a question the pet can answer.
function questionsOf(input) {
  const list = input && Array.isArray(input.questions) ? input.questions : null;
  if (!list || !list.length || list.length > 4) return null;
  const out = [];
  for (const q of list) {
    if (!q || typeof q.question !== 'string' || !q.question || !Array.isArray(q.options)) return null;
    const options = q.options.filter((o) => o && typeof o.label === 'string' && o.label).slice(0, 8).map((o) => ({ label: o.label, description: typeof o.description === 'string' ? o.description : '' }));
    out.push({ question: q.question, header: typeof q.header === 'string' ? q.header : '', multiSelect: q.multiSelect === true, options });
  }
  return out;
}

const MAX_MESSAGE = 4000;

// The assistant's memory (CLAUDE.md in its folder), the first time.
const MEMORY_TEMPLATE = {
  pt: '# Assistente pessoal (Openmon)\n\nVocê é meu assistente pessoal. Eu falo com você pelo Openmon, um pet na tela do meu computador.\n\n- Responda em português do Brasil, curto e direto.\n- Quando for uma tarefa, faça; quando faltar algo, pergunte uma coisa só.\n\n## Sobre mim\n\n- (escreva aqui o que o assistente deve saber: seu nome, trabalho, preferências)\n',
  es: '# Asistente personal (Openmon)\n\nEres mi asistente personal. Hablo contigo desde Openmon, una mascota en la pantalla de mi computadora.\n\n- Responde en español, corto y directo.\n- Si es una tarea, hazla; si falta algo, pregunta una sola cosa.\n\n## Sobre mí\n\n- (escribe aquí lo que el asistente debe saber: tu nombre, trabajo, preferencias)\n',
  en: '# Personal assistant (Openmon)\n\nYou are my personal assistant. I talk to you from Openmon, a pet on my computer screen.\n\n- Answer short and to the point.\n- When it is a task, do it; when something is missing, ask one thing.\n\n## About me\n\n- (write here what the assistant should know: your name, work, preferences)\n',
};

function createDaemon({ port = DEFAULT_PORT, store = createStore(), now = Date.now, log = () => {}, hooksInstalled = () => installer.isInstalled(), artDir = path.join(homeDir(), 'art'), bundledArt = process.env.OPENMON_CLASSIC === '1' ? null : BUNDLED_ART, playground = false, configFile = playground ? null : path.join(homeDir(), 'config.json'), focus = createFocus(), backups = playground ? null : createBackups({ now }), cloud = null, contactKey = require('node:crypto').randomBytes(24).toString('hex'), upgradeHooks = defaultUpgradeHooks, chatsDir = configFile ? path.join(path.dirname(configFile), 'chats') : path.join(require('node:os').tmpdir(), `openmon-chats-${process.pid}`), spawnClaude = undefined } = {}) {
  const artDirs = [artDir, bundledArt].filter(Boolean);
  const bus = new EventEmitter();
  const powers = createPowers();
  const usage = createUsage();
  const lastEventOf = new Map();
  const clients = new Set();
  // Pet windows that can answer the agent's questions (desktop app).
  const talkers = new Set();
  // A brand-new pet file: if a backup exists, offer to bring that pet back.
  const freshInstall = Boolean(store.file) && !fs.existsSync(store.file);
  const real = createWorld(party.ensure(store.load()));
  let restoreOffer = freshInstall && backups ? backups.latest() : null;
  let world = real;
  // Settings live in ~/.openmon/config.json, so they survive restarts.
  const DEFAULTS = { muted: false, notify: true, chatter: true, stroll: true, focusUntil: null, present: false, breakEvery: 0, phoneAlerts: false, phoneTopic: '', phoneProject: false, phoneAfterSec: 60, quietUntil: null, scale: 1, tips: [], answerFromPet: true, answerWaitSec: 25, wild: true, hideFullscreen: true, updateCheck: true, companions: [], shareSessions: true, follows: {}, quickActions: null, assistantFolder: '', phoneReplies: false, speak: false, quickChat: null };
  let config = { ...DEFAULTS };
  try {
    if (configFile) config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configFile, 'utf8')) };
  } catch {}
  // Season colours are gone; drop the old setting.
  delete config.seasons;
  delete config.seasonsChosen;
  // What the renderers need: the settings plus whether quiet mode is on now.
  const publicConfig = () => ({ ...config, quiet: Boolean(config.quietUntil && config.quietUntil > now()), focus: Boolean(config.focusUntil && config.focusUntil > now()) });
  let demoTimers = [];
  let lastStateJson = '';

  // Whether Claude Code is connected, re-checked at most every 10 s.
  let hooks = { at: 0, ok: false };
  function recheckHooks() {
    hooks = { at: 0, ok: false };
    pushState(true);
  }

  function setup() {
    if (now() - hooks.at > 10_000) hooks = { at: now(), ok: hooksInstalled() };
    return { hooks: hooks.ok };
  }

  // Presentation mode: project names become "Project A, B…" and what the
  // agent does becomes generic, everywhere the daemon sends it.
  function presentable(s) {
    if (!config.present) return s;
    const names = new Map();
    const alias = (label) => {
      if (!label) return label;
      if (!names.has(label)) names.set(label, String.fromCharCode(65 + (names.size % 26)));
      return `${names.size && /^pt/i.test(config.lang || '') ? 'Projeto' : 'Project'} ${names.get(label)}`;
    };
    const live = { ...s.live, sessions: (s.live.sessions || []).map((x) => ({ ...x, label: alias(x.label), detail: null, longTool: x.longTool ? { ...x.longTool, detail: null } : null })) };
    if (live.focus) live.focus = { ...live.focus, label: alias(live.focus.label), detail: null, recap: null };
    const petView = { ...s.pet, project: s.pet.project ? alias(s.pet.project) : s.pet.project, journal: (s.pet.journal || []).map((e) => ({ ...e, projects: {}, agentMs: {} })) };
    const partyView = s.party ? { ...s.party, members: s.party.members.map((m) => ({ ...m, project: m.project && alias(m.project) })), box: s.party.box.map((m) => ({ ...m, project: m.project && alias(m.project) })), upcoming: [] } : s.party;
    const companions = Object.fromEntries(Object.entries(s.companions || {}).map(([id, c]) => [id, { ...c, project: c.project ? alias(c.project) : c.project, journal: [] }]));
    const questions = (s.questions || []).map((q) => ({ ...q, label: alias(q.label) }));
    return { ...s, live, pet: petView, party: partyView, companions, permissions: (s.permissions || []).map((p) => ({ ...p, label: alias(p.label), detail: null })), questions, present: true };
  }

  // The Openmons standing next to the main one: full views, like the main pet.
  const MAX_COMPANIONS = 2;
  function companionViews() {
    const out = {};
    for (const id of config.companions || []) {
      // Only Party members walk on screen; the Box stays home.
      const member = (real.pet.others || []).find((m) => m.id === id && m.place === 'party');
      if (member) out[id] = { ...pet.view(party.merge(real.pet, member)), project: member.project ?? null, sessions: sessionsOf(id) };
    }
    return out;
  }

  // With pets on screen next to the main one, each agent session that has no
  // pet of its own goes to the one with the fewest sessions and stays with
  // it: that pet earns its XP and shows it on its card.
  const SESSION_IDLE_MS = 30 * 60 * 1000;
  const sessionPet = new Map();
  function onScreenIds() {
    const party = (config.companions || []).filter((id) => real.pet.others.some((m) => m.id === id && m.place === 'party'));
    return [real.pet.id, ...party];
  }
  function sessionsOf(id) {
    const t = now();
    return [...sessionPet].filter(([, a]) => a.pet === id && t - a.at < SESSION_IDLE_MS).map(([s]) => s);
  }
  // Which pet follows a session, in this order:
  //   1. a conversation you pinned to a pet (card → Agents);
  //   2. a project you pinned to a pet (Party → "Follows");
  //   3. the project's own pet, while it is in the Party;
  //   4. the queue: with sharing on, new conversations go to the pets on
  //      screen in turn (1st to the main pet, 2nd to the next one, …).
  // With sharing off, everything else stays with the main pet.
  const sessionPins = new Map();
  let queueTurn = 0;
  const inParty = (id) => id === real.pet.id || real.pet.others.some((m) => m.id === id && m.place === 'party');
  function followerOf(project) {
    if (!project) return null;
    const hit = Object.entries(config.follows || {}).find(([id, p]) => p === project && inParty(id));
    return hit ? hit[0] : null;
  }
  function remember(session, id, pinned) {
    sessionPet.delete(session);
    sessionPet.set(session, { pet: id, at: now(), pinned });
    if (sessionPet.size > 200) sessionPet.delete(sessionPet.keys().next().value);
  }
  function petForSession(signal) {
    const ending = signal.kind === 'session-end';
    const pin = sessionPins.get(signal.session);
    const project = party.projectOf(signal);
    let id = pin && inParty(pin) ? pin : followerOf(project);
    let pinned = Boolean(id);
    if (!id && party.petFor(real.pet, project) !== real.pet) return null;
    if (!id) {
      const ids = onScreenIds();
      if (!config.shareSessions || ids.length < 2) id = real.pet.id;
      else {
        const had = sessionPet.get(signal.session);
        id = had && !had.pinned && ids.includes(had.pet) ? had.pet : ids[queueTurn++ % ids.length];
      }
      pinned = false;
    }
    if (ending) {
      sessionPet.delete(signal.session);
      sessionPins.delete(signal.session);
    } else remember(signal.session, id, pinned);
    return id === real.pet.id ? null : id;
  }
  // Pins a conversation to a pet (or back to automatic with pet = null).
  function pinSession(session, id) {
    if (!session) return false;
    if (id && !inParty(id)) return false;
    if (id) {
      sessionPins.set(session, id);
      remember(session, id, true);
    } else {
      sessionPins.delete(session);
      const had = sessionPet.get(session);
      if (had) remember(session, had.pet, false);
    }
    pushState(true);
    return true;
  }
  // Pins a project to a pet (or clears it with project = null).
  function followProjectWith(id, project) {
    if (!id || !inParty(id)) return false;
    const follows = Object.fromEntries(Object.entries(config.follows || {}).filter(([pid, p]) => pid !== id && p !== project));
    if (project) follows[id] = String(project).slice(0, 120);
    setConfig({ follows });
    return true;
  }
  function sessionOwners() {
    const out = {};
    const t = now();
    for (const [sid, a] of sessionPet) if (t - a.at < SESSION_IDLE_MS) out[sid] = { pet: a.pet, pinned: Boolean(a.pinned) };
    return out;
  }

  // Puts a team member on screen as the main pet. A companion swaps places
  // with the main one, so both stay on screen.
  function makeMain(id) {
    return partyAction(() => swapMain(id));
  }
  function swapMain(id) {
    const before = real.pet.id;
    real.pet = party.setActive(real.pet, id);
    if (real.pet.id === before) return false;
    const list = config.companions || [];
    if (list.includes(id)) setConfig({ companions: list.map((x) => (x === id ? before : x)) });
    return true;
  }

  function state() {
    const live = world.sessions.snapshot(now());
    // A finished turn carries its recap (files, commands, tests, time).
    if (live.pose === 'done' && live.focus && world === real) live.focus.recap = powers.recap(live.focus.id);
    return presentable({
      type: 'state',
      demo: world !== real,
      setup: setup(),
      live,
      pet: pet.view(world.pet),
      party: world === real ? party.view(real.pet) : null,
      companions: world === real ? companionViews() : {},
      config: publicConfig(),
      restoreOffer: restoreOffer ? restoreOffer.summary : null,
      cloud: cloudView(),
      owners: world === real ? sessionOwners() : {},
      permissions: permissionView(),
      questions: questionView(),
      inbox: world === real ? inboxView(live) : {},
      // Which agent sessions are Openmon's own chats (a click opens the chat).
      chatSessions: world === real ? Object.fromEntries(assistant.list().map((c) => [c.sessionId, c.id])) : {},
    });
  }

  function broadcast(message) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const res of clients) res.write(data);
  }

  function pushState(force = false) {
    const s = state();
    const json = JSON.stringify(s);
    if (!force && json === lastStateJson) return s;
    lastStateJson = json;
    broadcast(s);
    bus.emit('state', s);
    return s;
  }

  function pushEvents(events) {
    if (!events.length) return;
    for (const e of events) if (e.type === 'evolve' || e.type === 'achievement') log(`${e.type} ${e.to || e.title}`);
    broadcast({ type: 'events', events });
    bus.emit('events', events);
  }

  function ingestInto(target, payload) {
    const signal = classify(payload);
    if (!signal) return [];
    if (target === real && permissions.size && payload.hook_event_name !== 'PermissionRequest') {
      for (const p of [...permissions.values()]) if (!p.chat && p.session === signal.session && (signal.kind === 'tool-start' || signal.kind === 'tool-done' || signal.kind === 'tool-fail' || signal.kind === 'turn-start' || signal.kind === 'turn-end')) settlePermission(p.id, null, { how: 'agent' });
    }
    // A question ends with the turn (you pressed Esc, or the agent moved on).
    // Not on tool events: the question tool's own PreToolUse arrives with it.
    if (target === real && questions.size) {
      for (const q of [...questions.values()]) if (q.session === signal.session && (signal.kind === 'turn-start' || signal.kind === 'turn-end' || signal.kind === 'session-end')) settleQuestion(q.id, null);
    }
    // You typed in the agent's own window: a waiting listener can go.
    if (target === real && (signal.kind === 'turn-start' || signal.kind === 'session-end')) releaseListener(signal.session);
    // Where each conversation is written, for the chat window.
    if (target === real && payload.transcript_path && signal.session) {
      transcripts.delete(signal.session);
      transcripts.set(signal.session, { file: String(payload.transcript_path), cwd: payload.cwd ? String(payload.cwd) : null });
      if (transcripts.size > 100) transcripts.delete(transcripts.keys().next().value);
    }
    if (target === real && signal.kind === 'session-end') {
      inbox.delete(signal.session);
      reachable.delete(signal.session);
    }
    const t = now();
    if (target === real) {
      powers.record(payload, signal.label, t);
      if (signal.kind === 'session-end') focus.forget(signal.session);
    }
    const ctx = target.sessions.apply(signal, t);
    // The real pet routes work to the pet of each project (Party); the demo
    // pet is a single egg.
    const events = target === real ? party.applySignal(real.pet, signal, ctx, t, petForSession(signal)) : pet.applySignal(target.pet, signal, ctx, t);
    // A chat of Openmon's own says it is done with its answer (chat-done), not a summary too.
    if (target === real) events.push(...target.sessions.takeNotices().filter((e) => !(e.type === 'summary' && assistant.bySession(e.session))));
    // Now and then a wild Openmon shows up (never in quiet or presentation mode).
    if (target === real) events.push(...wild.roll(real.pet, signal, t, Math.random, config.wild !== false && !config.present && !(config.quietUntil && config.quietUntil > t)));
    if (target === real) noteActivity(t);
    // Agent time per project: the gap since this session's previous event.
    if (target === real && signal.label) {
      const last = lastEventOf.get(signal.session);
      lastEventOf.set(signal.session, t);
      if (last && t - last < 5 * 60 * 1000) events.push(...pet.addAgentTime(real.pet, signal.label, t - last, t));
      if (lastEventOf.size > 200) lastEventOf.delete(lastEventOf.keys().next().value);
    }
    if (target === real && (signal.kind === 'turn-end' || signal.kind === 'session-end') && payload.transcript_path) {
      const delta = usage.read(String(payload.transcript_path));
      if (delta) events.push(...pet.addTokens(real.pet, delta, t, signal.label || null, config.tokenLimit || 0));
    }
    if (target === real) persist(events.some((e) => e.type === 'evolve'));
    log(`${signal.kind.padEnd(14)} ${signal.label}${signal.detail ? ` · ${signal.detail}` : ''}`);
    return events;
  }

  function partyAction(fn) {
    const result = fn();
    persist(true);
    pushState(true);
    return result;
  }

  // Break reminder: after 50 or 90 minutes of agent work without a pause
  // of 10 minutes.
  let activeSince = null;
  let lastActivity = 0;
  function noteActivity(t) {
    if (!activeSince || t - lastActivity > 10 * 60_000) activeSince = t;
    lastActivity = t;
  }
  function checkBreak() {
    const t = now();
    if (!config.breakEvery || !activeSince || t - lastActivity > 5 * 60_000) return;
    if (t - activeSince >= config.breakEvery * 60_000) {
      activeSince = t;
      pushEvents([{ type: 'break', minutes: config.breakEvery }]);
    }
  }

  // Phone alert (opt-in, ntfy.sh): an agent has waited for you a while.
  // Sends only "Your agent needs you" (and the project name if you allow it).
  let phonedFor = null;
  function phone(title, message) {
    if (!PHONE_TOPIC.test(config.phoneTopic || '')) return Promise.resolve(false);
    return new Promise((resolve) => {
      const req = require('node:https').request({ host: 'ntfy.sh', path: `/${config.phoneTopic}`, method: 'POST', headers: { Title: title, Tags: 'egg', 'Content-Type': 'text/plain; charset=utf-8' }, timeout: 8000 }, (res) => {
        res.resume();
        resolve(res.statusCode < 300);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => req.destroy());
      req.end(message);
    });
  }
  function checkPhone() {
    if (!config.phoneAlerts || world !== real) return;
    const live = real.sessions.snapshot(now());
    if (live.pose !== 'attention' || !live.focus) return;
    const quiet = config.quietUntil && config.quietUntil > now();
    if (quiet || phonedFor === live.focus.since || now() - live.focus.since < (config.phoneAfterSec ?? 60) * 1000) return;
    phonedFor = live.focus.since;
    const pt = /^pt/i.test(config.lang || '');
    const who = config.phoneProject && !config.present ? live.focus.label : pt ? 'Seu agente' : 'Your agent';
    phone('Openmon', pt ? `${who} precisa de você.` : `${who} needs you.`);
  }

  // Real agent events always reach the real pet, even while a demo plays.
  function ingest(payload) {
    const events = ingestInto(real, payload);
    if (world === real) {
      pushEvents(events);
      pushState();
    }
    return events;
  }

  // Permission requests the pet can answer: id -> { id, session, detail, until, waiters, decision }.
  // Only with "Answer permissions from the pet" on, and only while a pet
  // window is open to show the buttons.
  const permissions = new Map();
  // Answers that arrive before the hook starts waiting are kept a moment.
  const settled = new Map();

  // What an edit would change, for the bubble: the lines that go and the
  // lines that come (the unchanged ones around them dropped), a few at
  // most, secrets hidden. Commands need none: the command is the detail.
  // (The bubble shows 8 short lines; the request page, up to 400 whole ones.)
  function permissionPreview(tool, input, MAX = 8, WIDTH = 90) {
    if (!input || typeof input !== 'object') return null;
    const clip = (s) => {
      const t = String(s).replace(/\t/g, '  ').replace(/\s+$/, '');
      return t.length > WIDTH ? `${t.slice(0, WIDTH - 1)}…` : t;
    };
    // Secrets are hidden in the whole text first: some span lines (keys).
    const split = (s) => (typeof s === 'string' && s ? redact(s).split(/\r?\n/) : []);
    const lines = [];
    let more = 0;
    const push = (t, s) => (lines.length < MAX ? lines.push({ t, s: clip(s) }) : more++);
    const change = (before, after) => {
      const a = split(before);
      const b = split(after);
      let start = 0;
      while (start < a.length && start < b.length && a[start] === b[start]) start++;
      let end = 0;
      while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
      for (const s of a.slice(start, a.length - end)) push('-', s);
      for (const s of b.slice(start, b.length - end)) push('+', s);
    };
    const file = (p) => (typeof p === 'string' && p ? p.split(/[\\/]/).pop() : null);
    if (tool === 'Edit') change(input.old_string, input.new_string);
    else if (tool === 'MultiEdit' && Array.isArray(input.edits)) for (const e of input.edits) change(e && e.old_string, e && e.new_string);
    else if (tool === 'Write') for (const s of split(input.content)) push('+', s);
    else if (tool === 'NotebookEdit') for (const s of split(input.new_source)) push('+', s);
    else return null;
    if (!lines.length) return null;
    return { file: file(input.file_path || input.notebook_path), lines, more };
  }

  function askPermission(body, signal) {
    if (!config.answerFromPet || !body._permission || !clients.size || world !== real) return null;
    // One of Openmon's own chats: Claude Code asks Openmon directly.
    if (assistant.owns(String(body.session_id || ''))) return null;
    // The agent's questions have their own hook (and their own bubble).
    if (body.tool_name === 'AskUserQuestion') return null;
    // Unguessable, so only the pet that shows the request can answer it.
    const id = require('node:crypto').randomBytes(12).toString('hex');
    const waitMs = (config.answerWaitSec || 25) * 1000;
    // Claude Code's own suggestions ("allow this from now on") make the
    // "Always allow" button possible.
    const suggestions = Array.isArray(body.permission_suggestions) && body.permission_suggestions.length ? body.permission_suggestions : null;
    const entry = { id, session: signal ? signal.session : String(body.session_id || 'default'), label: signal ? signal.label : null, detail: signal ? signal.detail : null, since: now(), until: now() + waitMs, waiters: [], decision: null, suggestions, preview: permissionPreview(body.tool_name, body.tool_input), full: permissionPreview(body.tool_name, body.tool_input, 400, 400) };
    entry.timer = setTimeout(() => settlePermission(id, null, { how: 'timeout' }), waitMs + 500);
    if (entry.timer.unref) entry.timer.unref();
    permissions.set(id, entry);
    pushState(true);
    return { id, waitMs };
  }

  function settlePermission(id, decision, extra = {}) {
    const entry = permissions.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    permissions.delete(id);
    entry.decision = decision;
    const forget = setTimeout(() => settled.delete(id), 30_000);
    if (forget.unref) forget.unref();
    const reply = decision === 'always' ? { decision: 'allow', updatedPermissions: entry.suggestions || [] } : { decision };
    // "Deny" can carry what you wrote, and can stop the agent.
    if (decision === 'deny' && extra.message) reply.message = extra.message;
    if (decision === 'deny' && extra.interrupt) reply.interrupt = true;
    settled.set(id, reply);
    if (entry.onSettle) entry.onSettle(decision ? { decision, message: reply.message, interrupt: reply.interrupt } : null);
    for (const res of entry.waiters) json(res, 200, reply);
    // Today's requests, for "what did I allow?" (the short preview only).
    const day = real.pet.daily;
    if (day) {
      const how = decision || extra.how || 'agent';
      day.requests = [...(day.requests || []), { at: now(), label: entry.label, detail: entry.detail, how, preview: entry.preview || null }].slice(-100);
      persist(false);
    }
    pushState(true);
    return true;
  }

  function permissionView() {
    return [...permissions.values()].map((p) => ({ id: p.id, session: p.session, label: p.label, detail: p.detail, until: p.until, canAlways: Boolean(p.suggestions), preview: p.preview || null, chat: p.chat || null, since: p.since || null }));
  }

  // The agent's questions (AskUserQuestion) the pet can answer, like
  // permissions: same setting, same wait, an unguessable id.
  const questions = new Map();
  const settledQuestions = new Map();

  function askQuestion(body) {
    // Only a desktop pet window (it holds the key) can answer, so without
    // one Claude Code asks you at once.
    if (!config.answerFromPet || !talkers.size || world !== real || !body || body.tool_name !== 'AskUserQuestion') return null;
    if (assistant.owns(String(body.session_id || ''))) return null;
    const list = questionsOf(body.tool_input);
    if (!list) return null;
    const signal = classify({ ...body, hook_event_name: 'PreToolUse' });
    const id = require('node:crypto').randomBytes(12).toString('hex');
    const waitMs = (config.answerWaitSec || 25) * 1000;
    const entry = { id, session: signal ? signal.session : String(body.session_id || 'default'), label: signal ? signal.label : null, list, until: now() + waitMs, waiters: [] };
    entry.timer = setTimeout(() => settleQuestion(id, null), waitMs + 500);
    if (entry.timer.unref) entry.timer.unref();
    questions.set(id, entry);
    // The pet jumps with its sign, as for any "needs you".
    ingest({ session_id: body.session_id, cwd: body.cwd, _projectDir: body._projectDir, hook_event_name: 'Notification', message: list[0].question });
    pushState(true);
    return { id, waitMs };
  }

  // answers: one per question, an array of option labels or your own text.
  function answersFor(entry, answers) {
    if (!Array.isArray(answers) || answers.length !== entry.list.length) return null;
    const out = {};
    for (let i = 0; i < entry.list.length; i++) {
      const q = entry.list[i];
      const picks = (Array.isArray(answers[i]) ? answers[i] : [answers[i]]).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, MAX_MESSAGE));
      if (!picks.length || (!q.multiSelect && picks.length > 1)) return null;
      out[q.question] = picks.join(', ');
    }
    return out;
  }

  function settleQuestion(id, answers) {
    const entry = questions.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    questions.delete(id);
    const reply = { answers };
    settledQuestions.set(id, reply);
    if (entry.onSettle) entry.onSettle(answers);
    const forget = setTimeout(() => settledQuestions.delete(id), 30_000);
    if (forget.unref) forget.unref();
    for (const res of entry.waiters) json(res, 200, reply);
    pushState(true);
    return true;
  }

  // As the pet shows them: secrets in the text are masked.
  function questionView() {
    return [...questions.values()].map((q) => ({
      id: q.id,
      session: q.session,
      label: q.label,
      until: q.until,
      chat: q.chat || null,
      list: q.list.map((x) => ({ ...x, question: redact(x.question), header: redact(x.header), options: x.options.map((o) => ({ label: o.label, shown: redact(o.label), description: redact(o.description) })) })),
    }));
  }

  // Messages you write on the pet for a conversation. The next hook of
  // that session delivers it (asyncRewake), or the hook that waits while
  // the session is idle. Never logged, never in the state.
  const inbox = new Map(); // session -> { text, at }
  const listeners = new Map(); // session -> res of the waiting hook
  const reachable = new Map(); // session -> when its last --rewake hook came
  const LISTEN_MS = installer.LISTEN_SEC * 1000 - 5000;

  function releaseListener(session, text = null) {
    const res = listeners.get(session);
    if (!res) return false;
    listeners.delete(session);
    json(res, 200, { text });
    return true;
  }

  function delivered(session) {
    pushEvents([{ type: 'message-delivered', session }]);
    pushState(true);
  }

  function sendMessage(session, text) {
    if (!reachable.has(session)) return { ok: false, reason: 'unsupported' };
    const before = inbox.get(session);
    const all = before ? `${before.text}\n\n${text}` : text;
    if (releaseListener(session, all)) {
      inbox.delete(session);
      delivered(session);
      return { ok: true, delivered: true };
    }
    inbox.set(session, { text: all, at: now() });
    pushState(true);
    return { ok: true, delivered: false };
  }

  // What a --rewake hook of this session should do: hand over a waiting
  // message, or (session idle or new) stay in the background for one.
  function rewakeReply(body) {
    if (!body || !body._rewake || world !== real || body.hook_event_name === 'SessionEnd') return null;
    const session = body.session_id ? String(body.session_id) : 'default';
    reachable.delete(session);
    reachable.set(session, now());
    if (reachable.size > 200) reachable.delete(reachable.keys().next().value);
    const waiting = inbox.get(session);
    if (waiting) {
      inbox.delete(session);
      delivered(session);
      return { deliver: waiting.text };
    }
    if (installer.LISTEN_EVENTS.includes(body.hook_event_name)) return { listen: { waitMs: LISTEN_MS } };
    return null;
  }

  function inboxView(live) {
    const out = {};
    for (const s of live.sessions || []) out[s.id] = { canSend: reachable.has(s.id), queued: inbox.has(s.id), listening: listeners.has(s.id) };
    return out;
  }

  // Free text that reaches the agent needs the key only the desktop pet
  // windows have, so another program on this computer cannot type to it.
  function keyOk(req) {
    const given = Buffer.from(String(req.headers['x-openmon-key'] || ''));
    const want = Buffer.from(contactKey);
    return given.length === want.length && require('node:crypto').timingSafeEqual(given, want);
  }

  // ---- The assistant: Openmon's own conversations with Claude ----------
  // Where each Claude Code conversation is written (session -> file, folder).
  const transcripts = new Map();
  // Chat windows listening to the conversations as they stream (key holders).
  const chatClients = new Set();
  const CHAT_WAIT_MS = 60 * 60 * 1000;

  function chatBroadcast(message) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const res of chatClients) res.write(data);
  }

  // A request from one of our chats joins the pet's queue: the bubble, the
  // notification, the hotkeys, the request page and the chat all answer it.
  // No 25 s clock: nobody else would ask (an hour, then it is a no).
  function askFromChat(chat, req) {
    return new Promise((resolve) => {
      const signal = classify({ session_id: chat.sessionId, cwd: chat.cwd, hook_event_name: 'PermissionRequest', tool_name: req.tool, tool_input: req.input });
      const id = require('node:crypto').randomBytes(12).toString('hex');
      const entry = { id, session: chat.sessionId, label: signal ? signal.label : path.basename(chat.cwd), detail: signal ? signal.detail : `Allow ${req.tool}?`, since: now(), until: now() + CHAT_WAIT_MS, waiters: [], decision: null, suggestions: req.suggestions, preview: permissionPreview(req.tool, req.input), full: permissionPreview(req.tool, req.input, 400, 400), chat: chat.id, onSettle: resolve };
      entry.timer = setTimeout(() => settlePermission(id, null, { how: 'timeout' }), CHAT_WAIT_MS);
      if (entry.timer.unref) entry.timer.unref();
      permissions.set(id, entry);
      // The pet jumps with its sign, as for any "needs you".
      ingest({ session_id: chat.sessionId, cwd: chat.cwd, hook_event_name: 'Notification', message: entry.detail });
      pushState(true);
    });
  }

  function questionFromChat(chat, req) {
    const list = questionsOf(req.input);
    if (!list) return Promise.resolve(null);
    return new Promise((resolve) => {
      const id = require('node:crypto').randomBytes(12).toString('hex');
      const entry = { id, session: chat.sessionId, label: path.basename(chat.cwd), list, until: now() + CHAT_WAIT_MS, waiters: [], chat: chat.id, onSettle: resolve };
      entry.timer = setTimeout(() => settleQuestion(id, null), CHAT_WAIT_MS);
      if (entry.timer.unref) entry.timer.unref();
      questions.set(id, entry);
      ingest({ session_id: chat.sessionId, cwd: chat.cwd, hook_event_name: 'Notification', message: list[0].question });
      pushState(true);
    });
  }

  // Openmon's tools for Claude (src/mcp.js): their own key, new every start.
  const toolKey = require('node:crypto').randomBytes(24).toString('hex');
  const MCP_SCRIPT = path.join(__dirname, 'mcp.js');

  // Who the assistant is: your Openmon, in your language, with its tools.
  function persona(chat) {
    const p = real.pet;
    const pt = /^pt/i.test(config.lang || '');
    const es = /^es/i.test(config.lang || '');
    const name = pet.displayName(p);
    const lines = [
      `You are ${name}, the user's Openmon: a ${pet.form(p)} (${p.stage}, nature: ${p.nature || 'calm'}) that lives on their desktop and works as their personal assistant. You talk with the user through the Openmon chat window and the pet's speech bubble.`,
      `Answer in ${pt ? 'Brazilian Portuguese' : es ? 'Spanish' : 'the user\'s language'}. Be warm, short and concrete; a touch of your nature is welcome, never at the cost of clarity. Use Markdown lists and code blocks when they help.`,
      `Today is ${new Date(now()).toString()}.`,
      'You have Openmon tools (mcp__openmon__*): remind (the pet tells the user at a time), schedule_task (Openmon starts a conversation with Claude at a time and tells the user when it is done), list_schedule, cancel_scheduled, remember (a lasting fact in the assistant\'s memory), say (a line in the pet\'s bubble), notify (a system notification) and work_summary (what the user\'s coding agents did lately). Use them whenever the user asks for a reminder, a routine, to remember something, or about their work; confirm in one line what you set and when.',
      chat.cwd === assistantFolder() ? 'This is the assistant folder: general requests, not a code project. Its CLAUDE.md is your memory of the user.' : `You are working in the folder ${chat.cwd}.`,
    ];
    return `${lines.join('\n\n')}\n`;
  }

  // The files Claude Code reads for each conversation Openmon starts.
  function prepareChat(chat) {
    fs.mkdirSync(chatsDir, { recursive: true });
    const systemFile = path.join(chatsDir, `persona-${chat.id}.md`);
    fs.writeFileSync(systemFile, persona(chat));
    const mcpConfig = path.join(chatsDir, 'mcp.json');
    const env = { OPENMON_PORT: String(server.address() ? server.address().port : port), OPENMON_TOOL_KEY: toolKey };
    // Inside Electron, its own binary runs the script as plain Node.
    if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1';
    fs.writeFileSync(mcpConfig, JSON.stringify({ mcpServers: { openmon: { type: 'stdio', command: process.execPath, args: [MCP_SCRIPT], env } } }, null, 1));
    // Openmon's own tools never ask; in the assistant folder, reading and
    // searching do not either (nothing there but what you put there).
    const allowedTools = ['mcp__openmon', ...(chat.cwd === assistantFolder() ? ['Read', 'Grep', 'Glob', 'WebSearch'] : [])];
    return { systemFile, mcpConfig, allowedTools };
  }

  // A line in the assistant's memory (CLAUDE.md of its folder).
  function rememberFact(fact) {
    const t = String(fact || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!t) return false;
    const file = path.join(assistantFolder(true), 'CLAUDE.md');
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {}
    const head = /^pt/i.test(config.lang || '') ? '## Coisas para lembrar' : /^es/i.test(config.lang || '') ? '## Cosas para recordar' : '## Things to remember';
    if (!text.includes(head)) text = `${text.replace(/\s*$/, '')}\n\n${head}\n`;
    fs.writeFileSync(file, `${text.replace(/\s*$/, '')}\n- ${t}\n`);
    return true;
  }

  // "in_minutes" / "at" / "repeat" (the tools' words) as the schedule's.
  function whenOf(args) {
    if (Number.isFinite(Number(args.in_minutes)) && Number(args.in_minutes) > 0) return { type: 'in', minutes: Number(args.in_minutes) };
    if (typeof args.at === 'string') return { type: args.repeat === 'daily' || args.repeat === 'weekdays' ? args.repeat : 'at', time: args.at.trim() };
    return null;
  }

  // What the user's agents did lately, from the journal (for briefs).
  function workSummary(days) {
    const n = Math.min(14, Math.max(1, Math.round(Number(days) || 1)));
    const v = pet.view(real.pet);
    const recent = (v.journal || []).slice(-n);
    if (!recent.length) return 'No agent work recorded yet.';
    return recent
      .map((e) => {
        const projects = Object.entries(e.agentMs || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, ms]) => `${k} ${Math.round(ms / 60000)} min`).join(', ');
        const kinds = Object.entries(e.families || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => `${k} ${c}`).join(', ');
        return `${e.day}: ${e.tools} tool uses, ${e.edits} edits, ${e.turns} turns, tests ${e.green} green / ${e.red} red, ${e.tokens} tokens, waited for the user ${Math.round((e.waitMs || 0) / 60000)} min.${projects ? ` Projects: ${projects}.` : ''}${kinds ? ` Kinds of work: ${kinds}.` : ''}`;
      })
      .join('\n');
  }

  function runTool(name, args = {}) {
    const fmt = (ms) => new Date(ms).toLocaleString(config.lang || 'en', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    switch (name) {
      case 'remind':
      case 'schedule_task': {
        const when = whenOf(args);
        if (!when) return { ok: false, error: 'Give in_minutes, or at as HH:MM.' };
        const r = name === 'remind' ? schedule.add({ kind: 'remind', text: args.text, when }) : schedule.add({ kind: 'task', text: args.prompt, cwd: typeof args.folder === 'string' && path.isAbsolute(args.folder) ? args.folder : assistantFolder(true), when });
        if (!r.ok) return { ok: false, error: `could not schedule (${r.reason})` };
        pushEvents([{ type: 'scheduled', kind: r.item.kind, text: config.present ? '' : r.item.text, next: r.item.next }]);
        return { ok: true, text: `Scheduled (id ${r.item.id}) for ${fmt(r.item.next)}${r.item.repeat ? `, then ${r.item.repeat} at ${r.item.time}` : ''}.` };
      }
      case 'list_schedule': {
        const items = schedule.list();
        return { ok: true, text: items.length ? items.map((i) => `${i.id} · ${i.kind} · ${fmt(i.next)}${i.repeat ? ` (${i.repeat})` : ''} · ${i.text}`).join('\n') : 'Nothing scheduled.' };
      }
      case 'cancel_scheduled':
        return schedule.remove(String(args.id || '')) ? { ok: true, text: 'Cancelled.' } : { ok: false, error: 'no such id' };
      case 'remember':
        return rememberFact(args.fact) ? { ok: true, text: 'Saved in the assistant\'s memory.' } : { ok: false, error: 'empty fact' };
      case 'say': {
        const text = String(args.text || '').trim().slice(0, 300);
        if (!text) return { ok: false, error: 'empty text' };
        if (config.present) return { ok: true, text: 'Not shown: presentation mode is on.' };
        pushEvents([{ type: 'say', text }]);
        return { ok: true, text: 'Shown in the bubble.' };
      }
      case 'notify': {
        const text = String(args.text || '').trim().slice(0, 300);
        if (!text) return { ok: false, error: 'empty text' };
        if (config.present) return { ok: true, text: 'Not shown: presentation mode is on.' };
        bus.emit('notify', { title: String(args.title || 'Openmon').slice(0, 80), text });
        return { ok: true, text: 'Notification shown.' };
      }
      case 'work_summary':
        return { ok: true, text: config.present ? 'Hidden: presentation mode is on.' : workSummary(args.days) };
      default:
        return { ok: false, error: `unknown tool ${name}` };
    }
  }

  // Quick questions all go to one conversation, kept between them.
  function quickChat(input) {
    const pt = /^pt/i.test(config.lang || '');
    const es = /^es/i.test(config.lang || '');
    const existing = config.quickChat && assistant.get(config.quickChat);
    if (existing) return { ...assistant.send(existing.id, input), id: existing.id };
    const r = assistant.create({ cwd: assistantFolder(true), title: pt ? 'Perguntas rápidas' : es ? 'Preguntas rápidas' : 'Quick questions', ...input });
    if (r.id) setConfig({ quickChat: r.id });
    return r;
  }

  const assistant = createAssistant({
    dir: chatsDir,
    prepare: prepareChat,
    now,
    log,
    ...(spawnClaude ? { spawn: spawnClaude } : {}),
    onChange: (id, change) => chatBroadcast({ type: 'chat', id, ...change }),
    askPermission: askFromChat,
    askQuestion: questionFromChat,
    onDone: (chat, text) => {
      // Stuck requests of a finished turn go away with it.
      for (const p of [...permissions.values()]) if (p.chat === chat.id) settlePermission(p.id, null, { how: 'agent' });
      const line = config.present ? '' : String(text || '').split('\n').find((l) => l.trim()) || '';
      // The answer as plain text, short enough for the pet's bubble.
      const plain = config.present ? '' : String(text || '').replace(/```[\s\S]*?```/g, ' […] ').replace(/[*_`#>]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
      pushEvents([{ type: 'chat-done', id: chat.id, title: config.present ? '' : chat.title, line: line.slice(0, 160), answer: plain.length > 320 ? `${plain.slice(0, 317)}…` : plain, quick: chat.id === config.quickChat }]);
      bus.emit('chat-done', { id: chat.id, title: chat.title, line: line.slice(0, 160) });
    },
  });

  // The assistant's own folder (Documents/Openmon Assistente), with a
  // CLAUDE.md that is the assistant's memory: who you are, how to answer.
  function assistantFolder(create = false) {
    const pt = /^pt/i.test(config.lang || '');
    const es = /^es/i.test(config.lang || '');
    const dir = config.assistantFolder || path.join(require('node:os').homedir(), 'Documents', pt ? 'Openmon Assistente' : es ? 'Openmon Asistente' : 'Openmon Assistant');
    if (create) {
      if (!config.assistantFolder && configFile) setConfig({ assistantFolder: dir });
      try {
        fs.mkdirSync(dir, { recursive: true });
        const memory = path.join(dir, 'CLAUDE.md');
        if (!fs.existsSync(memory)) fs.writeFileSync(memory, MEMORY_TEMPLATE[pt ? 'pt' : es ? 'es' : 'en']);
      } catch {}
    }
    return dir;
  }

  // Folders for a new conversation: the assistant's, then where you worked lately.
  function recentFolders() {
    const seen = new Set();
    const out = [];
    const add = (dir) => {
      if (!dir || seen.has(dir) || out.length >= 8) return;
      seen.add(dir);
      try {
        if (fs.statSync(dir).isDirectory()) out.push(dir);
      } catch {}
    };
    for (const c of assistant.list()) add(c.cwd);
    for (const t of [...transcripts.values()].reverse()) add(t.cwd);
    return out;
  }

  // Files you dropped or picked: pictures go to Claude as images; any other
  // file is named in the message, for Claude to open.
  function attachments(files) {
    const images = [];
    const named = [];
    for (const f of Array.isArray(files) ? files.slice(0, 10) : []) {
      if (typeof f !== 'string' || !path.isAbsolute(f)) continue;
      let stat;
      try {
        stat = fs.statSync(f);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }[path.extname(f).toLowerCase()];
      if (type && stat.size <= 5 * 1024 * 1024) images.push({ type, data: fs.readFileSync(f).toString('base64') });
      else named.push(f);
    }
    return { images, named };
  }

  function chatInput(body) {
    const { images, named } = attachments(body.files);
    for (const img of Array.isArray(body.images) ? body.images.slice(0, 5) : []) {
      if (img && typeof img.data === 'string' && img.data.length <= 7 * 1024 * 1024 && /^image\/(png|jpeg|gif|webp)$/.test(img.type)) images.push({ type: img.type, data: img.data });
    }
    let text = typeof body.text === 'string' ? body.text.trim().slice(0, 20000) : '';
    if (named.length) text = `${text}\n\n${named.map((f) => `@${f}`).join('\n')}`.trim();
    return { text, images };
  }

  // A conversation open elsewhere (terminal, editor, Claude's app), as the
  // chat shows it: read from Claude Code's own file.
  function agentView(session) {
    const live = real.sessions.snapshot(now());
    const s = (live.sessions || []).find((x) => x.id === session);
    const t = transcripts.get(session);
    return { session, label: s ? s.label : t && t.cwd ? path.basename(t.cwd) : session, state: s ? s.state : 'ended', detail: s ? s.detail : null, cwd: t ? t.cwd : null, canSend: reachable.has(session), queued: inbox.has(session), messages: config.present ? [] : (t && readTranscript(t.file)) || [] };
  }

  function chatList() {
    const live = real.sessions.snapshot(now());
    const agents = (live.sessions || []).filter((s) => !assistant.bySession(s.id)).map((s) => ({ session: s.id, label: s.label, state: s.state, detail: s.detail, canSend: reachable.has(s.id), hasTranscript: transcripts.has(s.id) }));
    return { chats: assistant.list(), agents, folders: recentFolders(), assistantFolder: assistantFolder(), present: Boolean(config.present), schedule: schedule.list() };
  }

  // Reminders and scheduled tasks.
  const schedule = createSchedule({
    file: path.join(chatsDir, 'schedule.json'),
    now,
    onReminder: (item) => {
      // On a shared screen (presentation mode): that there is one, not what.
      const text = config.present ? '' : item.text;
      pushEvents([{ type: 'reminder', id: item.id, text }]);
      bus.emit('reminder', { ...item, text });
    },
    onTask: (item) => {
      const r = assistant.create({ cwd: item.cwd, text: item.text });
      pushEvents([{ type: 'task-started', id: r.id || null, text: item.text, ok: Boolean(r.ok) }]);
      bus.emit('task-started', { ...item, chat: r.id || null, ok: Boolean(r.ok) });
    },
  });

  // Answers from your phone (opt-in): what you send to "<topic>-in" in the
  // ntfy app reaches the agent that waits for you, or your latest chat.
  let phoneIn = null;
  function phoneReply(text) {
    const t = String(text || '').trim().slice(0, MAX_MESSAGE);
    if (!t) return;
    const live = real.sessions.snapshot(now());
    const waiting = live.pose === 'attention' && live.focus ? live.focus.id : null;
    const ours = waiting && assistant.bySession(waiting);
    if (ours) assistant.send(ours.id, { text: t });
    else if (waiting && reachable.has(waiting)) sendMessage(waiting, t);
    else {
      const last = assistant.list()[0];
      if (last) assistant.send(last.id, { text: t });
      else return;
    }
    pushEvents([{ type: 'phone-reply' }]);
  }
  function checkPhoneIn() {
    const want = !playground && world === real && config.phoneReplies && PHONE_TOPIC.test(config.phoneTopic || '');
    if (!want) {
      if (phoneIn) {
        phoneIn.destroy();
        phoneIn = null;
      }
      return;
    }
    if (phoneIn) return;
    const since = Math.floor(now() / 1000);
    const req = require('node:https').get({ host: 'ntfy.sh', path: `/${config.phoneTopic}-in/json?since=${since}` }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        buf += d;
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          try {
            const m = JSON.parse(line);
            if (m.event === 'message') phoneReply(m.message);
          } catch {}
        }
      });
      res.on('end', () => (phoneIn = null));
    });
    req.on('error', () => setTimeout(() => (phoneIn = null), 30_000).unref());
    req.setTimeout(0);
    phoneIn = req;
  }

  // Brings the window of a waiting agent (or the given session) to the front.
  function focusAgent(id) {
    const live = real.sessions.snapshot(now());
    const target = typeof id === 'string' && id ? id : live.focus && live.focus.id;
    if (!target) return Promise.resolve({ ok: false, reason: 'unknown' });
    return focus.focus(target);
  }

  // A click on the pet. With an id, a companion on screen is petted (its
  // own friendship); its events carry petId so only its window reacts.
  function petIt(id = null) {
    const member = id && world === real ? (real.pet.others || []).find((m) => m.id === id) : null;
    if (member) {
      const merged = party.merge(real.pet, member);
      const events = pet.petIt(merged, now()).map((e) => ({ ...e, petId: id }));
      party.split(real.pet, member, merged);
      persist();
      pushEvents(events);
      pushState();
      return events;
    }
    const events = pet.petIt(world.pet, now());
    if (world === real) persist();
    pushEvents(events);
    pushState();
    return events;
  }

  // Wardrobe and bag actions on the pet you are looking at.
  function change(fn) {
    const events = fn(world.pet);
    if (world === real) persist(events.some((e) => e.type === 'evolve'));
    pushEvents(events);
    pushState();
    return events;
  }

  function rename(name) {
    const events = pet.rename(real.pet, name);
    persist(true);
    pushEvents(events);
    pushState();
    return events;
  }

  // The player picks the starter of the egg that waits for one.
  // An Openball at the wild Openmon, or letting it go.
  function wildAction(fn) {
    const events = fn();
    if (!events.length) return events;
    persist(true);
    pushEvents(events);
    pushState(true);
    return events;
  }

  function chooseStarter(lineage) {
    const events = party.chooseStarter(real.pet, String(lineage || ''), now());
    if (!events.length) return events;
    persist(true);
    pushEvents(events);
    pushState(true);
    return events;
  }

  function layEgg() {
    const old = real.pet;
    const { pet: egg, events } = pet.layEgg(old, now());
    if (!events.length) return events;
    // The new egg takes the retired pet's place: same project, same party.
    Object.assign(egg, { project: old.project ?? null, place: 'party', others: old.others || [], projects: old.projects || {} });
    real.pet = party.ensure(egg);
    persist(true);
    pushEvents(events);
    pushState(true);
    return events;
  }

  function persist(force = false) {
    store.save(real.pet);
    if (cloud) cloud.markChanged();
    // The offer only stands until the new egg starts its own life.
    if (restoreOffer && (real.pet.xp > 0 || real.pet.counters.tools > 0)) {
      restoreOffer = null;
      if (backups) backups.keepAside();
    }
    if (backups && !restoreOffer) backups.maybe(real.pet, config, force);
  }

  // Replaces the real pet with a saved one (backup folder or a file).
  function restore(save) {
    if (!save || !save.pet) return { ok: false };
    stopDemo();
    real.pet = save.pet;
    restoreOffer = null;
    store.save(real.pet);
    store.flush();
    if (save.config && Object.keys(save.config).length) {
      const keep = ['muted', 'notify', 'chatter', 'scale'];
      setConfig(Object.fromEntries(keep.filter((k) => save.config[k] !== undefined).map((k) => [k, save.config[k]])));
    }
    if (backups) backups.maybe(real.pet, config, true);
    const events = [{ type: 'restored', name: pet.view(real.pet).name }];
    pushEvents(events);
    pushState(true);
    return { ok: true, pet: pet.view(real.pet) };
  }

  function restoreFile(file) {
    return restore(unwrap(fs.readFileSync(file, 'utf8'), now()));
  }

  function exportTo(file) {
    const { wrap } = require('./backup');
    fs.writeFileSync(file, `${JSON.stringify(wrap(real.pet, config, now()), null, 2)}\n`);
    return file;
  }

  // Sandbox actions, only for `openmon playground` (its own data folder).
  const dev = playground
    ? createPlayground({
        getPet: () => real.pet,
        setPet: (p) => {
          real.pet = p;
        },
        now,
        bus,
        ingest,
        applyEvents: (events) => {
          store.save(real.pet);
          pushEvents(events);
          pushState(true);
          return events;
        },
      })
    : null;

  function stopDemo() {
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    if (world !== real) {
      world = real;
      pushState(true);
    }
  }

  // Plays a scripted session on a throwaway egg, so the user sees a hatch
  // without touching their real pet.
  // speed > 1 plays the script faster (used by the smoke test).
  function runDemo(speed = 1) {
    const k = Math.max(0.25, Math.min(10, Number(speed) || 1));
    stopDemo();
    const demoPet = pet.createPet(now(), real.pet.name);
    demoPet.xp = DEMO_START_XP;
    // A chosen starter hatches after a few minutes, so the demo shows a hatch.
    demoPet.starter = real.pet.starter || 'craft';
    world = createWorld(demoPet);
    const script = demoScript();
    pushState(true);
    let last = 0;
    for (const { delay, payload } of script) {
      last = Math.max(last, delay);
      demoTimers.push(
        setTimeout(() => {
          const target = world;
          const events = ingestInto(target, { ...payload, _ts: now() });
          pushEvents(events);
          pushState();
        }, delay / k),
      );
    }
    const total = (last + 8000) / k;
    demoTimers.push(setTimeout(stopDemo, total));
    return { durationMs: Math.round(total) };
  }

  function setConfig(patch) {
    config = { ...config, ...patch };
    if (configFile) {
      try {
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
      } catch {}
    }
    pushState(true);
  }

  // Quiet mode: no sounds, no chatter, no OS notifications for a while.
  // Focus mode: only "needs you" gets through, for a while.
  function setFocus(minutes) {
    setConfig({ focusUntil: minutes > 0 ? now() + minutes * 60_000 : null });
  }

  function setQuiet(minutes) {
    setConfig({ quietUntil: minutes > 0 ? now() + minutes * 60_000 : null });
  }

  // Your pet on other computers, through your GitHub account (src/cloud.js).
  const CLOUD_EVERY_MS = 10 * 60 * 1000;
  let cloudConflict = null;
  let cloudBusy = null;
  function cloudView() {
    if (!cloud) return null;
    return { ...cloud.status(), conflict: cloudConflict ? { ...cloudConflict.summary, machine: cloudConflict.machine.name } : null };
  }
  function freshPet() {
    return real.pet.xp === 0 && !(real.pet.counters && real.pet.counters.tools) && real.pet.others.length === 0;
  }
  // force: 'local' keeps this computer's pet, 'remote' takes the Gist's.
  function syncCloud(force = null) {
    if (!cloud || !cloud.connected() || world !== real) return Promise.resolve({ action: 'off' });
    if (cloudBusy) return cloudBusy;
    cloudBusy = (async () => {
      store.flush();
      const r = await cloud.sync({ pet: real.pet, config, fresh: freshPet() || Boolean(restoreOffer), force });
      if (r.action === 'pull') {
        // This computer's pet is kept in the backup folder first.
        if (backups && !freshPet()) {
          backups.maybe(real.pet, config, true);
          backups.keepAside();
        }
        restore(r.remote);
        cloud.synced(r.remote.savedAt);
        cloudConflict = null;
        pushEvents([{ type: 'cloud-pulled', machine: r.remote.machine.name }]);
      } else if (r.action === 'conflict') {
        const first = !cloudConflict;
        cloudConflict = r.remote;
        if (first) pushEvents([{ type: 'cloud-conflict', machine: r.remote.machine.name }]);
      } else if (r.action === 'pushed') cloudConflict = null;
      pushState(true);
      return { action: r.action, error: r.error };
    })().finally(() => {
      cloudBusy = null;
    });
    return cloudBusy;
  }
  const cloudTimer = setInterval(() => syncCloud(), CLOUD_EVERY_MS);
  cloudTimer.unref();
  if (cloud) setTimeout(() => syncCloud(), 1500).unref();

  async function cloudConnect(method) {
    if (!cloud) return { ok: false, error: 'off' };
    try {
      if (method === 'device') {
        const d = await cloud.startDevice();
        d.done.then(() => syncCloud(), () => pushState(true));
        pushState(true);
        return { ok: true, userCode: d.userCode, uri: d.uri };
      }
      const r = await cloud.connectGh();
      syncCloud();
      return r;
    } catch (err) {
      pushState(true);
      return { ok: false, error: err.message };
    }
  }

  let slowTick = 0;
  const ticker = setInterval(() => {
    world.sessions.tick(now());
    checkBreak();
    checkPhone();
    if (++slowTick % 10 === 0) {
      schedule.tick();
      checkPhoneIn();
    }
    if (world === real) {
      real.sessions.snapshot(now());
      const late = real.sessions.takeNotices();
      if (late.length) pushEvents(late);
    }
    if (world !== real) real.sessions.tick(now());
    pushState();
  }, 1000);
  ticker.unref();

  function allowed(req) {
    const host = String(req.headers.host || '');
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) && new URL(origin).port === String(server.address().port);
  }

  // The JSON body, then the route (once): a body that is not JSON comes as
  // `err`; a route that throws answers 500 instead of taking the daemon down.
  function readJson(req, cb) {
    const max = req.url.startsWith('/api/chat/') ? MAX_CHAT_BODY : MAX_BODY;
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', () => {
      let body;
      let err = null;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      } catch (e) {
        err = e;
      }
      // Valid JSON that is not an object (null, 3, "x") is no request body.
      if (!err && (!body || typeof body !== 'object')) err = new Error('not an object');
      try {
        cb(err, err ? null : body);
      } catch (e) {
        fail(req.res, e);
      }
    });
  }

  function fail(res, err) {
    log(`error ${err && err.message}`);
    if (res && !res.headersSent) res.writeHead(500).end();
    else if (res && !res.writableEnded) res.end();
  }

  // A path from the address bar: undefined when it is not valid %-encoding.
  function decodePath(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return undefined;
    }
  }

  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  const server = http.createServer((req, res) => {
    req.res = res;
    try {
      handle(req, res);
    } catch (err) {
      fail(res, err);
    }
  });

  function handle(req, res) {
    if (!allowed(req)) return res.writeHead(403).end();
    const url = new URL(req.url, 'http://localhost');
    const route = `${req.method} ${url.pathname}`;

    switch (route) {
      case 'POST /event':
        return readJson(req, (err, raw) => {
          if (err) return res.writeHead(400).end();
          // Gemini CLI, Cursor and Aider payloads become Claude Code's shape.
          const body = adapters.normalize(raw);
          if (!body) return res.writeHead(204).end();
          ingest(body);
          const reply = { ...rewakeReply(body) };
          // Once per session the hook is asked to find its agent's window.
          const sid = body && body.session_id ? String(body.session_id) : 'default';
          if (body && body._ppid && body.hook_event_name !== 'SessionEnd' && focus.wants(sid)) reply.findWindow = true;
          // A permission request the pet may answer.
          if (body && body.hook_event_name === 'PermissionRequest') {
            const ask = askPermission(body, classify(body));
            if (ask) reply.askPermission = ask;
          }
          if (Object.keys(reply).length) return json(res, 200, reply);
          res.writeHead(204).end();
        });
      case 'POST /api/pet':
        return readJson(req, (err, body) => json(res, 200, { events: petIt(!err && body && typeof body.id === 'string' ? body.id : null) }));
      case 'POST /api/rename':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: rename(body.name) })));
      case 'GET /api/powers':
        {
          const v = pet.view(world.pet);
          if (config.present) return json(res, 200, { unlocked: unlockedPowers(world.pet), featured: v.featured, today: { ...v.today, requests: [] }, journal: v.journal.map((e) => ({ ...e, projects: {}, agentMs: {}, tokensBy: {}, usdBy: {} })), streak: v.streak, sessions: [], present: true });
          return json(res, 200, { unlocked: unlockedPowers(world.pet), featured: v.featured, today: v.today, journal: v.journal, streak: v.streak, sessions: powers.view() });
        }
      case 'GET /api/playground':
        return json(res, 200, { playground: Boolean(dev) });
      case 'POST /api/window':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          focus.setWindow(body.session_id ? String(body.session_id) : 'default', body.window);
          res.writeHead(204).end();
        });
      // The permission hook waits here for your answer (or the timeout).
      case 'POST /api/permission/wait':
        return readJson(req, (err, body) => {
          const id = !err && body ? String(body.id || '') : '';
          if (settled.has(id)) return json(res, 200, settled.get(id));
          const entry = permissions.get(id);
          if (!entry) return json(res, 200, { decision: null });
          entry.waiters.push(res);
          // res, not req: a request's 'close' fires as soon as its body is read.
          res.on('close', () => (entry.waiters = entry.waiters.filter((r) => r !== res)));
        });
      // Your Allow or Deny, from the pet window (same-origin page only).
      // The request page: one waiting request, its whole diff.
      case 'GET /api/permission': {
        const entry = permissions.get(String(url.searchParams.get('id') || ''));
        if (!entry) return json(res, 200, { gone: true });
        return json(res, 200, { id: entry.id, label: entry.label, detail: entry.detail, until: entry.until, canAlways: Boolean(entry.suggestions), diff: entry.full || null, chat: entry.chat || null });
      }
      case 'POST /api/permission/decide':
        return readJson(req, (err, body) => {
          if (err || !body || !['allow', 'deny', 'always', 'release'].includes(body.decision)) return res.writeHead(400).end();
          // "Open": you answer in the agent's window, which asks right away.
          if (body.decision === 'release') return json(res, 200, { ok: settlePermission(String(body.id || ''), null, { how: 'agent' }) });
          const pendingEntry = permissions.get(String(body.id || ''));
          if (body.decision === 'always' && pendingEntry && !pendingEntry.suggestions) return json(res, 200, { ok: false });
          // A reason for the agent, or stopping it, needs the desktop key.
          const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : '';
          if ((message || body.interrupt === true) && !keyOk(req)) return res.writeHead(403).end();
          json(res, 200, { ok: settlePermission(String(body.id || ''), body.decision, { message, interrupt: body.interrupt === true }) });
        });
      // The question hook asks the pet, then waits for your answer.
      case 'POST /api/question/ask':
        return readJson(req, (err, body) => json(res, 200, (!err && askQuestion(adapters.normalize(body))) || {}));
      case 'POST /api/question/wait':
        return readJson(req, (err, body) => {
          const id = !err && body ? String(body.id || '') : '';
          if (settledQuestions.has(id)) return json(res, 200, settledQuestions.get(id));
          const entry = questions.get(id);
          if (!entry) return json(res, 200, { answers: null });
          entry.waiters.push(res);
          res.on('close', () => (entry.waiters = entry.waiters.filter((r) => r !== res)));
        });
      case 'POST /api/question/release':
        return readJson(req, (err, body) => json(res, 200, { ok: !err && Boolean(body) && settleQuestion(String(body.id || ''), null) }));
      case 'POST /api/question/answer':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const entry = questions.get(String(body.id || ''));
          const answers = entry ? answersFor(entry, body.answers) : null;
          json(res, 200, { ok: Boolean(answers) && settleQuestion(entry.id, answers) });
        });
      // A message you wrote on the pet, for a conversation.
      case 'POST /api/inbox/send':
        return readJson(req, (err, body) => {
          if (err || !body || typeof body.session !== 'string' || typeof body.text !== 'string') return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const text = body.text.trim();
          if (!text || text.length > MAX_MESSAGE) return json(res, 200, { ok: false, reason: 'length' });
          json(res, 200, sendMessage(body.session.slice(0, 120), text));
        });
      case 'POST /api/inbox/cancel':
        return readJson(req, (err, body) => {
          if (err || !body || typeof body.session !== 'string') return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const had = inbox.delete(body.session);
          pushState(true);
          json(res, 200, { ok: had });
        });
      // The --rewake hook of an idle session waits here for a message.
      case 'POST /api/inbox/wait':
        return readJson(req, (err, body) => {
          const session = !err && body && body.session ? String(body.session) : 'default';
          const waiting = inbox.get(session);
          if (waiting) {
            inbox.delete(session);
            delivered(session);
            return json(res, 200, { text: waiting.text });
          }
          // One listener per session: a newer one replaces the older.
          releaseListener(session);
          listeners.set(session, res);
          res.on('close', () => {
            if (listeners.get(session) !== res) return;
            listeners.delete(session);
            pushState(true);
          });
          pushState(true);
        });
      case 'POST /api/phone/test':
        return phone('Openmon', /^pt/i.test(config.lang || '') ? 'Teste: os alertas no celular funcionam.' : 'Test: phone alerts work.').then((ok) => json(res, 200, { ok }));
      case 'POST /api/focus':
        return readJson(req, (err, body) => {
          if (err) return res.writeHead(400).end();
          focusAgent(body && body.id).then((r) => json(res, 200, r));
        });
      case 'GET /api/backups':
        return json(res, 200, backups ? { dir: backups.dir, lastAt: backups.lastAt(), items: backups.list() } : { dir: null, items: [] });
      case 'POST /api/backup':
        return json(res, 200, { ok: backups ? backups.maybe(real.pet, config, true) : false });
      case 'POST /api/follow':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          const pet = typeof body.pet === 'string' && /^[a-f0-9]{6,32}$/.test(body.pet) ? body.pet : null;
          if (typeof body.session === 'string') return json(res, 200, { ok: pinSession(body.session.slice(0, 120), pet) });
          if (pet && 'project' in body) return json(res, 200, { ok: followProjectWith(pet, typeof body.project === 'string' && body.project ? body.project : null) });
          res.writeHead(400).end();
        });
      case 'GET /api/cloud':
        return json(res, 200, cloudView() || { off: true });
      case 'POST /api/cloud/connect':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : cloudConnect(body && body.method === 'device' ? 'device' : 'gh').then((r) => json(res, 200, r))));
      case 'POST /api/cloud/logout':
        if (cloud) cloud.logout();
        cloudConflict = null;
        pushState(true);
        return json(res, 200, { ok: true });
      case 'POST /api/cloud/sync':
        return readJson(req, (err, body) => {
          if (err) return res.writeHead(400).end();
          const force = body && ['local', 'remote'].includes(body.use) ? body.use : null;
          syncCloud(force).then((r) => json(res, 200, r));
        });
      case 'POST /api/restore':
        return readJson(req, (err, body) => {
          if (err || !backups) return res.writeHead(400).end();
          json(res, 200, restore(backups.read(String((body && body.file) || 'latest'))));
        });
      case 'POST /api/wear':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: change((p) => pet.wear(p, body.slot, body.id ?? null)) })));
      case 'POST /api/use':
        return readJson(req, (err, body) => {
          if (err) return res.writeHead(400).end();
          // A stone another member holds is not free to take.
          const item = String(body.item || '');
          const reserved = world === real ? party.heldByOthers(real.pet)[item] || 0 : 0;
          const events = change((p) => pet.useItem(p, item, now(), reserved, body.lineage ? String(body.lineage) : null));
          // A mystery egg hatches into a new member of the team.
          if (events.some((e) => e.type === 'mystery-egg') && world === real) {
            const hatched = partyAction(() => party.hatchMystery(real.pet, now()));
            pushEvents(hatched);
            events.push(...hatched);
          }
          json(res, 200, { events });
        });
      case 'POST /api/party/active':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          json(res, 200, { ok: makeMain(String(body.id || '')) });
        });
      case 'POST /api/party/move':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          const ok = partyAction(() => party.move(real.pet, String(body.id || ''), body.place));
          // A pet sent to the Box leaves the screen too.
          if (ok && body.place === 'box' && (config.companions || []).includes(body.id)) setConfig({ companions: config.companions.filter((x) => x !== body.id) });
          json(res, 200, { ok });
        });
      // Trading: a member leaves as a code, a code brings one in.
      case 'POST /api/trade/out':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          const id = String(body.id || '');
          const code = partyAction(() => party.tradeOut(real.pet, id, now()));
          if (code && (config.companions || []).includes(id)) setConfig({ companions: config.companions.filter((x) => x !== id) });
          json(res, 200, code ? { ok: true, code } : { ok: false });
        });
      case 'POST /api/trade/cancel':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, partyAction(() => party.tradeCancel(real.pet, String(body.tid || ''))) || { ok: false })));
      case 'POST /api/trade/in':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, partyAction(() => party.tradeIn(real.pet, String(body.code || ''), now())))));
      case 'POST /api/party/rename':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, { events: partyAction(() => party.renameMember(real.pet, String(body.id || ''), body.name)) })));
      case 'POST /api/wild/throw':
        return json(res, 200, { events: wildAction(() => wild.throwBall(party.ensure(real.pet), now(), party.addMember, Math.random, String(new URL(req.url, 'http://x').searchParams.get('ball') || 'openball'))) });
      case 'POST /api/wild/release':
        return json(res, 200, { events: wildAction(() => wild.release(real.pet, now())) });
      case 'POST /api/starter':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, { events: chooseStarter(body.lineage) })));
      case 'POST /api/lay-egg':
        return json(res, 200, { events: layEgg() });
      case 'POST /api/shutdown':
        res.writeHead(204).end();
        bus.emit('shutdown');
        return;
      case 'POST /api/demo':
        return json(res, 200, runDemo(url.searchParams.get('speed')));
      case 'POST /api/demo/stop':
        stopDemo();
        return res.writeHead(204).end();
      case 'POST /api/config':
        return readJson(req, (err, body) => {
          if (err) return res.writeHead(400).end();
          const patch = {};
          if (typeof body.muted === 'boolean') patch.muted = body.muted;
          if (typeof body.notify === 'boolean') patch.notify = body.notify;
          if (typeof body.chatter === 'boolean') patch.chatter = body.chatter;
          if (typeof body.stroll === 'boolean') patch.stroll = body.stroll;
          // Other Openmons of the team standing next to the main one (2 at most).
          if (Array.isArray(body.companions)) patch.companions = [...new Set(body.companions.filter((id) => typeof id === 'string' && /^[a-f0-9]{6,32}$/.test(id)))].slice(0, MAX_COMPANIONS);
          if (typeof body.shareSessions === 'boolean') patch.shareSessions = body.shareSessions;
          if (typeof body.present === 'boolean') patch.present = body.present;
          if (typeof body.lang === 'string' && /^(en|pt-BR|es)$/.test(body.lang)) patch.lang = body.lang;
          if ([0, 50, 90].includes(body.breakEvery)) patch.breakEvery = body.breakEvery;
          if (typeof body.phoneAlerts === 'boolean') patch.phoneAlerts = body.phoneAlerts;
          if (typeof body.phoneProject === 'boolean') patch.phoneProject = body.phoneProject;
          if (typeof body.speak === 'boolean') patch.speak = body.speak;
          if (typeof body.phoneReplies === 'boolean') patch.phoneReplies = body.phoneReplies;
          if (typeof body.phoneTopic === 'string' && (body.phoneTopic === '' || PHONE_TOPIC.test(body.phoneTopic))) patch.phoneTopic = body.phoneTopic;
          if (typeof body.phoneAfterSec === 'number' && body.phoneAfterSec >= 0 && body.phoneAfterSec <= 600) patch.phoneAfterSec = Math.round(body.phoneAfterSec);
          // Turning on "answer from the pet" brings older hooks up to date.
          if (body.answerFromPet === true && hooksInstalled()) upgradeHooks();
          if (typeof body.answerFromPet === 'boolean') patch.answerFromPet = body.answerFromPet;
          if (typeof body.wild === 'boolean') patch.wild = body.wild;
          if (typeof body.hideFullscreen === 'boolean') patch.hideFullscreen = body.hideFullscreen;
          if (typeof body.updateCheck === 'boolean') patch.updateCheck = body.updateCheck;
          if (typeof body.answerWaitSec === 'number' && body.answerWaitSec >= 5 && body.answerWaitSec <= 60) patch.answerWaitSec = Math.round(body.answerWaitSec);
          if (typeof body.scale === 'number' && body.scale >= 0.6 && body.scale <= 1.6) patch.scale = body.scale;
          if (typeof body.tokenLimit === 'number' && body.tokenLimit >= 0 && body.tokenLimit <= 1e10) patch.tokenLimit = Math.round(body.tokenLimit);
          // One-time tips, remembered so they are never shown twice.
          if (typeof body.tipSeen === 'string' && /^[a-z-]{1,24}$/.test(body.tipSeen) && !(config.tips || []).includes(body.tipSeen)) patch.tips = [...(config.tips || []), body.tipSeen].slice(-20);
          if (typeof body.focusMinutes === 'number') patch.focusUntil = body.focusMinutes > 0 ? now() + Math.min(body.focusMinutes, 600) * 60_000 : null;
          if (typeof body.quietMinutes === 'number') patch.quietUntil = body.quietMinutes > 0 ? now() + body.quietMinutes * 60_000 : null;
          setConfig(patch);
          json(res, 200, publicConfig());
        });
      case 'GET /api/state':
        return json(res, 200, state());
      case 'GET /api/species':
        return json(res, 200, localizeSpecies({
          stats: species.STATS,
          statLabels: species.STAT_LABELS,
          stages: species.STAGES,
          lineages: species.LINEAGES,
          baseForms: species.BASE_FORMS,
          starters: species.STARTERS,
          achievements: species.ACHIEVEMENTS,
          natures: species.NATURES,
          weights: species.STAT_WEIGHTS,
          dex: species.dexEntries(),
        }, url.searchParams.get('lang')));
      case 'GET /art/index.json':
        {
          const { files, pack, tints } = listArt(artDirs);
          // The designer's optional files that are there, so pages ask only
          // for those (no stream of 404s for the ones still drawn in code).
          const slots = [];
          for (const dir of ['icons', 'props', 'badges']) {
            try {
              for (const f of fs.readdirSync(path.join(PUBLIC_DIR, dir))) if (f.endsWith('.svg')) slots.push(`${dir}/${f}`);
            } catch {}
          }
          return json(res, 200, { files, pack, tints, slots });
        }
      // ---- The assistant (key holders only: the desktop chat window) ----
      case 'GET /api/chat/stream': {
        const given = Buffer.from(String(url.searchParams.get('key') || ''));
        const want = Buffer.from(contactKey);
        if (given.length !== want.length || !require('node:crypto').timingSafeEqual(given, want)) return res.writeHead(403).end();
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(': hello\n\n');
        chatClients.add(res);
        const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => {
          clearInterval(keepAlive);
          chatClients.delete(res);
        });
        return;
      }
      case 'GET /api/chats': {
        if (!keyOk(req)) return res.writeHead(403).end();
        const q = url.searchParams.get('q');
        return json(res, 200, q ? { ...chatList(), hits: assistant.search(q) } : chatList());
      }
      // Openmon's tools, called by Claude through src/mcp.js (their own key).
      case 'POST /api/assistant/tool':
        return readJson(req, (err, body) => {
          const given = Buffer.from(String(req.headers['x-openmon-tool-key'] || ''));
          const want = Buffer.from(toolKey);
          if (given.length !== want.length || !require('node:crypto').timingSafeEqual(given, want)) return res.writeHead(403).end();
          if (err || !body || typeof body.name !== 'string') return res.writeHead(400).end();
          let r;
          try {
            r = runTool(body.name, body.args && typeof body.args === 'object' ? body.args : {});
          } catch (e) {
            r = { ok: false, error: e.message };
          }
          json(res, 200, r);
        });
      case 'POST /api/chat/quick':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          json(res, 200, quickChat(chatInput(body)));
        });
      case 'POST /api/chat/model':
      case 'POST /api/chat/pin':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const id = String(body.id || '');
          if (route.endsWith('model')) return json(res, 200, { ok: assistant.setModel(id, body.model || null) });
          json(res, 200, { ok: assistant.pin(id, body.pinned) });
        });
      case 'GET /api/chat/markdown': {
        if (!keyOk(req)) return res.writeHead(403).end();
        const md = assistant.markdown(String(url.searchParams.get('id') || ''));
        return md ? json(res, 200, { markdown: md }) : json(res, 200, { gone: true });
      }
      case 'POST /api/assistant/memory/add':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          json(res, 200, { ok: rememberFact(body.fact) });
        });
      case 'GET /api/chat': {
        if (!keyOk(req)) return res.writeHead(403).end();
        const chat = assistant.get(String(url.searchParams.get('id') || ''));
        if (!chat) return json(res, 200, { gone: true });
        return json(res, 200, config.present ? { ...chat, messages: [], present: true } : chat);
      }
      case 'GET /api/chat/agent':
        if (!keyOk(req)) return res.writeHead(403).end();
        return json(res, 200, agentView(String(url.searchParams.get('session') || '').slice(0, 120)));
      case 'POST /api/chat/new':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const cwd = typeof body.cwd === 'string' && body.cwd ? body.cwd : assistantFolder(true);
          if (cwd === assistantFolder()) assistantFolder(true);
          json(res, 200, assistant.create({ cwd, ...chatInput(body) }));
        });
      case 'POST /api/chat/send':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          json(res, 200, assistant.send(String(body.id || ''), chatInput(body)));
        });
      // A conversation from the terminal, continued here (Claude Code
      // resumes it; if it still runs there, it starts a copy and says so).
      case 'POST /api/chat/continue':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const session = String(body.session || '');
          const t = transcripts.get(session);
          const mine = assistant.bySession(session);
          if (mine) return json(res, 200, { ok: true, id: mine.id });
          if (!t || !t.cwd) return json(res, 200, { ok: false, reason: 'unknown' });
          json(res, 200, assistant.create({ cwd: t.cwd, sessionId: session, resume: true, title: path.basename(t.cwd), seed: readTranscript(t.file) || [], ...chatInput(body) }));
        });
      case 'POST /api/chat/stop':
      case 'POST /api/chat/delete':
      case 'POST /api/chat/rename':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const id = String(body.id || '');
          if (route.endsWith('stop')) return json(res, 200, { ok: assistant.stop(id) });
          if (route.endsWith('delete')) return json(res, 200, { ok: assistant.remove(id) });
          json(res, 200, { ok: assistant.rename(id, body.title) });
        });
      case 'GET /api/assistant/memory': {
        if (!keyOk(req)) return res.writeHead(403).end();
        const file = path.join(assistantFolder(true), 'CLAUDE.md');
        let text = '';
        try {
          text = fs.readFileSync(file, 'utf8');
        } catch {}
        return json(res, 200, { path: file, text });
      }
      case 'POST /api/assistant/memory':
        return readJson(req, (err, body) => {
          if (err || !body || typeof body.text !== 'string' || body.text.length > 20000) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          try {
            fs.writeFileSync(path.join(assistantFolder(true), 'CLAUDE.md'), body.text);
            json(res, 200, { ok: true });
          } catch (e) {
            json(res, 200, { ok: false, error: e.message });
          }
        });
      // Settings of the assistant that reach Claude, so the key is needed.
      case 'POST /api/assistant/config':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const patch = {};
          if (body.quickActions === null) patch.quickActions = null;
          else if (Array.isArray(body.quickActions)) patch.quickActions = body.quickActions.filter((a) => a && typeof a.label === 'string' && typeof a.prompt === 'string' && a.label.trim() && a.prompt.trim()).slice(0, 12).map((a) => ({ label: a.label.trim().slice(0, 40), prompt: a.prompt.trim().slice(0, 2000) }));
          if (typeof body.assistantFolder === 'string' && (body.assistantFolder === '' || path.isAbsolute(body.assistantFolder))) patch.assistantFolder = body.assistantFolder;
          if (typeof body.phoneReplies === 'boolean') patch.phoneReplies = body.phoneReplies;
          setConfig(patch);
          json(res, 200, publicConfig());
        });
      case 'GET /api/schedule':
        if (!keyOk(req)) return res.writeHead(403).end();
        return json(res, 200, { items: schedule.list() });
      case 'POST /api/schedule/add':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          const cwd = body.kind === 'task' ? (typeof body.cwd === 'string' && body.cwd ? body.cwd : assistantFolder(true)) : null;
          const r = schedule.add({ kind: body.kind, text: body.text, cwd, when: body.when });
          pushState(true);
          json(res, 200, r);
        });
      case 'POST /api/schedule/remove':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          if (!keyOk(req)) return res.writeHead(403).end();
          json(res, 200, { ok: schedule.remove(String(body.id || '')) });
        });
      case 'GET /health':
        return json(res, 200, { app: 'openmon', clients: clients.size });
      case 'GET /stream': {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(state())}\n\n`);
        clients.add(res);
        if (url.searchParams.get('talk') === '1') talkers.add(res);
        const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => {
          clearInterval(keepAlive);
          clients.delete(res);
          talkers.delete(res);
        });
        return;
      }
      default:
        break;
    }

    if (dev && req.method === 'POST' && url.pathname.startsWith('/api/dev/')) {
      const action = dev[url.pathname.slice('/api/dev/'.length)];
      if (!action) return res.writeHead(404).end();
      return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: action(body) || [] })));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/brand/')) {
      const name = decodePath(url.pathname.slice(7));
      if (!name || !BRAND_FILE.test(name)) return res.writeHead(404).end();
      const full = path.join(BRAND_DIR, name);
      if (!fs.existsSync(full)) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name).toLowerCase()], 'Cache-Control': 'max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      return fs.createReadStream(full).pipe(res);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/art/')) {
      const name = decodePath(url.pathname.slice(5));
      const dir = name && ART_FILE.test(name) ? listArt(artDirs).where[name] : null;
      const full = dir ? path.join(dir, name) : null;
      if (!full) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      return fs.createReadStream(full).pipe(res);
    }

    if (req.method === 'GET') {
      const file = url.pathname === '/' ? 'index.html' : decodePath(url.pathname.slice(1));
      const full = file ? path.join(PUBLIC_DIR, file) : '';
      if (!full.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return res.writeHead(404).end();
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(full).pipe(res);
    }
    res.writeHead(405).end();
  }

  return {
    bus,
    ingest,
    focusAgent,
    // Allow / Deny from a system notification's buttons.
    decidePermission: (id, decision) => settlePermission(id, decision),
    recheckHooks,
    setFocus,
    restoreFile,
    exportTo,
    backupNow: () => (backups ? backups.maybe(real.pet, config, true) : false),
    backupDir: () => (backups ? backups.dir : null),
    layEgg,
    runDemo,
    stopDemo,
    setConfig,
    makeMain,
    setQuiet,
    state,
    config: publicConfig,
    contactKey: () => contactKey,
    assistant,
    schedule,
    // The assistant's folder (made, with its memory, the first time).
    assistantFolder: () => assistantFolder(true),
    upgradeHooks: () => !playground && config.answerFromPet && upgradeHooks(),
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server.address().port));
      }),
    close: () =>
      new Promise((resolve) => {
        stopDemo();
        clearInterval(ticker);
        assistant.killAll();
        if (phoneIn) phoneIn.destroy();
        for (const res of chatClients) res.end();
        clearInterval(cloudTimer);
        store.flush();
        if (backups && !restoreOffer && !playground) backups.maybe(real.pet, config, true);
        for (const res of clients) res.end();
        // The last few minutes go to GitHub too, if it answers quickly.
        const last = cloud && cloud.connected() && !cloudConflict ? Promise.race([syncCloud(), new Promise((r) => setTimeout(r, 3000))]) : Promise.resolve();
        last.catch(() => {}).then(() => server.close(() => resolve()));
      }),
  };
}

module.exports = { createDaemon, DEFAULT_PORT };
