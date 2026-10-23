'use strict';

// Every game path end to end: the 17 items, each achievement and accessory,
// every evolution path, the Party and the Box, companions on screen and
// retiring to the Hall of Fame. One test per rule, so a dead end shows up
// as a failing name.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
process.env.OPENMON_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-test-home-'));
const pet = require('../src/pet');
const party = require('../src/party');
const wild = require('../src/wild');
const species = require('../src/species');
const { createDaemon } = require('../src/server');
const { createStore } = require('../src/store');
const { createFocus } = require('../src/focus');

const { STATS, LINEAGES, ITEMS, COSMETICS, ACHIEVEMENTS } = species;
const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365 * DAY;
// June: no seasonal accessory unlocks by accident.
const T0 = new Date(2026, 5, 10, 12).getTime();
const NIGHT = new Date(2026, 5, 10, 2).getTime();
const done = (family, extra = {}) => ({ kind: 'tool-done', family, ...extra });
const tool = (label, extra = {}) => ({ kind: 'tool-done', family: 'craft', label, ...extra });

function mk(over = {}) {
  const p = pet.createPet(T0, null, () => 0.5);
  return Object.assign(p, over);
}
// Today's missions fixed (none by default), so mission XP never muddles a count.
function missions(p, list = [], now = T0) {
  p.daily = { ...p.daily, day: pet.dayKey(now), missions: list };
  return p;
}
// Reaches the next stage with just enough XP, at time `now`.
function step(p, now = T0) {
  const next = species.STAGES[species.stageIndex(p.stage) + 1];
  if (next.bond && p.bond < next.bond) p.bond = next.bond;
  p.xp = next.xp - 1;
  p.xpLog = [];
  // One more XP from a tool with no kind of work, so the stats stay as set.
  return pet.applySignal(p, { kind: 'tool-done', family: null }, {}, now);
}

// --- items -----------------------------------------------------------------

test('there are 23 items: 5 to use, the Steady stone, 11 type stones, 3 Openballs and 3 field items', () => {
  assert.equal(Object.keys(ITEMS).length, 23);
  assert.deepEqual(Object.keys(ITEMS).filter((i) => ITEMS[i].use === 'throw'), ['openball', 'openball-plus', 'openball-master']);
  assert.deepEqual(Object.keys(ITEMS).filter((i) => ITEMS[i].use === 'field'), ['lure', 'lantern', 'field-map']);
  assert.equal(Object.values(ITEMS).filter((i) => i.stone).length, 11);
  for (const s of STATS) assert.equal(ITEMS[`stone-${s}`].stone, s);
});

test('snack: +2 friendship; not for eggs, legendaries or a full friendship', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft', bond: 10, bag: { snack: 3 } });
  pet.useItem(p, 'snack', T0);
  assert.equal(p.bond, 12);
  assert.equal(p.bag.snack, 2);
  assert.deepEqual(pet.useItem(mk({ bag: { snack: 1 } }), 'snack', T0), []);
  assert.deepEqual(pet.useItem(mk({ stage: 'mythic', legend: 'mergeon', bag: { snack: 1 } }), 'snack', T0), []);
  p.bond = 100;
  assert.deepEqual(pet.useItem(p, 'snack', T0), []);
  assert.equal(p.bag.snack, 2, 'nothing is used up for nothing');
});

test('level candy: exactly one level; kept at level 100', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft', xp: 500, bag: { candy: 2 } });
  const lv = pet.level(p.xp);
  pet.useItem(p, 'candy', T0);
  assert.equal(pet.level(p.xp), lv + 1);
  p.xp = pet.xpForLevel(100);
  p.stage = 'mythic';
  assert.deepEqual(pet.useItem(p, 'candy', T0), []);
  assert.equal(p.bag.candy, 1);
});

test('a candy that crosses a stage threshold evolves on the spot', () => {
  const p = mk({ stage: 'juvenile', lineage: 'lore', xp: 2990, bag: { candy: 1 } });
  p.stats.lore = 10;
  const events = pet.useItem(p, 'candy', T0);
  assert.equal(p.stage, 'adult');
  assert.ok(events.some((e) => e.type === 'evolve'));
});

test('friendship candy: +10, capped at 100 and kept when friendship is full', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft', bond: 95, bag: { 'friend-candy': 2 } });
  pet.useItem(p, 'friend-candy', T0);
  assert.equal(p.bond, 100);
  assert.ok(p.achievements['best-friends']);
  assert.deepEqual(pet.useItem(p, 'friend-candy', T0), []);
  assert.equal(p.bag['friend-candy'], 1);
});

test('XP charm: doubles work XP and the 10-minute limit for 24 hours; another adds 24 more', () => {
  const p = missions(mk({ stage: 'juvenile', lineage: 'craft', xp: 500, bag: { 'xp-charm': 2 } }));
  // Without a charm: 120 per 10 minutes.
  for (let i = 0; i < 300; i++) pet.applySignal(p, done('craft'), {}, T0);
  assert.equal(p.xp, 500 + pet.XP_WINDOW_CAP);
  // With a charm: double, up to 240 in a fresh window.
  pet.useItem(p, 'xp-charm', T0);
  const t1 = T0 + pet.XP_WINDOW_MS;
  const before = p.xp;
  for (let i = 0; i < 300; i++) pet.applySignal(p, done('craft'), {}, t1);
  assert.equal(p.xp - before, pet.XP_WINDOW_CAP * 2);
  // A second charm stacks: 48 hours from the first use.
  pet.useItem(p, 'xp-charm', T0);
  assert.equal(p.charmUntil, T0 + 2 * DAY);
  // After it runs out, back to single XP.
  missions(p, [], T0 + 2 * DAY + 1);
  const late = p.xp;
  pet.applySignal(p, done('craft'), {}, T0 + 2 * DAY + 1);
  assert.equal(p.xp - late, 1);
});

