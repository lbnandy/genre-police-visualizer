'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  messages,
  normalizeLocale,
  resolveInitialLocale,
  translate
} = require('../src/i18n');

test('supports Chinese, English, Japanese, and Korean with a stable Chinese default', () => {
  assert.equal(DEFAULT_LOCALE, 'zh-CN');
  assert.deepEqual(SUPPORTED_LOCALES, ['zh-CN', 'en', 'ja', 'ko']);
  assert.equal(normalizeLocale('zh-TW'), 'zh-CN');
  assert.equal(normalizeLocale('en-US'), 'en');
  assert.equal(normalizeLocale('ja-JP'), 'ja');
  assert.equal(normalizeLocale('ko-KR'), 'ko');
  assert.equal(normalizeLocale('unsupported'), 'zh-CN');
});

test('every interface locale contains the same translation keys', () => {
  const expected = Object.keys(messages[DEFAULT_LOCALE]).sort();
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), expected, `missing translation in ${locale}`);
  }
});

test('first launch follows a supported system language and otherwise uses English', () => {
  assert.equal(resolveInitialLocale('', 'zh-CN'), 'zh-CN');
  assert.equal(resolveInitialLocale('', 'en-US'), 'en');
  assert.equal(resolveInitialLocale('', 'ja-JP'), 'ja');
  assert.equal(resolveInitialLocale('', 'ko-KR'), 'ko');
  assert.equal(resolveInitialLocale('', 'fr-FR'), 'en');
  assert.equal(resolveInitialLocale('ja', 'fr-FR'), 'ja');
  assert.equal(resolveInitialLocale('unsupported', 'zh-CN'), 'en');
});

test('active interface copy does not describe mouse passthrough as a desktop pet mode', () => {
  const interfaceCopy = JSON.stringify(messages);
  assert.doesNotMatch(
    interfaceCopy,
    /桌宠|desktop[- ]companion|desktop mascot|デスクトップマスコット|데스크톱 컴패니언/i
  );
});

test('Chinese music metadata consistently uses 艺术家', () => {
  const musicMetadataCopy = Object.entries(messages['zh-CN'])
    .filter(([key]) => /^(?:settings|diagnostics|genreData)\./.test(key))
    .map(([, value]) => value)
    .join('\n');
  assert.match(musicMetadataCopy, /艺术家/);
  assert.doesNotMatch(musicMetadataCopy, /作者|艺人|歌手/);
});

test('translation interpolates values and falls back safely', () => {
  assert.equal(translate('en', 'tray.currentTrack', { title: 'Track' }), 'Current track: Track');
  assert.equal(translate('ja', 'tray.currentTrack', { title: '曲' }), '現在の曲：曲');
  assert.equal(translate('ko', 'tray.currentTrack', { title: '노래' }), '현재 곡: 노래');
  assert.equal(translate('xx', 'controls.play'), '播放');
  assert.equal(translate('en', 'missing.key'), 'missing.key');
});

test('the English idle headline stays short enough for the capsule', () => {
  assert.equal(translate('en', 'hud.awaitingSignal'), 'NO SIGNAL');
});
