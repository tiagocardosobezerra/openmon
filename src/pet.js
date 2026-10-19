'use strict';

// The creature's progression: XP, stats, bond, stage, form, achievements.
// Pure functions over a plain JSON object, so it is easy to persist, test
// and migrate. Nothing here ever takes progress away.

const { MISSIONS, MISSION_XP, PERFECT_DAY_XP, COSMETICS, ITEMS } = require('./species');
const { STATS, STAT_WEIGHTS, STAGES, ACHIEVEMENTS, NATURES, SHINY_ODDS, CHIMERA_GAP, CHIMERA_MIN, stageIndex, formName, formKey, dexEntries } = require('./species');

const VERSION = 1;
const XP_WINDOW_MS = 10 * 60 * 1000;
const XP_WINDOW_CAP = 120;
const FAST_ANSWER_MS = 30 * 1000;
const OK_ANSWER_MS = 2 * 60 * 1000;
const PETS_PER_DAY = 5;
const BOND_MAX = 100;

const XP = { tool: 1, fail: 1, green: 5, turn: 3, fastAnswer: 2 };

function dayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const NATURE_IDS = Object.keys(NATURES);

// Stable pseudo-random number from a seed, so an old pet migrated on every
// load always gets the same nature.
function seeded(seed) {
  let x = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  x = (x * 16807) % 2147483647;
  x = (x * 16807) % 2147483647;
  return x / 2147483647;
}

// Until the player names it, an Openmon is simply called "Openmon".
// Like Pokémon: without a nickname the pet goes by its species name, which
// changes as it evolves. pet.name holds the nickname, or null.
const DEFAULT_NAME = null;
// Old default names nobody chose: "Byte" (before the rename), "Openmon".
const OLD_DEFAULTS = new Set(['Byte', 'Openmon']);

function createPet(now, name = DEFAULT_NAME, rng = Math.random) {
  return {
    version: VERSION,
    name,
    bornAt: now,
    nature: NATURE_IDS[Math.floor(rng() * NATURE_IDS.length) % NATURE_IDS.length],
    shiny: rng() < 1 / SHINY_ODDS,
    generation: 1,
    dex: { egg: now },
    xp: 0,
    stats: Object.fromEntries(STATS.map((s) => [s, 0])),
    bond: 0,
    stage: 'egg',
    lineage: null,
    trait: null,
    counters: { tools: 0, edits: 0, fails: 0, testsGreen: 0, testsRed: 0, turns: 0, answers: 0, fastAnswers: 0, pets: 0, evolutions: 0, waitMs: 0 },
    daily: { day: null, pets: 0, fastAnswers: 0, waitMs: 0, waits: 0, fastestMs: null, activeDays: 0 },
    xpLog: [],
    achievements: {},
    history: [{ stage: 'egg', form: 'Egg', at: now }],
    wardrobe: { owned: {}, head: null, neck: null },
    bag: { snack: 0, candy: 0, everstone: 0 },
    holding: null,
  };
}

// Fills in fields added by later versions, keeps everything the user had.
function migrate(raw, now) {
  if (!raw || typeof raw !== 'object') return createPet(now);
  const name = !raw.name || OLD_DEFAULTS.has(raw.name) ? DEFAULT_NAME : raw.name;
  const fresh = createPet(raw.bornAt || now, name, () => seeded(raw.bornAt || now));
  // Pets from before shinies existed are not re-rolled.
  if (raw.shiny === undefined) fresh.shiny = false;
  return {
    ...fresh,
    ...raw,
    name,
    version: VERSION,
    stats: { ...fresh.stats, ...(raw.stats || {}) },
    counters: { ...fresh.counters, ...(raw.counters || {}) },
    daily: { ...fresh.daily, ...(raw.daily || {}) },
    achievements: { ...(raw.achievements || {}) },
    xpLog: Array.isArray(raw.xpLog) ? raw.xpLog : [],
    history: Array.isArray(raw.history) && raw.history.length ? raw.history : fresh.history,
    dex: { ...fresh.dex, ...dexFromHistory(raw.history), ...(raw.dex || {}) },
    wardrobe: { ...fresh.wardrobe, ...(raw.wardrobe || {}), owned: { ...((raw.wardrobe && raw.wardrobe.owned) || {}) } },
    bag: { ...fresh.bag, ...(raw.bag || {}) },
    holding: raw.holding || null,
  };
}