test('XP charm: mission rewards are not doubled', () => {
  const p = missions(mk({ stage: 'juvenile', lineage: 'craft', xp: 100, bag: { 'xp-charm': 1 } }), [{ id: 'turns', done: false }]);
  pet.useItem(p, 'xp-charm', T0);
  p.daily.turns = 4;
  pet.applySignal(p, { kind: 'turn-end' }, {}, T0 + 1000);
  // A turn is 3 XP, doubled; the mission and the perfect day add their plain 25 and 50.
  assert.equal(p.xp, 100 + 6 + 25 + 50);
});

test('mystery egg: used from the Bag (even by an egg) and hatches into a new member', () => {
  const root = party.ensure(mk({ bag: { 'mystery-egg': 1 } }));
  const used = pet.useItem(root, 'mystery-egg', T0);
  assert.ok(used.some((e) => e.type === 'mystery-egg'));
  assert.equal(root.bag['mystery-egg'], 0);
  const events = party.hatchMystery(root, T0, () => 0.9);
  const egg = root.others.find((m) => m.id === events[0].petId);
  assert.equal(egg.stage, 'egg');
  assert.match(egg.project, /^mystery:/);
  assert.deepEqual(egg.xpLog, []);
});

test('Steady stone: stops evolving while held, an egg still hatches, letting go evolves', () => {
  const p = mk({ xp: 0, bag: { everstone: 1 } });
  pet.useItem(p, 'everstone', T0);
  assert.equal(p.holding, 'everstone');
  p.xp = 3100;
  pet.applySignal(p, { kind: 'tool-done', family: null }, {}, T0);
  assert.equal(p.stage, 'juvenile', 'the egg hatched but went no further');
  const events = pet.useItem(p, 'everstone', T0);
  assert.equal(p.holding, null);
  assert.equal(p.stage, 'adult');
  assert.ok(events.some((e) => e.type === 'evolve'));
  assert.equal(p.bag.everstone, 1, 'the Steady stone is never used up');
});

test('Steady stone: a gift once, at the first evolution', () => {
  const p = mk();
  p.stats.craft = 10;
  const events = step(p);
  assert.ok(events.some((e) => e.type === 'item' && e.item === 'everstone'));
  assert.equal(p.bag.everstone, 1);
  step(p);
  assert.equal(p.bag.everstone, 1);
});

for (const s of STATS) {
  test(`type stone ${s}: the next evolution goes to ${s}, and the stone is spent`, () => {
    const p = mk({ bag: { [`stone-${s}`]: 1 } });
    // Work points the other way.
    p.stats[s === 'craft' ? 'lore' : 'craft'] = 500;
    pet.useItem(p, `stone-${s}`, T0);
    const events = step(p);
    assert.equal(p.lineage, s);
    assert.equal(p.bag[`stone-${s}`], 0);
    assert.equal(p.holding, null);
    assert.ok(events.some((e) => e.type === 'stone-used' && e.lineage === s));
    assert.equal(pet.form(p), LINEAGES[s].juvenile);
  });
}

test('type stone: an egg hatches into the stone\'s type', () => {
  const p = mk({ bag: { 'stone-roam': 1 } });
  p.stats.craft = 100;
  pet.useItem(p, 'stone-roam', T0);
  step(p);
  assert.equal(p.stage, 'juvenile');
  assert.equal(p.lineage, 'roam');
  assert.equal(p.bag['stone-roam'], 0);
});

// --- starters ------------------------------------------------------------------

test('starters: Tinkit, Owlet and Sparkle, the three most common kinds of work', () => {
  assert.deepEqual(species.STARTERS, ['craft', 'lore', 'shell']);
  assert.deepEqual(species.STARTERS.map((l) => LINEAGES[l].juvenile), ['Tinkit', 'Owlet', 'Sparkle']);
});

test('starter: a new trainer\'s egg waits for the choice and does not hatch before it', () => {
  const p = pet.newTrainer(T0, () => 0.5);
  assert.equal(p.awaitingStarter, true);
  assert.equal(pet.view(p).awaitingStarter, true);
  assert.equal(pet.view(p).progress.needsStarter, true);
  p.stats.lore = 500;
  p.xp = 5000;
  pet.applySignal(p, { kind: 'tool-done', family: null }, {}, T0);
  assert.equal(p.stage, 'egg');
});

test('starter: only one of the three, and only once', () => {
  const p = pet.newTrainer(T0, () => 0.5);
  for (const bad of ['chimera', 'test', 'mergeon', '', null]) assert.deepEqual(pet.chooseStarter(p, bad, T0), []);
  assert.equal(p.awaitingStarter, true);
  assert.ok(pet.chooseStarter(p, 'shell', T0).some((e) => e.type === 'starter' && e.lineage === 'shell'));
  assert.deepEqual(pet.chooseStarter(p, 'lore', T0), [], 'chosen already');
  assert.equal(p.starter, 'shell');
  // Eggs that are not a starter never take one.
  assert.deepEqual(pet.chooseStarter(mk(), 'lore', T0), []);
});

