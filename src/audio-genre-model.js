'use strict';

const { classifyGenre } = require('./genre-classifier');
const { THEMES } = require('./themes');

const SAMPLE_RATE = 16000;
const FRAME_SIZE = 512;
const HOP_SIZE = 256;
const MEL_BANDS = 96;
const PATCH_FRAMES = 128;
const PATCH_HOP = 62;
const STATIC_ANALYSIS_WINDOW_LIMIT = 100;
const MEMORY_PRIOR_EQUIVALENT_WINDOWS = 5;
const MEMORY_PRIOR_HORIZON_WINDOWS = 24;
const LOW_SCORE_MIN_CONFIDENCE = 0.15;
const LOW_SCORE_MIN_MARGIN = 0.005;
const STABLE_MIN_CONFIDENCE = 0.18;
const STABLE_MIN_MARGIN = 0.015;
const SUPPORTED_MIN_CONFIDENCE = 0.22;
const SUPPORTED_MIN_MARGIN = 0.02;
const STRONG_MIN_CONFIDENCE = 0.32;
const STRONG_MIN_MARGIN = 0.04;
const STATIC_CORRECTION_MIN_CONFIDENCE = LOW_SCORE_MIN_CONFIDENCE;
const STATIC_CORRECTION_MIN_MARGIN = LOW_SCORE_MIN_MARGIN;
const AUTHOR_PRIOR_EARLY_MIN_CONFIDENCE = 0.4;
const AUTHOR_PRIOR_EARLY_MIN_MARGIN = 0.08;
const HIERARCHICAL_MIN_CONFIDENCE = STABLE_MIN_CONFIDENCE;
const HIERARCHICAL_MIN_MARGIN = 0.01;
const COMPATIBILITY_SUPPORT_MIN_CONFIDENCE = 0.2;
const COMPATIBILITY_SUPPORT_MIN_ADVANTAGE = 0.03;
const COMPATIBILITY_CORRECTION_MIN_CONFIDENCE = 0.24;
const COMPATIBILITY_CORRECTION_MIN_MARGIN = 0.03;
const COMPATIBILITY_CORRECTION_MIN_ADVANTAGE = 0.04;
const DYNAMIC_FAMILY_MIN_CONFIDENCE = SUPPORTED_MIN_CONFIDENCE;
const DYNAMIC_FAMILY_MIN_MARGIN = 0.025;
const DYNAMIC_FAMILY_MIN_ADVANTAGE = 0.03;
const DYNAMIC_LEAF_MIN_CONFIDENCE = 0.2;
const DYNAMIC_LEAF_MIN_MARGIN = 0.015;
const DYNAMIC_LEAF_MIN_ADVANTAGE = 0.015;
const DYNAMIC_PERSISTENT_MIN_ADVANTAGE = LOW_SCORE_MIN_MARGIN;
const DYNAMIC_HIERARCHICAL_COOLDOWN_WINDOWS = 3;
const CONFIRMATION_MIN_MARGIN = STABLE_MIN_MARGIN;
const AMBIENT_FIRST_MIN_WINDOWS = 12;
const AMBIENT_FIRST_RECENT_WINDOWS = 8;
const AMBIENT_FIRST_RECENT_AGREEMENT = 7 / 8;
const STATIC_CORRECTION_WINDOW = 8;
const STATIC_CORRECTION_AGREEMENT = 7 / 8;
const STATIC_FINAL_CORRECTION_WINDOW = 12;
const STATIC_FINAL_CORRECTION_AGREEMENT = 10 / 12;

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

class Radix2MagnitudeFft {
  constructor(size) {
    if ((size & (size - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.size = size;
    this.real = new Float64Array(size);
    this.imaginary = new Float64Array(size);
    this.bitReverse = new Uint16Array(size);
    this.cosine = new Float64Array(size / 2);
    this.sine = new Float64Array(size / 2);
    const bits = Math.log2(size);
    for (let index = 0; index < size; index += 1) {
      let value = index;
      let reversed = 0;
      for (let bit = 0; bit < bits; bit += 1) {
        reversed = (reversed << 1) | (value & 1);
        value >>= 1;
      }
      this.bitReverse[index] = reversed;
    }
    for (let index = 0; index < size / 2; index += 1) {
      const angle = -2 * Math.PI * index / size;
      this.cosine[index] = Math.cos(angle);
      this.sine[index] = Math.sin(angle);
    }
  }

  magnitude(input, output = new Float32Array(this.size / 2 + 1)) {
    const { size, real, imaginary, bitReverse, cosine, sine } = this;
    for (let index = 0; index < size; index += 1) {
      real[bitReverse[index]] = input[index];
      imaginary[bitReverse[index]] = 0;
    }

    for (let length = 2; length <= size; length <<= 1) {
      const half = length >> 1;
      const tableStep = size / length;
      for (let offset = 0; offset < size; offset += length) {
        for (let position = 0; position < half; position += 1) {
          const even = offset + position;
          const odd = even + half;
          const tableIndex = position * tableStep;
          const oddReal = real[odd] * cosine[tableIndex] - imaginary[odd] * sine[tableIndex];
          const oddImaginary = real[odd] * sine[tableIndex] + imaginary[odd] * cosine[tableIndex];
          real[odd] = real[even] - oddReal;
          imaginary[odd] = imaginary[even] - oddImaginary;
          real[even] += oddReal;
          imaginary[even] += oddImaginary;
        }
      }
    }

    for (let index = 0; index < output.length; index += 1) {
      output[index] = Math.hypot(real[index], imaginary[index]);
    }
    return output;
  }
}

function hzToSlaneyMel(frequency) {
  const minimumLogFrequency = 1000;
  const linearSlope = 3 / 200;
  if (frequency < minimumLogFrequency) return frequency * linearSlope;
  const minimumLogMel = minimumLogFrequency * linearSlope;
  const logStep = Math.log(6.4) / 27;
  return minimumLogMel + Math.log(frequency / minimumLogFrequency) / logStep;
}

function slaneyMelToHz(mel) {
  const minimumLogFrequency = 1000;
  const linearSlope = 3 / 200;
  const minimumLogMel = minimumLogFrequency * linearSlope;
  if (mel < minimumLogMel) return mel / linearSlope;
  const logStep = Math.log(6.4) / 27;
  return minimumLogFrequency * Math.exp((mel - minimumLogMel) * logStep);
}

function buildMusiCnnMelFilterbank() {
  const points = new Float64Array(MEL_BANDS + 2);
  const lowMel = hzToSlaneyMel(0);
  const highMel = hzToSlaneyMel(SAMPLE_RATE / 2);
  const increment = (highMel - lowMel) / (MEL_BANDS + 1);
  for (let index = 0; index < points.length; index += 1) {
    points[index] = slaneyMelToHz(lowMel + increment * index);
  }

  const frequencyScale = (SAMPLE_RATE / 2) / (FRAME_SIZE / 2);
  return Array.from({ length: MEL_BANDS }, (_value, band) => {
    const left = points[band];
    const center = points[band + 1];
    const right = points[band + 2];
    const startBin = Math.ceil(left / frequencyScale);
    const endBin = Math.floor(right / frequencyScale);
    const weights = new Float32Array(endBin - startBin + 1);
    const risingWidth = center - left;
    const fallingWidth = right - center;
    const triangularArea = (risingWidth + fallingWidth) / 2;
    for (let bin = startBin; bin <= endBin; bin += 1) {
      const frequency = bin * frequencyScale;
      const weight = frequency < center
        ? (frequency - left) / risingWidth
        : (right - frequency) / fallingWidth;
      weights[bin - startBin] = Math.max(0, weight) / triangularArea;
    }
    return { startBin, weights };
  });
}

class MusiCnnMelExtractor {
  constructor() {
    this.window = Float32Array.from(
      { length: FRAME_SIZE },
      (_value, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (FRAME_SIZE - 1))
    );
    this.windowed = new Float32Array(FRAME_SIZE);
    this.spectrum = new Float32Array(FRAME_SIZE / 2 + 1);
    this.fft = new Radix2MagnitudeFft(FRAME_SIZE);
    this.filters = buildMusiCnnMelFilterbank();
  }

  frameCount(sampleCount) {
    if (sampleCount <= 0) return 0;
    return Math.max(1, 1 + Math.ceil((sampleCount - FRAME_SIZE / 2) / HOP_SIZE));
  }

  transform(signal) {
    if (!(signal instanceof Float32Array) || signal.length === 0) {
      throw new Error('Expected a non-empty Float32Array sampled at 16 kHz');
    }
    const frames = this.frameCount(signal.length);
    const output = new Float32Array(frames * MEL_BANDS);
    for (let frameIndex = 0; frameIndex < frames; frameIndex += 1) {
      const start = frameIndex * HOP_SIZE - FRAME_SIZE / 2;
      for (let index = 0; index < FRAME_SIZE; index += 1) {
        const sourceIndex = start + index;
        const sample = sourceIndex >= 0 && sourceIndex < signal.length ? signal[sourceIndex] : 0;
        this.windowed[index] = sample * this.window[index];
      }
      this.fft.magnitude(this.windowed, this.spectrum);
      const frameOffset = frameIndex * MEL_BANDS;
      for (let band = 0; band < MEL_BANDS; band += 1) {
        const filter = this.filters[band];
        let energy = 0;
        for (let index = 0; index < filter.weights.length; index += 1) {
          const magnitude = this.spectrum[filter.startBin + index];
          energy += magnitude * magnitude * filter.weights[index];
        }
        output[frameOffset + band] = Math.log10(1 + 10000 * energy);
      }
    }
    return { data: output, frames, bands: MEL_BANDS };
  }
}

function readInt24LittleEndian(buffer, offset) {
  let value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
  if (value & 0x800000) value |= 0xff000000;
  return value;
}

function decodeWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) throw new Error('Invalid WAV file');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Only RIFF/WAVE files are supported by this decoder');
  }

