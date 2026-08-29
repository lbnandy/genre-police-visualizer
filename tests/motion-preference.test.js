const test = require('node:test');
const assert = require('node:assert/strict');

test('standard motion preserves the exact metrics object', async () => {
  const { softenMotionMetrics } = await import('../renderer/motion-preference.mjs');
  const metrics = { rhythmPulse: 0.8, impact: 0.7, bass: 0.6 };
  assert.equal(softenMotionMetrics(metrics, 'standard'), metrics);
});

test('gentle motion only reduces transient and flash-driving metrics', async () => {
  const { softenMotionMetrics } = await import('../renderer/motion-preference.mjs');
  const metrics = {
    impact: 0.8,
    accent: 0.7,
    rhythmStrength: 0.9,
    rhythmPulse: 1,
    kickPulse: 0.6,
    bass: 0.55,
    frequency: new Uint8Array([1, 2, 3])
  };
  const gentle = softenMotionMetrics(metrics, 'gentle');
  assert.ok(gentle.impact < metrics.impact);
  assert.ok(gentle.rhythmPulse < metrics.rhythmPulse);
  assert.equal(gentle.bass, metrics.bass);
  assert.equal(gentle.frequency, metrics.frequency);
});
