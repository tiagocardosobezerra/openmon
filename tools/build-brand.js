'use strict';

// Renders the brand SVGs (assets/brand) to the PNG and ICO files the app
// and the OS need: tray icons, app icon sizes, favicon.
//
//   npm run brand
//
// Run with plain Node, it relaunches itself inside Electron (which renders
// SVG exactly like the app does).

const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(require('electron'), [__filename], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}

const fs = require('node:fs');
const os = require('node:os');
const { app, BrowserWindow } = require('electron');

const BRAND = path.join(__dirname, '..', 'assets', 'brand');
// The designer's sizes: the app icon is the egg on a purple tile; below
// 48 px the symbol becomes the simple silhouette (tray, favicons). The macOS
// tray needs a black "template" silhouette, which the OS tints.
const OUTPUTS = [
  ['source/tray-16.svg', 'tray.png', 16],
  ['source/tray-32.svg', 'tray@2x.png', 32],
  ['source/tray-16.svg', 'trayTemplate.png', 16, 'silhouette'],
  ['source/tray-32.svg', 'trayTemplate@2x.png', 32, 'silhouette'],
  ['source/favicon-16.svg', 'favicon-16.png', 16],
  ['source/favicon-32.svg', 'favicon-32.png', 32],
  ['icon.svg', 'favicon-48.png', 48],
  ['app-icon.svg', 'app-icon-256.png', 256],
  ['app-icon.svg', 'app-icon-1024.png', 1024],
  ['logo-mark.svg', 'logo-mark-1024.png', 1024],
  ['source/tray-16.svg', 'tray-alert.png', 16, 'alert'],
  ['source/tray-32.svg', 'tray-alert@2x.png', 32, 'alert'],
  // A light egg for dark taskbars (Windows dark mode, dark Linux panels).
  ['source/tray-dark-16.svg', 'tray-dark.png', 16],
  ['source/tray-dark-32.svg', 'tray-dark@2x.png', 32],
  ['source/tray-dark-16.svg', 'tray-dark-alert.png', 16, 'alert'],
  ['source/tray-dark-32.svg', 'tray-dark-alert@2x.png', 32, 'alert'],
];

app.disableHardwareAcceleration();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'openmon-brand-')));
app.on('window-all-closed', () => {});

// An ICO file whose entries are PNGs (supported since Windows Vista).
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL('data:text/html,<canvas id=c></canvas>');
  const rendered = {};
  for (const [src, out, size, mode] of OUTPUTS) {
    const svg = fs.readFileSync(path.join(BRAND, src), 'utf8');
    const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const dataUrl = await win.webContents.executeJavaScript(`(async () => {
      const img = new Image();
      img.src = ${JSON.stringify(url)};
      await img.decode();
      const c = document.getElementById('c');
      c.width = ${size}; c.height = ${size};
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, ${size}, ${size});
      const k = Math.min(${size} / img.naturalWidth, ${size} / img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.drawImage(img, (${size} - w) / 2, (${size} - h) / 2, w, h);
      if (${JSON.stringify(mode || '')} === 'alert') {
        // Yellow badge with "!" in the bottom-right corner.
        const r = ${size} * 0.3;
        const cx = ${size} - r - 0.5, cy = ${size} - r - 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe156'; ctx.fill();
        ctx.lineWidth = Math.max(1, ${size} / 16); ctx.strokeStyle = '#2a2140'; ctx.stroke();
        ctx.fillStyle = '#2a2140';
        ctx.fillRect(cx - r * 0.14, cy - r * 0.62, r * 0.28, r * 0.72);
        ctx.fillRect(cx - r * 0.14, cy + r * 0.24, r * 0.28, r * 0.28);
      }
      if (${JSON.stringify(mode || '')} === 'silhouette') {
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, ${size}, ${size});
      }
      return c.toDataURL('image/png');
    })()`);
    const data = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(BRAND, out), data);
    rendered[out] = { size, data };
    console.log(`${out} ${size}px`);
  }
  fs.writeFileSync(path.join(BRAND, 'favicon.ico'), ico(['favicon-16.png', 'favicon-32.png', 'favicon-48.png'].map((n) => rendered[n])));
  fs.writeFileSync(path.join(BRAND, 'app-icon.ico'), ico([{ size: 16, data: rendered['favicon-16.png'].data }, rendered['app-icon-256.png']]));
  console.log('favicon.ico, app-icon.ico');
  app.exit(0);
});