  let format = null;
  let dataOffset = -1;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkStart + size > buffer.length) throw new Error(`Invalid WAV ${id} chunk size`);
    if (id === 'fmt ') {
      if (size < 16) throw new Error('Invalid WAV format chunk');
      let audioFormat = buffer.readUInt16LE(chunkStart);
      if (audioFormat === 0xfffe && size >= 40) audioFormat = buffer.readUInt32LE(chunkStart + 24);
      format = {
        audioFormat,
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14)
      };
    } else if (id === 'data') {
      dataOffset = chunkStart;
      dataBytes = size;
    }
    offset = chunkStart + size + (size & 1);
  }
  if (!format || dataOffset < 0) throw new Error('WAV file is missing fmt or data chunks');
  if (![1, 3].includes(format.audioFormat)) {
    throw new Error(`Unsupported WAV encoding: ${format.audioFormat}`);
  }
  if (format.channels < 1 || format.blockAlign < 1 || format.sampleRate < 1) {
    throw new Error('Invalid WAV channel or sample-rate metadata');
  }

  const frameCount = Math.floor(dataBytes / format.blockAlign);
  const mono = new Float32Array(frameCount);
  const bytesPerSample = format.bitsPerSample / 8;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameOffset = dataOffset + frame * format.blockAlign;
    let mixed = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      const offset = frameOffset + channel * bytesPerSample;
      let sample;
      if (format.audioFormat === 3 && format.bitsPerSample === 32) sample = buffer.readFloatLE(offset);
      else if (format.audioFormat === 3 && format.bitsPerSample === 64) sample = buffer.readDoubleLE(offset);
      else if (format.audioFormat === 1 && format.bitsPerSample === 8) sample = (buffer[offset] - 128) / 128;
      else if (format.audioFormat === 1 && format.bitsPerSample === 16) sample = buffer.readInt16LE(offset) / 32768;
      else if (format.audioFormat === 1 && format.bitsPerSample === 24) sample = readInt24LittleEndian(buffer, offset) / 8388608;
      else if (format.audioFormat === 1 && format.bitsPerSample === 32) sample = buffer.readInt32LE(offset) / 2147483648;
      else throw new Error(`Unsupported WAV bit depth: ${format.bitsPerSample}`);
      mixed += Number.isFinite(sample) ? sample : 0;
    }
    mono[frame] = clamp(mixed / format.channels, -1, 1);
  }
  return { samples: mono, sampleRate: format.sampleRate, channels: format.channels };
}

function sinc(value) {
  return Math.abs(value) < 1e-8 ? 1 : Math.sin(Math.PI * value) / (Math.PI * value);
}

function resampleWindowedSinc(input, sourceRate, targetRate = SAMPLE_RATE, options = {}) {
  if (!(input instanceof Float32Array) || input.length === 0) throw new Error('Cannot resample empty audio');
  if (sourceRate === targetRate) return input.slice();
  const radius = options.radius || 10;
  const phases = options.phases || 512;
  const taps = radius * 2 + 1;
  const cutoff = Math.min(1, targetRate / sourceRate) * 0.94;
  const kernels = Array.from({ length: phases }, (_unused, phase) => {
    const fraction = phase / phases;
    const kernel = new Float32Array(taps);
    let total = 0;
    for (let tap = -radius; tap <= radius; tap += 1) {
      const distance = tap - fraction;
      const window = 0.5 + 0.5 * Math.cos(Math.PI * distance / (radius + 1));
      const value = cutoff * sinc(cutoff * distance) * window;
      kernel[tap + radius] = value;
      total += value;
    }
    for (let tap = 0; tap < taps; tap += 1) kernel[tap] /= total;
    return kernel;
  });

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const sourcePosition = (outputIndex + 0.5) * ratio - 0.5;
    const center = Math.floor(sourcePosition);
    const fraction = sourcePosition - center;
    const phase = Math.min(phases - 1, Math.round(fraction * (phases - 1)));
    const kernel = kernels[phase];
    let value = 0;
    for (let tap = -radius; tap <= radius; tap += 1) {
      const sourceIndex = center + tap;
      if (sourceIndex >= 0 && sourceIndex < input.length) {
        value += input[sourceIndex] * kernel[tap + radius];
      }
    }
    output[outputIndex] = value;
  }
  return output;
}

function allPatchStarts(frameCount) {
  if (frameCount < PATCH_FRAMES) return [];
  const patchCount = 1 + Math.floor((frameCount - PATCH_FRAMES) / PATCH_HOP);
  return Array.from({ length: patchCount }, (_value, index) => index * PATCH_HOP);
}

function selectPatchStarts(frameCount, maximumPatches = 48) {
  const starts = allPatchStarts(frameCount);
  if (starts.length <= maximumPatches) return starts;
  const selected = [];
  for (let index = 0; index < maximumPatches; index += 1) {
    const sourceIndex = Math.round(index * (starts.length - 1) / (maximumPatches - 1));
    if (selected[selected.length - 1] !== starts[sourceIndex]) selected.push(starts[sourceIndex]);
  }
  return selected;
}

function buildPatchTensor(melSpectrogram, starts) {
  if (!melSpectrogram || melSpectrogram.bands !== MEL_BANDS) {
    throw new Error(`Expected a ${MEL_BANDS}-band mel spectrogram`);
  }
  const tensor = new Float32Array(starts.length * PATCH_FRAMES * MEL_BANDS);
  const patchValues = PATCH_FRAMES * MEL_BANDS;
  for (let patch = 0; patch < starts.length; patch += 1) {
    const sourceStart = starts[patch] * MEL_BANDS;
    tensor.set(
      melSpectrogram.data.subarray(sourceStart, sourceStart + patchValues),
      patch * patchValues
    );
  }
  return tensor;
}

const MAJOR_FAMILIES = new Set([
  'hardcore', 'hardstyle', 'dubstep', 'future-bass', 'drum-bass', 'house', 'trance',
  'techno', 'uk-garage', 'breakbeat', 'synthwave', 'phonk', 'metal', 'rock', 'pop',
  'j-pop', 'k-pop', 'hip-hop', 'rnb', 'country', 'folk', 'jazz', 'classical',
  'soundtrack', 'latin', 'reggae', 'punk', 'ambient', 'downtempo', 'idm', 'glitch',
  'instrumental-hip-hop', 'blues', 'electronic'
]);

const THEME_IDS_BY_LABEL = new Map(
  Object.entries(THEMES).map(([id, theme]) => [String(theme.label || '').toUpperCase(), id])
);

function normalizeAudioGenreTreeId(value) {
  const id = String(value || '').trim();
  if (!id || MAJOR_FAMILIES.has(id)) return id;
  const family = String(THEMES[id]?.family || '');
  return MAJOR_FAMILIES.has(family) ? family : id;
}

function audioGenreTreePath(value) {
  const path = [];
  const visited = new Set();
  let id = normalizeAudioGenreTreeId(value);
  while (id && !visited.has(id)) {
    path.push(id);
    visited.add(id);
    const theme = THEMES[id];
    if (!theme) break;
    const parentLabel = String(theme.treeParent || theme.parent || '').toUpperCase();
    const ownLabel = String(theme.label || '').toUpperCase();
    if (!parentLabel || parentLabel === ownLabel) break;
    const parentId = THEME_IDS_BY_LABEL.get(parentLabel);
    if (!parentId) {
      path.push(`tree:${parentLabel}`);
      break;
    }
    id = parentId;
  }
  return path;
}

function audioGenreTreeDistance(left, right) {
  const leftPath = audioGenreTreePath(left);
  const rightPath = audioGenreTreePath(right);
  const rightIndexes = new Map(rightPath.map((id, index) => [id, index]));
  let distance = Infinity;
  leftPath.forEach((id, leftIndex) => {
    if (rightIndexes.has(id)) {
      distance = Math.min(distance, leftIndex + rightIndexes.get(id));
    }
  });
  return distance;
}

