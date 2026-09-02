'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { genreUncertaintyReason, withGenreReliability } = require('../src/genre-reliability');

function metadata(overrides = {}) {
  return {
    genre: { id: 'dubstep', matched: 'Dubstep', confidence: 0.9 },
    genreSource: 'Last.fm track tags',
    genreEvidence: { type: 'classifier', matched: 'Dubstep' },
    ...overrides
  };
}

test('keeps explicit track evidence and user decisions unmarked', () => {
  assert.equal(genreUncertaintyReason(metadata()), '');
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'house', confidence: 0.4 },
    genreEvidence: { type: 'user-correction' },
    userGenreCorrection: { genreId: 'house' }
  })), '');
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'trance', confidence: 1 },
    genreEvidence: { type: 'temporary-genre' }
  })), '');
});

test('marks broad, artist, title, collection, and raw fallbacks as uncertain', () => {
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'electronic', confidence: 0.7 }
  })), 'broad-genre');
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'hardcore', matched: 'artist:laur', confidence: 0.78 },
    genreSource: 'curated artist map'
  })), 'artist-fallback');
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'trance', matched: 'title:trance', confidence: 0.72 },
    genreSource: 'local classifier'
  })), 'title-inference');
  assert.equal(genreUncertaintyReason(metadata({
    genreSource: 'Discogs release styles'
  })), 'collection-fallback');
  assert.equal(genreUncertaintyReason(metadata({
    genre: { id: 'raw-speedbass', matched: 'raw:speedbass', confidence: 0.48 }
  })), 'raw-genre');
});

test('marks tentative AI evidence and clears the mark after standard confirmation', () => {
  const first = metadata({
    genreEvidence: {
      type: 'audio-model',
      stage: 'first',
      confirmed: false,
      supportedByRelativeLead: false
    }
  });
  assert.equal(genreUncertaintyReason(first), 'audio-unconfirmed');
  assert.equal(genreUncertaintyReason(metadata({
    genreEvidence: { ...first.genreEvidence, stage: 'confirmed', confirmed: true }
  })), '');
  assert.equal(genreUncertaintyReason(metadata({
    genreEvidence: {
      ...first.genreEvidence,
      stage: 'confirmed',
      confirmed: true,
      supportedByRelativeLead: true
    }
  })), 'audio-relative-lead');
  assert.equal(genreUncertaintyReason(metadata({
    genreEvidence: { type: 'audio-memory', stage: 'memory' }
  })), 'audio-memory');
});

test('adds renderer-facing reliability fields', () => {
  assert.deepEqual(withGenreReliability(metadata({
    genreSource: 'MusicBrainz artist tags'
  })), {
    ...metadata({ genreSource: 'MusicBrainz artist tags' }),
    genreUncertain: true,
    genreUncertainReason: 'artist-fallback'
  });
});
