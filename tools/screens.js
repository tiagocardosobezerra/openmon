'use strict';

// Screenshots for the README: a demo pet (adult, accessories, a full bag,
// two weeks of journal, two agents, one waiting) on a throwaway daemon,
// captured from real windows in English and Portuguese.
//
//   node tools/screens.js        (relaunches itself inside Electron)
//
// Writes docs/screens/<name>.<lang>.png.

const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(require('electron'), [__filename], { stdio: 'inherit' });
  process.exit(result.status === null ? 1 : result.status);
}

const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow } = require('electron');

process.env.OPENMON_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-screens-home-'));
const { createDaemon } = require('../src/server');
const { createStore } = require('../src/store');
const pet = require('../src/pet');
const { COSMETICS } = require('../src/species');

app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-screens-profile-')));
app.on('window-all-closed', () => {});

const OUT = path.join(__dirname, '..', 'docs', 'screens');
const DAY = 24 * 60 * 60 * 1000;

// A deterministic random, so the screenshots do not change between runs.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function demoPet(now) {
  const p = pet.createPet(now - 40 * DAY, null, () => 0.42);
  Object.assign(p, {
    stage: 'adult', lineage: 'craft', trait: 'lore', xp: 5400, bond: 68, shiny: false, nature: 'cheerful',
    stats: { craft: 2100, lore: 2600, shell: 700, test: 520, roam: 90, swarm: 30 },
  });
  for (const key of ['egg', 'sprout', 'craft-juvenile', 'craft-adult', 'lore-juvenile', 'test-juvenile', 'roam-juvenile']) p.dex[key] = now - 30 * DAY;
  for (const a of ['hatch', 'first-evolution', 'first-green', 'night-owl', 'quick-hands']) p.achievements[a] = now - 20 * DAY;
  for (const id of ['cap', 'party', 'beanie', 'headphones', 'flower', 'nightcap', 'scarf', 'bowtie', 'medal']) p.wardrobe.owned[id] = now - 10 * DAY;
  p.wardrobe.head = 'headphones';
  p.wardrobe.neck = 'scarf';
  p.bag = { snack: 4, candy: 1, everstone: 1 };
  p.gifts = { everstone: now - 30 * DAY };
  p.streak = { days: 6, best: 9 };
  p.counters = { ...p.counters, tools: 6200, edits: 2100, testsGreen: 64, testsRed: 9, turns: 310, answers: 120, fastAnswers: 70, pets: 40, evolutions: 3, perfectDays: 4 };
  const fam = { craft: 60, lore: 120, shell: 30, test: 14, roam: 6, swarm: 3 };
  p.journal = [];
  for (let i = 13; i >= 1; i--) {
    if (i === 6 || i === 7) continue; // a weekend off
    const families = Object.fromEntries(Object.entries(fam).map(([k, v]) => [k, Math.round(v * (0.4 + rnd()))]));
    const tools = Object.values(families).reduce((a, b) => a + b, 0);
    p.journal.push({ day: dayKey(now - i * DAY), tools, edits: families.craft, green: Math.round(rnd() * 8), red: Math.round(rnd() * 2), turns: 6 + Math.round(rnd() * 14), waitMs: Math.round(rnd() * 9 * 60000), waits: 5, fastestMs: 4000, families, projects: { 'shop-api': Math.round(tools * 0.6), web: Math.round(tools * 0.4) } });
  }
  return p;
}

const SHOTS = [
  { name: 'pet-attention', path: '/?preview&bare', w: 340, h: 470 },
  { name: 'pet-card', path: '/?preview&bare&hover', w: 340, h: 640 },
  { name: 'bag', path: '/bag.html', w: 1000, h: 1180 },
  { name: 'dex', path: '/dex.html', w: 1000, h: 1250 },
  { name: 'powers', path: '/powers.html', w: 1000, h: 1000 },
  { name: 'help', path: '/help.html', w: 1000, h: 900 },
  { name: 'party', path: '/party.html', w: 1000, h: 1000 },
  { name: 'settings', path: '/settings.html', w: 1000, h: 800 },
];

// Pages are drawn at twice their size (like a high-density screen), so the
// README shows them sharp; the README sets the display width. The window
// may be taller than the screen: it is never shown, only captured.
const SCALE = 2;

async function shot(port, s, lang) {
  const sep = s.path.includes('?') ? '&' : '?';
  const win = new BrowserWindow({
    show: false,
    width: s.w * SCALE,
    height: s.h * SCALE,
    useContentSize: true,
    enableLargerThanScreen: true,
    backgroundColor: '#14101b',
    webPreferences: { backgroundThrottling: false, offscreen: true, zoomFactor: SCALE },
  });
  // The OS clamps a new window to the screen; the size set afterwards sticks.
  win.setContentSize(s.w * SCALE, s.h * SCALE);
  await win.loadURL(`http://127.0.0.1:${port}${s.path}${sep}lang=${lang}&quiet`);
  // No scrollbar in a picture.
  await win.webContents.insertCSS('html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }');
  // Let fonts, art, eye variants and anchors settle.
  await new Promise((r) => setTimeout(r, 3500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `${s.name}.${lang}.png`), img.toPNG());
  win.destroy();
  return img.getSize();
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-screens-'));
  const now = Date.now();
  const store = createStore({ dir, delay: 10 });
  store.save(demoPet(now));
  store.flush();
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, configFile: path.join(dir, 'config.json'), backups: null });
  const port = await daemon.listen();
  daemon.setConfig({ chatter: false, tips: ['rightclick', 'jump', 'help'] });
  // Two agents: one at work, one waiting for a permission.
  daemon.ingest({ session_id: 's-web', hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/cart.ts' }, cwd: '/work/web' });
  daemon.ingest({ session_id: 's-api', hook_event_name: 'UserPromptSubmit', prompt: 'ship it', cwd: '/work/shop-api' });
  daemon.ingest({ session_id: 's-api', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm publish' }, cwd: '/work/shop-api' });
  try {
    for (const lang of ['pt-BR', 'en']) {
      for (const s of SHOTS) {
        const size = await shot(port, s, lang);
        console.log(`${s.name}.${lang}.png ${size.width}x${size.height}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  await daemon.close();
  app.exit(0);
});
