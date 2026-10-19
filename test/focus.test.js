'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFocus, cleanWindow } = require('../src/focus');

function fakeDriver(ok = true) {
  const raised = [];
  return { raised, find: async () => null, raise: async (win) => (raised.push(win.pid), ok) };
}

test('asks each session for its window once a minute at most, until it knows it', () => {
  let t = 0;
  const focus = createFocus({ driver: fakeDriver(), now: () => t });
  assert.equal(focus.wants('s1'), true);
  assert.equal(focus.wants('s1'), false);
  t = 61_000;
  assert.equal(focus.wants('s1'), true);
  focus.setWindow('s1', { pid: 4242, app: 'WindowsTerminal' });
  t = 200_000;
  assert.equal(focus.wants('s1'), false);
  assert.equal(focus.wants('s2'), true);
});

test('no driver (unsupported platform): never asks, focus says so', async () => {
  const focus = createFocus({ driver: null });
  assert.equal(focus.wants('s1'), false);
  assert.deepEqual(await focus.focus('s1'), { ok: false, reason: 'unsupported' });
});

test('focus raises the known window; a refused raise makes it ask again', async () => {
  const driver = fakeDriver();
  const focus = createFocus({ driver, now: () => 0 });
  assert.deepEqual(await focus.focus('s1'), { ok: false, reason: 'unknown' });
  focus.setWindow('s1', { pid: 777, app: 'Code' });
  assert.deepEqual(await focus.focus('s1'), { ok: true, app: 'Code' });
  assert.deepEqual(driver.raised, [777]);
  const refusing = createFocus({ driver: fakeDriver(false), now: () => 0 });
  refusing.setWindow('s1', { pid: 777, app: 'Code' });
  assert.equal((await refusing.focus('s1')).ok, false);
  assert.equal(refusing.wants('s1'), true);
});

test('windows reported by hooks are validated', () => {
  assert.equal(cleanWindow(null), null);
  assert.equal(cleanWindow({ pid: 'abc' }), null);
  assert.equal(cleanWindow({ pid: -3 }), null);
  assert.deepEqual(cleanWindow({ pid: 12, app: 'x'.repeat(300), title: 5, window: 'rm -rf' }), { pid: 12, app: 'x'.repeat(120), title: '' });
  assert.deepEqual(cleanWindow({ pid: 12, window: '8812' }), { pid: 12, app: '', title: '', window: '8812' });
});
