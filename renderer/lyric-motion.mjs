const DENSE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;

const graphemes = (text) => {
  if (typeof Intl?.Segmenter === 'function') {
    return [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)]
      .map((entry) => entry.segment);
  }
  return Array.from(text);
};

export function splitLyricUnits(text = '') {
  const value = String(text);
  if (!value) return [];
  if (DENSE_SCRIPT.test(value)) return graphemes(value);
  return value.match(/\s+|[^\s]+/gu) || [];
}

export function buildLyricUnitTimeline(text = '') {
  const chunks = splitLyricUnits(text);
  const weighted = chunks.map((chunk) => {
    const space = /^\s+$/u.test(chunk);
    const length = Math.max(1, graphemes(chunk).length);
    return { text: chunk, space, weight: length * (space ? 0.42 : 1) };
  });
  const total = Math.max(1, weighted.reduce((sum, unit) => sum + unit.weight, 0));
  let cursor = 0;
  return weighted.map((unit) => {
    const start = cursor / total;
    cursor += unit.weight;
    return { ...unit, start, end: cursor / total };
  });
}

export function lyricLineInkWidth({
  firstLeft = 0,
  lastLeft = 0,
  lastWidth = 0,
  containerWidth = 1,
  multiline = false
} = {}) {
  const limit = Math.max(1, Number(containerWidth) || 1);
  const measured = multiline
    ? limit
    : Math.max(1, (Number(lastLeft) || 0) - (Number(firstLeft) || 0) + (Number(lastWidth) || 0));
  return Math.min(measured, limit);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) * 0.5;
}

function estimatedVocalDuration(text = '') {
  const weight = buildLyricUnitTimeline(text)
    .filter((unit) => !unit.space)
    .reduce((sum, unit) => sum + unit.weight, 0);
  return Math.max(1450, Math.min(6500, 900 + weight * 120));
}

export function lyricVisualLeadMs(sweepDurationMs = 0, interludeAfterLine = false) {
  if (interludeAfterLine) return 220;
  const duration = Math.max(800, Number(sweepDurationMs) || 3200);
  // A short visual lead hides the line-change transition and compensates for
  // the typical difference between a line timestamp and audible vocal onset.
  // Sustained lines receive less lead so they do not finish too early.
  return Math.round(Math.max(180, Math.min(360, 360 - Math.max(0, duration - 4800) * 0.05)));
}

export function buildLyricSweepTimeline(lines = [], trackDurationMs = 0) {
  const normalized = Array.isArray(lines)
    ? lines.map((line) => ({ ...line, atMs: Math.max(0, Number(line.atMs) || 0) }))
    : [];
  if (!normalized.length) return [];
  const gaps = normalized.slice(0, -1).map((line, index) => Math.max(0, normalized[index + 1].atMs - line.atMs));
  // Long gaps are likely instrumental passages and must not teach the local
  // timing model that a normal lyric line takes ten or twenty seconds.
  const ordinaryGaps = gaps.filter((gap) => gap >= 850 && gap <= 6500);
  const globalTypical = median(ordinaryGaps) || 3200;

  return normalized.map((line, index) => {
    const nextAt = normalized[index + 1]?.atMs;
    const available = nextAt != null
      ? Math.max(800, nextAt - line.atMs)
      : trackDurationMs > line.atMs
        ? Math.max(800, trackDurationMs - line.atMs)
        : globalTypical;
    const nearby = gaps
      .slice(Math.max(0, index - 3), Math.min(gaps.length, index + 4))
      .filter((gap) => gap >= 850 && gap <= 6500);
    const typical = median(nearby) || globalTypical;
    const vocalEstimate = estimatedVocalDuration(line.text);
    // A 7-9 second line is common in rock/metal when the last word is held.
    // Treating every such gap as an instrumental break makes the sweep finish
    // while the singer is still sustaining the line. Reserve the shortened
    // sweep for clearly longer gaps; without word timestamps, late is less
    // distracting than falsely declaring a sung line complete.
    const interludeThreshold = Math.max(9000, typical * 2.15, vocalEstimate * 1.75);
    const interludeAfterLine = available > interludeThreshold;
    const sweepDurationMs = interludeAfterLine
      ? Math.min(available, Math.max(1450, Math.min(6500, Math.max(vocalEstimate, typical * 0.96))))
      : available;
    return {
      ...line,
      sweepDurationMs,
      interludeAfterLine,
      visualLeadMs: lyricVisualLeadMs(sweepDurationMs, interludeAfterLine)
    };
  });
}

export function lyricUnitMotion(progress, unit, mode = 'electronic') {
  const duration = Math.max(0.001, unit.end - unit.start);
  const raw = (progress - unit.start) / duration;
  const phase = Math.max(0, Math.min(1, raw));
  const active = raw >= 0 && raw <= 1;
  const wave = active ? Math.sin(phase * Math.PI) : 0;
  const softWave = wave * wave * (3 - 2 * wave);
  const rounded = ['future-bass', 'kawaii-bass', 'house', 'trance', 'rnb', 'pop', 'j-pop'].includes(mode);
  const hard = ['hardcore', 'hardstyle', 'metal', 'dubstep', 'trap', 'breakbeat', 'phonk'].includes(mode);
  const lift = rounded ? 3.8 : hard ? 2.6 : 3.2;
  const grow = rounded ? 0.065 : hard ? 0.038 : 0.05;
  return {
    active,
    y: softWave ? -lift * softWave : 0,
    scaleX: 1 + grow * softWave * 0.54,
    scaleY: 1 + grow * softWave,
    brightness: 1 + softWave * (rounded ? 0.42 : 0.32),
    glow: softWave * (rounded ? 9 : 7)
  };
}
