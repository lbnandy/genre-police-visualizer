'use strict';

const { performance } = require('node:perf_hooks');

const SAMPLE_RATE = 22050;
const HOP_SIZE = 441;
const FRAME_SIZE = 1411;
const MODEL_BANDS = 136;
const MODEL_INPUTS = MODEL_BANDS * 2;
const HIDDEN_SIZE = 150;
const HIDDEN_VALUES = 2 * HIDDEN_SIZE;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) * 0.5;
}

function softmax3(values) {
  const maximum = Math.max(values[0], values[1], values[2]);
  const first = Math.exp(values[0] - maximum);
  const second = Math.exp(values[1] - maximum);
  const third = Math.exp(values[2] - maximum);
  const total = first + second + third;
  return [first / total, second / total, third / total];
}

function fftRadix2(real, imaginary, inverse = false) {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      const realValue = real[index];
      const imaginaryValue = imaginary[index];
      real[index] = real[reversed];
      imaginary[index] = imaginary[reversed];
      real[reversed] = realValue;
      imaginary[reversed] = imaginaryValue;
    }
  }

  for (let length = 2; length <= size; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    const half = length >> 1;
    for (let offset = 0; offset < size; offset += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let position = 0; position < half; position += 1) {
        const even = offset + position;
        const odd = even + half;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }

  if (inverse) {
    for (let index = 0; index < size; index += 1) {
      real[index] /= size;
      imaginary[index] /= size;
    }
  }
}

class BluesteinRealFft {
  constructor(size) {
    this.size = size;
    this.convolutionSize = 1;
    while (this.convolutionSize < size * 2 - 1) this.convolutionSize <<= 1;
    this.chirpReal = new Float64Array(size);
    this.chirpImaginary = new Float64Array(size);
    this.kernelReal = new Float64Array(this.convolutionSize);
    this.kernelImaginary = new Float64Array(this.convolutionSize);
    this.workReal = new Float64Array(this.convolutionSize);
    this.workImaginary = new Float64Array(this.convolutionSize);
    for (let index = 0; index < size; index += 1) {
      const angle = Math.PI * ((index * index) % (size * 2)) / size;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      this.chirpReal[index] = cosine;
      this.chirpImaginary[index] = -sine;
      this.kernelReal[index] = cosine;
      this.kernelImaginary[index] = sine;
      if (index) {
        this.kernelReal[this.convolutionSize - index] = cosine;
        this.kernelImaginary[this.convolutionSize - index] = sine;
      }
    }
    fftRadix2(this.kernelReal, this.kernelImaginary);
  }

  magnitude(input, outputBins = Math.floor(this.size / 2)) {
    this.workReal.fill(0);
    this.workImaginary.fill(0);
    for (let index = 0; index < this.size; index += 1) {
      this.workReal[index] = input[index] * this.chirpReal[index];
      this.workImaginary[index] = input[index] * this.chirpImaginary[index];
    }
    fftRadix2(this.workReal, this.workImaginary);
    for (let index = 0; index < this.convolutionSize; index += 1) {
      const real = this.workReal[index] * this.kernelReal[index]
        - this.workImaginary[index] * this.kernelImaginary[index];
      const imaginary = this.workReal[index] * this.kernelImaginary[index]
        + this.workImaginary[index] * this.kernelReal[index];
      this.workReal[index] = real;
      this.workImaginary[index] = imaginary;
    }
    fftRadix2(this.workReal, this.workImaginary, true);
    const magnitude = new Float32Array(outputBins);
    for (let index = 0; index < outputBins; index += 1) {
      const cosine = this.chirpReal[index];
      const negativeSine = this.chirpImaginary[index];
      const real = this.workReal[index] * cosine - this.workImaginary[index] * negativeSine;
      const imaginary = this.workReal[index] * negativeSine + this.workImaginary[index] * cosine;
      magnitude[index] = Math.hypot(real, imaginary);
    }
    return magnitude;
  }
}

