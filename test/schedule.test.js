'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSchedule, nextAt, firstRun } = require('../src/schedule');

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime();

test('next time: later today, else tomorrow; weekdays skip the weekend', () => {
  const fri = at(2026, 10, 23, 10, 0); // a Friday
  assert.equal(nextAt('15:00', fri), at(2026, 10, 23, 15, 0));
  assert.equal(nextAt('09:00', fri), at(2026, 10, 24, 9, 0));
  assert.equal(nextAt('09:00', fri, true), at(2026, 10, 26, 9, 0));
  assert.equal(nextAt('25:00', fri), null);
  assert.equal(firstRun({ type: 'in', minutes: 20 }, fri), fri + 20 * 60_000);
  assert.equal(firstRun({ type: 'in', minutes: 0 }, fri), null);
  assert.equal(firstRun({ type: 'nope' }, fri), null);
});

test('schedule: a reminder runs once, a daily task moves to tomorrow, all saved', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-sched-')), 'schedule.json');
  let t = at(2026, 10, 23, 10, 0);
  const reminded = [];
  const tasks = [];
  const s = createSchedule({ file, now: () => t, onReminder: (i) => reminded.push(i.text), onTask: (i) => tasks.push(i.text) });
  assert.equal(s.add({ kind: 'remind', text: 'Beber água', when: { type: 'in', minutes: 30 } }).ok, true);
  assert.equal(s.add({ kind: 'task', text: 'Resumo do dia', cwd: os.tmpdir(), when: { type: 'daily', time: '10:15' } }).ok, true);
  assert.equal(s.add({ kind: 'task', text: 'sem pasta', when: { type: 'in', minutes: 5 } }).reason, 'folder');
  assert.equal(s.add({ kind: 'remind', text: '', when: { type: 'in', minutes: 5 } }).reason, 'text');
  assert.deepEqual(s.tick(), []);
  t = at(2026, 10, 23, 10, 31);
  s.tick();
  assert.deepEqual(reminded, ['Beber água']);
  assert.deepEqual(tasks, ['Resumo do dia']);
  assert.equal(s.list().length, 1);
  assert.equal(s.list()[0].next, at(2026, 10, 24, 10, 15));
  const again = createSchedule({ file, now: () => t });
  assert.equal(again.list()[0].text, 'Resumo do dia');
  assert.equal(again.remove(again.list()[0].id), true);
  assert.equal(again.list().length, 0);
});
