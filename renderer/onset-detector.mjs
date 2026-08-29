const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export class OnsetDetector {
  constructor({ minimumIntervalMs = 65 } = {}) {
    this.minimumIntervalMs = minimumIntervalMs;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.lastOnsetAt = -Infinity;
    this.filteredNovelty = 0;
  }

  update(frame, now) {
    const novelty = Math.max(0, Number(frame.novelty) || 0);
    this.filteredNovelty = this.frames.length
      ? this.filteredNovelty * 0.36 + novelty * 0.64
      : novelty;
    this.frames.push({
      novelty: this.filteredNovelty,
      loudness: Math.max(0, Number(frame.loudness) || 0),
      body: Math.max(0, Number(frame.body) || 0),
      kickiness: clamp(Number(frame.kickiness) || 0),
      kickinessFloor: clamp(Number(frame.kickinessFloor) || 0.39, 0.2, 0.8),
      kickStrengthFloor: clamp(Number(frame.kickStrengthFloor) || 0.47, 0.25, 0.9),
      kickBodyFloor: clamp(Number(frame.kickBodyFloor) || 0.085, 0.05, 0.3),
      activity: clamp(Number(frame.activity) || 0),
      at: now
    });
    if (this.frames.length > 9) this.frames.shift();
    if (this.frames.length < 7) return this.emptyResult();

    // One-frame look-ahead turns a threshold crossing into a true local peak.
    // The short causal median/mean baseline follows changing mastering levels
    // without turning every frame of a long attack into another onset.
    const centerIndex = this.frames.length - 2;
    const center = this.frames[centerIndex];
    const previous = this.frames[centerIndex - 1];
    const next = this.frames[centerIndex + 1];
    const baselineFrames = this.frames.slice(Math.max(0, centerIndex - 5), centerIndex + 1);
    const values = baselineFrames.map((item) => item.novelty);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const dynamicThreshold = median(values) * 1.06 + mean * 0.28 + 0.009;
    const localMaximum = center.novelty > previous.novelty && center.novelty >= next.novelty;
    // General onsets may be kick, snare, clap or another perceptual beat.
    // Low-frequency body remains mandatory only for the separate kick label.
    const energyGate = center.loudness > 0.042 && center.activity > 0.14;
    const intervalGate = center.at - this.lastOnsetAt >= this.minimumIntervalMs;
    const candidateNow = localMaximum && energyGate;
    const candidateNovelty = clamp(
      (center.novelty - dynamicThreshold * 0.52) / Math.max(0.014, dynamicThreshold * 1.18)
    );
    const candidateBody = clamp((center.body - 0.035) / 0.24);
    const candidateStrength = candidateNow
      ? clamp(candidateNovelty * 0.46 + candidateBody * 0.18 + center.activity * 0.2 + center.kickiness * 0.16)
      : 0;
    if (!localMaximum || center.novelty <= dynamicThreshold || !energyGate || !intervalGate) {
      return {
        ...this.emptyResult(),
        candidateNow,
        candidateAt: candidateNow ? center.at : 0,
        candidateStrength,
        threshold: dynamicThreshold,
        novelty: center.novelty
      };
    }

    const excess = clamp((center.novelty - dynamicThreshold) / Math.max(0.018, dynamicThreshold * 1.35));
    const bodyScore = clamp((center.body - 0.055) / 0.23);
    const strength = clamp(excess * 0.56 + bodyScore * 0.26 + center.activity * 0.18);
    const kickStrength = clamp(strength * 0.65 + center.kickiness * 0.35);
    const kickNow = center.kickiness >= center.kickinessFloor
      && center.body >= center.kickBodyFloor
      && kickStrength >= center.kickStrengthFloor;
    this.lastOnsetAt = center.at;
    return {
      onsetNow: true,
      kickNow,
      onsetAt: center.at,
      strength,
      kickStrength,
      candidateNow: true,
      candidateAt: center.at,
      candidateStrength: Math.max(candidateStrength, strength),
      threshold: dynamicThreshold,
      novelty: center.novelty
    };
  }

  emptyResult() {
    return {
      onsetNow: false,
      kickNow: false,
      onsetAt: 0,
      strength: 0,
      kickStrength: 0,
      candidateNow: false,
      candidateAt: 0,
      candidateStrength: 0,
      threshold: 0,
      novelty: 0
    };
  }
}
