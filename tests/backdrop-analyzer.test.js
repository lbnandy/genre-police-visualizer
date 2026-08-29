const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeBackdropBitmap,
  deriveBackdropProfile,
  relativeLuminance,
  requiredScrimAlpha,
  smoothBackdropSample
} = require('../src/backdrop-analyzer');

function fillBitmap(width, height, { r, g, b, a = 255 }) {
  const bitmap = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    bitmap[index * 4] = b;
    bitmap[index * 4 + 1] = g;
    bitmap[index * 4 + 2] = r;
    bitmap[index * 4 + 3] = a;
  }
  return bitmap;
}

test('adaptive backdrop samples outside the overlay instead of feeding on its own colors', () => {
  const width = 100;
  const height = 60;
  const bitmap = fillBitmap(width, height, { r: 244, g: 246, b: 250 });
  // Simulate a bright red visualizer inside the app window. The analyzer must
  // ignore it and retain the surrounding white page as the backdrop profile.
  for (let y = 20; y < 40; y += 1) {
    for (let x = 30; x < 70; x += 1) {
      const offset = (y * width + x) * 4;
      bitmap[offset] = 20;
      bitmap[offset + 1] = 30;
      bitmap[offset + 2] = 250;
    }
  }
  const sample = analyzeBackdropBitmap(
    bitmap,
    width,
    height,
    { x: 0, y: 0, width: 100, height: 60 },
    { x: 30, y: 20, width: 40, height: 20 }
  );
  assert.ok(sample.r > 235 && sample.g > 235 && sample.b > 235);
  const profile = deriveBackdropProfile(sample);
  assert.equal(profile.mode, 'bright');
  assert.equal(profile.opacity, 1);
  const strongAlpha = Number(profile.strong.match(/, ([0-9.]+)\)$/)?.[1]);
  assert.ok(strongAlpha >= 0.84);
  assert.match(profile.strong, /^rgba\(5, 8, 18,/);
  assert.equal(profile.tint, 'rgba(8, 12, 24, 0.055)');
});

test('contrast scrim strength rises from mid-tone to white backgrounds', () => {
  const medium = requiredScrimAlpha(0.55);
  const white = requiredScrimAlpha(1);
  assert.ok(white > medium);
  assert.ok(white >= 0.92);
});

test('uses linear relative luminance instead of treating saturated blue as a bright gray', () => {
  assert.ok(relativeLuminance(20, 80, 200) < 0.16);
  assert.ok(relativeLuminance(245, 245, 245) > 0.9);
});

test('high-contrast desktop detail selects the protective material even when its mean is moderate', () => {
  const profile = deriveBackdropProfile({
    r: 125,
    g: 125,
    b: 125,
    luminance: 0.42,
    highlightLuminance: 0.98,
    luminanceSpread: 0.94,
    saturation: 0
  });
  assert.equal(profile.mode, 'bright');
  assert.ok(profile.contrastLuminance > profile.luminance);
});

test('adaptive samples ease normal changes but react faster to a drastic luminance change', () => {
  const base = { r: 20, g: 30, b: 50, luminance: 0.04, lowLuminance: 0.02, highlightLuminance: 0.08, luminanceSpread: 0.06, saturation: 0.6, samples: 100 };
  const small = smoothBackdropSample(base, { ...base, r: 28, luminance: 0.06 });
  const large = smoothBackdropSample(base, { ...base, r: 245, g: 245, b: 245, luminance: 0.91, highlightLuminance: 0.98, saturation: 0.02 });
  assert.ok(small.r > base.r && small.r < 28);
  assert.ok(large.luminance > 0.5);
  assert.ok(large.luminance < 0.91);
});

test('adaptive backdrop preserves the hue of a colored desktop region', () => {
  const bitmap = fillBitmap(100, 60, { r: 12, g: 82, b: 188 });
  const sample = analyzeBackdropBitmap(
    bitmap,
    100,
    60,
    { x: 0, y: 0, width: 100, height: 60 },
    { x: 30, y: 20, width: 40, height: 20 }
  );
  const profile = deriveBackdropProfile(sample);
  assert.ok(sample.b > sample.g && sample.g > sample.r);
  assert.match(profile.tint, /rgba\(12, 82, 188,/);
  assert.ok(profile.saturation > 0.8);
});
