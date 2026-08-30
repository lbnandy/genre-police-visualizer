'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  customGenreCorrectionId,
  findCustomGenreByCorrectionId,
  matchCustomGenre,
  normalizeCustomGenreRules,
  normalizeHexColor,
  normalizeThemeColors,
  normalizeTerms
} = require('../src/custom-genres');
const { GenreResolver } = require('../src/genre-resolver');

const rules = [{
  id: 'liquid-riddim',
  name: 'Liquid Riddim',
  aliases: ['liquid riddim', 'melodic riddim'],
  artists: ['Example Producer'],
  baseGenreId: 'riddim'
}];

test('normalizes custom genre rules and rejects unusable or unknown visual bases', () => {
  assert.deepEqual(normalizeTerms(' Liquid Riddim, liquid riddim，Melodic Riddim '), [
    'Liquid Riddim',
    'Melodic Riddim'
  ]);
  assert.deepEqual(normalizeCustomGenreRules([
    rules[0],
    { id: 'empty', name: 'Empty', aliases: [], artists: [], baseGenreId: 'riddim' },
    { id: 'invalid', name: 'Invalid', aliases: ['invalid'], baseGenreId: 'missing-theme' }
  ], ['riddim']), rules);
});

test('normalizes complete custom theme colors and rejects partial palettes', () => {
  assert.equal(normalizeHexColor('#AbC'), '#aabbcc');
  assert.deepEqual(normalizeThemeColors({
    accent: '#12abef',
    accent2: '#F06',
    hot: '#ffffff'
  }), {
    accent: '#12abef',
    accent2: '#ff0066',
    hot: '#ffffff'
  });
  assert.equal(normalizeThemeColors({ accent: '#123456', accent2: '#abcdef' }), null);
});

test('matches a custom genre by exact tag or credited artist', () => {
  assert.equal(matchCustomGenre(rules, { tags: ['Melodic Riddim'] }).rule.id, 'liquid-riddim');
  assert.equal(matchCustomGenre(rules, { artist: 'Example Producer feat. Guest' }).matchedBy, 'artist');
  assert.equal(matchCustomGenre(rules, { tags: ['Riddim'] }), null);
});

test('custom genres have stable correction ids that resolve back to their rule', () => {
  const correctionId = customGenreCorrectionId(rules[0].id);
  assert.equal(correctionId, 'custom:liquid-riddim');
  assert.equal(findCustomGenreByCorrectionId(rules, correctionId), rules[0]);
  assert.equal(findCustomGenreByCorrectionId(rules, 'riddim'), null);
});

test('a direct custom rule bypasses network lookup and reuses its visual theme', async () => {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('custom metadata should resolve locally');
  };
  try {
    const resolver = new GenreResolver({ getConfig: () => ({ customGenres: rules }) });
    const result = await resolver.resolve({
      title: 'Example Track',
      artist: 'Someone',
      genres: ['Liquid Riddim']
    });
    assert.equal(result.genre.id, 'riddim');
    assert.equal(result.genre.label, 'LIQUID RIDDIM');
    assert.equal(result.genreSource, 'custom genre rule');
    assert.equal(result.customGenreRule.id, 'liquid-riddim');
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a custom rule can override all three inherited theme colors', async () => {
  const coloredRule = {
    ...rules[0],
    colors: { accent: '#123456', accent2: '#abcdef', hot: '#fedcba' }
  };
  const resolver = new GenreResolver({
    getConfig: () => ({ customGenres: [coloredRule], onlineGenreLookupEnabled: false })
  });
  const result = await resolver.resolve({
    title: 'Example Track',
    artist: 'Example Producer'
  });
  assert.equal(result.genre.accent, '#123456');
  assert.equal(result.genre.accent2, '#abcdef');
  assert.equal(result.genre.hot, '#fedcba');
  assert.equal(result.genre.genreInk, '');
});

test('a per-track correction remains authoritative over a custom rule', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({ customGenres: rules }),
    getCorrection: () => ({ genreId: 'trance', label: 'TRANCE' })
  });
  const result = await resolver.resolve({
    title: 'Example Track',
    artist: 'Example Producer',
    genres: ['Liquid Riddim']
  });
  assert.equal(result.genre.id, 'trance');
  assert.equal(result.genreSource, 'user correction');
});

test('a per-track correction can select a custom genre and retain its visual theme', async () => {
  const coloredRule = {
    ...rules[0],
    colors: { accent: '#123456', accent2: '#abcdef', hot: '#fedcba' }
  };
  const resolver = new GenreResolver({
    getConfig: () => ({ customGenres: [coloredRule] }),
    getCorrection: () => ({
      genreId: 'custom:liquid-riddim',
      label: 'LIQUID RIDDIM',
      customGenreId: 'liquid-riddim',
      baseGenreId: 'riddim'
    })
  });
  const result = await resolver.resolve({ title: 'Corrected Track', artist: 'Someone Else' });
  assert.equal(result.genre.id, 'riddim');
  assert.equal(result.genre.label, 'LIQUID RIDDIM');
  assert.equal(result.genre.accent, '#123456');
  assert.equal(result.userGenreCorrection.genreId, 'custom:liquid-riddim');
});
