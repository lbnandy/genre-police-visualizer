'use strict';

const RETIRED_SPOTIFY_CONFIG_KEYS = Object.freeze([
  'spotifyClientId',
  'spotifyAuthEncrypted',
  'spotifyAccessToken',
  'spotifyRefreshToken',
  'spotifyExpiresAt',
  'spotifyCodeVerifier'
]);

function sanitizeStoredConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
  let changed = false;
  for (const key of RETIRED_SPOTIFY_CONFIG_KEYS) {
    if (!Object.hasOwn(config, key)) continue;
    delete config[key];
    changed = true;
  }
  return { config, changed };
}

function normalizeClickThrough(value) {
  return value === true;
}

function normalizeAlwaysOnTop(value) {
  return value === true;
}

function normalizeMotionMode(value) {
  return value === 'gentle' ? 'gentle' : 'standard';
}

function normalizeIdleBehavior(value) {
  return ['keep', 'dim', 'hide'].includes(value) ? value : 'keep';
}

function normalizeMediaSource(value) {
  return String(value || '').trim().slice(0, 512);
}

function normalizeIgnoredMediaSources(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeMediaSource).filter(Boolean))].slice(0, 32);
}

module.exports = {
  RETIRED_SPOTIFY_CONFIG_KEYS,
  normalizeAlwaysOnTop,
  normalizeClickThrough,
  normalizeIdleBehavior,
  normalizeIgnoredMediaSources,
  normalizeMediaSource,
  normalizeMotionMode,
  sanitizeStoredConfig
};
