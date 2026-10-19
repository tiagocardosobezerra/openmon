'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pet = require('../src/pet');

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 9, 18, 12, 0, 0).getTime();
const done = (family) => ({ kind: 'tool-done', family });

// Feeds `n` signals, spaced so the XP cap never kicks in.
function feed(p, signal, n, start = T0, step = 6000) {
  const events = [];
  for (let i = 0; i < n; i++) events.push(...pet.applySignal(p, signal, {}, start + i * step));
  return events;
}

test('an egg hatches into a sprout at 30 XP', () => {
  const p = pet.createPet(T0);
  const events = feed(p, done('craft'), 30);
  assert.equal(p.stage, 'sprout');
  assert.equal(pet.form(p), 'Sprout');
  assert.ok(events.some((e) => e.type === 'evolve' && e.to === 'Sprout'));
  assert.ok(p.achievements.hatch);
});

test('the top stat decides the lineage, the second the trait', () => {
  const p = pet.createPet(T0);
  p.xp = 2990;
  p.stage = 'juvenile';
  p.lineage = 'craft';
  p.stats = { craft: 50, lore: 400, shell: 10, test: 120, roam: 0, swarm: 0 };
  feed(p, done('lore'), 10);
  assert.equal(p.stage, 'adult');
  assert.equal(p.lineage, 'lore');
  assert.equal(p.trait, 'test');
  assert.equal(pet.form(p), 'Scrollwyrm');
});

test('mythic needs bond as well as XP', () => {
  const p = pet.createPet(T0);
  Object.assign(p, { xp: 20000, stage: 'adult', lineage: 'test', bond: 10 });
  feed(p, done('test'), 1);
  assert.equal(p.stage, 'adult');
  assert.equal(pet.progress(p).needsBond, true);
  p.bond = 60;
  feed(p, done('test'), 1, T0 + 10_000);
  assert.equal(p.stage, 'mythic');
  assert.equal(pet.form(p), 'Aegis');
});

test('XP is capped per 10 minutes so loops cannot farm it', () => {
  const p = pet.createPet(T0);
  feed(p, done('shell'), 500, T0, 100);
  assert.equal(p.xp, pet.XP_WINDOW_CAP);
  feed(p, done('shell'), 1, T0 + pet.XP_WINDOW_MS + 60_000);
  assert.equal(p.xp, pet.XP_WINDOW_CAP + 1);
  // Stats still count every call.
  assert.equal(p.stats.shell, 501);
});

test('fast answers raise bond and XP; idle waits do not', () => {
  const p = pet.createPet(T0);
  pet.applySignal(p, done('craft'), { reaction: { ms: 5000, reason: 'permission' } }, T0);
  assert.equal(p.bond, 2);
  assert.equal(p.xp, 1 + pet.XP.fastAnswer);
  pet.applySignal(p, done('craft'), { reaction: { ms: 90_000, reason: 'permission' } }, T0 + 1000);
  assert.equal(p.bond, 3);
  pet.applySignal(p, done('craft'), { reaction: { ms: 1000, reason: 'idle' } }, T0 + 2000);
  assert.equal(p.bond, 3);
});

test('petting: bond for the first 5 per day, never more', () => {
  const p = pet.createPet(T0);
  for (let i = 0; i < 8; i++) pet.petIt(p, T0 + i);
  assert.equal(p.bond, 5);
  assert.equal(p.counters.pets, 8);
  // Next day: +1 for coming back, +1 for the pet.
  pet.petIt(p, T0 + DAY);
  assert.equal(p.bond, 7);
});

test('green tests: stats, XP and achievement', () => {
  const p = pet.createPet(T0);
  const events = pet.applySignal(p, { kind: 'test-end', family: 'test', passed: true }, {}, T0);
  assert.equal(p.stats.test, 3);
  assert.equal(p.xp, pet.XP.green);
  assert.ok(events.some((e) => e.type === 'achievement' && e.id === 'first-green'));
});

test('context achievements', () => {
  const p = pet.createPet(T0);
  pet.applySignal(p, done('craft'), { turnTools: 50, workingSessions: 5 }, T0);
  assert.ok(p.achievements.marathon);
  assert.ok(p.achievements.swarm);
  pet.applySignal(p, done('craft'), {}, new Date(2026, 9, 19, 2, 0).getTime());
  assert.ok(p.achievements['night-owl']);
});