// Keep the broad-family aggregation that makes short real-time windows stable,
// but preserve an exact Discogs style when it names one of our reviewed
// visuals without ambiguity. Related aliases intentionally share one target so
// their activations can still reinforce each other.
const DISCOGS_EXACT_STYLE_MAP = new Map(Object.entries({
  'Electronic---Acid House': 'acid-house',
  'Electronic---Bassline': 'bassline',
  'Electronic---Big Beat': 'big-beat',
  'Electronic---Breakcore': 'breakcore',
  'Electronic---Dance-pop': 'dance-pop',
  'Electronic---Deep House': 'deep-house',
  'Electronic---Disco': 'disco-funk',
  'Electronic---Electro House': 'electro-house',
  'Electronic---Euro-Disco': 'disco-funk',
  'Electronic---Gabber': 'gabber',
  'Electronic---Goa Trance': 'psytrance',
  'Electronic---Happy Hardcore': 'happy-hardcore',
  'Electronic---Hard House': 'hard-house',
  'Electronic---Hard Techno': 'hard-techno',
  'Electronic---Hard Trance': 'hard-trance',
  'Electronic---Italo-Disco': 'disco-funk',
  'Electronic---Jungle': 'jungle',
  'Electronic---Minimal Techno': 'minimal-techno',
  'Electronic---Nu-Disco': 'nu-disco',
  'Electronic---Progressive House': 'progressive-house',
  'Electronic---Progressive Trance': 'progressive-trance',
  'Electronic---Psy-Trance': 'psytrance',
  'Electronic---Schranz': 'hard-techno',
  'Electronic---Speed Garage': 'speed-garage',
  'Electronic---Speedcore': 'uptempo-hardcore',
  'Electronic---Tech House': 'tech-house',
  'Electronic---Tech Trance': 'tech-trance',
  'Electronic---Trip Hop': 'downtempo',
  'Electronic---Tropical House': 'tropical-house',
  'Pop---City Pop': 'city-pop',
  'Pop---Europop': 'dance-pop',
  'Pop---Indie Pop': 'indie-pop',
  'Pop---J-pop': 'j-pop',
  'Pop---K-pop': 'k-pop',
  'Funk / Soul---Contemporary R&B': 'contemporary-rnb',
  'Funk / Soul---Disco': 'disco-funk',
  'Funk / Soul---Free Funk': 'funk',
  'Funk / Soul---Funk': 'funk',
  'Funk / Soul---Gospel': 'gospel',
  'Funk / Soul---Neo Soul': 'neo-soul',
  'Funk / Soul---New Jack Swing': 'new-jack-swing',
  'Funk / Soul---P.Funk': 'funk',
  'Funk / Soul---Rhythm & Blues': 'rnb',
  'Funk / Soul---Soul': 'soul',
  'Funk / Soul---Swingbeat': 'new-jack-swing',
  'Funk / Soul---UK Street Soul': 'soul',
  'Jazz---Big Band': 'swing-jazz',
  'Jazz---Bop': 'bebop',
  'Jazz---Bossa Nova': 'bossa-nova',
  'Jazz---Fusion': 'jazz-fusion',
  'Jazz---Hard Bop': 'bebop',
  'Jazz---Jazz-Funk': 'jazz-fusion',
  'Jazz---Jazz-Rock': 'jazz-fusion',
  'Jazz---Post Bop': 'bebop',
  'Jazz---Swing': 'swing-jazz',
  'Classical---Baroque': 'baroque',
  'Classical---Contemporary': 'modern-classical',
  'Classical---Modern': 'modern-classical',
  'Classical---Neo-Classical': 'modern-classical',
  'Classical---Neo-Romantic': 'romantic-classical',
  'Classical---Opera': 'opera',
  'Classical---Post-Modern': 'modern-classical',
  'Classical---Romantic': 'romantic-classical',
  'Rock---Alternative Rock': 'alternative',
  'Rock---Atmospheric Black Metal': 'black-metal',
  'Rock---Black Metal': 'black-metal',
  'Rock---Death Metal': 'death-metal',
  'Rock---Deathcore': 'deathcore',
  'Rock---Depressive Black Metal': 'black-metal',
  'Rock---Indie Rock': 'alternative',
  'Rock---Melodic Death Metal': 'death-metal',
  'Rock---Metalcore': 'metalcore',
  'Rock---Nu Metal': 'nu-metal',
  'Rock---Pop Rock': 'pop-rock',
  'Rock---Power Pop': 'pop-rock',
  'Rock---Progressive Metal': 'progressive-metal',
  'Rock---Technical Death Metal': 'death-metal',
  'Hip Hop---Instrumental': 'instrumental-hip-hop',
  'Hip Hop---Trip Hop': 'downtempo'
}));

// The bundled Discogs model has no direct Future Bass or Phonk class. Keep a
// separate evidence profile for those display families instead of relabeling
// any real model output. This lets metadata remain authoritative while nearby
// model activations still count as support for the current genre.
const AUDIO_GENRE_COMPATIBILITY_LABELS = Object.freeze({
  'future-bass': Object.freeze([
    'Electronic---Dubstep',
    'Hip Hop---Trap',
    'Electronic---Electro House',
    'Electronic---Progressive House',
    'Electronic---Chillwave',
    'Electronic---UK Garage'
  ]),
  phonk: Object.freeze([
    'Hip Hop---Trap',
    'Hip Hop---Cloud Rap',
    'Hip Hop---Horrorcore',
    'Hip Hop---Instrumental',
    'Electronic---Electro',
    'Electronic---Ghetto'
  ])
});

function audioGenreCompatibilityId(value) {
  const id = normalizeAudioGenreTreeId(value);
  return Object.hasOwn(AUDIO_GENRE_COMPATIBILITY_LABELS, id) ? id : '';
}

function hasAudioGenreCompatibilityProfile(value) {
  return Boolean(audioGenreCompatibilityId(value));
}

function isBroadAudioGenre(value) {
  return ['unknown', 'electronic'].includes(String(value || 'unknown'));
}

function shouldAnalyzeAudioGenre({
  enabled = true,
  playing = true,
  hasTrack = true,
  dynamicEnabled = false,
  fullTrackLearning = false,
  metadataKind = 'broad',
  decisionGenreId = '',
  acceptedWindows = 0,
  correctionCount = 0,
  finalCorrectionCount = 0,
  settleWindowLimit = STATIC_ANALYSIS_WINDOW_LIMIT
} = {}) {
  if (!enabled || !playing || !hasTrack) return false;
  if (metadataKind === 'authoritative') return false;
  if (dynamicEnabled) return true;
  if (!['broad', 'artist'].includes(metadataKind)) return false;
  if (fullTrackLearning) return true;
  const hasConcreteAudioDecision = decisionGenreId && !isBroadAudioGenre(decisionGenreId);
  if (!hasConcreteAudioDecision) return true;
  const ordinaryCorrectionAvailable = Number(correctionCount || 0) < 1;
  const finalCumulativeCorrectionAvailable = Number(finalCorrectionCount || 0) < 1
    && Number(correctionCount || 0) < 2;
  return acceptedWindows < settleWindowLimit
    && (ordinaryCorrectionAvailable || finalCumulativeCorrectionAvailable);
}

function shouldKeepGenreIdentifying({
  enabled = true,
  available = true,
  playing = true,
  hasTrack = true,
  displayedGenreId = 'unknown',
  decisionGenreId = '',
  modelState = ''
} = {}) {
  if (!enabled || !available || !playing || !hasTrack) return false;
  if (['disabled', 'unavailable'].includes(String(modelState))) return false;
  if (String(displayedGenreId || 'unknown') !== 'unknown') return false;
  return !decisionGenreId || isBroadAudioGenre(decisionGenreId);
}

function shouldReplaceMetadataWithAudioGenre({
  metadataKind = 'broad',
  baseGenreId = 'unknown',
  decisionGenreId = 'unknown',
  decisionStage = '',
  dynamicEnabled = false
} = {}) {
  if (metadataKind === 'authoritative') return false;
  const broadAudioResult = isBroadAudioGenre(decisionGenreId);
  if (broadAudioResult) {
    return decisionStage !== 'dynamic' && String(baseGenreId || 'unknown') === 'unknown';
  }
  if (decisionStage === 'dynamic') return dynamicEnabled;
  return ['broad', 'artist'].includes(metadataKind);
}

function hasSignificantPlaybackSeek(previous = {}, current = {}, thresholdMs = 5000) {
  const previousPosition = Number(previous.positionMs);
  const currentPosition = Number(current.positionMs);
  if (!Number.isFinite(previousPosition) || !Number.isFinite(currentPosition)) return false;
  const sampledElapsed = Number(current.sampledAtMs) - Number(previous.sampledAtMs);
  const elapsedMs = Number.isFinite(sampledElapsed)
    ? clamp(sampledElapsed, 0, 5000)
    : 0;
  const playbackRate = Number.isFinite(Number(previous.playbackRate))
    ? Math.max(0, Number(previous.playbackRate))
    : 1;
  const expectedPosition = previousPosition + (previous.playing ? elapsedMs * playbackRate : 0);
  return Math.abs(currentPosition - expectedPosition) >= thresholdMs;
}

