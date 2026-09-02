'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('recording format selection prefers MP4 and keeps WebM fallbacks', async () => {
  const { supportedRecordingFormats } = await import('../renderer/recording-controller.mjs');
  class MockRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === 'video/mp4' || mimeType === 'video/webm;codecs=vp8,opus';
    }
  }
  const formats = supportedRecordingFormats(MockRecorder);
  assert.deepEqual(formats, [
    { extension: 'mp4', mimeType: 'video/mp4' },
    { extension: 'webm', mimeType: 'video/webm;codecs=vp8,opus' }
  ]);
});

test('encoder falls back when a reported MP4 configuration cannot be constructed', async () => {
  const { createRecordingEncoder } = await import('../renderer/recording-controller.mjs');
  class MockRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === 'video/mp4' || mimeType === 'video/webm;codecs=vp8,opus';
    }

    constructor(_stream, options) {
      if (options.mimeType === 'video/mp4') throw new Error('unavailable');
      this.mimeType = options.mimeType;
    }
  }
  const stream = {};
  const result = createRecordingEncoder(stream, MockRecorder);
  assert.equal(result.format.extension, 'webm');
  assert.equal(result.format.mimeType, 'video/webm;codecs=vp8,opus');
  assert.equal(result.recorder.mimeType, 'video/webm;codecs=vp8,opus');
});

test('encoder uses the runtime default when MIME probing finds no candidate', async () => {
  const { createRecordingEncoder } = await import('../renderer/recording-controller.mjs');
  class MockRecorder {
    static isTypeSupported() {
      return false;
    }

    constructor(_stream, options) {
      this.options = options;
      this.mimeType = 'video/webm';
    }
  }
  const result = createRecordingEncoder({}, MockRecorder);
  assert.equal(result.format.extension, 'webm');
  assert.equal(result.format.mimeType, 'video/webm');
  assert.equal(result.recorder.options.videoBitsPerSecond, 10_000_000);
  assert.equal(result.recorder.options.audioBitsPerSecond, 192_000);
});

test('recording lifecycle streams chunks before atomically finishing the session', async () => {
  const previousWindow = global.window;
  global.window = { setTimeout: (callback) => setTimeout(callback, 0) };
  try {
    const { VisualizationRecorder } = await import('../renderer/recording-controller.mjs');
    class MockTrack extends EventTarget {
      constructor(kind) {
        super();
        this.kind = kind;
        this.readyState = 'live';
      }

      stop() {
        this.readyState = 'ended';
      }
    }
    class MockStream {
      constructor(tracks) {
        this.tracks = tracks;
      }

      getTracks() { return this.tracks; }
      getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
    }
    class MockRecorder extends EventTarget {
      static isTypeSupported(mimeType) {
        return mimeType === 'video/mp4';
      }

      constructor() {
        super();
        this.state = 'inactive';
        this.mimeType = 'video/mp4';
      }

      start(interval) {
        this.interval = interval;
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        queueMicrotask(() => {
          const dataEvent = new Event('dataavailable');
          dataEvent.data = new Blob(['recorded-bytes'], { type: 'video/mp4' });
          this.dispatchEvent(dataEvent);
          this.dispatchEvent(new Event('stop'));
        });
      }
    }

    const audioTrack = new MockTrack('audio');
    const videoTrack = new MockTrack('video');
    const writes = [];
    const finishes = [];
    const states = [];
    const presentations = [];
    const recorder = new VisualizationRecorder({
      bridge: {
        prepareRecording: async () => ({ ok: true, id: 'session-1', filePath: 'output.mp4' }),
        appendRecordingChunk: async (payload) => {
          writes.push(payload);
          return { ok: true };
        },
        finishRecording: async (payload) => {
          finishes.push(payload);
          return { ok: true, filePath: 'output.mp4' };
        },
        cancelRecording: async () => ({ ok: true })
      },
      audioTrackProvider: () => audioTrack,
      presentationChanged: (active) => presentations.push(active),
      stateChanged: (state) => states.push(state.state),
      MediaRecorderType: MockRecorder,
      MediaStreamType: MockStream,
      mediaDevices: {
        getSupportedConstraints: () => ({}),
        getDisplayMedia: async () => new MockStream([videoTrack])
      }
    });

    const started = await recorder.start();
    assert.equal(started.ok, true);
    assert.equal(recorder.recorder.interval, 1000);
    const stopped = await recorder.stop();
    assert.equal(stopped.ok, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, 'session-1');
    assert.ok(writes[0].chunk.byteLength > 0);
    assert.equal(finishes[0].id, 'session-1');
    assert.ok(finishes[0].durationMs > 0);
    assert.deepEqual(presentations, [true, false]);
    assert.deepEqual(states, ['preparing', 'recording', 'stopping', 'idle']);
    assert.equal(audioTrack.readyState, 'ended');
    assert.equal(videoTrack.readyState, 'ended');
  } finally {
    global.window = previousWindow;
  }
});
