'use strict';

// End-to-end test of the real desktop app: opens Openmon (src/electron-main.js)
// against a throwaway home and a free port and checks the pet windows the way
// a person uses them: they open on screen, transparent and on top; clicks
// pass through except over the pet and its card, also after the pointer
// leaves; a drag moves the right window and is remembered; a right-click
// opens that pet's own card; the card's More button opens its panel of pages and modes.
//
//   npm run e2e
//
// Each scenario (one pet; a main pet and a companion) runs in its own
// Electron process. Input goes straight to the pages (webContents
// sendInputEvent) and the shell's view of the mouse is a fake cursor, so
// nothing depends on the real mouse or on which window has focus.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCENARIOS = ['solo', 'team'];
const COMPANION_ID = 'c0ffee00c0ffee';

if (!process.versions.electron) {
  runAll().then((code) => process.exit(code));
} else {
  // A throw while loading would show Electron's error dialog: print it and fail.
  try {
    runScenario(process.argv[process.argv.indexOf('--scenario') + 1]);
  } catch (err) {
    console.error(`FAIL e2e main process: ${err.stack || err}`);
    process.exit(1);
  }
}

// --- outer runner (plain Node) ------------------------------------------------

async function freePort() {
  const net = require('node:net');
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// A save with a young pet (and, for the team, a second one on screen).
function seedHome(scenario) {
  const pet = require('../src/pet');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `openmon-e2e-${scenario}-`));
  const now = Date.now();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const young = (lineage, trait) => Object.assign(pet.createPet(now - 5 * 86400000, null, rnd), { stage: 'juvenile', lineage, trait, xp: 900, bond: 30 });
  const root = young('craft', 'lore');
  root.id = 'a11ce0000000aa';
  root.others = [];
  const config = { lang: 'en', chatter: false, stroll: false, notify: false, muted: true, tips: ['rightclick', 'jump', 'help', 'nickname', 'install'] };
  if (scenario === 'team') {
    // Another type and its own project, so its card has other chips: both
    // cards must still have the same shape.
    const other = young('test', 'shell');
    other.id = COMPANION_ID;
    Object.assign(other, { project: 'shop-api-payments-service', generation: 3, holding: 'everstone' });
    const own = ['id', 'name', 'bornAt', 'nature', 'shiny', 'generation', 'xp', 'stats', 'bond', 'stage', 'lineage', 'trait', 'project', 'holding'];
    root.others.push({ ...Object.fromEntries(own.map((k) => [k, other[k]])), place: 'party', worn: { head: null, face: null, neck: null } });
    config.companions = [COMPANION_ID];
  }
  fs.writeFileSync(path.join(home, 'pet.json'), JSON.stringify(root, null, 2));
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify(config, null, 2));
  return home;
}

async function runAll() {
  const { spawn } = require('node:child_process');
  const electron = require('electron');
  const only = process.argv.slice(2).filter((a) => SCENARIOS.includes(a));
  let failed = 0;
  for (const scenario of only.length ? only : SCENARIOS) {
    const home = seedHome(scenario);
    const port = await freePort();
    console.log(`\n# e2e ${scenario} (port ${port})`);
    let ranAll = true;
    const code = await new Promise((resolve) => {
      const env = { ...process.env, OPENMON_HOME: home, OPENMON_PORT: String(port) };
      delete env.ELECTRON_ENABLE_LOGGING;
      const child = spawn(electron, [__filename, '--scenario', scenario], {
        stdio: ['ignore', 'pipe', 'inherit'],
        env,
      });
      // A scenario that quits before its checks (say, another Openmon holds
      // the lock) exits cleanly: only its own summary line counts as a pass.
      let out = '';
      child.stdout.on('data', (d) => {
        out += d;
        process.stdout.write(d);
      });
      child.on('exit', () => {
        const m = /: (\d+)\/(\d+) checks passed/.exec(out);
        if (!m || m[1] !== m[2] || m[2] === '0') ranAll = false;
      });
      const timer = setTimeout(() => {
        console.error(`e2e ${scenario}: timed out`);
        child.kill();
      }, 120_000);
      child.on('exit', (c) => {
        clearTimeout(timer);
        resolve(c === null ? 1 : c);
      });
    });
    if (code !== 0 || !ranAll) failed++;
    fs.rmSync(home, { recursive: true, force: true });
  }
  console.log(failed ? `\n${failed} scenario(s) failed.` : '\nEnd-to-end tests passed.');
  return failed ? 1 : 0;
}

