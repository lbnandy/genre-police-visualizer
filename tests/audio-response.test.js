'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('visual response modes adjust render metrics without changing event flags', async () => {
  const { applyVisualResponse } = await import('../renderer/audio-response.mjs');
  const metrics = {
    volume: 0.2,
    bass: 0.3,
    relativeEnergy: 1.2,
    kickNow: true,
    waveform: new Uint8Array([128, 140]),
    frequency: new Uint8Array([10, 20])
  };
  const gentle = applyVisualResponse(metrics, 'gentle');
  const strong = applyVisualResponse(metrics, 'strong');
  assert.ok(gentle.volume < metrics.volume);
  assert.ok(strong.volume > metrics.volume);
  assert.equal(strong.kickNow, true);
  assert.equal(strong.waveform, metrics.waveform);
  assert.equal(strong.frequency, metrics.frequency);
  assert.ok(strong.spectrumGain > 1);
});
