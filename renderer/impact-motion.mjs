export function impactFrontProgress(value, spring = 7.2) {
  const progress = Math.max(0, Math.min(1, Number(value) || 0));
  const back = Math.max(0.82, Math.min(1.55, 0.82 + (Number(spring) - 5) * 0.16));
  const offset = progress - 1;
  return 1 + (back + 1) * offset ** 3 + back * offset ** 2;
}

export function impactShapeRatio(point = {}, baseRadius = 1, response = 0.45) {
  const base = Math.max(1, Number(baseRadius) || 1);
  const localBase = Number(point.baseRadius) || base;
  const radius = Number(point.radius) || localBase;
  const broadMotion = (localBase - base) / base;
  const spectralExcursion = (radius - localBase) / base;
  return Math.max(0.88, Math.min(1.22,
    1 + broadMotion * 0.18 + spectralExcursion * Math.max(0, Number(response) || 0) * 0.68
  ));
}

function smoothCircular(values, radius, passes = 2) {
  let current = values.slice();
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((_, index) => {
      let total = 0;
      let weightTotal = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const weight = radius + 1 - Math.abs(offset);
        const wrapped = (index + offset + current.length) % current.length;
        total += current[wrapped] * weight;
        weightTotal += weight;
      }
      return total / weightTotal;
    });
  }
  return current;
}

export function impactContourRatios(points = [], baseRadius = 1, response = 0.45, directionality = 0.12) {
  if (!points.length) return [];
  const base = Math.max(1, Number(baseRadius) || 1);
  const excursions = points.map((point) => {
    const localBase = Number(point.baseRadius) || base;
    return Math.max(0, ((Number(point.radius) || localBase) - localBase) / base);
  });
  // Only the broad silhouette is inherited. Narrow spectral teeth stay on the
  // membrane, while the launched front follows a softer directional envelope.
  const broad = smoothCircular(excursions, Math.max(1, Math.round(points.length / 24)), 2);
  const sorted = broad.slice().sort((a, b) => a - b);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] || 0;
  const floor = percentile(0.16);
  const ceiling = percentile(0.9);
  const range = Math.max(0.015, ceiling - floor);
  const activity = broad.map((value) => Math.max(0, Math.min(1, (value - floor) / range)));
  const averageActivity = activity.reduce((total, value) => total + value, 0) / activity.length;
  const directionalStrength = Math.max(0, Math.min(1, range / 0.28))
    * Math.max(0, Number(directionality) || 0);

  return points.map((point, index) => {
    const localBase = Number(point.baseRadius) || base;
    const broadPoint = {
      ...point,
      radius: localBase + broad[index] * base
    };
    const inherited = impactShapeRatio(broadPoint, base, response);
    const directionalBias = (activity[index] - averageActivity) * directionalStrength;
    return Math.max(0.86, Math.min(1.24, inherited + directionalBias));
  });
}
