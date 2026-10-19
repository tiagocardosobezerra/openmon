'use strict';

// Persists the pet as one JSON file. Writes are debounced and atomic
// (temp file + rename), so a crash never leaves a half-written pet.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPet, migrate } = require('./pet');

function homeDir() {
  return process.env.OPENMON_HOME || path.join(os.homedir(), '.openmon');
}

// The project used to be called Bytelings; move an old pet over once.
function adoptLegacyHome() {
  if (process.env.OPENMON_HOME) return;
  const legacy = path.join(os.homedir(), '.bytelings');
  const current = homeDir();
  try {
    if (!fs.existsSync(current) && fs.existsSync(legacy)) fs.renameSync(legacy, current);
  } catch {}
}

function createStore({ dir, delay = 1500, now = Date.now } = {}) {
  if (!dir) {
    adoptLegacyHome();
    dir = homeDir();
  }
  const file = path.join(dir, 'pet.json');
  let timer = null;
  let pending = null;

  function load() {
    try {
      return migrate(JSON.parse(fs.readFileSync(file, 'utf8')), now());
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Keep the unreadable file for the user instead of overwriting it.
        try {
          fs.renameSync(file, `${file}.broken-${now()}`);
        } catch {}
      }
      return createPet(now());
    }
  }

  function writeNow(pet) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(pet, null, 2)}\n`);
    fs.renameSync(tmp, file);
  }

  function save(pet) {
    pending = pet;
    if (timer) return;
    timer = setTimeout(flush, delay);
    timer.unref?.();
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const pet = pending;
    pending = null;
    writeNow(pet);
  }

  return { file, load, save, flush };
}

module.exports = { createStore, homeDir, adoptLegacyHome };
