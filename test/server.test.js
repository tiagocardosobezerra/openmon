'use strict';

// End to end: real daemon on a random port, real hook script as a child
// process, SSE client reading what renderers would see.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
// Never touch the real ~/.openmon or the backups in Documents.
process.env.OPENMON_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-test-home-'));
const { createDaemon } = require('../src/server');
const { createStore } = require('../src/store');
const { createFocus } = require('../src/focus');

const HOOK = path.join(__dirname, '..', 'src', 'hook.js');

async function boot({ focus = createFocus({ driver: null }) } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-home-'));
  const store = createStore({ dir, delay: 10 });
  const artDir = path.join(dir, 'art');
  fs.mkdirSync(artDir);
  fs.writeFileSync(path.join(artDir, 'craft-adult.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(artDir, 'notes.txt'), 'not art');
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, artDir, bundledArt: null, configFile: path.join(dir, 'config.json'), focus });
  const port = await daemon.listen();
  return { daemon, port, dir, store };
}

function runHook(port, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK, '--openmon'], { env: { ...process.env, OPENMON_PORT: String(port) } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('exit', (code) => resolve({ code, out }));
    child.stdin.end(JSON.stringify(payload));
  });
}

function request(port, method, pathname, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('hook to daemon to state, and the pet is saved', async () => {
  const { daemon, port, store } = await boot();
  try {
    const base = { session_id: 'abc', cwd: '/w/shop', tool_name: 'Edit', tool_input: { file_path: 'x.js' } };
    const r1 = await runHook(port, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'go' });
    assert.deepEqual(r1, { code: 0, out: '' });
    await runHook(port, { ...base, hook_event_name: 'PostToolUse' });
    const state = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(state.live.pose, 'working');
    assert.equal(state.live.sessions[0].label, 'shop');
    assert.equal(state.pet.stats.craft, 1);
    store.flush();
    assert.equal(JSON.parse(fs.readFileSync(store.file, 'utf8')).stats.craft, 1);
  } finally {
    await daemon.close();
  }
});

test('hook exits 0 silently when no daemon runs', async () => {
  const r = await runHook(1, { hook_event_name: 'Stop', session_id: 'x' });
  assert.deepEqual(r, { code: 0, out: '' });
});

test('other web pages cannot feed the pet', async () => {
  const { daemon, port } = await boot();
  try {
    const evil = await request(port, 'POST', '/event', { body: '{"hook_event_name":"Stop","session_id":"x"}', headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    const rebound = await request(port, 'GET', '/api/state', { headers: { Host: 'evil.example' } });
    assert.equal(rebound.status, 403);
    const same = await request(port, 'POST', '/api/pet', { headers: { Origin: `http://127.0.0.1:${port}` } });
    assert.equal(same.status, 200);
  } finally {
    await daemon.close();
  }
});

test('SSE stream sends state, then events', async () => {
  const { daemon, port } = await boot();
  try {
    const messages = [];
    const got = new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port, path: '/stream' }, (res) => {
        let buf = '';
        res.on('data', (d) => {
          buf += d;
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            if (chunk.startsWith('data: ')) messages.push(JSON.parse(chunk.slice(6)));
            if (messages.some((m) => m.type === 'events')) {
              res.destroy();
              resolve();
            }
          }
        });
      });
    });
    await new Promise((r) => setTimeout(r, 50));
    await request(port, 'POST', '/api/pet');
    await got;
    assert.equal(messages[0].type, 'state');
    assert.ok(messages.find((m) => m.type === 'events').events.some((e) => e.type === 'petted'));
  } finally {
    await daemon.close();
  }
});

test('demo plays on a throwaway pet', async () => {
  const { daemon, port } = await boot();
  try {
    await request(port, 'POST', '/api/demo');
    assert.equal(daemon.state().demo, true);
    assert.equal(daemon.state().pet.stage, 'egg');
    daemon.stopDemo();
    assert.equal(daemon.state().demo, false);
    assert.equal(daemon.state().pet.xp, 0);
  } finally {
    await daemon.close();
  }
});

