'use strict';

// Builds the README banners (assets/openmon-banner.svg and .en.svg): the
// logo, a tagline and an evolution line drawn with the official art. Every
// SVG is inlined, so the banner renders on GitHub, where an SVG shown as an
// image cannot load other files.
//
//   node tools/build-banner.js

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'art', 'official');
const OUT = path.join(ROOT, 'assets');

// Turns a whole SVG file into a nested <svg> placed at x, y with a size.
function nest(file, x, y, w, h) {
  const text = fs.readFileSync(file, 'utf8');
  const open = text.match(/<svg\b[^>]*>/)[0];
  const viewBox = open.match(/viewBox="([^"]+)"/)[1];
  // Keep the root class: the art's styles hang off ".cr".
  const cls = (open.match(/class="([^"]+)"/) || [])[1];
  const inner = text.slice(text.indexOf(open) + open.length, text.lastIndexOf('</svg>'));
  return `<svg${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMax meet" overflow="visible">${inner}</svg>`;
}

const LINE = [
  ['egg', 60],
  ['sprout', 76],
  ['craft-juvenile', 100],
  ['craft-adult', 132],
  ['craft-mythic.shiny', 156],
];

function banner(lang) {
  const pt = lang === 'pt';
  const W = 1280;
  const H = 440;
  const ground = 372;
  const tagline = pt ? 'Um bichinho de desktop que cresce com o trabalho do seu agente de IA.' : 'A desktop pet that grows from the work your AI coding agent does.';
  const sub = pt ? 'Ele avisa quando o agente precisa de você, evolui em 22 formas e nunca sai do seu computador.' : 'It tells you when your agent needs you, evolves into 22 forms and never leaves your computer.';
  const chips = pt ? ['Claude Code', '100% local', '22 formas', 'PT · EN'] : ['Claude Code', '100% local', '22 forms', 'EN · PT'];
  let x = 610;
  const creatures = [];
  const arrows = [];
  LINE.forEach(([name, size], i) => {
    const w = size * 1.05;
    creatures.push(nest(path.join(ART, `${name}.svg`), x, ground - size, w, size));
    if (i < LINE.length - 1) arrows.push(`<path d="M${x + w + 6} ${ground - 40} l14 0 m-6 -6 l6 6 l-6 6" fill="none" stroke="#c7baff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`);
    x += w + 22;
  });
  const chipSvg = chips
    .map((c, i) => {
      const cw = c.length * 9.4 + 28;
      const cx = 70 + chips.slice(0, i).reduce((a, s) => a + s.length * 9.4 + 28 + 10, 0);
      return `<g transform="translate(${cx} 318)"><rect width="${cw}" height="32" rx="16" fill="#ffffff" fill-opacity=".1" stroke="#c7baff" stroke-opacity=".5"/><text x="${cw / 2}" y="21.5" text-anchor="middle" font-size="15" font-weight="700" fill="#efeaff">${c}</text></g>`;
    })
    .join('');
  // Wrap the subtitle in two lines.
  const words = sub.split(' ');
  const lines = [''];
  for (const w of words) {
    if ((lines[lines.length - 1] + ' ' + w).length > 52) lines.push(w);
    else lines[lines.length - 1] = `${lines[lines.length - 1]} ${w}`.trim();
  }
  const sparkles = [[1180, 70], [610, 92], [1225, 210], [690, 150], [960, 60]]
    .map(([sx, sy], i) => `<path d="M${sx} ${sy - 9} L${sx + 3} ${sy - 3} L${sx + 9} ${sy} L${sx + 3} ${sy + 3} L${sx} ${sy + 9} L${sx - 3} ${sy + 3} L${sx - 9} ${sy} L${sx - 3} ${sy - 3}Z" fill="#ffe156" opacity="${0.5 + (i % 3) * 0.2}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" role="img" aria-label="Openmon">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2140"/><stop offset="1" stop-color="#43327a"/></linearGradient>
  <radialGradient id="glow" cx=".72" cy=".75" r=".55"><stop offset="0" stop-color="#7c6cf2" stop-opacity=".45"/><stop offset="1" stop-color="#7c6cf2" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" rx="28" fill="url(#bg)"/>
<rect width="${W}" height="${H}" rx="28" fill="url(#glow)"/>
${sparkles}
${nest(path.join(ROOT, 'assets', 'brand', 'logo-full-white.svg'), 62, 56, 470, 112)}
<text x="70" y="214" font-size="26" font-weight="700" fill="#ffffff">${tagline.length > 46 ? '' : tagline}</text>
${tagline.length > 46 ? (() => {
    const t = tagline.split(' ');
    const a = [''];
    for (const w of t) {
      if ((a[a.length - 1] + ' ' + w).length > 40) a.push(w);
      else a[a.length - 1] = `${a[a.length - 1]} ${w}`.trim();
    }
    return a.map((l, i) => `<text x="70" y="${206 + i * 32}" font-size="26" font-weight="700" fill="#ffffff">${l}</text>`).join('');
  })() : ''}
${lines.map((l, i) => `<text x="70" y="${282 + i * 22}" font-size="16.5" fill="#d9d2f2">${l}</text>`).join('')}
${chipSvg}
<ellipse cx="${(610 + x - 22) / 2}" cy="${ground + 4}" rx="${(x - 610) / 2 + 10}" ry="14" fill="#000" opacity=".25"/>
${arrows.join('')}
${creatures.join('\n')}
</svg>
`;
}

fs.writeFileSync(path.join(OUT, 'openmon-banner.svg'), banner('pt'));
fs.writeFileSync(path.join(OUT, 'openmon-banner.en.svg'), banner('en'));
console.log('assets/openmon-banner.svg, assets/openmon-banner.en.svg');
