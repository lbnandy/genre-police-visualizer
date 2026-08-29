'use strict';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function parseHex(value, fallback = { r: 255, g: 121, b: 189 }) {
  const match = String(value || '').trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return { ...fallback };
  const packed = Number.parseInt(match[1], 16);
  return { r: packed >> 16, g: (packed >> 8) & 255, b: packed & 255 };
}

function mixRgb(from, to, amount) {
  const t = clamp(amount);
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t)
  };
}

function toHex(color) {
  return `#${[color.r, color.g, color.b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(color) {
  const linear = [color.r, color.g, color.b].map((value) => {
    const channel = clamp(value / 255);
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function analyzeArtworkBitmap(bitmap, width, height) {
  if (!bitmap || !Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return null;
  const samples = [];
  const left = Math.floor(width * 0.16);
  const right = Math.ceil(width * 0.84);
  const top = Math.floor(height * 0.16);
  const bottom = Math.ceil(height * 0.84);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * width + x) * 4;
      // Electron exposes native bitmap bytes as BGRA on Windows.
      const b = bitmap[offset];
      const g = bitmap[offset + 1];
      const r = bitmap[offset + 2];
      const a = bitmap[offset + 3];
      if (a < 160) continue;
      const color = { r, g, b };
      samples.push({ ...color, luminance: relativeLuminance(color) });
    }
  }
  if (samples.length < 8) return null;
  samples.sort((a, b) => a.luminance - b.luminance);
  const trim = Math.floor(samples.length * 0.1);
  const kept = samples.slice(trim, samples.length - trim || samples.length);
  const total = kept.reduce((sum, sample) => ({
    r: sum.r + sample.r,
    g: sum.g + sample.g,
    b: sum.b + sample.b
  }), { r: 0, g: 0, b: 0 });
  const divisor = Math.max(1, kept.length);
  const color = {
    r: Math.round(total.r / divisor),
    g: Math.round(total.g / divisor),
    b: Math.round(total.b / divisor)
  };
  return { ...color, luminance: relativeLuminance(color), samples: kept.length };
}

function chooseArtworkFacePalette(sample, theme = {}) {
  const background = sample
    ? { r: Number(sample.r) || 0, g: Number(sample.g) || 0, b: Number(sample.b) || 0 }
    : { r: 118, g: 105, b: 132 };
  const accent = parseHex(theme.accent);
  const accent2 = parseHex(theme.accent2, { r: 98, g: 229, b: 211 });
  const hot = parseHex(theme.hot, { r: 255, g: 241, b: 168 });
  const dark = { r: 29, g: 17, b: 34 };
  const light = { r: 255, g: 246, b: 252 };
  const candidates = [
    { color: accent, affinity: 1 },
    { color: mixRgb(accent, dark, 0.64), affinity: 1.08 },
    { color: mixRgb(accent, light, 0.54), affinity: 1.04 },
    { color: accent2, affinity: 0.88 },
    { color: mixRgb(accent2, dark, 0.66), affinity: 0.92 },
    { color: mixRgb(accent2, light, 0.5), affinity: 0.88 },
    { color: mixRgb(accent, hot, 0.38), affinity: 0.94 }
  ];
  const ranked = candidates.map((candidate) => ({
    ...candidate,
    contrast: contrastRatio(candidate.color, background)
  })).sort((a, b) => (b.contrast + b.affinity * 0.18) - (a.contrast + a.affinity * 0.18));
  let best = ranked[0];
  if (best.contrast < 4.1) {
    const fallback = relativeLuminance(background) > 0.43
      ? mixRgb(accent, dark, 0.78)
      : mixRgb(accent, light, 0.72);
    best = { color: fallback, contrast: contrastRatio(fallback, background) };
  }
  const inkIsLight = relativeLuminance(best.color) > relativeLuminance(background);
  const rose = mixRgb({ r: 235, g: 126, b: 168 }, accent, 0.46);
  const coverTintedRose = mixRgb(rose, background, 0.22);
  const mouthCandidates = [
    coverTintedRose,
    mixRgb(coverTintedRose, light, 0.25),
    mixRgb(coverTintedRose, dark, 0.3),
    mixRgb(rose, hot, 0.18),
    mixRgb(rose, accent2, 0.16)
  ];
  const rankedMouths = mouthCandidates.map((color) => {
    const backgroundContrast = contrastRatio(color, background);
    const inkContrast = contrastRatio(color, best.color);
    return {
      color,
      backgroundContrast,
      inkContrast,
      score: Math.min(3.6, backgroundContrast) * 0.72 + Math.min(3.2, inkContrast) * 0.36
    };
  }).sort((a, b) => b.score - a.score);
  let mouth = rankedMouths[0];
  if (mouth.backgroundContrast < 1.65 || mouth.inkContrast < 1.18) {
    const fallback = relativeLuminance(background) > 0.43
      ? mixRgb(rose, dark, 0.38)
      : mixRgb(rose, light, 0.3);
    mouth = {
      color: fallback,
      backgroundContrast: contrastRatio(fallback, background),
      inkContrast: contrastRatio(fallback, best.color)
    };
  }
  return {
    ink: toHex(best.color),
    mouth: toHex(mouth.color),
    keyline: inkIsLight ? 'rgba(24, 12, 29, .72)' : 'rgba(255, 244, 252, .78)',
    contrast: Number(best.contrast.toFixed(3)),
    mouthContrast: Number(mouth.backgroundContrast.toFixed(3)),
    mouthInkContrast: Number(mouth.inkContrast.toFixed(3)),
    sample: { ...background, luminance: Number(relativeLuminance(background).toFixed(4)) }
  };
}

module.exports = { analyzeArtworkBitmap, chooseArtworkFacePalette, contrastRatio, parseHex };
