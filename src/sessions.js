'use strict';

// Live state of every agent session, and the single "pose" the pet shows
// for all of them together. Pure: callers pass the clock in.

const ERROR_SHOW_MS = 6000;
const DONE_SHOW_MS = 10 * 60 * 1000;
const WORKING_STALE_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SLEEP_AFTER_MS = 5 * 60 * 1000;

// Kinds that belong to the main agent and always end a wait for the user.
const MAIN_SCOPE = new Set(['turn-start', 'turn-end', 'session-start', 'api-error']);

// Hooks run as parallel processes, so the PreToolUse that caused a
// permission prompt can arrive after it. No human answers this fast.
const RACE_MS = 1500;
// "Looks stuck": mid-task, no tool running, nothing for 4 minutes.
const STUCK_MS = 4 * 60 * 1000;
// A single tool (a command, tests) running for 8 minutes.
const LONG_TOOL_MS = 8 * 60 * 1000;
// The same thing failing this many times in a row is a loop.
const LOOP_FAILS = 3;
// Edits since the last commit before a gentle reminder.
const COMMIT_EDITS = 30;
const COMMIT_MS = 45 * 60 * 1000;

function endsWait(signal, t, wait) {
  if (t <= wait.since) return false;
  if (MAIN_SCOPE.has(signal.kind)) return true;
  if ((signal.agentId || null) !== wait.agentId) return false;
  if (signal.kind === 'tool-start' || signal.kind === 'test-start') {
    if (wait.toolUseId && signal.toolUseId === wait.toolUseId) return false;
    if (t - wait.since < RACE_MS) return false;
  }
  return true;
}

// Counts edits since the last `git commit`; long enough without one
// earns a one-time reminder.
function trackCommit(s, signal, t) {
  if (signal.tool && /(^|\s)git\s+commit\b/.test(String(signal.detail || ''))) {
    s.commit = { edits: 0, since: t, told: false };
    return;
  }
  if (signal.family !== 'craft') return;
  s.commit = s.commit || { edits: 0, since: t, told: false };
  s.commit.edits++;
}

