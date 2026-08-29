'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeClickThrough,
  normalizeIdleBehavior,
  normalizeIgnoredMediaSources,
  normalizeMediaSource,
  normalizeMotionMode,
  sanitizeStoredConfig
} = require('../src/config-sanitizer');

test('mouse passthrough defaults off while preserving an explicit opt-in', () => {
  assert.equal(normalizeClickThrough(undefined), false);
  assert.equal(normalizeClickThrough(false), false);
  assert.equal(normalizeClickThrough(true), true);
});

test('experience settings keep conservative defaults and sanitize media sources', () => {
  assert.equal(normalizeMotionMode('gentle'), 'gentle');
  assert.equal(normalizeMotionMode('strong'), 'standard');
  assert.equal(normalizeIdleBehavior('dim'), 'dim');
  assert.equal(normalizeIdleBehavior('unexpected'), 'keep');
  assert.equal(normalizeMediaSource('  Spotify.exe  '), 'Spotify.exe');
  assert.deepEqual(
    normalizeIgnoredMediaSources([' Edge ', '', 'Edge', 'Spotify']),
    ['Edge', 'Spotify']
  );
});

test('removes retired Spotify Web API credentials while preserving current settings', () => {
  const result = sanitizeStoredConfig({
    spotifyClientId: 'legacy-client',
    spotifyAuthEncrypted: 'legacy-secret',
    language: 'ja',
    lyricsEnabled: false,
    onlineGenreLookupEnabled: true
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.config, {
    language: 'ja',
    lyricsEnabled: false,
    onlineGenreLookupEnabled: true
  });
});

test('leaves an already-current configuration unchanged', () => {
  const source = { language: 'en', uiScale: 1.2 };
  const result = sanitizeStoredConfig(source);
  assert.equal(result.changed, false);
  assert.deepEqual(result.config, source);
  assert.notEqual(result.config, source);
});
