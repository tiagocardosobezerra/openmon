'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pet = require('../src/pet');
const party = require('../src/party');
const { fileLang } = require('../src/classify');

const T0 = new Date(2026, 9, 1, 12).getTime();
const tool = (label, extra = {}) => ({ kind: 'tool-done', family: 'craft', label, ...extra });

function fresh() {
  const p = party.ensure(pet.createPet(T0, 'Rex', () => 0.5));
  p.stage = 'juvenile';
  p.lineage = 'craft';
  p.xp = 500;
  return p;
}

test('an old single pet becomes the first member, nothing lost', () => {
  const p = fresh();
  assert.ok(p.id);
  assert.equal(p.project, null);
  assert.deepEqual(p.others, []);
  const v = party.view(p);
  assert.equal(v.members.length, 1);
  assert.equal(v.members[0].name, 'Rex');
  assert.equal(v.members[0].active, true);
});

test('a project earns its own egg after enough work, then feeds only that egg', () => {
  const p = fresh();
  let events = [];
  for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) events.push(...party.applySignal(p, tool('web'), {}, T0 + i * 60_000));
  const egg = events.find((e) => e.type === 'project-egg');
  assert.ok(egg);
  assert.equal(egg.project, 'web');
  assert.equal(p.others.length, 1);
  const rootXp = p.xp;
  const before = p.others[0].xp;
  const evs = party.applySignal(p, tool('web'), {}, T0 + 10 * 60 * 60_000);
  assert.ok(p.others[0].xp > before);
  assert.equal(p.xp, rootXp);
  // Events about a pet that is not on screen say whose they are.
  assert.ok(evs.filter((e) => e.type === 'xp').every((e) => e.petId === p.others[0].id && e.project === 'web'));
  // Shared trainer state still counts the work.
  assert.ok(p.counters.tools >= party.EGG_AFTER_ACTIONS + 1);
});

test('switching the pet on screen keeps the Bag, Opendex and each pet\'s own things', () => {
  const p = fresh();
  for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(p, tool('api'), {}, T0 + i * 60_000);
  p.bag.snack = 7;
  p.wardrobe.owned.cap = T0;
  p.wardrobe.head = 'cap';
  const eggId = p.others[0].id;
  const next = party.setActive(p, eggId);
  assert.equal(next.id, eggId);
  assert.equal(next.project, 'api');
  assert.equal(next.stage, 'egg');
  assert.equal(next.bag.snack, 7);
  assert.ok(next.wardrobe.owned.cap);
  assert.equal(next.wardrobe.head, null);
  const back = party.setActive(next, p.id);
  assert.equal(back.name, 'Rex');
  assert.equal(back.stage, 'juvenile');
  assert.equal(back.wardrobe.head, 'cap');
  assert.equal(back.others.length, 1);
});

test('the Party holds 6; the rest wait in the Box', () => {
  const p = fresh();
  let t = T0;
  for (const label of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(p, tool(label), {}, (t += 60_000));
  const v = party.view(p);
  assert.equal(v.members.length, 6);
  assert.equal(v.box.length, 2);
  const inBox = v.box[0].id;
  assert.equal(party.move(p, inBox, 'party'), false);
  assert.equal(party.move(p, v.members[1].id, 'box'), true);
  assert.equal(party.move(p, inBox, 'party'), true);
});

test('regional forms: a pet raised mostly on one language evolves into its regional form', () => {
  assert.equal(fileLang({ file_path: 'src/app.tsx' }), 'js');
  assert.equal(fileLang({ file_path: 'main.py' }), 'py');
  assert.equal(fileLang({ file_path: 'README.md' }), null);
  const p = fresh();
  p.xp = 2900;
  for (let i = 0; i < 60; i++) party.applySignal(p, tool(null, { lang: 'py' }), {}, T0 + i * 60_000);
  for (let i = 0; i < 10; i++) party.applySignal(p, tool(null, { lang: 'js' }), {}, T0 + (60 + i) * 60_000);
  for (let i = 0; i < 200 && p.stage !== 'adult'; i++) party.applySignal(p, tool(null), {}, T0 + (100 + i) * 60_000);
  assert.equal(p.stage, 'adult');
  assert.equal(p.region, 'py');
  assert.ok(p.dexRegions['craft-adult.py']);
  assert.equal(pet.regionOf({ py: 10 }), null);
});
