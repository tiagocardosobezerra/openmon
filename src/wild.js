'use strict';
// Wild encounters: now and then an action of the agent makes a wild Openmon
// show up next to the pet. With an Openball in the Bag the trainer can try
// to catch it. Odds are powers of two, like the shiny's 1 in 128.

const pet = require('./pet');
const { STATS, STAGES, SHINY_ODDS, ACHIEVEMENTS, formName, formKey } = require('./species');

const WILD_ODDS = 1024; // one finished action in 1,024 (2^10) starts an encounter
const SAME_TYPE = 3 / 4; // the wild one is of the triggering action's type
const CATCH = 3 / 4; // one Openball, one try
const STAY = 1 / 2; // after a miss it stays for another try, or runs off
const STAY_MS = 10 * 60 * 1000;
const GAP_MS = 2 * 60 * 60 * 1000;
const PER_DAY = 1;
const MANY = 10;

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The wild one on screen, or null once it has left.
function current(root, now) {
  const w = root.wild;
  return w && w.until > now ? w : null;
}

// A wild one that stayed past its time leaves quietly.
function expire(root, now) {
  if (root.wild && root.wild.until <= now) {
    root.wild = null;
    return [{ type: 'wild-left' }];
  }
  return [];
}

function unlock(root, id, now, events) {
  if (root.achievements[id] || !ACHIEVEMENTS[id]) return;
  root.achievements[id] = now;
  events.push({ type: 'achievement', id, ...ACHIEVEMENTS[id] });
}

// Called for every signal of the real pet. `allowed` is false in quiet and
// presentation modes and when encounters are turned off.
function roll(root, signal, now, rng = Math.random, allowed = true) {
  const events = expire(root, now);
  if (!allowed || signal.kind !== 'tool-done' || current(root, now)) return events;
  const log = root.wildLog || { day: null, today: 0, last: 0 };
  const today = log.day === dayKey(now) ? log.today : 0;
  if (today >= PER_DAY || now - (log.last || 0) < GAP_MS) return events;
  if (rng() >= 1 / WILD_ODDS) return events;
  const own = STATS.includes(signal.family) ? signal.family : null;
  const lineage = own && rng() < SAME_TYPE ? own : STATS[Math.floor(rng() * STATS.length) % STATS.length];
  const shiny = rng() < 1 / SHINY_ODDS;
  root.wild = { lineage, shiny, name: formName('juvenile', lineage), at: now, until: now + STAY_MS, tries: 0 };
  root.wildLog = { day: dayKey(now), today: today + 1, last: now };
  root.wildSeen = { ...(root.wildSeen || {}), [lineage]: root.wildSeen && root.wildSeen[lineage] ? root.wildSeen[lineage] : now };
  events.push({ type: 'wild', lineage, shiny, name: formName('juvenile', lineage), until: root.wild.until });
  if (STATS.every((s) => root.wildSeen[s])) unlock(root, 'wild-all', now, events);
  return events;
}

// One Openball at the wild one. `addMember` puts the caught one in the team
// (party.js passes its own, so this module does not depend on it).
function throwBall(root, now, addMember, rng = Math.random) {
  const events = expire(root, now);
  const w = current(root, now);
  if (!w || !((root.bag && root.bag.openball) > 0)) return events;
  root.bag.openball--;
  w.tries++;
  if (rng() < CATCH) {
    root.wild = null;
    const mon = pet.createPet(now);
    const key = formKey('juvenile', w.lineage);
    Object.assign(mon, {
      stage: 'juvenile',
      lineage: w.lineage,
      // Caught as what it is: its lineage stays, like a starter's.
      starter: w.lineage,
      shiny: w.shiny,
      xp: STAGES.find((s) => s.id === 'juvenile').xp,
      bond: 10,
      project: `wild:${now.toString(36)}`,
      history: [{ stage: 'juvenile', form: formName('juvenile', w.lineage), at: now, wild: true }],
    });
    const member = addMember(root, mon);
    root.dex[key] = root.dex[key] || now;
    root.counters.catches = (root.counters.catches || 0) + 1;
    // memberId, not petId: a petId marks an event of another pet's window.
    events.push({ type: 'wild-caught', lineage: w.lineage, shiny: w.shiny, name: formName('juvenile', w.lineage), memberId: member.id, place: member.place });
    unlock(root, 'first-catch', now, events);
    if (w.shiny) unlock(root, 'catch-shiny', now, events);
    if (root.counters.catches >= MANY) unlock(root, 'catch-10', now, events);
    return events;
  }
  if (rng() < STAY) {
    events.push({ type: 'wild-missed', lineage: w.lineage });
  } else {
    root.wild = null;
    events.push({ type: 'wild-fled', lineage: w.lineage });
  }
  return events;
}

// "Let it go": it leaves at once.
function release(root, now) {
  if (!current(root, now)) return [];
  root.wild = null;
  return [{ type: 'wild-left' }];
}

module.exports = { roll, throwBall, release, current, expire, WILD_ODDS, CATCH, STAY, STAY_MS, GAP_MS, PER_DAY, SAME_TYPE };
