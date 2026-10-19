'use strict';

// Playground: a sandbox for trying every Openmon feature in minutes instead
// of weeks. Only a daemon started with { playground: true } exposes these
// actions, and that daemon runs with its own data folder (`openmon
// playground`), so the real pet is never touched.

const pet = require('./pet');
const { STAGES, STATS, STAT_WEIGHTS, NATURES, ACHIEVEMENTS, stageIndex, formKey } = require('./species');

function atHour(now, hour) {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

// Stats that make `lineage` lead (and `trait` come second), or a dead heat
// between the two halves of a Chimera.
function statsFor({ lineage, trait, chimera }) {
  const stats = Object.fromEntries(STATS.map((s) => [s, Math.round(20 / STAT_WEIGHTS[s])]));
  if (chimera) {
    for (const s of chimera) stats[s] = Math.round(1000 / STAT_WEIGHTS[s]);
    return stats;
  }
  if (lineage && STAT_WEIGHTS[lineage]) stats[lineage] = Math.round(2000 / STAT_WEIGHTS[lineage]);
  if (trait && trait !== lineage && STAT_WEIGHTS[trait]) stats[trait] = Math.round(800 / STAT_WEIGHTS[trait]);
  return stats;
}

function createPlayground({ getPet, setPet, now, applyEvents, ingest, bus }) {
  // A sandbox pet left alone falls asleep; changing it should wake it up.
  const wake = () => ingest({ _agent: 'signal', kind: 'session-start', session: 'playground', label: 'playground' });

  const actions = {
    // Plays a real evolution (scene, cry, dex entry, badges) into the form.
    evolve(body) {
      const target = String(body.stage || 'juvenile');
      const i = stageIndex(target);
      if (i <= 0) return actions.reset(body);
      wake();
      const p = getPet();
      const chimera = Array.isArray(body.chimera) && body.chimera.length === 2 ? body.chimera : null;
      p.stage = STAGES[i - 1].id;
      if (stageIndex(p.stage) >= stageIndex('juvenile')) p.lineage = chimera ? chimera[0] : body.lineage || p.lineage || 'craft';
      if (p.stage === 'sprout' || p.stage === 'egg') p.lineage = null;
      p.stats = statsFor({ lineage: body.lineage || 'craft', trait: body.trait, chimera });
      p.xp = STAGES[i].xp - 1;
      p.xpLog = [];
      if (STAGES[i].bond) p.bond = Math.max(p.bond, STAGES[i].bond);
      if (typeof body.shiny === 'boolean') p.shiny = body.shiny;
      const at = body.nocturne ? atHour(now(), 3) : atHour(now(), 12);
      return applyEvents(pet.applySignal(p, { kind: 'turn-end', session: 'playground', label: 'playground' }, {}, at));
    },

    // Switches form instantly, without a scene.
    form(body) {
      wake();
      const p = getPet();
      const stage = String(body.stage || p.stage);
      if (stageIndex(stage) < 0) return [];
      p.stage = stage;
      p.chimera = Array.isArray(body.chimera) ? body.chimera : null;
      p.lineage = stage === 'egg' || stage === 'sprout' ? null : p.chimera ? 'chimera' : body.lineage || p.lineage || 'craft';
      p.trait = stageIndex(stage) >= stageIndex('adult') ? body.trait || null : null;
      p.shiny = Boolean(body.shiny);
      p.nocturne = Boolean(body.nocturne);
      p.region = typeof body.region === 'string' && /^[a-z]{2,3}$/.test(body.region) ? body.region : null;
      p.xp = Math.max(p.xp, STAGES[stageIndex(stage)].xp);
      p.dex[formKey(p.stage, p.lineage)] = p.dex[formKey(p.stage, p.lineage)] || now();
      return applyEvents([]);
    },

    reset(body = {}) {
      const fresh = pet.createPet(now(), getPet().name);
      if (typeof body.shiny === 'boolean') fresh.shiny = body.shiny;
      setPet(fresh);
      return applyEvents([]);
    },

    // The egg one step from hatching, to watch the hatch scene.
    nearHatch(body = {}) {
      actions.reset(body);
      // Wake first: ending a pending wait can grant XP and hatch it early.
      wake();
      const p = getPet();
      p.xp = STAGES[1].xp - 1;
      return applyEvents([]);
    },

    level() {
      const p = getPet();
      p.xp = pet.xpForLevel(pet.level(p.xp) + 1) - 1;
      p.xpLog = [];
      return applyEvents(pet.applySignal(p, { kind: 'tool-done', family: 'craft', session: 'playground' }, {}, now()));
    },

    nature(body) {
      if (!NATURES[body.nature]) return [];
      getPet().nature = body.nature;
      return applyEvents([]);
    },

    bond(body) {
      getPet().bond = Math.max(0, Math.min(100, Number(body.bond) || 0));
      return applyEvents([]);
    },

    achievement(body) {
      const a = ACHIEVEMENTS[body.id];
      if (!a) return [];
      getPet().achievements[body.id] = now();
      return applyEvents([{ type: 'achievement', id: body.id, ...a }]);
    },

    // Any agent signal (tool use, waits, errors, subagents) for a fake session.
    signal(body) {
      const session = String(body.session || 'playground');
      return ingest({ _agent: 'signal', label: session, ...body, session });
    },

    // A burst of realistic agent work, so every power has something to show.
    work() {
      const session_id = 'playground-work';
      const cwd = '/home/you/shop-api';
      const hook = (hook_event_name, extra = {}) => ingest({ session_id, cwd, hook_event_name, ...extra });
      const tool = (tool_name, tool_input, extra = {}) => {
        hook('PreToolUse', { tool_name, tool_input });
        hook(extra.fail ? 'PostToolUseFailure' : 'PostToolUse', { tool_name, tool_input, tool_response: extra.out || {}, duration_ms: extra.ms || 400 });
      };
      hook('UserPromptSubmit', { prompt: 'fix checkout' });
      tool('Read', { file_path: 'src/checkout.js' });
      tool('Read', { file_path: 'src/cart.js' });
      tool('Read', { file_path: 'src/checkout.js' });
      tool('Grep', { pattern: 'applyDiscount', path: 'src' });
      tool('Glob', { pattern: '**/*.test.js' });
      tool('Edit', { file_path: 'src/checkout.js', old_string: 'total = sum\nreturn total', new_string: 'total = sum - discount\nif (total < 0) total = 0\nreturn total' });
      tool('Write', { file_path: 'src/discount.js', content: 'export function discount(cart) {\n  return 0;\n}\n' });
      tool('Bash', { command: 'npm run lint' }, { ms: 2100 });
      tool('Bash', { command: 'npm test' }, { ms: 8200, out: { stdout: 'Tests: 1 failed, 23 passed, 24 total' } });
      tool('Edit', { file_path: 'src/checkout.js', old_string: 'sum - discount', new_string: 'sum - discount(cart)' });
      tool('Bash', { command: 'npm test' }, { ms: 7900, out: { stdout: 'Tests: 24 passed, 24 total' } });
      tool('Bash', { command: 'git push origin main' }, { fail: true, ms: 900 });
      tool('WebSearch', { query: 'stripe discount coupon api' });
      tool('WebFetch', { url: 'https://docs.stripe.com/api/coupons' });
      tool('mcp__github__create_pull_request', { title: 'Fix checkout discount' });
      hook('SubagentStart', { agent_id: 'pw1', agent_type: 'Explore' });
      hook('SubagentStart', { agent_id: 'pw2', agent_type: 'code-reviewer' });
      hook('SubagentStop', { agent_id: 'pw1', agent_type: 'Explore' });
      hook('Stop', {});
      return [];
    },

    // Every lineage counts as seen, so every power is unlocked.
    unlockAll() {
      const p = getPet();
      for (const l of require('./species').STATS) p.dex[`${l}-juvenile`] = p.dex[`${l}-juvenile`] || now();
      // Every accessory, and a bag to play with.
      const { COSMETICS } = require('./species');
      for (const id of Object.keys(COSMETICS)) p.wardrobe.owned[id] = p.wardrobe.owned[id] || now();
      p.bag = { snack: Math.max(p.bag.snack || 0, 5), candy: Math.max(p.bag.candy || 0, 3), everstone: Math.max(p.bag.everstone || 0, 1) };
      return applyEvents([]);
    },

    lang(body) {
      bus.emit('lang', /^pt/i.test(String(body.lang)) ? 'pt-BR' : /^es/i.test(String(body.lang)) ? 'es' : 'en');
      return [];
    },
  };
  return actions;
}

module.exports = { createPlayground, statsFor };
