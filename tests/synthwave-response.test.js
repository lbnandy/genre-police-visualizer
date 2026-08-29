const test = require('node:test');
const assert = require('node:assert/strict');

test('Synthwave response favors a steady mid-tempo bass and arpeggio pattern', async () => {
  const { synthwaveAudioResponse } = await import('../renderer/synthwave-response.mjs');
  const steady = synthwaveAudioResponse({
    bpm: 116, tempoConfidence: 0.92, regularity: 0.9,
    bass: 0.56, lowMid: 0.5, mid: 0.46, high: 0.24,
    bassPulse: 0.72, midPulse: 0.62, highPulse: 0.26,
    lowFlux: 0.055, midFlux: 0.048, highFlux: 0.014,
    brightness: 0.28, volume: 0.48, relativeEnergy: 1.44, drive: 0.7
  });
  const unstructured = synthwaveAudioResponse({
    regularity: 0.08,
    bass: 0.22, lowMid: 0.2, mid: 0.3, high: 0.6,
    bassPulse: 0.12, midPulse: 0.18, highPulse: 0.16,
    lowFlux: 0.01, midFlux: 0.012, highFlux: 0.06,
    brightness: 0.62, volume: 0.48, relativeEnergy: 1.44, drive: 0.3
  });

  assert.ok(steady.pulseRegularity > unstructured.pulseRegularity + 0.6);
  assert.ok(steady.gridMotion > unstructured.gridMotion + 0.3);
  assert.ok(steady.sunMotion > unstructured.sunMotion + 0.22);
});

test('arpeggio activity drives the sun and stars more than the road', async () => {
  const { synthwaveAudioResponse } = await import('../renderer/synthwave-response.mjs');
  const base = {
    bpm: 112, tempoConfidence: 0.85, regularity: 0.86,
    bass: 0.48, lowMid: 0.44, bassPulse: 0.58, lowFlux: 0.04,
    volume: 0.42, relativeEnergy: 1.25, drive: 0.52, brightness: 0.26
  };
  const quietArp = synthwaveAudioResponse({ ...base, mid: 0.2, high: 0.12, midPulse: 0.1, highPulse: 0.08 });
  const activeArp = synthwaveAudioResponse({
    ...base,
    mid: 0.58, high: 0.34, midPulse: 0.78, highPulse: 0.52,
    midFlux: 0.065, highFlux: 0.035
  });

  const sunGain = activeArp.sunMotion - quietArp.sunMotion;
  const roadGain = activeArp.gridMotion - quietArp.gridMotion;
  assert.ok(sunGain > roadGain * 1.35);
  assert.ok(activeArp.starEnergy > quietArp.starEnergy + 0.17);
});

test('Synthwave impact follows confirmed rhythm rather than bright air alone', async () => {
  const { synthwaveAudioResponse } = await import('../renderer/synthwave-response.mjs');
  const airOnly = synthwaveAudioResponse({ high: 0.9, highPulse: 0.88, highFlux: 0.08, brightness: 0.8 });
  const confirmed = synthwaveAudioResponse({ rhythmPulse: 0.82, kickPulse: 0.74, midPulse: 0.42 });

  assert.equal(airOnly.impact, 0);
  assert.ok(confirmed.impact >= 0.82);
  assert.ok(confirmed.starImpact > 0.6);
});
