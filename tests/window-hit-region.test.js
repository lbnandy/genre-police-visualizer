'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pointInWindowSurface } = require('../src/window-hit-region');

test('capsule hit testing follows the visible rounded surface', () => {
  const bounds = { x: 0, y: 0, width: 920, height: 400 };

  assert.equal(pointInWindowSurface({ x: 206, y: 48 }, bounds, 'side'), true);
  assert.equal(pointInWindowSurface({ x: 54, y: 200 }, bounds, 'side'), true);
  assert.equal(pointInWindowSurface({ x: 812, y: 200 }, bounds, 'side'), true);
  assert.equal(pointInWindowSurface({ x: 54, y: 48 }, bounds, 'side'), false);
  assert.equal(pointInWindowSurface({ x: 30, y: 200 }, bounds, 'side'), false);
  assert.equal(pointInWindowSurface({ x: 860, y: 200 }, bounds, 'side'), false);
});

test('capsule hit testing scales with the native window position and size', () => {
  const bounds = { x: 100, y: 50, width: 1656, height: 720 };

  assert.equal(pointInWindowSurface({ x: 470.8, y: 136.4 }, bounds, 'side'), true);
  assert.equal(pointInWindowSurface({ x: 140, y: 410 }, bounds, 'side'), false);
});

test('poster hit testing keeps only its rounded paper boundary interactive', () => {
  const bounds = { x: 0, y: 0, width: 500, height: 515 };

  assert.equal(pointInWindowSurface({ x: 250, y: 16 }, bounds, 'poster'), true);
  assert.equal(pointInWindowSurface({ x: 16, y: 16 }, bounds, 'poster'), false);
  assert.equal(pointInWindowSurface({ x: 8, y: 250 }, bounds, 'poster'), false);
  assert.equal(pointInWindowSurface({ x: 250, y: 250 }, bounds, 'poster'), true);
});

test('open settings expands the capsule hit region only over the panel', () => {
  const bounds = { x: 0, y: 0, width: 920, height: 400 };
  const panelPoint = { x: 880, y: 200 };
  const emptyPoint = { x: 915, y: 200 };

  assert.equal(pointInWindowSurface(panelPoint, bounds, 'side'), false);
  assert.equal(pointInWindowSurface(panelPoint, bounds, 'side', { settingsOpen: true }), true);
  assert.equal(pointInWindowSurface(emptyPoint, bounds, 'side', { settingsOpen: true }), false);
});
