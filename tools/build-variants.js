#!/usr/bin/env node
'use strict';

// Builds the shiny and Nocturne SVGs for forms whose designer art only has
// the normal colouring. Each type lists which of its colours are body,
// shadow, belly, aura and detail; shiny swaps them for the shiny palette,
// Nocturne pulls them toward midnight blue (the same rule the renderer
// uses for packs without night art) and adds a crescent moon on the
// forehead. Ink, white and cheek colours are kept.
//
//   node tools/build-variants.js            writes art/official/*.shiny.svg, *.night.svg
//   node tools/build-variants.js --check    fails if a generated file is out of date

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'art', 'official');
const STAGES = ['juvenile', 'adult', 'mythic'];

// normal -> shiny, grouped by role. Proposed shiny palettes:
//   docs   gold parchment with red ink      git    birch with blossom leaves
//   debug  golden scarab, emerald case      data   amethyst, emerald core
//   style  mint chameleon (paints kept)
const TYPES = {
  docs: {
    body: { '#f3ead6': '#f5d98a' },
    shadow: { '#d9c9a6': '#d9b45a' },
    belly: { '#fffaf0': '#fff3cf' },
    aura: { '#c5d3ff': '#ffd9a8' },
    detail: { '#3b5bdb': '#c0392b' },
  },
  git: {
    body: { '#c7835a': '#ece6dc' },
    shadow: { '#9c5e3b': '#c9bfae' },
    belly: { '#f6dcc4': '#fffaf2' },
    aura: { '#b8f5d6': '#ffd1e3' },
    detail: { '#5fd4a0': '#ff9fc4', '#7a4a30': '#5a4e44' },
  },
  debug: {
    body: { '#e5484d': '#f2c14e' },
    shadow: { '#b8323a': '#c9962c' },
    belly: { '#ffd9d6': '#fff2c6' },
    aura: { '#ffb1a8': '#ffe69a' },
    detail: { '#3a2f55': '#1f6f5c', '#5a4b80': '#2f9c80', '#ffd166': '#e5484d', '#bfe9ff': '#bfe9ff', '#9aa3b5': '#9aa3b5' },
  },
  data: {
    body: { '#5fc8e8': '#b48cf2' },
    shadow: { '#3a98bd': '#8a62d1' },
    belly: { '#e2f7ff': '#f1e6ff' },
    aura: { '#c9f2ff': '#e6d6ff' },
    detail: { '#9ee6ff': '#dcc6ff', '#7c6cf2': '#3ddc97', '#b9adff': '#9ff0c8', '#fffdf7': '#fffdf7' },
  },
  style: {
    body: { '#ffb3d1': '#8fe3c4' },
    shadow: { '#e787b0': '#5fbf9d' },
    belly: { '#fff0f6': '#eafff6', '#ffe0ef': '#d6fff0' },
    aura: {},
    detail: { '#ff8fb8': '#4fb88c', '#ffd166': '#ffd166', '#5fb3ff': '#5fb3ff', '#74cc63': '#74cc63', '#ff9f43': '#ff9f43', '#ffd6a5': '#ffd6a5', '#caffbf': '#caffbf', '#e3f4ff': '#e3f4ff', '#eafbe3': '#eafbe3' },
  },
};

// Same mix as nightify() in public/art.js.
function mix(a, b, k) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
const NIGHT = {
  body: (c) => mix(c, '#2b2f6b', 0.55),
  shadow: (c) => mix(c, '#1b1d45', 0.6),
  belly: (c) => mix(c, '#c9d4ff', 0.5),
  aura: () => '#a9dcff',
  detail: (c) => mix(c, '#e8ecff', 0.35),
};

function recolor(text, map) {
  // One pass, so a colour that maps onto another listed colour is not
  // replaced twice.
  const keys = Object.keys(map);
  if (!keys.length) return text;
  const re = new RegExp(keys.map((k) => k.slice(1)).map((k) => `#${k}`).join('|'), 'gi');
  return text.replace(re, (m) => map[m.toLowerCase()] || m);
}

// A crescent moon on the forehead, above the eyes, in the art's own
// 200 x 200 drawing space (inside its scaling group when it has one).
function addMoon(text, form) {
  const pupils = [...text.matchAll(/class="k"[^>]*\bcy="([\d.]+)"/g)].map((m) => Number(m[1]));
  const eyeY = pupils.length ? Math.min(...pupils) : 116;
  const at = MOON_AT[form] || {};
  const x = at.x ?? 100;
  const y = at.y ?? eyeY - 38;
  const s = at.s ?? 1.05;
  const moon = `<path class="moon" fill="#ffe156" stroke="rgb(42, 33, 64)" stroke-width="2.6" stroke-linejoin="round" d="M106 86 A12 12 0 1 0 106 110 A16 16 0 0 1 106 86Z" transform="translate(${x} ${y}) scale(${s}) translate(-100 -98)"></path>`;
  const end = text.endsWith('</g></svg>') ? text.length - '</g></svg>'.length : text.length - '</svg>'.length;
  return text.slice(0, end) + moon + text.slice(end);
}

// Forms where the forehead is busy (crest, lens, halo): the moon moves.
const MOON_AT = {};

function build() {
  const out = {};
  for (const [type, roles] of Object.entries(TYPES)) {
    const shiny = Object.assign({}, ...Object.values(roles));
    const night = {};
    for (const [role, map] of Object.entries(roles)) for (const c of Object.keys(map)) night[c] = NIGHT[role](c);
    for (const stage of STAGES) {
      const form = `${type}-${stage}`;
      const file = path.join(DIR, `${form}.svg`);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      out[`${form}.shiny.svg`] = recolor(text, shiny);
      out[`${form}.night.svg`] = addMoon(recolor(text, night), form);
    }
  }
  return out;
}

if (require.main === module) {
  const files = build();
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(DIR, name);
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (old === text) continue;
    if (check) {
      console.error(`out of date: ${name}`);
      stale++;
    } else fs.writeFileSync(file, text);
  }
  if (check && stale) process.exit(1);
  console.log(`${Object.keys(files).length} variants ${check ? 'checked' : 'written'}`);
}

module.exports = { build, TYPES };