function dexFromHistory(history) {
  const dex = {};
  for (const h of Array.isArray(history) ? history : []) {
    const key = formKey(h.stage, h.lineage);
    if (!dex[key]) dex[key] = h.at;
  }
  return dex;
}

// Weighted share of each stat, 0..1, summing to 1. Rare kinds of work count
// more, so every lineage is reachable (see STAT_WEIGHTS).
function affinity(stats) {
  const weighted = Object.fromEntries(STATS.map((s) => [s, (stats[s] || 0) * STAT_WEIGHTS[s]]));
  const total = Object.values(weighted).reduce((a, b) => a + b, 0);
  return Object.fromEntries(STATS.map((s) => [s, total ? weighted[s] / total : 0]));
}

function topStats(stats) {
  const a = affinity(stats);
  // Ties go to the earlier stat in STATS, so the result is stable.
  return [...STATS].sort((x, y) => a[y] - a[x] || STATS.indexOf(x) - STATS.indexOf(y));
}

// Levels, Pokémon-style: Lv 9 near the first evolution, Lv 25 at Adult,
// Lv 55 at Mythic, Lv 100 at 49,005 XP.
const MAX_LEVEL = 100;
function level(xp) {
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / 5)) + 1);
}
function xpForLevel(lv) {
  return 5 * (lv - 1) ** 2;
}

function form(pet) {
  return formName(pet.stage, pet.lineage);
}

function nextStage(pet) {
  return STAGES[stageIndex(pet.stage) + 1] || null;
}

// Progress toward the next stage, 0..1, and what still blocks it.
function progress(pet) {
  const current = STAGES[stageIndex(pet.stage)];
  const next = nextStage(pet);
  if (!next) return { ratio: 1, next: null, needsBond: false };
  const ratio = Math.max(0, Math.min(1, (pet.xp - current.xp) / (next.xp - current.xp)));
  return { ratio, next: next.id, xpToGo: Math.max(0, next.xp - pet.xp), needsBond: Boolean(next.bond && pet.bond < next.bond), bondNeeded: next.bond || 0 };
}

function view(pet) {
  return {
    name: displayName(pet),
    nickname: pet.name || null,
    bornAt: pet.bornAt,
    xp: pet.xp,
    stats: pet.stats,
    bond: pet.bond,
    stage: pet.stage,
    lineage: pet.lineage,
    trait: pet.trait,
    chimera: pet.chimera || null,
    nocturne: Boolean(pet.nocturne),
    seenNight: pet.seenNight || {},
    form: form(pet),
    formKey: formKey(pet.stage, pet.lineage),
    dexNo: dexEntries().findIndex((e) => e.key === formKey(pet.stage, pet.lineage)) + 1,
    nature: pet.nature,
    shiny: pet.shiny,
    generation: pet.generation,
    dex: pet.dex,
    affinity: affinity(pet.stats),
    level: level(pet.xp),
    nextLevelXp: level(pet.xp) >= MAX_LEVEL ? null : xpForLevel(level(pet.xp) + 1),
    leaning: pet.stage === 'egg' ? null : topStats(pet.stats)[0],
    progress: progress(pet),
    counters: pet.counters,
    today: { tokens: pet.daily.tokens || 0, waitMs: pet.daily.waitMs || 0, waits: pet.daily.waits || 0, fastestMs: pet.daily.fastestMs ?? null, day: pet.daily.day, missions: missionView(pet), perfect: Boolean(pet.daily.perfect) },
    achievements: pet.achievements,
    history: pet.history,
    hallOfFame: pet.hallOfFame || [],
    wardrobe: pet.wardrobe,
    wear: { head: pet.wardrobe.head, neck: pet.wardrobe.neck },
    cosmetics: cosmeticsView(pet),
    bag: pet.bag,
    holding: pet.holding,
    streak: pet.streak || { days: 0, best: 0 },
    region: pet.region || null,
    langs: pet.langs || {},
    dexRegions: pet.dexRegions || {},
    project: pet.project ?? null,
    id: pet.id || null,
    journal: [...(pet.journal || []), journalEntry(pet.daily)].filter((e) => e.day),
  };
}

