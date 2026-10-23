'use strict';

// Desktop shell: runs the daemon in-process and shows the pet in a small
// transparent, always-on-top window. Clicks pass through everywhere except
// the pet itself. Drag it anywhere; it remembers where it lives.

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, Notification, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, screen, shell } = require('electron');
const { createDaemon } = require('./server');
const { homeDir, adoptLegacyHome } = require('./store');

adoptLegacyHome();
const installer = require('./install');

// Menu and notification text follow the OS language (English or Portuguese).
const PT = {
  'Open card': 'Abrir card',
  'Nickname…': 'Apelido…',
  'Play demo': 'Ver demonstração',
  'Show pet': 'Mostrar pet',
  Lv: 'Nv',
  main: 'principal',
  'Make it the main one': 'Colocar como principal',
  'Take off screen': 'Tirar da tela',
  'Sounds': 'Sons',
  'Notify when an agent waits': 'Avisar quando um agente esperar',
  'Chatter and emotes': 'Falas e emoções',
  'Start with the computer': 'Iniciar com o computador',
  'Connected to Claude Code ✓': 'Conectado ao Claude Code ✓',
  'Connect to Claude Code': 'Conectar ao Claude Code',
  'Trainer card (share)': 'Cartão de treinador (compartilhar)',
  'Retire to Hall of Fame and lay a new egg': 'Aposentar no Hall da Fama e botar um novo ovo',
  'Retire {name} to the Hall of Fame?': 'Aposentar {name} no Hall da Fama?',
  'It leaves the team for good and lays a new egg in its place. The egg keeps the Opendex, the Bag, the accessories and a tenth of its stats.': 'Ele sai do time de vez e bota um novo ovo no lugar. O ovo mantém a Opendex, a Mochila, os acessórios e um décimo dos atributos.',
  Retire: 'Aposentar',
  Powers: 'Habilidades',
  'Quiet mode': 'Modo silencioso',
  'Focus mode': 'Modo foco',
  'Focus until {t}': 'Foco até {t}',
  '25 minutes': '25 minutos',
  '50 minutes': '50 minutos',
  '1 hour 30': '1 hora e 30',
  'End focus': 'Encerrar o foco',
  'Quiet until {t}': 'Silêncio até {t}',
  '30 minutes': '30 minutos',
  '1 hour': '1 hora',
  'Until tomorrow': 'Até amanhã',
  'Turn quiet mode off': 'Desligar o silêncio',
  'Size': 'Tamanho',
  'Small': 'Pequeno',
  'Normal': 'Normal',
  'Large': 'Grande',
  'Settings': 'Configurações',
  'Backups': 'Cópias de segurança',
  'Walk around': 'Passear pela tela',
  'Answer permissions from the pet': 'Responder permissões pelo pet',
  'Turn on': 'Ligar',
  'Answer permissions from the pet?': 'Responder permissões pelo pet?',
  'When an agent asks for permission, the pet shows Allow and Deny. For up to {s} seconds Claude Code waits for your answer on the pet; after that it asks you as usual. You can turn this off any time.': 'Quando um agente pedir permissão, o pet mostra Permitir e Recusar. Por até {s} segundos o Claude Code espera a sua resposta no pet; depois disso ele pergunta como sempre. Dá para desligar quando quiser.',
  'Bag': 'Mochila',
  'More settings…': 'Mais configurações…',
  Pages: 'Páginas',
  'Party': 'Time',
  'How it works': 'Como funciona',
  'Make a copy now': 'Fazer uma cópia agora',
  'Export my pet to a file…': 'Exportar meu pet para um arquivo…',
  'Bring back a pet from a file…': 'Trazer um pet de um arquivo…',
  'Open the copies folder': 'Abrir a pasta das cópias',
  'Replace': 'Substituir',
  'Cancel': 'Cancelar',
  'Replace {name} with the pet in this file?': 'Substituir {name} pelo pet deste arquivo?',
  'A backup of the current pet is kept in the backups folder.': 'Uma cópia do pet atual fica guardada na pasta das cópias.',
  'This file is not an Openmon save.': 'Este arquivo não é um pet do Openmon.',
  'Reset position': 'Voltar à posição inicial',
  'Quit': 'Sair',
  '{label} needs you': '{label} precisa de você',
  'Your agent is waiting.': 'Seu agente está esperando.',
};
// Spanish menu and notification text.
const ES_TEXT = {
  Lv: "Nv",
  main: "principal",
  "Make it the main one": "Hacerlo el principal",
  "Take off screen": "Quitar de la pantalla",
  "Open card": "Abrir tarjeta",
  "Name…": "Apodo…",
  "Nickname…": "Apodo…",
  "Play demo": "Ver demostración",
  "Show pet": "Mostrar mascota",
  "Sounds": "Sonidos",
  "Notify when an agent waits": "Avisar cuando un agente espere",
  "Chatter": "Charla y emociones",
  "Chatter and emotes": "Charla y emociones",
  "Start with the computer": "Iniciar con la computadora",
  "Claude Code hooks installed ✓": "Conectado a Claude Code ✓",
  "Connected to Claude Code ✓": "Conectado a Claude Code ✓",
  "Connect Claude Code (install hooks)": "Conectar con Claude Code",
  "Connect to Claude Code": "Conectar con Claude Code",
  "Trainer card (share)": "Tarjeta de entrenador (compartir)",
  "Retire to Hall of Fame and lay a new egg": "Retirar al Salón de la Fama y poner un huevo nuevo",
  "Retire {name} to the Hall of Fame?": "¿Retirar a {name} al Salón de la Fama?",
  "It leaves the team for good and lays a new egg in its place. The egg keeps the Opendex, the Bag, the accessories and a tenth of its stats.": "Deja el equipo para siempre y pone un huevo nuevo en su lugar. El huevo conserva la Opendex, la Mochila, los accesorios y una décima parte de sus atributos.",
  Retire: "Retirar",
  Powers: "Habilidades",
  "Quiet mode": "Modo silencioso",
  "Quiet until {t}": "Silencio hasta {t}",
  "30 minutes": "30 minutos",
  "1 hour": "1 hora",
  "Until tomorrow": "Hasta mañana",
  "Turn quiet mode off": "Quitar el silencio",
  "Focus mode": "Modo foco",
  "Focus until {t}": "Foco hasta {t}",
  "25 minutes": "25 minutos",
  "50 minutes": "50 minutos",
  "1 hour 30": "1 hora y 30",
  "End focus": "Terminar el foco",
  "Size": "Tamaño",
  "Small": "Pequeño",
  "Normal": "Normal",
  "Large": "Grande",
  "Settings": "Ajustes",
  "Backups": "Copias de seguridad",
  "Walk around": "Pasear por la pantalla",
  "Answer permissions from the pet": "Responder permisos desde la mascota",
  "Turn on": "Activar",
  "Answer permissions from the pet?": "¿Responder permisos desde la mascota?",
  "When an agent asks for permission, the pet shows Allow and Deny. For up to {s} seconds Claude Code waits for your answer on the pet; after that it asks you as usual. You can turn this off any time.": "Cuando un agente pida permiso, la mascota muestra Permitir y Rechazar. Durante hasta {s} segundos Claude Code espera tu respuesta en la mascota; después pregunta como siempre. Puedes desactivarlo cuando quieras.",
  "Bag": "Mochila",
  "Party": "Equipo",
  "More settings…": "Más ajustes…",
  Pages: "Páginas",
  "How it works": "Cómo funciona",
  "Save a backup now": "Hacer una copia ahora",
  "Make a copy now": "Hacer una copia ahora",
  "Export save…": "Exportar mi mascota a un archivo…",
  "Export my pet to a file…": "Exportar mi mascota a un archivo…",
  "Import save…": "Traer una mascota desde un archivo…",
  "Bring back a pet from a file…": "Traer una mascota desde un archivo…",
  "Open backups folder": "Abrir la carpeta de copias",
  "Open the copies folder": "Abrir la carpeta de copias",
  "Replace": "Reemplazar",
  "Cancel": "Cancelar",
  "Replace {name} with the pet in this file?": "¿Reemplazar a {name} por la mascota de este archivo?",
  "A backup of the current pet is kept in the backups folder.": "Se guarda una copia de la mascota actual en la carpeta de copias.",
  "This file is not an Openmon save.": "Este archivo no es una mascota de Openmon.",
  "Reset position": "Volver a la posición inicial",
  "Quit": "Salir",
  "{label} needs you": "{label} te necesita",
  "Your agent is waiting.": "Tu agente está esperando.",
  "Stats card": "Tarjeta",
};
function L(text, vars = {}) {
  const locale = app.getLocale();
  const raw = (/^pt/i.test(locale) && PT[text]) || (/^es/i.test(locale) && ES_TEXT[text]) || text;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const WIN_W = 300;
// Tall enough for the stats card above an Elder; clicks pass through the
// empty part, so the extra height costs nothing.
const WIN_H = 560;
const NOTIFY_AFTER_MS = 20_000;
const captureArg = process.argv.indexOf('--capture');
const capturePath = captureArg >= 0 ? process.argv[captureArg + 1] : null;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// The pet runs detached, so errors go to a log file instead of a console.
function logError(err) {
  try {
    fs.mkdirSync(homeDir(), { recursive: true });
    fs.appendFileSync(path.join(homeDir(), 'error.log'), `${new Date().toISOString()} ${err && err.stack ? err.stack : err}
`);
  } catch {}
}
process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

// The GPU process crashes on some Windows setups with transparent windows.
// A 300×340 canvas is cheap in software, so use that unless asked not to.
if (process.env.OPENMON_GPU !== '1') app.disableHardwareAcceleration();
app.on('child-process-gone', (_e, d) => logError(`child process gone: ${d.type} ${d.reason} (${d.exitCode})`));
// `openmon autostart on|off|status` runs this file just to change the
// login item, then exits; it must not fight the running pet for the lock.
const autostartArg = process.argv.indexOf('--autostart');
const PLAYGROUND = process.argv.includes('--playground');
const LOGIN_ITEM = { args: [path.join(__dirname, 'electron-main.js')] };
if (autostartArg >= 0) {
  // Its own profile folder: sharing the running pet's crashed its network
  // service and took the pet down.
  app.setPath('userData', path.join(require('node:os').tmpdir(), 'openmon-autostart'));
  const mode = process.argv[autostartArg + 1];
  app.whenReady().then(() => {
    if (mode === 'on' || mode === 'off') app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: mode === 'on' });
    console.log(app.getLoginItemSettings(LOGIN_ITEM).openAtLogin ? 'on' : 'off');
    app.exit(0);
  });
} else if (PLAYGROUND) {
  // The playground runs beside the real pet: own profile, no instance lock.
  app.setPath('userData', path.join(require('node:os').tmpdir(), 'openmon-playground-profile'));
} else if (!app.requestSingleInstanceLock()) app.quit();