function discogsClassToMajor(label) {
  const exact = DISCOGS_EXACT_STYLE_MAP.get(String(label));
  if (exact) return exact;
  const [category = '', style = ''] = String(label).split('---');
  if (category === 'Electronic') {
    const classified = classifyGenre({ tags: [style] });
    if (MAJOR_FAMILIES.has(classified.family)) return classified.family;
    if (MAJOR_FAMILIES.has(classified.id)) return classified.id;
    return 'electronic';
  }
  if (category === 'Rock') {
    if (/metal|grind/i.test(style)) return 'metal';
    if (/punk|hardcore|crust|\boi\b/i.test(style)) return 'punk';
    return 'rock';
  }
  if (category === 'Pop') {
    const classified = classifyGenre({ tags: [style] });
    return ['j-pop', 'k-pop'].includes(classified.id) ? classified.id : 'pop';
  }
  if (category === 'Hip Hop') {
    const classified = classifyGenre({ tags: [style] });
    return classified.id === 'instrumental-hip-hop' ? classified.id : 'hip-hop';
  }
  if (category === 'Funk / Soul') return 'rnb';
  if (category === 'Jazz') return 'jazz';
  if (category === 'Classical') return 'classical';
  if (category === 'Latin') return 'latin';
  if (category === 'Reggae') return 'reggae';
  if (category === 'Stage & Screen') return 'soundtrack';
  if (category === 'Blues') return 'blues';
  if (category === 'Non-Music') return 'unknown';
  if (category === 'Folk, World, & Country') {
    return /country|bluegrass|hillbilly|honky tonk/i.test(style) ? 'country' : 'folk';
  }
  if (category === 'Brass & Military') return 'unknown';
  if (category === "Children's") return 'unknown';
  return 'unknown';
}

function combineFamilyEntries(entries) {
  const weights = [1, 0.35, 0.15];
  entries.sort((left, right) => right.score - left.score);
  let inverse = 1;
  for (let index = 0; index < Math.min(entries.length, weights.length); index += 1) {
    inverse *= 1 - clamp(entries[index].score) * weights[index];
  }
  return 1 - inverse;
}

function audioGenreModelOutputIds(classes = []) {
  return new Set(classes.map((label) => discogsClassToMajor(label)));
}

function audioGenreCompatibilityScores(classScores, classes) {
  const scoresByLabel = new Map(
    classes.map((label, index) => [String(label), clamp(Number(classScores[index]) || 0)])
  );
  return Object.fromEntries(
    Object.entries(AUDIO_GENRE_COMPATIBILITY_LABELS).map(([id, labels]) => [
      id,
      combineFamilyEntries(labels
        .filter((label) => scoresByLabel.has(label))
        .map((label) => ({ label, score: scoresByLabel.get(label) })))
    ])
  );
}

function audioGenreSupportScore(result, value) {
  const id = normalizeAudioGenreTreeId(value);
  const directScore = Number(result?.scores?.[id]);
  if (Number.isFinite(directScore)) return clamp(directScore);
  const compatibilityId = audioGenreCompatibilityId(id);
  const compatibilityScore = Number(result?.compatibilityScores?.[compatibilityId]);
  if (Number.isFinite(compatibilityScore)) return clamp(compatibilityScore);

  // Older saved/test results do not carry raw compatibility scores. Treat an
  // exact proxy winner as support rather than manufacturing a zero baseline.
  if (compatibilityId && result?.id) {
    const compatibleOutputs = AUDIO_GENRE_COMPATIBILITY_LABELS[compatibilityId]
      .map((label) => discogsClassToMajor(label));
    if (compatibleOutputs.includes(result.id)) return clamp(Number(result.confidence) || 0);
  }
  return 0;
}

function resultFromScores(scores, extra = {}) {
  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score);
  const first = ranked[0] || { id: 'unknown', score: 0 };
  const second = ranked[1] || { id: 'unknown', score: 0 };
  return {
    id: first.id,
    confidence: first.score,
    margin: first.score - second.score,
    scores,
    ranked,
    ...extra
  };
}

function audioGenreFamilyScores(scores = {}) {
  const groups = new Map();
  for (const [id, score] of Object.entries(scores)) {
    const familyId = normalizeAudioGenreTreeId(id) || id;
    if (!groups.has(familyId)) groups.set(familyId, []);
    groups.get(familyId).push({ id, score: clamp(Number(score) || 0) });
  }
  // Tree breadth is a presentation detail, not additional model evidence.
  // Use the strongest member so a family with many child visuals cannot
  // outscore a branchless genre merely by accumulating more entries.
  return Object.fromEntries(
    [...groups].map(([id, entries]) => [
      id,
      entries.reduce((maximum, entry) => Math.max(maximum, entry.score), 0)
    ])
  );
}

function audioGenreFamilyResult(result = {}) {
  return resultFromScores(audioGenreFamilyScores(result.scores), {
    compatibilityScores: result.compatibilityScores,
    topLabels: result.topLabels,
    leafGenreId: result.id,
    memoryPriorGenreId: result.memoryPriorGenreId,
    memoryPriorWeight: result.memoryPriorWeight
  });
}

function audioGenreResultForFamily(result = {}, familyId = '') {
  const scores = Object.fromEntries(
    Object.entries(result.scores || {})
      .filter(([id]) => normalizeAudioGenreTreeId(id) === familyId)
  );
  return resultFromScores(scores, {
    compatibilityScores: result.compatibilityScores,
    topLabels: result.topLabels,
    leafGenreId: result.id,
    memoryPriorGenreId: result.memoryPriorGenreId,
    memoryPriorWeight: result.memoryPriorWeight
  });
}

function audioGenreSiblingMargin(result = {}, candidateId = result.id) {
  const candidate = String(candidateId || '');
  const familyId = normalizeAudioGenreTreeId(candidate);
  const candidateScore = Number(result.scores?.[candidate]);
  if (!candidate || !familyId || !Number.isFinite(candidateScore)) return Number(result.margin) || 0;
  const siblingScore = Object.entries(result.scores || {})
    .filter(([id]) => id !== candidate && normalizeAudioGenreTreeId(id) === familyId)
    .reduce((maximum, [, score]) => Math.max(maximum, Number(score) || 0), 0);
  return siblingScore > 0 ? candidateScore - siblingScore : Number(result.margin) || 0;
}

function applyAudioGenreMemoryPrior(result, memory, acceptedWindows) {
  if (!result?.scores
    || memory?.fullPlaybackEvidence !== true
    || !memory.genreId
    || isBroadAudioGenre(memory.genreId)) return result;
  const liveWindows = Math.max(1, Math.round(Number(acceptedWindows) || 0));
  if (liveWindows > MEMORY_PRIOR_HORIZON_WINDOWS) return result;
  const horizonProgress = (liveWindows - 1) / MEMORY_PRIOR_HORIZON_WINDOWS;
  const priorMass = MEMORY_PRIOR_EQUIVALENT_WINDOWS * clamp(1 - horizonProgress);
  const priorWeight = priorMass / (liveWindows + priorMass);
  if (priorWeight <= 0) return result;

  const memoryScores = memory.scores && typeof memory.scores === 'object'
    ? memory.scores
    : {};
  const ids = new Set([...Object.keys(result.scores), ...Object.keys(memoryScores), memory.genreId]);
  const scores = {};
  for (const id of ids) {
    const liveScore = clamp(Number(result.scores[id]) || 0);
    const storedValue = Object.hasOwn(memoryScores, id)
      ? Number(memoryScores[id])
      : id === memory.genreId
        ? Number(memory.confidence)
        : 0;
    const memoryScore = clamp(Number.isFinite(storedValue) ? storedValue : 0);
    scores[id] = liveScore * (1 - priorWeight) + memoryScore * priorWeight;
  }
  return resultFromScores(scores, {
    topLabels: result.topLabels,
    compatibilityScores: result.compatibilityScores,
    memoryPriorGenreId: memory.genreId,
    memoryPriorWeight: priorWeight
  });
}

function hasPersistentLowScoreLead(result) {
  const confidence = Number(result?.confidence) || 0;
  const margin = Number(result?.margin) || 0;
  return confidence >= LOW_SCORE_MIN_CONFIDENCE
    && margin >= LOW_SCORE_MIN_MARGIN;
}