// --- accessories and items ---------------------------------------------------

// When each accessory unlocks. Checked after every change; once owned,
// always owned.
const UNLOCKS = {
  cap: (p) => Boolean(p.achievements.hatch),
  party: (p) => Boolean(p.achievements['first-evolution']),
  beanie: (p) => (p.daily.activeDays || 0) >= 7,
  headphones: (p) => p.counters.testsGreen >= 50,
  flower: (p) => p.bond >= 50,
  nightcap: (p) => Boolean(p.achievements['night-owl']),
  wizard: (p) => (p.stats.lore || 0) >= 1500,
  crown: (p) => Boolean(p.achievements.mythic),
  scarf: (p) => (p.counters.perfectDays || 0) >= 1,
  bowtie: (p) => p.counters.turns >= 100,
  bandana: (p) => p.counters.tools >= 1000,
  medal: (p) => Boolean(p.achievements['quick-hands']),
};

// Progress toward each locked accessory, for the bag's hints.
const UNLOCK_PROGRESS = {
  beanie: (p) => [p.daily.activeDays || 0, 7],
  headphones: (p) => [p.counters.testsGreen, 50],
  flower: (p) => [p.bond, 50],
  wizard: (p) => [p.stats.lore || 0, 1500],
  scarf: (p) => [p.counters.perfectDays || 0, 1],
  bowtie: (p) => [p.counters.turns, 100],
  bandana: (p) => [p.counters.tools, 1000],
};

function cosmeticsView(pet) {
  return Object.entries(COSMETICS).map(([id, c]) => {
    const pr = UNLOCK_PROGRESS[id] ? UNLOCK_PROGRESS[id](pet) : null;
    return { id, slot: c.slot, owned: Boolean(pet.wardrobe.owned[id]), worn: pet.wardrobe[c.slot] === id, progress: pr ? { have: Math.min(pr[0], pr[1]), need: pr[1] } : null };
  });
}

function checkCosmetics(pet, now, events) {
  // Pets that evolved before the Bag existed still get their Everstone.
  if (!pet.gifts) pet.gifts = {};
  if (!pet.gifts.everstone && stageIndex(pet.stage) >= stageIndex('juvenile')) {
    pet.gifts.everstone = now;
    if (!pet.bag.everstone && pet.holding !== 'everstone') giveItem(pet, 'everstone', 1, events);
  }
  for (const [id, ok] of Object.entries(UNLOCKS)) {
    if (pet.wardrobe.owned[id] || !ok(pet)) continue;
    pet.wardrobe.owned[id] = now;
    events.push({ type: 'cosmetic', id, slot: COSMETICS[id].slot });
  }
}

// Tokens your agents used (read from Claude Code's conversation files).
function addTokens(pet, delta, now) {
  const events = [];
  rollDay(pet, now, events);
  const n = (delta.input || 0) + (delta.output || 0) + (delta.cacheWrite || 0);
  if (!n) return events;
  pet.daily.tokens = (pet.daily.tokens || 0) + n;
  pet.counters.tokens = (pet.counters.tokens || 0) + n;
  return events;
}

function giveItem(pet, item, n, events) {
  pet.bag[item] = (pet.bag[item] || 0) + n;
  events.push({ type: 'item', item, n, total: pet.bag[item] });
}

// Wear an owned accessory (or null to take the slot off).
function wear(pet, slot, id) {
  if (slot !== 'head' && slot !== 'neck') return [];
  if (id != null && (!COSMETICS[id] || COSMETICS[id].slot !== slot || !pet.wardrobe.owned[id])) return [];
  pet.wardrobe[slot] = id || null;
  return [{ type: 'wear', slot, id: id || null }];
}

