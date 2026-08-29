'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  messages,
  normalizeLocale,
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

test('active interface copy does not describe mouse passthrough as a desktop pet mode', () => {
  const interfaceCopy = JSON.stringify(messages);
  assert.doesNotMatch(
    interfaceCopy,
    /桌宠|desktop[- ]companion|desktop mascot|デスクトップマスコット|데스크톱 컴패니언/i
  );
});

test('translation interpolates values and falls back safely', () => {
  assert.equal(translate('en', 'tray.currentTrack', { title: 'Track' }), 'Current track: Track');
  assert.equal(translate('ja', 'tray.currentTrack', { title: '曲' }), '現在の曲：曲');
  assert.equal(translate('ko', 'tray.currentTrack', { title: '노래' }), '현재 곡: 노래');
  assert.equal(translate('xx', 'controls.play'), '播放');
  assert.equal(translate('en', 'missing.key'), 'missing.key');
});
