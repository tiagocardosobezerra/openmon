'use strict';

// Lineage powers: useful views of what the agent did, kept per session from
// the raw hook payloads. Each lineage unlocks one view:
//
//   Craft  Forge log     files edited, edits and lines added/removed
//   Lore   Reading list  files read, searches made
//   Shell  Command log   commands run, ok or failed, how long they took
//   Test   Test tracker  test runs, pass/fail, the failing summary line
//   Roam   Travel log    pages fetched, searches, MCP tools used
//   Swarm  Hive view     subagents, running or done, how long they took
//   Docs   Docs log      documentation files written, lines in and out
//   Git    Branch log    git and gh commands, commits counted
//   Debug  Fix log       what failed, and how long until it worked again
//   Data   Data log      data files touched, database commands run
//   Style  Style log     stylesheets changed, lines in and out
//
// Everything stays in memory on 127.0.0.1; nothing is written to disk.

const path = require('node:path');
const { judgeTestOutput, responseText, isTestCommand, workKind } = require('./classify');
const { redact } = require('./redact');

const MAX_ITEMS = 60;
// The session timeline keeps the last 300 steps.
const MAX_TIMELINE = 300;
const MAX_SESSIONS = 6;
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

function lines(text) {
  if (typeof text !== 'string' || !text) return 0;
  return text.split('\n').length;
}

