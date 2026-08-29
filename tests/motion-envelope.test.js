const test = require('node:test');
const assert = require('node:assert/strict');

test('motion envelope is nearly frame-rate independent', async () => {
  const { smoothMotionEnvelope } = await import('../renderer/motion-envelope.mjs');
  const run = (frameMs) => {
    let value = 0;
    for (let elapsed = 0; elapsed < 200; elapsed += frameMs) {
      value = smoothMotionEnvelope(value, 1, frameMs, { attackMs: 42, releaseMs: 150 });
    }
    return value;
  };

  assert.ok(Math.abs(run(1000 / 60) - run(1000 / 30)) < 0.012);
});

test('motion envelope releases more gently than it attacks', async () => {
  const { smoothMotionEnvelope } = await import('../renderer/motion-envelope.mjs');
  const attacked = smoothMotionEnvelope(0, 1, 50, { attackMs: 42, releaseMs: 150 });
  const released = smoothMotionEnvelope(1, 0, 50, { attackMs: 42, releaseMs: 150 });

  assert.ok(attacked > 0.65);
  assert.ok(released > 0.7);
});