test('species API serves the Opendex; shutdown is announced on the bus', async () => {
  const { daemon, port } = await boot();
  try {
    const species = JSON.parse((await request(port, 'GET', '/api/species')).body);
    assert.equal(species.dex.length, 40);
    assert.equal(species.dex[36].name, 'Chromancer');
    assert.equal(species.dex[3].name, 'Forgemaw');
    assert.ok(species.natures.cheeky);
    const state = daemon.state();
    assert.ok(state.pet.nature);
    assert.equal(state.pet.dexNo, 1);
    const down = new Promise((resolve) => daemon.bus.once('shutdown', resolve));
    assert.equal((await request(port, 'POST', '/api/shutdown')).status, 204);
    await down;
    // Lay-egg is refused before Mythic.
    assert.deepEqual(JSON.parse((await request(port, 'POST', '/api/lay-egg')).body).events, []);
  } finally {
    await daemon.close();
  }
});

test('art packs: only form images are listed and served', async () => {
  const { daemon, port } = await boot();
  try {
    const index = JSON.parse((await request(port, 'GET', '/art/index.json')).body);
    assert.deepEqual(index.files, ['craft-adult.svg']);
    assert.equal((await request(port, 'GET', '/art/craft-adult.svg')).status, 200);
    assert.equal((await request(port, 'GET', '/art/notes.txt')).status, 404);
    assert.equal((await request(port, 'GET', '/art/..%2Fpet.json')).status, 404);
  } finally {
    await daemon.close();
  }
});

test('species can be served in Brazilian Portuguese', async () => {
  const { daemon, port } = await boot();
  try {
    const pt = JSON.parse((await request(port, 'GET', '/api/species?lang=pt-BR')).body);
    assert.equal(pt.statLabels.craft, 'Forja');
    assert.equal(pt.natures.cheeky.label, 'Atrevida');
    assert.equal(pt.achievements.hatch.title, 'Olá, mundo');
    assert.equal(pt.dex[3].name, 'Forgemaw');
    assert.match(pt.dex[3].text, /bigorna/);
    const en = JSON.parse((await request(port, 'GET', '/api/species')).body);
    assert.equal(en.statLabels.craft, 'Craft');
  } finally {
    await daemon.close();
  }
});

test('playground actions exist only on a playground daemon', async () => {
  const { daemon, port } = await boot();
  try {
    assert.notEqual((await request(port, 'POST', '/api/dev/evolve', { body: '{}' })).status, 200);
  } finally {
    await daemon.close();
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-play-'));
  const play = createDaemon({ port: 0, store: createStore({ dir, delay: 10 }), hooksInstalled: () => true, playground: true });
  const p = await play.listen();
  try {
    const post = async (action, body) => JSON.parse((await request(p, 'POST', `/api/dev/${action}`, { body: JSON.stringify(body) })).body).events;
    let events = await post('evolve', { stage: 'adult', lineage: 'shell', trait: 'lore', shiny: true });
    assert.ok(events.some((e) => e.type === 'evolve' && e.to === 'Voltcrab'));
    assert.equal(play.state().pet.shiny, true);
    events = await post('evolve', { stage: 'adult', chimera: ['roam', 'swarm'] });
    assert.ok(events.some((e) => e.type === 'evolve' && e.to === 'Chimera'));
    events = await post('evolve', { stage: 'mythic', lineage: 'test', nocturne: true });
    assert.ok(events.some((e) => e.type === 'evolve' && e.to === 'Aegis'));
    assert.equal(play.state().pet.nocturne, true);
    events = await post('level', {});
    assert.ok(events.some((e) => e.type === 'level'));
    await post('signal', { kind: 'attention', reason: 'permission', detail: 'Allow Bash: npm test?' });
    assert.equal(play.state().live.pose, 'attention');
    await post('nearHatch', {});
    assert.equal(play.state().pet.stage, 'egg');
  } finally {
    await play.close();
  }
});

test('the official art ships by default and a user pack overrides it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-art-'));
  const artDir = path.join(dir, 'art');
  fs.mkdirSync(artDir);
  fs.writeFileSync(path.join(artDir, 'craft-adult.svg'), '<svg xmlns="http://www.w3.org/2000/svg" id="mine"/>');
  const daemon = createDaemon({ port: 0, store: createStore({ dir, delay: 10 }), hooksInstalled: () => true, artDir, configFile: path.join(dir, 'config.json') });
  const port = await daemon.listen();
  try {
    const index = JSON.parse((await request(port, 'GET', '/art/index.json')).body);
    assert.ok(index.files.includes('egg.svg'));
    assert.ok(index.files.length >= 22);
    assert.match((await request(port, 'GET', '/art/craft-adult.svg')).body, /id="mine"/);
    assert.match((await request(port, 'GET', '/art/lore-adult.svg')).body, /<svg/);
  } finally {
    await daemon.close();
  }
});

