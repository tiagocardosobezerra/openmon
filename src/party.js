'use strict';

// Party and Box: one Openmon per project, a team you collect.
//
// pet.json is still the pet on screen (the "active" one). Its `others`
// array holds the rest of your Openmons. Everything that belongs to you as a
// trainer (Opendex, badges, Bag, owned accessories, journal, missions,
// streak, counters) lives on the active pet and is shared; everything that
// belongs to one creature (level, type, nickname, worn accessories, its
// project) is kept per pet.
//
// Each project (the folder an agent works in) feeds its own pet while that pet
// is in the Party. Everything else feeds the main pet on screen, and a project
// earns an egg of its own after enough work.

const crypto = require('node:crypto');
const pet = require('./pet');
const { ACHIEVEMENTS } = require('./species');

const PARTY_SIZE = 6;
// Real work in a project before it earns its own egg: one-off folders never do.
const EGG_AFTER_ACTIONS = 60;
const PER_PET = ['id', 'name', 'bornAt', 'nature', 'shiny', 'generation', 'xp', 'stats', 'bond', 'stage', 'lineage', 'trait', 'starter', 'awaitingStarter', 'chimera', 'history', 'holding', 'project', 'place', 'legend', 'xpLog'];

const newId = () => crypto.randomBytes(6).toString('hex');

// Fills in party fields on an old single-pet save. Nothing is lost.
function ensure(root) {
  if (!root.id) root.id = newId();
  if (root.project === undefined) root.project = null;
  if (!root.place) root.place = 'party';
  if (!Array.isArray(root.others)) root.others = [];
  if (!root.projects || typeof root.projects !== 'object') root.projects = {};
  for (const m of root.others) {
    if (!m.id) m.id = newId();
    if (!m.place) m.place = 'party';
    if (!m.worn) m.worn = { head: null, face: null, neck: null };
    // The 10-minute XP cap is per pet (older saves shared one).
    if (!Array.isArray(m.xpLog)) m.xpLog = [];
    if (m.worn.face === undefined) m.worn.face = null;
    // Legendaries arrive at Elder level (older saves gave them level 1).
    if (m.legend && (m.xp || 0) < 15000) m.xp = 15000;
    pet.dropVariants(pet.dropSprout(m));
  }
  return root;
}

// The member's own fields, taken from a full pet object.
function own(full) {
  const out = {};
  for (const k of PER_PET) if (full[k] !== undefined) out[k] = full[k];
  const w = full.wardrobe || {};
  out.worn = { head: w.head || null, face: w.face || null, neck: w.neck || null };
  return out;
}

// A full pet object for `member`, with the trainer's shared state from root.
function merge(root, member) {
  const shared = { ...root };
  delete shared.others;
  for (const k of PER_PET) delete shared[k];
  return {
    ...shared,
    ...member,
    wardrobe: { owned: root.wardrobe.owned, head: (member.worn && member.worn.head) || null, face: (member.worn && member.worn.face) || null, neck: (member.worn && member.worn.neck) || null },
  };
}

// Writes a merged object back: shared parts to root, own parts to member.
function split(root, member, merged) {
  for (const [k, v] of Object.entries(merged)) {
    if (k === 'others' || k === 'worn') continue;
    if (PER_PET.includes(k)) member[k] = v;
    else if (k === 'wardrobe') {
      root.wardrobe.owned = v.owned;
      member.worn = { head: v.head || null, face: v.face || null, neck: v.neck || null };
    } else root[k] = v;
  }
}

// The project a signal's work belongs to; null feeds the main pet on screen.
function projectOf(signal) {
  return signal.scratch ? null : signal.label || null;
}

// Which pet a project's work feeds: the project's own pet while it is in the
// Party; anything else (no project, a project without a pet, a pet resting
// in the Box) feeds the main pet on screen. Pets in the Box do not train.
function petFor(root, project) {
  if (project === null || root.project === project) return root;
  return root.others.find((m) => m.project === project && m.place === 'party') || root;
}

