const TEMPO_RANGE = { min: 70, max: 210, preferred: 150 };

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function foldTempo(rawBpm, anchor = 0) {
  const target = anchor >= TEMPO_RANGE.min && anchor <= TEMPO_RANGE.max ? anchor : TEMPO_RANGE.preferred;
  const candidates = [0.25, 0.5, 1, 2, 4]
    .map((factor) => rawBpm * factor)
    .filter((candidate) => candidate >= TEMPO_RANGE.min && candidate <= TEMPO_RANGE.max);
  if (!candidates.length) return 0;
  return candidates.sort((left, right) => (
    Math.abs(Math.log2(left / target)) - Math.abs(Math.log2(right / target))
  ))[0];
}

export class TempoTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.samples = [];
    this.stableBpm = 0;
    this.pendingBpm = 0;
    this.pendingHits = 0;
    this.confidence = 0;
    this.regularity = 0;
    this.nextBeatAt = 0;
    this.lastGridBeatAt = 0;
    this.lastOnsetAt = 0;
  }

  addInterval(intervalMs, strength = 1, now = performance.now()) {
    if (intervalMs < 145 || intervalMs > 1600) return this.snapshot();
    this.samples.push({ rawBpm: 60000 / intervalMs, strength: clamp(strength, 0.35, 2.2), at: now });
    this.samples = this.samples.filter((sample) => now - sample.at <= 14000).slice(-40);
    this.recompute(now);
    return this.snapshot();
  }

  trackBeat(now, onsetNow, signal = 1) {
    const period = this.stableBpm ? 60000 / this.stableBpm : 0;
    if (!period || this.confidence < 0.34) {
      if (onsetNow) this.lastOnsetAt = now;
      return Boolean(onsetNow);
    }

    let pulse = false;
    if (onsetNow) {
      this.lastOnsetAt = now;
      if (!this.nextBeatAt) {
        pulse = true;
        this.lastGridBeatAt = now;
        this.nextBeatAt = now + period;
      } else {
        while (this.nextBeatAt < now - period * 0.55) this.nextBeatAt += period;
        const error = now - this.nextBeatAt;
        if (Math.abs(error) <= period * 0.32) {
          if (now - this.lastGridBeatAt > period * 0.45) {
            pulse = true;
            this.lastGridBeatAt = now;
          }
          this.nextBeatAt += period + error * 0.22;
        } else if (now - this.lastGridBeatAt > period * 0.65) {
          pulse = true;
          this.lastGridBeatAt = now;
          this.nextBeatAt = now + period;
        }
      }
    } else if (
      this.nextBeatAt
      && now >= this.nextBeatAt
      && now - this.lastOnsetAt < period * 1.7
      && signal > 0.055
      && this.confidence > 0.5
    ) {
      pulse = true;
      this.lastGridBeatAt = this.nextBeatAt;
      this.nextBeatAt += period;
    }
    return pulse;
  }

  recompute(now = performance.now()) {
    if (!this.samples.length) return;
    const folded = this.samples.map((sample) => ({
      ...sample,
      bpm: foldTempo(sample.rawBpm, this.stableBpm)
    })).filter((sample) => sample.bpm);
    if (!folded.length) return;

    const bins = new Map();
    let totalWeight = 0;
    for (const sample of folded) {
      const recency = Math.exp(-(now - sample.at) / 12000);
      const weight = sample.strength * recency;
      totalWeight += weight;
      const center = Math.round(sample.bpm);
      for (let offset = -2; offset <= 2; offset += 1) {
        const kernel = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.68 : 0.3;
        bins.set(center + offset, (bins.get(center + offset) || 0) + weight * kernel);
      }
    }
    const peak = [...bins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    const cluster = folded.filter((sample) => Math.abs(sample.bpm - peak) <= 4.5);
    const clusterWeight = cluster.reduce((sum, sample) => sum + sample.strength, 0);
    const candidate = clusterWeight
      ? cluster.reduce((sum, sample) => sum + sample.bpm * sample.strength, 0) / clusterWeight
      : peak;
    const support = clusterWeight / Math.max(0.001, folded.reduce((sum, sample) => sum + sample.strength, 0));
    const errors = folded.map((sample) => Math.abs(sample.bpm - candidate) / Math.max(1, candidate)).sort((a, b) => a - b);
    const medianError = errors[Math.floor(errors.length / 2)] || 0;
    this.regularity = clamp(1 - medianError * 8);
    this.confidence = clamp(Math.min(1, folded.length / 8) * (0.45 + support * 0.55) * (0.55 + this.regularity * 0.45));

    if (!this.stableBpm) {
      if (folded.length >= 3 && this.confidence >= 0.24) this.stableBpm = candidate;
      return;
    }

    const difference = Math.abs(candidate - this.stableBpm);
    if (difference <= 3.2) {
      this.stableBpm = this.stableBpm * 0.9 + candidate * 0.1;
      this.pendingBpm = 0;
      this.pendingHits = 0;
    } else if (difference <= 6 && this.confidence > 0.52) {
      this.stableBpm = this.stableBpm * 0.96 + candidate * 0.04;
    } else {
      if (Math.abs(candidate - this.pendingBpm) <= 2.5) this.pendingHits += 1;
      else {
        this.pendingBpm = candidate;
        this.pendingHits = 1;
      }
      if (this.pendingHits >= 5 && this.confidence > 0.5) {
        this.stableBpm = candidate;
        this.pendingBpm = 0;
        this.pendingHits = 0;
      }
    }
  }

  snapshot() {
    return {
      bpm: this.stableBpm ? Math.round(this.stableBpm) : 0,
      confidence: this.confidence,
      regularity: this.regularity,
      sampleCount: this.samples.length
    };
  }
}