function authorPriorEvidenceGate({
  candidate,
  result,
  history,
  acceptedWindows,
  guardGenreIds
}) {
  const distances = [...(guardGenreIds || [])]
    .map((priorId) => audioGenreTreeDistance(priorId, candidate));
  if (!distances.length) return { ready: true, distance: null };
  const distance = Math.min(...distances);
  if (distance <= 3) return { ready: true, distance };

  const disconnected = !Number.isFinite(distance);
  const earlyWindows = disconnected ? 8 : 6;
  const earlyAgreement = disconnected ? 7 / 8 : 5 / 6;
  const strongEvidence = result.confidence >= AUTHOR_PRIOR_EARLY_MIN_CONFIDENCE
    && result.margin >= AUTHOR_PRIOR_EARLY_MIN_MARGIN;
  const earlyReady = !disconnected
    && acceptedWindows >= earlyWindows
    && strongEvidence
    && agreementRatio(history, candidate, earlyWindows) >= earlyAgreement;

  // A sustained result eventually overrides the artist prior. The author map
  // is a plausibility hint, not a rule about what an artist is allowed to make.
  const persistentWindows = disconnected ? 14 : 12;
  const persistentReady = acceptedWindows >= persistentWindows
    && result.confidence >= STABLE_MIN_CONFIDENCE
    && result.margin >= STABLE_MIN_MARGIN
    && agreementRatio(history, candidate, persistentWindows) >= 0.85;
  return { ready: earlyReady || persistentReady, distance };
}

function aggregateGenreScores(classScores, classes) {
  if (classScores.length !== classes.length) throw new Error('Class score and label counts do not match');
  const groups = new Map();
  const topLabels = classes
    .map((label, index) => ({ label, score: classScores[index] }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
  for (let index = 0; index < classes.length; index += 1) {
    const id = discogsClassToMajor(classes[index]);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push({ label: classes[index], score: classScores[index] });
  }
  const scores = {};
  for (const [id, entries] of groups) scores[id] = combineFamilyEntries(entries);
  return resultFromScores(scores, {
    topLabels,
    compatibilityScores: audioGenreCompatibilityScores(classScores, classes)
  });
}

function summarizeActivationRows(activations, patchCount, classes) {
  if (classes.length !== 400) throw new Error(`Expected 400 Discogs labels, received ${classes.length}`);
  if (activations.length !== patchCount * classes.length) throw new Error('Unexpected activation tensor size');
  const reduced = new Float32Array(classes.length);
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const values = new Array(patchCount);
    for (let patch = 0; patch < patchCount; patch += 1) {
      values[patch] = activations[patch * classes.length + classIndex];
    }
    reduced[classIndex] = median(values);
  }
  return aggregateGenreScores(reduced, classes);
}

function reduceActivationRows(rows, reducer) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected at least one activation row');
  const size = rows[0]?.length || 0;
  if (!size || rows.some((row) => row.length !== size)) {
    throw new Error('Activation rows must have matching lengths');
  }
  const output = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    output[index] = reducer(rows.map((row) => row[index]));
  }
  return output;
}

function meanActivationRows(rows) {
  return reduceActivationRows(rows, (values) => (
    values.reduce((total, value) => total + value, 0) / values.length
  ));
}

function medianActivationRows(rows) {
  return reduceActivationRows(rows, median);
}

function agreementRatio(history, id, size = history.length) {
  const sample = history.slice(-Math.max(1, size));
  if (!sample.length) return 0;
  return sample.filter((entry) => entry === id).length / sample.length;
}

function resultForGenreSupport(result, id, confidence, margin) {
  const scores = { ...(result?.scores || {}), [id]: confidence };
  return {
    ...result,
    id,
    confidence,
    margin,
    scores,
    ranked: Object.entries(scores)
      .map(([genreId, score]) => ({ id: genreId, score }))
      .sort((left, right) => right.score - left.score),
    inferredFromCompatibility: true
  };
}

class GenreDecisionTracker {
  constructor(options = {}) {
    this.options = {
      earliestWindows: options.earliestWindows || 4,
      independentFirstWindows: options.independentFirstWindows || 8,
      mediumWindows: options.mediumWindows || 8,
      confirmationWindows: options.confirmationWindows || 8,
      correctionWindowLimit: options.correctionWindowLimit ?? STATIC_ANALYSIS_WINDOW_LIMIT,
      postFirstCorrectionWindows: options.postFirstCorrectionWindows ?? 12,
      recentWindowSize: options.recentWindowSize || 6,
      firstPersistentWindows: options.firstPersistentWindows || 12,
      relativeLeadWindows: options.relativeLeadWindows || 10,
      dynamicWindowSize: options.dynamicWindowSize || 8,
      dynamicCooldownWindows: options.dynamicCooldownWindows || 10
    };
    this.reset();
  }

  reset(context = {}) {
    const baselineGenreId = String(context.baselineGenreId || '');
    const memoryPrior = context.memoryPrior && typeof context.memoryPrior === 'object'
      ? context.memoryPrior
      : null;
    const memoryBaselineGenreId = memoryPrior?.fullPlaybackEvidence === true
      ? String(memoryPrior.genreId || '')
      : '';
    const useMemoryBaseline = Boolean(memoryBaselineGenreId)
      && !isBroadAudioGenre(memoryBaselineGenreId);
    const useExternalBaseline = !useMemoryBaseline
      && !isBroadAudioGenre(baselineGenreId)
      && (context.dynamicEnabled === true || hasAudioGenreCompatibilityProfile(baselineGenreId));
    this.context = {
      dynamicEnabled: context.dynamicEnabled === true,
      fullTrackLearning: context.fullTrackLearning === true,
      priorGenreIds: new Set((context.priorGenreIds || []).filter(Boolean)),
      guardGenreIds: new Set((context.guardGenreIds || []).filter(Boolean)),
      memoryPrior,
      baselineGenreId
    };
    this.acceptedWindows = 0;
    this.winnerHistory = [];
    this.trackWinnerHistory = [];
    this.familyWinnerHistory = [];
    this.trackFamilyWinnerHistory = [];
    this.baselineSupportHistory = [];
    this.currentId = useExternalBaseline
      ? baselineGenreId
      : useMemoryBaseline ? memoryBaselineGenreId : '';
    this.externalBaseline = useExternalBaseline;
    this.externalBaselineGenreId = useExternalBaseline ? baselineGenreId : '';
    this.memoryBaseline = useMemoryBaseline;
    this.memoryBaselineGenreId = useMemoryBaseline ? memoryBaselineGenreId : '';
    this.broadBaselineId = '';
    this.confirmed = this.externalBaseline || this.memoryBaseline;
    this.correctionCount = 0;
    this.finalCorrectionCount = 0;
    this.analysisWindowLimit = this.options.correctionWindowLimit;
    this.dynamicSwitchCount = 0;
    this.lastSwitchWindow = this.currentId ? 0 : -Infinity;
    this.lastResult = null;
  }

  setContext(context = {}) {
    this.context.dynamicEnabled = context.dynamicEnabled === true;
    this.context.fullTrackLearning = context.fullTrackLearning === true;
    this.context.priorGenreIds = new Set((context.priorGenreIds || []).filter(Boolean));
    this.context.guardGenreIds = new Set((context.guardGenreIds || []).filter(Boolean));
    this.context.memoryPrior = context.memoryPrior && typeof context.memoryPrior === 'object'
      ? context.memoryPrior
      : null;
    this.context.baselineGenreId = String(context.baselineGenreId || '');
    const memoryBaselineGenreId = this.context.memoryPrior?.fullPlaybackEvidence === true
      ? String(this.context.memoryPrior.genreId || '')
      : '';
    const canAdoptMemoryBaseline = Boolean(memoryBaselineGenreId)
      && !isBroadAudioGenre(memoryBaselineGenreId)
      && this.dynamicSwitchCount === 0
      && (this.acceptedWindows === 0 || this.externalBaseline || this.memoryBaseline);
    if (canAdoptMemoryBaseline
      && !(this.memoryBaseline && this.currentId === memoryBaselineGenreId)) {
      this.currentId = memoryBaselineGenreId;
      this.externalBaseline = false;
      this.externalBaselineGenreId = '';
      this.memoryBaseline = true;
      this.memoryBaselineGenreId = memoryBaselineGenreId;
      this.broadBaselineId = '';
      this.confirmed = true;
      this.lastSwitchWindow = this.acceptedWindows;
    }
    const baselineGenreId = this.context.baselineGenreId;
    const canAdoptBaseline = !this.memoryBaseline
      && (this.context.dynamicEnabled
        || hasAudioGenreCompatibilityProfile(baselineGenreId))
      && !isBroadAudioGenre(baselineGenreId)
      && this.dynamicSwitchCount === 0;
    if (canAdoptBaseline && !(this.externalBaseline && this.currentId === baselineGenreId)) {
      this.currentId = baselineGenreId;
      this.externalBaseline = true;
      this.externalBaselineGenreId = baselineGenreId;
      this.memoryBaseline = false;
      this.memoryBaselineGenreId = '';
      this.broadBaselineId = '';
      this.confirmed = true;
      this.lastSwitchWindow = this.acceptedWindows;
    }
  }

