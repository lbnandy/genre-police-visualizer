'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_UI_SCALE,
  UI_SCALE_PERCENTAGES,
  normalizeUiScale,
  scaleForPercent,
  uiScaleLabel
} = require('../src/ui-scale');

test('new installations default to the displayed 120% size', () => {
  assert.equal(DEFAULT_UI_SCALE, scaleForPercent(120));
  assert.equal(normalizeUiScale(undefined), scaleForPercent(120));
});

test('every displayed scale is proportional to the 100% reference', () => {
  const reference = scaleForPercent(100);
  for (const percent of UI_SCALE_PERCENTAGES) {
    assert.ok(Math.abs(scaleForPercent(percent) / reference - percent / 100) < 1e-12);
    assert.equal(uiScaleLabel(scaleForPercent(percent)), `${percent}%`);
  }
});

test('150% is exactly one and a half times the 100% size', () => {
  assert.equal(scaleForPercent(100), 1.2);
  assert.equal(scaleForPercent(150), 1.8);
  assert.equal(scaleForPercent(150) / scaleForPercent(100), 1.5);
});

test('stored additive scale values migrate without changing their displayed choice', () => {
  assert.equal(normalizeUiScale(0.9), scaleForPercent(70));
  assert.equal(normalizeUiScale(1.2), scaleForPercent(100));
  assert.equal(normalizeUiScale(1.7), scaleForPercent(150));
});