// Use an item from the bag. Snack: +2 bond. Candy: one level up. Everstone:
// hold it to stop evolving (hold again to let go).
function useItem(pet, item, now) {
  const events = [];
  if (!ITEMS[item]) return events;
  rollDay(pet, now, events);
  if (item === 'everstone') {
    if (!pet.bag.everstone && pet.holding !== 'everstone') return [];
    pet.holding = pet.holding === 'everstone' ? null : 'everstone';
    events.push({ type: 'hold', item, holding: pet.holding });
    if (!pet.holding) evolve(pet, now, events);
    return events;
  }
  if (!pet.bag[item]) return [];
  if (pet.stage === 'egg') return [];
  pet.bag[item]--;
  const levelBefore = level(pet.xp);
  if (item === 'snack') {
    events.push({ type: 'fed', item });
    addBond(pet, 2, now, events);
  } else if (item === 'candy') {
    const target = xpForLevel(Math.min(MAX_LEVEL, level(pet.xp) + 1));
    const gain = Math.max(0, target - pet.xp);
    pet.xp += gain;
    events.push({ type: 'fed', item }, { type: 'xp', amount: gain, xp: pet.xp });
  }
  checkCosmetics(pet, now, events);
  evolve(pet, now, events);
  if (level(pet.xp) > levelBefore) events.push({ type: 'level', level: level(pet.xp) });
  return events;
}

// --- mutations. Each returns a list of events for the UI. -------------------

// The same three missions for everyone on the same day, from a day hash.
function missionsFor(day) {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...MISSIONS];
  const picked = [];
  while (picked.length < 3) {
    h = (h * 1103515245 + 12345) >>> 0;
    picked.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picked.map((m) => ({ id: m.id, done: false }));
}

// One line per day of agent work, for the journal.
const JOURNAL_DAYS = 60;
function journalEntry(d) {
  return {
    day: d.day,
    tools: d.tools || 0,
    edits: d.edits || 0,
    green: d.green || 0,
    red: d.red || 0,
    turns: d.turns || 0,
    waitMs: d.waitMs || 0,
    waits: d.waits || 0,
    fastestMs: d.fastestMs ?? null,
    tokens: d.tokens || 0,
    families: { ...(d.families || {}) },
    projects: { ...(d.projects || {}) },
  };
}

// Counts a finished tool by kind of work and by project (top 12 kept).
function countWork(pet, signal) {
  const d = pet.daily;
  if (signal.family) {
    d.families = d.families || {};
    d.families[signal.family] = (d.families[signal.family] || 0) + 1;
  }
  if (signal.label) {
    d.projects = d.projects || {};
    if (d.projects[signal.label] != null || Object.keys(d.projects).length < 12) d.projects[signal.label] = (d.projects[signal.label] || 0) + 1;
  }
}

function rollDay(pet, now, events) {
  const day = dayKey(now);
  if (pet.daily.day === day) {
    if (!Array.isArray(pet.daily.missions)) pet.daily.missions = missionsFor(day);
    return;
  }
  const previous = pet.daily.day;
  // Yesterday goes into the journal (the last 60 days are kept), and the
  // first thing today is a one-line summary of it.
  if (previous) {
    const entry = journalEntry(pet.daily);
    pet.journal = [...(pet.journal || []), entry].slice(-JOURNAL_DAYS);
    if (entry.tools || entry.turns) events.push({ type: 'yesterday', entry });
  }
  pet.daily = { day, pets: 0, fastAnswers: 0, waitMs: 0, waits: 0, fastestMs: null, tools: 0, edits: 0, green: 0, turns: 0, missions: missionsFor(day), perfect: false, activeDays: (pet.daily.activeDays || 0) + 1 };
  // Streak: consecutive days with your agent. A missed day starts over.
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  pet.streak = { days: previous === yesterday ? ((pet.streak && pet.streak.days) || 0) + 1 : 1, best: Math.max((pet.streak && pet.streak.best) || 0, 1) };
  pet.streak.best = Math.max(pet.streak.best, pet.streak.days);
  if (pet.daily.activeDays > 1) {
    addBond(pet, 1, now, events);
    // A small gift every new day, and a candy every 7 days in a row.
    giveItem(pet, 'snack', 1, events);
    events.push({ type: 'daily-gift', streak: pet.streak.days });
    if (pet.streak.days % 7 === 0) giveItem(pet, 'candy', 1, events);
  }
}

