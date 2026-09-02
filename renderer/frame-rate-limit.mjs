export const FRAME_RATE_LIMITS = Object.freeze(['display', '120', '90', '60', '30']);

export function normalizeFrameRateLimit(value) {
  const normalized = String(value ?? '').trim();
  return FRAME_RATE_LIMITS.includes(normalized) ? normalized : 'display';
}

export function frameIntervalFor({
  hidden = false,
  animationActive = false,
  frameRateLimit = 'display',
  idleFrameLimitEnabled = true
} = {}) {
  if (hidden) return 250;
  if (animationActive) {
    const normalized = normalizeFrameRateLimit(frameRateLimit);
    return normalized === 'display' ? 0 : 1000 / Number(normalized);
  }
  return idleFrameLimitEnabled ? 1000 / 30 : 0;
}

export function scheduleFrame(time, deadline, interval) {
  if (!(interval > 0)) return { due: true, deadline: 0 };
  if (!(deadline > 0)) return { due: true, deadline: time + interval };
  if (time + 0.1 < deadline) return { due: false, deadline };

  const lateness = Math.max(0, time - deadline);
  return {
    due: true,
    deadline: time + interval - (lateness % interval)
  };
}

export function performanceTargetFps(frameRateLimit = 'display') {
  const normalized = normalizeFrameRateLimit(frameRateLimit);
  return normalized === 'display' ? 60 : Math.min(60, Number(normalized));
}