test('starter: hatches after a few minutes of work, as the chosen Juvenile, with its Skill', () => {
  const p = missions(pet.newTrainer(T0, () => 0.5));
  // The agent's work points elsewhere: the choice wins.
  p.stats.shell = 300;
  pet.chooseStarter(p, 'lore', T0);
  assert.equal(p.stage, 'egg', 'no XP yet');
  assert.equal(pet.progress(p).xpToGo, species.STARTER_HATCH_XP);
  let events = [];
  for (let i = 0; i < species.STARTER_HATCH_XP && p.stage === 'egg'; i++) events = pet.applySignal(p, done('shell'), {}, T0 + i * 1000);
  assert.ok(species.STARTER_HATCH_XP < species.STAGES[1].xp);
  assert.equal(p.stage, 'juvenile');
  assert.equal(p.lineage, 'lore');
  assert.equal(pet.form(p), 'Owlet');
  assert.ok(events.some((e) => e.type === 'evolve' && e.hatched && e.to === 'Owlet'));
  assert.ok(p.achievements.hatch);
  assert.ok(p.dex['lore-juvenile']);
  assert.deepEqual(require('../src/powers').unlockedPowers(p), ['lore']);
});

test('starter: an egg that already has the XP hatches as soon as it is chosen', () => {
  const p = pet.newTrainer(T0, () => 0.5);
  p.xp = 200;
  const events = pet.chooseStarter(p, 'craft', T0);
  assert.equal(p.stage, 'juvenile');
  assert.equal(p.lineage, 'craft');
  assert.ok(events.some((e) => e.type === 'evolve'));
});

test('starter: the lineage is kept for life, all XP counts, no Chimera', () => {
  const p = pet.newTrainer(T0, () => 0.5);
  pet.chooseStarter(p, 'shell', T0);
  // An exact tie between two other kinds of work.
  Object.assign(p.stats, { craft: 1000, test: 1000 });
  for (const stage of ['juvenile', 'adult', 'mythic']) {
    step(p);
    assert.equal(p.stage, stage);
    assert.equal(p.lineage, 'shell');
    assert.equal(p.chimera, null);
    assert.equal(pet.form(p), LINEAGES.shell[stage]);
  }
  assert.equal(p.trait, 'craft', 'the trait still comes from the work');
});

test('starter: a held type stone waits for the next evolution, then redirects it for good', () => {
  const p = pet.newTrainer(T0, () => 0.5);
  p.bag['stone-data'] = 1;
  pet.useItem(p, 'stone-data', T0);
  pet.chooseStarter(p, 'craft', T0);
  step(p);
  assert.equal(p.lineage, 'craft', 'the starter hatches as chosen');
  assert.equal(p.holding, 'stone-data');
  step(p);
  assert.equal(p.lineage, 'data');
  assert.equal(p.bag['stone-data'], 0);
  step(p);
  assert.equal(p.lineage, 'data', 'the new lineage is kept');
});

test('starter: the shiny roll still happens at hatch, in secret', () => {
  const p = pet.newTrainer(T0, () => 0);
  assert.equal(p.shiny, true, 'rolled at birth');
  pet.chooseStarter(p, 'lore', T0);
  step(p);
  assert.ok(p.achievements.shiny);
  assert.ok(!pet.newTrainer(T0, () => 0.5).shiny);
});

test('starter: a new generation chooses again; project and mystery eggs never do', () => {
  const elder = mk({ stage: 'mythic', lineage: 'craft', xp: 16000, starter: 'craft' });
  const { pet: egg } = pet.layEgg(elder, T0);
  assert.equal(egg.awaitingStarter, true);
  assert.equal(egg.starter, null);
  const root = party.ensure(team());
  party.hatchMystery(root, T0);
  for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(root, tool('proj'), {}, T0 + i * 6000);
  assert.equal(root.others.length, 2);
  for (const m of root.others) assert.ok(!m.awaitingStarter);
});

test('starter: an egg moved off screen can still be chosen, from the Party', () => {
  const root = party.ensure(pet.newTrainer(T0, () => 0.5));
  missions(root);
  for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(root, tool('proj'), {}, T0 + i * 6000);
  const other = root.others[0];
  const next = party.setActive(root, other.id);
  assert.equal(next.awaitingStarter, false);
  const events = party.chooseStarter(next, 'lore', T0);
  assert.ok(events.some((e) => e.type === 'starter' && e.petId === root.id));
  const egg = next.others.find((m) => m.id === root.id);
  assert.equal(egg.starter, 'lore');
  assert.equal(egg.awaitingStarter, false);
});

test('no Sprout: other eggs hatch straight into the Juvenile their work decides', () => {
  assert.ok(!species.STAGES.some((s) => s.id === 'sprout'));
  assert.deepEqual(Object.keys(species.BASE_FORMS), ['egg']);
  assert.ok(!species.dexEntries().some((e) => e.key === 'sprout'));
  const p = mk();
  p.stats.git = 50;
  const events = step(p);
  assert.equal(p.stage, 'juvenile');
  assert.equal(p.lineage, 'git');
  assert.ok(events.some((e) => e.type === 'evolve' && e.hatched && e.to === 'Twiglet'));
  assert.ok(p.achievements.hatch);
  assert.ok(!p.achievements['first-evolution'], 'hatching is not an evolution');
});