function createSessions() {
  const sessions = new Map();
  // One-time notices (loops, compaction, commit reminders), taken by the daemon.
  const notices = [];
  let lastEventAt = 0;

  function get(signal, t) {
    let s = sessions.get(signal.session);
    if (!s) {
      s = {
        id: signal.session,
        label: signal.label || 'agent',
        agent: signal.agent || 'agent',
        state: 'idle',
        family: null,
        detail: null,
        since: t,
        lastAt: t,
        attention: null,
        error: null,
        subagents: new Set(),
        turnTools: 0,
      };
      sessions.set(signal.session, s);
    }
    return s;
  }

  // Returns context the pet engine needs: how fast the user answered a
  // wait (if this signal ended one), tools in this turn, live session count.
  function apply(signal, now) {
    if (!signal) return null;
    const t = signal.ts || now;
    lastEventAt = now;

    if (signal.kind === 'session-end') {
      sessions.delete(signal.session);
      return context(null, null);
    }

    const s = get(signal, t);
    s.lastAt = now;
    if (signal.label) s.label = signal.label;

    // "Waiting for your input" after a finished turn is not an alarm: the
    // turn is simply done. Only permission prompts and questions jump.
    if (signal.kind === 'attention' && signal.reason === 'idle') {
      if (s.state !== 'done') {
        s.state = 'done';
        s.since = t;
        s.detail = 'Done';
      }
      return context(s, null);
    }

    if (signal.kind === 'attention') {
      // PermissionRequest and Notification both report the same wait.
      const keep = s.attention && t - s.attention.since < RACE_MS ? s.attention : null;
      s.attention = {
        since: keep ? keep.since : t,
        reason: signal.reason || 'input',
        detail: signal.detail || (keep && keep.detail) || null,
        agentId: signal.agentId || null,
        toolUseId: signal.toolUseId || (keep && keep.toolUseId) || null,
      };
      return context(s, null);
    }

    let reaction = null;
    if (s.attention && endsWait(signal, t, s.attention)) {
      reaction = { ms: t - s.attention.since, reason: s.attention.reason };
      s.attention = null;
    }

    const setState = (state, family = s.family, detail = s.detail) => {
      if (s.state !== state || s.family !== family) s.since = t;
      s.state = state;
      s.family = family;
      s.detail = detail;
    };

    switch (signal.kind) {
      case 'session-start':
        if (signal.detail !== 'compact') setState('idle', null, null);
        break;
      case 'turn-start':
        s.turnTools = 0;
        s.error = null;
        setState('working', null, 'Thinking…');
        break;
      case 'turn-end':
        s.subagents.clear();
        s.inFlight = null;
        setState('done', null, 'Done');
        break;
      case 'tool-start':
      case 'test-start':
        setState('working', signal.family, signal.detail);
        s.inFlight = { since: t, detail: signal.detail };
        break;
      case 'tool-done':
        s.turnTools++;
        s.inFlight = null;
        s.fails = null;
        trackCommit(s, signal, t);
        if (s.state !== 'done') setState('working', s.family, s.detail);
        break;
      case 'tool-fail': {
        s.turnTools++;
        s.inFlight = null;
        s.error = { since: t, detail: signal.detail || 'Tool failed' };
        // The same failure again and again: a loop worth telling you about.
        const same = s.fails && s.fails.detail === signal.detail;
        s.fails = { detail: signal.detail, n: same ? s.fails.n + 1 : 1, told: same ? s.fails.told : false };
        if (s.fails.n >= LOOP_FAILS && !s.fails.told) {
          s.fails.told = true;
          notices.push({ type: 'loop', session: s.id, label: s.label, detail: signal.detail, n: s.fails.n });
        }
        break;
      }
      case 'test-end':
        s.turnTools++;
        s.inFlight = null;
        // Red, then green again: worth a cheer.
        if (signal.passed === true && s.lastTestRed) notices.push({ type: 'tests-fixed', session: s.id, label: s.label });
        if (signal.passed === true || signal.passed === false) s.lastTestRed = signal.passed === false;
        if (signal.passed === false) s.error = { since: t, detail: 'Tests failed' };
        break;
      case 'subagent-start':
        s.subagents.add(signal.agentId || `${t}-${s.subagents.size}`);
        if (s.state !== 'working') setState('working', 'swarm', signal.detail || 'Subagent');
        break;
      case 'subagent-end':
        if (signal.agentId) s.subagents.delete(signal.agentId);
        else s.subagents.delete(s.subagents.values().next().value);
        break;
      case 'compact':
        setState('working', 'memory', 'Compacting memory');
        notices.push({ type: 'compact', session: s.id, label: s.label });
        break;
      case 'api-error':
        s.error = { since: t, detail: String(signal.detail || 'API error') };
        setState('idle', null, null);
        break;
      default:
        break;
    }
    return context(s, reaction);
  }

  function context(s, reaction) {
    let working = 0;
    for (const x of sessions.values()) if (x.state === 'working') working++;
    return { reaction, turnTools: s ? s.turnTools : 0, workingSessions: working };
  }

  function tick(now) {
    for (const [id, s] of sessions) {
      const quiet = now - s.lastAt;
      if (quiet > SESSION_TTL_MS) sessions.delete(id);
      else if (s.state === 'working' && quiet > WORKING_STALE_MS) {
        s.state = 'idle';
        s.family = null;
        s.subagents.clear();
      } else if (s.state === 'done' && now - s.since > DONE_SHOW_MS) s.state = 'idle';
    }
  }

  function snapshot(now) {
    const list = [...sessions.values()];
    const view = list.map((s) => ({
      id: s.id,
      label: s.label,
      agent: s.agent,
      state: s.attention ? 'attention' : s.state,
      detail: s.attention ? s.attention.detail : s.detail,
      subagents: s.subagents.size,
      // Mid-task with no tool running and no news: it may be stuck.
      stuck: !s.attention && s.state === 'working' && !s.inFlight && now - s.lastAt > STUCK_MS ? now - s.lastAt : null,
      // One tool running for a long time.
      longTool: !s.attention && s.inFlight && now - s.inFlight.since > LONG_TOOL_MS ? { detail: s.inFlight.detail, ms: now - s.inFlight.since } : null,
    }));
    // Commit reminders: many edits, a long time, no commit.
    for (const s of list) {
      if (s.commit && !s.commit.told && s.commit.edits >= COMMIT_EDITS && now - s.commit.since > COMMIT_MS) {
        s.commit.told = true;
        notices.push({ type: 'commit-nudge', session: s.id, label: s.label, edits: s.commit.edits, ms: now - s.commit.since });
      }
    }

    const pick = (fn) => list.filter(fn).sort((a, b) => b.since - a.since)[0];
    let pose = 'idle';
    let focus = null;
    const waiting = list.filter((s) => s.attention).sort((a, b) => a.attention.since - b.attention.since)[0];
    const hurt = list.filter((s) => s.error && now - s.error.since < ERROR_SHOW_MS).sort((a, b) => b.error.since - a.error.since)[0];
    const done = pick((s) => s.state === 'done');
    const busy = pick((s) => s.state === 'working');

    if (waiting) {
      pose = 'attention';
      focus = { id: waiting.id, label: waiting.label, detail: waiting.attention.detail, reason: waiting.attention.reason, since: waiting.attention.since };
    } else if (hurt) {
      pose = 'error';
      focus = { id: hurt.id, label: hurt.label, detail: hurt.error.detail, since: hurt.error.since };
    } else if (done) {
      pose = 'done';
      focus = { id: done.id, label: done.label, detail: 'Done', since: done.since };
    } else if (busy) {
      pose = 'working';
      focus = { id: busy.id, label: busy.label, detail: busy.detail, family: busy.family, since: busy.since };
    } else if (!lastEventAt || now - lastEventAt > SLEEP_AFTER_MS) {
      pose = 'sleep';
    }

    let subagents = 0;
    for (const s of list) subagents += s.subagents.size;
    return {
      pose,
      focus,
      family: busy ? busy.family : null,
      sessions: view,
      counts: {
        sessions: list.length,
        working: list.filter((s) => s.state === 'working').length,
        waiting: list.filter((s) => s.attention).length,
        subagents,
      },
    };
  }

  // Notices since the last call (each one is handed out once).
  function takeNotices() {
    return notices.splice(0, notices.length);
  }

  return { apply, tick, snapshot, takeNotices, size: () => sessions.size };
}

module.exports = { createSessions, ERROR_SHOW_MS, DONE_SHOW_MS, SLEEP_AFTER_MS };