  event(stage, result, extra = {}) {
    return {
      stage,
      genreId: result.id,
      confidence: result.confidence,
      margin: result.margin,
      acceptedWindows: this.acceptedWindows,
      analysisWindowLimit: this.analysisWindowLimit,
      correctionCount: this.correctionCount,
      finalCorrectionCount: this.finalCorrectionCount,
      memoryPriorGenreId: result.memoryPriorGenreId || '',
      memoryPriorWeight: Number(result.memoryPriorWeight) || 0,
      currentGenreId: this.currentId,
      confirmed: this.confirmed,
      ...extra
    };
  }

  accept(stage, result, extra = {}) {
    const previousGenreId = this.currentId || this.broadBaselineId;
    if (['first', 'refinement'].includes(stage)) {
      this.analysisWindowLimit = Math.max(
        this.analysisWindowLimit,
        this.acceptedWindows + this.options.postFirstCorrectionWindows
      );
    }
    if (stage === 'correction' && this.correctionCount === 0) {
      this.analysisWindowLimit = Math.max(
        this.analysisWindowLimit,
        this.acceptedWindows + this.options.postFirstCorrectionWindows
      );
    }
    this.currentId = result.id;
    this.externalBaseline = false;
    this.memoryBaseline = false;
    this.broadBaselineId = '';
    this.confirmed = false;
    this.lastSwitchWindow = this.acceptedWindows;
    if (stage === 'correction') {
      this.correctionCount += 1;
      if (extra.correctionEvidence === 'cumulative-final') this.finalCorrectionCount += 1;
    }
    if (stage === 'dynamic') this.dynamicSwitchCount += 1;
    return this.event(stage, result, { previousGenreId, ...extra });
  }

