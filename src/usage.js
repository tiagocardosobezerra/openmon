'use strict';

// Token usage, read from Claude Code's own conversation files.
//
// Every hook payload carries `transcript_path`, a JSONL file where each
// assistant message records its `usage` (input, output and cache tokens).
// The same message can appear on several lines while it streams, so each
// message id counts once, by how much it grew. Files are read from where we
// stopped last time; only token counts are kept, never the text.

const fs = require('node:fs');
const path = require('node:path');

// Only conversation files inside a .claude folder, never any other path a
// local process might send.
function trusted(file) {
  if (typeof file !== 'string' || !file.endsWith('.jsonl')) return false;
  const parts = path.resolve(file).split(/[\\/]+/);
  return parts.includes('.claude');
}

function createUsage({ maxFiles = 50 } = {}) {
  // file -> { offset, rest, seen: Map(id -> {input, output, cacheRead, cacheWrite}) }
  const files = new Map();

  function read(file) {
    if (!trusted(file)) return null;
    let entry = files.get(file);
    if (!entry) {
      if (files.size >= maxFiles) files.delete(files.keys().next().value);
      entry = { offset: 0, rest: '', seen: new Map() };
      files.set(file, entry);
    }
    let size;
    try {
      size = fs.statSync(file).size;
    } catch {
      return null;
    }
    if (size < entry.offset) {
      entry.offset = 0;
      entry.rest = '';
    }
    if (size === entry.offset) return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(size - entry.offset, 64 * 1024 * 1024));
    try {
      fs.readSync(fd, buf, 0, buf.length, entry.offset);
    } finally {
      fs.closeSync(fd);
    }
    entry.offset += buf.length;
    const text = entry.rest + buf.toString('utf8');
    const lines = text.split('\n');
    entry.rest = lines.pop();
    const delta = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    for (const line of lines) {
      if (!line.includes('"usage"')) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const msg = row && row.message;
      const u = msg && msg.usage;
      if (!u || !msg.id) continue;
      const now = { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 };
      const before = entry.seen.get(msg.id) || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      for (const k of Object.keys(delta)) delta[k] += Math.max(0, now[k] - before[k]);
      entry.seen.set(msg.id, { input: Math.max(now.input, before.input), output: Math.max(now.output, before.output), cacheRead: Math.max(now.cacheRead, before.cacheRead), cacheWrite: Math.max(now.cacheWrite, before.cacheWrite) });
    }
    return delta;
  }

  return { read };
}

module.exports = { createUsage, trusted };
