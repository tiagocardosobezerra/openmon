'use strict';

// Every page's own scripts compile: a stray quote in a translated string
// would otherwise break a whole page, and only a click would show it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');

test('every inline script of every page, and every page script, compiles', () => {
  for (const f of fs.readdirSync(PUBLIC).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => new Function(code), `${f}`);
    }
  }
  for (const f of fs.readdirSync(PUBLIC).filter((x) => x.endsWith('.js'))) {
    assert.doesNotThrow(() => new Function(fs.readFileSync(path.join(PUBLIC, f), 'utf8')), f);
  }
});
