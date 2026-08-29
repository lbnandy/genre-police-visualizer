const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function softenMotionMetrics(metrics = {}, mode = 'standard') {
  if (mode !== 'gentle') return metrics;
  return {
    ...metrics,
    impact: clamp(metrics.impact) * 0.58,
    accent: clamp(metrics.accent) * 0.44,
    rhythmStrength: clamp(metrics.rhythmStrength) * 0.62,
    rhythmPulse: clamp(metrics.rhythmPulse) * 0.58,
    kickPulse: clamp(metrics.kickPulse) * 0.68
  };
}
