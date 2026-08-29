'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('impact front launches visibly, overshoots, then settles', async () => {
  const { impactFrontProgress } = await import('../renderer/impact-motion.mjs');
  assert.equal(impactFrontProgress(0, 8.6), 0);
  assert.ok(impactFrontProgress(0.2, 8.6) > 0.5);
  assert.ok(impactFrontProgress(0.55, 8.6) > 1);
  assert.equal(impactFrontProgress(1, 8.6), 1);
});

test('impact wave keeps only a softened spectrum imprint', async () => {
  const { impactShapeRatio } = await import('../renderer/impact-motion.mjs');
  const ratio = impactShapeRatio({ baseRadius: 64, radius: 104 }, 64, 0.4);
  assert.ok(ratio > 1);
  assert.ok(ratio < 1.18);
});

test('impact wave follows broad directional contour without copying narrow teeth', async () => {
  const { impactContourRatios } = await import('../renderer/impact-motion.mjs');
  const points = Array.from({ length: 48 }, (_, index) => {
    const distanceFromTop = Math.min(index, 48 - index);
    const topLobe = Math.exp(-(distanceFromTop ** 2) / 24);
    return { baseRadius: 64, radius: 64 + topLobe * 42 };
  });
  const ratios = impactContourRatios(points, 64, 0.42, 0.12);
  assert.ok(ratios[0] > ratios[24] + 0.14);
  assert.ok(ratios[24] >= 0.86);
  assert.ok(ratios[0] <= 1.24);
});

test('impact contour stays circular when the spectrum has no directional contrast', async () => {
  const { impactContourRatios } = await import('../renderer/impact-motion.mjs');
  const ratios = impactContourRatios(
    Array.from({ length: 48 }, () => ({ baseRadius: 64, radius: 78 })),
    64,
    0.42,
    0.12
  );
  assert.ok(Math.max(...ratios) - Math.min(...ratios) < 0.001);
});
