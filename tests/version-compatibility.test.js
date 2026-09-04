'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const pkg = require('../package.json');
const {
  AUDIO_GENRE_MODEL_REVISION,
  audioGenreMemoryKey,
  audioGenreMemoryStorageKey,
  createAudioGenreMemories,
  getAudioGenreMemory
} = require('../src/audio-genre-memory');
const { sanitizeStoredConfig } = require('../src/config-sanitizer');
const { createGenreCorrections, getGenreCorrection } = require('../src/genre-corrections');
const { GENRE_DATA_VERSION, unpackGenreData } = require('../src/genre-data-transfer');

test('0.3.1 keeps the 0.3.0 application identity and persisted data formats', () => {
  assert.equal(pkg.version, '0.3.1');
  assert.equal(pkg.name, 'genre-police-visualizer');
  assert.equal(pkg.build.appId, 'com.genrepolice.visualizer');
  assert.equal(pkg.build.productName, 'Genre Police Visualizer');
  assert.equal(GENRE_DATA_VERSION, 1);

  const oldSettings = {
    language: 'ja',
    layoutMode: 'poster',
    uiScale: 1.2,
    lyricsEnabled: false,
    localGenreModelEnabled: true,
    dynamicGenreDetectionEnabled: false,
    frameRateLimit: '90',
    customGenres: [{ id: 'legacy-custom' }],
    genreArtistRules: [{ artist: 'Legacy Artist', genreId: 'house' }]
  };
  assert.deepEqual(sanitizeStoredConfig(oldSettings).config, oldSettings);

  const metadata = {
    title: 'Legacy Track',
    artist: 'Legacy Artist',
    durationMs: 180000
  };
  const oldCorrections = createGenreCorrections({
    version: 1,
    tracks: {
      legacy: {
        ...metadata,
        genreId: 'house',
        label: 'HOUSE',
        updatedAt: '2026-09-02T00:00:00.000Z'
      }
    }
  });
  assert.equal(getGenreCorrection(oldCorrections, metadata)?.genreId, 'house');

  const identityHash = audioGenreMemoryKey(metadata);
  const storageKey = audioGenreMemoryStorageKey(identityHash, metadata.durationMs);
  const oldMemories = createAudioGenreMemories({
    version: 1,
    modelRevision: AUDIO_GENRE_MODEL_REVISION,
    entries: {
      [storageKey]: {
        identityHash,
        genreId: 'house',
        confidence: 0.42,
        margin: 0.12,
        acceptedWindows: 80,
        analyzedSeconds: 79.36,
        durationMs: metadata.durationMs,
        coverageRatio: 0.44,
        scores: { house: 0.42, techno: 0.3 },
        modelRevision: AUDIO_GENRE_MODEL_REVISION,
        updatedAt: '2026-09-02T00:00:00.000Z'
      }
    }
  });
  const restoredMemory = getAudioGenreMemory(oldMemories, metadata);
  assert.equal(restoredMemory?.genreId, 'house');
  assert.equal(restoredMemory?.fullPlaybackEvidence, false);

  const imported = unpackGenreData({
    format: 'genre-police-genre-data',
    version: 1,
    corrections: oldCorrections,
    customGenres: [],
    genreArtistRules: []
  });
  assert.equal(imported.corrections.tracks[Object.keys(oldCorrections.tracks)[0]].genreId, 'house');
});