test('an old save with a Sprout loads as an egg about to hatch', () => {
  const old = pet.migrate({ bornAt: T0, xp: 380, stage: 'sprout', lineage: null, dex: { egg: T0, sprout: T0 }, history: [{ stage: 'egg', form: 'Egg', at: T0 }, { stage: 'sprout', form: 'Sprout', at: T0 }] }, T0);
  assert.equal(old.stage, 'egg');
  assert.equal(old.dex.sprout, undefined);
  assert.ok(!old.history.some((h) => h.stage === 'sprout'));
  assert.equal(pet.form(old), 'Egg');
  assert.doesNotThrow(() => pet.view(old));
  const root = party.ensure(mk({ stage: 'juvenile', lineage: 'craft' }));
  root.others.push({ id: 'dddddd', project: 'x', stage: 'sprout', xp: 40, stats: { ...root.stats }, bond: 0, history: [] });
  party.ensure(root);
  assert.equal(root.others[0].stage, 'egg');
  assert.doesNotThrow(() => party.view(root));
});

test('type stone: wins over the hidden Chimera', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft', bag: { 'stone-git': 1 } });
  Object.assign(p.stats, { craft: 100, lore: 200 });
  pet.useItem(p, 'stone-git', T0);
  step(p);
  assert.equal(p.lineage, 'git');
  assert.equal(p.chimera, null);
});

test('nothing to hold for a pet that no longer evolves', () => {
  const elder = mk({ stage: 'mythic', lineage: 'craft', xp: 15000, bag: { 'stone-lore': 1, everstone: 1 } });
  assert.deepEqual(pet.useItem(elder, 'stone-lore', T0), []);
  assert.deepEqual(pet.useItem(elder, 'everstone', T0), []);
  const legend = mk({ stage: 'mythic', legend: 'zeroday', bag: { 'stone-lore': 1 } });
  assert.deepEqual(pet.useItem(legend, 'stone-lore', T0), []);
  // One already held can always be let go.
  elder.holding = 'everstone';
  pet.useItem(elder, 'everstone', T0);
  assert.equal(elder.holding, null);
});

test('the Bag is shared: a stone another member holds is not free', () => {
  const root = party.ensure(mk({ bag: { 'stone-data': 1 } }));
  root.others.push({ id: 'aaaaaa', place: 'party', project: 'x', stage: 'egg', xp: 30, stats: { ...root.stats }, holding: 'stone-data' });
  party.ensure(root);
  assert.deepEqual(party.heldByOthers(root), { 'stone-data': 1 });
  assert.deepEqual(party.view(root).held, { 'stone-data': 1 });
  assert.deepEqual(pet.useItem(root, 'stone-data', T0, 1), []);
  root.bag['stone-data'] = 2;
  pet.useItem(root, 'stone-data', T0, 1);
  assert.equal(root.holding, 'stone-data');
});

test('a type stone every third day: yesterday\'s main work, weighted; fixes count for Debug', () => {
  const at = (families, fixes) => {
    const p = mk();
    p.daily = { ...p.daily, day: pet.dayKey(T0 - DAY), families, fixes, activeDays: 5 };
    p.streak = { days: 2, best: 2 };
    pet.petIt(p, T0);
    return Object.keys(p.bag).find((k) => k.startsWith('stone-') && p.bag[k]);
  };
  assert.equal(at({ lore: 100, roam: 20 }, 0), 'stone-roam');
  assert.equal(at({ craft: 20 }, 10), 'stone-debug');
  assert.equal(at({ craft: 20, lore: 30 }, 0), 'stone-craft');
  // A quiet day still gives one.
  assert.ok(at({}, 0));
});

test('a 30-day streak and a petting day fill the Bag: every kind of item, then the backpack', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft', xp: 500 });
  p.gifts = { everstone: T0 };
  p.bag.everstone = 1;
  p.bagSeen = { everstone: true };
  for (let d = 0; d < 30; d++) pet.petIt(p, T0 + d * DAY);
  for (let i = 0; i < 9; i++) pet.petIt(p, T0 + 29 * DAY + i);
  for (const id of ['snack', 'candy', 'friend-candy', 'xp-charm', 'mystery-egg', 'everstone']) assert.ok(p.bagSeen[id], id);
  assert.ok(Object.keys(p.bagSeen).some((id) => id.startsWith('stone-')));
  assert.ok(p.wardrobe.owned.backpack);
});

// --- achievements ------------------------------------------------------------

