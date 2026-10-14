'use strict';

// Beat-stage adaptation of Mojtaba Heydari's BeatNet particle_filtering_cascade.py
// 81cedd4beeb7235262db80969a0c9ce9a48a0ed4, CC BY 4.0.
// https://github.com/mjhydri/BeatNet
// Changes: fixed-size buffers, bounded rejuvenation, no meter/downbeat stage,
// audio-frame clock, and reset on discontinuities. No Python runtime required.
class BeatParticleFilter {
  constructor({ random = Math.random, size = 1500 } = {}) {
    this.random = random;
    this.size = size;
    this.first = [];
    this.interval = [];
    this.position = [];
    // BeatNet defaults: 50 Hz, 55–215 BPM, B56 observation, lambda=60.
    for (let period = 14; period <= 55; period++) {
      this.first.push(this.interval.length);
      for (let phase = 0; phase < period; phase++) {
        this.interval.push(period);
        this.position.push(phase);
      }
    }
    this.transitions = this.first.map((_, index) => {
      const from = index + 14;
      const weights = this.first.map((__, to) => Math.exp(-60 * Math.abs((to + 14) / from - 1)));
      const sum = weights.reduce((a, b) => a + b, 0);
      let total = 0;
      return Float64Array.from(weights, w => total += w / sum);
    });
    this.particles = new Uint16Array(size);
    this.scratch = new Uint16Array(size);
    this.weights = new Float64Array(size);
    this.counts = new Uint16Array(this.interval.length);
    this.reset();
  }
  reset() {
    for (let i = 0; i < this.size; i++) this.particles[i] = Math.floor(this.random() * this.interval.length);
    this.frame = -1;
    this.lastBeat = -Infinity;
    this.serial = 0;
    this.quiet = 0;
  }
  update(beat, downbeat) {
    const raw = Math.max(0, Math.min(1, Math.max(Number(beat) || 0, Number(downbeat) || 0)));
    const activation = raw >= .4 ? raw : .03;
    // A long evidence-free interval must not preserve an unrelated old tempo.
    if (activation === .03) this.quiet++;
    else this.quiet = 0;
    if (this.quiet === 150) {
      const serial = this.serial;
      this.reset(); this.serial = serial; this.quiet = 150;
    }
    this.frame++;
    for (let i = 0; i < this.size; i++) {
      const state = this.particles[i], interval = this.interval[state];
      if (this.position[state] + 1 < interval) this.particles[i] = state + 1;
      else {
        const cdf = this.transitions[interval - 14], draw = this.random();
        let next = 0;
        while (next < cdf.length - 1 && cdf[next] < draw) next++;
        this.particles[i] = this.first[next];
      }
    }
    if (activation > .1) {
      // Rejuvenate <3% across every tempo on meaningful observations. This avoids
      // permanent half-tempo collapse on narrow activations without forcing a beat.
      if (activation > .4) {
        for (let j = 0; j < this.first.length; j++) {
          this.particles[Math.floor(this.random() * this.size)] = this.first[j];
        }
      }
      let total = 0;
      for (let i = 0; i < this.size; i++) {
        const state = this.particles[i];
        total += this.weights[i] = this.position[state] / this.interval[state] < 1 / 56 ? activation : .03;
      }
      let index = 0, cumulative = this.weights[0];
      for (let i = 0; i < this.size; i++) {
        const target = (i + this.random()) * total / this.size;
        while (index < this.size - 1 && cumulative < target) cumulative += this.weights[++index];
        this.scratch[i] = this.particles[index];
      }
      [this.particles, this.scratch] = [this.scratch, this.particles];
    }
    // Decode AFTER correcting this frame: testing pre-transition phase against
    // current activation loses narrow one-frame peaks at the cycle boundary.
    this.counts.fill(0);
    for (const state of this.particles) this.counts[state]++;
    let count = 0, gathering = 0;
    while (gathering < this.counts.length - 1 && (count += this.counts[gathering]) < this.size / 2) gathering++;
    const period = this.interval[gathering];
    const peak = this.position[gathering] < 4 && this.frame - this.lastBeat > .4 * period && activation > .4;
    if (peak) { this.lastBeat = this.frame; this.serial++; }
    return { trackedBeat: peak, trackedSerial: this.serial, trackedBpm: 3000 / period,
      trackedActivation: peak ? raw : 0, trackedTimeMs: this.frame * 20 };
  }
}

module.exports = { BeatParticleFilter };
