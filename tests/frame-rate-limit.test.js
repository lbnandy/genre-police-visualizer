'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('frame rate choices normalize to the supported display and numeric limits', async () => {
  const { FRAME_RATE_LIMITS, normalizeFrameRateLimit } = await import('../renderer/frame-rate-limit.mjs');
  assert.deepEqual(FRAME_RATE_LIMITS, ['display', '120', '90', '60', '30']);
  assert.equal(normalizeFrameRateLimit('90'), '90');
  assert.equal(normalizeFrameRateLimit(60), '60');
  assert.equal(normalizeFrameRateLimit('144'), 'display');
  assert.equal(normalizeFrameRateLimit(), 'display');
});

test('active, idle, and hidden states resolve to independent frame intervals', async () => {
  const { frameIntervalFor } = await import('../renderer/frame-rate-limit.mjs');
  assert.equal(frameIntervalFor({ animationActive: true, frameRateLimit: 'display' }), 0);
  assert.equal(frameIntervalFor({ animationActive: true, frameRateLimit: '120' }), 1000 / 120);
  assert.equal(frameIntervalFor({ animationActive: true, frameRateLimit: '90' }), 1000 / 90);
  assert.equal(frameIntervalFor({ animationActive: true, frameRateLimit: '60' }), 1000 / 60);
  assert.equal(frameIntervalFor({ animationActive: true, frameRateLimit: '30' }), 1000 / 30);
  assert.equal(frameIntervalFor({ animationActive: false, idleFrameLimitEnabled: true }), 1000 / 30);
  assert.equal(frameIntervalFor({ animationActive: false, idleFrameLimitEnabled: false }), 0);
  assert.equal(frameIntervalFor({ hidden: true, animationActive: true, frameRateLimit: '120' }), 250);
});

test('deadline scheduling keeps accurate limits on a 144 Hz display', async () => {
  const { scheduleFrame } = await import('../renderer/frame-rate-limit.mjs');

  const measuredFps = (limit) => {
    const displayInterval = 1000 / 144;
    const targetInterval = 1000 / limit;
    let deadline = 0;
    let rendered = 0;
    for (let time = 0; time < 10000; time += displayInterval) {
      const result = scheduleFrame(time, deadline, targetInterval);
      deadline = result.deadline;
      if (result.due) rendered += 1;
    }
    return rendered / 10;
  };

  assert.ok(Math.abs(measuredFps(60) - 60) < 0.3);
  assert.ok(Math.abs(measuredFps(90) - 90) < 0.3);
});

test('adaptive performance uses the selected limit as its healthy baseline', async () => {
  const { performanceTargetFps } = await import('../renderer/frame-rate-limit.mjs');
  assert.equal(performanceTargetFps('display'), 60);
  assert.equal(performanceTargetFps('120'), 60);
  assert.equal(performanceTargetFps('90'), 60);
  assert.equal(performanceTargetFps('60'), 60);
  assert.equal(performanceTargetFps('30'), 30);
});
