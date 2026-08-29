'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveWindowBounds } = require('../src/window-position');

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const secondary = { x: 1920, y: 0, width: 2560, height: 1400 };

test('uses the release default near the primary display lower-right corner', () => {
  assert.deepEqual(resolveWindowBounds({
    width: 920,
    height: 400,
    workAreas: [primary, secondary],
    primaryWorkArea: primary
  }), { width: 920, height: 400, x: 972, y: 616 });
});

test('restores a saved position on the nearest connected display', () => {
  assert.deepEqual(resolveWindowBounds({
    savedPosition: { x: 2400, y: 220 },
    width: 1104,
    height: 480,
    workAreas: [primary, secondary],
    primaryWorkArea: primary
  }), { width: 1104, height: 480, x: 2400, y: 220 });
});

test('clamps a position from a disconnected monitor back onto a visible display', () => {
  assert.deepEqual(resolveWindowBounds({
    savedPosition: { x: 6200, y: 2600 },
    width: 1288,
    height: 560,
    workAreas: [primary],
    primaryWorkArea: primary
  }), { width: 1288, height: 560, x: 632, y: 480 });
});
