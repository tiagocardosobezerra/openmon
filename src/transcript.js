'use strict';

// A conversation as the chat shows it, read from Claude Code's own
// conversation file (JSONL, one event per line). Only what you and the
// agent said, plus one short line per tool; thinking, tool output and
// Claude Code's own injected notes are left out. Only files inside a
// .claude folder are read, and only the end of a long one.

const fs = require('node:fs');
const path = require('node:path');

const TAIL_BYTES = 600 * 1024;

function trusted(file) {
  if (typeof file !== 'string' || !file.endsWith('.jsonl')) return false;
  return path.resolve(file).split(/[\\/]+/).includes('.claude');
}

// "Edit cart.js", "Bash: npm test", "Grep: total" — what a tool call did.
function toolLine(name, input) {
  const i = input && typeof input === 'object' ? input : {};
  const file = (p) => (typeof p === 'string' && p ? p.split(/[\\/]/).pop() : '');
  const clip = (s, n = 80) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  const what = file(i.file_path || i.notebook_path) || clip(i.command) || clip(i.pattern) || clip(i.url) || clip(i.query) || clip(i.description) || clip(i.prompt, 60);
  return what ? `${name}: ${what}` : String(name || 'Tool');
}

// Text a person wrote, not Claude Code's own wrappers (<command-name>,
// <system-reminder>, hook output and the like).
function personText(s) {
  const t = String(s || '').trim();
  if (!t || t.startsWith('<') || t.startsWith('Caveat:')) return '';
  return t;
}

// One line of the file into chat messages (zero or more).
function messagesOf(event) {
  if (!event || typeof event !== 'object' || event.isSidechain || event.isMeta) return [];
  const at = Date.parse(event.timestamp) || null;
  const msg = event.message;
  if (!msg) return [];
  if (event.type === 'user') {
    if (typeof msg.content === 'string') {
      const text = personText(msg.content);
      return text ? [{ role: 'user', text, at }] : [];
    }
    if (!Array.isArray(msg.content)) return [];
    const text = msg.content.filter((b) => b && b.type === 'text').map((b) => personText(b.text)).filter(Boolean).join('\n\n');
    const images = msg.content.filter((b) => b && b.type === 'image').length;
    return text || images ? [{ role: 'user', text, images, at }] : [];
  }
  if (event.type === 'assistant' && Array.isArray(msg.content)) {
    const out = [];
    for (const b of msg.content) {
      if (b && b.type === 'text' && b.text && b.text.trim()) out.push({ role: 'assistant', text: b.text.trim(), at, id: msg.id || null });
      else if (b && b.type === 'tool_use') out.push({ role: 'tool', text: toolLine(b.name, b.input), at, id: b.id || null });
    }
    return out;
  }
  return [];
}

// The last `limit` messages of a conversation file.
function readTranscript(file, { limit = 300 } = {}) {
  if (!trusted(file)) return null;
  let text;
  try {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    text = buf.toString('utf8');
    // A cut first line is not JSON: drop it.
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
  } catch {
    return null;
  }
  const out = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const m of messagesOf(event)) {
      // A streamed message can come on several lines: each block once.
      const key = m.id ? `${m.role}|${m.id}|${m.text}` : null;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      delete m.id;
      out.push(m);
    }
  }
  return out.slice(-limit);
}

module.exports = { readTranscript, messagesOf, toolLine, trusted };
