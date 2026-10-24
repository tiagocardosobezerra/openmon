'use strict';

// Screenshots for the README: a demo pet (adult, accessories, a full bag,
// two weeks of journal, two agents, one waiting) on a throwaway daemon,
// captured from real windows in Portuguese, English and Spanish.
//
//   node tools/screens.js        (relaunches itself inside Electron)
//   node tools/screens.js es     only the languages named
//
// Writes docs/screens/<name>.<lang>.png.

const path = require('node:path');

if (!process.versions.electron) {
  // One Electron per language: each one's assistant conversations are read
  // when its daemon starts.
  const { spawnSync } = require('node:child_process');
  const asked = process.argv.slice(2).filter((a) => ['pt-BR', 'en', 'es'].includes(a));
  for (const lang of asked.length ? asked : ['pt-BR', 'en', 'es']) {
    const result = spawnSync(require('electron'), [__filename, lang], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status === null ? 1 : result.status);
  }
  process.exit(0);
}

const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow, ipcMain } = require('electron');

process.env.OPENMON_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-screens-home-'));
const { createDaemon } = require('../src/server');
const { createStore } = require('../src/store');
const pet = require('../src/pet');

app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-screens-profile-')));
app.on('window-all-closed', () => {});

// OPENMON_SCREENS_OUT: somewhere else (a review, not the README).
const OUT = process.env.OPENMON_SCREENS_OUT || path.join(__dirname, '..', 'docs', 'screens');
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
  for (const key of ['egg', 'craft-juvenile', 'craft-adult', 'lore-juvenile', 'test-juvenile', 'roam-juvenile']) p.dex[key] = now - 30 * DAY;
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
  // The assistant: a conversation, and the quick box with its answer.
  { name: 'assistant', path: '/chat.html?id=c0ffee00c0ffee01', w: 1000, h: 720, desktop: true },
  { name: 'quick', path: '/ask.html', w: 420, h: 400, desktop: true },
];

// A conversation with the assistant, as Openmon keeps it (chats/), per language.
const CHAT = {
  'pt-BR': { title: 'Por que o teste do carrinho falha?', q: 'Por que o teste do carrinho falha?', a: 'O total ignora o desconto quando o cupom é aplicado depois do frete. Corrigi `total()` em **cart.ts**:\n\n```ts\nexport function total(cart: Cart): number {\n  const items = cart.items.reduce((s, i) => s + i.price * i.qty, 0);\n  return Math.max(0, items + cart.shipping - cart.discount); // desconto por último\n}\n```\n\nOs 12 testes passam agora. Quer que eu abra o PR?', quickQ: 'Me lembra às 15h de ligar pro João.', quickA: 'Combinado: às **15:00** eu te aviso para ligar pro João. ⏰' },
  en: { title: 'Why does the cart test fail?', q: 'Why does the cart test fail?', a: 'The total ignores the discount when the coupon comes after shipping. I fixed `total()` in **cart.ts**:\n\n```ts\nexport function total(cart: Cart): number {\n  const items = cart.items.reduce((s, i) => s + i.price * i.qty, 0);\n  return Math.max(0, items + cart.shipping - cart.discount); // discount last\n}\n```\n\nAll 12 tests pass now. Shall I open the PR?', quickQ: 'Remind me at 3 pm to call John.', quickA: 'Done: at **15:00** I will remind you to call John. ⏰' },
  es: { title: '¿Por qué falla la prueba del carrito?', q: '¿Por qué falla la prueba del carrito?', a: 'El total ignora el descuento cuando el cupón llega después del envío. Corregí `total()` en **cart.ts**:\n\n```ts\nexport function total(cart: Cart): number {\n  const items = cart.items.reduce((s, i) => s + i.price * i.qty, 0);\n  return Math.max(0, items + cart.shipping - cart.discount); // descuento al final\n}\n```\n\nLas 12 pruebas pasan ahora. ¿Abro el PR?', quickQ: 'Recuérdame a las 15 llamar a Juan.', quickA: 'Listo: a las **15:00** te aviso para llamar a Juan. ⏰' },
};
function seedChats(dir, lang, now) {
  const t = CHAT[lang];
  const chats = path.join(dir, 'chats');
  fs.mkdirSync(chats, { recursive: true });
  const at = (m) => now - m * 60_000;
  const chat = { id: 'c0ffee00c0ffee01', sessionId: '7a4be6be-457a-4b1d-8748-023f7f090cf2', cwd: path.join(os.homedir(), 'work', 'shop-api'), title: t.title, createdAt: at(30), updatedAt: at(2), costUsd: 0, plan: true, started: true };
  const quick = { id: 'c0ffee00c0ffee02', sessionId: '7a4be6be-457a-4b1d-8748-023f7f090cf3', cwd: path.join(os.homedir(), 'Documents', 'Openmon'), title: lang === 'pt-BR' ? 'Perguntas rápidas' : lang === 'es' ? 'Preguntas rápidas' : 'Quick questions', createdAt: at(10), updatedAt: at(1), costUsd: 0, plan: true, started: true };
  fs.writeFileSync(path.join(chats, 'chats.json'), JSON.stringify([chat, quick]));
  fs.writeFileSync(path.join(chats, `${chat.id}.json`), JSON.stringify([
    { role: 'user', text: t.q, at: at(6) },
    { role: 'tool', text: 'Read: cart.ts', tool: 'Read', at: at(5) },
    { role: 'tool', text: 'Bash: npm test', tool: 'Bash', at: at(5) },
    { role: 'tool', text: 'Edit: cart.ts', tool: 'Edit', at: at(4) },
    { role: 'tool', text: 'Bash: npm test', tool: 'Bash', at: at(3) },
    { role: 'assistant', text: t.a, at: at(2) },
  ]));
  fs.writeFileSync(path.join(chats, `${quick.id}.json`), JSON.stringify([
    { role: 'user', text: t.quickQ, at: at(2) },
    { role: 'tool', text: 'Openmon · remind: João', tool: 'mcp__openmon__remind', at: at(2) },
    { role: 'assistant', text: t.quickA, at: at(1) },
  ]));
  return quick.id;
}