test('migrate keeps progress and fills new fields', () => {
  const old = { name: 'Rex', bornAt: 5, xp: 999, stats: { craft: 9 }, stage: 'juvenile', lineage: 'craft' };
  const p = pet.migrate(old, T0);
  assert.equal(p.name, 'Rex');
  assert.equal(p.xp, 999);
  assert.equal(p.stats.craft, 9);
  assert.equal(p.stats.swarm, 0);
  assert.equal(p.counters.tools, 0);
  assert.equal(pet.migrate('garbage', T0).stage, 'egg');
});

test('rename is cleaned', () => {
  const p = pet.createPet(T0);
  pet.rename(p, '  Bit\u0007zy the very long named creature  ');
  assert.equal(p.name, 'Bitzy the very long name');
  // Empty clears the nickname: back to the species name.
  pet.rename(p, '   ');
  assert.equal(p.name, null);
  assert.equal(pet.view(p).name, pet.view(p).form);
});

test('weighted affinity: a typical read-heavy agent is not always Lore', () => {
  // Rough real mix: lots of reading, then edits and shell, few tests.
  const stats = { craft: 250, lore: 400, shell: 250, test: 60, roam: 20, swarm: 10 };
  assert.equal(pet.topStats(stats)[0], 'craft');
  // Heavy subagent users can reach Swarm.
  assert.equal(pet.topStats({ ...stats, swarm: 80 })[0], 'swarm');
  const a = pet.affinity(stats);
  assert.ok(Math.abs(Object.values(a).reduce((x, y) => x + y, 0) - 1) < 1e-9);
});

test('nature and shiny are rolled at birth', () => {
  const lucky = pet.createPet(T0, 'Byte', () => 0);
  assert.equal(lucky.shiny, true);
  assert.equal(lucky.nature, 'brave');
  const plain = pet.createPet(T0, 'Byte', () => 0.99);
  assert.equal(plain.shiny, false);
});

test('migrated pets get a stable nature and are never made shiny', () => {
  const old = { name: 'Rex', bornAt: 123456, xp: 50, stage: 'sprout', history: [{ stage: 'egg', at: 1 }, { stage: 'sprout', at: 2 }] };
  const a = pet.migrate(old, T0);
  const b = pet.migrate(old, T0 + 999);
  assert.equal(a.nature, b.nature);
  assert.equal(a.shiny, false);
  assert.deepEqual(Object.keys(a.dex).sort(), ['egg', 'sprout']);
});

test('evolving fills the Opendex and flags new entries', () => {
  const p = pet.createPet(T0, 'Byte', () => 0.5);
  const events = feed(p, done('craft'), 30);
  const evo = events.find((e) => e.type === 'evolve');
  assert.equal(evo.newDex, true);
  assert.ok(p.dex.sprout);
  assert.equal(pet.view(p).dexNo, 2);
});

test('a mythic pet can retire and lay an egg that keeps the dex', () => {
  const p = pet.createPet(T0, 'Byte', () => 0.5);
  Object.assign(p, { stage: 'mythic', lineage: 'test', xp: 16000, stats: { craft: 100, lore: 0, shell: 0, test: 900, roam: 0, swarm: 0 } });
  p.dex['test-mythic'] = T0;
  assert.equal(pet.layEgg(pet.createPet(T0), T0).events.length, 0);
  const { pet: egg, events } = pet.layEgg(p, T0 + 1, () => 0.5);
  assert.equal(egg.stage, 'egg');
  assert.equal(egg.generation, 2);
  assert.ok(egg.dex['test-mythic']);
  assert.equal(egg.stats.test, 90);
  assert.equal(egg.hallOfFame[0].form, 'Aegis');
  assert.equal(events[0].type, 'new-egg');
});

test('levels follow a gentle curve and announce themselves', () => {
  assert.equal(pet.level(0), 1);
  assert.equal(pet.level(400), 9);
  assert.equal(pet.level(3000), 25);
  assert.equal(pet.level(15000), 55);
  assert.equal(pet.level(10 ** 9), 100);
  const p = pet.createPet(T0, 'Byte', () => 0.5);
  p.xp = 4;
  const events = pet.applySignal(p, done('craft'), {}, T0);
  assert.deepEqual(events.find((e) => e.type === 'level'), { type: 'level', level: 2 });
  assert.equal(pet.view(p).level, 2);
});