function missionView(pet) {
  return (pet.daily.missions || []).map((m) => {
    const def = MISSIONS.find((x) => x.id === m.id);
    return { id: m.id, target: def.target, progress: Math.min(def.target, pet.daily[def.counter] || 0), done: m.done };
  });
}

// Rewards missions as soon as their counter reaches the target.
function checkMissions(pet, now, events) {
  const list = pet.daily.missions || [];
  for (const m of list) {
    if (m.done) continue;
    const def = MISSIONS.find((x) => x.id === m.id);
    if ((pet.daily[def.counter] || 0) < def.target) continue;
    m.done = true;
    pet.xp += MISSION_XP;
    events.push({ type: 'xp', amount: MISSION_XP, xp: pet.xp });
    addBond(pet, 2, now, events);
    events.push({ type: 'mission', id: m.id, target: def.target, xp: MISSION_XP });
    giveItem(pet, 'snack', 1, events);
  }
  if (list.length && !pet.daily.perfect && list.every((m) => m.done)) {
    pet.daily.perfect = true;
    pet.xp += PERFECT_DAY_XP;
    events.push({ type: 'xp', amount: PERFECT_DAY_XP, xp: pet.xp });
    events.push({ type: 'missions-all', xp: PERFECT_DAY_XP });
    pet.counters.perfectDays = (pet.counters.perfectDays || 0) + 1;
    giveItem(pet, 'candy', 1, events);
  }
}

function addBond(pet, amount, now, events) {
  const before = pet.bond;
  pet.bond = Math.min(BOND_MAX, pet.bond + amount);
  if (pet.bond > before) events.push({ type: 'bond', amount: pet.bond - before, bond: pet.bond });
  if (pet.bond >= BOND_MAX) unlock(pet, 'best-friends', now, events);
}

function addXp(pet, amount, now, events) {
  pet.xpLog = pet.xpLog.filter(([at]) => now - at < XP_WINDOW_MS);
  const used = pet.xpLog.reduce((sum, [, xp]) => sum + xp, 0);
  const granted = Math.max(0, Math.min(amount, XP_WINDOW_CAP - used));
  if (!granted) return;
  pet.xp += granted;
  pet.xpLog.push([now, granted]);
  events.push({ type: 'xp', amount: granted, xp: pet.xp });
}

function unlock(pet, id, now, events) {
  if (pet.achievements[id] || !ACHIEVEMENTS[id]) return;
  pet.achievements[id] = now;
  events.push({ type: 'achievement', id, ...ACHIEVEMENTS[id] });
}

const REGION_MIN = 50;
const REGION_SHARE = 0.6;
function regionOf(langs) {
  const entries = Object.entries(langs || {});
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (total < REGION_MIN) return null;
  const [lang, n] = entries.sort((a, b) => b[1] - a[1])[0];
  return n / total >= REGION_SHARE ? lang : null;
}