// Applies a hook signal to the right pet. Returns events; events about a pet
// that is not on screen carry `petId` and `project`.
// petId: the pet on screen this session was handed to (see the daemon),
// for work that has no pet of its own.
function applySignal(root, signal, ctx, now, petId = null) {
  ensure(root);
  const chosen = petId && petId !== root.id ? root.others.find((m) => m.id === petId && m.place === 'party') : null;
  const target = chosen || petFor(root, projectOf(signal));
  let events;
  if (target === root) events = pet.applySignal(root, signal, ctx, now);
  else {
    const merged = merge(root, target);
    events = pet.applySignal(merged, signal, ctx, now);
    split(root, target, merged);
    for (const e of events) {
      if (['evolve', 'level', 'xp', 'bond', 'tests'].includes(e.type)) {
        e.petId = target.id;
        e.project = target.project;
        e.petName = pet.displayName(merged);
      }
    }
  }
  events.push(...countProject(root, signal, now));
  events.push(...checkLegends(root, now));
  return events;
}

// A new member: in the Party if there is room, else in the Box.
function addMember(root, member) {
  member.id = newId();
  member.place = partyCount(root) < PARTY_SIZE ? 'party' : 'box';
  member.worn = { head: null, face: null, neck: null };
  root.others.push(member);
  return member;
}

// Legendaries join once, the first time their feat is done: Mergeon for the
// first merged pull request, Aeonbyte after a year as a trainer, Zeroday
// for 100 fixes. They never evolve and no project feeds them.
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const LEGEND_FEATS = {
  mergeon: (r) => (r.counters.merges || 0) >= 1,
  aeonbyte: (r, now) => now - (r.trainerSince || r.bornAt || now) >= YEAR_MS,
  zeroday: (r) => (r.counters.fixes || 0) >= 100,
};
function checkLegends(root, now) {
  const events = [];
  root.legends = root.legends || {};
  for (const [id, done] of Object.entries(LEGEND_FEATS)) {
    if (root.legends[id] || !done(root, now)) continue;
    root.legends[id] = now;
    const mon = own(pet.createPet(now));
    Object.assign(mon, { legend: id, stage: 'mythic', lineage: null, project: `legend:${id}`, bond: 50, xp: 15000, history: [{ stage: 'legendary', form: id, at: now }] });
    addMember(root, mon);
    root.dex[id] = root.dex[id] || now;
    if (!root.achievements.legend) {
      root.achievements.legend = now;
      events.push({ type: 'achievement', id: 'legend', ...ACHIEVEMENTS.legend });
    }
    events.push({ type: 'legend', id, petId: mon.id, place: mon.place, shiny: mon.shiny });
  }
  return events;
}

// How many of each item the other members hold (the Bag is shared).
function heldByOthers(root) {
  const held = {};
  for (const m of root.others || []) if (m.holding) held[m.holding] = (held[m.holding] || 0) + 1;
  return held;
}

// A mystery egg from the Bag: a new egg with better shiny odds (1 in 16).
function hatchMystery(root, now, rng = Math.random) {
  ensure(root);
  const egg = own(pet.createPet(now));
  egg.shiny = rng() < 1 / 16;
  egg.project = `mystery:${newId()}`;
  addMember(root, egg);
  root.dex.egg = root.dex.egg || now;
  return [{ type: 'mystery-hatch', petId: egg.id, place: egg.place }];
}

// Counts real work per project; enough of it earns that project an egg.
function countProject(root, signal, now) {
  const label = projectOf(signal);
  if (!label || !['tool-done', 'tool-fail', 'test-end'].includes(signal.kind)) return [];
  const seen = (root.projects[label] = (root.projects[label] || 0) + 1);
  if (seen < EGG_AFTER_ACTIONS || root.project === label || root.others.some((m) => m.project === label)) return [];
  const egg = own(pet.createPet(now));
  egg.project = label;
  addMember(root, egg);
  root.dex.egg = root.dex.egg || now;
  return [{ type: 'project-egg', project: label, petId: egg.id, place: egg.place }];
}

function partyCount(root) {
  return (root.place === 'party' ? 1 : 0) + root.others.filter((m) => m.place === 'party').length;
}

// Puts another pet on screen. Returns the new root (the old one joins others).
function setActive(root, id) {
  ensure(root);
  const member = root.others.find((m) => m.id === id);
  if (!member) return root;
  const next = merge(root, member);
  next.place = 'party';
  next.others = [...root.others.filter((m) => m !== member), own(root)];
  if (member.place === 'box') {
    // It comes out of the Box; if the party is full, the old one goes in.
    if (partyCount(next) > PARTY_SIZE) next.others[next.others.length - 1].place = 'box';
  }
  return next;
}

