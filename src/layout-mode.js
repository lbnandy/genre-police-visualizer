'use strict';

const DEFAULT_LAYOUT_MODE = 'side';
const LAYOUT_MODES = Object.freeze(['side', 'poster']);
const LAYOUT_BASE_SIZES = Object.freeze({
  side: Object.freeze({ width: 920, height: 400 }),
  poster: Object.freeze({ width: 500, height: 515 })
});

function normalizeLayoutMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  // Migrate the short-lived development name without breaking a saved choice.
  if (mode === 'stage') return 'poster';
  return LAYOUT_MODES.includes(mode) ? mode : DEFAULT_LAYOUT_MODE;
}

function layoutWindowSize(mode, scale = 1) {
  const base = LAYOUT_BASE_SIZES[normalizeLayoutMode(mode)];
  const safeScale = Number.isFinite(Number(scale)) ? Number(scale) : 1;
  return {
    width: Math.round(base.width * safeScale),
    height: Math.round(base.height * safeScale)
  };
}

module.exports = {
  DEFAULT_LAYOUT_MODE,
  LAYOUT_MODES,
  LAYOUT_BASE_SIZES,
  normalizeLayoutMode,
  layoutWindowSize
};
