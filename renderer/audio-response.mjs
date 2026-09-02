const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

const RESPONSE_GAINS = Object.freeze({
  gentle: 0.82,
  standard: 1,
  strong: 1.24
});

const DIRECT_FIELDS = Object.freeze([
  'bass', 'lowMid', 'mid', 'high', 'volume', 'flux',
  'lowFlux', 'midFlux', 'highFlux', 'bodyFlux', 'presenceFlux', 'airFlux',
  'beat', 'impact', 'accent', 'rhythmStrength', 'rhythmPulse', 'kickPulse',
  'bassPulse', 'midPulse', 'highPulse', 'drive'
]);

export function normalizeVisualResponseMode(value) {
  return Object.hasOwn(RESPONSE_GAINS, value) ? value : 'standard';
}

export function applyVisualResponse(metrics = {}, mode = 'standard') {
  const responseMode = normalizeVisualResponseMode(mode);
  const gain = RESPONSE_GAINS[responseMode];
  if (Math.abs(gain - 1) < 0.0001) return metrics;

  const adjusted = { ...metrics };
  for (const field of DIRECT_FIELDS) {
    if (!Number.isFinite(Number(metrics[field]))) continue;
    adjusted[field] = clamp(Number(metrics[field]) * gain);
  }
  if (Number.isFinite(Number(metrics.relativeEnergy))) {
    adjusted.relativeEnergy = clamp(1 + (Number(metrics.relativeEnergy) - 1) * gain, 0, 2.5);
  }
  adjusted.spectrumGain = Math.max(1, Number(metrics.spectrumGain) || 1) * gain;
  adjusted.waveformGain = Math.max(1, Number(metrics.waveformGain) || 1) * gain;
  return adjusted;
}