// Moves a pet (not the one on screen) between the Party and the Box.
function move(root, id, place) {
  ensure(root);
  const member = root.others.find((m) => m.id === id);
  if (!member || (place !== 'party' && place !== 'box')) return false;
  if (place === 'party' && member.place !== 'party' && partyCount(root) >= PARTY_SIZE) return false;
  member.place = place;
  return true;
}

// Picks the starter of the egg that waits for one: the pet on screen, or
// a member if the player put another pet on screen meanwhile.
function chooseStarter(root, lineage, now) {
  ensure(root);
  if (root.awaitingStarter) return pet.chooseStarter(root, lineage, now);
  const member = root.others.find((m) => m.awaitingStarter);
  if (!member) return [];
  const merged = merge(root, member);
  const events = pet.chooseStarter(merged, lineage, now);
  split(root, member, merged);
  for (const e of events) if (['evolve', 'starter'].includes(e.type)) Object.assign(e, { petId: member.id, project: member.project, petName: pet.displayName(merged) });
  return events;
}

function renameMember(root, id, name) {
  ensure(root);
  if (root.id === id) return pet.rename(root, name);
  const member = root.others.find((m) => m.id === id);
  if (!member) return [];
  const merged = merge(root, member);
  const events = pet.rename(merged, name);
  member.name = merged.name;
  return events;
}