test('powers API: logs real agent work and lists unlocked powers', async () => {
  const { daemon, port } = await boot();
  try {
    daemon.ingest({ session_id: 'p', cwd: '/w/x', hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: '/w/x/a.js', old_string: 'a', new_string: 'b' } });
    const body = JSON.parse((await request(port, 'GET', '/api/powers')).body);
    assert.deepEqual(body.unlocked, []);
    assert.equal(body.sessions[0].craft[0].name, 'a.js');
    assert.equal(body.today.waitMs, 0);
  } finally {
    await daemon.close();
  }
});

test('a finished turn carries its recap in the state', async () => {
  const { daemon } = await boot();
  try {
    const base = { session_id: 'r', cwd: '/w/shop' };
    daemon.ingest({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'go' });
    daemon.ingest({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: 'x.js', content: 'a' } });
    daemon.ingest({ ...base, hook_event_name: 'Stop' });
    const live = daemon.state().live;
    assert.equal(live.pose, 'done');
    assert.equal(live.focus.recap.files, 1);
  } finally {
    await daemon.close();
  }
});

test('settings persist across restarts; quiet mode expires', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-cfg-'));
  const configFile = path.join(dir, 'config.json');
  let t = 1_000_000;
  const make = () => createDaemon({ port: 0, store: createStore({ dir, delay: 10 }), hooksInstalled: () => true, configFile, now: () => t, bundledArt: null });
  const a = make();
  a.setConfig({ muted: true });
  a.setQuiet(30);
  assert.equal(a.config().quiet, true);
  await a.close();
  const b = make();
  assert.equal(b.config().muted, true);
  assert.equal(b.config().quiet, true);
  t += 31 * 60_000;
  assert.equal(b.config().quiet, false);
  await b.close();
});