// Pages are drawn at twice their size (like a high-density screen), so the
// README shows them sharp; the README sets the display width. The window
// may be taller than the screen: it is never shown, only captured.
const SCALE = 2;

async function shot(port, s, lang) {
  const sep = s.path.includes('?') ? '&' : '?';
  // The assistant's pages need the desktop bridge (the key), as in the app.
  const desktop = s.desktop ? { preload: path.join(__dirname, '..', 'src', 'page-preload.js'), contextIsolation: true, sandbox: true } : {};
  const win = new BrowserWindow({
    show: false,
    width: s.w * SCALE,
    height: s.h * SCALE,
    useContentSize: true,
    enableLargerThanScreen: true,
    backgroundColor: '#14101b',
    webPreferences: { backgroundThrottling: false, offscreen: true, zoomFactor: SCALE, ...desktop },
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
  const lang = process.argv.find((a) => ['pt-BR', 'en', 'es'].includes(a)) || 'pt-BR';
  const quickChat = seedChats(dir, lang, now);
  const daemon = createDaemon({ port: 0, store, hooksInstalled: () => true, configFile: path.join(dir, 'config.json'), backups: null });
  const port = await daemon.listen();
  daemon.setConfig({ chatter: false, tips: ['rightclick', 'jump', 'help', 'assistant', 'tour'], quickChat });
  // The desktop bridge of the assistant's pages: the key; nothing else to do.
  ipcMain.handle('contact-key', () => daemon.contactKey());
  ipcMain.handle('settings', () => null);
  // Two agents: one at work, one waiting for a permission.
  daemon.ingest({ session_id: 's-web', hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/cart.ts' }, cwd: '/work/web' });
  daemon.ingest({ session_id: 's-api', hook_event_name: 'UserPromptSubmit', prompt: 'ship it', cwd: '/work/shop-api' });
  daemon.ingest({ session_id: 's-api', hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'npm publish' }, cwd: '/work/shop-api' });
  try {
    for (const s of SHOTS) {
      const size = await shot(port, s, lang);
      console.log(`${s.name}.${lang}.png ${size.width}x${size.height}`);
    }
  } catch (err) {
    console.error(err);
  }
  await daemon.close();
  app.exit(0);
});
