'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('small presentation presets render at their physical pixel footprint', async () => {
  const { presentationPixelRatio } = await import('../renderer/output-resolution.mjs');
  const ratio = presentationPixelRatio({
    designWidth: 920,
    renderedWidth: 552,
    devicePixelRatio: 1
  });
  assert.equal(ratio, 0.6);
  assert.equal(Math.round(920 * ratio), 552);
  assert.equal(Math.round(400 * ratio), 240);
});

test('presentation resolution includes the operating-system display scale', async () => {
  const { presentationPixelRatio } = await import('../renderer/output-resolution.mjs');
  const ratio = presentationPixelRatio({
    designWidth: 920,
    renderedWidth: 552,
    devicePixelRatio: 1.25
  });
  assert.equal(ratio, 0.75);
  assert.equal(Math.round(920 * ratio), Math.round(552 * 1.25));
});

test('larger presets stay native while adaptive resolution may step below them', async () => {
  const { adaptivePixelRatio, presentationPixelRatio } = await import('../renderer/output-resolution.mjs');
  const nativeRatio = presentationPixelRatio({
    designWidth: 920,
    renderedWidth: 1656,
    devicePixelRatio: 1
  });
  assert.equal(nativeRatio, 1.8);
  assert.equal(adaptivePixelRatio(nativeRatio, 1), 1.8);
  assert.equal(adaptivePixelRatio(nativeRatio, 0.82), 1.476);
});

test('extreme display scaling keeps the existing memory safety ceiling', async () => {
  const { presentationPixelRatio } = await import('../renderer/output-resolution.mjs');
  assert.equal(presentationPixelRatio({
    designWidth: 920,
    renderedWidth: 1840,
    devicePixelRatio: 2
  }), 3);
});
