'use strict';

// Reminders and scheduled tasks. A reminder makes the pet tell you
// something at a given time; a task starts a conversation with Claude at
// that time (in a folder you picked) and the pet tells you when it is done.
// Once ("at 15:00", "in 20 minutes") or every day / every weekday at a time.
// Kept in schedule.json; times are this computer's local time.

const fs = require('node:fs');
const crypto = require('node:crypto');

const MAX_ITEMS = 100;
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// The next moment a "HH:MM" comes, after `from` (weekdays only if asked).
function nextAt(time, from, weekdays = false) {
  const m = TIME.exec(String(time));
  if (!m) return null;
  const d = new Date(from);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  while (weekdays && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// { type: 'in', minutes } | { type: 'at', time: 'HH:MM' } | { type: 'daily' | 'weekdays', time }
function firstRun(when, from) {
  if (!when || typeof when !== 'object') return null;
  if (when.type === 'in') {
    const minutes = Number(when.minutes);
    return Number.isFinite(minutes) && minutes >= 1 && minutes <= 60 * 24 * 30 ? from + Math.round(minutes) * 60_000 : null;
  }
  if (when.type === 'at' || when.type === 'daily') return nextAt(when.time, from);
  if (when.type === 'weekdays') return nextAt(when.time, from, true);
  return null;
}

function createSchedule({ file, now = Date.now, onReminder = () => {}, onTask = () => {} } = {}) {
  let items = [];
  try {
    items = JSON.parse(fs.readFileSync(file, 'utf8')).filter((i) => i && i.id && Number.isFinite(i.next));
  } catch {}

  function save() {
    if (!file) return;
    try {
      fs.writeFileSync(file, JSON.stringify(items, null, 1));
    } catch {}
  }

  function add({ kind, text, cwd = null, when }) {
    const t = String(text || '').trim().slice(0, 4000);
    if (!['remind', 'task'].includes(kind) || !t) return { ok: false, reason: 'text' };
    if (kind === 'task' && !cwd) return { ok: false, reason: 'folder' };
    const next = firstRun(when, now());
    if (!next) return { ok: false, reason: 'when' };
    if (items.length >= MAX_ITEMS) return { ok: false, reason: 'full' };
    const repeat = when.type === 'daily' || when.type === 'weekdays' ? when.type : null;
    const item = { id: crypto.randomBytes(6).toString('hex'), kind, text: t, cwd: kind === 'task' ? String(cwd) : null, next, repeat, time: repeat ? when.time : null, createdAt: now() };
    items.push(item);
    items.sort((a, b) => a.next - b.next);
    save();
    return { ok: true, item };
  }

  function remove(id) {
    const before = items.length;
    items = items.filter((i) => i.id !== id);
    if (items.length !== before) save();
    return items.length !== before;
  }

  // Everything that is due runs once (a computer asleep at the time runs
  // it when it wakes); repeating ones move to their next time.
  function tick() {
    const t = now();
    const due = items.filter((i) => i.next <= t);
    if (!due.length) return [];
    for (const i of due) {
      if (i.repeat) i.next = nextAt(i.time, t, i.repeat === 'weekdays');
      else i.next = null;
    }
    items = items.filter((i) => i.next);
    items.sort((a, b) => a.next - b.next);
    save();
    for (const i of due) (i.kind === 'remind' ? onReminder : onTask)(i);
    return due;
  }

  return { add, remove, tick, list: () => items.map((i) => ({ ...i })) };
}

module.exports = { createSchedule, nextAt, firstRun };
