export function reduceDenseSpectrumBins(value) {
  const bins = Math.max(1, Math.round(Number(value) || 1));
  if (bins >= 62) return bins - 4;
  if (bins >= 56) return bins - 3;
  if (bins >= 50) return bins - 2;
  return bins;
}
