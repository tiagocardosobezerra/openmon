'use strict';

// Builds the desktop installers with electron-builder.
//
//   node tools/dist.js          installers for this OS (dist/)
//   node tools/dist.js --dir    an unpacked app, quick to check
//
// The npm package needs Electron in "dependencies" (so `npx openmon start`
// works), while electron-builder insists on "devDependencies". For the
// build only, package.json is adjusted and then put back as it was.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const file = path.join(__dirname, '..', 'package.json');
const original = fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(original);
const electron = pkg.dependencies && pkg.dependencies.electron;
if (electron) {
  delete pkg.dependencies.electron;
  pkg.devDependencies = { ...(pkg.devDependencies || {}), electron };
}
fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
let status = 1;
try {
  const bin = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
  status = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit', shell: process.platform === 'win32' }).status;
} finally {
  fs.writeFileSync(file, original);
}
process.exit(status === null ? 1 : status);