test('a near-perfect tie between two kinds of work grows the hidden Chimera', () => {
  const p = pet.createPet(T0, 'Byte', () => 0.5);
  Object.assign(p, { xp: 2999, stage: 'juvenile', lineage: 'craft' });
  // Craft 300 and Test 300 weigh the same (both ×1).
  p.stats = { craft: 300, lore: 0, shell: 100, test: 300, roam: 0, swarm: 0 };
  const events = pet.applySignal(p, { kind: 'turn-end' }, {}, T0);
  assert.equal(p.lineage, 'chimera');
  assert.deepEqual(p.chimera, ['craft', 'test']);
  assert.equal(pet.form(p), 'Chimera');
  assert.ok(events.some((e) => e.type === 'achievement' && e.id === 'hidden'));
  assert.equal(pet.view(p).dexNo, 21);
});

test('evolving at night gives the Nocturne variant; by day it does not', () => {
  const night = pet.createPet(T0, 'Byte', () => 0.5);
  Object.assign(night, { xp: 399, stage: 'sprout' });
  night.stats.craft = 10;
  const events = pet.applySignal(night, { kind: 'turn-end' }, {}, new Date(2026, 9, 19, 3, 0).getTime());
  assert.equal(night.stage, 'juvenile');
  assert.equal(night.nocturne, true);
  assert.ok(night.seenNight['craft-juvenile']);
  assert.ok(events.some((e) => e.type === 'achievement' && e.id === 'nocturne'));
  const day = pet.createPet(T0, 'Byte', () => 0.5);
  Object.assign(day, { xp: 399, stage: 'sprout' });
  pet.applySignal(day, { kind: 'turn-end' }, {}, T0);
  assert.equal(day.nocturne, false);
});

test('without a nickname the pet goes by its species name; old defaults are dropped', () => {
  const p = pet.createPet(T0);
  assert.equal(p.name, null);
  assert.equal(pet.view(p).name, 'Egg');
  assert.equal(pet.view(p).nickname, null);
  p.stage = 'juvenile';
  p.lineage = 'craft';
  assert.equal(pet.view(p).name, 'Tinkit');
  assert.equal(pet.migrate({ name: 'Byte', bornAt: 1 }, T0).name, null);
  assert.equal(pet.migrate({ name: 'Openmon', bornAt: 1 }, T0).name, null);
  assert.equal(pet.migrate({ name: 'Rex', bornAt: 1 }, T0).name, 'Rex');
});

test('time spent waiting for you is counted per day and in total', () => {
  const p = pet.createPet(T0, 'Openmon', () => 0.5);
  pet.applySignal(p, done('craft'), { reaction: { ms: 40_000, reason: 'permission' } }, T0);
  pet.applySignal(p, done('craft'), { reaction: { ms: 5_000, reason: 'input' } }, T0 + 1000);
  pet.applySignal(p, done('craft'), { reaction: { ms: 90_000, reason: 'idle' } }, T0 + 2000);
  const v = pet.view(p);
  assert.deepEqual([v.today.waitMs, v.today.waits, v.today.fastestMs], [45_000, 2, 5_000]);
  assert.equal(p.counters.waitMs, 45_000);
  pet.applySignal(p, done('craft'), {}, T0 + 24 * 3600 * 1000);
  assert.equal(pet.view(p).today.waitMs, 0);
});

test('three daily missions: same for everyone on a day, rewarded once', () => {
  const day = pet.dayKey(T0);
  assert.deepEqual(pet.missionsFor(day), pet.missionsFor(day));
  assert.equal(new Set(pet.missionsFor(day).map((m) => m.id)).size, 3);
  const p = pet.createPet(T0, 'Openmon', () => 0.5);
  pet.applySignal(p, done('craft'), {}, T0);
  // Force a known set of missions for the test.
  p.daily.missions = [{ id: 'pets', done: false }, { id: 'green', done: false }, { id: 'turns', done: false }];
  let events = [];
  for (let i = 0; i < 3; i++) events.push(...pet.petIt(p, T0 + i));
  assert.ok(events.some((e) => e.type === 'mission' && e.id === 'pets'));
  const xpAfterPets = p.xp;
  for (let i = 0; i < 3; i++) events.push(...pet.applySignal(p, { kind: 'test-end', family: 'test', passed: true }, {}, T0 + 10_000 * (i + 1)));
  for (let i = 0; i < 5; i++) events.push(...pet.applySignal(p, { kind: 'turn-end' }, {}, T0 + 100_000 * (i + 1)));
  assert.ok(events.some((e) => e.type === 'missions-all'));
  assert.ok(p.xp > xpAfterPets + 25 * 2 + 50);
  const v = pet.view(p).today;
  assert.ok(v.perfect);
  assert.deepEqual(v.missions.map((m) => m.done), [true, true, true]);
  // No double rewards.
  const before = p.xp;
  pet.petIt(p, T0 + 999);
  assert.equal(p.xp, before);
});

