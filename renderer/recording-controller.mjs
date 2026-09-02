const RECORDING_FORMATS = Object.freeze([
  Object.freeze({ extension: 'mp4', mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' }),
  Object.freeze({ extension: 'mp4', mimeType: 'video/mp4;codecs=avc1.42001E,mp4a.40.2' }),
  Object.freeze({ extension: 'mp4', mimeType: 'video/mp4;codecs=avc1,mp4a.40.2' }),
  Object.freeze({ extension: 'mp4', mimeType: 'video/mp4' }),
  Object.freeze({ extension: 'webm', mimeType: 'video/webm;codecs=vp9,opus' }),
  Object.freeze({ extension: 'webm', mimeType: 'video/webm;codecs=vp8,opus' }),
  Object.freeze({ extension: 'webm', mimeType: 'video/webm' })
]);

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function supportedRecordingFormats(MediaRecorderType) {
  if (!MediaRecorderType) return [];
  return RECORDING_FORMATS.filter((format) => {
    try {
      return MediaRecorderType.isTypeSupported(format.mimeType);
    } catch {
      return false;
    }
  });
}

export function createRecordingEncoder(stream, MediaRecorderType) {
  const options = {
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000
  };
  for (const format of supportedRecordingFormats(MediaRecorderType)) {
    try {
      const recorder = new MediaRecorderType(stream, { ...options, mimeType: format.mimeType });
      return { recorder, format };
    } catch {}
  }
  try {
    const recorder = new MediaRecorderType(stream, options);
    const mimeType = String(recorder.mimeType || 'video/webm');
    return {
      recorder,
      format: { extension: mimeType.includes('mp4') ? 'mp4' : 'webm', mimeType }
    };
  } catch {
    return null;
  }
}

export class VisualizationRecorder {
  constructor({
    bridge,
    audioTrackProvider,
    presentationChanged,
    stateChanged,
    MediaRecorderType = window.MediaRecorder,
    MediaStreamType = window.MediaStream,
    mediaDevices = navigator.mediaDevices
  }) {
    this.bridge = bridge;
    this.audioTrackProvider = audioTrackProvider;
    this.presentationChanged = presentationChanged;
    this.stateChanged = stateChanged;
    this.MediaRecorderType = MediaRecorderType;
    this.MediaStreamType = MediaStreamType;
    this.mediaDevices = mediaDevices;
    this.state = 'idle';
    this.recorder = null;
    this.stream = null;
    this.videoStream = null;
    this.audioTrack = null;
    this.sessionId = '';
    this.filePath = '';
    this.format = null;
    this.writeQueue = Promise.resolve();
    this.writeError = null;
    this.stopPromise = null;
    this.resolveStop = null;
    this.recordingStartedAt = 0;
    this.recordingDurationMs = 0;
  }

  setState(state, detail = {}) {
    this.state = state;
    this.stateChanged?.({ state, ...detail });
  }

  async start() {
    if (this.state !== 'idle') return { ok: false, error: 'busy' };
    if (!this.MediaRecorderType || !this.mediaDevices?.getDisplayMedia) {
      this.setState('idle', { error: 'unsupported' });
      return { ok: false, error: 'unsupported' };
    }
    const audioTrack = this.audioTrackProvider?.();
    if (!audioTrack) {
      this.setState('idle', { error: 'audio-unavailable' });
      return { ok: false, error: 'audio-unavailable' };
    }
    this.audioTrack = audioTrack;
    audioTrack.addEventListener('ended', () => {
      if (this.state === 'recording' && this.recorder?.state === 'recording') void this.stop();
    }, { once: true });

    this.setState('preparing');
    let presentationActive = false;
    try {
      this.videoStream = await this.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          frameRate: 60,
          ...(this.mediaDevices.getSupportedConstraints?.().cursor ? { cursor: 'never' } : {})
        }
      });
      const videoTrack = this.videoStream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('video-unavailable');
      try {
        videoTrack.contentHint = 'motion';
      } catch {}
      videoTrack.addEventListener('ended', () => {
        if (this.state === 'recording' && this.recorder?.state === 'recording') void this.stop();
      }, { once: true });

      this.stream = new this.MediaStreamType([videoTrack, audioTrack]);
      const encoder = createRecordingEncoder(this.stream, this.MediaRecorderType);
      if (!encoder) throw new Error('unsupported');
      this.recorder = encoder.recorder;
      this.format = encoder.format;

      const prepared = await this.bridge.prepareRecording({
        extension: this.format.extension,
        mimeType: this.format.mimeType
      });
      if (!prepared?.ok) {
        this.disposeStreams();
        this.resetSession();
        this.setState('idle', prepared?.canceled ? { canceled: true } : { error: prepared?.error || 'prepare-failed' });
        return prepared || { ok: false, error: 'prepare-failed' };
      }

      this.presentationChanged?.(true);
      presentationActive = true;
      await wait(180);
      this.sessionId = prepared.id;
      this.filePath = prepared.filePath;
      this.writeQueue = Promise.resolve();
      this.writeError = null;
      this.stopPromise = new Promise((resolve) => {
        this.resolveStop = resolve;
      });
      this.recorder.addEventListener('dataavailable', (event) => this.queueChunk(event.data));
      this.recorder.addEventListener('error', (event) => {
        this.writeError ||= event.error || new Error('encoder-failed');
        if (this.state === 'recording' && this.recorder?.state === 'recording') void this.stop();
      });
      this.recorder.addEventListener('stop', () => void this.finalize());
      if (videoTrack.readyState !== 'live') throw new Error('video-unavailable');
      if (audioTrack.readyState !== 'live') throw new Error('audio-unavailable');
      this.recorder.start(1000);
      this.recordingStartedAt = performance.now();
      this.setState('recording', { filePath: this.filePath, format: this.format });
      return { ok: true, filePath: this.filePath, format: this.format };
    } catch (error) {
      if (this.sessionId) {
        await this.bridge.cancelRecording({ id: this.sessionId }).catch(() => {});
      }
      this.disposeStreams();
      if (presentationActive) this.presentationChanged?.(false);
      const reason = ['unsupported', 'video-unavailable', 'audio-unavailable'].includes(error?.message)
        ? error.message
        : 'capture-failed';
      this.resetSession();
      this.setState('idle', { error: reason });
      return { ok: false, error: reason };
    }
  }

  queueChunk(blob) {
    if (!blob?.size || !this.sessionId) return;
    this.writeQueue = this.writeQueue.then(async () => {
      if (this.writeError) return;
      const chunk = await blob.arrayBuffer();
      const result = await this.bridge.appendRecordingChunk({ id: this.sessionId, chunk });
      if (!result?.ok) throw new Error(result?.error || 'write-failed');
    }).catch((error) => {
      this.writeError ||= error;
      if (this.state === 'recording' && this.recorder?.state === 'recording') void this.stop();
    });
  }

  async stop() {
    if (this.state === 'stopping') return this.stopPromise;
    if (this.state !== 'recording' || !this.recorder) return { ok: false, error: 'not-recording' };
    this.setState('stopping', { filePath: this.filePath, format: this.format });
    this.recordingDurationMs = Math.max(1, performance.now() - this.recordingStartedAt);
    this.recorder.stop();
    return this.stopPromise;
  }

  async finalize() {
    let result;
    try {
      await this.writeQueue;
      if (this.writeError) throw this.writeError;
      result = await this.bridge.finishRecording({
        id: this.sessionId,
        durationMs: this.recordingDurationMs
      });
      if (!result?.ok) throw new Error(result?.error || 'finalize-failed');
    } catch (error) {
      await this.bridge.cancelRecording({ id: this.sessionId }).catch(() => {});
      result = { ok: false, error: error?.message || 'recording-failed' };
    }
    this.disposeStreams();
    this.presentationChanged?.(false);
    const detail = result.ok
      ? { result, filePath: result.filePath, format: this.format }
      : { error: result.error || 'recording-failed' };
    const resolveStop = this.resolveStop;
    this.resetSession();
    this.setState('idle', detail);
    resolveStop?.(result);
  }

  disposeStreams() {
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.videoStream?.getTracks?.().forEach((track) => track.stop());
    this.audioTrack?.stop?.();
    this.stream = null;
    this.videoStream = null;
    this.audioTrack = null;
  }

  resetSession() {
    this.recorder = null;
    this.sessionId = '';
    this.filePath = '';
    this.format = null;
    this.writeQueue = Promise.resolve();
    this.writeError = null;
    this.stopPromise = null;
    this.resolveStop = null;
    this.recordingStartedAt = 0;
    this.recordingDurationMs = 0;
  }
}