const ACHIEVE = {
  hatch: () => {
    const p = mk();
    step(p);
    return p;
  },
  shiny: () => {
    const p = mk({ shiny: true });
    step(p);
    return p;
  },
  'first-green': () => {
    const p = mk();
    pet.applySignal(p, { kind: 'test-end', passed: true }, {}, T0);
    return p;
  },
  'first-evolution': () => {
    const p = mk({ stage: 'juvenile', lineage: 'craft' });
    step(p);
    return p;
  },
  'green-100': () => {
    const p = mk();
    p.counters.testsGreen = 99;
    pet.applySignal(p, { kind: 'test-end', passed: true }, {}, T0);
    return p;
  },
  'edits-1000': () => {
    const p = mk();
    p.counters.edits = 999;
    pet.applySignal(p, done('craft'), {}, T0);
    return p;
  },
  marathon: () => {
    const p = mk();
    pet.applySignal(p, done('craft'), { turnTools: 50 }, T0);
    return p;
  },
  swarm: () => {
    const p = mk();
    pet.applySignal(p, done('craft'), { workingSessions: 5 }, T0);
    return p;
  },
  'night-owl': () => {
    const p = mk();
    pet.applySignal(p, done('craft'), {}, NIGHT);
    return p;
  },
  'quick-hands': () => {
    const p = mk();
    for (let i = 0; i < 10; i++) pet.applySignal(p, { kind: 'turn-start' }, { reaction: { ms: 5000, reason: 'answer' } }, T0 + i * 1000);
    return p;
  },
  'best-friends': () => {
    const p = mk({ stage: 'juvenile', lineage: 'craft', bond: 99, bag: { snack: 1 } });
    pet.useItem(p, 'snack', T0);
    return p;
  },
  mythic: () => {
    const p = mk({ stage: 'adult', lineage: 'craft' });
    step(p);
    return p;
  },
  hidden: () => {
    const p = mk({ stage: 'juvenile', lineage: 'craft' });
    Object.assign(p.stats, { craft: 100, lore: 200 });
    step(p);
    return p;
  },
  legend: () => {
    const root = party.ensure(mk());
    root.counters.merges = 1;
    party.applySignal(root, tool('app'), {}, T0);
    return root;
  },
  'first-catch': () => catchSome(1),
  'catch-shiny': () => catchSome(1, true),
  'catch-10': () => catchSome(10),
  'wild-all': () => {
    const root = party.ensure(mk());
    species.STATS.forEach((s, i) => wild.roll(root, done(s), T0 + i * DAY, seq(0, 0, 0.9)));
    return root;
  },
};

// Fixed dice for the wild encounters: each call takes the next value.
function seq(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}
function catchSome(n, shiny = false) {
  const root = party.ensure(mk());
  root.bag.openball = n;
  for (let i = 0; i < n; i++) {
    wild.roll(root, done('craft'), T0 + i * DAY, seq(0, 0, shiny ? 0 : 0.9));
    wild.throwBall(root, T0 + i * DAY + 1000, party.addMember, seq(0));
  }
  return root;
}

test('every achievement has a path that unlocks it', () => {
  assert.deepEqual(Object.keys(ACHIEVE).sort(), Object.keys(ACHIEVEMENTS).sort());
});
for (const [id, play] of Object.entries(ACHIEVE)) {
  test(`achievement ${id} unlocks`, () => assert.ok(play().achievements[id]));
}

// --- accessories -------------------------------------------------------------

const OCT = new Date(2026, 9, 31, 12).getTime();
const DEC = new Date(2026, 11, 24, 12).getTime();
const WEAR = {
  cap: (p) => (p.achievements.hatch = T0),
  party: (p) => (p.achievements['first-evolution'] = T0),
  beanie: (p) => (p.daily.activeDays = 7),
  headphones: (p) => (p.counters.testsGreen = 50),
  flower: (p) => (p.bond = 50),
  nightcap: (p) => (p.achievements['night-owl'] = T0),
  wizard: (p) => (p.stats.lore = 1500),
  crown: (p) => (p.achievements.mythic = T0),
  scarf: (p) => (p.counters.perfectDays = 1),
  bowtie: (p) => (p.counters.turns = 100),
  bandana: (p) => (p.counters.tools = 1000),
  medal: (p) => (p.achievements['quick-hands'] = T0),
  'glasses-round': (p) => (p.counters.reads = 3000),
  'glasses-dark': (p) => (p.streak = { days: 1, best: 20 }),
  monocle: (p) => (p.counters.fixes = 50),
  'hero-mask': (p) => (p.counters.longestTurn = 100),
  hardhat: (p) => (p.counters.shell = 500),
  'leaf-crown': (p) => (p.counters.commits = 100),
  'explorer-hat': (p) => (p.counters.pages = 200),
  'chef-hat': (p) => (p.counters.missionDays = 30),
  bow: (p) => (p.bond = 100),
  'star-tiara': (p) => {
    for (const e of species.dexEntries().slice(0, 21)) p.dex[e.key] = T0;
  },
  'pumpkin-hat': () => OCT,
  'santa-hat': () => DEC,
  'party-hat-gold': (p) => {
    p.trainerSince = T0 - YEAR;
  },
  necktie: (p) => (p.counters.prs = 50),
  pearls: (p) => (p.counters.perfectDays = 7),
  cape: (p) => (p.legends = { mergeon: T0 }),
  bell: (p) => (p.counters.pets = 100),
  backpack: (p) => (p.bagSeen = { snack: true, candy: true, 'friend-candy': true, 'xp-charm': true, 'mystery-egg': true, everstone: true, 'stone-swarm': true, openball: true }),
  'catcher-sash': (p) => (p.achievements['first-catch'] = T0),
  binoculars: (p) => (p.achievements['wild-all'] = T0),
  'sparkle-clip': (p) => (p.achievements['catch-shiny'] = T0),
  'collector-badge': (p) => (p.counters.catches = 10),
  'nest-hat': (p) => (p.others = Array.from({ length: 6 }, () => ({ place: 'box' }))),
  'shell-bow': (p) => (p.counters.hatches = 5),
};