function evolve(pet, now, events) {
  for (;;) {
    const next = nextStage(pet);
    if (!next || pet.xp < next.xp || (next.bond && pet.bond < next.bond)) return;
    if (pet.holding === 'everstone' && pet.stage !== 'egg') return;
    const from = form(pet);
    const ranked = topStats(pet.stats);
    pet.stage = next.id;
    if (next.id !== 'sprout') {
      const aff = affinity(pet.stats);
      const grown = stageIndex(next.id) >= stageIndex('adult');
      if (grown && aff[ranked[0]] - aff[ranked[1]] < CHIMERA_GAP && aff[ranked[1]] >= CHIMERA_MIN) {
        pet.lineage = 'chimera';
        pet.chimera = [ranked[0], ranked[1]];
        pet.trait = ranked[2];
      } else {
        pet.lineage = ranked[0];
        pet.chimera = null;
        pet.trait = grown ? ranked[1] : null;
      }
      // Evolving between midnight and 5 am gives the Nocturne colouring,
      // decided again at every evolution (Pokémon-style time evolution).
      pet.nocturne = new Date(now).getHours() < 5;
      // Regional form: raised mostly on one language (60% of 50+ files).
      pet.region = regionOf(pet.langs);
      if (pet.region) pet.dexRegions = { ...(pet.dexRegions || {}), [`${formKey(pet.stage, pet.lineage)}.${pet.region}`]: now };
      if (pet.nocturne) {
        pet.seenNight = { ...(pet.seenNight || {}), [formKey(pet.stage, pet.lineage)]: now };
        unlock(pet, 'nocturne', now, events);
      }
    }
    pet.counters.evolutions++;
    pet.history.push({ stage: pet.stage, form: form(pet), lineage: pet.lineage, at: now });
    const key = formKey(pet.stage, pet.lineage);
    const firstTime = !pet.dex[key];
    if (firstTime) pet.dex[key] = now;
    events.push({ type: 'evolve', from, to: form(pet), stage: pet.stage, lineage: pet.lineage, trait: pet.trait, chimera: pet.chimera || null, nocturne: Boolean(pet.nocturne), shiny: pet.shiny, region: pet.region || null, newDex: firstTime });
    if (pet.stage === 'sprout') unlock(pet, 'hatch', now, events);
    if (pet.stage === 'sprout' && pet.shiny) unlock(pet, 'shiny', now, events);
    if (pet.stage === 'juvenile') {
      unlock(pet, 'first-evolution', now, events);
      if (!pet.gifts) pet.gifts = {};
      if (!pet.gifts.everstone) {
        pet.gifts.everstone = now;
        if (!pet.bag.everstone && pet.holding !== 'everstone') giveItem(pet, 'everstone', 1, events);
      }
    }
    if (pet.stage === 'mythic') unlock(pet, 'mythic', now, events);
    if (pet.lineage === 'chimera') unlock(pet, 'hidden', now, events);
  }
}

// signal: from classify(). ctx: from sessions.apply().
function applySignal(pet, signal, ctx = {}, now) {
  const events = [];
  if (!signal) return events;
  const levelBefore = level(pet.xp);
  rollDay(pet, now, events);
  const c = pet.counters;

  const reaction = ctx.reaction;
  if (reaction && reaction.reason !== 'idle') {
    c.answers++;
    // Time the agent sat waiting for you: the number the pet helps shrink.
    const ms = Math.max(0, Math.min(reaction.ms, 6 * 60 * 60 * 1000));
    c.waitMs += ms;
    pet.daily.waitMs = (pet.daily.waitMs || 0) + ms;
    pet.daily.waits = (pet.daily.waits || 0) + 1;
    if (pet.daily.fastestMs == null || ms < pet.daily.fastestMs) pet.daily.fastestMs = ms;
    if (reaction.ms <= FAST_ANSWER_MS) {
      c.fastAnswers++;
      pet.daily.fastAnswers++;
      addBond(pet, 2, now, events);
      addXp(pet, XP.fastAnswer, now, events);
      if (pet.daily.fastAnswers >= 10) unlock(pet, 'quick-hands', now, events);
    } else if (reaction.ms <= OK_ANSWER_MS) {
      addBond(pet, 1, now, events);
    }
  }

  switch (signal.kind) {
    case 'tool-done':
      c.tools++;
      pet.daily.tools = (pet.daily.tools || 0) + 1;
      if (signal.family === 'craft') {
        c.edits++;
        pet.daily.edits = (pet.daily.edits || 0) + 1;
      }
      if (signal.family && pet.stats[signal.family] != null) pet.stats[signal.family]++;
      if (signal.lang) pet.langs = { ...(pet.langs || {}), [signal.lang]: ((pet.langs || {})[signal.lang] || 0) + 1 };
      countWork(pet, signal);
      addXp(pet, XP.tool, now, events);
      break;
    case 'tool-fail':
      c.tools++;
      c.fails++;
      if (signal.family && pet.stats[signal.family] != null) pet.stats[signal.family]++;
      addXp(pet, XP.fail, now, events);
      break;
    case 'test-end':
      c.tools++;
      pet.daily.tools = (pet.daily.tools || 0) + 1;
      countWork(pet, { ...signal, family: 'test' });
      if (signal.passed === true) {
        c.testsGreen++;
        pet.daily.green = (pet.daily.green || 0) + 1;
        pet.stats.test += 3;
        addXp(pet, XP.green, now, events);
        events.push({ type: 'tests', passed: true });
        unlock(pet, 'first-green', now, events);
        if (c.testsGreen >= 100) unlock(pet, 'green-100', now, events);
      } else {
        if (signal.passed === false) {
          c.testsRed++;
          pet.daily.red = (pet.daily.red || 0) + 1;
        }
        pet.stats.test++;
        addXp(pet, XP.tool, now, events);
        events.push({ type: 'tests', passed: signal.passed });
      }
      break;
    case 'turn-end':
      c.turns++;
      pet.daily.turns = (pet.daily.turns || 0) + 1;
      addXp(pet, XP.turn, now, events);
      break;
    default:
      break;
  }

  if (c.edits >= 1000) unlock(pet, 'edits-1000', now, events);
  if ((ctx.turnTools || 0) >= 50) unlock(pet, 'marathon', now, events);
  if ((ctx.workingSessions || 0) >= 5) unlock(pet, 'swarm', now, events);
  if (signal.kind.startsWith('tool') && new Date(now).getHours() < 5) unlock(pet, 'night-owl', now, events);

  checkMissions(pet, now, events);
  evolve(pet, now, events);
  checkCosmetics(pet, now, events);
  if (level(pet.xp) > levelBefore) events.push({ type: 'level', level: level(pet.xp) });
  return events;
}

