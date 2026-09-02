'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  matchGenreArtistRule,
  normalizeGenreArtistRules
} = require('../src/genre-artist-rules');
const { GenreResolver } = require('../src/genre-resolver');

test('normalizes supplemental artists and replaces duplicate artist identities', () => {
  const rules = normalizeGenreArtistRules([
    { artist: 'Example Artist', genreId: 'house' },
    { artist: ' example   artist ', genreId: 'trance' },
    { artist: '', genreId: 'house' },
    { artist: 'Invalid Genre', genreId: 'unknown' }
  ], ['house', 'trance', 'unknown']);

  assert.deepEqual(rules, [{ artist: 'example artist', genreId: 'trance' }]);
});

test('matches a supplemental artist inside a multi-artist credit', () => {
  const rule = { artist: 'Vetufice', genreId: 'hardcore' };
  assert.equal(matchGenreArtistRule([rule], 'Revelation ft. Vetufice'), rule);
  assert.equal(matchGenreArtistRule([rule], 'Someone Else'), null);
});

test('supplemental artists refine unknown or broad results without replacing concrete metadata', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({
      onlineGenreLookupEnabled: false,
      genreArtistRules: [{ artist: 'Example Producer', genreId: 'trance' }]
    })
  });

  const broad = await resolver.resolve({
    title: 'Unlabeled Track',
    artist: 'Example Producer',
    genres: ['Electronic']
  });
  assert.equal(broad.genre.id, 'trance');
  assert.equal(broad.genreSource, 'user artist supplement');
  assert.deepEqual(broad.genreEvidence, {
    type: 'user-artist',
    artist: 'Example Producer',
    genreId: 'trance'
  });

  const concrete = await resolver.resolve({
    title: 'Concrete Track',
    artist: 'Example Producer',
    genres: ['Techno']
  });
  assert.equal(concrete.genre.id, 'techno');
  assert.notEqual(concrete.genreSource, 'user artist supplement');
});

test('a broad family result can be refined within the same family', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({
      onlineGenreLookupEnabled: false,
      genreArtistRules: [{ artist: 'House Producer', genreId: 'progressive-house' }]
    })
  });
  const result = await resolver.resolve({
    title: 'House Track',
    artist: 'House Producer',
    genres: ['House']
  });
  assert.equal(result.genre.id, 'progressive-house');
  assert.equal(result.genreSource, 'user artist supplement');
});

test('artist genre references can be disabled without disabling direct metadata', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({
      onlineGenreLookupEnabled: false,
      artistGenreReferenceEnabled: false,
      genreArtistRules: [{ artist: 'Angerfist', genreId: 'trance' }]
    })
  });

  const broad = await resolver.resolve({
    title: 'Unlabeled Track',
    artist: 'Angerfist',
    genres: ['Electronic']
  });
  assert.equal(broad.genre.id, 'electronic');
  assert.notEqual(broad.genreSource, 'user artist supplement');

  const direct = await resolver.resolve({
    title: 'Tagged Track',
    artist: 'Angerfist',
    genres: ['Hardcore']
  });
  assert.equal(direct.genre.id, 'hardcore');
});
