'use strict';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function srgbChannelToLinear(value) {
  const channel = clamp((Number(value) || 0) / 255);
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r, g, b) {
  return 0.2126 * srgbChannelToLinear(r)
    + 0.7152 * srgbChannelToLinear(g)
    + 0.0722 * srgbChannelToLinear(b);
}

function requiredScrimAlpha(backgroundLuminance, targetLuminance = 0.08, scrimLuminance = 0.003) {
  const background = clamp(Number(backgroundLuminance) || 0);
  const target = clamp(Number(targetLuminance) || 0);
  const scrim = clamp(Number(scrimLuminance) || 0);
  if (background <= target || background <= scrim) return 0;
  return clamp((background - target) / (background - scrim), 0, 0.96);
}

function analyzeBackdropBitmap(bitmap, width, height, displayBounds, windowBounds) {
  if (!Buffer.isBuffer(bitmap) || width < 2 || height < 2 || bitmap.length < width * height * 4) return null;
  const displayWidth = Math.max(1, Number(displayBounds?.width) || 1);
  const displayHeight = Math.max(1, Number(displayBounds?.height) || 1);
  const localX = (Number(windowBounds?.x) || 0) - (Number(displayBounds?.x) || 0);
  const localY = (Number(windowBounds?.y) || 0) - (Number(displayBounds?.y) || 0);
  const mapped = {
    x: localX / displayWidth * width,
    y: localY / displayHeight * height,
    width: (Number(windowBounds?.width) || displayWidth) / displayWidth * width,
    height: (Number(windowBounds?.height) || displayHeight) / displayHeight * height
  };
  const marginX = Math.max(8, Math.min(30, mapped.width * 0.16));
  const marginY = Math.max(6, Math.min(24, mapped.height * 0.2));
  const outerLeft = Math.max(0, Math.floor(mapped.x - marginX));
  const outerTop = Math.max(0, Math.floor(mapped.y - marginY));
  const outerRight = Math.min(width - 1, Math.ceil(mapped.x + mapped.width + marginX));
  const outerBottom = Math.min(height - 1, Math.ceil(mapped.y + mapped.height + marginY));
  const innerLeft = Math.floor(mapped.x - 1);
  const innerTop = Math.floor(mapped.y - 1);
  const innerRight = Math.ceil(mapped.x + mapped.width + 1);
  const innerBottom = Math.ceil(mapped.y + mapped.height + 1);
  const samples = [];

  for (let y = outerTop; y <= outerBottom; y += 2) {
    for (let x = outerLeft; x <= outerRight; x += 2) {
      const insideWindow = x >= innerLeft && x <= innerRight && y >= innerTop && y <= innerBottom;
      if (insideWindow) continue;
      const offset = (y * width + x) * 4;
      // Electron's Windows bitmap representation is BGRA.
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const a = bitmap[offset + 3];
      if (a < 180) continue;
      const luminance = relativeLuminance(r, g, b);
      samples.push({ r, g, b, luminance });
    }
  }

  if (samples.length < 24) return null;
  samples.sort((a, b) => a.luminance - b.luminance);
  const trim = Math.floor(samples.length * 0.1);
  const kept = samples.slice(trim, Math.max(trim + 1, samples.length - trim));
  const totals = kept.reduce((result, sample) => ({
    r: result.r + sample.r,
    g: result.g + sample.g,
    b: result.b + sample.b,
    luminance: result.luminance + sample.luminance
  }), { r: 0, g: 0, b: 0, luminance: 0 });
  const divisor = Math.max(1, kept.length);
  const r = Math.round(totals.r / divisor);
  const g = Math.round(totals.g / divisor);
  const b = Math.round(totals.b / divisor);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lowIndex = Math.max(0, Math.floor((samples.length - 1) * 0.1));
  const highIndex = Math.max(lowIndex, Math.floor((samples.length - 1) * 0.9));
  const lowLuminance = samples[lowIndex].luminance;
  const highlightLuminance = samples[highIndex].luminance;
  return {
    r,
    g,
    b,
    luminance: clamp(totals.luminance / divisor),
    lowLuminance: clamp(lowLuminance),
    highlightLuminance: clamp(highlightLuminance),
    luminanceSpread: clamp(highlightLuminance - lowLuminance),
    saturation: maximum ? (maximum - minimum) / maximum : 0,
    samples: kept.length
  };
}