// What the Party page shows for every pet.
function view(root) {
  ensure(root);
  const summary = (full, active) => {
    const v = pet.view(full);
    return { id: full.id, active, place: full.place || 'party', project: full.project ?? null, name: v.name, nickname: v.nickname, form: v.form, formKey: v.formKey, stage: v.stage, lineage: v.lineage, awaitingStarter: v.awaitingStarter, trait: v.trait, chimera: v.chimera, level: v.level, shiny: v.shiny, wear: v.wear, progress: v.progress.ratio, xp: v.xp, legend: v.legend };
  };
  const list = [summary(root, true), ...root.others.map((m) => summary(merge(root, m), false))];
  const projects = Object.entries(root.projects || {})
    .filter(([label]) => !list.some((p) => p.project === label))
    .map(([label, actions]) => ({ project: label, actions, needed: EGG_AFTER_ACTIONS }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 6);
  // Sent in a trade and not brought back: the code stays at hand.
  const sent = (root.outbox || []).map((o) => ({ tid: o.tid, code: o.code, at: o.at, name: pet.displayName(merge(root, o.member)), formKey: pet.view(merge(root, o.member)).formKey }));
  return { held: heldByOthers(root), size: PARTY_SIZE, members: list.filter((p) => p.place === 'party'), box: list.filter((p) => p.place === 'box'), upcoming: projects, sent };
}

// Trading with a friend: a member (not the one on screen, not an egg or a
// legendary) leaves your team as a code and waits in your "sent" list until
// you bring it back; whoever pastes the code in their Team gets it. A code
// works once on each computer. Without a server nothing can stop a code from
// being used on two computers, or brought back after a friend used it: a
// trade is a gift between people who trust each other. The checksum only
// catches a code cut short when copied.
const TRADE_PREFIX = 'OPENMON1';
const TRADE_FIELDS = ['name', 'bornAt', 'nature', 'shiny', 'generation', 'xp', 'stats', 'bond', 'stage', 'lineage', 'trait', 'chimera', 'history'];
const tradeSum = (body) => crypto.createHash('sha256').update(body).digest('hex').slice(0, 8);

function tradeOut(root, id, now) {
  ensure(root);
  const member = root.others.find((m) => m.id === id);
  if (!member || member.legend || member.awaitingStarter || member.stage === 'egg') return null;
  const tid = newId();
  const data = { tid, at: now };
  for (const k of TRADE_FIELDS) if (member[k] !== undefined) data[k] = member[k];
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const code = `${TRADE_PREFIX}.${body}.${tradeSum(body)}`;
  root.others = root.others.filter((m) => m !== member);
  root.outbox = [...(Array.isArray(root.outbox) ? root.outbox : []), { tid, code, at: now, member }];
  return code;
}

// Brings back a member you sent (its code stops working here).
function tradeCancel(root, tid) {
  ensure(root);
  const sent = (root.outbox || []).find((o) => o.tid === tid);
  if (!sent) return null;
  root.outbox = root.outbox.filter((o) => o !== sent);
  root.received = [...(Array.isArray(root.received) ? root.received : []), tid];
  const member = sent.member;
  member.place = partyCount(root) < PARTY_SIZE ? 'party' : 'box';
  root.others.push(member);
  return { ok: true, place: member.place, name: pet.displayName(merge(root, member)) };
}

// Everything in a code comes from someone else: each field is checked and
// rebuilt, never copied as it came.
function cleanTrade(data, now) {
  const { STATS, NATURES } = require('./species');
  const num = (v, lo, hi, dflt) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt);
  if (!data || typeof data !== 'object' || typeof data.tid !== 'string' || !/^[a-f0-9]{6,32}$/.test(data.tid)) return null;
  if (!['juvenile', 'adult', 'mythic'].includes(data.stage)) return null;
  const chimera = data.lineage === 'chimera' && Array.isArray(data.chimera) && data.chimera.length === 2 && data.chimera.every((t) => STATS.includes(t)) ? [...data.chimera] : null;
  if (!STATS.includes(data.lineage) && !chimera) return null;
  const stats = {};
  for (const k of STATS) stats[k] = Math.round(num(data.stats && typeof data.stats === 'object' ? data.stats[k] : 0, 0, 1e9, 0));
  const history = Array.isArray(data.history)
    ? data.history.slice(-30).filter((h) => h && typeof h === 'object' && ['egg', 'juvenile', 'adult', 'mythic'].includes(h.stage)).map((h) => ({ stage: h.stage, form: String(h.form || '').slice(0, 40), lineage: typeof h.lineage === 'string' ? h.lineage.slice(0, 20) : null, at: num(h.at, 0, now, now) }))
    : [];
  return {
    tid: data.tid,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : null,
    bornAt: num(data.bornAt, 0, now, now),
    nature: Object.hasOwn(NATURES, data.nature) ? data.nature : 'calm',
    shiny: data.shiny === true,
    generation: Math.round(num(data.generation, 1, 999, 1)),
    xp: Math.round(num(data.xp, 0, 10_000_000, 0)),
    stats,
    bond: Math.round(num(data.bond, 0, 100, 0)),
    stage: data.stage,
    lineage: data.lineage,
    trait: STATS.includes(data.trait) ? data.trait : null,
    chimera,
    history,
  };
}

function tradeIn(root, code, now) {
  ensure(root);
  const m = /^OPENMON1\.([A-Za-z0-9_-]{10,20000})\.([0-9a-f]{8})$/.exec(String(code || '').replace(/\s+/g, ''));
  if (!m || tradeSum(m[1]) !== m[2]) return { ok: false, reason: 'invalid' };
  let raw;
  try {
    raw = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const data = cleanTrade(raw, now);
  if (!data) return { ok: false, reason: 'invalid' };
  // Your own code: it comes back from the "sent" list.
  if ((root.outbox || []).some((o) => o.tid === data.tid)) return tradeCancel(root, data.tid);
  root.received = Array.isArray(root.received) ? root.received : [];
  if (root.received.includes(data.tid)) return { ok: false, reason: 'used' };
  const { tid, ...fields } = data;
  const member = { ...fields, xpLog: [], project: `trade:${fields.name || ''}`, holding: null };
  addMember(root, member);
  root.received = [...root.received, tid];
  // A form you had never seen counts as seen.
  const key = `${member.lineage}-${member.stage}`;
  if (root.dex && !root.dex[key]) root.dex[key] = now;
  return { ok: true, place: member.place, name: pet.displayName(merge(root, member)) };
}

module.exports = { tradeOut, tradeIn, tradeCancel, ensure, addMember, applySignal, chooseStarter, setActive, move, renameMember, view, merge, split, petFor, projectOf, checkLegends, hatchMystery, heldByOthers, PARTY_SIZE, EGG_AFTER_ACTIONS };
