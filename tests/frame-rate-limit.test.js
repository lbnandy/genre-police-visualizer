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

test('hidden windows suspend renderer and audio work unless a recording is active', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
  const audioSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'audio-engine.js'), 'utf8');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

  assert.match(mainSource, /backgroundThrottling:\s*true/g);
  assert.doesNotMatch(mainSource, /backgroundThrottling:\s*false/);
  assert.match(mainSource, /setBackgroundThrottling\(active !== true\)/);
  assert.match(appSource, /return document\.hidden && !recordingPresentationActive;/);
  assert.match(appSource, /document\.addEventListener\('visibilitychange', applyVisibilityPerformancePolicy\)/);
  assert.match(appSource, /void audio\.setSuspended\(suspended\)/);
  assert.match(appSource, /function resetAnimationSchedule\(\) \{[\s\S]*fpsCounterStartedAt = 0;[\s\S]*renderPerformanceContext = '';[\s\S]*adaptiveHighFpsWindows = 0;\s*\}/);
  assert.match(appSource, /function applyVisibilityPerformancePolicy\(\) \{[\s\S]*resetAnimationSchedule\(\);[\s\S]*if \(suspended\)/);
  assert.match(appSource, /if \(hud\.classList\.contains\('leaving'\) && currentMetadata && !demoTheme\) \{\s*void transitionTo\(currentMetadata, true, true\);/);
  assert.match(appSource, /const shouldCrossfade = document\.body\.dataset\.backgroundStyle === 'themed'\s*&& !document\.hidden/);
  assert.match(appSource, /if \(!immediate && !hidden\)/);
  assert.match(appSource, /if \(animationFrameId\) cancelAnimationFrame\(animationFrameId\)/);
  assert.match(audioSource, /async setSuspended\(suspended\)/);
  assert.match(audioSource, /const wasSuspended = this\.suspended;/);
  assert.match(audioSource, /if \(wasSuspended && !next && this\.audioSourceId === 'system'\) \{\s*await this\.start\(\);\s*return;/);
  assert.match(audioSource, /const contexts = \[this\.context, this\.rhythmContext, this\.genreContext\]/);
  assert.match(audioSource, /if \(this\.suspended\) return this\.metrics;/);
});
