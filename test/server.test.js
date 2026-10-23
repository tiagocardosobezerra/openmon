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
// The desktop key that pet windows send with free text for the agent.
const KEY = 'k'.repeat(48);

async function boot({ focus = createFocus({ driver: null }) } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-home-'));
  const store = createStore({ dir, delay: 10 });
  const artDir = path.join(dir, 'art');
  fs.mkdirSync(artDir);
  fs.writeFileSync(path.join(artDir, 'craft-adult.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.writeFileSync(path.join(artDir, 'notes.txt'), 'not art');
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, artDir, bundledArt: null, configFile: path.join(dir, 'config.json'), focus, contactKey: KEY, upgradeHooks: () => {} });
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
    assert.equal(species.dex.length, 39);
    assert.equal(species.dex[35].name, 'Chromancer');
    assert.equal(species.dex[2].name, 'Forgemaw');
    assert.deepEqual(species.starters, ['craft', 'lore', 'shell']);
    assert.ok(species.natures.cheeky);
    const state = daemon.state();
    assert.ok(state.pet.nature);
    assert.equal(state.pet.dexNo, 1);
    const down = new Promise((resolve) => daemon.bus.once('shutdown', resolve));
    assert.equal((await request(port, 'POST', '/api/shutdown')).status, 204);
    await down;
    // Lay-egg is refused before Elder.
    assert.deepEqual(JSON.parse((await request(port, 'POST', '/api/lay-egg')).body).events, []);
  } finally {
    await daemon.close();
  }
});

