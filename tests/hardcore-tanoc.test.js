'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HARDCORE_TANOC_MEMBERS,
  isHardcoreTanocArtist
} = require('../src/hardcore-tanoc');

test('uses the 18 current artists listed as HARDCORE TANO*C CREW', () => {
  assert.equal(HARDCORE_TANOC_MEMBERS.length, 18);
  for (const artist of HARDCORE_TANOC_MEMBERS) assert.equal(isHardcoreTanocArtist(artist), true, artist);
});

test('recognizes crew members inside common multi-artist credits and Japanese aliases', () => {
  assert.equal(isHardcoreTanocArtist('USAO & DJ Nanashi'), true);
  assert.equal(isHardcoreTanocArtist('DJ Myosuke feat. DELUTAYA'), true);
  assert.equal(isHardcoreTanocArtist('レッドアリス'), true);
  assert.equal(isHardcoreTanocArtist('源屋'), true);
  assert.equal(isHardcoreTanocArtist('TANO*C ALL STARS'), true);
});

test('does not confuse guest artists or similar substrings with crew members', () => {
  assert.equal(isHardcoreTanocArtist('Camellia'), false);
  assert.equal(isHardcoreTanocArtist('C-Show'), false);
  assert.equal(isHardcoreTanocArtist('AronChupa'), false);
  assert.equal(isHardcoreTanocArtist('Lauryn Hill'), false);
});
