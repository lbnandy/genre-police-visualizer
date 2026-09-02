'use strict';

const fs = require('node:fs');
const ort = require('onnxruntime-node');
const {
  GenreDecisionTracker,
  HOP_SIZE,
  MEL_BANDS,
  MusiCnnMelExtractor,
  PATCH_FRAMES,
  PATCH_HOP,
  aggregateGenreScores,
  buildPatchTensor,
  meanActivationRows,
  medianActivationRows
} = require('./audio-genre-model');

const PATCH_SAMPLE_COUNT = PATCH_FRAMES * HOP_SIZE;
const PATCH_HOP_SAMPLES = PATCH_HOP * HOP_SIZE;
const RECENT_PATCH_COUNT = 6;
const SILENCE_RMS = 0.0015;

function patchRms(samples) {
  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) energy += samples[index] * samples[index];
  return Math.sqrt(energy / Math.max(1, samples.length));
}

function compactResult(result) {
  return {
    id: result.id,
    confidence: result.confidence,
    margin: result.margin,
    scores: result.scores,
    ranked: result.ranked.slice(0, 5),
    topLabels: result.topLabels?.slice(0, 5) || []
  };
}

class LocalAudioGenreModel {
  constructor({ modelPath, metadataPath, onEvent = () => {} } = {}) {
    this.modelPath = modelPath;
    this.metadataPath = metadataPath;
    this.onEvent = onEvent;
    this.session = null;
    this.classes = [];
    this.extractor = new MusiCnnMelExtractor();
    this.decisionTracker = new GenreDecisionTracker();
    this.serial = 0;
    this.inferenceBusy = false;
    this.queuedPatch = null;
    this.closed = false;
    this.reset('');
  }

  async initialize() {
    if (this.session || this.closed) return;
    const metadata = JSON.parse(await fs.promises.readFile(this.metadataPath, 'utf8'));
    if (!Array.isArray(metadata.classes) || metadata.classes.length !== 400) {
      throw new Error('Discogs-EffNet metadata must contain 400 classes');
    }
    this.classes = metadata.classes;
    const session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'all'
    });
    if (this.closed) {
      if (session?.release) await session.release();
      return;
    }
    this.session = session;
    this.onEvent({ type: 'ready', model: 'Discogs-EffNet', inputSeconds: 2.048, intervalSeconds: 0.992 });
    if (this.queuedPatch) {
      const queued = this.queuedPatch;
      this.queuedPatch = null;
      this.scheduleInference(queued.samples, queued.serial);
    }
  }

  reset(trackKey = '', context = {}) {
    this.serial += 1;
    this.trackKey = String(trackKey || '');
    this.ring = new Float32Array(PATCH_SAMPLE_COUNT);
    this.writeIndex = 0;
    this.totalSamples = 0;
    this.nextPatchAt = PATCH_SAMPLE_COUNT;
    this.runningSum = new Float64Array(400);
    this.activationRows = [];
    this.acceptedWindows = 0;
    this.queuedPatch = null;
    this.decisionTracker.reset(context);
    this.onEvent({ type: 'reset', trackKey: this.trackKey });
  }

  setContext(context = {}) {
    this.decisionTracker.setContext(context);
  }

  ingest(samples) {
    if (!this.trackKey || this.closed || !(samples instanceof Float32Array) || !samples.length) return;
    const serial = this.serial;
    for (let index = 0; index < samples.length; index += 1) {
      this.ring[this.writeIndex] = Number.isFinite(samples[index]) ? samples[index] : 0;
      this.writeIndex = (this.writeIndex + 1) % PATCH_SAMPLE_COUNT;
      this.totalSamples += 1;
      if (this.totalSamples < this.nextPatchAt) continue;
      const patch = this.snapshotPatch();
      this.nextPatchAt += PATCH_HOP_SAMPLES;
      this.scheduleInference(patch, serial);
    }
  }

  snapshotPatch() {
    const output = new Float32Array(PATCH_SAMPLE_COUNT);
    const firstLength = PATCH_SAMPLE_COUNT - this.writeIndex;
    output.set(this.ring.subarray(this.writeIndex), 0);
    output.set(this.ring.subarray(0, this.writeIndex), firstLength);
    return output;
  }

  scheduleInference(samples, serial) {
    if (serial !== this.serial || !this.trackKey) return;
    if (!this.session || this.inferenceBusy) {
      this.queuedPatch = { samples, serial };
      return;
    }
    this.inferenceBusy = true;
    this.runInference(samples, serial)
      .catch((error) => this.onEvent({ type: 'error', reason: error.message }))
      .finally(() => {
        this.inferenceBusy = false;
        if (!this.queuedPatch || this.closed) return;
        const queued = this.queuedPatch;
        this.queuedPatch = null;
        this.scheduleInference(queued.samples, queued.serial);
      });
  }

  async runInference(samples, serial) {
    const rms = patchRms(samples);
    if (rms < SILENCE_RMS) {
      this.onEvent({ type: 'silence', trackKey: this.trackKey, rms });
      return;
    }
    const mel = this.extractor.transform(samples);
    if (mel.frames < PATCH_FRAMES) return;
    const tensor = buildPatchTensor(mel, [Math.max(0, mel.frames - PATCH_FRAMES)]);
    const inputName = this.session.inputNames[0];
    const startedAt = performance.now();
    const outputs = await this.session.run({
      [inputName]: new ort.Tensor('float32', tensor, [1, PATCH_FRAMES, MEL_BANDS])
    });
    if (serial !== this.serial || this.closed) return;
    const activationName = this.session.outputNames.find((name) => /activation/i.test(name))
      || this.session.outputNames.find((name) => outputs[name]?.dims?.at(-1) === 400);
    if (!activationName) throw new Error('Discogs-EffNet activation output was not found');
    const row = Float32Array.from(outputs[activationName].data);
    if (row.length !== this.classes.length) throw new Error(`Unexpected activation count: ${row.length}`);

    this.acceptedWindows += 1;
    this.activationRows.push(row);
    if (this.activationRows.length > RECENT_PATCH_COUNT) this.activationRows.shift();
    for (let index = 0; index < row.length; index += 1) this.runningSum[index] += row[index];

    const shortRows = this.activationRows.slice(-3);
    const shortResult = aggregateGenreScores(medianActivationRows(shortRows), this.classes);
    const trackMean = Float32Array.from(
      this.runningSum,
      (value) => value / this.acceptedWindows
    );
    const trackResult = aggregateGenreScores(trackMean, this.classes);
    const segmentResult = aggregateGenreScores(meanActivationRows(this.activationRows), this.classes);
    const decision = this.decisionTracker.push({ shortResult, trackResult, segmentResult });

    this.onEvent({
      type: 'prediction',
      trackKey: this.trackKey,
      inferenceMs: performance.now() - startedAt,
      rms,
      decision,
      short: compactResult(shortResult),
      track: compactResult(trackResult),
      segment: compactResult(segmentResult)
    });
  }

  async close() {
    this.closed = true;
    this.serial += 1;
    this.queuedPatch = null;
    const session = this.session;
    this.session = null;
    if (session?.release) await session.release();
  }
}

module.exports = {
  LocalAudioGenreModel,
  PATCH_HOP_SAMPLES,
  PATCH_SAMPLE_COUNT,
  RECENT_PATCH_COUNT,
  SILENCE_RMS,
  patchRms
};