function logarithmicFrequencies(bandsPerOctave, minimum, maximum) {
  const left = Math.floor(Math.log2(minimum / 440) * bandsPerOctave);
  const right = Math.ceil(Math.log2(maximum / 440) * bandsPerOctave);
  const frequencies = [];
  for (let index = left; index < right; index += 1) {
    const frequency = 440 * 2 ** (index / bandsPerOctave);
    if (frequency >= minimum && frequency <= maximum) frequencies.push(frequency);
  }
  return frequencies;
}

function nearestFrequencyBins(frequencies, binFrequencies) {
  const bins = [];
  for (const frequency of frequencies) {
    let low = 0;
    let high = binFrequencies.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (binFrequencies[middle] < frequency) low = middle + 1;
      else high = middle;
    }
    let index = clamp(low, 1, binFrequencies.length - 1);
    const left = binFrequencies[index - 1];
    const right = binFrequencies[index];
    if (frequency - left < right - frequency) index -= 1;
    if (bins[bins.length - 1] !== index) bins.push(index);
  }
  return bins;
}

function buildFilterbank() {
  const fftBins = Math.floor(FRAME_SIZE / 2);
  const binFrequencies = Array.from(
    { length: fftBins },
    (_value, index) => index * SAMPLE_RATE / FRAME_SIZE
  );
  const centers = logarithmicFrequencies(24, 30, 17000);
  const bins = nearestFrequencyBins(centers, binFrequencies);
  const filters = [];
  for (let index = 0; index < bins.length - 2; index += 1) {
    const start = bins[index];
    const center = bins[index + 1];
    const stop = bins[index + 2];
    const width = stop - start;
    const centerOffset = center - start;
    const weights = new Float32Array(width);
    for (let offset = 0; offset < centerOffset; offset += 1) {
      weights[offset] = offset / centerOffset;
    }
    const fallingLength = width - centerOffset;
    for (let offset = 0; offset < fallingLength; offset += 1) {
      weights[centerOffset + offset] = 1 - offset / fallingLength;
    }
    let total = 0;
    for (const weight of weights) total += weight;
    if (total) {
      for (let offset = 0; offset < weights.length; offset += 1) weights[offset] /= total;
    }
    filters.push({ start, weights });
  }
  if (filters.length !== MODEL_BANDS) {
    throw new Error(`Unexpected BeatNet filterbank shape: ${fftBins}x${filters.length}`);
  }
  return filters;
}

class CausalFeatures {
  constructor() {
    this.window = Float32Array.from(
      { length: FRAME_SIZE },
      (_value, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (FRAME_SIZE - 1))
    );
    this.filterbank = buildFilterbank();
    this.fft = new BluesteinRealFft(FRAME_SIZE);
    this.buffer = new Float32Array(FRAME_SIZE);
    this.windowed = new Float32Array(FRAME_SIZE);
    this.previousLog = new Float32Array(MODEL_BANDS);
    this.frames = 0;
  }

  update(rawHop) {
    const hop = rawHop instanceof Float32Array ? rawHop : Float32Array.from(rawHop || []);
    if (hop.length !== HOP_SIZE) throw new Error(`Expected ${HOP_SIZE} rhythm samples, received ${hop.length}`);
    this.buffer.copyWithin(0, HOP_SIZE);
    this.buffer.set(hop, FRAME_SIZE - HOP_SIZE);
    for (let index = 0; index < FRAME_SIZE; index += 1) {
      this.windowed[index] = this.buffer[index] * this.window[index];
    }
    const magnitude = this.fft.magnitude(this.windowed, Math.floor(FRAME_SIZE / 2));
    const frame = new Float32Array(MODEL_INPUTS);
    for (let band = 0; band < this.filterbank.length; band += 1) {
      const { start, weights } = this.filterbank[band];
      let energy = 0;
      for (let offset = 0; offset < weights.length; offset += 1) {
        energy += magnitude[start + offset] * weights[offset];
      }
      const logSpectrum = Math.log10(1 + energy);
      frame[band] = logSpectrum;
      frame[MODEL_BANDS + band] = Math.max(0, logSpectrum - this.previousLog[band]);
      this.previousLog[band] = logSpectrum;
    }
    this.frames += 1;
    return frame;
  }
}

