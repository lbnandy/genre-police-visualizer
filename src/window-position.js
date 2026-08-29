'use strict';

function finiteInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function normalizeArea(area) {
  const x = finiteInteger(area?.x);
  const y = finiteInteger(area?.y);
  const width = finiteInteger(area?.width);
  const height = finiteInteger(area?.height);
  if (x === null || y === null || !width || !height || width < 1 || height < 1) return null;
  return { x, y, width, height };
}

function distanceSquaredToAreaCenter(x, y, area) {
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  return (x - centerX) ** 2 + (y - centerY) ** 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveWindowBounds({
  savedPosition,
  width,
  height,
  workAreas = [],
  primaryWorkArea,
  rightMargin = 28,
  bottomMargin = 24
} = {}) {
  const safeWidth = Math.max(1, finiteInteger(width) || 1);
  const safeHeight = Math.max(1, finiteInteger(height) || 1);
  const primary = normalizeArea(primaryWorkArea) || normalizeArea(workAreas[0]) || {
    x: 0,
    y: 0,
    width: safeWidth,
    height: safeHeight
  };
  const areas = workAreas.map(normalizeArea).filter(Boolean);
  if (!areas.length) areas.push(primary);

  const savedX = finiteInteger(savedPosition?.x);
  const savedY = finiteInteger(savedPosition?.y);
  if (savedX === null || savedY === null) {
    return {
      width: safeWidth,
      height: safeHeight,
      x: Math.max(primary.x, primary.x + primary.width - safeWidth - rightMargin),
      y: Math.max(primary.y, primary.y + primary.height - safeHeight - bottomMargin)
    };
  }

  const savedCenterX = savedX + safeWidth / 2;
  const savedCenterY = savedY + safeHeight / 2;
  const target = areas.reduce((best, area) => (
    distanceSquaredToAreaCenter(savedCenterX, savedCenterY, area)
      < distanceSquaredToAreaCenter(savedCenterX, savedCenterY, best)
      ? area
      : best
  ), areas[0]);
  const maxX = Math.max(target.x, target.x + target.width - safeWidth);
  const maxY = Math.max(target.y, target.y + target.height - safeHeight);
  return {
    width: safeWidth,
    height: safeHeight,
    x: clamp(savedX, target.x, maxX),
    y: clamp(savedY, target.y, maxY)
  };
}

module.exports = { resolveWindowBounds };