test('accessories unlock by playing, are worn one per slot and survive a new generation', () => {
  const p = pet.createPet(T0, null, () => 0.5);
  assert.deepEqual(pet.wear(p, 'head', 'cap'), []);
  p.achievements.hatch = T0;
  const events = [];
  pet.checkCosmetics(p, T0, events);
  assert.ok(events.some((e) => e.type === 'cosmetic' && e.id === 'cap'));
  assert.deepEqual(pet.wear(p, 'neck', 'cap'), []);
  assert.equal(pet.wear(p, 'head', 'cap')[0].id, 'cap');
  assert.equal(pet.view(p).wear.head, 'cap');
  p.stage = 'mythic';
  p.lineage = 'craft';
  const { pet: egg } = pet.layEgg(p, T0 + 1);
  assert.ok(egg.wardrobe.owned.cap);
  assert.equal(egg.wardrobe.head, null);
});

test('items: missions give snacks, snacks build bond, the Steady stone stops evolution', () => {
  const p = pet.createPet(T0, null, () => 0.5);
  pet.applySignal(p, done('craft'), {}, T0);
  p.daily.missions = [{ id: 'pets', done: false }, { id: 'green', done: true }, { id: 'turns', done: true }];
  for (let i = 0; i < 3; i++) pet.petIt(p, T0 + i);
  assert.equal(p.bag.snack, 1);
  assert.equal(p.bag.candy, 1);
  // Eggs do not eat.
  p.stage = 'egg';
  assert.deepEqual(pet.useItem(p, 'snack', T0), []);
  p.stage = 'sprout';
  const bond = p.bond;
  pet.useItem(p, 'snack', T0);
  assert.equal(p.bond, bond + 2);
  assert.equal(p.bag.snack, 0);
  // Candy: exactly one level.
  const lv = pet.level(p.xp);
  pet.useItem(p, 'candy', T0);
  assert.equal(pet.level(p.xp), lv + 1);
  // Steady stone held: enough XP, still no evolution; let go and it evolves.
  p.bag.everstone = 1;
  pet.useItem(p, 'everstone', T0);
  assert.equal(p.holding, 'everstone');
  p.xp = 500;
  pet.applySignal(p, done('craft'), {}, T0 + 5000);
  assert.equal(p.stage, 'sprout');
  const ev = pet.useItem(p, 'everstone', T0 + 6000);
  assert.equal(p.holding, null);
  assert.ok(ev.some((e) => e.type === 'evolve'));
});

test('every new day: a snack, and a streak that resets after a missed day', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const p = pet.createPet(T0, null, () => 0.5);
  pet.petIt(p, T0);
  assert.equal(p.streak.days, 1);
  let events = pet.petIt(p, T0 + DAY);
  assert.ok(events.some((e) => e.type === 'daily-gift' && e.streak === 2));
  assert.equal(p.bag.snack, 1);
  for (let d = 2; d < 7; d++) pet.petIt(p, T0 + d * DAY);
  assert.equal(p.streak.days, 7);
  assert.equal(p.bag.candy, 1);
  pet.petIt(p, T0 + 9 * DAY);
  assert.equal(p.streak.days, 1);
  assert.equal(p.streak.best, 7);
});

test('the journal keeps one line per day: work by kind and by project', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const p = pet.createPet(T0, null, () => 0.5);
  pet.applySignal(p, { kind: 'tool-done', family: 'craft', label: 'shop' }, {}, T0);
  pet.applySignal(p, { kind: 'tool-done', family: 'lore', label: 'shop' }, {}, T0 + 1000);
  pet.applySignal(p, { kind: 'test-end', family: 'test', passed: false, label: 'api' }, {}, T0 + 2000);
  pet.applySignal(p, { kind: 'tool-done', family: 'craft', label: 'api' }, {}, T0 + DAY);
  const j = pet.view(p).journal;
  assert.equal(j.length, 2);
  assert.deepEqual(j[0].families, { craft: 1, lore: 1, test: 1 });
  assert.deepEqual(j[0].projects, { shop: 2, api: 1 });
  assert.equal(j[0].red, 1);
  assert.equal(j[0].tools, 3);
  assert.equal(j[1].tools, 1);
});