function short(text, n = 160) {
  // Secrets are masked before anything is cut or shown.
  const s = redact(String(text || '').split('\n')[0].trim());
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// The line of test output worth showing ("3 failed, 12 passed").
function testSummary(text) {
  const tail = text.split('\n').slice(-60);
  const hit = tail.reverse().find((l) => /\b\d+\s+(passed|failed|failing|passing)\b|test result:|^(ok|FAIL)\b|Tests?:/i.test(l));
  return hit ? short(hit, 120) : null;
}

function newTurn(now) {
  return { startedAt: now, endedAt: null, files: {}, edits: 0, reads: 0, commands: 0, failed: 0, green: 0, red: 0, web: 0, agents: 0 };
}

function push(list, item) {
  list.unshift(item);
  if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
}

// One line of the timeline: what happened, on what, and whether it worked.
// Prompts are never stored; only that you asked something.
function timelineStep(event, tool, input, payload) {
  const target = input.command || input.file_path || input.notebook_path || input.pattern || input.url || input.query || input.description || '';
  switch (event) {
    case 'UserPromptSubmit':
      return { kind: 'prompt' };
    case 'Stop':
      return { kind: 'stop' };
    case 'PermissionRequest':
      return { kind: 'ask', tool, target: short(target, 120) };
    case 'PostToolUse':
      return { kind: 'tool', tool, target: short(target, 120), ok: true, ms: Number(payload.duration_ms) || null };
    case 'PostToolUseFailure':
      return { kind: 'tool', tool, target: short(target, 120), ok: false, ms: Number(payload.duration_ms) || null };
    case 'SubagentStart':
      return { kind: 'agent', target: short(payload.agent_type || 'agent', 60) };
    case 'PreCompact':
      return { kind: 'compact' };
    default:
      return null;
  }
}

function createPowers() {
  const sessions = new Map();

  function session(payload, label, now) {
    const id = payload.session_id || payload.session || 'default';
    let s = sessions.get(id);
    if (!s) {
      s = { id, label, startedAt: now, lastAt: now, ended: false, files: {}, reads: {}, searches: [], commands: [], tests: [], web: [], agents: {}, turn: null, timeline: [], git: [], queries: [], fixes: [], fail: null };
      sessions.set(id, s);
      // Keep the most recent sessions only.
      if (sessions.size > MAX_SESSIONS) {
        const oldest = [...sessions.values()].sort((a, b) => a.lastAt - b.lastAt)[0];
        sessions.delete(oldest.id);
      }
    }
    s.lastAt = now;
    if (label) s.label = label;
    return s;
  }

  // payload: raw Claude Code hook payload. label: session label from classify.
  function record(payload, label, now) {
    if (!payload || !payload.hook_event_name) return;
    const event = payload.hook_event_name;
    const s = session(payload, label, now);
    const tool = payload.tool_name;
    const input = payload.tool_input || {};

    if (event === 'SessionEnd') {
      s.ended = true;
      return;
    }
    // The timeline: every step of the session, in order, in plain data.
    const step = timelineStep(event, tool, input, payload);
    if (step) {
      s.timeline.push({ at: now, ...step });
      if (s.timeline.length > MAX_TIMELINE) s.timeline.splice(0, s.timeline.length - MAX_TIMELINE);
    }
    // One turn = from your prompt to the agent's stop.
    if (event === 'UserPromptSubmit') {
      s.turn = newTurn(now);
      return;
    }
    if (event === 'Stop') {
      if (s.turn) s.turn.endedAt = now;
      return;
    }
    if (!s.turn || s.turn.endedAt) s.turn = newTurn(now);
    const turn = s.turn;
    if (event === 'SubagentStart' && payload.agent_id) {
      s.agents[payload.agent_id] = { type: payload.agent_type || 'agent', startedAt: now, endedAt: null };
      turn.agents++;
      return;
    }
    if (event === 'SubagentStop' && payload.agent_id) {
      const a = s.agents[payload.agent_id] || (s.agents[payload.agent_id] = { type: payload.agent_type || 'agent', startedAt: now });
      a.endedAt = now;
      return;
    }
    const done = event === 'PostToolUse';
    const failed = event === 'PostToolUseFailure';
    if (!done && !failed) return;
    const ms = Number(payload.duration_ms) || null;
    trackFix(s, tool, input, payload, failed, now);

    if (['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(tool)) {
      const file = input.file_path || input.notebook_path;
      if (!file) return;
      const f = s.files[file] || (s.files[file] = { file, name: path.basename(file), edits: 0, added: 0, removed: 0, lastAt: now });
      f.edits++;
      turn.edits++;
      turn.files[file] = true;
      f.lastAt = now;
      if (tool === 'Write') f.added += lines(input.content);
      else if (tool === 'MultiEdit' && Array.isArray(input.edits)) {
        for (const e of input.edits) {
          f.added += lines(e.new_string);
          f.removed += lines(e.old_string);
        }
      } else {
        f.added += lines(input.new_string || input.new_source);
        f.removed += lines(input.old_string);
      }
      if (failed) f.failed = (f.failed || 0) + 1;
      return;
    }
    if (tool === 'Read' || tool === 'NotebookRead') {
      const file = input.file_path || input.notebook_path;
      if (!file) return;
      const r = s.reads[file] || (s.reads[file] = { file, name: path.basename(file), count: 0, lastAt: now });
      r.count++;
      r.lastAt = now;
      turn.reads++;
      return;
    }
    if (tool === 'Grep' || tool === 'Glob') {
      push(s.searches, { tool, pattern: short(input.pattern, 80), where: input.path ? path.basename(input.path) : null, at: now });
      return;
    }
    if (SHELL_TOOLS.has(tool)) {
      const cmd = short(input.command, 200);
      if (isTestCommand(input.command)) {
        const text = responseText(payload.tool_response);
        const passed = failed ? false : judgeTestOutput(text);
        push(s.tests, { command: cmd, passed, summary: testSummary(text), ms, at: now });
        if (passed === true) turn.green++;
        else if (passed === false) turn.red++;
      }
      turn.commands++;
      if (failed) turn.failed++;
      push(s.commands, { command: cmd, ok: !failed, ms, at: now });
      const kind = workKind(tool, input);
      if (kind === 'git') push(s.git, { command: cmd, ok: !failed, commit: /\bcommit\b/.test(input.command) && !failed, at: now });
      if (kind === 'data') push(s.queries, { command: cmd, ok: !failed, ms, at: now });
      return;
    }
    if (tool === 'WebFetch' || tool === 'WebSearch') {
      push(s.web, { kind: tool === 'WebFetch' ? 'page' : 'search', target: short(input.url || input.query, 160), at: now });
      turn.web++;
      return;
    }
    if (typeof tool === 'string' && tool.startsWith('mcp__')) {
      const [, server, name] = tool.split('__');
      push(s.web, { kind: 'mcp', target: `${server} · ${name || ''}`.trim(), at: now });
      turn.web++;
    }
  }

  // A failure is open until the same call works again (or tests go green
  // after a red run); then it becomes one line of the fix log.
  function trackFix(s, tool, input, payload, failed, now) {
    const target = short(input.command || input.file_path || input.notebook_path || input.pattern || input.url || '', 120);
    const testing = SHELL_TOOLS.has(tool) && isTestCommand(input.command);
    const red = testing && (failed || judgeTestOutput(responseText(payload.tool_response)) === false);
    if (failed || red) {
      if (!s.fail || s.fail.tool !== tool) s.fail = { tool, target, test: testing, at: now, tries: 0 };
      s.fail.tries++;
      return;
    }
    if (!s.fail || s.fail.tool !== tool || s.fail.test !== testing) return;
    // Outside tests, the very same call must work: same command or same file.
    if (!testing && s.fail.target !== target) return;
    if (s.fail.test && judgeTestOutput(responseText(payload.tool_response)) !== true) return;
    push(s.fixes, { tool, target: s.fail.target, test: s.fail.test, tries: s.fail.tries, failedAt: s.fail.at, fixedAt: now });
    s.fail = null;
  }

  // Data files the agent read or edited, one row per file.
  function dataFiles(s) {
    const rows = {};
    const row = (file, name) => rows[file] || (rows[file] = { file, name, edits: 0, reads: 0, lastAt: 0 });
    for (const f of Object.values(s.files)) {
      if (workKind('Read', { file_path: f.file }) !== 'data') continue;
      const r = row(f.file, f.name);
      r.edits += f.edits;
      r.lastAt = Math.max(r.lastAt, f.lastAt);
    }
    for (const x of Object.values(s.reads)) {
      if (workKind('Read', { file_path: x.file }) !== 'data') continue;
      const r = row(x.file, x.name);
      r.reads += x.count;
      r.lastAt = Math.max(r.lastAt, x.lastAt);
    }
    return Object.values(rows).sort((x, y) => y.lastAt - x.lastAt);
  }

  // Numbers for the "done" bubble: what the agent's last turn did.
  function recap(id) {
    const s = sessions.get(id);
    if (!s || !s.turn) return null;
    const t = s.turn;
    return {
      files: Object.keys(t.files).length,
      edits: t.edits,
      reads: t.reads,
      commands: t.commands,
      failed: t.failed,
      green: t.green,
      red: t.red,
      web: t.web,
      agents: t.agents,
      ms: (t.endedAt || s.lastAt) - t.startedAt,
      done: Boolean(t.endedAt),
    };
  }

  // Views for the powers panel, newest session first.
  function view() {
    return [...sessions.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .map((s) => {
        const tests = s.tests;
        let streak = 0;
        for (const t of tests) {
          if (t.passed !== true) break;
          streak++;
        }
        const lastGreen = tests.find((t) => t.passed === true);
        return {
          id: s.id,
          label: s.label,
          lastTurn: recap(s.id),
          startedAt: s.startedAt,
          lastAt: s.lastAt,
          ended: s.ended,
          craft: Object.values(s.files).sort((a, b) => b.lastAt - a.lastAt),
          lore: { reads: Object.values(s.reads).sort((a, b) => b.lastAt - a.lastAt), searches: s.searches },
          shell: s.commands,
          test: { runs: tests, streak, lastGreenAt: lastGreen ? lastGreen.at : null },
          roam: s.web,
          timeline: s.timeline,
          docs: Object.values(s.files).filter((f) => workKind('Edit', { file_path: f.file }) === 'docs').sort((a, b) => b.lastAt - a.lastAt),
          style: Object.values(s.files).filter((f) => workKind('Edit', { file_path: f.file }) === 'style').sort((a, b) => b.lastAt - a.lastAt),
          git: { commands: s.git, commits: s.git.filter((g) => g.commit).length },
          debug: { fixes: s.fixes, open: s.fail ? { tool: s.fail.tool, target: s.fail.target, at: s.fail.at, tries: s.fail.tries } : null },
          data: {
            files: dataFiles(s),
            queries: s.queries,
          },
          swarm: Object.entries(s.agents)
            .map(([id, a]) => ({ id, ...a }))
            .sort((a, b) => b.startedAt - a.startedAt),
        };
      });
  }

  return { record, view, recap, size: () => sessions.size };
}

// Which powers a pet has: every lineage it has ever grown into (the Opendex
// remembers across generations), plus both halves of a current Chimera.
const POWER_ORDER = ['craft', 'lore', 'shell', 'test', 'roam', 'swarm', 'docs', 'git', 'debug', 'data', 'style'];

function unlockedPowers(pet) {
  const have = new Set();
  for (const key of Object.keys(pet.dex || {})) {
    const lineage = key.split('-')[0];
    if (POWER_ORDER.includes(lineage)) have.add(lineage);
  }
  for (const l of pet.chimera || []) have.add(l);
  return POWER_ORDER.filter((p) => have.has(p));
}

module.exports = { createPowers, unlockedPowers, testSummary, POWER_ORDER };