let tray = null;
let trayAlert = false;
let trayWasWaiting = false;
let win = null;
let daemon = null;
let port = null;
let latest = null;
let notifiedFor = null;
let dragTimer = null;

const placeFile = () => path.join(homeDir(), 'window.json');

function defaultPlace() {
  const { workArea } = screen.getPrimaryDisplay();
  // The playground pet stands to the left of the real one.
  const shift = PLAYGROUND ? WIN_W + 10 : 0;
  return { x: workArea.x + workArea.width - WIN_W - 24 - shift, y: workArea.y + workArea.height - WIN_H };
}

// Saved position, if it is still on a connected screen.
function loadPlace() {
  try {
    const p = JSON.parse(fs.readFileSync(placeFile(), 'utf8'));
    // The pet stands at the bottom of the window: if the window height
    // changed since the position was saved, keep its feet where they were.
    // Saved bounds may be scaled: convert to an unscaled window with the same
    // bottom-right corner (applyScale shrinks or grows it from there).
    p.y += (p.h || 340) - WIN_H;
    p.x += (p.w || WIN_W) - WIN_W;
    const centre = { x: p.x + WIN_W / 2, y: p.y + WIN_H - 40 };
    const area = screen.getDisplayNearestPoint(centre).workArea;
    const inside = centre.x >= area.x && centre.x <= area.x + area.width && centre.y >= area.y && centre.y <= area.y + area.height;
    return inside ? { x: Math.round(p.x), y: Math.round(p.y) } : defaultPlace();
  } catch {
    return defaultPlace();
  }
}

