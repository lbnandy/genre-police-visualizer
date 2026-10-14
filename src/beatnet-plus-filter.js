'use strict';

// Beat-stage port of Mojtaba Heydari's BeatNet (CC BY 4.0), revision
// 81cedd4beeb7235262db80969a0c9ce9a48a0ed4, particle_filtering_cascade.py.
// Preserve the upstream PF; EDM timing adds a one-frame boundary tolerance and
// a short, evidence-backed periodicity lock. edmTiming:false is the reference.
// Integration differences: no meter stage; audio-frame timestamps; explicit reset.
// Upstream's discarded np.delete result grows the population on strong frames.
// We remove the added count after resampling to retain the 1500-particle budget.
class BeatParticleFilter {
  constructor({ random = Math.random, size = 1500, edmTiming = true } = {}) {
    this.random = random;
    this.size = size;
    this.edmTiming = edmTiming;
    this.first = [];
    this.interval = [];
    this.position = [];
    for (let period = 14; period <= 55; period++) {
      this.first.push(this.interval.length);
      for (let phase = 0; phase < period; phase++) {
        this.interval.push(period);
        this.position.push(phase);
      }
    }
    this.transitions = this.first.map((_, index) => {
      const weights = this.first.map((__, to) => {
        const weight = Math.exp(-60 * Math.abs((to + 14) / (index + 14) - 1));
        return weight <= Number.EPSILON ? 0 : weight;
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      let total = 0;
      return Float64Array.from(weights, w => total += w / sum);
    });
    this.reset();
  }

  reset() {
    // Match np.choice(arange(0, num_states - 1)), including its exclusive bound.
    this.particles = Array.from({ length: this.size }, () =>
      Math.floor(this.random() * (this.interval.length - 1))).sort((a, b) => a - b);
    this.frame = -1;
    this.lastBeat = 0; // Upstream starts path with [0, 0].
    this.serial = 0;
    this.previousActivation = 0;
    this.lastObservation = -Infinity;
    this.observationIntervals = [];
    this.lockPeriod = 0;
    this.lockAnchor = -Infinity;
    this.weakBeats = 0;
    this.lastStrongAnchor = -Infinity;
  }

  updateTiming(activation) {
    // No synthetic beats: only a fresh model activation can advance this clock.
    if (this.frame - this.lockAnchor > 2 * this.lockPeriod ||
        this.frame - this.lastStrongAnchor > 2.5 * this.lockPeriod) this.lockPeriod = 0;
    const previous = this.previousActivation;
    const rising = activation > .4 && this.previousActivation <= .4;
    this.previousActivation = activation;
    // A weak model pulse can support an established beat, but cannot acquire
    // tempo or sustain the clock indefinitely. Require local contrast and phase
    // agreement; never fill an empty grid position just because time elapsed.
    if (this.lockPeriod && activation > .25 && activation <= .4 &&
        previous <= .25 && activation - previous >= .08 && this.weakBeats < 2) {
      const elapsed = this.frame - this.lockAnchor;
      const beats = Math.round(elapsed / this.lockPeriod);
      if (beats >= 1 && Math.abs(elapsed - beats * this.lockPeriod) <= 2) {
        this.lockAnchor = this.frame;
        this.weakBeats++;
        return true;
      }
    }
    if (!rising || this.frame - this.lastObservation < 8) return false;
    const interval = this.frame - this.lastObservation;
    this.lastObservation = this.frame;
    if (interval >= 14 && interval <= 55) {
      this.observationIntervals.push(interval);
      if (this.observationIntervals.length > 3) this.observationIntervals.shift();
    } else this.observationIntervals.length = 0;
    if (this.observationIntervals.length === 3) {
      const sorted = [...this.observationIntervals].sort((a, b) => a - b);
      if (sorted[2] - sorted[0] <= 2) {
        this.lockPeriod = sorted[1];
        this.lockAnchor = this.frame;
        this.lastStrongAnchor = this.frame;
        this.weakBeats = 0;
        return true;
      }
    }
    if (!this.lockPeriod) return false;
    const elapsed = this.frame - this.lockAnchor;
    const beats = Math.round(elapsed / this.lockPeriod);
    if (beats >= 1 && Math.abs(elapsed - beats * this.lockPeriod) <= 2) {
      this.lockAnchor = this.frame;
      this.lastStrongAnchor = this.frame;
      this.weakBeats = 0;
      return true;
    }
    return false;
  }

  update(beat, downbeat) {
    const raw = Math.max(0, Math.min(1, Math.max(Number(beat) || 0, Number(downbeat) || 0)));
    const activation = raw >= .4 ? raw : .03;
    this.frame++;
    // Decode the prior population before this frame's motion/correction.
    const ordered = this.particles.slice().sort((a, b) => a - b);
    const middle = ordered.length >> 1;
    const gathering = Math.floor(ordered.length % 2 ? ordered[middle] :
      (ordered[middle - 1] + ordered[middle]) / 2);
    const period = this.interval[gathering];
    // Plus can use only the causal boundary correction, without assuming its
    // more sustained activations share the original model's pulse/lock shape.
    const periodicBeat = this.edmTiming === true && this.updateTiming(raw);
    // The prior population is one frame behind the current observation. Accept
    // its final frame too, so a narrow EDM kick need not stay high for 40 ms.
    // This is a 20 ms phase tolerance, not a free-running beat or a lower gate.
    const inBeatWindow = this.position[gathering] < 4 ||
      (this.edmTiming && this.position[gathering] === period - 1);
    const effectivePeriod = this.lockPeriod || period;
    // Once locked, off-grid activations (fills/syncopation) cannot add impacts.
    const eligible = this.lockPeriod ? periodicBeat : inBeatWindow;
    const peak = eligible &&
      (this.frame * .02 - this.lastBeat) > .4 * .02 * effectivePeriod &&
      (activation > .4 || periodicBeat);
    if (peak) { this.lastBeat = this.frame * .02; this.serial++; }

    // Upstream retains non-boundary particles first, then appends transitions.
    const moved = [], boundaries = [];
    for (const state of this.particles) {
      if (this.position[state] + 1 < this.interval[state]) moved.push(state + 1);
      else boundaries.push(state);
    }
    for (const state of boundaries) {
      const cdf = this.transitions[this.interval[state] - 14], draw = this.random();
      let next = 0;
      while (next < cdf.length - 1 && cdf[next] < draw) next++;
      moved.push(this.first[next]);
    }
    if (activation > .1) {
      let added = 0;
      if (activation > .8) {
        const offset = Math.floor(this.random() * 4);
        for (let j = offset; j < this.first.length; j += 6) {
          moved.push(this.first[j]); added++;
        }
      }
      const cdf = [];
      let total = 0;
      for (const state of moved) {
        total += this.position[state] / this.interval[state] < 1 / 56 ? activation : .03;
        cdf.push(total);
      }
      // Stratified resampling, with one independent uniform draw per stratum.
      const sampled = [];
      let index = 0;
      for (let j = 0; j < moved.length; j++) {
        const target = (j + this.random()) * total / moved.length;
        while (index < moved.length - 1 && cdf[index] < target) index++;
        sampled.push(moved[index]);
      }
      // Sole algorithmic maintenance fix: discard exactly the added population.
      // Sampling indices without replacement avoids a biased tail truncation.
      const removed = new Set();
      while (removed.size < added) removed.add(Math.floor(this.random() * sampled.length));
      this.particles = sampled.filter((_, index) => !removed.has(index));
    } else this.particles = moved;
    return { trackedBeat: peak, trackedSerial: this.serial, trackedBpm: 3000 / effectivePeriod,
      trackedActivation: peak ? raw : 0, trackedTimeMs: this.frame * 20 };
  }
}

module.exports = { BeatParticleFilter };
