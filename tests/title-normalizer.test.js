'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanDisplayTitle, lookupTitle } = require('../src/title-normalizer');
const { preferredAppleStorefront } = require('../src/genre-resolver');

test('display title keeps player translations while lookup title drops them', () => {
  const title = 'Blinding Lights (盲灯)';
  assert.equal(cleanDisplayTitle(title), title);
  assert.equal(lookupTitle(title), 'Blinding Lights');
});

test('lookup title removes Chinese source annotations in full-width brackets', () => {
  assert.equal(lookupTitle('BANGARANG（游戏《叛逆性百万亚瑟王》插曲）'), 'BANGARANG');
  assert.equal(lookupTitle('夜に駆ける【动画主题曲】'), '夜に駆ける');
  assert.equal(lookupTitle('夜に駆ける（奔向夜晚）'), '夜に駆ける');
});

test('lookup title preserves recording versions that affect matching', () => {
  assert.equal(lookupTitle('Levels (Live)'), 'Levels (Live)');
  assert.equal(lookupTitle('Shelter (Porter Robinson Remix)'), 'Shelter (Porter Robinson Remix)');
});

test('network country, rather than player identity, selects the Chinese Apple storefront', () => {
  assert.equal(preferredAppleStorefront({ source: 'AmazonMusic.exe' }, 'CN'), 'CN');
  assert.equal(preferredAppleStorefront({ source: 'QQMusic.exe' }, 'JP'), '');
  assert.equal(preferredAppleStorefront({ source: 'cloudmusic.exe' }, ''), '');
});
