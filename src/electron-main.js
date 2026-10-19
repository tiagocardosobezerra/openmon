'use strict';

// Desktop shell: runs the daemon in-process and shows the pet in a small
// transparent, always-on-top window. Clicks pass through everywhere except
// the pet itself. Drag it anywhere; it remembers where it lives.

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, Notification, dialog, ipcMain, nativeImage, nativeTheme, screen, shell } = require('electron');
const { createDaemon } = require('./server');
const { homeDir, adoptLegacyHome } = require('./store');

adoptLegacyHome();
const installer = require('./install');

// Menu and notification text follow the OS language (English or Portuguese).
const PT = {
  'Open card': 'Abrir card',
  'Name…': 'Dar nome…',
  'Play demo': 'Ver demonstração',
  'Show pet': 'Mostrar pet',
  'Sounds': 'Sons',
  'Notify when an agent waits': 'Avisar quando um agente esperar',
  'Chatter': 'Falas',
  'Start with the computer': 'Iniciar com o computador',
  'Claude Code hooks installed ✓': 'Hooks do Claude Code instalados ✓',
  'Connect Claude Code (install hooks)': 'Conectar ao Claude Code (instalar hooks)',
  'Trainer card (share)': 'Cartão de treinador (compartilhar)',
  'Retire to Hall of Fame and lay a new egg': 'Aposentar no Hall da Fama e botar um novo ovo',
  'Powers…': 'Poderes…',
  'Quiet mode': 'Modo silencioso',
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
  'Backups': 'Backups',
  'Bag': 'Mochila',
  'Save a backup now': 'Salvar um backup agora',
  'Export save…': 'Exportar save…',
  'Import save…': 'Importar save…',
  'Open backups folder': 'Abrir pasta de backups',
  'Replace': 'Substituir',
  'Cancel': 'Cancelar',
  'Replace {name} with the pet in this file?': 'Substituir {name} pelo pet deste arquivo?',
  'A backup of the current pet is kept in the backups folder.': 'Um backup do pet atual fica guardado na pasta de backups.',
  'This file is not an Openmon save.': 'Este arquivo não é um save do Openmon.',
  'Reset position': 'Voltar à posição inicial',
  'Quit': 'Sair',
  '{label} needs you': '{label} precisa de você',
  'Your agent is waiting.': 'Seu agente está esperando.',
};
function L(text, vars = {}) {
  const raw = /^pt/i.test(app.getLocale()) && PT[text] ? PT[text] : text;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const WIN_W = 300;
// Tall enough for the stats card above a mythic; clicks pass through the
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

// The brand egg (tray.png + tray@2x.png; a template image on macOS).
function brandTrayIcon(alert = false) {
  const file = path.join(BRAND, alert ? 'tray-alert.png' : process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png');
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
  return [
    { label: pet ? `${pet.nickname ? `${pet.nickname} · ${pet.form}` : pet.form} · Lv ${pet.level}` : 'Openmon', enabled: false },
    { type: 'separator' },
    { label: L('Open card'), click: () => win.webContents.send('command', 'card') },
    { label: L('Powers…'), click: openPowersWindow },
    { label: 'Opendex', click: () => openAppWindow('dex') },
    { label: L('Bag'), click: () => openAppWindow('bag') },
    { label: L('Trainer card (share)'), click: () => openAppWindow('card') },
    { type: 'separator' },
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
    {
      label: L('Size'),
      submenu: [
        [L('Small'), 0.8],
        [L('Normal'), 1],
        [L('Large'), 1.25],
      ].map(([label, scale]) => ({ label, type: 'radio', checked: Math.abs(size - scale) < 0.01, click: () => daemon.setConfig({ scale }) })),
    },
    {
      label: L('Settings'),
      submenu: [
        { label: L('Name…'), click: openNameWindow },
        { type: 'separator' },
        { label: L('Sounds'), type: 'checkbox', checked: !config.muted, click: (item) => daemon.setConfig({ muted: !item.checked }) },
        { label: L('Chatter'), type: 'checkbox', checked: config.chatter, click: (item) => daemon.setConfig({ chatter: item.checked }) },
        { label: L('Notify when an agent waits'), type: 'checkbox', checked: config.notify, click: (item) => daemon.setConfig({ notify: item.checked }) },
        {
          label: L('Start with the computer'),
          type: 'checkbox',
          checked: app.getLoginItemSettings(LOGIN_ITEM).openAtLogin,
          click: (item) => app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: item.checked }),
        },
        { type: 'separator' },
        hooked
          ? { label: L('Claude Code hooks installed ✓'), enabled: false }
          : {
              label: L('Connect Claude Code (install hooks)'),
              click: () => {
                installer.install();
                refreshTray();
              },
            },
        {
          label: L('Backups'),
          submenu: [
            { label: L('Save a backup now'), click: () => daemon.backupNow() },
            { label: L('Export save…'), click: exportSave },
            { label: L('Import save…'), click: importSave },
            { type: 'separator' },
            { label: L('Open backups folder'), enabled: Boolean(daemon.backupDir()), click: () => shell.openPath(daemon.backupDir()) },
          ],
        },
        { label: L('Reset position'), click: () => { const p = defaultPlace(); win.setPosition(p.x, p.y); savePlace(); } },
      ],
    },
    { label: L('Play demo'), click: () => daemon.runDemo() },
    {
      label: L('Retire to Hall of Fame and lay a new egg'),
      visible: Boolean(pet && pet.stage === 'mythic'),
      click: () => daemon.layEgg(),
    },
    { label: L('Show pet'), type: 'checkbox', checked: win.isVisible(), click: (item) => (item.checked ? win.showInactive() : win.hide()) },
    { type: 'separator' },
    { label: L('Quit'), click: () => app.quit() },
  ];
}