  push({ shortResult, trackResult, segmentResult = trackResult }) {
    if (!shortResult?.id || !trackResult?.id) throw new Error('Genre decisions require short and track results');
    this.acceptedWindows += 1;
    trackResult = applyAudioGenreMemoryPrior(
      trackResult,
      this.context.memoryPrior,
      this.acceptedWindows
    );
    const shortFamilyResult = audioGenreFamilyResult(shortResult);
    const trackFamilyResult = audioGenreFamilyResult(trackResult);
    const segmentFamilyResult = audioGenreFamilyResult(segmentResult);
    this.winnerHistory.push(shortResult.id);
    this.trackWinnerHistory.push(trackResult.id);
    this.familyWinnerHistory.push(shortFamilyResult.id);
    this.trackFamilyWinnerHistory.push(trackFamilyResult.id);
    if (this.winnerHistory.length > 24) this.winnerHistory.shift();
    if (this.trackWinnerHistory.length > 24) this.trackWinnerHistory.shift();
    if (this.familyWinnerHistory.length > 24) this.familyWinnerHistory.shift();
    if (this.trackFamilyWinnerHistory.length > 24) this.trackFamilyWinnerHistory.shift();
    const compatibilityBaselineId = audioGenreCompatibilityId(this.externalBaselineGenreId);
    const baselineSupportScore = compatibilityBaselineId
      ? audioGenreSupportScore(segmentResult, compatibilityBaselineId)
      : 0;
    const currentSupportScore = this.currentId
      ? audioGenreSupportScore(segmentResult, this.currentId)
      : 0;
    const baselineSupportAdvantage = baselineSupportScore - currentSupportScore;
    const baselineSupportWinner = compatibilityBaselineId
      && this.currentId !== compatibilityBaselineId
      && baselineSupportScore >= COMPATIBILITY_SUPPORT_MIN_CONFIDENCE
      && baselineSupportAdvantage >= COMPATIBILITY_SUPPORT_MIN_ADVANTAGE
      ? compatibilityBaselineId
      : '';
    this.baselineSupportHistory.push(baselineSupportWinner);
    if (this.baselineSupportHistory.length > 24) this.baselineSupportHistory.shift();
    this.lastResult = trackResult;

    if (!this.currentId) {
      const candidate = trackFamilyResult.id;
      const stableThree = this.acceptedWindows >= this.options.earliestWindows
        && agreementRatio(this.trackFamilyWinnerHistory, candidate, this.options.earliestWindows) === 1;
      const priorAgreement = [...this.context.priorGenreIds]
        .some((id) => normalizeAudioGenreTreeId(id) === candidate);
      // Exact external support keeps the fast path. Audio-only evidence waits
      // through the intro and must still agree with the current segment.
      const recentCandidateCompatible = segmentFamilyResult.id === candidate
        || isBroadAudioGenre(segmentFamilyResult.id);
      const firstWarmupReady = priorAgreement
        || (this.acceptedWindows >= this.options.independentFirstWindows
          && recentCandidateCompatible);
      const recentAgreement = this.acceptedWindows > this.options.recentWindowSize
        && segmentFamilyResult.id === candidate
        && segmentFamilyResult.confidence >= SUPPORTED_MIN_CONFIDENCE
        && segmentFamilyResult.margin >= SUPPORTED_MIN_MARGIN
        && agreementRatio(this.familyWinnerHistory, candidate, 5) >= 0.8;
      const strong = stableThree
        && trackFamilyResult.confidence >= STRONG_MIN_CONFIDENCE
        && trackFamilyResult.margin >= STRONG_MIN_MARGIN;
      const supportedByRecent = stableThree
        && recentAgreement
        && trackFamilyResult.confidence >= SUPPORTED_MIN_CONFIDENCE
        && trackFamilyResult.margin >= SUPPORTED_MIN_MARGIN;
      const supportedByPrior = stableThree
        && priorAgreement
        && trackFamilyResult.confidence >= SUPPORTED_MIN_CONFIDENCE
        && trackFamilyResult.margin >= SUPPORTED_MIN_MARGIN;
      const medium = this.acceptedWindows >= this.options.mediumWindows
        && trackFamilyResult.confidence >= STABLE_MIN_CONFIDENCE
        && trackFamilyResult.margin >= STABLE_MIN_MARGIN
        && agreementRatio(this.trackFamilyWinnerHistory, candidate, this.options.mediumWindows) >= 5 / 6;
      const persistentLowScore = this.acceptedWindows >= this.options.firstPersistentWindows
        && hasPersistentLowScoreLead(trackFamilyResult)
        && agreementRatio(
          this.trackFamilyWinnerHistory,
          candidate,
          this.options.firstPersistentWindows
        ) >= 0.9;
      const firstResultReady = strong
        || supportedByRecent
        || supportedByPrior
        || medium
        || persistentLowScore;
      const ambientIntroGuardReady = candidate !== 'ambient'
        || priorAgreement
        || (this.acceptedWindows >= AMBIENT_FIRST_MIN_WINDOWS
          && segmentFamilyResult.id === 'ambient'
          && agreementRatio(
            this.familyWinnerHistory,
            'ambient',
            AMBIENT_FIRST_RECENT_WINDOWS
          ) >= AMBIENT_FIRST_RECENT_AGREEMENT);
      const authorPriorGate = authorPriorEvidenceGate({
        candidate,
        result: trackFamilyResult,
        history: this.trackFamilyWinnerHistory,
        acceptedWindows: this.acceptedWindows,
        guardGenreIds: this.context.guardGenreIds
      });
      const recentConflictCandidate = segmentFamilyResult.id;
      const standardRecentConflict = segmentFamilyResult.confidence >= SUPPORTED_MIN_CONFIDENCE
        && segmentFamilyResult.margin >= SUPPORTED_MIN_MARGIN;
      const persistentRecentConflict = hasPersistentLowScoreLead(segmentFamilyResult)
        && agreementRatio(this.familyWinnerHistory, recentConflictCandidate, 8) >= 0.75;
      const strongRecentConflict = this.acceptedWindows > this.options.recentWindowSize
        && !isBroadAudioGenre(candidate)
        && !isBroadAudioGenre(recentConflictCandidate)
        && recentConflictCandidate !== candidate
        && (standardRecentConflict || persistentRecentConflict)
        && agreementRatio(this.familyWinnerHistory, recentConflictCandidate, 5) >= 0.8;
      if (isBroadAudioGenre(candidate)
        && this.acceptedWindows >= this.options.mediumWindows) {
        this.broadBaselineId = candidate;
      }
      if (firstResultReady
        && firstWarmupReady
        && ambientIntroGuardReady
        && authorPriorGate.ready
        && !isBroadAudioGenre(candidate)
        && !strongRecentConflict) {
        return this.accept('first', trackFamilyResult, {
          supportedByRecent,
          authorPriorDistance: authorPriorGate.distance,
          supportedByRelativeLead: persistentLowScore
            && !strong
            && !supportedByRecent
            && !supportedByPrior
            && !medium
        });
      }

      // Recent evidence never selects the first track-level result. It can only
      // refine a broad cumulative baseline after that baseline has had time to form.
      const refinementCandidate = shortFamilyResult.id;
      const standardRefinementEvidence = shortFamilyResult.confidence >= STABLE_MIN_CONFIDENCE
        && shortFamilyResult.margin >= STABLE_MIN_MARGIN
        && agreementRatio(this.familyWinnerHistory, refinementCandidate, 5) >= 0.8;
      const persistentRefinementEvidence = this.acceptedWindows >= this.options.relativeLeadWindows
        && hasPersistentLowScoreLead(shortFamilyResult)
        && agreementRatio(this.familyWinnerHistory, refinementCandidate, 8) >= 0.75;
      const refinementWarmupReady = [...this.context.priorGenreIds]
        .some((id) => normalizeAudioGenreTreeId(id) === refinementCandidate)
        || this.acceptedWindows >= this.options.independentFirstWindows;
      const broadRefinementReady = isBroadAudioGenre(this.broadBaselineId)
        && this.broadBaselineId
        && !isBroadAudioGenre(refinementCandidate)
        && refinementWarmupReady
        && (standardRefinementEvidence || persistentRefinementEvidence);
      const refinementAuthorPriorGate = authorPriorEvidenceGate({
        candidate: refinementCandidate,
        result: shortFamilyResult,
        history: this.familyWinnerHistory,
        acceptedWindows: this.acceptedWindows,
        guardGenreIds: this.context.guardGenreIds
      });
      if (broadRefinementReady && refinementAuthorPriorGate.ready) {
        return this.accept('refinement', shortFamilyResult, {
          authorPriorDistance: refinementAuthorPriorGate.distance,
          supportedByRelativeLead: persistentRefinementEvidence && !standardRefinementEvidence
        });
      }
      if (firstResultReady && isBroadAudioGenre(candidate)) {
        this.broadBaselineId = candidate;
        return candidate === 'electronic'
          ? this.event('provisional', trackFamilyResult, { priorAgreement })
          : this.event('waiting', trackFamilyResult, { priorAgreement });
      }
      return this.event('waiting', trackFamilyResult, {
        authorPriorDistance: authorPriorGate.distance,
        priorAgreement,
        recentConflictGenreId: strongRecentConflict ? recentConflictCandidate : ''
      });
    }

    const currentFamilyId = normalizeAudioGenreTreeId(this.currentId);
    const trackCurrentFamilyResult = audioGenreResultForFamily(trackResult, currentFamilyId);
    const segmentCurrentFamilyResult = audioGenreResultForFamily(segmentResult, currentFamilyId);
    const hierarchicalResult = this.context.dynamicEnabled
      ? segmentCurrentFamilyResult
      : trackCurrentFamilyResult;
    const hierarchicalHistory = this.context.dynamicEnabled
      ? this.winnerHistory
      : this.trackWinnerHistory;
    const hierarchicalCandidate = hierarchicalResult.id;
    const hierarchicalCandidateFamily = normalizeAudioGenreTreeId(hierarchicalCandidate);
    const hierarchicalWindow = 8;
    const hierarchicalPersistent = agreementRatio(
      hierarchicalHistory,
      hierarchicalCandidate,
      hierarchicalWindow
    ) >= 7 / 8;
    const hierarchicalCooldownComplete = !this.context.dynamicEnabled
      || this.acceptedWindows - this.lastSwitchWindow >= DYNAMIC_HIERARCHICAL_COOLDOWN_WINDOWS;
    const canRefineCurrentFamily = this.currentId === currentFamilyId
      && hierarchicalCandidate !== this.currentId
      && hierarchicalCandidateFamily === currentFamilyId
      && !isBroadAudioGenre(hierarchicalCandidate)
      && this.acceptedWindows >= hierarchicalWindow
      && hierarchicalResult.confidence >= HIERARCHICAL_MIN_CONFIDENCE
      && audioGenreSiblingMargin(hierarchicalResult, hierarchicalCandidate)
        >= HIERARCHICAL_MIN_MARGIN
      && hierarchicalPersistent
      && hierarchicalCooldownComplete
      && (this.context.dynamicEnabled || !this.memoryBaseline)
      && (this.context.dynamicEnabled
        || this.context.fullTrackLearning
        || this.acceptedWindows <= this.analysisWindowLimit);
    if (canRefineCurrentFamily) {
      return this.accept(this.context.dynamicEnabled ? 'dynamic' : 'refinement', hierarchicalResult, {
        hierarchicalRefinement: true,
        parentGenreId: currentFamilyId,
        siblingMargin: audioGenreSiblingMargin(hierarchicalResult, hierarchicalCandidate)
      });
    }

    const cumulativeCrossesFamily = trackFamilyResult.id !== currentFamilyId;
    const cumulativeCorrectionResult = cumulativeCrossesFamily
      ? trackFamilyResult
      : trackCurrentFamilyResult;
    const cumulativeCorrectionHistory = cumulativeCrossesFamily
      ? this.trackFamilyWinnerHistory
      : this.trackWinnerHistory;
    const cumulativeCorrectionCandidate = cumulativeCorrectionResult.id;
    const cumulativeCorrectionMatchesPrior = [...this.context.priorGenreIds].some((id) => (
      cumulativeCrossesFamily
        ? normalizeAudioGenreTreeId(id) === cumulativeCorrectionCandidate
        : id === cumulativeCorrectionCandidate
    ));
    const fullTrackLearning = !this.context.dynamicEnabled && this.context.fullTrackLearning;
    const finalCumulativeCorrection = !fullTrackLearning
      && this.correctionCount === 1
      && this.finalCorrectionCount < 1;
    const cumulativeCorrectionWindow = fullTrackLearning || finalCumulativeCorrection
      ? STATIC_FINAL_CORRECTION_WINDOW
      : STATIC_CORRECTION_WINDOW;
    const cumulativeCorrectionPersistent = agreementRatio(
      cumulativeCorrectionHistory,
      cumulativeCorrectionCandidate,
      cumulativeCorrectionWindow
    ) >= (fullTrackLearning || finalCumulativeCorrection
      ? STATIC_FINAL_CORRECTION_AGREEMENT
      : STATIC_CORRECTION_AGREEMENT);
    // A cumulative winner already outranks the adopted genre in the same score
    // distribution. Require persistence plus a small noise floor instead of a
    // second, large lead threshold that blocks corrections between close styles.
    const cumulativeCorrectionQualified = cumulativeCorrectionResult.confidence
        >= STATIC_CORRECTION_MIN_CONFIDENCE
      && cumulativeCorrectionResult.margin >= STATIC_CORRECTION_MIN_MARGIN;
    const cumulativeCurrentScore = audioGenreSupportScore(
      cumulativeCorrectionResult,
      cumulativeCrossesFamily ? currentFamilyId : this.currentId
    );
    const cumulativeAdvantage = cumulativeCorrectionResult.confidence - cumulativeCurrentScore;
    const correctingCompatibilityBaseline = this.externalBaseline
      && hasAudioGenreCompatibilityProfile(this.currentId);
    const compatibilityBaselineCorrectionReady = !correctingCompatibilityBaseline
      || (this.acceptedWindows >= 12
        && agreementRatio(cumulativeCorrectionHistory, cumulativeCorrectionCandidate, 12) >= 11 / 12
        && cumulativeCorrectionResult.confidence >= COMPATIBILITY_CORRECTION_MIN_CONFIDENCE
        && cumulativeCorrectionResult.margin >= COMPATIBILITY_CORRECTION_MIN_MARGIN
        && cumulativeAdvantage >= COMPATIBILITY_CORRECTION_MIN_ADVANTAGE);
    const waitingForHierarchicalRefinement = this.currentId === currentFamilyId
      && !cumulativeCrossesFamily
      && cumulativeCorrectionCandidate !== this.currentId;
    // Static detection assigns one genre to the track, so only cumulative
    // evidence may revise it. Dynamic detection handles section changes below.
    if (!this.context.dynamicEnabled
      && !this.memoryBaseline
      && cumulativeCorrectionCandidate !== this.currentId
      && !isBroadAudioGenre(cumulativeCorrectionCandidate)
      && !waitingForHierarchicalRefinement
      && (!this.externalBaseline || correctingCompatibilityBaseline)
      && (fullTrackLearning || this.correctionCount < 1 || finalCumulativeCorrection)
      && this.dynamicSwitchCount < 1
      && (fullTrackLearning || this.acceptedWindows <= this.analysisWindowLimit)
      && this.acceptedWindows >= Math.max(finalCumulativeCorrection ? 18 : 8, cumulativeCorrectionWindow)
      && (!fullTrackLearning || this.acceptedWindows - this.lastSwitchWindow >= STATIC_FINAL_CORRECTION_WINDOW)
      && (!finalCumulativeCorrection || this.acceptedWindows - this.lastSwitchWindow >= 6)
      && cumulativeCorrectionPersistent
      && compatibilityBaselineCorrectionReady
      && cumulativeCorrectionQualified) {
      return this.accept('correction', cumulativeCorrectionResult, {
        correctionEvidence: fullTrackLearning
          ? 'cumulative-full-track'
          : finalCumulativeCorrection ? 'cumulative-final' : 'cumulative',
        supportedByPrior: cumulativeCorrectionMatchesPrior,
        familyLevelDecision: cumulativeCrossesFamily
      });
    }

    const dynamicCrossesFamily = segmentFamilyResult.id !== currentFamilyId;
    const dynamicResult = dynamicCrossesFamily
      ? segmentFamilyResult
      : segmentCurrentFamilyResult;
    const dynamicHistory = dynamicCrossesFamily ? this.familyWinnerHistory : this.winnerHistory;
    const dynamicCandidate = dynamicResult.id;
    const currentSegmentScore = audioGenreSupportScore(
      dynamicResult,
      dynamicCrossesFamily ? currentFamilyId : this.currentId
    );
    const dynamicAdvantage = dynamicResult.confidence - currentSegmentScore;
    const dynamicPersistent = agreementRatio(
      dynamicHistory,
      dynamicCandidate,
      this.options.dynamicWindowSize
    ) >= 0.75;
    const relativeDynamicPersistent = this.acceptedWindows >= this.options.relativeLeadWindows
      && agreementRatio(dynamicHistory, dynamicCandidate, this.options.relativeLeadWindows) >= 0.8;
    const cooldownComplete = this.acceptedWindows - this.lastSwitchWindow
      >= this.options.dynamicCooldownWindows;
    const compatibilityBaselineRestored = this.context.dynamicEnabled
      && compatibilityBaselineId
      && this.currentId !== compatibilityBaselineId
      && cooldownComplete
      && agreementRatio(
        this.baselineSupportHistory,
        compatibilityBaselineId,
        this.options.dynamicWindowSize
      ) >= 0.75;
    if (compatibilityBaselineRestored) {
      return this.accept('dynamic', resultForGenreSupport(
        segmentResult,
        compatibilityBaselineId,
        baselineSupportScore,
        baselineSupportAdvantage
      ), {
        restoredBaseline: true,
        inferredFromCompatibility: true
      });
    }
    const standardDynamicQualified = dynamicResult.confidence
        >= (dynamicCrossesFamily
          ? DYNAMIC_FAMILY_MIN_CONFIDENCE
          : DYNAMIC_LEAF_MIN_CONFIDENCE)
      && dynamicResult.margin >= (dynamicCrossesFamily
        ? DYNAMIC_FAMILY_MIN_MARGIN
        : DYNAMIC_LEAF_MIN_MARGIN)
      && dynamicAdvantage >= (dynamicCrossesFamily
        ? DYNAMIC_FAMILY_MIN_ADVANTAGE
        : DYNAMIC_LEAF_MIN_ADVANTAGE)
      && dynamicPersistent;
    const persistentLowScoreQualified = hasPersistentLowScoreLead(dynamicResult)
      && dynamicAdvantage >= DYNAMIC_PERSISTENT_MIN_ADVANTAGE
      && relativeDynamicPersistent;
    const waitingForDynamicHierarchicalRefinement = this.currentId === currentFamilyId
      && !dynamicCrossesFamily
      && dynamicCandidate !== this.currentId;
    const ambientMemoryChallengeReady = dynamicCandidate !== 'ambient'
      || !this.memoryBaseline
      || (this.acceptedWindows >= AMBIENT_FIRST_MIN_WINDOWS
        && segmentFamilyResult.id === 'ambient'
        && agreementRatio(
          this.familyWinnerHistory,
          'ambient',
          AMBIENT_FIRST_RECENT_WINDOWS
        ) >= AMBIENT_FIRST_RECENT_AGREEMENT);
    if (this.context.dynamicEnabled
      && !isBroadAudioGenre(dynamicCandidate)
      && dynamicCandidate !== this.currentId
      && !waitingForDynamicHierarchicalRefinement
      && this.acceptedWindows >= this.options.dynamicWindowSize
      && (standardDynamicQualified || persistentLowScoreQualified)
      && ambientMemoryChallengeReady
      && cooldownComplete) {
      return this.accept('dynamic', dynamicResult, {
        familyLevelDecision: dynamicCrossesFamily,
        supportedByPersistentLowScore: persistentLowScoreQualified && !standardDynamicQualified,
        supportedByRelativeLead: persistentLowScoreQualified && !standardDynamicQualified
      });
    }

    const steadyResult = this.currentId === currentFamilyId
      ? trackFamilyResult
      : trackCurrentFamilyResult;
    const steadyHistory = this.currentId === currentFamilyId
      ? this.familyWinnerHistory
      : this.winnerHistory;
    if (steadyResult.id === this.currentId) {
      if (!this.confirmed
        && this.acceptedWindows >= this.options.confirmationWindows
        && steadyResult.margin >= CONFIRMATION_MIN_MARGIN
        && agreementRatio(steadyHistory, this.currentId, this.options.confirmationWindows) >= 0.75) {
        this.confirmed = true;
        return this.event('confirmed', steadyResult);
      }
      return this.event('steady', steadyResult);
    }

    return this.event('challenger', cumulativeCorrectionResult, {
      challengerGenreId: cumulativeCorrectionCandidate,
      challengerLeafGenreId: trackResult.id,
      segmentGenreId: segmentResult.id,
      segmentFamilyGenreId: segmentFamilyResult.id
    });
  }
}