// The user clicked the pet.
function petIt(pet, now) {
  const events = [];
  rollDay(pet, now, events);
  pet.counters.pets++;
  events.push({ type: 'petted' });
  if (pet.daily.pets < PETS_PER_DAY) {
    pet.daily.pets++;
    addBond(pet, 1, now, events);
  }
  checkMissions(pet, now, events);
  evolve(pet, now, events);
  checkCosmetics(pet, now, events);
  return events;
}

// Post-game: a Mythic pet retires to the Hall of Fame and leaves an egg.
// The Opendex, achievements and Hall of Fame carry over, and the egg
// inherits a tenth of its parent's stats, so the next one starts leaning
// the same way unless your work changes.
function layEgg(pet, now, rng = Math.random) {
  if (pet.stage !== 'mythic') return { pet, events: [] };
  const retired = { name: displayName(pet), form: form(pet), lineage: pet.lineage, shiny: pet.shiny, nature: pet.nature, generation: pet.generation, bornAt: pet.bornAt, retiredAt: now };
  // A new creature: it starts with no nickname.
  const egg = createPet(now, DEFAULT_NAME, rng);
  egg.generation = (pet.generation || 1) + 1;
  egg.dex = { ...pet.dex };
  egg.achievements = { ...pet.achievements };
  egg.wardrobe = { owned: { ...pet.wardrobe.owned }, head: null, neck: null };
  egg.bag = { ...pet.bag, everstone: (pet.bag.everstone || 0) + (pet.holding === 'everstone' ? 1 : 0) };
  egg.hallOfFame = [...(pet.hallOfFame || []), retired];
  egg.stats = Object.fromEntries(STATS.map((s) => [s, Math.floor((pet.stats[s] || 0) / 10)]));
  return { pet: egg, events: [{ type: 'new-egg', generation: egg.generation, retired }] };
}

// An empty name clears the nickname: the pet goes back to its species name.
function rename(pet, name) {
  const clean = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
  pet.name = clean || null;
  return [{ type: 'renamed', name: displayName(pet) }];
}

function displayName(pet) {
  return pet.name || form(pet);
}

module.exports = {
  createPet,
  migrate,
  applySignal,
  petIt,
  rename,
  layEgg,
  view,
  form,
  progress,
  topStats,
  affinity,
  level,
  xpForLevel,
  displayName,
  regionOf,
  wear,
  useItem,
  addTokens,
  checkCosmetics,
  missionsFor,
  dayKey,
  XP,
  XP_WINDOW_CAP,
  XP_WINDOW_MS,
  FAST_ANSWER_MS,
};
