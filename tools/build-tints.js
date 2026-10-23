#!/usr/bin/env node
'use strict';

// The designer draws the poses once, in the normal colours. The shiny is
// drawn only in the idle pose. This tool compares each shiny with its normal
// form, element by element, and writes what changed to art/official/tints.json:
//
//   map     normal colour -> variant colour (fills and strokes)
//   extras  elements the variant adds, each with the element it sits
//           before, so it lands in the same layer
//   ring    a white ring the variant adds around the pupils, as extra radius
//
// The renderer applies a tint to any pose of that form at draw time, so a
// shiny pet still sleeps, works and cheers in its own colours.
//
//   node tools/build-tints.js           writes art/official/tints.json
//   node tools/build-tints.js --check   fails if tints.json is out of date

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'art', 'official');

const SHAPE = /<(path|ellipse|circle|rect|polygon|polyline|line)\b([^>]*?)(\/?)>(?:<\/\1>)?/g;
const GEOMETRY = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'];

function hex(c) {
  if (!c) return c;
  const s = c.trim().toLowerCase();
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s;
}

function attrs(text) {
  const out = {};
  for (const m of text.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// Shapes in document order, with a geometry key and their colours.
function shapes(svg) {
  const list = [];
  for (const m of svg.matchAll(SHAPE)) {
    const a = attrs(m[2]);
    list.push({
      raw: m[0],
      tag: m[1],
      a,
      key: [m[1], ...GEOMETRY.map((g) => a[g] || '')].join('|'),
      fill: hex(a.fill),
      stroke: hex(a.stroke),
    });
  }
  return list;
}

function compare(baseSvg, variantSvg) {
  const base = shapes(baseSvg);
  const variant = shapes(variantSvg);
  const free = new Map();
  for (const b of base) {
    if (!free.has(b.key)) free.set(b.key, []);
    free.get(b.key).push(b);
  }
  const votes = {};
  const vote = (from, to) => {
    // Unchanged colours vote too, so a colour the designer changed on a few
    // lines only (ink on a night mouth) is not changed everywhere.
    if (!from || !to || from === 'none' || to === 'none') return;
    votes[from] = votes[from] || {};
    votes[from][to] = (votes[from][to] || 0) + 1;
  };
  const matched = variant.map((v) => {
    const b = (free.get(v.key) || []).shift() || null;
    if (b) {
      vote(b.fill, v.fill);
      vote(b.stroke, v.stroke);
    }
    return b;
  });
  const map = {};
  for (const [from, tos] of Object.entries(votes)) {
    const to = Object.entries(tos).sort((x, y) => y[1] - x[1])[0][0];
    if (to !== from) map[from] = to;
  }
  // Added elements: white rings around pupils, and everything else.
  const pupils = variant.filter((v) => /\bk\b/.test(v.a.class || ''));
  let ring = null;
  const extras = [];
  variant.forEach((v, i) => {
    if (matched[i]) return;
    const white = v.fill === '#ffffff';
    const k = white && pupils.find((p) => p.a.cx === v.a.cx && p.a.cy === v.a.cy);
    if (k) {
      ring = Math.max(ring || 0, Number(v.a.rx || v.a.r) - Number(k.a.rx || k.a.r));
      return;
    }
    const next = variant.slice(i + 1).find((x, j) => matched[i + 1 + j]);
    const prev = variant.slice(0, i).reverse().find((x, j) => matched[i - 1 - j]);
    const extra = { svg: v.raw.replace(/\sclass="[^"]*"/, '') };
    if (next) extra.before = next.key;
    if (prev) extra.after = prev.key;
    // Nothing matched before it: it is the bottom layer (an aura).
    else extra.bottom = true;
    extras.push(extra);
  });
  const out = { map };
  if (extras.length) out.extras = extras;
  if (ring) out.ring = +ring.toFixed(2);
  return out;
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function build() {
  const files = fs.readdirSync(ART).filter((f) => f.endsWith('.svg'));
  const forms = files.filter((f) => !/[.@]/.test(f.replace(/\.svg$/, '')) && !f.startsWith('mark-')).map((f) => f.replace(/\.svg$/, ''));
  const tints = {};
  for (const form of forms.sort()) {
    const base = read(path.join(ART, `${form}.svg`));
    const variants = files
      .map((f) => f.replace(/\.svg$/, ''))
      .filter((n) => n.startsWith(`${form}.`) && !n.includes('@') && !n.includes('.region-'))
      .map((n) => n.slice(form.length + 1));
    for (const v of variants.sort()) {
      tints[form] = tints[form] || {};
      tints[form][v] = compare(base, read(path.join(ART, `${form}.${v}.svg`)));
    }
  }
  return `${JSON.stringify({ forms: tints })}\n`;
}

if (require.main === module) {
  const text = build();
  const file = path.join(ART, 'tints.json');
  if (process.argv.includes('--check')) {
    if (read(file) !== text) {
      console.error('art/official/tints.json is out of date: run node tools/build-tints.js');
      process.exit(1);
    }
    console.log('tints.json is up to date');
  } else {
    fs.writeFileSync(file, text);
    const t = JSON.parse(text);
    console.log(`tints.json: ${Object.keys(t.forms).length} forms`);
  }
}

module.exports = { build, compare, hex };
