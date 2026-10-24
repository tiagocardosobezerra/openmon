'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { onSpot } = require('../src/hotspots');

test('pet spots: the body as its ellipse, the card and bubble as boxes, in screen pixels', () => {
  const bounds = { x: 1000, y: 500, width: 300, height: 560 };
  // Body 100 × 200 at (100, 300); a bubble 200 × 80 at (50, 150).
  const hot = [[100, 300, 100, 200], [50, 150, 200, 80]];
  const at = (x, y) => onSpot(bounds, hot, { x: bounds.x + x, y: bounds.y + y });
  assert.equal(at(150, 400), true, 'the middle of the pet');
  assert.equal(at(102, 302), false, 'a corner of its box is not the pet');
  assert.equal(at(55, 155), true, 'the bubble, corner included');
  assert.equal(at(20, 20), false, 'the empty window');
  assert.equal(onSpot(bounds, undefined, { x: 1150, y: 900 }), false);
  assert.equal(onSpot(bounds, [[0, 0, 0, 0]], { x: 1000, y: 500 }), false);
});