test('a new trainer picks a starter through the API, once', async () => {
  const { daemon, port } = await boot();
  try {
    assert.equal(daemon.state().pet.awaitingStarter, true);
    const post = async (body) => JSON.parse((await request(port, 'POST', '/api/starter', { body: JSON.stringify(body) })).body).events;
    assert.deepEqual(await post({ lineage: 'chimera' }), []);
    const events = await post({ lineage: 'lore' });
    assert.ok(events.some((e) => e.type === 'starter' && e.lineage === 'lore'));
    assert.deepEqual(await post({ lineage: 'shell' }), []);
    const s = daemon.state();
    assert.equal(s.pet.awaitingStarter, false);
    assert.equal(s.pet.starter, 'lore');
    assert.equal(s.pet.progress.xpToGo, 30);
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
    assert.equal(pt.dex[2].name, 'Forgemaw');
    assert.match(pt.dex[2].text, /bigorna/);
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
    // Off: the hook prints nothing and returns at once.
    await request(port, 'POST', '/api/config', { body: JSON.stringify({ answerFromPet: false }), headers: json });
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

function spawnHook(port, flags, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK, '--openmon', ...flags], { env: { ...process.env, OPENMON_PORT: String(port) } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('exit', (code) => resolve({ code, out, err }));
    child.stdin.end(JSON.stringify(payload));
  });
}

async function until(port, pick) {
  for (let i = 0; i < 60; i++) {
    const found = pick(JSON.parse((await request(port, 'GET', '/api/state')).body));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('never happened');
}

test('the agent\'s question: picked on the pet, handed back as Claude Code\'s answers', async () => {
  const { daemon, port } = await boot();
  // A browser page cannot answer (no key): Claude Code asks at once.
  const page = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream' }, resolve));
  const early = await spawnHook(port, ['--question'], { session_id: 'q0', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Go?', options: [{ label: 'Yes' }] }] } });
  assert.deepEqual([early.code, early.out], [0, '']);
  page.destroy();
  // The desktop pet window can.
  const stream = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream?talk=1' }, resolve));
  const json = { 'Content-Type': 'application/json' };
  const keyed = { ...json, 'X-Openmon-Key': KEY };
  const questions = [
    { question: 'Which framework?', header: 'Framework', multiSelect: false, options: [{ label: 'React', description: 'Components' }, { label: 'Vue', description: '' }] },
    { question: 'Which extras?', header: 'Extras', multiSelect: true, options: [{ label: 'Tests' }, { label: 'Docs' }] },
  ];
  const ask = { session_id: 'q1', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions }, cwd: '/tmp/shop' };
  try {
    const hook = spawnHook(port, ['--question'], ask);
    const q = await until(port, (s) => s.questions[0]);
    assert.equal(q.session, 'q1');
    assert.equal(q.list.length, 2);
    assert.equal(q.list[0].options[0].label, 'React');
    // Without the desktop key, nothing is answered.
    assert.equal((await request(port, 'POST', '/api/question/answer', { body: JSON.stringify({ id: q.id, answers: ['React', ['Tests']] }), headers: json })).status, 403);
    // Two picks for a single-choice question are refused.
    assert.equal(JSON.parse((await request(port, 'POST', '/api/question/answer', { body: JSON.stringify({ id: q.id, answers: [['React', 'Vue'], ['Tests']] }), headers: keyed })).body).ok, false);
    assert.equal(JSON.parse((await request(port, 'POST', '/api/question/answer', { body: JSON.stringify({ id: q.id, answers: ['Svelte, please', ['Tests', 'Docs']] }), headers: keyed })).body).ok, true);
    const r = await hook;
    assert.equal(r.code, 0);
    const out = JSON.parse(r.out).hookSpecificOutput;
    assert.equal(out.hookEventName, 'PreToolUse');
    assert.equal(out.permissionDecision, 'allow');
    assert.deepEqual(out.updatedInput.questions, questions);
    assert.deepEqual(out.updatedInput.answers, { 'Which framework?': 'Svelte, please', 'Which extras?': 'Tests, Docs' });

    // "Open" on the pet: the hook ends with no answer, so Claude Code asks.
    const again = spawnHook(port, ['--question'], ask);
    const q2 = await until(port, (s) => s.questions[0]);
    assert.equal(JSON.parse((await request(port, 'POST', '/api/question/release', { body: JSON.stringify({ id: q2.id }), headers: json })).body).ok, true);
    assert.deepEqual((({ code, out: o }) => [code, o])(await again), [0, '']);

    // The permission hook leaves the question tool to the question hook.
    const perm = await spawnHook(port, ['--permission'], { ...ask, hook_event_name: 'PermissionRequest' });
    assert.deepEqual([perm.code, perm.out], [0, '']);

    // Off: the question hook prints nothing, so Claude Code asks as usual.
    await request(port, 'POST', '/api/config', { body: JSON.stringify({ answerFromPet: false }), headers: json });
    const off = await spawnHook(port, ['--question'], ask);
    assert.deepEqual([off.code, off.out], [0, '']);
  } finally {
    stream.destroy();
    await daemon.close();
  }
});

test('Deny with a reason, or deny and stop: only with the desktop key', async () => {
  const { daemon, port } = await boot();
  const stream = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream' }, resolve));
  const json = { 'Content-Type': 'application/json' };
  try {
    const hook = spawnHook(port, ['--permission'], { session_id: 'd1', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf build' }, cwd: '/tmp/x' });
    const p = await until(port, (s) => s.permissions[0]);
    const body = JSON.stringify({ id: p.id, decision: 'deny', message: 'use npm run clean', interrupt: true });
    assert.equal((await request(port, 'POST', '/api/permission/decide', { body, headers: json })).status, 403);
    await request(port, 'POST', '/api/permission/decide', { body, headers: { ...json, 'X-Openmon-Key': KEY } });
    const decision = JSON.parse((await hook).out).hookSpecificOutput.decision;
    assert.deepEqual(decision, { behavior: 'deny', message: 'Denied from the Openmon pet: use npm run clean', interrupt: true });
  } finally {
    stream.destroy();
    await daemon.close();
  }
});

test('a message from the pet reaches the conversation: next hook while working, the waiting hook while idle', async () => {
  const { daemon, port } = await boot();
  const json = { 'Content-Type': 'application/json' };
  const keyed = { ...json, 'X-Openmon-Key': KEY };
  const send = (session, text, headers = keyed) => request(port, 'POST', '/api/inbox/send', { body: JSON.stringify({ session, text }), headers });
  const base = { session_id: 'm1', cwd: '/tmp/shop' };
  try {
    // Older hooks (no --rewake) cannot deliver: the pet says so.
    await runHook(port, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'go' });
    assert.equal(JSON.parse((await send('m1', 'hello')).body).reason, 'unsupported');

    // Working: the message waits for the session's next hook, which hands it
    // over on stderr with exit code 2 (asyncRewake).
    const first = await spawnHook(port, ['--rewake'], { ...base, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'a.js' } });
    assert.deepEqual([first.code, first.err], [0, '']);
    assert.deepEqual(JSON.parse((await send('m1', 'also add tests')).body), { ok: true, delivered: false });
    assert.equal((await send('m1', 'x', json)).status, 403);
    let s = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.deepEqual(s.inbox.m1, { canSend: true, queued: true, listening: false });
    assert.ok(!JSON.stringify(s).includes('also add tests'));
    const next = await spawnHook(port, ['--rewake'], { ...base, hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'a.js' } });
    assert.equal(next.code, 2);
    assert.match(next.err, /Openmon desktop pet[\s\S]*also add tests$/);

    // Idle: the Stop hook stays in the background until a message comes.
    const idle = spawnHook(port, ['--rewake'], { ...base, hook_event_name: 'Stop' });
    await until(port, (st) => st.inbox.m1 && st.inbox.m1.listening);
    const sent = JSON.parse((await send('m1', 'now deploy')).body);
    assert.deepEqual(sent, { ok: true, delivered: true });
    const woke = await idle;
    assert.equal(woke.code, 2);
    assert.match(woke.err, /now deploy$/);

    // You typed in the agent's window instead: the waiting hook just ends.
    const idle2 = spawnHook(port, ['--rewake'], { ...base, hook_event_name: 'Stop' });
    await until(port, (st) => st.inbox.m1 && st.inbox.m1.listening);
    await runHook(port, { ...base, hook_event_name: 'UserPromptSubmit', prompt: 'something else' });
    assert.deepEqual((({ code, err }) => [code, err])(await idle2), [0, '']);
    s = JSON.parse((await request(port, 'GET', '/api/state')).body);
    assert.equal(s.inbox.m1.listening, false);
  } finally {
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

test('with two pets on screen, agent sessions without a pet of their own are shared between them', async () => {
  const party = require('../src/party');
  const petMod = require('../src/pet');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-home-'));
  const store = createStore({ dir, delay: 10 });
  const root = party.ensure(petMod.createPet(Date.now()));
  party.hatchMystery(root, Date.now(), () => 0.9);
  const side = root.others[0];
  store.save(root);
  store.flush();
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, bundledArt: null, configFile: path.join(dir, 'config.json'), focus: createFocus({ driver: null }) });
  await daemon.listen();
  try {
    daemon.setConfig({ companions: [side.id] });
    const edit = (session) => ({ session_id: session, cwd: '/tmp/scratch', hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: '/tmp/scratch/a.js', old_string: 'a', new_string: 'b' } });
    for (let i = 0; i < 3; i++) {
      daemon.ingest(edit('one'));
      daemon.ingest(edit('two'));
    }
    const s = daemon.state();
    const mainXp = s.pet.xp;
    const sideView = s.companions[side.id];
    assert.ok(mainXp > 0, 'the main pet earns from its session');
    assert.ok(sideView.xp > 0, 'the pet next to it earns from the other one');
    assert.deepEqual(sideView.sessions.length, 1);
    // A session keeps its pet.
    daemon.ingest(edit(sideView.sessions[0]));
    assert.ok(daemon.state().companions[side.id].xp > sideView.xp);
    assert.equal(daemon.state().pet.xp, mainXp);
  } finally {
    await daemon.close();
  }
});

test('who follows what: a pinned conversation, a pinned project, then the queue in turn; sharing off keeps the rest on the main pet', async () => {
  const party = require('../src/party');
  const petMod = require('../src/pet');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-home-'));
  const store = createStore({ dir, delay: 10 });
  const root = party.ensure(petMod.createPet(Date.now()));
  party.hatchMystery(root, Date.now(), () => 0.9);
  party.hatchMystery(root, Date.now(), () => 0.9);
  const [a, b] = root.others;
  store.save(root);
  store.flush();
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, bundledArt: null, configFile: path.join(dir, 'config.json'), focus: createFocus({ driver: null }) });
  const port = await daemon.listen();
  const post = (p, body) => fetch(`http://127.0.0.1:${port}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  try {
    daemon.setConfig({ companions: [a.id] });
    const edit = (session, cwd = '/tmp/scratch') => daemon.ingest({ session_id: session, cwd, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: `${cwd}/a.js`, old_string: 'a', new_string: 'b' } });
    const owner = (sid) => (daemon.state().owners[sid] || {}).pet;
    const mainId = daemon.state().party.members.find((m) => m.active).id;
    // The queue: first to the main pet, then the next one on screen, then back.
    edit('q1');
    edit('q2');
    edit('q3');
    assert.deepEqual([owner('q1'), owner('q2'), owner('q3')], [mainId, a.id, mainId]);
    // Pin a conversation to the pet on screen beside the main one.
    assert.equal((await post('/api/follow', { session: 'q1', pet: a.id })).ok, true);
    edit('q1');
    assert.equal(owner('q1'), a.id);
    assert.equal(daemon.state().owners.q1.pinned, true);
    // Pin a project to a pet that is not even on screen: its conversations train it.
    assert.equal((await post('/api/follow', { pet: b.id, project: 'shop' })).ok, true);
    const before = daemon.state().party.members.find((m) => m.id === b.id).xp;
    edit('s1', '/work/shop');
    assert.equal(owner('s1'), b.id);
    assert.ok(daemon.state().party.members.find((m) => m.id === b.id).xp > before);
    // Back to automatic.
    assert.equal((await post('/api/follow', { session: 'q1', pet: null })).ok, true);
    assert.equal(daemon.state().owners.q1.pinned, false);
    // Sharing off: new conversations stay with the main pet.
    daemon.setConfig({ shareSessions: false });
    edit('n1');
    edit('n2');
    assert.deepEqual([owner('n1'), owner('n2')], [mainId, mainId]);
  } finally {
    await daemon.close();
  }
});

test('a brand-new trainer can talk to the agent through the egg, then pick a starter that hatches from that work', async () => {
  const { daemon, port } = await boot();
  const stream = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/stream?talk=1' }, resolve));
  const json = { 'Content-Type': 'application/json' };
  const keyed = { ...json, 'X-Openmon-Key': KEY };
  const base = { session_id: 'n1', cwd: '/tmp/shop' };
  try {
    assert.equal(daemon.state().pet.awaitingStarter, true);

    // Before any starter is picked, the agent's question is answered on the egg.
    const questions = [{ question: 'Ship it?', header: 'Ship', multiSelect: false, options: [{ label: 'Yes' }, { label: 'No' }] }];
    const hook = spawnHook(port, ['--question'], { ...base, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions } });
    const q = await until(port, (s) => s.questions[0]);
    assert.equal(JSON.parse((await request(port, 'POST', '/api/question/answer', { body: JSON.stringify({ id: q.id, answers: ['Yes'] }), headers: keyed })).body).ok, true);
    const answered = await hook;
    assert.deepEqual(JSON.parse(answered.out).hookSpecificOutput.updatedInput.answers, { 'Ship it?': 'Yes' });

    // And a message written on the egg reaches the idle conversation.
    const idle = spawnHook(port, ['--rewake'], { ...base, hook_event_name: 'Stop' });
    await until(port, (st) => st.inbox.n1 && st.inbox.n1.listening);
    assert.deepEqual(JSON.parse((await request(port, 'POST', '/api/inbox/send', { body: JSON.stringify({ session: 'n1', text: 'add tests' }), headers: keyed })).body), { ok: true, delivered: true });
    assert.match((await idle).err, /add tests$/);

    // Pick the starter; the work of that same conversation hatches it.
    const events = JSON.parse((await request(port, 'POST', '/api/starter', { body: JSON.stringify({ lineage: 'shell' }) })).body).events;
    assert.ok(events.some((e) => e.type === 'starter' && e.lineage === 'shell'));
    for (let i = 0; i < 40 && daemon.state().pet.stage === 'egg'; i++) {
      await runHook(port, { ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: `echo ${i}` }, tool_response: {} });
    }
    const pet = daemon.state().pet;
    assert.equal(pet.stage, 'juvenile');
    assert.equal(pet.lineage, 'shell');
    assert.equal(pet.name, 'Sparkle');
  } finally {
    stream.destroy();
    await daemon.close();
  }
});
