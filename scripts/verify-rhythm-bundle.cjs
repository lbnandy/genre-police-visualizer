'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MODEL_FILE, MODEL_SHA256 } = require('../src/rhythm-config');

module.exports = function verifyRhythmBundle(context) {
  const root = context.appDir || path.resolve(__dirname, '..');
  const digest = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'assets', MODEL_FILE))).digest('hex');
  if (digest !== MODEL_SHA256) throw new Error('BeatNet+ model hash mismatch; refusing to package a different beat engine.');
};