class RhythmSummary {
  constructor() {
    this.activations = [];
    this.intervals = [];
    this.lastPeakAt = 0;
    this.peakWindow = [];
    this.serial = 0;
  }

  static foldedBpm(intervalMs) {
    if (intervalMs <= 0) return 0;
    const bpm = 60000 / intervalMs;
    const candidates = [0.5, 1, 2, 4]
      .map((factor) => bpm * factor)
      .filter((value) => value >= 70 && value <= 210);
    return candidates.reduce(
      (best, value) => (Math.abs(value - 150) < Math.abs(best - 150) ? value : best),
      candidates[0] || 0
    );
  }

  update(activation, nowMs) {
    this.activations.push(activation);
    this.activations = this.activations.slice(-150);
    this.peakWindow.push([activation, nowMs]);
    this.peakWindow = this.peakWindow.slice(-3);
    const recent = this.activations.slice(-50);
    const baseline = median(recent);
    const threshold = Math.max(0.18, baseline + 0.07);
    let peak = false;
    let peakActivation = 0;
    let peakAt = nowMs;
    if (this.peakWindow.length === 3) {
      const [previous, center, following] = this.peakWindow;
      [peakActivation, peakAt] = center;
      const prominence = peakActivation - Math.max(previous[0], following[0]);
      peak = peakActivation >= threshold
        && peakActivation > previous[0]
        && peakActivation >= following[0]
        && prominence >= 0.0025
        && peakAt - this.lastPeakAt >= 140;
    }
    let intervalMs = 0;
    if (peak) {
      if (this.lastPeakAt) {
        intervalMs = peakAt - this.lastPeakAt;
        if (intervalMs >= 140 && intervalMs <= 1800) {
          this.intervals.push(intervalMs);
          this.intervals = this.intervals.slice(-24);
        }
      }
      this.lastPeakAt = peakAt;
      this.serial += 1;
    }
    const bpms = this.intervals
      .map((value) => RhythmSummary.foldedBpm(value))
      .filter(Boolean);
    const bpm = bpms.length >= 3 ? median(bpms.slice(-12)) : 0;
    const spread = bpm ? median(bpms.slice(-12).map((value) => Math.abs(value - bpm))) : 99;
    const regularity = bpms.length >= 4 ? clamp(1 - spread / 18) : 0;
    const orderedRecent = [...recent].sort((left, right) => left - right);
    const upper = orderedRecent[Math.max(0, Math.floor(orderedRecent.length * 0.82) - 1)] || 0;
    const groove = clamp(upper * 0.72 + regularity * 0.28);
    return {
      peak,
      peakActivation: Number((peak ? peakActivation : 0).toFixed(5)),
      peakDelayMs: peak ? Number((nowMs - peakAt).toFixed(3)) : 0,
      serial: this.serial,
      intervalMs: Number(intervalMs.toFixed(3)),
      bpm: Number(bpm.toFixed(2)),
      regularity: Number(regularity.toFixed(4)),
      groove: Number(groove.toFixed(4)),
      threshold: Number(threshold.toFixed(4))
    };
  }
}

class LocalRhythmModel {
  constructor({ modelPath, onEvent = () => {}, ort = null, now = () => performance.now() } = {}) {
    this.modelPath = modelPath;
    this.onEvent = onEvent;
    this.ort = ort;
    this.now = now;
    this.session = null;
    this.features = new CausalFeatures();
    this.summary = new RhythmSummary();
    this.hidden = new Float32Array(HIDDEN_VALUES);
    this.cell = new Float32Array(HIDDEN_VALUES);
    this.queue = [];
    this.processing = false;
    this.frameIndex = 0;
    this.closed = false;
    this.failed = false;
    this.generation = 0;
  }

