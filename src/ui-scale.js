'use strict';

const UI_SCALE_BASE = 1.2;
const UI_SCALE_PERCENTAGES = Object.freeze([50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
const UI_SCALES = Object.freeze(
  UI_SCALE_PERCENTAGES.map((percent) => Number((UI_SCALE_BASE * percent / 100).toFixed(2)))
);
const DEFAULT_UI_SCALE = UI_SCALE_BASE;

// Migrate the short-lived additive mapping while preserving the percentage
// the user selected. For example, the old internal 1.5 represented 130%; the
// proportional system represents that same 130% selection as 1.56.
const LEGACY_UI_SCALE_MAP = new Map([
  [0.8, 0.84],
  [0.9, 0.84],
  [1, 0.96],
  [1.1, 1.08],
  [1.2, 1.2],
  [1.3, 1.32],
  [1.4, 1.44],
  [1.5, 1.56],
  [1.6, 1.68],
  [1.7, 1.8]
]);

function scaleForPercent(percent) {
  const numeric = Number(percent);
  return Number((UI_SCALE_BASE * numeric / 100).toFixed(2));
}

function uiScalePercent(scale) {
  return Math.round(Number(scale) / UI_SCALE_BASE * 100);
}

function normalizeUiScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_UI_SCALE;
  const current = UI_SCALES.find((scale) => Math.abs(scale - numeric) < 0.000001);
  if (current !== undefined) return current;
  return LEGACY_UI_SCALE_MAP.get(numeric) ?? DEFAULT_UI_SCALE;
}

function uiScaleLabel(scale) {
  return `${uiScalePercent(scale)}%`;
}

module.exports = {
  DEFAULT_UI_SCALE,
  UI_SCALE_BASE,
  UI_SCALE_PERCENTAGES,
  UI_SCALES,
  normalizeUiScale,
  scaleForPercent,
  uiScaleLabel,
  uiScalePercent
};
