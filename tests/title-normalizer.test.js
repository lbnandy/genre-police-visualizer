'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanDisplayTitle,
  cleanedBilibiliPlayerSuffix,
  lookupTitle,
  playerTitleInfo
} = require('../src/title-normalizer');
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

test('display title removes common browser player suffixes', () => {
  assert.equal(cleanDisplayTitle('Example Video - 哔哩哔哩_bilibili'), 'Example Video');
  assert.equal(cleanDisplayTitle('Shelter - YouTube'), 'Shelter');
  assert.equal(cleanDisplayTitle('Language | YouTube Music'), 'Language');
  assert.equal(cleanDisplayTitle('Levels - 网易云音乐'), 'Levels');
  assert.equal(cleanDisplayTitle('Track - Artist - SoundCloud'), 'Track - Artist');
});

test('records a Bilibili suffix only when it was actually removed from a usable title', () => {
  assert.deepEqual(playerTitleInfo('Example Video - 哔哩哔哩_bilibili'), {
    title: 'Example Video',
    removedSources: ['bilibili']
  });
  assert.equal(cleanedBilibiliPlayerSuffix('Example Video | bilibili'), true);
  assert.equal(cleanedBilibiliPlayerSuffix('bilibili'), false);
  assert.equal(cleanedBilibiliPlayerSuffix('BILIBILI RADIO'), false);
  assert.equal(cleanedBilibiliPlayerSuffix('bilibili creator - YouTube'), false);
});

test('network country, rather than player identity, selects the Chinese Apple storefront', () => {
  assert.equal(preferredAppleStorefront({ source: 'AmazonMusic.exe' }, 'CN'), 'CN');
  assert.equal(preferredAppleStorefront({ source: 'QQMusic.exe' }, 'JP'), '');
  assert.equal(preferredAppleStorefront({ source: 'cloudmusic.exe' }, ''), '');
});
