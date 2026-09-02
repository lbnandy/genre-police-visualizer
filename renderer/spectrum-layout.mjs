const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const TAU = Math.PI * 2;

// spatialRatio is the angular distance from twelve o'clock along either half
// of the mirrored circle: 0 is the top seam and 1 is the bottom. The reserved
// region contains no FFT band; the lowest band starts independently at each
// edge and the complete spectrum still reaches the bottom.
export function mapFrequencyOutsideTopGap(spatialRatio, options = {}, output = {}) {
  const position = clamp(spatialRatio);
  const halfGapRatio = clamp(options.halfGapRatio ?? (15 / 180), 0, 0.24);
  // A zero-sized gap means a genuinely continuous spectrum. Without this
  // branch the feather calculation would still suppress the exact top point.
  if (halfGapRatio <= 0) {
    output.frequencyRatio = position;
    output.response = 1;
    return output;
  }
  const featherRatio = clamp(options.featherRatio ?? (5 / 180), 0.001, 0.06);
  output.frequencyRatio = clamp((position - halfGapRatio) / Math.max(0.001, 1 - halfGapRatio));
  const edgeProgress = clamp((position - halfGapRatio) / featherRatio);
  output.response = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);
  return output;
}

const degreesOnHalfCircle = (degrees) => degrees / 180;

const gapProfile = (halfAngle, feather, options = {}) => ({
  topFrequencyGapRatio: degreesOnHalfCircle(halfAngle),
  topFrequencyGapFeather: degreesOnHalfCircle(feather),
  topFrequencyGapLift: 0,
  topFrequencyGapMatchLowerAverage: halfAngle > 0,
  topFrequencyGapShoulderSmoothing: options.shoulderSmoothing || 0,
  topFrequencyGapValleyGuard: options.valleyGuard || 0,
  topFrequencyGapValleyCurve: options.valleyCurve || 0,
  topFrequencyGapPreserveInteriorArc: Boolean(options.preserveInteriorArc),
  topFrequencyGapWaveAmplitude: options.gapWaveAmplitude || 0,
  topFrequencyGapWaveSmoothing: options.gapWaveSmoothing || 0,
  topFrequencyGapNotchGuard: options.notchGuard || 0,
  topFrequencyGapSeamDip: options.seamDip
});

// The empty top sector is a visual shape tool, not part of the FFT. Keep the
// full cat silhouette exclusive to Kawaii Bass, and use the related broad
// twin-shoulder silhouette only for the four explicitly selected EDM styles.
export function genreTopFrequencyGap(theme = {}) {
  const mode = theme.mode || 'electronic';
  const id = theme.id || '';

  if (mode === 'kawaii-bass') {
    return gapProfile(15, 5, { shoulderSmoothing: 0.24, valleyGuard: 0.72 });
  }
  if (mode === 'future-bass') {
    return gapProfile(15, 5, { shoulderSmoothing: 0.4, valleyGuard: 0.64, seamDip: 0.06 });
  }

  if (mode === 'house') {
    if (['electro-house', 'complextro'].includes(id)) {
      return gapProfile(id === 'complextro' ? 12.5 : 15, 1, {
        shoulderSmoothing: 0,
        valleyGuard: 0,
        valleyCurve: 0,
        preserveInteriorArc: false,
        gapWaveAmplitude: id === 'complextro' ? 2.5 : 2.2,
        gapWaveSmoothing: 1,
        notchGuard: 0.88,
        seamDip: 0.09
      });
    }
  }

  return gapProfile(0, 0);
}

// Places a fixed-width set of sector groups along the usable arc so the
// inward edge of the first and last groups lands exactly on each top-gap edge.
export function distributeGroupsOutsideTopGap(count, halfGapRatio, groupHalfSpan) {
  const groupCount = Math.max(1, Math.round(count));
  const halfGapAngle = clamp(halfGapRatio, 0, 0.24) * Math.PI;
  const extent = clamp(groupHalfSpan, 0, Math.PI * 0.45);
  const startBoundary = -Math.PI / 2 + halfGapAngle;
  const usableArc = TAU - halfGapAngle * 2;
  if (groupCount === 1) return [startBoundary + usableArc / 2];
  const centerStep = Math.max(0, usableArc - extent * 2) / (groupCount - 1);
  return Array.from(
    { length: groupCount },
    (_, index) => startBoundary + extent + centerStep * index
  );
}