// --- inside Electron ----------------------------------------------------------

function runScenario(scenario) {
  const electron = require('electron');
  const { app, BrowserWindow, Menu, dialog } = electron;
  // Never touch the screen module before the app is ready (it throws).
  const screen = new Proxy({}, { get: (_t, k) => (typeof electron.screen[k] === 'function' ? electron.screen[k].bind(electron.screen) : electron.screen[k]), set: (_t, k, v) => ((electron.screen[k] = v), true) });

  // Nothing may pop up on the desktop: an error in this process fails the
  // run with its stack on the console instead of Electron's error dialog,
  // and the app's own dialogs are logged, not shown.
  const fatal = (err) => {
    console.error(`FAIL e2e main process: ${err && err.stack ? err.stack : err}`);
    if (app.isReady()) app.exit(1);
    else process.exit(1);
  };
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
  dialog.showErrorBox = (title, content) => fatal(`error dialog: ${title}: ${content}`);
  for (const k of ['showMessageBox', 'showOpenDialog', 'showSaveDialog']) {
    dialog[k] = async (...args) => {
      fatal(`dialog.${k} opened: ${JSON.stringify(args.find((a) => a && a.message) || args[args.length - 1])}`);
      return { response: 1, canceled: true, filePaths: [] };
    };
  }
  const home = process.env.OPENMON_HOME;
  const port = Number(process.env.OPENMON_PORT);
  if (!home || !port || !home.includes('openmon-e2e-')) throw new Error('run through `npm run e2e`');

  // English menus and pages whatever the machine's language; own profile.
  app.commandLine.appendSwitch('lang', 'en-US');
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-e2e-profile-')));

  // What the shell believes about the mouse. The pages get their input
  // from sendInputEvent; the shell reads the pointer for drags and for its
  // click-through safety net, so it reads this fake one.
  let cursor = { x: 0, y: 0 };
  // Where the real pointer is. Over a window that takes clicks the OS sends
  // it real mouse moves (no button held), which would end a drag: the
  // windows stay clear of it.
  let realPointer = { x: 0, y: 0 };
  // (The screen module exists once the app is ready; this runs before the
  // app's own ready handler.)
  app.whenReady().then(() => {
    // Start the pets on the side away from the real pointer, which the
    // test never moves: standing on the bottom of the screen, as the app
    // places them, with room on the left for the companion (165 px).
    const real = screen.getCursorScreenPoint();
    realPointer = real;
    const area = screen.getPrimaryDisplay().workArea;
    const gap = (x) => Math.max(x - 165 - real.x, real.x - (x + 300));
    const x = [area.x + area.width - 324, area.x + 180].sort((a, b) => gap(b) - gap(a))[0];
    const place = { x, y: area.y + area.height - 560, w: 300, h: 560 };
    const d = screen.getPrimaryDisplay();
    console.log(`screen ${d.bounds.width}x${d.bounds.height} work area ${JSON.stringify(area)} scale ${d.scaleFactor}, pointer ${real.x},${real.y}`);
    fs.writeFileSync(path.join(home, 'window.json'), JSON.stringify(place));
    screen.getCursorScreenPoint = () => ({ ...cursor });
  });
  // Whether each window lets clicks through, as last told to the OS.
  const realIgnore = BrowserWindow.prototype.setIgnoreMouseEvents;
  // The real pointer stays out of it: the app asks the OS to forward mouse
  // moves to an ignoring window, which would let it reach the pages.
  BrowserWindow.prototype.setIgnoreMouseEvents = function (ignore, opts = {}) {
    this.__e2eIgnore = Boolean(ignore);
    if (ignore && !opts.forward) this.__e2eNoForward = true;
    return realIgnore.call(this, ignore, { ...opts, forward: false });
  };
  // Menus are recorded instead of shown (a native menu would wait for a click).
  const menus = [];
  Menu.prototype.popup = function (opts = {}) {
    menus.push({ window: opts.window || null, labels: this.items.map((i) => i.label).filter(Boolean) });
  };

  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: Boolean(ok) });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? `\n       ${detail}` : ''}`);
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, ms = 3000, step = 25) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v || Date.now() > end) return v;
      await wait(step);
    }
  }
  const js = (w, code) => w.webContents.executeJavaScript(code);
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(home, file), 'utf8'));
    } catch {
      return null;
    }
  };

  // Input, in window coordinates; the fake cursor follows on screen.
  function mouse(w, type, x, y, extra = {}) {
    const b = w.getBounds();
    cursor = { x: b.x + Math.round(x), y: b.y + Math.round(y) };
    w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), globalX: cursor.x, globalY: cursor.y, ...extra });
  }
  const move = (w, x, y, extra) => mouse(w, 'mouseMove', x, y, extra);
  async function click(w, x, y, button = 'left') {
    move(w, x, y);
    await wait(30);
    mouse(w, 'mouseDown', x, y, { button, clickCount: 1 });
    await wait(30);
    mouse(w, 'mouseUp', x, y, { button, clickCount: 1 });
    await wait(60);
  }
  // Pointer outside the window: the shell sees it gone, the page gets no event.
  function pointerAway(w) {
    const b = w.getBounds();
    cursor = { x: b.x - 200, y: b.y - 200 };
  }

  // A point well inside the pet's body: the middle of its opaque pixels in
  // the canvas column through its centre.
  const petPoint = (w) => js(w, `(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const col = Math.round(c.width / 2);
    let top = -1, bottom = -1;
    for (let y = 0; y < c.height; y++) {
      if (d[(y * c.width + col) * 4 + 3] > 200) { if (top < 0) top = y; bottom = y; }
    }
    if (top < 0) return null;
    return { x: r.left + (col / c.width) * r.width, y: r.top + (((top + bottom) / 2) / c.height) * r.height, top: r.top + (top / c.height) * r.height };
  })()`);
  const cardBox = (w) => js(w, `(() => {
    const c = document.getElementById('card');
    if (!c || c.hidden || c.classList.contains('closing')) return null;
    return { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight };
  })()`);
  const buttonBox = (w, id) => js(w, `(() => {
    const b = document.getElementById(${JSON.stringify(id)});
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, text: b.textContent.trim() };
  })()`);

  // The pet windows show the daemon's root page (with ?lang / ?companion).
  const petWindows = () => BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && /^\/(\?|$)/.test(w.webContents.getURL().slice(`http://127.0.0.1:${port}`.length)) && w.webContents.getURL().startsWith(`http://127.0.0.1:${port}/`));

  // The pages: opened from the pet, each one draws (not a blank window),
  // has no script errors, and the pets step behind it while it is open.
  async function pages(main, pets) {
    const errors = [];
    js(main, `openmonDesktop.openPage('bag')`);
    const page = await until(() => BrowserWindow.getAllWindows().find((w) => !pets.includes(w) && w.isVisible() && /\/bag\.html/.test(w.webContents.getURL()) && !w.webContents.isLoading()), 8000);
    check('pages: the Bag opens in the app window', page);
    if (!page) return;
    page.webContents.on('console-message', (_e, level, message) => level >= 3 && errors.push(message));
    page.webContents.on('render-process-gone', (_e, d) => errors.push(`renderer gone: ${d.reason}`));
    check('pages: the pets step behind an open page', pets.every((w) => !w.isAlwaysOnTop() && w.__belowPage));
    for (const name of ['bag', 'party', 'dex', 'powers', 'card', 'help', 'settings']) {
      if (!page.webContents.getURL().endsWith(`/${name}.html`)) {
        // Through the top bar, as a person would.
        await js(page, `location.href = '/${name}.html'`).catch(() => {});
        await until(() => page.webContents.getURL().endsWith(`/${name}.html`) && !page.webContents.isLoading(), 6000);
      }
      await wait(900);
      const drawn = await until(async () => {
        const shot = await page.webContents.capturePage();
        const { width, height } = shot.getSize();
        const px = shot.toBitmap();
        // Something besides the background: text, panels, art.
        const colors = new Set();
        for (let y = 0; y < height; y += 23) for (let x = 0; x < width; x += 17) {
          const i = (y * width + x) * 4;
          colors.add(`${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`);
        }
        return colors.size > 6 ? colors.size : null;
      }, 4000, 200);
      check(`pages: ${name} draws`, drawn, 'the window stayed blank');
      const text = await js(page, `document.body.innerText.length`).catch(() => 0);
      check(`pages: ${name} has its content`, text > 40, `${text} characters`);
    }
    check('pages: no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    page.close();
    // (Electron reports the 'floating' level as "not on top" on Windows: the
    // shell's own record of the layer is what counts.)
    check('pages: the pets float again once the page is closed', await until(() => pets.every((w) => w.__belowPage === false), 2000));
  }

  // Clicks pass through everywhere except the pet, and again once the
  // pointer leaves (by the page's mouseleave and by the shell's safety net).
  async function clickThrough(w, label) {
    const p = await petPoint(w);
    check(`${label}: pet is drawn`, p, 'no opaque pixels in the canvas');
    if (!p) return;
    check(`${label}: click-through at start`, w.__e2eIgnore === true);
    check(`${label}: click-through always forwards mouse moves (hover keeps working)`, !w.__e2eNoForward);
    move(w, p.x, p.y);
    check(`${label}: pointer over the pet takes clicks`, await until(() => w.__e2eIgnore === false, 1500));
    move(w, 6, 6);
    check(`${label}: pointer over an empty corner lets clicks through`, await until(() => w.__e2eIgnore === true, 1500));
    // The page sees the pointer leave (the shell still thinks it is inside).
    move(w, p.x, p.y);
    await until(() => w.__e2eIgnore === false, 1500);
    // At the pet's spot: a stray mousemove from it would keep the clicks, so
    // only the page's mouseleave handler can pass this.
    mouse(w, 'mouseLeave', p.x, p.y);
    const b = w.getBounds();
    cursor = { x: b.x + Math.round(p.x), y: b.y + Math.round(p.y) };
    check(`${label}: leaving the window lets clicks through (page)`, await until(() => w.__e2eIgnore === true, 200));
    // The page never hears about it (a missed leave): the shell's check does it.
    move(w, p.x, p.y);
    await until(() => w.__e2eIgnore === false, 1500);
    pointerAway(w);
    check(`${label}: pointer gone without a leave event lets clicks through (shell)`, await until(() => w.__e2eIgnore === true, 1000));
    // And the page knows: coming back takes clicks again.
    move(w, p.x, p.y);
    check(`${label}: coming back over the pet takes clicks again`, await until(() => w.__e2eIgnore === false, 1500));
    move(w, 6, 6);
    await until(() => w.__e2eIgnore === true, 1500);
  }

  async function drag(w, others, label, saved) {
    const p = await petPoint(w);
    if (!p) return check(`${label}: drag`, false, 'pet not found');
    const before = w.getPosition();
    const othersBefore = others.map((o) => o.getPosition());
    move(w, p.x, p.y);
    await wait(40);
    mouse(w, 'mouseDown', p.x, p.y, { button: 'left', clickCount: 1 });
    await wait(60);
    // Away from the real pointer (see realPointer), and up: the windows
    // stand on the bottom of the screen.
    const dx = before[0] + 150 > realPointer.x ? 90 : -90;
    const dy = -60;
    for (let i = 1; i <= 6; i++) {
      // The window follows the pointer, so the point in the window stays put.
      const b = w.getBounds();
      cursor = { x: before[0] + Math.round(p.x) + (dx * i) / 6, y: before[1] + Math.round(p.y) + (dy * i) / 6 };
      w.webContents.sendInputEvent({ type: 'mouseMove', x: cursor.x - b.x, y: cursor.y - b.y, globalX: cursor.x, globalY: cursor.y, button: 'left', modifiers: ['leftButtonDown'] });
      await wait(50);
    }
    await wait(80);
    const b = w.getBounds();
    w.webContents.sendInputEvent({ type: 'mouseUp', x: cursor.x - b.x, y: cursor.y - b.y, globalX: cursor.x, globalY: cursor.y, button: 'left', clickCount: 1 });
    await wait(200);
    const after = w.getPosition();
    // It follows the pointer, held by the top of its head: pressed on its
    // middle, the hand ends up on the same column but higher on the pet, so
    // the window moves sideways with the pointer and hangs lower under it.
    const held = { x: cursor.x - after[0], y: cursor.y - after[1] };
    check(`${label}: drag moves the window`, after[0] === before[0] + dx && after[1] > before[1] + dy, `from ${before} to ${after}, wanted a move of ${dx} and more than ${dy}`);
    check(`${label}: carried by the top of its head`, Math.abs(held.x - p.x) <= 2 && held.y < p.y - 10 && held.y > 0, `held at ${held.x},${held.y}, pressed at ${Math.round(p.x)},${Math.round(p.y)}`);
    check(`${label}: drag leaves the other windows alone`, others.every((o, i) => String(o.getPosition()) === String(othersBefore[i])));
    const place = await until(() => {
      const s = saved();
      return s && s.x === after[0] && s.y === after[1] ? s : null;
    }, 1500);
    check(`${label}: new place is saved`, place, `saved: ${JSON.stringify(saved())}`);
    // The drag has ended: the window no longer follows the pointer.
    cursor = { x: cursor.x + 150, y: cursor.y + 40 };
    await wait(120);
    check(`${label}: drag ends on release`, String(w.getPosition()) === String(after));
    move(w, 6, 6);
    await until(() => w.__e2eIgnore === true, 1500);
  }

  async function openCard(w, others, label) {
    const p = await petPoint(w);
    if (!p) return null;
    const menusBefore = menus.length;
    await click(w, p.x, p.y, 'right');
    const box = await until(() => cardBox(w), 2000);
    check(`${label}: right-click opens its card`, box);
    check(`${label}: right-click does not open the menu`, menus.length === menusBefore);
    for (const o of others) check(`${label}: right-click opens no other card`, !(await cardBox(o)));
    // Let the opening animation settle.
    await wait(400);
    return { box: await cardBox(w), pet: p };
  }

  async function cardFooter(w, label) {
    const ids = ['card-powers', 'card-party', 'card-bag', 'card-more'];
    const buttons = [];
    for (const id of ids) buttons.push(await buttonBox(w, id));
    check(`${label}: card footer shows Skills, Party, Bag, More`, buttons.map((b) => b && b.w > 0 && b.text).join(',') === 'Skills,Party,Bag,More', JSON.stringify(buttons.map((b) => b && b.text)));
    const cut = await js(w, `[...document.querySelectorAll('.card-actions .btn span')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent)`);
    check(`${label}: no footer label is cut off`, cut.length === 0, JSON.stringify(cut));
    const more = buttons[3];
    if (!more || !more.w) return;
    move(w, more.x, more.y);
    check(`${label}: card takes clicks`, await until(() => w.__e2eIgnore === false, 1500));
    const before = menus.length;
    await click(w, more.x, more.y);
    const panel = await until(() => js(w, `(() => { const p = document.querySelector('.more-panel'); return p && !p.hidden && p.getBoundingClientRect().height > 40 ? [...p.querySelectorAll('.more-pages .btn')].map((b) => b.textContent) : null; })()`), 1500);
    check(`${label}: More opens its panel inside the card`, Array.isArray(panel) && panel.includes('Opendex') && panel.includes('Settings'), JSON.stringify(panel));
    check(`${label}: More opens no native menu`, menus.length === before);
    await click(w, more.x, more.y);
    check(`${label}: a second click on More closes the panel`, await until(() => js(w, `document.querySelector('.more-panel').hidden`), 1500));
  }

  app.whenReady().then(async () => {
    try {
      // Wait for the app's pet windows to show and draw.
      const want = scenario === 'team' ? 2 : 1;
      const ready = await until(async () => {
        const ws = petWindows();
        if (ws.length < want || !ws.every((w) => w.isVisible() && !w.webContents.isLoading())) return null;
        for (const w of ws) if (!(await petPoint(w).catch(() => null))) return null;
        // The main pet first.
        return ws.sort((a, b) => Boolean(a.__companion) - Boolean(b.__companion));
      }, 30_000, 200);
      check(`${want} pet window(s) open`, ready, JSON.stringify(await Promise.all(petWindows().map(async (w) => ({ url: w.webContents.getURL(), bounds: w.getBounds(), visible: w.isVisible(), loading: w.webContents.isLoading(), pet: await petPoint(w).catch((e) => String(e)) })))));
      if (!ready) throw new Error('pet windows never showed');
      // The card is drawn from state the page gets once connected.
      await wait(800);
      const main = ready.find((w) => !w.__companion);
      const companion = ready.find((w) => w.__companion);
      check('one main pet window', main);
      if (scenario === 'team') check('companion window is the configured one', companion && companion.__companion === COMPANION_ID);

      for (const w of ready) {
        const label = w.__companion ? 'companion' : 'main';
        const b = w.getBounds();
        const area = screen.getDisplayMatching(b).workArea;
        check(`${label}: on screen`, b.x >= area.x && b.y >= area.y && b.x + b.width <= area.x + area.width && b.y + b.height <= area.y + area.height, `${JSON.stringify(b)} in ${JSON.stringify(area)}`);
        check(`${label}: always on top`, w.isAlwaysOnTop());
        // What the window draws in an empty corner: nothing at all.
        const shot = await w.webContents.capturePage({ x: 0, y: 0, width: 8, height: 8 });
        const alpha = shot.toBitmap()[3];
        check(`${label}: empty corner is see-through`, alpha === 0, `alpha ${alpha}`);
        const corner = await js(w, `getComputedStyle(document.body).backgroundColor`);
        check(`${label}: page background is transparent`, /rgba\(0, 0, 0, 0\)|transparent/.test(corner), corner);
        check(`${label}: never takes focus`, !w.isFocusable());
      }
      if (companion) {
        check('companion has the main pet\'s size', String(companion.getSize()) === String(main.getSize()), `${companion.getSize()} vs ${main.getSize()}`);
        const [mx] = main.getPosition();
        const [cx] = companion.getPosition();
        check('companion stands beside the main pet', cx !== mx);
      }

      for (const w of ready) await clickThrough(w, w.__companion ? 'companion' : 'main');

      await drag(main, ready.filter((w) => w !== main), 'main', () => readJson('window.json'));
      if (companion) await drag(companion, [main], 'companion', () => (readJson('companions.json') || {})[COMPANION_ID]);

      const cards = [];
      for (const w of ready) {
        const label = w.__companion ? 'companion' : 'main';
        const card = await openCard(w, ready.filter((o) => o !== w), label);
        if (card && card.box) {
          check(`${label}: card sits above the pet`, card.box.y + card.box.h <= card.pet.y, JSON.stringify(card));
          await cardFooter(w, label);
          cards.push(card);
        }
        // Close it again (Escape), so the next window's check starts clean.
        w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
        w.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
        await until(async () => !(await cardBox(w)), 1500);
        move(w, 6, 6);
        await until(() => w.__e2eIgnore === true, 1500);
      }
      if (cards.length === 2) {
        const [a, b] = cards.map((c) => c.box);
        const same = Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1;
        check('both cards have the same size and place over their pet', same, `main ${JSON.stringify(a)} companion ${JSON.stringify(b)}`);
      }
      if (scenario === 'solo') await pages(main, ready);
    } catch (err) {
      check('scenario ran to the end', false, err.stack || String(err));
    }
    const failed = results.filter((r) => !r.ok).length;
    console.log(`${scenario}: ${results.length - failed}/${results.length} checks passed`);
    app.exit(failed ? 1 : 0);
  });

  // The app itself, exactly as it starts on a desktop.
  require('../src/electron-main.js');
}