test('every accessory has a path that unlocks it, and none comes for free', () => {
  assert.deepEqual(Object.keys(WEAR).sort(), Object.keys(COSMETICS).sort());
  const p = mk();
  pet.checkCosmetics(p, T0, []);
  assert.deepEqual(p.wardrobe.owned, {});
});
for (const [id, setup] of Object.entries(WEAR)) {
  test(`accessory ${id} unlocks, and its hint reaches the goal`, () => {
    const p = mk();
    const at = setup(p);
    const now = typeof at === 'number' && at > YEAR ? at : T0;
    const events = [];
    pet.checkCosmetics(p, now, events);
    assert.ok(p.wardrobe.owned[id], id);
    assert.ok(events.some((e) => e.type === 'cosmetic' && e.id === id));
    const hint = pet.view(p).cosmetics.find((c) => c.id === id);
    if (hint.progress) assert.equal(hint.progress.have, hint.progress.need);
  });
}

test('the counters behind accessories and legendaries grow from real agent work', () => {
  const p = mk();
  const run = (cmd) => pet.applySignal(p, done('shell', { tool: 'Bash', detail: `Bash: ${cmd}` }), {}, T0);
  run('git commit -m x');
  run('gh pr create --fill');
  run('gh pr merge 3');
  pet.applySignal(p, done('roam', { tool: 'WebFetch' }), {}, T0);
  pet.applySignal(p, done('lore', { tool: 'Read' }), {}, T0);
  assert.deepEqual([p.counters.shell, p.counters.commits, p.counters.prs, p.counters.merges, p.counters.pages, p.counters.reads], [3, 1, 1, 1, 1, 1]);
});

// --- evolution paths ---------------------------------------------------------

for (const s of STATS) {
  test(`lineage ${s}: juvenile, adult and elder from ${s} work`, () => {
    const p = mk();
    p.stats[s] = 100;
    for (const stage of ['juvenile', 'adult', 'mythic']) {
      step(p);
      assert.equal(p.stage, stage);
      assert.equal(p.lineage, s);
      assert.equal(pet.form(p), LINEAGES[s][stage]);
      assert.ok(p.dex[`${s}-${stage}`]);
    }
  });
}

test('the type is decided again at every evolution', () => {
  const p = mk();
  p.stats.craft = 100;
  step(p);
  assert.equal(p.lineage, 'craft');
  p.stats.docs = 1000;
  step(p);
  assert.equal(p.lineage, 'docs');
  assert.equal(p.trait, 'craft');
});

test('hidden Chimera: adult and elder only from an almost exact tie; it can drift away', () => {
  const p = mk({ stage: 'juvenile', lineage: 'craft' });
  Object.assign(p.stats, { craft: 100, lore: 200 });
  step(p);
  assert.equal(p.lineage, 'chimera');
  assert.deepEqual(p.chimera, ['craft', 'lore']);
  assert.equal(pet.form(p), 'Chimera');
  step(p);
  assert.equal(pet.form(p), 'Paragon');
  assert.ok(p.dex['chimera-adult'] && p.dex['chimera-mythic']);
  // Not at juvenile, and not when the tie is gone.
  const j = mk();
  Object.assign(j.stats, { craft: 100, lore: 200 });
  step(j);
  assert.notEqual(j.lineage, 'chimera');
  const drift = mk({ stage: 'adult', lineage: 'chimera', chimera: ['craft', 'lore'] });
  Object.assign(drift.stats, { craft: 300, lore: 200 });
  step(drift);
  assert.equal(drift.lineage, 'craft');
  // Second kind of work too small (under 20%): no Chimera.
  assert.equal(species.CHIMERA_MIN, 0.2);
});

test('legendaries: each joins once from its feat, at the Elder stage, and never evolves', () => {
  const root = party.ensure(mk());
  root.counters.fixes = 100;
  root.counters.merges = 1;
  root.trainerSince = T0 - YEAR;
  const events = party.applySignal(root, tool(null), {}, T0);
  assert.deepEqual(events.filter((e) => e.type === 'legend').map((e) => e.id).sort(), ['aeonbyte', 'mergeon', 'zeroday']);
  party.applySignal(root, tool(null), {}, T0 + 1000);
  assert.equal(root.others.filter((m) => m.legend).length, 3);
  for (const m of root.others) {
    const merged = party.merge(root, m);
    assert.equal(merged.stage, 'mythic');
    assert.equal(merged.xp, 15000);
    assert.equal(pet.nextStage(merged), null);
    merged.xp = 99999;
    assert.ok(!pet.applySignal(merged, done('craft'), {}, T0).some((e) => e.type === 'evolve'));
    assert.equal(pet.view(merged).dexNo > 0, true);
  }
});

test('every Opendex entry has a reachable form', () => {
  const seen = new Set(['egg', 'chimera-adult', 'chimera-mythic', ...Object.keys(species.LEGENDS)]);
  for (const s of STATS) for (const st of ['juvenile', 'adult', 'mythic']) seen.add(`${s}-${st}`);
  for (const e of species.dexEntries()) assert.ok(seen.has(e.key), e.key);
});

