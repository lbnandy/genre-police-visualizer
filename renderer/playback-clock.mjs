const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const LYRIC_DELAY_MIN_MS = -2000;
export const LYRIC_DELAY_MAX_MS = 2000;

export function normalizeLyricDelayMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return clamp(Math.round(numeric / 50) * 50, LYRIC_DELAY_MIN_MS, LYRIC_DELAY_MAX_MS);
}

/**
 * A positive delay holds lyrics back; a negative delay advances them. This is
 * applied only to lyric rendering and never mutates the media playback clock.
 */
export function applyLyricDelay(positionMs, delayMs = 0) {
  return Math.max(0, (Number(positionMs) || 0) - normalizeLyricDelayMs(delayMs));
}

/**
 * Phase-lock the renderer's smooth local clock to a sampled player clock.
 * Small timestamp jitter is ignored, ordinary drift is eased out, and real
 * seeks/state changes still snap immediately.
 */
export function reconcilePlaybackPosition({
  predictedPosition = 0,
  incomingPosition = 0,
  playing = false,
  force = false,
  stateChanged = false,
  reconcile = true
} = {}) {
  const predicted = Math.max(0, Number(predictedPosition) || 0);
  const incoming = Math.max(0, Number(incomingPosition) || 0);
  const driftMs = incoming - predicted;

  if (force || stateChanged || !playing) {
    return { positionMs: incoming, driftMs, correctionMs: driftMs, rateScale: 1, snapped: true };
  }
  if (!reconcile) {
    return { positionMs: predicted, driftMs, correctionMs: 0, rateScale: 1, snapped: false };
  }
  if (Math.abs(driftMs) >= 1800) {
    return { positionMs: incoming, driftMs, correctionMs: driftMs, rateScale: 1, snapped: true };
  }
  if (Math.abs(driftMs) <= 45) {
    return { positionMs: predicted, driftMs, correctionMs: 0, rateScale: 1, snapped: false };
  }

  // Never pull a continuously playing clock backwards for ordinary SMTC
  // drift. A brief slowdown lets the player timeline catch up without making
  // the karaoke fill visibly stutter or reverse. Genuine backward seeks still
  // use the snap path above.
  if (driftMs < 0) {
    const rateScale = clamp(1 + driftMs / 4000, 0.82, 0.985);
    return {
      positionMs: predicted,
      driftMs,
      correctionMs: 0,
      rateScale,
      snapped: false
    };
  }

  const magnitude = Math.abs(driftMs);
  const gain = magnitude < 300 ? 0.28 : magnitude < 900 ? 0.36 : 0.48;
  const correctionLimit = magnitude < 300 ? 90 : magnitude < 900 ? 180 : 320;
  const correctionMs = clamp(driftMs * gain, -correctionLimit, correctionLimit);
  return {
    positionMs: predicted + correctionMs,
    driftMs,
    correctionMs,
    rateScale: 1,
    snapped: false
  };
}