test('click to answer: the hook is asked for its window once, then focus raises it', async () => {
  const raised = [];
  const driver = { find: async () => null, raise: async (win) => (raised.push(win.pid), true) };
  const { daemon, port } = await boot({ focus: createFocus({ driver }) });
  try {
    const ev = (extra) => JSON.stringify({ session_id: 'win1', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm publish' }, cwd: '/tmp/proj', ...extra });
    const json = { 'Content-Type': 'application/json' };
    // Without a parent pid there is nothing to look up.
    assert.equal((await request(port, 'POST', '/event', { body: ev(), headers: json })).status, 204);
    const first = await request(port, 'POST', '/event', { body: ev({ _ppid: 1234 }), headers: json });
    assert.deepEqual(JSON.parse(first.body), { findWindow: true });
    assert.equal((await request(port, 'POST', '/event', { body: ev({ _ppid: 1234 }), headers: json })).status, 204);
    await request(port, 'POST', '/api/window', { body: JSON.stringify({ session_id: 'win1', window: { pid: 5150, app: 'WindowsTerminal' } }), headers: json });
    // No id: the waiting agent.
    const r = await request(port, 'POST', '/api/focus', { body: '{}', headers: json });
    assert.deepEqual(JSON.parse(r.body), { ok: true, app: 'WindowsTerminal' });
    assert.deepEqual(raised, [5150]);
  } finally {
    await daemon.close();
  }
});

test('a fresh install that finds a backup offers to bring the pet back', async () => {
  const { createBackups } = require('../src/backup');
  const pet = require('../src/pet');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-fresh-'));
  const backups = createBackups({ dir: path.join(dir, 'backups') });
  const old = pet.createPet(Date.now(), 'Rex');
  old.stage = 'adult';
  old.lineage = 'lore';
  old.xp = 5000;
  backups.maybe(old, { scale: 1.25 }, true);
  const daemon = createDaemon({ port: 0, store: createStore({ dir: path.join(dir, 'home'), delay: 10 }), hooksInstalled: () => true, configFile: path.join(dir, 'config.json'), backups });
  const port = await daemon.listen();
  try {
    const json = { 'Content-Type': 'application/json' };
    const before = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(before.restoreOffer.name, 'Rex');
    assert.equal(before.restoreOffer.form, 'Scrollwyrm');
    const r = JSON.parse((await request(port, 'POST', '/api/restore', { body: '{}', headers: json })).body);
    assert.equal(r.ok, true);
    const after = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(after.pet.name, 'Rex');
    assert.equal(after.restoreOffer, null);
    assert.equal(after.config.scale, 1.25);
  } finally {
    await daemon.close();
  }
});

test('answer permissions from the pet: Allow and Deny reach Claude Code; off means silence', async () => {
  const { daemon, port } = await boot();
  // A pet window is open (an SSE client), like on the desktop.
  const stream = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream' }, resolve));
  const json = { 'Content-Type': 'application/json' };
  const ask = { session_id: 'perm1', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm publish' }, cwd: '/tmp/shop' };
  const runPermissionHook = () =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [HOOK, '--openmon', '--permission'], { env: { ...process.env, OPENMON_PORT: String(port) } });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('exit', (code) => resolve({ code, out }));
      child.stdin.end(JSON.stringify(ask));
    });
  const pendingId = async () => {
    for (let i = 0; i < 50; i++) {
      const s = JSON.parse((await request(port, 'GET', '/api/state')).body);
      if (s.permissions.length) return s.permissions[0].id;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('no pending permission');
  };
  try {
    // Off (the default): the hook prints nothing and returns at once.
    let r = await runPermissionHook();
    assert.equal(r.code, 0);
    assert.equal(r.out, '');

    await request(port, 'POST', '/api/config', { body: JSON.stringify({ answerFromPet: true, answerWaitSec: 10 }), headers: json });
    for (const decision of ['allow', 'deny']) {
      const hook = runPermissionHook();
      const id = await pendingId();
      assert.match(id, /^[0-9a-f]{24}$/);
      // A wrong id changes nothing.
      assert.equal(JSON.parse((await request(port, 'POST', '/api/permission/decide', { body: JSON.stringify({ id: 'nope', decision }), headers: json })).body).ok, false);
      await request(port, 'POST', '/api/permission/decide', { body: JSON.stringify({ id, decision }), headers: json });
      r = await hook;
      assert.equal(r.code, 0);
      const out = JSON.parse(r.out);
      assert.equal(out.hookSpecificOutput.hookEventName, 'PermissionRequest');
      assert.equal(out.hookSpecificOutput.decision.behavior, decision);
    }
  } finally {
    stream.destroy();
    await daemon.close();
  }
});

test('"Always allow" hands back Claude Code\'s own suggested rule', async () => {
  const { daemon, port } = await boot();
  const stream = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream' }, resolve));
  const json = { 'Content-Type': 'application/json' };
  const suggestion = { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' };
  try {
    await request(port, 'POST', '/api/config', { body: JSON.stringify({ answerFromPet: true, answerWaitSec: 10 }), headers: json });
    const hook = new Promise((resolve) => {
      const child = spawn(process.execPath, [HOOK, '--openmon', '--permission'], { env: { ...process.env, OPENMON_PORT: String(port) } });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('exit', () => resolve(out));
      child.stdin.end(JSON.stringify({ session_id: 'al1', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm test' }, permission_suggestions: [suggestion], cwd: '/tmp/x' }));
    });
    let p = null;
    for (let i = 0; i < 50 && !p; i++) {
      p = JSON.parse((await request(port, 'GET', '/api/state')).body).permissions[0] || null;
      if (!p) await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(p.canAlways, true);
    await request(port, 'POST', '/api/permission/decide', { body: JSON.stringify({ id: p.id, decision: 'always' }), headers: json });
    const out = JSON.parse(await hook);
    assert.equal(out.hookSpecificOutput.decision.behavior, 'allow');
    assert.deepEqual(out.hookSpecificOutput.decision.updatedPermissions, [suggestion]);
  } finally {
    stream.destroy();
    await daemon.close();
  }
});

test('presentation mode: project names and commands never leave the daemon', async () => {
  const { daemon, port } = await boot();
  const json = { 'Content-Type': 'application/json' };
  try {
    await request(port, 'POST', '/api/config', { body: JSON.stringify({ present: true }), headers: json });
    await request(port, 'POST', '/event', { body: JSON.stringify({ session_id: 'pp', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'deploy --prod' }, cwd: '/work/acme-secret' }), headers: json });
    const state = (await request(port, 'GET', '/api/state')).body;
    const powersView = (await request(port, 'GET', '/api/powers')).body;
    for (const text of [state, powersView]) {
      assert.ok(!text.includes('acme-secret'));
      assert.ok(!text.includes('deploy --prod'));
    }
    assert.match(JSON.parse(state).live.focus.label, /^(Project|Projeto) A$/);
  } finally {
    await daemon.close();
  }
});

test('companions: other team members on screen, never the main one; seasons off by default', async () => {
  const { daemon, port } = await boot();
  try {
    const st = daemon.state();
    assert.equal(st.config.seasons, false);
    // A project with enough work earns a second member.
    for (let i = 0; i < 61; i++) await request(port, 'POST', '/event', { body: JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 's2', cwd: '/w/other', tool_name: 'Read', tool_input: { file_path: '/w/other/a.js' } }) });
    const party = JSON.parse((await request(port, 'GET', '/api/state')).body).party;
    const other = [...party.members, ...party.box].find((m) => !m.active);
    assert.ok(other, 'a second member');
    const cfg = JSON.parse((await request(port, 'POST', '/api/config', { body: JSON.stringify({ companions: [other.id, 'not an id!', other.id] }) })).body);
    assert.deepEqual(cfg.companions, [other.id]);
    const state = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(state.companions[other.id].name, 'Egg');
    // Petting it raises its own friendship, not the main pet's.
    const before = state.pet.bond;
    const petted = JSON.parse((await request(port, 'POST', '/api/pet', { body: JSON.stringify({ id: other.id }) })).body).events;
    assert.ok(petted.every((e) => e.petId === other.id));
    assert.equal(JSON.parse((await request(port, 'GET', '/api/state')).body).pet.bond, before);
    // Making it the main pet swaps places: the old main one stays on screen as a companion.
    const mainId = state.pet.id;
    await request(port, 'POST', '/api/party/active', { body: JSON.stringify({ id: other.id }) });
    const after = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(after.pet.id, other.id);
    assert.deepEqual(after.config.companions, [mainId]);
  } finally {
    await daemon.close();
  }
});
