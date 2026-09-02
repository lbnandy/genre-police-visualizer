'use strict';

const fs = require('node:fs');

const MAX_MOOV_BYTES = 16 * 1024 * 1024;

function parseBox(buffer, offset, end = buffer.length) {
  if (offset < 0 || offset + 8 > end) return null;
  let size = buffer.readUInt32BE(offset);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > end) return null;
    const extendedSize = buffer.readBigUInt64BE(offset + 8);
    if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end) return null;
  return {
    offset,
    size,
    headerSize,
    type: buffer.toString('ascii', offset + 4, offset + 8)
  };
}

function childBoxes(buffer, parent) {
  const boxes = [];
  const end = parent.offset + parent.size;
  let offset = parent.offset + parent.headerSize;
  while (offset + 8 <= end) {
    const box = parseBox(buffer, offset, end);
    if (!box) break;
    boxes.push(box);
    offset += box.size;
  }
  return boxes;
}

function childBox(buffer, parent, type) {
  return childBoxes(buffer, parent).find((box) => box.type === type) || null;
}

function fullBoxLayout(buffer, box, type) {
  const payload = box.offset + box.headerSize;
  if (payload + 4 > box.offset + box.size) return null;
  const version = buffer[payload];
  if (type === 'mvhd' || type === 'mdhd') {
    return version === 1
      ? { version, timescaleOffset: payload + 20, durationOffset: payload + 24 }
      : { version, timescaleOffset: payload + 12, durationOffset: payload + 16 };
  }
  if (type === 'tkhd') {
    return version === 1
      ? { version, timescaleOffset: -1, durationOffset: payload + 28 }
      : { version, timescaleOffset: -1, durationOffset: payload + 20 };
  }
  return null;
}

function readTimescale(buffer, box, type) {
  const layout = fullBoxLayout(buffer, box, type);
  if (!layout || layout.timescaleOffset < 0 || layout.timescaleOffset + 4 > box.offset + box.size) return 0;
  return buffer.readUInt32BE(layout.timescaleOffset);
}

function writeDuration(buffer, box, type, timescale, durationMs) {
  const layout = fullBoxLayout(buffer, box, type);
  if (!layout || !(timescale > 0)) return false;
  const duration = Math.max(1, Math.round(durationMs * timescale / 1000));
  if (layout.version === 1) {
    if (layout.durationOffset + 8 > box.offset + box.size) return false;
    buffer.writeBigUInt64BE(BigInt(duration), layout.durationOffset);
  } else {
    if (layout.durationOffset + 4 > box.offset + box.size) return false;
    buffer.writeUInt32BE(Math.min(0xffffffff, duration), layout.durationOffset);
  }
  return true;
}

function patchMp4MoovDuration(moovBuffer, durationMs) {
  const duration = Number(durationMs);
  if (!Buffer.isBuffer(moovBuffer) || !(duration > 0)) return { patched: false, patchedBoxes: 0 };
  const moov = parseBox(moovBuffer, 0);
  if (!moov || moov.type !== 'moov') return { patched: false, patchedBoxes: 0 };
  const mvhd = childBox(moovBuffer, moov, 'mvhd');
  const movieTimescale = mvhd ? readTimescale(moovBuffer, mvhd, 'mvhd') : 0;
  if (!mvhd || !(movieTimescale > 0)) return { patched: false, patchedBoxes: 0 };

  let patchedBoxes = writeDuration(moovBuffer, mvhd, 'mvhd', movieTimescale, duration) ? 1 : 0;
  for (const trak of childBoxes(moovBuffer, moov).filter((box) => box.type === 'trak')) {
    const tkhd = childBox(moovBuffer, trak, 'tkhd');
    if (tkhd && writeDuration(moovBuffer, tkhd, 'tkhd', movieTimescale, duration)) patchedBoxes += 1;
    const mdia = childBox(moovBuffer, trak, 'mdia');
    const mdhd = mdia ? childBox(moovBuffer, mdia, 'mdhd') : null;
    const mediaTimescale = mdhd ? readTimescale(moovBuffer, mdhd, 'mdhd') : 0;
    if (mdhd && writeDuration(moovBuffer, mdhd, 'mdhd', mediaTimescale, duration)) patchedBoxes += 1;
  }
  return { patched: patchedBoxes > 0, patchedBoxes, movieTimescale };
}

function readFileBox(fd, offset, fileSize) {
  const header = Buffer.alloc(16);
  const bytesRead = fs.readSync(fd, header, 0, header.length, offset);
  if (bytesRead < 8) return null;
  let size = header.readUInt32BE(0);
  let headerSize = 8;
  if (size === 1) {
    if (bytesRead < 16) return null;
    const extendedSize = header.readBigUInt64BE(8);
    if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size === 0) {
    size = fileSize - offset;
  }
  if (size < headerSize || offset + size > fileSize) return null;
  return { offset, size, headerSize, type: header.toString('ascii', 4, 8) };
}

function findTopLevelBox(fd, fileSize, type) {
  let offset = 0;
  while (offset + 8 <= fileSize) {
    const box = readFileBox(fd, offset, fileSize);
    if (!box) return null;
    if (box.type === type) return box;
    offset += box.size;
  }
  return null;
}

function patchMp4DurationFile(filePath, durationMs) {
  const fd = fs.openSync(filePath, 'r+');
  try {
    const fileSize = fs.fstatSync(fd).size;
    const moov = findTopLevelBox(fd, fileSize, 'moov');
    if (!moov || moov.size > MAX_MOOV_BYTES) return { patched: false, patchedBoxes: 0 };
    const buffer = Buffer.alloc(moov.size);
    if (fs.readSync(fd, buffer, 0, buffer.length, moov.offset) !== buffer.length) {
      return { patched: false, patchedBoxes: 0 };
    }
    const result = patchMp4MoovDuration(buffer, durationMs);
    if (!result.patched) return result;
    fs.writeSync(fd, buffer, 0, buffer.length, moov.offset);
    fs.fsyncSync(fd);
    return result;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { patchMp4DurationFile, patchMp4MoovDuration };
