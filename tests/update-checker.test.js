'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  UPDATE_CHECK_INTERVAL_MS,
  canonicalVersion,
  compareVersions,
  isAllowedReleaseUrl,
  isUpdateCheckDue,
  sameVersion,
  selectLatestUpdate
} = require('../src/update-checker');

test('compares semantic versions instead of sorting version strings', () => {
  assert.ok(compareVersions('0.10.0', '0.9.9') > 0);
  assert.ok(compareVersions('v1.0.0', '0.99.99') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.0-beta.4') > 0);
  assert.ok(compareVersions('1.0.0-beta.10', '1.0.0-beta.2') > 0);
  assert.equal(compareVersions('v0.2.0+portable', '0.2.0'), 0);
  assert.equal(compareVersions('not-a-version', '0.2.0'), null);
  assert.equal(canonicalVersion(' 0.3.0-beta.1 '), 'v0.3.0-beta.1');
  assert.equal(sameVersion('v0.2.0', '0.2.0'), true);
});

test('selects the newest valid non-draft release, including beta releases', () => {
  const latest = selectLatestUpdate([
    {
      tag_name: 'v0.2.1',
      name: '0.2.1',
      html_url: 'https://github.com/lbnandy/genre-police-visualizer/releases/tag/v0.2.1',
      draft: false,
      prerelease: false
    },
    {
      tag_name: 'v0.3.0-beta.2',
      name: '0.3.0 Beta 2',
      html_url: 'https://github.com/lbnandy/genre-police-visualizer/releases/tag/v0.3.0-beta.2',
      draft: false,
      prerelease: true
    },
    {
      tag_name: 'v9.0.0',
      html_url: 'https://github.com/lbnandy/genre-police-visualizer/releases/tag/v9.0.0',
      draft: true
    },
    {
      tag_name: 'v10.0.0',
      html_url: 'https://example.com/malicious',
      draft: false
    }
  ], '0.2.0');

  assert.deepEqual(latest, {
    version: 'v0.3.0-beta.2',
    name: '0.3.0 Beta 2',
    url: 'https://github.com/lbnandy/genre-police-visualizer/releases/tag/v0.3.0-beta.2',
    prerelease: true
  });
  assert.equal(selectLatestUpdate([], '0.2.0'), null);
  assert.equal(selectLatestUpdate([{ tag_name: 'v0.1.0', html_url: 'https://github.com/lbnandy/genre-police-visualizer/releases/tag/v0.1.0' }], '0.2.0'), null);
});

test('limits update links to this project GitHub releases', () => {
  assert.equal(isAllowedReleaseUrl('https://github.com/lbnandy/genre-police-visualizer/releases'), true);
  assert.equal(isAllowedReleaseUrl('https://github.com/lbnandy/genre-police-visualizer/releases/tag/v0.3.0'), true);
  assert.equal(isAllowedReleaseUrl('http://github.com/lbnandy/genre-police-visualizer/releases'), false);
  assert.equal(isAllowedReleaseUrl('https://github.com/someone/genre-police-visualizer/releases'), false);
  assert.equal(isAllowedReleaseUrl('https://example.com/lbnandy/genre-police-visualizer/releases'), false);
});

test('automatic update checks run at most once per day', () => {
  const now = Date.UTC(2026, 8, 1, 12, 0, 0);
  assert.equal(isUpdateCheckDue(undefined, now), true);
  assert.equal(isUpdateCheckDue(now - UPDATE_CHECK_INTERVAL_MS + 1, now), false);
  assert.equal(isUpdateCheckDue(now - UPDATE_CHECK_INTERVAL_MS, now), true);
  assert.equal(isUpdateCheckDue(now + 60 * 60 * 1000, now), true);
});
