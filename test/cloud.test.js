'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCloud } = require('../src/cloud');
const pet = require('../src/pet');

// A tiny in-memory api.github.com: /user and the Gists the app uses.
function fakeGitHub({ scopes = 'gist' } = {}) {
  const gists = new Map();
  let n = 0;
  const reply = (status, body, headers = {}) => ({
    status,
    ok: status < 300,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (u.pathname === '/user') return reply(200, { login: 'ana', id: 7 }, { 'x-oauth-scopes': scopes });
    if (u.pathname === '/gists' && method === 'GET') return reply(200, [...gists.values()].map((g) => ({ id: g.id, description: g.description, files: { 'openmon.json': {} } })));
    if (u.pathname === '/gists' && method === 'POST') {
      const g = { id: `g${++n}`, description: body.description, public: body.public, files: { 'openmon.json': { content: body.files['openmon.json'].content } } };
      gists.set(g.id, g);
      return reply(201, g);
    }
    const m = u.pathname.match(/^\/gists\/(\w+)$/);
    if (m && gists.has(m[1])) {
      const g = gists.get(m[1]);
      if (method === 'PATCH') g.files['openmon.json'].content = body.files['openmon.json'].content;
      return reply(200, g);
    }
    return reply(404, {});
  };
  return { fetchImpl, gists };
}

function machine(gh, name, clock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-cloud-'));
  return createCloud({ file: path.join(dir, 'cloud.json'), fetchImpl: gh.fetchImpl, ghToken: async () => 'tok', machineName: name, now: () => clock.t++ });
}

const grown = (xp) => Object.assign(pet.createPet(1000), { xp });

test('a second computer picks up the pet, then each one hands over to the other', async () => {
  const gh = fakeGitHub();
  const clock = { t: 5000 };
  const a = machine(gh, 'desk', clock);
  const b = machine(gh, 'laptop', clock);
  assert.equal((await a.sync({ pet: grown(10), config: {} })).action, 'off');
  assert.equal((await a.connectGh()).login, 'ana');
  assert.equal((await a.sync({ pet: grown(10), config: {} })).action, 'pushed');
  const gist = [...gh.gists.values()][0];
  assert.equal(gist.public, false);

  // A new computer with a new egg takes the saved pet.
  await b.connectGh();
  const first = await b.sync({ pet: pet.createPet(9000), config: {}, fresh: true });
  assert.equal(first.action, 'pull');
  assert.equal(first.remote.pet.xp, 10);
  assert.equal(first.remote.machine.name, 'desk');
  b.synced(first.remote.savedAt);

  // The laptop grows it; the desk, unchanged since, takes it back.
  b.markChanged();
  assert.equal((await b.sync({ pet: grown(40), config: {} })).action, 'pushed');
  const back = await a.sync({ pet: grown(10), config: {} });
  assert.equal(back.action, 'pull');
  assert.equal(back.remote.pet.xp, 40);
  a.synced(back.remote.savedAt);
  assert.equal((await a.sync({ pet: grown(40), config: {} })).action, 'up-to-date');
});

test('when both computers changed, it asks; the choice settles it', async () => {
  const gh = fakeGitHub();
  const clock = { t: 5000 };
  const a = machine(gh, 'desk', clock);
  const b = machine(gh, 'laptop', clock);
  await a.connectGh();
  await a.sync({ pet: grown(10), config: {} });
  await b.connectGh();
  const r = await b.sync({ pet: pet.createPet(9000), config: {}, fresh: true });
  b.synced(r.remote.savedAt);

  b.markChanged();
  await b.sync({ pet: grown(30), config: {} });
  a.markChanged();
  const clash = await a.sync({ pet: grown(20), config: {} });
  assert.equal(clash.action, 'conflict');
  assert.equal(clash.remote.pet.xp, 30);
  assert.equal((await a.sync({ pet: grown(20), config: {}, force: 'local' })).action, 'pushed');
  const after = await b.sync({ pet: grown(30), config: {} });
  assert.equal(after.action, 'pull');
  assert.equal(after.remote.pet.xp, 20);
});

test('a computer that already has a grown pet never loses it on first sign-in', async () => {
  const gh = fakeGitHub();
  const clock = { t: 5000 };
  const a = machine(gh, 'desk', clock);
  const b = machine(gh, 'laptop', clock);
  await a.connectGh();
  await a.sync({ pet: grown(10), config: {} });
  await b.connectGh();
  assert.equal((await b.sync({ pet: grown(500), config: {} })).action, 'conflict');
});

test('a GitHub CLI login without the gist scope is refused, and no token is kept', async () => {
  const gh = fakeGitHub({ scopes: 'repo, read:org' });
  const c = machine(gh, 'desk', { t: 1 });
  await assert.rejects(c.connectGh(), /gh-no-gist/);
  assert.equal(c.connected(), false);
  assert.equal(JSON.stringify(c.status()).includes('tok'), false);
});

test('the GitHub CLI token is never written to disk', async () => {
  const gh = fakeGitHub();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-cloud-'));
  const file = path.join(dir, 'cloud.json');
  const c = createCloud({ file, fetchImpl: gh.fetchImpl, ghToken: async () => 'gho_secret', machineName: 'desk', now: () => 1 });
  await c.connectGh();
  await c.sync({ pet: grown(10), config: {} });
  assert.equal(fs.readFileSync(file, 'utf8').includes('gho_secret'), false);
  // A restart reads it from gh again.
  const again = createCloud({ file, fetchImpl: gh.fetchImpl, ghToken: async () => 'gho_secret', machineName: 'desk', now: () => 2 });
  assert.equal(again.connected(), true);
  assert.equal((await again.sync({ pet: grown(10), config: {} })).action, 'up-to-date');
});
