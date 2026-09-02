const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function presentationPixelRatio({
  designWidth,
  renderedWidth,
  devicePixelRatio = 1
} = {}) {
  const safeDesignWidth = Number(designWidth);
  const safeRenderedWidth = Number(renderedWidth);
  const presentationScale = safeDesignWidth > 0 && safeRenderedWidth > 0
    ? safeRenderedWidth / safeDesignWidth
    : 1;
  const screenScale = (Number(devicePixelRatio) || 1) * presentationScale;
  return clamp(screenScale, 0.1, 3);
}

export function adaptivePixelRatio(nativePixelRatio, resolutionScale = 1) {
  return Math.max(0.1, nativePixelRatio * resolutionScale);
}
