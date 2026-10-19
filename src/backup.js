'use strict';

// Backups, so a new computer (or a formatted one) does not mean a new egg.
//
// Snapshots go to a folder outside ~/.openmon: by default Documents/Openmon Backups,
// which OneDrive, iCloud Drive and most backup tools already copy. One file
// per day (the last 14 are kept) plus latest.openmon.json. A fresh install
// that finds a backup there offers to bring the pet back.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrate, view } = require('./pet');

const FORMAT = 'openmon-save';
const KEEP_DAYS = 14;
const EVERY_MS = 10 * 60 * 1000;
const DAILY = /^openmon-\d{4}-\d{2}-\d{2}\.openmon\.json$/;
const LATEST = 'latest.openmon.json';

// Documents, preferring a OneDrive-synced one on Windows.
function documentsDir() {
  const home = os.homedir();
  const synced = [process.env.OneDrive, process.env.OneDriveConsumer].filter(Boolean);
  const candidates = [
    ...synced.flatMap((d) => [path.join(d, 'Documentos'), path.join(d, 'Documents')]),
    path.join(home, 'Documents'),
    path.join(home, 'Documentos'),
  ];
  return candidates.find((d) => {
    try {
      return fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  }) || home;
}

// A custom OPENMON_HOME (tests, the dev daemon) keeps its backups inside it,
// so it never touches your real ones.
function defaultDir() {
  if (process.env.OPENMON_HOME) return path.join(process.env.OPENMON_HOME, 'backups');
  return path.join(documentsDir(), 'Openmon Backups');
}

function wrap(pet, config, now) {
  return { format: FORMAT, version: 1, savedAt: now, pet, config: config || {} };
}

// Reads a save file. Throws a short message when it is not one.
function unwrap(text, now = Date.now()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  // A bare pet.json works too.
  if (data && data.format !== FORMAT && data.xp !== undefined && data.stats) data = wrap(data, {}, now);
  if (!data || data.format !== FORMAT || !data.pet || typeof data.pet !== 'object') throw new Error('not an Openmon save');
  return { pet: migrate(data.pet, now), config: data.config && typeof data.config === 'object' ? data.config : {}, savedAt: data.savedAt || null };
}

function summary(pet, savedAt) {
  const v = view(pet);
  return { name: v.name, nickname: v.nickname, form: v.form, stage: v.stage, level: v.level, shiny: v.shiny, generation: v.generation, dexSeen: Object.keys(pet.dex || {}).length, savedAt };
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function createBackups({ dir = defaultDir(), now = Date.now } = {}) {
  let lastAt = 0;

  function snapshot(pet, config) {
    const t = now();
    const text = `${JSON.stringify(wrap(pet, config, t), null, 2)}\n`;
    try {
      writeAtomic(path.join(dir, `openmon-${dayKey(t)}.openmon.json`), text);
      writeAtomic(path.join(dir, LATEST), text);
      lastAt = t;
      prune();
      return true;
    } catch {
      return false;
    }
  }

  // At most every 10 minutes, unless forced (evolutions, new eggs, renames).
  function maybe(pet, config, force = false) {
    if (!force && now() - lastAt < EVERY_MS) return false;
    return snapshot(pet, config);
  }

  function prune() {
    const daily = fs.readdirSync(dir).filter((f) => DAILY.test(f)).sort().reverse();
    for (const f of daily.slice(KEEP_DAYS)) fs.rmSync(path.join(dir, f), { force: true });
  }

  function list() {
    try {
      return fs.readdirSync(dir)
        .filter((f) => DAILY.test(f))
        .sort()
        .reverse()
        .map((f) => {
          try {
            const save = unwrap(fs.readFileSync(path.join(dir, f), 'utf8'), now());
            return { file: f, ...summary(save.pet, save.savedAt) };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function latest() {
    try {
      const save = unwrap(fs.readFileSync(path.join(dir, LATEST), 'utf8'), now());
      return { ...save, summary: summary(save.pet, save.savedAt) };
    } catch {
      return null;
    }
  }

  // Only files inside the backup folder, by name.
  function read(name) {
    if (name === 'latest') return latest();
    if (!DAILY.test(String(name))) return null;
    try {
      const save = unwrap(fs.readFileSync(path.join(dir, name), 'utf8'), now());
      return { ...save, summary: summary(save.pet, save.savedAt) };
    } catch {
      return null;
    }
  }

  // Copies the current latest backup to kept-<time>.openmon.json, which is
  // never pruned. Used before a new egg starts over an offered backup.
  function keepAside() {
    try {
      const src = path.join(dir, LATEST);
      if (!fs.existsSync(src)) return null;
      const name = `kept-${now()}.openmon.json`;
      fs.copyFileSync(src, path.join(dir, name));
      return name;
    } catch {
      return null;
    }
  }

  return { dir, snapshot, maybe, list, latest, read, keepAside, lastAt: () => lastAt };
}

module.exports = { createBackups, defaultDir, documentsDir, wrap, unwrap, summary, FORMAT };
