'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_LAYOUT_MODE,
  normalizeLayoutMode,
  layoutWindowSize
} = require('../src/layout-mode');

test('layout mode keeps the established side layout as the default', () => {
  assert.equal(DEFAULT_LAYOUT_MODE, 'side');
  assert.equal(normalizeLayoutMode('SIDE'), 'side');
  assert.equal(normalizeLayoutMode('poster'), 'poster');
  assert.equal(normalizeLayoutMode('stage'), 'poster');
  assert.equal(normalizeLayoutMode('unknown'), 'side');
});

test('layout window sizes scale both presets from their own design canvas', () => {
  assert.deepEqual(layoutWindowSize('side', 1), { width: 920, height: 400 });
  assert.deepEqual(layoutWindowSize('poster', 1), { width: 500, height: 515 });
  assert.deepEqual(layoutWindowSize('poster', 0.9), { width: 450, height: 464 });
  assert.deepEqual(layoutWindowSize('side', 1.5), { width: 1380, height: 600 });
  assert.deepEqual(layoutWindowSize('side', 1.8), { width: 1656, height: 720 });
});
