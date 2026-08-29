import { TempoTracker } from './tempo-tracker.mjs';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function nearestGridDistance(at, anchor, period) {
  if (!anchor || !period) return Infinity;
  const steps = Math.round((at - anchor) / period);
  return Math.abs(at - (anchor + steps * period));
}

function pulseSnapshot(intervals) {
  const recent = intervals.slice(-12);
  if (recent.length < 3) return { period: 0, confidence: 0 };
  let best = null;
  recent.forEach((center, centerIndex) => {
    const tolerance = Math.max(24, center * 0.11);
    const members = recent.map((value, index) => ({
      value,
      weight: Math.exp(-(recent.length - 1 - index) / 5.5)
    })).filter((item) => Math.abs(item.value - center) <= tolerance);
    const score = members.reduce((sum, item) => sum + item.weight, 0);
    if (!best || score > best.score || (score === best.score && centerIndex > best.centerIndex)) {
      best = { members, score, centerIndex };
    }
  });
  if (!best || best.members.length < 3) return { period: 0, confidence: 0 };
  const weight = best.members.reduce((sum, item) => sum + item.weight, 0);
  const period = best.members.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
  const deviations = best.members.map((item) => Math.abs(item.value - period)).sort((a, b) => a - b);
  const medianDeviation = deviations[Math.floor(deviations.length / 2)] || 0;
  const regularity = clamp(1 - medianDeviation / Math.max(18, period * 0.12));
  const support = best.score / recent.reduce((sum, _value, index) => (
    sum + Math.exp(-(recent.length - 1 - index) / 5.5)
  ), 0);
  return {
    period,
    confidence: clamp(Math.min(1, best.members.length / 4) * regularity * (0.55 + support * 0.45))
  };
}

export class RhythmFusion {
  constructor() {
    this.modelTempo = new TempoTracker();
    this.reset();
  }

  reset() {
    this.modelTempo.reset();
    this.candidates = [];
    this.lastModelSerial = 0;
    this.lastModelPeakAt = 0;
    this.lastVisualAt = -Infinity;
    this.modelLatencyMs = 38;
    this.modelIntervals = [];
    this.salienceHistory = [];
  }

