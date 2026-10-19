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
    assert.equal(species.dex.length, 22);
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
