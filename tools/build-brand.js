'use strict';

// Renders the app icon (assets/brand/app-icon.svg) to the sizes the OS
// needs and packs them into app-icon.ico. Everything else in assets/brand
// (logos, tray icons for light and dark bars and alerts, the macOS template,
// favicons) comes ready from the designer's kit.
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
// The window and taskbar icon at every size Windows asks for.
const OUTPUTS = [16, 24, 32, 48, 64, 256].map((size) => ['app-icon.svg', `app-icon-${size}.png`, size]);


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
  for (const [src, out, size] of OUTPUTS) {
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
      return c.toDataURL('image/png');
    })()`);
    const data = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(BRAND, out), data);
    rendered[out] = { size, data };
    console.log(`${out} ${size}px`);
  }
  fs.writeFileSync(path.join(BRAND, 'app-icon.ico'), ico([16, 24, 32, 48, 64, 256].map((n) => rendered[`app-icon-${n}.png`])));
  console.log('app-icon.ico');
  app.exit(0);
});