function savePlace() {
  if (!win) return;
  const [x, y] = win.getPosition();
  try {
    fs.mkdirSync(homeDir(), { recursive: true });
    const [w, h] = win.getSize();
    fs.writeFileSync(placeFile(), JSON.stringify({ x, y, w, h }));
  } catch {}
}

const BRAND = path.join(__dirname, '..', 'assets', 'brand');
const APP_ICON = path.join(BRAND, process.platform === 'win32' ? 'app-icon.ico' : 'app-icon-256.png');

// Is the taskbar dark? On Windows the taskbar has its own theme (it can be
// dark while apps are light), read from the registry; elsewhere the system
// colour scheme.
function darkTaskbar() {
  if (process.platform === 'win32') {
    try {
      const out = require('node:child_process').execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'SystemUsesLightTheme'], { encoding: 'utf8', windowsHide: true, timeout: 2000 });
      const m = /SystemUsesLightTheme\s+REG_DWORD\s+0x(\d+)/.exec(out);
      if (m) return Number(m[1]) === 0;
    } catch {}
  }
  return nativeTheme.shouldUseDarkColors;
}

// The brand egg (tray.png + tray@2x.png, a light one for dark taskbars; a
// template image on macOS, which the system tints).
function brandTrayIcon(alert = false) {
  const dark = process.platform !== 'darwin' && darkTaskbar() ? 'tray-dark' : 'tray';
  const file = path.join(BRAND, alert ? `${dark}-alert.png` : process.platform === 'darwin' ? 'trayTemplate.png' : `${dark}.png`);
  if (!fs.existsSync(file)) return null;
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  if (process.platform === 'darwin' && !alert) img.setTemplateImage(true);
  return img;
}

