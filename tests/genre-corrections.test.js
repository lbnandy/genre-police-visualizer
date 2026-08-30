'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clearGenreCorrection,
  correctionKey,
  correctionIdentity,
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

test('tracks without artists use source, title, and duration as a stable fallback identity', () => {
  const browserTrack = {
    source: 'chrome.exe',
    title: 'Example Video - 哔哩哔哩_bilibili',
    durationMs: 183420
  };
  const sameTrack = { ...browserTrack, durationMs: 183490 };
  const otherSource = { ...browserTrack, source: 'msedge.exe' };
  const otherDuration = { ...browserTrack, durationMs: 196000 };
  const identity = correctionIdentity(browserTrack);
  assert.equal(identity.fallback, true);
  assert.equal(correctionKey(browserTrack), correctionKey(sameTrack));
  assert.notEqual(correctionKey(browserTrack), correctionKey(otherSource));
  assert.notEqual(correctionKey(browserTrack), correctionKey(otherDuration));
});

test('browser suffixes do not change the remembered correction identity', () => {
  const browserTrack = {
    source: 'chrome.exe',
    title: 'Example Video - 哔哩哔哩_bilibili',
    durationMs: 183420
  };
  assert.equal(
    correctionKey(browserTrack),
    correctionKey({ ...browserTrack, title: 'Example Video' })
  );
});

test('a title-only correction can be saved, restored, and cleared', () => {
  const track = { source: 'LocalPlayer.exe', title: 'untagged-track.wav', durationMs: 92000 };
  const saved = setGenreCorrection({}, track, { id: 'ambient', label: 'AMBIENT' }, '2026-08-30T01:00:00.000Z');
  assert.equal(saved.changed, true);
  assert.equal(saved.correction.fallbackIdentity, true);
  assert.equal(getGenreCorrection(saved.state, track).genreId, 'ambient');
  const cleared = clearGenreCorrection(saved.state, track, '2026-08-30T01:01:00.000Z');
  assert.equal(cleared.changed, true);
  assert.equal(getGenreCorrection(cleared.state, track), null);
});

test('custom correction metadata is persisted with the track correction', () => {
  const track = { artist: 'Example Artist', title: 'Custom Genre Track' };
  const saved = setGenreCorrection({}, track, {
    id: 'custom:liquid-riddim',
    label: 'LIQUID RIDDIM',
    customGenreId: 'liquid-riddim',
    baseGenreId: 'riddim',
    colors: { accent: '#123456', accent2: '#abcdef', hot: '#fedcba' }
  });
  const correction = getGenreCorrection(saved.state, track);
  assert.equal(correction.customGenreId, 'liquid-riddim');
  assert.equal(correction.baseGenreId, 'riddim');
  assert.deepEqual(correction.colors, { accent: '#123456', accent2: '#abcdef', hot: '#fedcba' });
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
