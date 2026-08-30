'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { setGenreCorrection } = require('../src/genre-corrections');
const {
  GENRE_DATA_FORMAT,
  createGenreDataExport,
  mergeGenreData
} = require('../src/genre-data-transfer');

const themes = {
  house: { label: 'HOUSE' },
  trance: { label: 'TRANCE' },
  ambient: { label: 'AMBIENT' },
  electronic: { label: 'ELECTRONIC' }
};

function correctionState(entries) {
  let state = {};
  for (const [metadata, genre, now] of entries) {
    ({ state } = setGenreCorrection(state, metadata, genre, now));
  }
  return state;
}

test('exports corrections and custom genres in a versioned portable format', () => {
  const corrections = correctionState([[
    { title: 'A Track', artist: 'An Artist' },
    { id: 'house', label: 'HOUSE' },
    '2026-08-30T01:00:00.000Z'
  ]]);
  const payload = createGenreDataExport({
    corrections,
    customGenres: [{
      id: 'liquid-riddim',
      name: 'Liquid Riddim',
      aliases: ['liquid riddim'],
      artists: [],
      baseGenreId: 'electronic'
    }],
    genreArtistRules: [{ artist: 'Example Artist', genreId: 'trance' }],
    themes,
    appVersion: '0.1.0',
    now: '2026-08-30T02:00:00.000Z'
  });

  assert.equal(payload.format, GENRE_DATA_FORMAT);
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2026-08-30T02:00:00.000Z');
  assert.equal(Object.keys(payload.corrections.tracks).length, 1);
  assert.equal(payload.customGenres[0].id, 'liquid-riddim');
  assert.deepEqual(payload.genreArtistRules, [{ artist: 'Example Artist', genreId: 'trance' }]);
});

test('imports by merging new records and replacing matching identities or rule ids', () => {
  const currentCorrections = correctionState([[
    { title: 'Shared Track', artist: 'Shared Artist' },
    { id: 'house', label: 'HOUSE' },
    '2026-08-30T01:00:00.000Z'
  ]]);
  const importedCorrections = correctionState([
    [
      { title: 'Shared Track', artist: 'Shared Artist' },
      { id: 'trance', label: 'TRANCE' },
      '2026-08-30T02:00:00.000Z'
    ],
    [
      { title: 'New Track', artist: 'New Artist' },
      { id: 'ambient', label: 'AMBIENT' },
      '2026-08-30T02:01:00.000Z'
    ]
  ]);
  importedCorrections.tracks.invalid = {
    title: 'Bad Track',
    artist: 'Bad Artist',
    genreId: 'not-a-theme',
    label: 'BAD'
  };

  const result = mergeGenreData({
    payload: {
      format: GENRE_DATA_FORMAT,
      version: 1,
      corrections: importedCorrections,
      customGenres: [
        {
          id: 'shared-rule',
          name: 'Replaced Rule',
          aliases: ['replaced'],
          artists: [],
          baseGenreId: 'trance'
        },
        {
          id: 'new-rule',
          name: 'New Rule',
          aliases: ['new rule'],
          artists: [],
          baseGenreId: 'ambient'
        },
        { id: 'invalid-rule', name: 'Invalid', aliases: [], artists: [], baseGenreId: 'house' }
      ],
      genreArtistRules: [
        { artist: 'Shared Artist', genreId: 'trance' },
        { artist: 'New Artist', genreId: 'ambient' },
        { artist: '', genreId: 'house' }
      ]
    },
    corrections: currentCorrections,
    customGenres: [{
      id: 'shared-rule',
      name: 'Old Rule',
      aliases: ['old'],
      artists: [],
      baseGenreId: 'house'
    }],
    genreArtistRules: [{ artist: 'Shared Artist', genreId: 'house' }],
    themes,
    now: '2026-08-30T03:00:00.000Z'
  });

  assert.deepEqual(result.summary, {
    correctionsAdded: 1,
    correctionsUpdated: 1,
    customGenresAdded: 1,
    customGenresUpdated: 1,
    genreArtistRulesAdded: 1,
    genreArtistRulesUpdated: 1,
    skipped: 3
  });
  assert.equal(Object.values(result.corrections.tracks)
    .find((entry) => entry.title === 'Shared Track').genreId, 'trance');
  assert.equal(result.customGenres.find((rule) => rule.id === 'shared-rule').name, 'Replaced Rule');
  assert.equal(result.customGenres.find((rule) => rule.id === 'new-rule').baseGenreId, 'ambient');
  assert.equal(result.genreArtistRules.find((rule) => rule.artist === 'Shared Artist').genreId, 'trance');
  assert.equal(result.genreArtistRules.find((rule) => rule.artist === 'New Artist').genreId, 'ambient');
});

test('accepts a legacy raw corrections file and rejects unrelated JSON', () => {
  const legacy = correctionState([[
    { title: 'Legacy Track', artist: 'Legacy Artist' },
    { id: 'house', label: 'HOUSE' },
    '2026-08-30T01:00:00.000Z'
  ]]);
  const result = mergeGenreData({
    payload: legacy,
    corrections: {},
    customGenres: [],
    themes
  });
  assert.equal(result.summary.correctionsAdded, 1);
  assert.equal(result.customGenres.length, 0);
  assert.throws(() => mergeGenreData({
    payload: { hello: 'world' },
    corrections: {},
    customGenres: [],
    themes
  }), /invalid-format/);
});