test('fixing what failed trains Debug; unrelated successes do not', () => {
  const p = pet.createPet(T0);
  const sig = (kind, extra) => ({ kind, session: 'dbg', tool: 'Bash', ...extra });
  pet.applySignal(p, sig('tool-fail', { detail: 'Bash: make' }), {}, T0);
  pet.applySignal(p, sig('tool-done', { detail: 'Bash: ls' }), {}, T0 + 1000);
  assert.equal(p.stats.debug, 0);
  pet.applySignal(p, sig('tool-done', { detail: 'Bash: make' }), {}, T0 + 2000);
  assert.equal(p.stats.debug, 1);
  // Red tests, then green: worth more.
  pet.applySignal(p, sig('test-end', { passed: false }), {}, T0 + 3000);
  pet.applySignal(p, sig('test-end', { passed: true }), {}, T0 + 4000);
  assert.equal(p.stats.debug, 4);
  assert.equal(p.counters.fixes, 2);
});

test('old pets get the new stats at zero', () => {
  const old = pet.migrate({ bornAt: T0, stats: { craft: 5, lore: 2, shell: 0, test: 0, roam: 0, swarm: 0 } }, T0);
  assert.equal(old.stats.craft, 5);
  for (const s of ['docs', 'git', 'debug', 'data', 'style']) assert.equal(old.stats[s], 0);
});

test('a held type stone decides the next evolution and is spent', () => {
  const p = pet.createPet(T0);
  p.stage = 'sprout';
  p.xp = 399;
  p.stats.craft = 500;
  p.bag['stone-data'] = 1;
  pet.useItem(p, 'stone-data', T0);
  assert.equal(p.holding, 'stone-data');
  const events = pet.applySignal(p, done('craft'), {}, T0 + 1000);
  assert.equal(p.stage, 'juvenile');
  assert.equal(p.lineage, 'data');
  assert.equal(p.bag['stone-data'], 0);
  assert.equal(p.holding, null);
  assert.ok(events.some((e) => e.type === 'stone-used'));
});

test('full friendship at the Mythic evolution gives the friendship form', () => {
  const p = pet.createPet(T0);
  Object.assign(p, { stage: 'adult', lineage: 'craft', xp: 14999, bond: 100 });
  p.stats.craft = 5000;
  pet.applySignal(p, done('craft'), {}, T0 + 1000);
  assert.equal(p.stage, 'mythic');
  assert.equal(p.friend, true);
  assert.ok(p.achievements.friendship);
});

test('the XP charm doubles experience for a day; friendship candy adds 10', () => {
  const p = pet.createPet(T0);
  Object.assign(p, { stage: 'juvenile', lineage: 'craft', xp: 500, bond: 10 });
  p.bag['xp-charm'] = 1;
  p.bag['friend-candy'] = 1;
  pet.useItem(p, 'xp-charm', T0);
  pet.applySignal(p, done('craft'), {}, T0 + 1000);
  assert.equal(p.xp, 502);
  pet.useItem(p, 'friend-candy', T0 + 2000);
  assert.equal(p.bond, 20);
});

test('new accessories: commits, the face slot and progress hints', () => {
  const p = pet.createPet(T0);
  p.stage = 'juvenile';
  for (let i = 0; i < 100; i++) pet.applySignal(p, { kind: 'tool-done', family: 'git', tool: 'Bash', detail: 'Bash: git commit -m x', session: 's' }, {}, T0 + i * 60000);
  assert.ok(p.wardrobe.owned['leaf-crown']);
  assert.equal(p.counters.commits, 100);
  p.wardrobe.owned.monocle = T0;
  assert.equal(pet.wear(p, 'face', 'monocle').length, 1);
  assert.equal(p.wardrobe.face, 'monocle');
  assert.equal(pet.wear(p, 'face', 'leaf-crown').length, 0);
  const hint = pet.view(p).cosmetics.find((c) => c.id === 'hardhat');
  assert.deepEqual(hint.progress, { have: 100, need: 500 });
});
