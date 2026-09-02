'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { patchMp4MoovDuration } = require('../src/recording-container');

function box(type, payload) {
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(result.length, 0);
  result.write(type, 4, 4, 'ascii');
  payload.copy(result, 8);
  return result;
}

function versionOneHeader(length) {
  const payload = Buffer.alloc(length);
  payload[0] = 1;
  return payload;
}

test('MP4 finalization writes movie and track duration headers without remuxing media', () => {
  const mvhdPayload = versionOneHeader(32);
  mvhdPayload.writeUInt32BE(1000, 20);
  const tkhdPayload = versionOneHeader(36);
  const videoMdhdPayload = versionOneHeader(32);
  videoMdhdPayload.writeUInt32BE(60000, 20);
  const audioMdhdPayload = versionOneHeader(32);
  audioMdhdPayload.writeUInt32BE(48000, 20);

  const mvhd = box('mvhd', mvhdPayload);
  const videoTkhd = box('tkhd', tkhdPayload);
  const videoMdhd = box('mdhd', videoMdhdPayload);
  const audioTkhd = box('tkhd', Buffer.from(tkhdPayload));
  const audioMdhd = box('mdhd', audioMdhdPayload);
  const videoTrak = box('trak', Buffer.concat([videoTkhd, box('mdia', videoMdhd)]));
  const audioTrak = box('trak', Buffer.concat([audioTkhd, box('mdia', audioMdhd)]));
  const moov = box('moov', Buffer.concat([mvhd, videoTrak, audioTrak]));

  const result = patchMp4MoovDuration(moov, 2500);
  assert.equal(result.patched, true);
  assert.equal(result.patchedBoxes, 5);
  assert.equal(moov.readBigUInt64BE(8 + 8 + 24), 2500n);

  const videoTrakOffset = 8 + mvhd.length;
  const videoTkhdDurationOffset = videoTrakOffset + 8 + 8 + 28;
  const videoMdhdOffset = videoTrakOffset + 8 + videoTkhd.length + 8;
  const videoMdhdDurationOffset = videoMdhdOffset + 8 + 24;
  assert.equal(moov.readBigUInt64BE(videoTkhdDurationOffset), 2500n);
  assert.equal(moov.readBigUInt64BE(videoMdhdDurationOffset), 150000n);

  const audioTrakOffset = videoTrakOffset + videoTrak.length;
  const audioMdhdOffset = audioTrakOffset + 8 + audioTkhd.length + 8;
  const audioMdhdDurationOffset = audioMdhdOffset + 8 + 24;
  assert.equal(moov.readBigUInt64BE(audioMdhdDurationOffset), 120000n);
});