function smoothBackdropSample(previous, next) {
  if (!next) return previous || null;
  if (!previous) return { ...next };
  const luminanceDelta = Math.abs((Number(next.luminance) || 0) - (Number(previous.luminance) || 0));
  const colorDelta = (
    Math.abs((Number(next.r) || 0) - (Number(previous.r) || 0))
    + Math.abs((Number(next.g) || 0) - (Number(previous.g) || 0))
    + Math.abs((Number(next.b) || 0) - (Number(previous.b) || 0))
  ) / 765;
  const spreadDelta = Math.abs((Number(next.luminanceSpread) || 0) - (Number(previous.luminanceSpread) || 0));
  const change = Math.max(luminanceDelta, colorDelta * 0.82, spreadDelta * 0.55);
  // Small desktop changes settle gently; a window moving from a dark area to
  // a bright one still catches up quickly enough to preserve legibility.
  const amount = clamp(0.44 + change * 0.52, 0.44, 0.78);
  const mix = (key) => (Number(previous[key]) || 0) * (1 - amount) + (Number(next[key]) || 0) * amount;
  return {
    r: Math.round(mix('r')),
    g: Math.round(mix('g')),
    b: Math.round(mix('b')),
    luminance: clamp(mix('luminance')),
    lowLuminance: clamp(mix('lowLuminance')),
    highlightLuminance: clamp(mix('highlightLuminance')),
    luminanceSpread: clamp(mix('luminanceSpread')),
    saturation: clamp(mix('saturation')),
    samples: next.samples
  };
}

function deriveBackdropProfile(sample) {
  if (!sample) return null;
  const luminance = clamp(Number(sample.luminance) || 0);
  const saturation = clamp(Number(sample.saturation) || 0);
  const highlightLuminance = clamp(Number(sample.highlightLuminance) || luminance);
  const luminanceSpread = clamp(Number(sample.luminanceSpread) || 0);
  // Like a regular system material, react to bright detail as well as the
  // average. This prevents a mixed black/white page from being misread as a
  // harmless middle gray.
  const contrastLuminance = clamp(Math.max(luminance, luminance * 0.58 + highlightLuminance * 0.42));
  const bright = contrastLuminance > 0.58;
  const brightNeutral = bright && saturation < 0.2;
  // Limit the amount of background chroma that reaches the material. The hue
  // remains recognizable, but saturated pages cannot turn the scrim muddy.
  const materialChroma = saturation * (1 - luminanceSpread * 0.3);
  const factor = 0.045 + materialChroma * 0.062;
  const neutralBase = [5, 7, 14];
  const sampledDeep = [sample.r, sample.g, sample.b].map((channel, index) => (
    Math.round(neutralBase[index] + clamp(Number(channel) || 0, 0, 255) * factor * 0.72)
  ));
  const deep = brightNeutral ? [5, 8, 18] : sampledDeep;
  const contrastAlpha = requiredScrimAlpha(contrastLuminance);
  const strongAlpha = bright
    ? Math.max(0.88, contrastAlpha)
    : Math.min(0.78, 0.43 + contrastLuminance * 0.2 + luminanceSpread * 0.08);
  const softAlpha = bright ? Math.max(0.56, contrastAlpha * 0.72) : 0.2 + contrastLuminance * 0.12;
  const faintAlpha = bright ? Math.max(0.18, contrastAlpha * 0.25) : 0.055 + contrastLuminance * 0.055;
  const tintAlpha = (0.016 + saturation * 0.045) * (1 - luminanceSpread * 0.35);
  return {
    rgb: { r: sample.r, g: sample.g, b: sample.b },
    luminance,
    contrastLuminance,
    luminanceSpread,
    saturation,
    mode: bright ? 'bright' : luminance < 0.24 ? 'dark' : 'balanced',
    strong: `rgba(${deep[0]}, ${deep[1]}, ${deep[2]}, ${strongAlpha.toFixed(3)})`,
    soft: `rgba(${deep[0]}, ${deep[1]}, ${deep[2]}, ${softAlpha.toFixed(3)})`,
    faint: `rgba(${deep[0]}, ${deep[1]}, ${deep[2]}, ${faintAlpha.toFixed(3)})`,
    tint: brightNeutral
      ? 'rgba(8, 12, 24, 0.055)'
      : `rgba(${sample.r}, ${sample.g}, ${sample.b}, ${tintAlpha.toFixed(3)})`,
    opacity: Number((bright ? 1 : 0.55 + contrastLuminance * 0.33).toFixed(3)),
    hudShadow: `rgba(0, 0, 0, ${(bright ? 0.95 : 0.58 + contrastLuminance * 0.34).toFixed(3)})`
  };
}

module.exports = {
  analyzeBackdropBitmap,
  deriveBackdropProfile,
  relativeLuminance,
  requiredScrimAlpha,
  smoothBackdropSample
};