  update({
    now,
    profileId = 'general',
    model = {},
    dspNow = false,
    dspImpact = 0,
    candidateNow = false,
    candidateAt = now,
    candidateImpact = 0,
    rhythmEvidence = 0,
    kickEvidence = 0,
    bodyEvidence = 0,
    presenceEvidence = 0,
    airEvidence = 0
  }) {
    const hardcore = profileId === 'hardcore';
    const hardstyle = profileId === 'hardstyle';
    const hardDance = ['hard-dance', 'hardcore', 'hardstyle'].includes(profileId);
    const modelAvailable = Boolean(model.available);
    const peakSerial = Number(model.peakSerial) || 0;
    const newModelPeak = modelAvailable && peakSerial > this.lastModelSerial;

    let currentCandidate = null;
    if (candidateNow) {
      currentCandidate = {
        at: Number(candidateAt) || now,
        impact: clamp(candidateImpact),
        rhythmEvidence: clamp(rhythmEvidence),
        kickEvidence: clamp(kickEvidence),
        bodyEvidence: clamp(bodyEvidence),
        presenceEvidence: clamp(presenceEvidence),
        airEvidence: clamp(airEvidence)
      };
      this.candidates.push(currentCandidate);
      this.salienceHistory.push({ at: currentCandidate.at, impact: currentCandidate.impact });
    }
    this.candidates = this.candidates.filter((candidate) => now - candidate.at <= 190);
    this.salienceHistory = this.salienceHistory.filter((candidate) => now - candidate.at <= 1500);

    if (newModelPeak) {
      const peakAt = Number(model.peakAt) || now;
      if (this.lastModelPeakAt) {
        const interval = peakAt - this.lastModelPeakAt;
        this.modelTempo.addInterval(interval, 0.65 + clamp(model.peakActivation) * 1.25, peakAt);
        if (interval >= 140 && interval <= 900) {
          this.modelIntervals.push(interval);
          this.modelIntervals = this.modelIntervals.slice(-18);
        }
      }
      this.lastModelPeakAt = peakAt;
      this.lastModelSerial = peakSerial;
    }

    const tempo = this.modelTempo.snapshot();
    const tempoPeriod = tempo.bpm ? 60000 / tempo.bpm : 0;
    const pulse = pulseSnapshot(this.modelIntervals);
    // BPM folding is useful for display (e.g. 300 -> 150), but a hard-dance
    // drumroll still needs its original 200 ms pulse spacing for every kick.
    const gridPeriod = hardDance && pulse.confidence >= 0.48 ? pulse.period : tempoPeriod;
    const activation = clamp(Math.max(
      Number(model.peakActivation) || 0,
      Number(model.beat) || 0,
      Number(model.downbeat) || 0
    ));
    const modelStrength = clamp(
      activation * 0.7 + clamp(model.groove) * 0.18 + clamp(model.regularity) * 0.12
    );

    let matchedCandidate = null;
    let alignment = '';
    const eligible = this.candidates
      .filter((candidate) => candidate.at - this.lastVisualAt >= (hardDance ? 100 : 82))
      .sort((left, right) => right.impact - left.impact);

    if (newModelPeak && eligible.length) {
      const rawPeakAt = Number(model.peakAt) || now;
      const nearby = eligible.filter((candidate) => (
        rawPeakAt - candidate.at >= -65 && rawPeakAt - candidate.at <= 155
      )).sort((left, right) => {
        const leftError = Math.abs((rawPeakAt - left.at) - this.modelLatencyMs) - left.impact * 12;
        const rightError = Math.abs((rawPeakAt - right.at) - this.modelLatencyMs) - right.impact * 12;
        return leftError - rightError;
      });
      matchedCandidate = nearby[0] || null;
      if (matchedCandidate) {
        const observedLatency = clamp(rawPeakAt - matchedCandidate.at, 12, 105);
        this.modelLatencyMs = this.modelLatencyMs * 0.82 + observedLatency * 0.18;
        alignment = 'ai-beat';
      }
    }

    // Once the model has locked a stable beat period, hard dance may recover a
    // missed model peak from a real transient near the learned grid. The grid
    // can confirm a transient but is never allowed to create one by itself.
    if (!matchedCandidate && hardDance && modelAvailable && eligible.length
      && tempo.sampleCount >= 3 && tempo.confidence >= 0.3
      && clamp(model.groove) >= 0.24 && this.lastModelPeakAt && gridPeriod) {
      const audioAnchor = this.lastModelPeakAt - this.modelLatencyMs;
      matchedCandidate = eligible.find((candidate) => (
        nearestGridDistance(candidate.at, audioAnchor, gridPeriod) <= Math.min(82, gridPeriod * 0.25)
      )) || null;
      if (matchedCandidate) alignment = 'ai-grid';
    }

    const refractoryMs = hardDance ? 100 : 82;

    const referenceImpact = Math.max(
      hardcore ? 0.26 : hardDance ? 0.28 : 0.32,
      percentile(this.salienceHistory.map((candidate) => candidate.impact), 0.82)
    );
    const describeCandidate = (candidate) => {
      if (!candidate) return { timbre: 0, relative: 0, airOnly: 0 };
      const airOnly = clamp(
        candidate.airEvidence - Math.max(candidate.bodyEvidence, candidate.presenceEvidence) * 1.12
      );
      const presenceWithSupport = candidate.presenceEvidence
        * (0.38 + candidate.bodyEvidence * 0.5);
      const timbre = hardDance
        ? clamp(Math.max(
          candidate.kickEvidence,
          candidate.bodyEvidence * 0.78 + candidate.presenceEvidence * 0.22,
          presenceWithSupport
        ) - airOnly * 0.34)
        : clamp(Math.max(candidate.rhythmEvidence, candidate.kickEvidence) - airOnly * 0.2);
      const relative = smoothstep(0.36, 1.06, candidate.impact / referenceImpact);
      return { timbre, relative, airOnly };
    };

    let selectedCandidate = null;
    let selectedSource = 'none';
    if (dspNow) {
      const dspCandidate = currentCandidate || eligible[0];
      selectedCandidate = dspCandidate ? {
        ...dspCandidate,
        impact: Math.max(dspCandidate.impact, clamp(dspImpact))
      } : {
        at: now,
        impact: clamp(dspImpact),
        rhythmEvidence: clamp(rhythmEvidence),
        kickEvidence: clamp(kickEvidence),
        bodyEvidence: clamp(bodyEvidence),
        presenceEvidence: clamp(presenceEvidence),
        airEvidence: clamp(airEvidence)
      };
      selectedSource = 'dsp';
    } else if (matchedCandidate) {
      selectedCandidate = matchedCandidate;
      selectedSource = alignment;
    } else if (currentCandidate) {
      const description = describeCandidate(currentCandidate);
      const localSalience = currentCandidate.impact * 0.55
        + description.timbre * 0.3
        + description.relative * 0.15
        - description.airOnly * 0.18;
      const localGate = hardcore ? 0.47 : hardstyle ? 0.49 : hardDance ? 0.5 : 0.56;
      if (localSalience >= localGate) {
        selectedCandidate = currentCandidate;
        selectedSource = 'dsp-soft';
      }
    }

    let rhythmNow = false;
    let source = 'none';
    let impact = 0;
    let eventAt = 0;
    let kickConfirmed = false;

    if (selectedCandidate && now - this.lastVisualAt >= refractoryMs) {
      const description = describeCandidate(selectedCandidate);
      const aligned = selectedSource === 'ai-beat' || selectedSource === 'ai-grid';
      const rawStrength = selectedCandidate.impact * (hardDance ? 0.42 : 0.48)
        + description.timbre * (hardDance ? 0.32 : 0.27)
        + description.relative * 0.18
        + (aligned ? modelStrength * 0.08 : 0)
        + (selectedSource === 'dsp' ? 0.07 : selectedSource === 'ai-beat' ? 0.055 : selectedSource === 'ai-grid' ? 0.035 : 0)
        - description.airOnly * (hardDance ? 0.24 : 0.18);
      const gradedImpact = smoothstep(hardDance ? 0.2 : 0.23, hardDance ? 0.78 : 0.82, rawStrength);
      // A soft gate prevents low-level texture from looking like a beat, while
      // a visible floor keeps accepted rhythm events punchy. Above that floor
      // the original graded strength is retained instead of becoming 0/1.
      // Keep the gate only slightly below the visible punch floor. This trims
      // marginal texture/ghost transients without making genuine softer beats
      // binary or weakening accepted hits.
      const eventGate = hardcore ? 0.18 : hardDance ? 0.2 : 0.25;
      const minimumPunch = hardcore ? 0.3 : hardDance ? 0.29 : 0.28;
      // Hard Dance gets a slightly stricter timbral veto than the other broad
      // profiles. A real distorted kick may be body-heavy or presence-heavy,
      // but an isolated mid/air transient may no longer trigger the visual.
      const conventionalTimbreFloor = hardcore ? 0.22 : hardstyle ? 0.26 : 0.25;
      const conventionalSupportFloor = hardcore ? 0.2 : hardstyle ? 0.25 : 0.24;
      const conventionalAirCeiling = hardcore ? 0.84 : hardstyle ? 0.72 : 0.68;
      const conventionalHardKick = description.timbre >= conventionalTimbreFloor
        && Math.max(selectedCandidate.bodyEvidence, selectedCandidate.presenceEvidence) >= conventionalSupportFloor
        && description.airOnly < conventionalAirCeiling;
      // Zaag/rawtempo kicks can trade most of the sub-body transient for a
      // wide distorted presence burst. Accept that second shape when it is
      // salient and rhythmically supported, while a normal isolated hat still
      // lacks enough presence/kick evidence to enter this branch.
      const zaagPresenceFloor = hardcore ? 0.36 : hardstyle ? 0.4 : 0.42;
      const zaagImpactFloor = hardcore ? 0.3 : hardstyle ? 0.32 : 0.34;
      const zaagEvidenceFloor = hardcore ? 0.27 : hardstyle ? 0.28 : 0.3;
      const zaagAirCeiling = hardcore ? 0.88 : hardstyle ? 0.84 : 0.82;
      const zaagLikeKick = selectedCandidate.presenceEvidence >= zaagPresenceFloor
        && selectedCandidate.impact >= zaagImpactFloor
        && Math.max(selectedCandidate.kickEvidence, selectedCandidate.rhythmEvidence) >= zaagEvidenceFloor
        && description.airOnly < zaagAirCeiling;
      const hardKickLike = !hardDance || conventionalHardKick || zaagLikeKick;
      if (gradedImpact >= eventGate && hardKickLike) {
        rhythmNow = true;
        source = selectedSource;
        impact = Math.max(minimumPunch, gradedImpact);
        eventAt = selectedCandidate.at;
        kickConfirmed = hardDance
          ? hardKickLike
          : selectedCandidate.kickEvidence >= 0.38;
      }
    }

    if (rhythmNow) {
      this.lastVisualAt = now;
      this.candidates = this.candidates.filter((candidate) => candidate.at > eventAt + 8);
    }

    return {
      rhythmNow,
      rhythmStrength: impact,
      source,
      impact,
      eventAt,
      kickConfirmed,
      modelBeatNow: newModelPeak,
      modelTempoBpm: tempo.bpm,
      modelTempoConfidence: tempo.confidence,
      modelPulsePeriodMs: pulse.period,
      modelPulseConfidence: pulse.confidence,
      modelLatencyMs: this.modelLatencyMs
    };
  }
}
