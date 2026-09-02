'use strict';

const LAYOUT_REGIONS = Object.freeze({
  side: Object.freeze({
    designWidth: 920,
    designHeight: 400,
    surface: Object.freeze({ left: 54, top: 48, right: 812, bottom: 352, radius: 152 }),
    settings: Object.freeze({ left: 396, top: 7, right: 896, bottom: 393, radius: 18 })
  }),
  poster: Object.freeze({
    designWidth: 500,
    designHeight: 515,
    surface: Object.freeze({ left: 16, top: 16, right: 484, bottom: 499, radius: 24 }),
    settings: Object.freeze({ left: 24, top: 28, right: 476, bottom: 487, radius: 18 })
  })
});

function pointInRoundedRect(x, y, rect, radius) {
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
  const safeRadius = Math.max(0, Math.min(
    Number(radius) || 0,
    (rect.right - rect.left) / 2,
    (rect.bottom - rect.top) / 2
  ));
  const nearestX = Math.max(rect.left + safeRadius, Math.min(rect.right - safeRadius, x));
  const nearestY = Math.max(rect.top + safeRadius, Math.min(rect.bottom - safeRadius, y));
  return ((x - nearestX) ** 2 + (y - nearestY) ** 2) <= safeRadius ** 2;
}

function scaledRegion(region, windowBounds, scaleX, scaleY) {
  return {
    left: windowBounds.x + region.left * scaleX,
    top: windowBounds.y + region.top * scaleY,
    right: windowBounds.x + region.right * scaleX,
    bottom: windowBounds.y + region.bottom * scaleY,
    radius: region.radius * Math.min(scaleX, scaleY)
  };
}

function pointInWindowSurface(point, windowBounds, layout, { settingsOpen = false } = {}) {
  const regions = LAYOUT_REGIONS[layout === 'poster' ? 'poster' : 'side'];
  const scaleX = Number(windowBounds?.width) / regions.designWidth;
  const scaleY = Number(windowBounds?.height) / regions.designHeight;
  if (!(scaleX > 0) || !(scaleY > 0)) return true;

  const surface = scaledRegion(regions.surface, windowBounds, scaleX, scaleY);
  if (pointInRoundedRect(point.x, point.y, surface, surface.radius)) return true;
  if (!settingsOpen) return false;

  const settings = scaledRegion(regions.settings, windowBounds, scaleX, scaleY);
  return pointInRoundedRect(point.x, point.y, settings, settings.radius);
}

module.exports = { pointInRoundedRect, pointInWindowSurface };