// Saves: export to a file you choose, or bring one back.
async function exportSave() {
  const name = ((latest && latest.pet && latest.pet.name) || 'openmon').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const r = await dialog.showSaveDialog({ title: L('Export save…'), defaultPath: path.join(app.getPath('documents'), `${name}.openmon.json`), filters: [{ name: 'Openmon', extensions: ['json'] }] });
  if (!r.canceled && r.filePath) daemon.exportTo(r.filePath);
}

async function importSave() {
  const r = await dialog.showOpenDialog({ title: L('Import save…'), properties: ['openFile'], filters: [{ name: 'Openmon', extensions: ['json'] }] });
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
const APP_PAGES = new Set(['powers', 'dex', 'bag', 'card']);
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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14101b' : '#f3eee4',
    icon: fs.existsSync(APP_ICON) ? APP_ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
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

function refreshTray() {
  if (!tray) return;
  const pet = latest && latest.pet;
  tray.setToolTip(`${PLAYGROUND ? 'Openmon Playground: ' : ''}${pet ? (pet.nickname ? `${pet.nickname} the ${pet.form}` : pet.form) : 'Openmon'}`);
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

function createWindow() {
  const place = loadPlace();
  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
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
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  // Only our own page, never anything else.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.once('ready-to-show', () => win.showInactive());
  // If the page ever crashes, log it and bring the pet back.
  win.webContents.on('render-process-gone', (_e, details) => {
    logError(`renderer gone: ${details.reason}`);
    setTimeout(() => win && !win.isDestroyed() && win.loadURL(`http://127.0.0.1:${port}/`), 1000);
  });
  win.loadURL(petUrl());
}

function wireIpc() {
  ipcMain.on('interactive', (_e, on) => win && win.setIgnoreMouseEvents(!on, { forward: true }));
  ipcMain.on('menu', () => Menu.buildFromTemplate(menuTemplate()).popup({ window: win }));
  ipcMain.on('open-powers', openPowersWindow);
  ipcMain.on('open-name', () => openNameWindow());
  ipcMain.on('open-page', (_e, page) => {
    openAppWindow(page);
  });
  ipcMain.on('drag-start', () => {
    clearInterval(dragTimer);
    const start = screen.getCursorScreenPoint();
    const [wx, wy] = win.getPosition();
    const offset = { x: start.x - wx, y: start.y - wy };
    dragTimer = setInterval(() => {
      const c = screen.getCursorScreenPoint();
      win.setPosition(c.x - offset.x, c.y - offset.y);
    }, 16);
  });
  ipcMain.on('drag-end', () => {
    clearInterval(dragTimer);
    dragTimer = null;
    savePlace();
  });
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
  daemon = createDaemon({ playground: PLAYGROUND });
  try {
    port = await daemon.listen();
  } catch (err) {
    console.error(err.code === 'EADDRINUSE' ? 'Port busy: is Openmon already running ("openmon serve")?' : err);
    app.quit();
    return;
  }
  daemon.bus.on('shutdown', () => app.quit());
  daemon.bus.on('lang', (l) => {
    lang = l;
    if (win && !win.isDestroyed()) win.loadURL(petUrl());
  });
  daemon.bus.on('state', (s) => {
    applyScale((s.config && s.config.scale) || 1);
    // The tray icon wears a "!" while an agent waits for you.
    const waiting = s.live.pose === 'attention';
    if (tray && waiting !== trayAlert) {
      trayAlert = waiting;
      const img = brandTrayIcon(waiting);
      if (img) tray.setImage(img);
      tray.setToolTip(waiting && s.live.focus ? L('{label} needs you', { label: s.live.focus.label }) : 'Openmon');
    }
    const formBefore = latest && latest.pet && latest.pet.form;
    watchAttention(s);
    if (s.pet.form !== formBefore) refreshTray();
  });
  setInterval(() => watchAttention(daemon.state()), 2000).unref();

  wireIpc();
  createWindow();
  if (PLAYGROUND) openControlPanel();
  applyScale(daemon.config().scale || 1);
  latest = daemon.state();
  tray = new Tray(brandTrayIcon() || trayIcon());
  tray.on('click', () => (win.isVisible() ? win.webContents.send('command', 'card') : win.showInactive()));
  refreshTray();
  tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate(menuTemplate())));
  if (capturePath) win.webContents.once('did-finish-load', capture);
});

app.on('second-instance', () => win && win.showInactive());
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
