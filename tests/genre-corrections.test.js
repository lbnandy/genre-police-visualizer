'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearGenreCorrection,
  correctionKey,
  getGenreCorrection,
  setGenreCorrection
} = require('../src/genre-corrections');

test('genre corrections follow normalized artist and full track title', () => {
  const metadata = { artist: 'マリリン・マンソン', title: 'The Beautiful People', album: 'Antichrist Superstar' };
  const alias = { artist: 'Marilyn Manson', title: 'the beautiful people', album: 'Greatest Hits' };
  assert.equal(correctionKey(metadata), correctionKey(alias));
  assert.notEqual(correctionKey(metadata), correctionKey({ ...alias, title: 'The Beautiful People (Live)' }));
});

test('genre corrections persist and can be cleared without affecting other tracks', () => {
  const track = { artist: 'Example Artist', title: 'Example Track', album: 'Example Album' };
  const other = { artist: 'Example Artist', title: 'Other Track' };
  let state = {};
  ({ state } = setGenreCorrection(state, track, { id: 'frenchcore', label: 'FRENCHCORE' }, '2026-08-27T01:00:00.000Z'));
  ({ state } = setGenreCorrection(state, other, { id: 'house', label: 'HOUSE' }, '2026-08-27T01:01:00.000Z'));
  assert.equal(getGenreCorrection(state, track).genreId, 'frenchcore');
  ({ state } = clearGenreCorrection(state, track, '2026-08-27T01:02:00.000Z'));
  assert.equal(getGenreCorrection(state, track), null);
  assert.equal(getGenreCorrection(state, other).genreId, 'house');
});

test('Apple Music artist context resolves to the same remembered-track key', () => {
  const raw = {
    artist: 'Droptek — Monstercat - Best of DnB & Drumstep',
    title: 'Rupture',
    album: 'Monstercat - Best of DnB & Drumstep'
  };
  const resolved = { artist: 'Droptek', title: 'Rupture', album: raw.album };
  assert.equal(correctionKey(raw), correctionKey(resolved));
});

test('legacy corrections with unclean Apple artist fields migrate on load', () => {
  const legacyKey = 'droptek — monstercat - best of dnb & drumstep::rupture';
  const legacy = {
    version: 1,
    tracks: {
      [legacyKey]: {
        genreId: 'drumstep',
        label: 'DRUMSTEP',
        artist: 'Droptek — Monstercat - Best of DnB & Drumstep',
        title: 'Rupture',
        updatedAt: '2026-08-27T15:03:05.874Z'
      }
    }
  };
  const correction = getGenreCorrection(legacy, { artist: 'Droptek', title: 'Rupture' });
  assert.equal(correction.genreId, 'drumstep');
  assert.equal(correction.key, 'droptek::rupture');
});