function trayIcon() {
  // 16x16 Openmon face drawn in code: no binary assets in the package.
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 4;
    buf[i] = b;
    buf[i + 1] = g;
    buf[i + 2] = r;
    buf[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x - 7.5) / 7.2, (y - 8.5) / 6.6);
      if (d <= 1) set(x, y, d > 0.82 ? [42, 33, 64] : [147, 129, 242]);
    }
  }
  for (const [x, y] of [[5, 7], [5, 8], [10, 7], [10, 8]]) set(x, y, [42, 33, 64]);
  for (const [x, y] of [[2, 1], [3, 2], [13, 1], [12, 2]]) set(x, y, [42, 33, 64]);
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function menuTemplate() {
  const config = daemon.config();
  const pet = latest && latest.pet;
  const hooked = installer.isInstalled();
  const until = (ms) => new Date(ms).toLocaleTimeString(app.getLocale(), { hour: '2-digit', minute: '2-digit' });
  const minutesToTomorrow = () => {
    const t = new Date();
    t.setHours(24, 0, 0, 0);
    return Math.ceil((t - Date.now()) / 60_000) + 8 * 60; // until 8 am
  };
  const size = config.scale || 1;
  const title = (p) => `${p.nickname ? `${p.nickname} · ${p.form}` : p.form} · ${L('Lv')} ${p.level}`;
  const companions = Object.entries((latest && latest.companions) || {});
  // With companions, each Openmon on screen gets its own entry: its card,
  // making it the main one, or taking it off screen.
  const team = companions.length
    ? [
        { label: pet ? `${title(pet)} · ${L('main')}` : 'Openmon', submenu: [{ label: L('Open card'), click: () => win.webContents.send('command', 'card') }] },
        ...companions.map(([id, c]) => ({
          label: title(c),
          submenu: [
            { label: L('Open card'), click: () => { const w = companionWins.get(id); if (w && !w.isDestroyed()) w.webContents.send('command', 'card'); } },
            { label: L('Make it the main one'), click: () => daemon.makeMain(id) },
            { label: L('Take off screen'), click: () => daemon.setConfig({ companions: (config.companions || []).filter((x) => x !== id) }) },
          ],
        })),
      ]
    : [
        { label: pet ? title(pet) : 'Openmon', enabled: false },
        { type: 'separator' },
        { label: L('Open card'), click: () => win.webContents.send('command', 'card') },
      ];
  return [
    ...team,
    {
      label: L('Pages'),
      submenu: [
        { label: L('Powers'), click: openPowersWindow },
        { label: 'Opendex', click: () => openAppWindow('dex') },
        { label: L('Party'), click: () => openAppWindow('party') },
        { label: L('Bag'), click: () => openAppWindow('bag') },
        { label: L('Trainer card (share)'), click: () => openAppWindow('card') },
        { type: 'separator' },
        { label: L('How it works'), click: () => openAppWindow('help') },
      ],
    },
    { type: 'separator' },
    {
      label: config.focus ? L('Focus until {t}', { t: until(config.focusUntil) }) : L('Focus mode'),
      submenu: [
        { label: L('25 minutes'), click: () => daemon.setFocus(25) },
        { label: L('50 minutes'), click: () => daemon.setFocus(50) },
        { label: L('1 hour 30'), click: () => daemon.setFocus(90) },
        { type: 'separator', visible: Boolean(config.focus) },
        { label: L('End focus'), visible: Boolean(config.focus), click: () => daemon.setFocus(0) },
      ],
    },
    {
      label: config.quiet ? L('Quiet until {t}', { t: until(config.quietUntil) }) : L('Quiet mode'),
      submenu: [
        { label: L('30 minutes'), click: () => daemon.setQuiet(30) },
        { label: L('1 hour'), click: () => daemon.setQuiet(60) },
        { label: L('Until tomorrow'), click: () => daemon.setQuiet(minutesToTomorrow()) },
        { type: 'separator', visible: Boolean(config.quiet) },
        { label: L('Turn quiet mode off'), visible: Boolean(config.quiet), click: () => daemon.setQuiet(0) },
      ],
    },
    hooked ? null : { label: L('Connect to Claude Code'), click: () => { installer.install(); daemon.recheckHooks(); refreshTray(); } },
    { label: L('Settings'), click: () => openAppWindow('settings') },
    {
      label: L('Retire to Hall of Fame and lay a new egg'),
      // Legendaries are at the Elder stage too, but they never retire.
      visible: Boolean(pet && pet.stage === 'mythic' && !pet.legend),
      click: () => retire(),
    },
    { type: 'separator' },
    { label: L('Show pet'), type: 'checkbox', checked: win.isVisible(), click: (item) => showPets(item.checked) },
    { type: 'separator' },
    { label: L('Quit'), click: () => app.quit() },
  ].filter(Boolean);
}

// Retiring cannot be undone, so it asks first.
async function retire() {
  const name = (latest && latest.pet && latest.pet.name) || 'Openmon';
  const r = await dialog.showMessageBox({ type: 'question', buttons: [L('Retire'), L('Cancel')], defaultId: 1, cancelId: 1, message: L('Retire {name} to the Hall of Fame?', { name }), detail: L('It leaves the team for good and lays a new egg in its place. The egg keeps the Opendex, the Bag, the accessories and a tenth of its stats.') });
  if (r.response === 0) daemon.layEgg();
}

// Saves: export to a file you choose, or bring one back.
async function exportSave() {
  const name = ((latest && latest.pet && latest.pet.name) || 'openmon').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const r = await dialog.showSaveDialog({ title: L('Export my pet to a file…'), defaultPath: path.join(app.getPath('documents'), `${name}.openmon.json`), filters: [{ name: 'Openmon', extensions: ['json'] }] });
  if (!r.canceled && r.filePath) daemon.exportTo(r.filePath);
}

