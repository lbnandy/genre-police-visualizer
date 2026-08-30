'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const monitorSource = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'now-playing.ps1'),
  'utf8'
);

test('media monitor reports whether NetEase is running even without an SMTC session', () => {
  assert.match(monitorSource, /Get-Process -Name 'cloudmusic'/);
  assert.match(monitorSource, /status = 'NoSession'.*neteaseRunning = \$neteaseRunning/);
  assert.match(monitorSource, /sources = @\(\$availableSources\)[\s\S]*neteaseRunning = \$neteaseRunning/);
});
