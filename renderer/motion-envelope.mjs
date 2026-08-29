const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * Frame-rate-independent attack/release smoothing for continuously animated UI.
 * A shorter attack keeps beats responsive; the longer release prevents audio
 * discontinuities (notably seeking) from turning into a visible one-frame snap.
 */
export function smoothMotionEnvelope(current, target, deltaMs, options = {}) {
  const from = finite(current);
  const to = finite(target);
  const elapsed = Math.max(0, finite(deltaMs, 16.667));
  const attackMs = Math.max(1, finite(options.attackMs, 42));
  const releaseMs = Math.max(1, finite(options.releaseMs, 150));
  const timeConstant = to > from ? attackMs : releaseMs;
  const response = 1 - Math.exp(-elapsed / timeConstant);
  return from + (to - from) * response;
}