// --- party, box and mystery eggs --------------------------------------------

function team() {
  const root = party.ensure(mk({ stage: 'juvenile', lineage: 'craft', xp: 500 }));
  missions(root);
  return root;
}

test('mystery egg: no project, so it grows only on screen (main or companion); the Box rests', () => {
  const root = team();
  const [{ petId }] = party.hatchMystery(root, T0, () => 0.9);
  const egg = () => root.others.find((m) => m.id === petId);
  // In the Party but not on screen: work without a pet of its own trains the main pet.
  party.applySignal(root, tool(null), {}, T0);
  assert.equal(egg().xp, 0);
  // Next to the main pet, an agent session handed to it trains it.
  for (let i = 0; i < 30; i++) party.applySignal(root, tool('newproj'), {}, T0 + i * 6000, petId);
  assert.equal(egg().xp, 30);
  // In the Box it rests, even if a session was handed to it.
  assert.equal(party.move(root, petId, 'box'), true);
  const xp = egg().xp;
  party.applySignal(root, tool(null), {}, T0 + DAY, petId);
  assert.equal(egg().xp, xp);
  // As the main pet it trains on all work without a pet of its own.
  const next = party.setActive(root, petId);
  const before = next.xp;
  party.applySignal(next, tool(null), {}, T0 + 2 * DAY);
  assert.equal(next.xp, before + 1);
});

test('the 10-minute XP limit is per pet: two projects at once both grow fully', () => {
  const root = team();
  for (const label of ['a', 'b']) for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(root, tool(label), {}, T0 - DAY + i * 6000);
  missions(root);
  const [a, b] = ['a', 'b'].map((l) => root.others.find((m) => m.project === l));
  const before = [a.xp, b.xp];
  for (let i = 0; i < 200; i++) {
    party.applySignal(root, tool('a'), {}, T0);
    party.applySignal(root, tool('b'), {}, T0);
  }
  assert.equal(a.xp - before[0], pet.XP_WINDOW_CAP);
  assert.equal(b.xp - before[1], pet.XP_WINDOW_CAP);
});

test('older saves: members get their own XP log', () => {
  const root = team();
  root.others.push({ id: 'bbbbbb', project: 'old', stage: 'egg', xp: 0, stats: { ...root.stats }, bond: 0, history: [] });
  party.ensure(root);
  assert.deepEqual(root.others[0].xpLog, []);
  assert.doesNotThrow(() => party.applySignal(root, tool('old'), {}, T0));
});

test('Party and Box: 6 in the Party; a pet taken out of a full Box swaps with the main one', () => {
  const root = team();
  let t = T0;
  for (const label of ['a', 'b', 'c', 'd', 'e', 'f']) for (let i = 0; i < party.EGG_AFTER_ACTIONS; i++) party.applySignal(root, tool(label), {}, (t += 6000));
  let v = party.view(root);
  assert.equal(v.members.length, 6);
  assert.equal(v.box.length, 1);
  assert.equal(party.move(root, v.box[0].id, 'party'), false);
  assert.equal(party.move(root, v.box[0].id, 'nowhere'), false);
  assert.equal(party.move(root, root.id, 'box'), false, 'the main pet is not moved');
  const boxed = v.box[0].id;
  const next = party.setActive(root, boxed);
  v = party.view(next);
  assert.equal(v.members.length, 6);
  assert.ok(v.box.some((m) => m.id === root.id), 'the old main pet went to the Box');
});

test('retiring: an Elder leaves an egg; trainer things carry on; a legendary never retires', () => {
  const p = mk({ stage: 'mythic', lineage: 'lore', xp: 16000, bag: { everstone: 1, snack: 4 }, holding: 'everstone', charmUntil: T0 + DAY });
  p.stats.lore = 900;
  p.streak = { days: 12, best: 20 };
  missions(p, [{ id: 'turns', done: true }]);
  p.daily.activeDays = 40;
  p.journal = [{ day: '2026-06-09', tools: 3 }];
  const { pet: egg, events } = pet.layEgg(p, T0 + 1, () => 0.5);
  assert.equal(events[0].type, 'new-egg');
  assert.equal(egg.stage, 'egg');
  assert.equal(egg.stats.lore, 90);
  assert.equal(egg.bag.everstone, 1, 'the held stone goes back to the Bag once');
  assert.equal(egg.holding, null);
  assert.deepEqual(egg.streak, p.streak);
  assert.equal(egg.daily.activeDays, 40);
  assert.deepEqual(egg.daily.missions, [{ id: 'turns', done: true }]);
  assert.equal(egg.charmUntil, T0 + DAY);
  assert.equal(egg.journal.length, 1);
  assert.equal(egg.hallOfFame[0].form, 'Oracle');
  // The next day still counts as a streak.
  pet.petIt(egg, T0 + DAY);
  assert.equal(egg.streak.days, 13);
  assert.equal(pet.layEgg(mk({ stage: 'mythic', legend: 'aeonbyte', xp: 15000 }), T0).events.length, 0);
  assert.equal(pet.layEgg(mk({ stage: 'adult' }), T0).events.length, 0);
});

// --- through the daemon ---------------------------------------------------

