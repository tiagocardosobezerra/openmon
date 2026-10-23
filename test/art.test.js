'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, compare } = require('../tools/build-tints');

const ART = path.join(__dirname, '..', 'art', 'official');

test('tints.json is up to date with the art', () => {
  // Parsed, so a checkout with Windows line endings still compares equal.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ART, 'tints.json'), 'utf8')), JSON.parse(build()));
});

test('tints: colour map, added elements and pupil ring', () => {
  const base = '<svg><path d="M0 0" fill="#ff9f43" stroke="rgb(42, 33, 64)"></path><ellipse class="k" cx="80" cy="100" rx="10" ry="12"></ellipse><path class="o ln" d="M1 1" fill="none" stroke="#2a2140"></path></svg>';
  const night = '<svg><path d="M0 0" fill="#5b4a86" stroke="#2a2140"></path><ellipse cx="80" cy="100" rx="12.5" ry="14.5" fill="#fff"></ellipse><ellipse class="k" cx="80" cy="100" rx="10" ry="12"></ellipse><path class="moon" fill="#ffe156" d="M5 5"></path><path class="o ln" d="M1 1" fill="none" stroke="#2a2140"></path></svg>';
  const t = compare(base, night);
  assert.deepEqual(t.map, { '#ff9f43': '#5b4a86' });
  assert.equal(t.ring, 2.5);
  assert.equal(t.extras.length, 1);
  assert.match(t.extras[0].svg, /#ffe156/);
  assert.ok(t.extras[0].before.startsWith('path|M1 1'));
});

test('every form has its five poses and a shiny; the egg has no shiny', () => {
  const files = new Set(fs.readdirSync(ART));
  const species = require('../src/species');
  for (const form of species.dexEntries().map((e) => e.key)) {
    for (const v of ['', '@sleep', '@working', '@attention', '@error', '@done', ...(form === 'egg' ? [] : ['.shiny'])]) {
      assert.ok(files.has(`${form}${v}.svg`), `${form}${v}.svg`);
    }
  }
  assert.ok(!files.has('egg.shiny.svg'));
});

test('no art for retired variants (night, friendship, regional, Chimera pairs)', () => {
  const left = fs.readdirSync(ART).filter((f) => /\.(night|friend|region-[a-z]+|[a-z]+-[a-z]+)\.svg$|^mark-/.test(f));
  assert.deepEqual(left, []);
});

test('the official art is plain SVG: no scripts, images, gradients or filters', () => {
  for (const f of fs.readdirSync(ART).filter((x) => x.endsWith('.svg'))) {
    const text = fs.readFileSync(path.join(ART, f), 'utf8');
    assert.ok(!/<(script|image|foreignObject|linearGradient|radialGradient|filter)\b|\son[a-z]+=/i.test(text), f);
  }
});

test('shiny files carry no baked shine (the app draws it on every shiny)', () => {
  for (const f of fs.readdirSync(ART).filter((x) => x.includes('.shiny'))) {
    assert.ok(!fs.readFileSync(path.join(ART, f), 'utf8').includes('class="shine"'), f);
  }
});

test('accessories and items: one file each', () => {
  const species = require('../src/species');
  const wear = new Set(fs.readdirSync(path.join(__dirname, '..', 'public', 'wear')));
  for (const [id, c] of Object.entries(species.COSMETICS)) if (c.svg) assert.ok(wear.has(`${id}.svg`), id);
  const items = new Set(fs.readdirSync(path.join(__dirname, '..', 'public', 'items')));
  for (const id of Object.keys(species.ITEMS)) if (!['snack', 'candy', 'everstone'].includes(id)) assert.ok(items.has(`${id}.svg`), id);
});

test('the English and Spanish README animations match the designer\'s Portuguese ones', () => {
  const { translate, FILES, LANGS } = require('../tools/build-banner');
  const lf = (s) => s.replace(/\r\n/g, '\n');
  for (const name of Object.keys(FILES)) {
    for (const lang of LANGS) {
      const copy = fs.readFileSync(path.join(__dirname, '..', 'assets', name.replace(/\.svg$/, `.${lang}.svg`)), 'utf8');
      assert.equal(lf(copy), lf(translate(name, lang)), `${name} ${lang}`);
    }
  }
});