async function importSave() {
  const r = await dialog.showOpenDialog({ title: L('Bring back a pet from a file…'), properties: ['openFile'], filters: [{ name: 'Openmon', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  const current = latest && latest.pet ? `${latest.pet.name} (Lv ${latest.pet.level})` : 'Openmon';
  const ok = await dialog.showMessageBox({ type: 'question', buttons: [L('Replace'), L('Cancel')], defaultId: 1, cancelId: 1, message: L('Replace {name} with the pet in this file?', { name: current }), detail: L('A backup of the current pet is kept in the backups folder.') });
  if (ok.response !== 0) return;
  daemon.backupNow();
  try {
    daemon.restoreFile(r.filePaths[0]);
  } catch (err) {
    dialog.showErrorBox('Openmon', L('This file is not an Openmon save.'));
  }
}

// Size: the window grows or shrinks around its bottom-right corner, so the
// pet keeps standing on the same spot.
let currentScale = 1;
function applyScale(scale) {
  if (!win || Math.abs(scale - currentScale) < 0.001) return;
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  const w2 = Math.round(WIN_W * scale);
  const h2 = Math.round(WIN_H * scale);
  win.setBounds({ x: x + w - w2, y: y + h - h2, width: w2, height: h2 });
  currentScale = scale;
  savePlace();
}

// The Powers window: a normal window, closing it leaves the pet running.
let powersWin = null;
// One app window for Powers, Opendex and the trainer card; the top bar
// moves between them.
const APP_PAGES = new Set(['powers', 'dex', 'party', 'bag', 'card', 'help', 'settings', 'starter']);
function openAppWindow(page = 'powers') {
  if (!APP_PAGES.has(page)) page = 'powers';
  const url = `http://127.0.0.1:${port}/${page}.html`;
  if (powersWin && !powersWin.isDestroyed()) {
    if (!powersWin.webContents.getURL().startsWith(url)) powersWin.loadURL(url);
    return bringToFront(powersWin);
  }
  powersWin = new BrowserWindow({
    width: 900,
    height: 780,
    minWidth: 380,
    minHeight: 420,
    title: 'Openmon',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#15101a' : '#f3eee4',
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'page-preload.js') },
  });
  // While you use a page, the pets step behind it; back on top when you leave.
  powersWin.on('focus', () => petsOnTop(false));
  powersWin.on('blur', () => petsOnTop(true));
  powersWin.on('closed', () => petsOnTop(true));
  const origin = `http://127.0.0.1:${port}/`;
  powersWin.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target) && !target.startsWith(origin)) shell.openExternal(target);
    return { action: 'deny' };
  });
  // Pages of the daemon only; anything else opens in the browser.
  powersWin.webContents.on('will-navigate', (e, target) => {
    if (target.startsWith(origin)) return;
    e.preventDefault();
    if (/^https?:\/\//.test(target)) shell.openExternal(target);
  });
  powersWin.once('ready-to-show', () => bringToFront(powersWin));
  powersWin.loadURL(url);
}
const openPowersWindow = () => openAppWindow('powers');

// A page in use stays in front of the pets; they float again when it is left.
let pageInFront = false;
function petsOnTop(on) {
  pageInFront = !on;
  for (const w of [win, ...companionWins.values()]) {
    if (!w || w.isDestroyed()) continue;
    if (on) w.setAlwaysOnTop(true, 'floating');
    else w.setAlwaysOnTop(false);
  }
}

// The pet window never takes focus, so Windows would open our other windows
// behind whatever app is active. A brief always-on-top puts them in front.
function bringToFront(w) {
  if (!w || w.isDestroyed()) return;
  if (w.isMinimized()) w.restore();
  w.show();
  w.setAlwaysOnTop(true);
  w.moveTop();
  w.focus();
  setTimeout(() => !w.isDestroyed() && w.setAlwaysOnTop(false), 400);
}

let nameWin = null;
function openNameWindow() {
  if (nameWin && !nameWin.isDestroyed()) return bringToFront(nameWin);
  const [x, y] = win.getPosition();
  nameWin = new BrowserWindow({
    width: 320,
    height: 150,
    x: x - 10,
    y: Math.max(0, y + WIN_H - 260),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  nameWin.webContents.on('will-navigate', (e) => e.preventDefault());
  nameWin.on('blur', () => nameWin && !nameWin.isDestroyed() && nameWin.close());
  nameWin.once('ready-to-show', () => bringToFront(nameWin));
  nameWin.loadURL(`http://127.0.0.1:${port}/name.html`);
}

// "Write to the agent": a small window you can type in (the pet window
// never takes the keyboard). It answers a question, explains a Deny, or
// sends a message to a conversation. It stays open until you send or close.
let talkWin = null;
const TALK_KINDS = ['message', 'question', 'deny'];
function openTalkWindow(ask) {
  const kind = ask && TALK_KINDS.includes(ask.kind) ? ask.kind : null;
  const ref = ask && typeof ask.ref === 'string' ? ask.ref.slice(0, 120) : '';
  if (!kind || !ref) return;
  if (talkWin && !talkWin.isDestroyed()) talkWin.close();
  const [x, y] = win.getPosition();
  talkWin = new BrowserWindow({
    width: 380,
    height: kind === 'question' ? 420 : 250,
    x: x - 40,
    y: Math.max(0, y + WIN_H - (kind === 'question' ? 520 : 350)),
    frame: false,
    resizable: kind === 'question',
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'page-preload.js') },
  });
  talkWin.webContents.on('will-navigate', (e) => e.preventDefault());
  talkWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  talkWin.once('ready-to-show', () => bringToFront(talkWin));
  talkWin.loadURL(`http://127.0.0.1:${port}/talk.html?kind=${kind}&ref=${encodeURIComponent(ref)}`);
}

