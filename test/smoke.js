'use strict';

// Renderer smoke test. Loads every page in a hidden Electron window
// against a throwaway daemon, plays the demo (hatch included) at 4× speed
// and fails on any console error, crash or failed load.
//
//   npm run smoke
//
// Run with plain Node, it relaunches itself inside Electron.

const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const electron = require('electron');
  const result = spawnSync(electron, [__filename], { stdio: 'inherit', env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
  process.exit(result.status === null ? 1 : result.status);
}

const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow } = require('electron');
const { createDaemon } = require('../src/server');
const { createStore } = require('../src/store');

app.disableHardwareAcceleration();
// Never share a profile with a pet that may be running.
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-smoke-profile-')));
// Windows come and go one per page; do not quit in between.
app.on('window-all-closed', () => {});

const PAGES = [
  { path: '/?preview&hover', demo: true },
  { path: '/?preview&lang=pt-BR', demo: true },
  { path: '/dex.html?all' },
  { path: '/dex.html' },
  { path: '/dex.html?lang=pt-BR' },
  { path: '/card.html' },
  { path: '/name.html' },
  { path: '/playground.html' },
  { path: '/powers.html' },
  { path: '/powers.html?tab=shell' },
];

const problems = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function visit(port, page) {
  const win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { sandbox: true, contextIsolation: true } });
  const where = page.path;
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level >= 3) problems.push(`${where}: console error: ${message} (${path.basename(String(source))}:${line})`);
  });
  win.webContents.on('render-process-gone', (_e, d) => problems.push(`${where}: renderer gone (${d.reason})`));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => problems.push(`${where}: failed to load ${url} (${desc})`));
  await win.loadURL(`http://127.0.0.1:${port}${page.path}`);
  if (page.demo) {
    const { durationMs } = await (await fetch(`http://127.0.0.1:${port}/api/demo?speed=4`, { method: 'POST' })).json();
    await wait(durationMs + 500);
  } else {
    await wait(1500);
  }
  // Page-level sanity: something was drawn on the first canvas.
  const drawn = await win.webContents.executeJavaScript(`(() => {
    const c = document.querySelector('canvas');
    if (!c || !c.width) return 'no canvas';
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return 'ok';
    return 'blank canvas';
  })()`);
  if (drawn !== 'ok' && !['/name.html', '/playground.html'].includes(page.path) && !page.path.startsWith('/powers.html')) problems.push(`${where}: ${drawn}`);
  win.destroy();
}

app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-smoke-'));
  const daemon = createDaemon({ port: 0, store: createStore({ dir, delay: 50 }), hooksInstalled: () => true, configFile: path.join(dir, 'config.json') });
  const port = await daemon.listen();
  try {
    for (const page of PAGES) {
      process.stdout.write(`smoke ${page.path} … `);
      const before = problems.length;
      await visit(port, page);
      console.log(problems.length === before ? 'ok' : 'FAILED');
    }
  } catch (err) {
    problems.push(`smoke runner: ${err.stack || err}`);
  }
  await daemon.close();
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    app.exit(1);
  } else {
    console.log('\nSmoke test passed.');
    app.exit(0);
  }
});