async function boot(save) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-home-'));
  if (save) fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify(save));
  const store = createStore({ dir, delay: 10 });
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, artDir: path.join(dir, 'art'), bundledArt: null, configFile: path.join(dir, 'config.json'), focus: createFocus({ driver: null }), backups: null });
  const port = await daemon.listen();
  return { daemon, port };
}
function request(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname }, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => resolve(data ? JSON.parse(data) : { status: res.statusCode }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const hook = (cwd, event = 'PostToolUse') => ({ hook_event_name: event, session_id: 's1', cwd, tool_name: 'Read', tool_input: { file_path: `${cwd}/a.js` } });

test('daemon: a stone held by another member cannot be held again', async () => {
  const save = party.ensure(mk({ xp: 40, bag: { 'stone-style': 1 } }));
  const fresh = pet.createPet(T0, null, () => 0.5);
  save.others.push({ id: 'cccccc', place: 'party', project: 'x', stage: 'egg', xp: 40, stats: fresh.stats, bond: 0, nature: fresh.nature, history: fresh.history, holding: 'stone-style' });
  const { daemon, port } = await boot(save);
  try {
    const r = await request(port, 'POST', '/api/use', { item: 'stone-style' });
    assert.deepEqual(r, { events: [] });
    const s = await request(port, 'GET', '/api/state');
    assert.equal(s.pet.holding, null);
    assert.equal(s.party.held['stone-style'], 1);
  } finally {
    await daemon.close();
  }
});

test('daemon: a companion in the Box is not drawn', async () => {
  const { daemon, port } = await boot();
  try {
    for (let i = 0; i < 61; i++) await request(port, 'POST', '/event', hook('/w/other'));
    let s = await request(port, 'GET', '/api/state');
    const other = s.party.members.find((m) => !m.active);
    await request(port, 'POST', '/api/config', { companions: [other.id] });
    s = await request(port, 'GET', '/api/state');
    assert.deepEqual(Object.keys(s.companions), [other.id]);
    await request(port, 'POST', '/api/party/move', { id: other.id, place: 'box' });
    s = await request(port, 'GET', '/api/state');
    assert.deepEqual(Object.keys(s.companions), []);
  } finally {
    await daemon.close();
  }
});

test('daemon: retiring keeps the team and the streak; a legendary on screen cannot retire', async () => {
  const save = party.ensure(mk({ stage: 'mythic', lineage: 'craft', xp: 16000 }));
  save.streak = { days: 9, best: 9 };
  save.counters.merges = 1;
  party.checkLegends(save, T0);
  const { daemon } = await boot(save);
  try {
    const events = daemon.layEgg();
    assert.equal(events[0].type, 'new-egg');
    let s = daemon.state();
    assert.equal(s.pet.stage, 'egg');
    assert.equal(s.pet.awaitingStarter, true, 'the new generation picks its starter');
    assert.equal(s.pet.hallOfFame.length, 1);
    assert.equal(s.pet.streak.days, 9);
    assert.equal(s.pet.project, null);
    const legend = s.party.members.find((m) => m.legend);
    assert.ok(legend);
    daemon.makeMain(legend.id);
    assert.deepEqual(daemon.layEgg(), []);
    s = daemon.state();
    assert.equal(s.pet.legend, 'mergeon');
  } finally {
    await daemon.close();
  }
});

// --- texts ---------------------------------------------------------------------

test('interface texts exist in English, Spanish and Portuguese alike', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8');
  const STRINGS = new Function(`${src.slice(src.indexOf('const STRINGS = '), src.indexOf('const params = new URLSearchParams'))};return STRINGS;`)();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(Object.keys(STRINGS.es).sort(), en);
  assert.deepEqual(Object.keys(STRINGS['pt-BR']).sort(), en);
  for (const k of ['party.mysteryHow', 'bag.noEvolve', 'bag.heldElsewhere', 'bag.fullBond', 'bag.maxLevel']) assert.ok(STRINGS.en[k], k);
});

test('"How it works" has the same questions in all three languages', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'help.html'), 'utf8');
  const body = src.slice(src.indexOf('const T = pt'), src.indexOf('const $ = (id)'));
  const read = (lang) => new Function('pt', 'lang', `${body};return T;`)(lang === 'pt-BR', lang);
  const [pt, es, en] = ['pt-BR', 'es', 'en'].map(read);
  assert.equal(pt.q.length, en.q.length);
  assert.equal(es.q.length, en.q.length);
  assert.ok(en.q.some(([q]) => /several Openmons/.test(q)));
  assert.ok(en.q.some(([, a]) => /mystery egg/.test(a)));
});

test('an old save loses the retired night, friendship and regional forms, and keeps the rest', () => {
  const old = pet.migrate({ bornAt: T0, xp: 5000, stage: 'adult', lineage: 'lore', nocturne: true, friend: true, region: 'py', langs: { py: 80 }, seenNight: { 'lore-adult': T0 }, dexRegions: { 'lore-adult.py': T0 }, achievements: { hatch: T0, nocturne: T0, friendship: T0 } }, T0);
  for (const k of ['nocturne', 'friend', 'region', 'langs', 'seenNight', 'dexRegions']) assert.equal(old[k], undefined, k);
  assert.deepEqual(Object.keys(old.achievements), ['hatch']);
  assert.equal(old.stage, 'adult');
  assert.equal(old.lineage, 'lore');
  assert.ok(!('nocturne' in species.ACHIEVEMENTS) && !('friendship' in species.ACHIEVEMENTS));
});