function refreshTray() {
  if (!tray) return;
  const pet = latest && latest.pet;
  const name = (p) => (p.nickname ? `${p.nickname} (${p.form})` : p.form);
  const all = [pet, ...Object.values((latest && latest.companions) || {})].filter(Boolean);
  tray.setToolTip(`${PLAYGROUND ? 'Openmon Playground: ' : ''}${all.length ? all.map(name).join(' · ') : 'Openmon'}`);
  // Linux trays only show a static menu; elsewhere it is built fresh on open.
  if (process.platform === 'linux') tray.setContextMenu(Menu.buildFromTemplate(menuTemplate()));
}

let lang = null;
function petUrl() {
  return `http://127.0.0.1:${port}/${lang ? `?lang=${lang}` : ''}`;
}

// Playground control panel: a normal window; closing it ends the playground.
function openControlPanel() {
  const panel = new BrowserWindow({
    width: 470,
    height: 820,
    title: 'Openmon Playground',
    autoHideMenuBar: true,
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  panel.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  panel.on('closed', () => app.quit());
  panel.loadURL(`http://127.0.0.1:${port}/playground.html`);
}

// Another always-on-top window (a game overlay, a screen recorder) can sit
// above the pets and swallow their clicks. On Windows the 'floating' level
// stacks a window just under the taskbar, below such overlays, so a pet moves
// to the very top when it shows, when the pointer reaches it and after a drag.
// At most every 500 ms per window, and never with the pointer on the taskbar
// (its previews and menus stay on top).
function liftPet(w) {
  if (!w || w.isDestroyed() || !w.isVisible() || pageInFront) return;
  const now = Date.now();
  if (now - (w.__lifted || 0) < 500) return;
  const p = screen.getCursorScreenPoint();
  const d = screen.getDisplayNearestPoint(p);
  const inside = (r) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
  if (inside(d.bounds) && !inside(d.workArea)) return;
  w.__lifted = now;
  w.setAlwaysOnTop(true, 'dock');
  w.moveTop();
}

function petWindow(place, size = { width: WIN_W, height: WIN_H }) {
  const w = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: place.x,
    y: place.y,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  w.setAlwaysOnTop(true, 'floating');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w.setIgnoreMouseEvents(true, { forward: true });
  // Only our own page, never anything else.
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.once('ready-to-show', () => {
    w.showInactive();
    liftPet(w);
  });
  return w;
}

function createWindow() {
  win = petWindow(loadPlace());
  // If the page ever crashes, log it and bring the pet back.
  win.webContents.on('render-process-gone', (_e, details) => {
    logError(`renderer gone: ${details.reason}`);
    setTimeout(() => win && !win.isDestroyed() && win.loadURL(petUrl()), 1000);
  });
  win.loadURL(petUrl());
}

// Companions: other Openmons of the team on screen next to the main one,
// each in its own window (Settings → Party → "Also on screen").
const companionWins = new Map();
const companionPlacesFile = () => path.join(homeDir(), PLAYGROUND ? 'companions-playground.json' : 'companions.json');
function companionPlaces() {
  try {
    return JSON.parse(fs.readFileSync(companionPlacesFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveCompanionPlace(id, w) {
  const all = companionPlaces();
  const [x, y] = w.getPosition();
  all[id] = { x, y };
  try {
    fs.writeFileSync(companionPlacesFile(), JSON.stringify(all));
  } catch {}
}
function companionUrl(id) {
  const base = petUrl();
  return `${base}${base.includes('?') ? '&' : '?'}companion=${encodeURIComponent(id)}`;
}
function showPets(on) {
  for (const w of [win, ...companionWins.values()]) {
    if (!w || w.isDestroyed()) continue;
    if (on) {
      w.showInactive();
      liftPet(w);
    } else w.hide();
  }
}

function syncCompanions(state) {
  if (!win || win.isDestroyed()) return;
  // Same size as the main pet (Settings → Size), growing from the bottom-right.
  const [mw0, mh0] = win.getSize();
  for (const w of companionWins.values()) {
    if (w.isDestroyed()) continue;
    const [x, y] = w.getPosition();
    const [cw, ch] = w.getSize();
    if (cw !== mw0 || ch !== mh0) w.setBounds({ x: x + cw - mw0, y: y + ch - mh0, width: mw0, height: mh0 });
  }
  const wanted = ((state.config && state.config.companions) || []).filter((id) => state.companions && state.companions[id]);
  for (const [id, w] of companionWins) {
    if (!wanted.includes(id)) {
      companionWins.delete(id);
      if (!w.isDestroyed()) w.close();
    }
  }
  const saved = companionPlaces();
  wanted.forEach((id, i) => {
    if (companionWins.has(id)) return;
    // To the left of the main pet, unless it was moved before.
    const [mx, my] = win.getPosition();
    const [mw, mh] = win.getSize();
    // To the left of the main pet (to the right when there is no room),
    // and always on a connected screen, even if it was moved there before
    // a monitor was unplugged.
    const step = Math.round(mw * 0.55) * (i + 1);
    const area = screen.getDisplayNearestPoint({ x: mx + mw / 2, y: my + mh / 2 }).workArea;
    const onScreen = (p) => p.x + mw * 0.4 >= area.x && p.x + mw * 0.6 <= area.x + area.width && p.y + mh * 0.5 >= area.y && p.y + mh <= area.y + area.height + 40;
    let place = saved[id];
    if (!place || !onScreen(place)) place = { x: mx - step, y: my };
    if (!onScreen(place)) place = { x: mx + step, y: my };
    const w = petWindow(place, { width: mw, height: mh });
    w.__companion = id;
    if (!win.isVisible()) w.once('ready-to-show', () => w.hide());
    w.loadURL(companionUrl(id));
    w.on('closed', () => companionWins.delete(id));
    companionWins.set(id, w);
  });
}

function wireIpc() {
  const senderWin = (e) => BrowserWindow.fromWebContents(e.sender);
  // While its card is open a pet window takes focus, so clicking anywhere
  // else (another app, the desktop, a page) blurs it and the card closes,
  // like any popover. Closed, it goes back to never stealing focus.
  ipcMain.on('card-open', (e, on) => {
    const w = senderWin(e);
    if (!w || w.isDestroyed()) return;
    w.__cardOpen = on;
    if (on) {
      w.setFocusable(true);
      w.focus();
      if (!w.__blurCloses) {
        w.__blurCloses = true;
        w.on('blur', () => {
          if (w.__cardOpen && !w.isDestroyed()) w.webContents.send('command', 'close-card');
        });
      }
    } else w.setFocusable(false);
  });
  ipcMain.on('interactive', (e, on) => {
    const w = senderWin(e);
    if (!w || w.isDestroyed()) return;
    w.setIgnoreMouseEvents(!on, { forward: true });
    w.__interactive = on;
    if (on && !dragTimer) liftPet(w);
  });
  // Safety net: a pet window that takes clicks while the pointer is outside
  // it goes back to click-through. A transparent window catches clicks on
  // its whole rectangle, so a missed "leave" would block what is under it.
  setInterval(() => {
    if (dragTimer) return;
    const p = screen.getCursorScreenPoint();
    for (const w of [win, ...companionWins.values()]) {
      if (!w || w.isDestroyed() || !w.__interactive) continue;
      const b = w.getBounds();
      if (p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height) continue;
      w.setIgnoreMouseEvents(true, { forward: true });
      w.__interactive = false;
      w.webContents.send('command', 'pointer-out');
    }
  }, 250).unref();
  ipcMain.on('menu', (e) => Menu.buildFromTemplate(menuTemplate()).popup({ window: senderWin(e) || win }));
  ipcMain.on('open-powers', openPowersWindow);
  ipcMain.on('open-name', () => openNameWindow());
  ipcMain.on('open-talk', (_e, ask) => openTalkWindow(ask));
  // The key for free text to the agent: only for the pet windows and the
  // "write to the agent" window, never for other pages.
  ipcMain.handle('contact-key', (e) => {
    const ours = [win, talkWin, ...companionWins.values()].some((w) => w && !w.isDestroyed() && e.sender === w.webContents);
    return ours ? daemon.contactKey() : null;
  });
  // The "connect Claude Code" bubble: same as the menu item.
  ipcMain.on('install-hooks', () => {
    try {
      installer.install();
    } catch (err) {
      dialog.showErrorBox('Openmon', String(err.message || err));
    }
    daemon.recheckHooks();
    refreshTray();
  });
  // Settings page actions that need the desktop (only from the app window).
  ipcMain.handle('settings', async (e, cmd, arg) => {
    if (!powersWin || powersWin.isDestroyed() || e.sender !== powersWin.webContents) return null;
    const info = () => ({ loginItem: app.getLoginItemSettings(LOGIN_ITEM).openAtLogin, hooked: installer.isInstalled() });
    switch (cmd) {
      case 'info':
        return info();
      case 'login':
        app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: Boolean(arg) });
        return info();
      case 'connect':
        try {
          installer.install();
        } catch (err) {
          dialog.showErrorBox('Openmon', String(err.message || err));
        }
        daemon.recheckHooks();
        refreshTray();
        return info();
      case 'backup':
        daemon.backupNow();
        return true;
      case 'export':
        await exportSave();
        return true;
      case 'import':
        await importSave();
        return true;
      case 'open-backups':
        if (daemon.backupDir()) shell.openPath(daemon.backupDir());
        return true;
      case 'reset-position': {
        const p = defaultPlace();
        win.setPosition(p.x, p.y);
        savePlace();
        // The companions line up again to the left of the main pet.
        try {
          fs.unlinkSync(companionPlacesFile());
        } catch {}
        [...companionWins.values()].forEach((w, i) => {
          if (!w.isDestroyed()) w.setPosition(p.x - Math.round(win.getSize()[0] * 0.55) * (i + 1), p.y);
        });
        return true;
      }
      case 'demo':
        daemon.runDemo();
        return true;
      default:
        return null;
    }
  });
  ipcMain.on('open-page', (_e, page) => {
    openAppWindow(page);
  });
  let dragging = null;
  ipcMain.on('drag-start', (e) => {
    clearInterval(dragTimer);
    dragging = senderWin(e) || win;
    const start = screen.getCursorScreenPoint();
    const [wx, wy] = dragging.getPosition();
    const offset = { x: start.x - wx, y: start.y - wy };
    dragTimer = setInterval(() => {
      const c = screen.getCursorScreenPoint();
      if (dragging && !dragging.isDestroyed()) dragging.setPosition(c.x - offset.x, c.y - offset.y);
    }, 16);
  });
  ipcMain.on('drag-end', () => {
    clearInterval(dragTimer);
    dragTimer = null;
    if (dragging && dragging.__companion) saveCompanionPlace(dragging.__companion, dragging);
    else savePlace();
    if (dragging) {
      dragging.__lifted = 0;
      liftPet(dragging);
    }
    dragging = null;
  });
}

// The starter choice opens by itself when an egg starts waiting for one:
// at the first launch and when a new generation begins.
let starterOpened = false;
function watchStarter(state) {
  const waits = Boolean(state.pet && state.pet.awaitingStarter);
  if (waits && !starterOpened && !PLAYGROUND && !state.demo) openAppWindow('starter');
  starterOpened = waits;
}

// OS notification when an agent has waited a while and the user has not
// noticed the pet.
function watchAttention(state) {
  latest = state;
  const live = state.live;
  if (live.pose !== 'attention' || !live.focus) return;
  const since = live.focus.since;
  if (notifiedFor === since || !state.config.notify || state.config.quiet || state.demo) return;
  if (Date.now() - since < NOTIFY_AFTER_MS) return;
  notifiedFor = since;
  if (Notification.isSupported()) {
    const n = new Notification({ title: L('{label} needs you', { label: live.focus.label }), body: live.focus.detail || L('Your agent is waiting.'), silent: true });
    // Clicking the notification jumps to the agent's window.
    const id = live.focus.id;
    n.on('click', () => daemon.focusAgent(id));
    n.show();
  }
}

async function capture() {
  // Dev aid: `electron src/electron-main.js --capture out.png` saves a
  // screenshot of the pet window a few seconds into the demo, then quits.
  daemon.runDemo();
  setTimeout(async () => {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(capturePath, image.toPNG());
    app.quit();
  }, 9500);
}

app.whenReady().then(async () => {
  if (autostartArg >= 0) return;
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  daemon = createDaemon({ playground: PLAYGROUND, cloud: PLAYGROUND ? null : require('./cloud').createCloud() });
  try {
    port = await daemon.listen();
  } catch (err) {
    console.error(err.code === 'EADDRINUSE' ? 'Port busy: is Openmon already running ("openmon serve")?' : err);
    app.quit();
    return;
  }
  // Hooks from an older version learn the agent's questions and messages.
  daemon.upgradeHooks();
  daemon.bus.on('shutdown', () => app.quit());
  daemon.bus.on('lang', (l) => {
    lang = l;
    if (win && !win.isDestroyed()) win.loadURL(petUrl());
    for (const [id, w] of companionWins) if (!w.isDestroyed()) w.loadURL(companionUrl(id));
  });
  daemon.bus.on('state', (s) => {
    applyScale((s.config && s.config.scale) || 1);
    syncCompanions(s);
    // The tray icon wears a "!" while an agent waits for you.
    const waiting = s.live.pose === 'attention';
    if (tray && waiting !== trayAlert) {
      trayAlert = waiting;
      const img = brandTrayIcon(waiting);
      if (img) tray.setImage(img);
      if (waiting && s.live.focus) tray.setToolTip(L('{label} needs you', { label: s.live.focus.label }));
    }
    // The tooltip names every Openmon on screen: refresh it when one
    // evolves, is renamed, or comes on or off screen.
    const teamKey = (x) => [x.pet, ...Object.values(x.companions || {})].map((p) => p && `${p.nickname}|${p.form}|${p.level}`).join(',');
    const before = latest ? teamKey(latest) : '';
    watchStarter(s);
    watchAttention(s);
    if (teamKey(s) !== before || (!waiting && trayWasWaiting)) refreshTray();
    trayWasWaiting = waiting;
  });
  setInterval(() => watchAttention(daemon.state()), 2000).unref();
  wireIpc();
  createWindow();
  if (PLAYGROUND) openControlPanel();
  // Keyboard: Ctrl+Alt+O opens the card, Ctrl+Alt+J jumps to the agent that waits.
  if (!PLAYGROUND) {
    try {
      globalShortcut.register('CommandOrControl+Alt+O', () => win && win.webContents.send('command', 'card'));
      globalShortcut.register('CommandOrControl+Alt+J', () => daemon.focusAgent(null));
    } catch {}
  }
  applyScale(daemon.config().scale || 1);
  latest = daemon.state();
  if (win) win.webContents.once('did-finish-load', () => watchStarter(daemon.state()));
  tray = new Tray(brandTrayIcon() || trayIcon());
  tray.on('click', () => (win.isVisible() ? win.webContents.send('command', 'card') : showPets(true)));
  refreshTray();
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate(menuTemplate())));
  // Light or dark taskbar: the egg follows when the theme changes.
  nativeTheme.on('updated', () => {
    const img = brandTrayIcon(trayAlert);
    if (img) tray.setImage(img);
  });
  if (capturePath) win.webContents.once('did-finish-load', capture);
});

app.on('second-instance', () => win && showPets(true));
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => {
  logError('quit requested');
  // Tells the supervisor (`openmon start`) this exit was on purpose.
  try {
    fs.writeFileSync(path.join(homeDir(), 'quit-intent'), String(Date.now()));
  } catch {}
  savePlace();
  if (daemon) daemon.close();
});
