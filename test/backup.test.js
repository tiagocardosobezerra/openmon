'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBackups, unwrap, wrap } = require('../src/backup');
const pet = require('../src/pet');

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 9, 1, 12).getTime();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-backup-'));

function grown() {
  const p = pet.createPet(T0, 'Rex', () => 0.5);
  p.stage = 'adult';
  p.lineage = 'craft';
  p.xp = 4000;
  return p;
}

test('snapshots: one file per day plus latest, at most every 10 minutes unless forced', () => {
  const dir = tmp();
  let t = T0;
  const b = createBackups({ dir, now: () => t });
  assert.equal(b.maybe(grown(), { scale: 1.25 }), true);
  t += 60_000;
  assert.equal(b.maybe(grown(), {}), false);
  assert.equal(b.maybe(grown(), {}, true), true);
  assert.ok(fs.existsSync(path.join(dir, 'latest.openmon.json')));
  const latest = b.latest();
  assert.equal(latest.pet.name, 'Rex');
  assert.equal(latest.summary.form, 'Forgemaw');
  assert.equal(latest.summary.level, pet.view(latest.pet).level);
});

test('keeps the last 14 days', () => {
  const dir = tmp();
  let t = T0;
  const b = createBackups({ dir, now: () => t });
  for (let i = 0; i < 20; i++) {
    b.maybe(grown(), {}, true);
    t += DAY;
  }
  const daily = fs.readdirSync(dir).filter((f) => f.startsWith('openmon-'));
  assert.equal(daily.length, 14);
  assert.equal(b.list().length, 14);
  assert.ok(b.list()[0].file > b.list()[13].file);
});

test('reads only its own files, and accepts a bare pet.json too', () => {
  const dir = tmp();
  const b = createBackups({ dir, now: () => T0 });
  b.maybe(grown(), {}, true);
  assert.equal(b.read('../../etc/passwd'), null);
  assert.equal(b.read('pet.json'), null);
  assert.ok(b.read(b.list()[0].file));
  assert.equal(unwrap(JSON.stringify(grown()), T0).pet.name, 'Rex');
  assert.throws(() => unwrap('{"hello":1}'), /not an Openmon save/);
  assert.throws(() => unwrap('nope'), /not a JSON file/);
  assert.equal(unwrap(JSON.stringify(wrap(grown(), { muted: true }, T0))).config.muted, true);
});
