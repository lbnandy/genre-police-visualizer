'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('fresh installs default to zero lyric delay', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(mainSource, /const DEFAULT_LYRIC_DELAY_MS = 0;/);
});

test('lyric delay holds lyrics back and negative delay advances them', async () => {
  const { applyLyricDelay, normalizeLyricDelayMs } = await import('../renderer/playback-clock.mjs');
  assert.equal(applyLyricDelay(5000, 600), 4400);
  assert.equal(applyLyricDelay(5000, -600), 5600);
  assert.equal(applyLyricDelay(300, 600), 0);
  assert.equal(normalizeLyricDelayMs(127), 150);
  assert.equal(normalizeLyricDelayMs(9000), 2000);
});

test('playback clock eases ordinary drift instead of ignoring it', async () => {
  const { reconcilePlaybackPosition } = await import('../renderer/playback-clock.mjs');
  const result = reconcilePlaybackPosition({
    predictedPosition: 10000,
    incomingPosition: 10400,
    playing: true
  });
  assert.equal(result.snapped, false);
  assert.ok(result.positionMs > 10000);
  assert.ok(result.positionMs < 10400);
});

test('playback clock ignores tiny SMTC jitter', async () => {
  const { reconcilePlaybackPosition } = await import('../renderer/playback-clock.mjs');
  const result = reconcilePlaybackPosition({
    predictedPosition: 10000,
    incomingPosition: 10032,
    playing: true
  });
  assert.equal(result.positionMs, 10000);
  assert.equal(result.correctionMs, 0);
  assert.equal(result.rateScale, 1);
});

test('playback clock corrects negative drift by slowing down, never by reversing', async () => {
  const { reconcilePlaybackPosition } = await import('../renderer/playback-clock.mjs');
  const result = reconcilePlaybackPosition({
    predictedPosition: 10400,
    incomingPosition: 10000,
    playing: true
  });
  assert.equal(result.positionMs, 10400);
  assert.equal(result.correctionMs, 0);
  assert.ok(result.rateScale < 1);
  assert.ok(result.rateScale >= 0.82);
  assert.equal(result.snapped, false);
});

test('playback clock snaps on seeks and pause', async () => {
  const { reconcilePlaybackPosition } = await import('../renderer/playback-clock.mjs');
  const seek = reconcilePlaybackPosition({
    predictedPosition: 10000,
    incomingPosition: 13500,
    playing: true
  });
  const paused = reconcilePlaybackPosition({
    predictedPosition: 10000,
    incomingPosition: 10125,
    playing: false
  });
  assert.equal(seek.positionMs, 13500);
  assert.equal(seek.snapped, true);
  assert.equal(paused.positionMs, 10125);
  assert.equal(paused.snapped, true);
});

test('async metadata resolution cannot pull the live clock backwards', async () => {
  const { reconcilePlaybackPosition } = await import('../renderer/playback-clock.mjs');
  const result = reconcilePlaybackPosition({
    predictedPosition: 24000,
    incomingPosition: 18000,
    playing: true,
    reconcile: false
  });
  assert.equal(result.positionMs, 24000);
  assert.equal(result.correctionMs, 0);
});
