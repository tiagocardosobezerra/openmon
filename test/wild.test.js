'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
process.env.OPENMON_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-test-home-'));
const pet = require('../src/pet');
const party = require('../src/party');
const wild = require('../src/wild');
const { STATS, SHINY_ODDS } = require('../src/species');

const T0 = new Date(2026, 5, 10, 12).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const done = (family) => ({ kind: 'tool-done', family });
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const trainer = () => party.ensure(pet.createPet(T0 - DAY, 'Openmon', () => 0.5));

test('the odds are powers of two, like the brilhante 1 in 128', () => {
  assert.equal(SHINY_ODDS, 128);
  assert.equal(wild.WILD_ODDS, 1024);
  for (const p of [wild.CATCH, wild.STAY, wild.SAME_TYPE]) assert.ok(Number.isInteger(Math.log2(1 / (1 - p))) || Number.isInteger(Math.log2(1 / p)), String(p));
});

test('an encounter: only on a finished action, at 1 in 1,024, of that action\'s type most of the time', () => {
  const root = trainer();
  assert.deepEqual(wild.roll(root, { kind: 'turn-end' }, T0, () => 0), []);
  assert.deepEqual(wild.roll(root, done('shell'), T0, () => 1 / 1024), []);
  const [e] = wild.roll(root, done('shell'), T0, seq(0, 0, 0.9));
  assert.equal(e.type, 'wild');
  assert.equal(e.lineage, 'shell');
  assert.equal(e.name, 'Sparkle');
  assert.equal(e.shiny, false);
  assert.equal(root.wild.until, T0 + wild.STAY_MS);
  assert.ok(root.wildSeen.shell);
  // The other quarter: any type, picked by the next roll.
  const other = trainer();
  const [o] = wild.roll(other, done('shell'), T0, seq(0, 0.9, 0, 0.9));
  assert.equal(o.lineage, STATS[0]);
});

test('a brilhante wild one keeps the 1 in 128', () => {
  const root = trainer();
  const [e] = wild.roll(root, done('lore'), T0, seq(0, 0, 1 / 128 - 1e-9));
  assert.equal(e.shiny, true);
});

test('at most one a day, never two within 2 hours, never while one is on screen or when not allowed', () => {
  const root = trainer();
  assert.deepEqual(wild.roll(root, done('craft'), T0, () => 0, false), []);
  assert.equal(wild.roll(root, done('craft'), T0, () => 0)[0].type, 'wild');
  assert.deepEqual(wild.roll(root, done('craft'), T0 + 1000, () => 0), []);
  // Gone after 10 minutes, but the day already had its encounter.
  assert.deepEqual(wild.roll(root, done('craft'), T0 + 3 * HOUR, () => 0), [{ type: 'wild-left' }]);
  const next = T0 + DAY;
  assert.equal(wild.roll(root, done('craft'), next, () => 0)[0].type, 'wild');
  wild.release(root, next + 1);
  assert.deepEqual(wild.roll(root, done('craft'), next + HOUR, () => 0), [], 'within 2 hours');
});

test('catching: one Openball per try, 3 in 4; the caught one joins the team as a Juvenile that keeps its type', () => {
  const root = trainer();
  wild.roll(root, done('git'), T0, seq(0, 0, 0));
  assert.deepEqual(wild.throwBall(root, T0 + 1, party.addMember), [], 'no Openball');
  root.bag.openball = 2;
  const events = wild.throwBall(root, T0 + 1, party.addMember, seq(0));
  const caught = events.find((e) => e.type === 'wild-caught');
  assert.equal(caught.name, 'Twiglet');
  assert.equal(caught.shiny, true);
  assert.equal(root.bag.openball, 1);
  assert.equal(root.wild, null);
  assert.equal(caught.petId, undefined);
  const m = root.others.find((x) => x.id === caught.memberId);
  assert.deepEqual([m.stage, m.lineage, m.starter, m.shiny, m.place], ['juvenile', 'git', 'git', true, 'party']);
  assert.ok(m.project.startsWith('wild:'));
  assert.ok(root.dex['git-juvenile']);
  assert.ok(root.achievements['first-catch'] && root.achievements['catch-shiny']);
  // It grows into its own line even when other work weighs more.
  const merged = party.merge(root, m);
  merged.stats.craft = 5000;
  merged.xp = 2999;
  pet.applySignal(merged, done('craft'), {}, T0 + DAY);
  assert.equal(merged.stage, 'adult');
  assert.equal(merged.lineage, 'git');
});