class GenreScoreSmoother {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 3;
    this.holdCount = options.holdCount || 3;
    this.minimumConfidence = options.minimumConfidence ?? LOW_SCORE_MIN_CONFIDENCE;
    this.minimumMargin = options.minimumMargin ?? LOW_SCORE_MIN_MARGIN;
    this.history = [];
    this.lastId = '';
    this.streak = 0;
  }

  push(result) {
    this.history.push(result.scores);
    if (this.history.length > this.windowSize) this.history.shift();
    const ids = new Set(this.history.flatMap((scores) => Object.keys(scores)));
    const scores = {};
    for (const id of ids) scores[id] = median(this.history.map((entry) => entry[id] || 0));
    const smoothed = resultFromScores(scores);
    if (smoothed.id === this.lastId) this.streak += 1;
    else {
      this.lastId = smoothed.id;
      this.streak = 1;
    }
    smoothed.streak = this.streak;
    smoothed.stable = this.streak >= this.holdCount
      && smoothed.confidence >= this.minimumConfidence
      && smoothed.margin >= this.minimumMargin;
    return smoothed;
  }
}

function fuseGenreEvidence({ metadata, audio }) {
  const metadataResult = metadata || { id: 'unknown', confidence: 0, source: 'unknown' };
  if (!audio?.stable) return { ...metadataResult, chosenBy: 'metadata' };
  const fallbackSources = new Set(['unknown', 'default', 'title', 'artist-map', 'artist-fallback']);
  const broadMetadata = ['unknown', 'electronic'].includes(metadataResult.id);
  const audioIsUsable = audio.confidence >= LOW_SCORE_MIN_CONFIDENCE
    && audio.margin >= LOW_SCORE_MIN_MARGIN;
  if ((broadMetadata || fallbackSources.has(metadataResult.source)) && audioIsUsable) {
    return { ...audio, source: 'audio-model', chosenBy: 'audio' };
  }
  if (metadataResult.id === audio.id) {
    return {
      ...metadataResult,
      confidence: Math.max(metadataResult.confidence || 0, audio.confidence),
      audioConfirmed: true,
      chosenBy: 'agreement'
    };
  }
  return { ...metadataResult, audioAlternative: audio, chosenBy: 'metadata' };
}

module.exports = {
  FRAME_SIZE,
  GenreScoreSmoother,
  GenreDecisionTracker,
  HOP_SIZE,
  MEMORY_PRIOR_EQUIVALENT_WINDOWS,
  MEMORY_PRIOR_HORIZON_WINDOWS,
  MEL_BANDS,
  MusiCnnMelExtractor,
  PATCH_FRAMES,
  PATCH_HOP,
  SAMPLE_RATE,
  STATIC_ANALYSIS_WINDOW_LIMIT,
  audioGenreCompatibilityScores,
  audioGenreFamilyResult,
  audioGenreFamilyScores,
  audioGenreModelOutputIds,
  audioGenreResultForFamily,
  audioGenreSiblingMargin,
  audioGenreSupportScore,
  aggregateGenreScores,
  applyAudioGenreMemoryPrior,
  allPatchStarts,
  audioGenreTreeDistance,
  buildMusiCnnMelFilterbank,
  buildPatchTensor,
  decodeWav,
  discogsClassToMajor,
  fuseGenreEvidence,
  hasSignificantPlaybackSeek,
  hasAudioGenreCompatibilityProfile,
  isBroadAudioGenre,
  meanActivationRows,
  medianActivationRows,
  resampleWindowedSinc,
  shouldAnalyzeAudioGenre,
  shouldKeepGenreIdentifying,
  shouldReplaceMetadataWithAudioGenre,
  selectPatchStarts,
  summarizeActivationRows
};
