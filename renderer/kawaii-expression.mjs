const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function kawaiiEnergyScore(metrics = {}) {
  const body = clamp(
    (metrics.bass || 0) * 0.28
    + (metrics.lowMid || 0) * 0.18
    + (metrics.mid || 0) * 0.16
    + (metrics.high || 0) * 0.08,
    0,
    0.5
  ) / 0.5;
  const loudness = clamp(((metrics.volume || 0) - 0.04) / 0.24);
  const relative = clamp(((metrics.relativeEnergy || 0) - 0.85) / 0.9);
  const continuousDrive = clamp(metrics.drive || 0);
  return clamp(loudness * 0.32 + body * 0.34 + relative * 0.18 + continuousDrive * 0.16);
}

export class KawaiiExpressionTracker {
  constructor() {
    this.energy = 0;
    this.expression = 0;
    this.candidateSince = 0;
    this.holdUntil = 0;
    this.excited = false;
  }

  reset() {
    this.energy = 0;
    this.expression = 0;
    this.candidateSince = 0;
    this.holdUntil = 0;
    this.excited = false;
  }

  update(metrics = {}, time = 0, frameScale = 1, active = true) {
    if (!active) {
      this.reset();
      return { energy: 0, expression: 0, excited: false };
    }

    const score = kawaiiEnergyScore(metrics);
    const smoothing = score > this.energy ? 0.12 : 0.025;
    this.energy += (score - this.energy) * (1 - (1 - smoothing) ** Math.max(0.1, frameScale));

    const fullSpectrumBody = (metrics.bass || 0) + (metrics.lowMid || 0) + (metrics.mid || 0);
    const highEnergyEvidence = this.energy >= 0.65
      && (metrics.volume || 0) >= 0.155
      && fullSpectrumBody >= 0.88;

    if (highEnergyEvidence) {
      if (!this.candidateSince) this.candidateSince = time;
      if (time - this.candidateSince >= 280) {
        this.excited = true;
        this.holdUntil = time + 420;
      }
    } else {
      this.candidateSince = 0;
      if (this.excited && time >= this.holdUntil && this.energy < 0.5) this.excited = false;
    }

    const target = this.excited ? clamp(0.72 + (this.energy - 0.65) * 0.85, 0.72, 1) : 0;
    const response = target > this.expression ? 0.085 : 0.035;
    this.expression += (target - this.expression) * (1 - (1 - response) ** Math.max(0.1, frameScale));
    if (this.expression < 0.001) this.expression = 0;

    return {
      energy: clamp(this.energy),
      expression: clamp(this.expression),
      excited: this.excited
    };
  }
}
