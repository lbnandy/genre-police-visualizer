'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeArtworkBitmap,
  chooseArtworkFacePalette,
  contrastRatio,
  parseHex
} = require('../src/artwork-face-palette');

test('samples the central artwork region from a BGRA bitmap', () => {
  const width = 10;
  const height = 10;
  const bitmap = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    bitmap[index * 4] = 30;
    bitmap[index * 4 + 1] = 80;
    bitmap[index * 4 + 2] = 180;
    bitmap[index * 4 + 3] = 255;
  }
  const sample = analyzeArtworkBitmap(bitmap, width, height);
  assert.deepEqual({ r: sample.r, g: sample.g, b: sample.b }, { r: 180, g: 80, b: 30 });
});

test('automatic kawaii ink stays thematic while contrasting dark and bright covers', () => {
  const theme = { accent: '#ff79bd', accent2: '#62e5d3', hot: '#fff1a8' };
  const darkCover = { r: 20, g: 16, b: 28 };
  const brightCover = { r: 238, g: 226, b: 234 };
  const onDark = chooseArtworkFacePalette(darkCover, theme);
  const onBright = chooseArtworkFacePalette(brightCover, theme);
  assert.ok(contrastRatio(parseHex(onDark.ink), darkCover) >= 4.1);
  assert.ok(contrastRatio(parseHex(onBright.ink), brightCover) >= 4.1);
  assert.notEqual(onDark.ink, onBright.ink);
  assert.ok(contrastRatio(parseHex(onDark.mouth), darkCover) >= 1.65);
  assert.ok(contrastRatio(parseHex(onBright.mouth), brightCover) >= 1.65);
  assert.notEqual(onDark.mouth, onBright.mouth);
  assert.ok(onDark.mouthInkContrast >= 1.18);
  assert.ok(onBright.mouthInkContrast >= 1.18);
});