  async initialize() {
    if (this.session || this.closed) return Boolean(this.session);
    try {
      this.ort ||= require('onnxruntime-node');
      const session = await this.ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
        intraOpNumThreads: 1,
        interOpNumThreads: 1
      });
      if (this.closed) {
        if (session?.release) await session.release();
        return false;
      }
      this.session = session;
      this.failed = false;
      this.onEvent({ type: 'ready', model: 'BeatNet-1 causal ONNX', hopMs: 20 });
      return true;
    } catch (error) {
      this.onEvent({ type: 'unavailable', reason: `local ONNX model unavailable: ${error.message}` });
      return false;
    }
  }

  reset() {
    this.features = new CausalFeatures();
    this.summary = new RhythmSummary();
    this.hidden = new Float32Array(HIDDEN_VALUES);
    this.cell = new Float32Array(HIDDEN_VALUES);
    this.queue.length = 0;
    this.frameIndex = 0;
    this.generation += 1;
    if (this.session) this.onEvent({ type: 'ready', model: 'BeatNet-1 causal ONNX', hopMs: 20 });
  }

  ingest(rawHop) {
    if (!this.session || this.closed || this.failed) return;
    const source = rawHop instanceof Float32Array
      ? rawHop
      : ArrayBuffer.isView(rawHop)
        ? new Float32Array(rawHop.buffer, rawHop.byteOffset, rawHop.byteLength / Float32Array.BYTES_PER_ELEMENT)
        : Float32Array.from(rawHop || []);
    if (source.length !== HOP_SIZE) return;
    this.queue.push(Float32Array.from(source));
    // At 50 fps inference should stay ahead of capture. If a machine stalls,
    // keep the newest contiguous window instead of accumulating seconds of
    // latency; DSP remains active throughout the stall.
    if (this.queue.length > 8) this.queue.splice(0, this.queue.length - 8);
    if (!this.processing) void this.drain();
  }

  async drain() {
    if (this.processing || !this.session) return;
    this.processing = true;
    try {
      while (this.queue.length && !this.closed) {
        const hop = this.queue.shift();
        const generation = this.generation;
        const featureStart = this.now();
        const frame = this.features.update(hop);
        const featureMs = this.now() - featureStart;
        if (this.features.frames < 5) continue;
        const inferenceStart = this.now();
        const outputs = await this.session.run({
          features: new this.ort.Tensor('float32', frame, [1, 1, MODEL_INPUTS]),
          hidden: new this.ort.Tensor('float32', this.hidden, [2, 1, HIDDEN_SIZE]),
          cell: new this.ort.Tensor('float32', this.cell, [2, 1, HIDDEN_SIZE])
        });
        const inferenceMs = this.now() - inferenceStart;
        if (generation !== this.generation) continue;
        this.hidden = Float32Array.from(outputs.next_hidden.data);
        this.cell = Float32Array.from(outputs.next_cell.data);
        const probabilities = softmax3(outputs.logits.data);
        const beat = probabilities[0];
        const downbeat = probabilities[1];
        const state = this.summary.update(Math.max(beat, downbeat), this.now());
        this.frameIndex += 1;
        if (state.peak || this.frameIndex % 5 === 0) {
          this.onEvent({
            type: 'rhythm',
            beat: Number(beat.toFixed(5)),
            downbeat: Number(downbeat.toFixed(5)),
            ...state,
            featureMs: Number(featureMs.toFixed(3)),
            inferenceMs: Number(inferenceMs.toFixed(3))
          });
        }
      }
    } catch (error) {
      this.queue.length = 0;
      this.failed = true;
      this.onEvent({ type: 'unavailable', reason: `local ONNX inference failed: ${error.message}` });
    } finally {
      this.processing = false;
      if (this.queue.length && !this.closed) void this.drain();
    }
  }

  async close() {
    this.closed = true;
    this.queue.length = 0;
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    if (this.session?.release) await this.session.release();
    this.session = null;
  }
}

module.exports = {
  BluesteinRealFft,
  CausalFeatures,
  FRAME_SIZE,
  HIDDEN_SIZE,
  HOP_SIZE,
  LocalRhythmModel,
  MODEL_BANDS,
  MODEL_INPUTS,
  RhythmSummary,
  SAMPLE_RATE,
  buildFilterbank,
  softmax3
};
