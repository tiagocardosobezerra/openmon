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
const { createUsage } = require('./usage');
const adapters = require('./adapters');
const { createBackups, unwrap } = require('./backup');
const { createPowers, unlockedPowers } = require('./powers');

// ntfy.sh topics: letters, digits, _ and -, long enough to be private.
const PHONE_TOPIC = /^[A-Za-z0-9_-]{8,64}$/;
const DEFAULT_PORT = Number(process.env.OPENMON_PORT) || 4747;
const MAX_BODY = 2 * 1024 * 1024;
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
const ART_FILE = /^[a-z0-9-]+(.shiny)?(.night)?(@[a-z]+)?.(png|svg|webp)$/;

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
    return { files, pack };
  } catch {
    return { files: [], pack: null };
  }
}

// Returns { files, pack, where: name -> folder }, user folder first.
function listArt(dirs) {
  const where = {};
  let pack = null;
  for (const dir of dirs) {
    const p = readPack(dir);
    for (const f of p.files) if (!where[f]) where[f] = dir;
    if (!pack && p.files.length) pack = p.pack;
  }
  return { files: Object.keys(where).sort(), pack, where };
}

function createDaemon({ port = DEFAULT_PORT, store = createStore(), now = Date.now, log = () => {}, hooksInstalled = () => installer.isInstalled(), artDir = path.join(homeDir(), 'art'), bundledArt = process.env.OPENMON_CLASSIC === '1' ? null : BUNDLED_ART, playground = false, configFile = playground ? null : path.join(homeDir(), 'config.json'), focus = createFocus(), backups = playground ? null : createBackups({ now }) } = {}) {
  const artDirs = [artDir, bundledArt].filter(Boolean);
  const bus = new EventEmitter();
  const powers = createPowers();
  const usage = createUsage();
  const lastEventOf = new Map();
  const clients = new Set();
  // A brand-new pet file: if a backup exists, offer to bring that pet back.
  const freshInstall = Boolean(store.file) && !fs.existsSync(store.file);
  const real = createWorld(party.ensure(store.load()));
  let restoreOffer = freshInstall && backups ? backups.latest() : null;
  let world = real;
  // Settings live in ~/.openmon/config.json, so they survive restarts.
  const DEFAULTS = { muted: false, notify: true, chatter: true, stroll: true, followProject: false, focusUntil: null, present: false, breakEvery: 0, phoneAlerts: false, phoneTopic: '', phoneProject: false, phoneAfterSec: 60, quietUntil: null, scale: 1, tips: [], answerFromPet: false, answerWaitSec: 25 };
  let config = { ...DEFAULTS };
  try {
    if (configFile) config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configFile, 'utf8')) };
  } catch {}
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
    return { ...s, live, pet: petView, party: partyView, permissions: (s.permissions || []).map((p) => ({ ...p, label: alias(p.label), detail: null })), present: true };
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
      config: publicConfig(),
      restoreOffer: restoreOffer ? restoreOffer.summary : null,
      permissions: permissionView(),
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
      for (const p of [...permissions.values()]) if (p.session === signal.session && (signal.kind === 'tool-start' || signal.kind === 'tool-done' || signal.kind === 'tool-fail' || signal.kind === 'turn-start' || signal.kind === 'turn-end')) settlePermission(p.id, null);
    }
    const t = now();
    if (target === real) {
      powers.record(payload, signal.label, t);
      if (signal.kind === 'session-end') focus.forget(signal.session);
    }
    const ctx = target.sessions.apply(signal, t);
    // The real pet routes work to the pet of each project (Party); the demo
    // pet is a single egg.
    const events = target === real ? party.applySignal(real.pet, signal, ctx, t) : pet.applySignal(target.pet, signal, ctx, t);
    if (target === real) followProject(signal, t, events);
    if (target === real) events.push(...target.sessions.takeNotices());
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
      if (delta) events.push(...pet.addTokens(real.pet, delta, t));
    }
    if (target === real) persist(events.some((e) => e.type === 'evolve'));
    log(`${signal.kind.padEnd(14)} ${signal.label}${signal.detail ? ` · ${signal.detail}` : ''}`);
    return events;
  }

  // "Show the pet of the project your agent is working in": switches the pet
  // on screen to that project's own pet (at most every 20 s).
  let lastFollow = 0;
  function followProject(signal, t, events) {
    if (!config.followProject || signal.kind !== 'tool-start' || t - lastFollow < 20_000) return;
    const target = party.petFor(real.pet, signal.label || null);
    if (target === real.pet || target.place !== 'party') return;
    real.pet = party.setActive(real.pet, target.id);
    lastFollow = t;
    events.push({ type: 'switched', project: target.project });
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

  function askPermission(body, signal) {
    if (!config.answerFromPet || !body._permission || !clients.size || world !== real) return null;
    // Unguessable, so only the pet that shows the request can answer it.
    const id = require('node:crypto').randomBytes(12).toString('hex');
    const waitMs = (config.answerWaitSec || 25) * 1000;
    // Claude Code's own suggestions ("allow this from now on") make the
    // "Always allow" button possible.
    const suggestions = Array.isArray(body.permission_suggestions) && body.permission_suggestions.length ? body.permission_suggestions : null;
    const entry = { id, session: signal ? signal.session : String(body.session_id || 'default'), label: signal ? signal.label : null, detail: signal ? signal.detail : null, until: now() + waitMs, waiters: [], decision: null, suggestions };
    entry.timer = setTimeout(() => settlePermission(id, null), waitMs + 500);
    if (entry.timer.unref) entry.timer.unref();
    permissions.set(id, entry);
    pushState(true);
    return { id, waitMs };
  }

  function settlePermission(id, decision) {
    const entry = permissions.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    permissions.delete(id);
    entry.decision = decision;
    const forget = setTimeout(() => settled.delete(id), 30_000);
    if (forget.unref) forget.unref();
    const reply = decision === 'always' ? { decision: 'allow', updatedPermissions: entry.suggestions || [] } : { decision };
    settled.set(id, reply);
    for (const res of entry.waiters) json(res, 200, reply);
    pushState(true);
    return true;
  }

  function permissionView() {
    return [...permissions.values()].map((p) => ({ id: p.id, session: p.session, label: p.label, detail: p.detail, until: p.until, canAlways: Boolean(p.suggestions) }));
  }

  // Brings the window of a waiting agent (or the given session) to the front.
  function focusAgent(id) {
    const live = real.sessions.snapshot(now());
    const target = typeof id === 'string' && id ? id : live.focus && live.focus.id;
    if (!target) return Promise.resolve({ ok: false, reason: 'unknown' });
    return focus.focus(target);
  }

  function petIt() {
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

  function layEgg() {
    const old = real.pet;
    const { pet: egg, events } = pet.layEgg(old, now());
    if (!events.length) return events;
    // The new egg takes the retired pet's place: same project, same party.
    Object.assign(egg, { project: old.project ?? null, place: 'party', others: old.others || [], projects: old.projects || {}, journal: old.journal, streak: old.streak, gifts: old.gifts, dexRegions: old.dexRegions });
    real.pet = party.ensure(egg);
    persist(true);
    pushEvents(events);
    pushState(true);
    return events;
  }

  function persist(force = false) {
    store.save(real.pet);
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

  const ticker = setInterval(() => {
    world.sessions.tick(now());
    checkBreak();
    checkPhone();
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

  function readJson(req, cb) {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        cb(null, chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (err) {
        cb(err);
      }
    });
  }

  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  const server = http.createServer((req, res) => {
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
          const reply = {};
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
        return json(res, 200, { events: petIt() });
      case 'POST /api/rename':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: rename(body.name) })));
      case 'GET /api/powers':
        {
          const v = pet.view(world.pet);
          if (config.present) return json(res, 200, { unlocked: unlockedPowers(world.pet), today: v.today, journal: v.journal.map((e) => ({ ...e, projects: {}, agentMs: {} })), streak: v.streak, sessions: [], present: true });
          return json(res, 200, { unlocked: unlockedPowers(world.pet), today: v.today, journal: v.journal, streak: v.streak, sessions: powers.view() });
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
      case 'POST /api/permission/decide':
        return readJson(req, (err, body) => {
          if (err || !body || !['allow', 'deny', 'always'].includes(body.decision)) return res.writeHead(400).end();
          const pendingEntry = permissions.get(String(body.id || ''));
          if (body.decision === 'always' && pendingEntry && !pendingEntry.suggestions) return json(res, 200, { ok: false });
          json(res, 200, { ok: settlePermission(String(body.id || ''), body.decision) });
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
      case 'POST /api/restore':
        return readJson(req, (err, body) => {
          if (err || !backups) return res.writeHead(400).end();
          json(res, 200, restore(backups.read(String((body && body.file) || 'latest'))));
        });
      case 'POST /api/wear':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: change((p) => pet.wear(p, body.slot, body.id ?? null)) })));
      case 'POST /api/use':
        return readJson(req, (err, body) => (err ? res.writeHead(400).end() : json(res, 200, { events: change((p) => pet.useItem(p, String(body.item || ''), now())) })));
      case 'POST /api/party/active':
        return readJson(req, (err, body) => {
          if (err || !body) return res.writeHead(400).end();
          json(res, 200, { ok: partyAction(() => {
            const before = real.pet.id;
            real.pet = party.setActive(real.pet, String(body.id || ''));
            return real.pet.id !== before;
          }) });
        });
      case 'POST /api/party/move':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, { ok: partyAction(() => party.move(real.pet, String(body.id || ''), body.place)) })));
      case 'POST /api/party/rename':
        return readJson(req, (err, body) => (err || !body ? res.writeHead(400).end() : json(res, 200, { events: partyAction(() => party.renameMember(real.pet, String(body.id || ''), body.name)) })));
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
          if (typeof body.followProject === 'boolean') patch.followProject = body.followProject;
          if (typeof body.present === 'boolean') patch.present = body.present;
          if (typeof body.lang === 'string' && /^(en|pt-BR|es)$/.test(body.lang)) patch.lang = body.lang;
          if ([0, 50, 90].includes(body.breakEvery)) patch.breakEvery = body.breakEvery;
          if (typeof body.phoneAlerts === 'boolean') patch.phoneAlerts = body.phoneAlerts;
          if (typeof body.phoneProject === 'boolean') patch.phoneProject = body.phoneProject;
          if (typeof body.phoneTopic === 'string' && (body.phoneTopic === '' || PHONE_TOPIC.test(body.phoneTopic))) patch.phoneTopic = body.phoneTopic;
          if (typeof body.phoneAfterSec === 'number' && body.phoneAfterSec >= 0 && body.phoneAfterSec <= 600) patch.phoneAfterSec = Math.round(body.phoneAfterSec);
          // Turning on "answer from the pet" brings older hooks up to date.
          if (body.answerFromPet === true && hooksInstalled() && !installer.hasPermissionHook()) {
            try {
              installer.install();
            } catch {}
          }
          if (typeof body.answerFromPet === 'boolean') patch.answerFromPet = body.answerFromPet;
          if (typeof body.answerWaitSec === 'number' && body.answerWaitSec >= 5 && body.answerWaitSec <= 60) patch.answerWaitSec = Math.round(body.answerWaitSec);
          if (typeof body.scale === 'number' && body.scale >= 0.6 && body.scale <= 1.6) patch.scale = body.scale;
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
          achievements: species.ACHIEVEMENTS,
          natures: species.NATURES,
          weights: species.STAT_WEIGHTS,
          dex: species.dexEntries(),
        }, url.searchParams.get('lang')));
      case 'GET /art/index.json':
        {
          const { files, pack } = listArt(artDirs);
          return json(res, 200, { files, pack });
        }
      case 'GET /health':
        return json(res, 200, { app: 'openmon', clients: clients.size });
      case 'GET /stream': {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(state())}\n\n`);
        clients.add(res);
        const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => {
          clearInterval(keepAlive);
          clients.delete(res);
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
      const name = decodeURIComponent(url.pathname.slice(7));
      const full = path.join(BRAND_DIR, name);
      if (!BRAND_FILE.test(name) || !fs.existsSync(full)) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name).toLowerCase()], 'Cache-Control': 'max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      return fs.createReadStream(full).pipe(res);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/art/')) {
      const name = decodeURIComponent(url.pathname.slice(5));
      const dir = ART_FILE.test(name) ? listArt(artDirs).where[name] : null;
      const full = dir ? path.join(dir, name) : null;
      if (!full) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      return fs.createReadStream(full).pipe(res);
    }

    if (req.method === 'GET') {
      const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const full = path.join(PUBLIC_DIR, file);
      if (!full.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return res.writeHead(404).end();
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(full).pipe(res);
    }
    res.writeHead(405).end();
  });

  return {
    server,
    bus,
    ingest,
    petIt,
    focusAgent,
    recheckHooks,
    setFocus,
    restoreFile,
    exportTo,
    backupNow: () => (backups ? backups.maybe(real.pet, config, true) : false),
    backupDir: () => (backups ? backups.dir : null),
    rename,
    layEgg,
    runDemo,
    stopDemo,
    setConfig,
    setQuiet,
    state,
    config: publicConfig,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server.address().port));
      }),
    close: () =>
      new Promise((resolve) => {
        stopDemo();
        clearInterval(ticker);
        store.flush();
        if (backups && !restoreOffer && !playground) backups.maybe(real.pet, config, true);
        for (const res of clients) res.end();
        server.close(() => resolve());
      }),
  };
}

module.exports = { createDaemon, DEFAULT_PORT };