test('a miss: half the time it stays for another try, half the time it runs off', () => {
  const root = trainer();
  root.bag.openball = 3;
  wild.roll(root, done('data'), T0, seq(0, 0, 0.9));
  assert.equal(wild.throwBall(root, T0 + 1, party.addMember, seq(0.9, 0))[0].type, 'wild-missed');
  assert.ok(root.wild);
  assert.equal(wild.throwBall(root, T0 + 2, party.addMember, seq(0.9, 0.9))[0].type, 'wild-fled');
  assert.equal(root.wild, null);
  assert.equal(root.bag.openball, 1);
});

test('Openballs: three with the first starter, once per trainer; not used from the Bag', () => {
  const egg = pet.newTrainer(T0);
  pet.chooseStarter(egg, 'lore', T0);
  assert.equal(egg.bag.openball, 3);
  // A new generation picks again, but the gift is once per trainer.
  egg.awaitingStarter = true;
  egg.stage = 'egg';
  pet.chooseStarter(egg, 'craft', T0);
  assert.equal(egg.bag.openball, 3);
  assert.equal(pet.useItem(egg, 'openball', T0).length, 0, 'not used from the Bag');
});

test('Openball Plus catches 7 in 8 and the Master always; the ball thrown is the one spent', () => {
  const root = trainer();
  Object.assign(root.bag, { openball: 1, 'openball-plus': 1, 'openball-master': 1 });
  wild.roll(root, done('roam'), T0, seq(0, 0, 0.9));
  assert.equal(wild.throwBall(root, T0 + 1, party.addMember, seq(0.8, 0), 'openball')[0].type, 'wild-missed', '0.8 misses the plain one');
  assert.equal(wild.throwBall(root, T0 + 2, party.addMember, seq(0.8), 'openball-plus')[0].type, 'wild-caught', '0.8 is caught by the Plus');
  assert.deepEqual([root.bag.openball, root.bag['openball-plus'], root.bag['openball-master']], [0, 0, 1]);
  wild.roll(root, done('roam'), T0 + DAY, seq(0, 0, 0.9));
  assert.equal(wild.throwBall(root, T0 + DAY + 1, party.addMember, seq(0.999999), 'openball-master')[0].type, 'wild-caught');
  assert.deepEqual(wild.throwBall(root, T0 + DAY + 2, party.addMember, seq(0), 'snack'), []);
});

test('field items: a Lure makes them 1 in 256 and lifts the daily limit, a Lantern makes the next one brilhante 1 in 16, a Field map picks its type', () => {
  const root = trainer();
  Object.assign(root.bag, { lure: 1, lantern: 2, 'field-map': 1 });
  assert.equal(pet.useItem(root, 'lure', T0)[0].type, 'lure');
  assert.equal(root.lureUntil, T0 + HOUR);
  assert.equal(pet.useItem(root, 'lantern', T0)[0].type, 'lantern');
  assert.deepEqual(pet.useItem(root, 'lantern', T0), [], 'one Lantern at a time');
  assert.deepEqual(pet.useItem(root, 'field-map', T0, 0, 'chimera'), [], 'only one of the 11 types');
  assert.equal(pet.useItem(root, 'field-map', T0, 0, 'debug')[0].lineage, 'debug');
  // 1/300 misses at 1 in 1,024 but hits at 1 in 256.
  const [e] = wild.roll(root, done('shell'), T0 + 1, seq(1 / 300, 1 / 20));
  assert.deepEqual([e.type, e.lineage, e.shiny], ['wild', 'debug', true]);
  assert.equal(root.lantern, false);
  assert.equal(root.fieldMap, null);
  // Still lured: another one the same day, right after this one leaves.
  wild.release(root, T0 + 2);
  assert.equal(wild.roll(root, done('shell'), T0 + 3, seq(1 / 300, 0, 0.9))[0].type, 'wild');
  // Without the Lure the day's limit is back.
  wild.release(root, T0 + 4);
  assert.deepEqual(wild.roll(root, done('shell'), T0 + 2 * HOUR, () => 0), []);
});

test('rewards: the Master for meeting all 11 types, a Lantern for 10 catches; hatches are counted', () => {
  const root = trainer();
  STATS.forEach((s, i) => wild.roll(root, done(s), T0 + i * DAY, seq(0, 0, 0.9)));
  assert.equal(root.bag['openball-master'], 1);
  const other = trainer();
  other.bag.openball = 10;
  for (let i = 0; i < 10; i++) {
    wild.roll(other, done('craft'), T0 + i * DAY, seq(0, 0, 0.9));
    wild.throwBall(other, T0 + i * DAY + 1, party.addMember, seq(0));
  }
  assert.equal(other.bag.lantern, 1);
  const egg = pet.newTrainer(T0);
  pet.chooseStarter(egg, 'shell', T0);
  pet.applySignal(egg, done('shell'), {}, T0 + 1);
  for (let i = 0; i < 30 && egg.stage === 'egg'; i++) pet.applySignal(egg, done('shell'), {}, T0 + 2 + i);
  assert.equal(egg.counters.hatches, 1);
});
