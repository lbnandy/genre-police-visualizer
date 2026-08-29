import { OnsetDetector } from './onset-detector.mjs';
import { TempoTracker } from './tempo-tracker.mjs';
import { resolveKickProfile } from './kick-profiles.mjs';
import { RhythmFusion } from './rhythm-fusion.mjs';
import { outputDeviceSignature } from './audio-device-watch.mjs';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export class AudioEngine extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.rhythmContext = null;
    this.rhythmSource = null;
    this.analyser = null;
    this.beatAnalyser = null;
    this.rhythmWorklet = null;
    this.rhythmMute = null;
    this.stream = null;
    this.frequency = null;
    this.beatFrequency = null;
    this.waveform = null;
    this.beatPrevious = null;
    this.lastAnalysisAt = 0;
    this.lastTempoOnsetAt = 0;
    this.recentKickStamps = [];
    this.previousBass = 0;
    this.previousVolume = 0;
    this.longEnergy = 0;
    this.analysisFrames = 0;
    this.fastBands = { bass: 0, mid: 0, high: 0 };
    this.slowBands = { bass: 0, mid: 0, high: 0 };
    this.onsetDetector = new OnsetDetector({ minimumIntervalMs: 65 });
    this.tempoTracker = new TempoTracker();
    this.rhythmFusion = new RhythmFusion();
    this.kickProfile = resolveKickProfile();
    this.modelAssist = {
      available: false, receivedAt: 0, beat: 0, downbeat: 0, groove: 0,
      regularity: 0, peakSerial: 0, peakAt: 0, peakActivation: 0
    };
    this.metrics = this.emptyMetrics();
    this.status = 'starting';
    this.startSerial = 0;
    this.captureStartedAt = -Infinity;
    this.outputSignature = '';
    this.deviceRestartTimer = 0;
    this.devicePollTimer = 0;
    this.installOutputDeviceMonitor();
  }

  installOutputDeviceMonitor() {
    const devices = navigator.mediaDevices;
    if (!devices?.enumerateDevices) return;
    devices.addEventListener?.('devicechange', () => {
      this.scheduleOutputDeviceRestart('devicechange', true, 520);
    });
    this.refreshOutputDeviceSignature(false);
    // Chromium normally emits devicechange when Windows changes its default
    // endpoint. Polling the small device list is a fallback for drivers that
    // update the default pseudo-device without emitting the event.
    this.devicePollTimer = window.setInterval(async () => {
      const changed = await this.refreshOutputDeviceSignature(true);
      if (changed) this.scheduleOutputDeviceRestart('default-output-changed', true, 260);
    }, 2400);
  }

  async refreshOutputDeviceSignature(compare = true) {
    try {
      const signature = outputDeviceSignature(await navigator.mediaDevices.enumerateDevices());
      if (!signature) return false;
      const changed = Boolean(compare && this.outputSignature && signature !== this.outputSignature);
      this.outputSignature = signature;
      return changed;
    } catch {
      return false;
    }
  }

  scheduleOutputDeviceRestart(reason, force = false, delay = 420) {
    window.clearTimeout(this.deviceRestartTimer);
    this.deviceRestartTimer = window.setTimeout(async () => {
      const changed = await this.refreshOutputDeviceSignature(true);
      if (!force && !changed) return;
      // Starting/stopping a display stream can itself refresh Chromium's
      // device list. Ignore that echo, but always accept a later OS event.
      if (performance.now() - this.captureStartedAt < 1100) return;
      this.dispatchEvent(new CustomEvent('outputdevicechange', { detail: { reason } }));
      this.start();
    }, delay);
  }

  emptyMetrics() {
    return {
      bass: 0, lowMid: 0, mid: 0, high: 0, volume: 0, flux: 0,
      lowFlux: 0, midFlux: 0, highFlux: 0,
      bodyFlux: 0, presenceFlux: 0, airFlux: 0,
      beat: 0, beatNow: false, rhythmNow: false, onsetNow: false,
      impact: 0, accent: 0, rhythmStrength: 0, rhythmPulse: 0, kickNow: false, kickPulse: 0,
      bassPulse: 0, midPulse: 0, highPulse: 0, drive: 0,
      relativeEnergy: 1,
      bpm: 0, tempoConfidence: 0, regularity: 0, kickDensity: 0, brightness: 0,
      profileConfidence: 0, kickProfile: this.kickProfile?.id || 'general',
      modelAvailable: false, modelBeat: 0, modelDownbeat: 0, modelGroove: 0,
      modelInferenceMs: 0, modelBeatNow: false, modelTempoBpm: 0,
      modelTempoConfidence: 0, modelPulsePeriodMs: 0,
      modelPulseConfidence: 0, rhythmSource: 'none',
      waveform: null, frequency: null
    };
  }

  resetDetectionState() {
    this.lastAnalysisAt = 0;
    this.lastTempoOnsetAt = 0;
    this.recentKickStamps.length = 0;
    this.previousBass = 0;
    this.previousVolume = 0;
    this.longEnergy = 0;
    this.analysisFrames = 0;
    this.fastBands = { bass: 0, mid: 0, high: 0 };
    this.slowBands = { bass: 0, mid: 0, high: 0 };
    this.onsetDetector.reset();
    this.tempoTracker.reset();
    this.rhythmFusion.reset();
    this.metrics = this.emptyMetrics();
  }

  setGenreTheme(theme) {
    this.kickProfile = resolveKickProfile(theme);
  }

  setModelAssist(payload = {}) {
    if (payload.type === 'ready') {
      this.modelAssist = {
        ...this.modelAssist,
        available: true,
        receivedAt: performance.now(),
        peakSerial: 0,
        peakAt: 0,
        peakActivation: 0
      };
      return;
    }
    if (payload.type !== 'rhythm') {
      this.modelAssist = { ...this.modelAssist, available: false, receivedAt: performance.now() };
      return;
    }
    const receivedAt = performance.now();
    const peakSerial = Math.max(0, Number(payload.serial) || 0);
    const isNewPeak = Boolean(payload.peak) && peakSerial > (this.modelAssist.peakSerial || 0);
    this.modelAssist = {
      available: true,
      receivedAt,
      beat: clamp(Number(payload.beat) || 0),
      downbeat: clamp(Number(payload.downbeat) || 0),
      groove: clamp(Number(payload.groove) || 0),
      regularity: clamp(Number(payload.regularity) || 0),
      peakSerial: isNewPeak ? peakSerial : this.modelAssist.peakSerial,
      peakAt: isNewPeak ? receivedAt : this.modelAssist.peakAt,
      peakActivation: isNewPeak
        ? clamp(Number(payload.peakActivation) || Math.max(Number(payload.beat) || 0, Number(payload.downbeat) || 0))
        : this.modelAssist.peakActivation,
      inferenceMs: Math.max(0, Number(payload.inferenceMs) || 0)
    };
  }

  async start() {
    const serial = ++this.startSerial;
    this.stop();
    this.resetDetectionState();
    this.status = 'starting';
    this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: { width: 1, height: 1, frameRate: 1 }
      });
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) throw new Error('System loopback audio was not provided');
      if (serial !== this.startSerial) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      for (const track of stream.getVideoTracks()) track.enabled = false;
      // Keep the established visual/DSP analysis at the output device's native
      // rate. The model gets its own graph below so moving from Python to ONNX
      // cannot silently retune the existing frequency-bin thresholds.
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.64;
      this.analyser.minDecibels = -92;
      this.analyser.maxDecibels = -18;
      this.beatAnalyser = this.context.createAnalyser();
      this.beatAnalyser.fftSize = 1024;
      this.beatAnalyser.smoothingTimeConstant = 0.08;
      this.beatAnalyser.minDecibels = -92;
      this.beatAnalyser.maxDecibels = -18;
      const source = this.context.createMediaStreamSource(stream);
      source.connect(this.analyser);
      source.connect(this.beatAnalyser);
      try {
        // BeatNet was trained at 22.05 kHz. Both graphs consume the same
        // captured MediaStream, but Chromium resamples only the model branch.
        try {
          this.rhythmContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 22050 });
        } catch {
          // The worklet has a streaming sample-rate fallback for older drivers
          // that refuse a non-native AudioContext rate.
          this.rhythmContext = new AudioContext({ latencyHint: 'interactive' });
        }
        await this.rhythmContext.audioWorklet.addModule('./rhythm-capture-worklet.js');
        if (serial !== this.startSerial) return;
        this.rhythmSource = this.rhythmContext.createMediaStreamSource(stream);
        this.rhythmWorklet = new AudioWorkletNode(this.rhythmContext, 'genre-police-rhythm-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        this.rhythmMute = this.rhythmContext.createGain();
        this.rhythmMute.gain.value = 0;
        this.rhythmWorklet.port.onmessage = (event) => {
          const samples = event.data;
          if (samples instanceof Float32Array && samples.length === 441) {
            window.genrePolice.submitRhythmAudio(samples);
          }
        };
        this.rhythmSource.connect(this.rhythmWorklet);
        this.rhythmWorklet.connect(this.rhythmMute);
        this.rhythmMute.connect(this.rhythmContext.destination);
      } catch (error) {
        // DSP analysis remains fully operational when the optional model feed
        // cannot be created on a particular Chromium/audio-driver build.
        console.warn('Local rhythm model audio feed unavailable:', error);
        this.rhythmSource?.disconnect();
        this.rhythmWorklet?.disconnect();
        this.rhythmMute?.disconnect();
        if (this.rhythmContext && this.rhythmContext.state !== 'closed') {
          this.rhythmContext.close().catch(() => {});
        }
        this.rhythmContext = null;
        this.rhythmSource = null;
        this.rhythmWorklet = null;
        this.rhythmMute = null;
      }
      this.frequency = new Uint8Array(this.analyser.frequencyBinCount);
      this.beatFrequency = new Uint8Array(this.beatAnalyser.frequencyBinCount);
      this.waveform = new Uint8Array(this.analyser.fftSize);
      this.beatPrevious = new Uint8Array(this.beatAnalyser.frequencyBinCount);
      this.status = 'live';
      this.captureStartedAt = performance.now();
      this.refreshOutputDeviceSignature(false);
      this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
      audioTracks[0].addEventListener('ended', () => {
        if (this.stream !== stream || serial !== this.startSerial) return;
        this.status = 'stopped';
        this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
        this.scheduleOutputDeviceRestart('loopback-track-ended', true, 260);
      });
    } catch (error) {
      if (serial !== this.startSerial) return;
      console.warn('System audio capture unavailable:', error);
      this.status = 'metadata-only';
      this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
    }
  }

  stop() {
    const stream = this.stream;
    this.stream = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    this.rhythmSource?.disconnect();
    this.rhythmWorklet?.disconnect();
    this.rhythmMute?.disconnect();
    if (this.rhythmContext && this.rhythmContext.state !== 'closed') this.rhythmContext.close().catch(() => {});
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
    this.rhythmContext = null;
    this.rhythmSource = null;
    this.analyser = null;
    this.beatAnalyser = null;
    this.rhythmWorklet = null;
    this.rhythmMute = null;
    this.beatFrequency = null;
    this.beatPrevious = null;
  }

  rangeAverage(fromHz, toHz) {
    if (!this.frequency || !this.context) return 0;
    const nyquist = this.context.sampleRate / 2;
    const start = Math.max(0, Math.floor((fromHz / nyquist) * this.frequency.length));
    const end = Math.min(this.frequency.length, Math.ceil((toHz / nyquist) * this.frequency.length));
    let total = 0;
    for (let index = start; index < end; index += 1) total += this.frequency[index];
    return end > start ? total / (end - start) / 255 : 0;
  }

  update(now = performance.now()) {
    const deltaMs = this.lastAnalysisAt ? clamp(now - this.lastAnalysisAt, 4, 80) : 16.667;
    this.lastAnalysisAt = now;
    if (!this.analyser) {
      const t = now / 1000;
      const idle = 0.045 + Math.sin(t * 1.4) * 0.012;
      this.metrics = { ...this.emptyMetrics(), volume: idle, mid: idle, beat: Math.max(0, this.metrics.beat - 0.035) };
      return this.metrics;
    }

    this.analyser.getByteFrequencyData(this.frequency);
    this.analyser.getByteTimeDomainData(this.waveform);
    this.beatAnalyser.getByteFrequencyData(this.beatFrequency);
    if (this.analysisFrames === 0) this.beatPrevious.set(this.beatFrequency);
    this.analysisFrames += 1;
    const bass = this.rangeAverage(28, 170);
    const lowMid = this.rangeAverage(170, 520);
    const mid = this.rangeAverage(520, 2400);
    const high = this.rangeAverage(2400, 11000);

    let rms = 0;
    for (let i = 0; i < this.waveform.length; i += 1) {
      const sample = (this.waveform[i] - 128) / 128;
      rms += sample * sample;
    }
    const volume = Math.min(1, Math.sqrt(rms / this.waveform.length) * 2.4);

    // projectM/MilkDrop-style relative loudness: visual intensity is judged
    // against a slow-running reference, not raw absolute level.
    const energy = bass * 0.5 + lowMid * 0.25 + mid * 0.18 + high * 0.07;
    if (!this.longEnergy) {
      this.longEnergy = energy || 0.001;
    }
    this.longEnergy = this.longEnergy * 0.994 + energy * 0.006;
    const relativeEnergy = energy / Math.max(0.012, this.longEnergy);

    const nyquist = this.context.sampleRate / 2;
    const binAt = (hz) => Math.min(this.beatFrequency.length - 1, Math.max(1, Math.floor(hz / nyquist * this.beatFrequency.length)));
    const lowEnd = binAt(220);
    const midEnd = binAt(2600);
    const highEnd = binAt(11000);
    const bodyEnd = binAt(900);
    const presenceEnd = binAt(5200);
    let lowFluxTotal = 0;
    let midFluxTotal = 0;
    let highFluxTotal = 0;
    let bodyFluxTotal = 0;
    let presenceFluxTotal = 0;
    let airFluxTotal = 0;
    for (let i = 1; i <= highEnd; i += 1) {
      const delta = Math.max(0, this.beatFrequency[i] - this.beatPrevious[i]) / 255;
      if (i <= lowEnd) lowFluxTotal += delta;
      else if (i <= midEnd) midFluxTotal += delta;
      else highFluxTotal += delta;
      if (i > lowEnd && i <= bodyEnd) bodyFluxTotal += delta;
      else if (i > bodyEnd && i <= presenceEnd) presenceFluxTotal += delta;
      else if (i > presenceEnd) airFluxTotal += delta;
      this.beatPrevious[i] = this.beatFrequency[i];
    }
    const lowFlux = lowFluxTotal / Math.max(1, lowEnd);
    const midFlux = midFluxTotal / Math.max(1, midEnd - lowEnd);
    const highFlux = highFluxTotal / Math.max(1, highEnd - midEnd);
    const bodyFlux = bodyFluxTotal / Math.max(1, bodyEnd - lowEnd);
    const presenceFlux = presenceFluxTotal / Math.max(1, presenceEnd - bodyEnd);
    const airFlux = airFluxTotal / Math.max(1, highEnd - presenceEnd);
    const flux = Math.min(1, (lowFlux * 0.48 + midFlux * 0.34 + highFlux * 0.18) * 7.5);

    const bassRise = Math.max(0, bass - this.previousBass);
    const envelopeAttack = Math.max(0, volume - this.previousVolume);
    this.previousBass = bass;
    this.previousVolume = volume;

    // MilkDrop/projectM-style continuous drive: a fast envelope is compared
    // with a slower reference. This remains smooth even when no onset is picked.
    const smoothBand = (key, value) => {
      if (!this.slowBands[key]) {
        this.fastBands[key] = value;
        this.slowBands[key] = value || 0.001;
      }
      const fastTau = value > this.fastBands[key] ? 34 : 135;
      const slowTau = value > this.slowBands[key] ? 2400 : 3600;
      this.fastBands[key] += (value - this.fastBands[key]) * (1 - Math.exp(-deltaMs / fastTau));
      this.slowBands[key] += (value - this.slowBands[key]) * (1 - Math.exp(-deltaMs / slowTau));
      return clamp((this.fastBands[key] / Math.max(0.018, this.slowBands[key]) - 0.98) / 1.15);
    };
    const bassPulse = smoothBand('bass', bass);
    const midPulse = smoothBand('mid', mid);
    const highPulse = smoothBand('high', high);
    const drive = clamp(bassPulse * 0.62 + midPulse * 0.27 + highPulse * 0.11);

    // Broad genre families only tune the spectral evidence. Peak picking,
    // adaptive thresholding, energy gates and minimum intervals stay shared.
    const profile = this.kickProfile;
    const novelty = lowFlux * profile.novelty.lowFlux
      + midFlux * profile.novelty.midFlux
      + highFlux * profile.novelty.highFlux
      + bodyFlux * (profile.novelty.bodyFlux || 0)
      + presenceFlux * (profile.novelty.presenceFlux || 0)
      + airFlux * (profile.novelty.airFlux || 0)
      + bassRise * profile.novelty.bassRise
      + envelopeAttack * profile.novelty.attack;
    const brightness = high / Math.max(0.04, bass + lowMid + mid + high);
    const absoluteActivity = clamp((volume - 0.028) / 0.18);
    const relativeActivity = clamp((relativeEnergy - 0.72) / 1.05);
    const activity = clamp(absoluteActivity * 0.68 + relativeActivity * 0.32);
    const kickiness = clamp(
      lowFlux * profile.evidence.lowFlux
      + bassRise * profile.evidence.bassRise
      + bassPulse * profile.evidence.bassPulse
      + midFlux * profile.evidence.midFlux
      + bodyFlux * (profile.evidence.bodyFlux || 0)
      + presenceFlux * (profile.evidence.presenceFlux || 0)
      + airFlux * (profile.evidence.airFlux || 0)
      + envelopeAttack * profile.evidence.attack
      - airFlux * (profile.evidence.airPenalty || 0)
    );
    const onsetBody = profile.id === 'hardcore'
      ? bass * 0.55 + lowMid * 0.34 + mid * 0.11
      : profile.id === 'hardstyle'
        ? bass * 0.65 + lowMid * 0.3 + mid * 0.05
        : bass * 0.7 + lowMid * 0.3;
    const onset = this.onsetDetector.update({
      novelty,
      loudness: volume,
      body: onsetBody,
      kickiness,
      kickinessFloor: profile.kickinessFloor,
      kickStrengthFloor: profile.strengthFloor,
      kickBodyFloor: profile.bodyFloor,
      activity
    }, now);
    const kickImpact = clamp((onset.kickStrength * 0.76 + bassPulse * 0.24) * profile.impactGain);
    const kickNow = onset.kickNow && kickImpact >= profile.impactGate;
    const rhythmEvidence = clamp(
      lowFlux * profile.rhythm.lowFlux
      + midFlux * profile.rhythm.midFlux
      + highFlux * profile.rhythm.highFlux
      + bodyFlux * (profile.rhythm.bodyFlux || 0)
      + presenceFlux * (profile.rhythm.presenceFlux || 0)
      + airFlux * (profile.rhythm.airFlux || 0)
      + bassRise * profile.rhythm.bassRise
      + envelopeAttack * profile.rhythm.attack
      - airFlux * (profile.rhythm.airPenalty || 0)
    );
    const hardDanceProfile = ['hard-dance', 'hardcore', 'hardstyle'].includes(profile.id);
    const hardBodyEvidence = profile.id === 'hardcore'
      ? clamp(lowFlux * 8 + bodyFlux * 8 + bassRise * 3 + bassPulse * 0.18)
      : profile.id === 'hardstyle'
        ? clamp(lowFlux * 10 + bodyFlux * 6 + bassRise * 5 + bassPulse * 0.28)
        : hardDanceProfile
          ? clamp(lowFlux * 9 + bodyFlux * 7 + bassRise * 4 + bassPulse * 0.24)
          : clamp(lowFlux * 8 + bodyFlux * 4 + bassRise * 3);
    const hardPresenceEvidence = profile.id === 'hardcore'
      ? clamp(presenceFlux * 10 + bodyFlux * 3.2 + envelopeAttack * 1.25)
      : profile.id === 'hardstyle'
        ? clamp(presenceFlux * 8.5 + bodyFlux * 2.6 + envelopeAttack * 2.2)
        : clamp(presenceFlux * 9 + bodyFlux * 2.8 + envelopeAttack * 1.8);
    const airEvidence = clamp(airFlux * 10 + highFlux * 2.2);
    const modelAvailable = this.modelAssist.available && now - this.modelAssist.receivedAt < 450;
    const modelGroove = modelAvailable ? this.modelAssist.groove : 0;
    // The model is now a beat-confirmation layer. DSP remains the source of
    // millisecond attack timing, while BeatNet can recover a real but weaker
    // transient that lands on an observed or learned beat position.
    const modelGateOffset = modelAvailable ? clamp((0.38 - modelGroove) * 0.08, -0.025, 0.035) : 0;
    const rhythmImpact = clamp(onset.strength * 0.72 + rhythmEvidence * 0.28);
    const dspRhythmNow = onset.onsetNow
      && rhythmEvidence >= profile.rhythmFloor
      && rhythmImpact >= profile.rhythmGate + modelGateOffset;
    const candidateImpact = clamp(
      onset.candidateStrength * 0.48
      + rhythmEvidence * 0.28
      + kickiness * 0.18
      + bassPulse * 0.06
    );
    const fusion = this.rhythmFusion.update({
      now,
      profileId: profile.id,
      model: modelAvailable ? this.modelAssist : { available: false },
      dspNow: dspRhythmNow,
      dspImpact: rhythmImpact,
      candidateNow: onset.candidateNow,
      candidateAt: onset.candidateAt,
      candidateImpact,
      rhythmEvidence,
      kickEvidence: kickiness,
      bodyEvidence: hardBodyEvidence,
      presenceEvidence: hardPresenceEvidence,
      airEvidence
    });
    const rhythmNow = fusion.rhythmNow;
    const finalRhythmImpact = rhythmNow ? fusion.impact : rhythmImpact;
    if (rhythmNow) {
      if (this.lastTempoOnsetAt) {
        this.tempoTracker.addInterval(
          (fusion.eventAt || now) - this.lastTempoOnsetAt,
          0.55 + finalRhythmImpact * 1.45,
          fusion.eventAt || now
        );
      }
      this.lastTempoOnsetAt = fusion.eventAt || now;
    }
    const finalKickNow = kickNow || (rhythmNow && fusion.kickConfirmed);
    if (finalKickNow) this.recentKickStamps.push(fusion.eventAt || onset.onsetAt || now);
    this.recentKickStamps = this.recentKickStamps.filter((stamp) => now - stamp <= 4000);
    const tempo = this.tempoTracker.snapshot();

    const decay = (value, milliseconds) => (Number(value) || 0) * Math.exp(-deltaMs / milliseconds);
    let beat = Math.max(decay(this.metrics.beat, 135), drive * 0.48);
    let impact = decay(this.metrics.impact, 92);
    let accent = decay(this.metrics.accent, 105);
    let rhythmPulse = decay(this.metrics.rhythmPulse, 145);
    let kickPulse = decay(this.metrics.kickPulse, profile.releaseMs);
    if (rhythmNow) {
      beat = Math.max(beat, 0.36 + finalRhythmImpact * 0.64);
      impact = Math.max(impact, finalRhythmImpact);
      rhythmPulse = Math.max(rhythmPulse, finalRhythmImpact);
      accent = Math.max(accent, finalRhythmImpact > 0.76 ? finalRhythmImpact : finalRhythmImpact * 0.38);
    }
    if (finalKickNow) kickPulse = Math.max(kickPulse, Math.max(kickImpact, finalRhythmImpact * 0.88));
    const kickDensity = this.recentKickStamps.length / 4;

    this.metrics = {
      bass, lowMid, mid, high, volume, flux, lowFlux, midFlux, highFlux,
      bodyFlux, presenceFlux, airFlux,
      beat, beatNow: rhythmNow, rhythmNow, onsetNow: onset.onsetNow,
      impact, accent, rhythmStrength: fusion.rhythmStrength, rhythmPulse, kickNow: finalKickNow, kickPulse,
      bassPulse, midPulse, highPulse, drive,
      relativeEnergy,
      bpm: tempo.bpm, tempoConfidence: tempo.confidence,
      regularity: tempo.regularity, kickDensity, brightness,
      profileConfidence: tempo.confidence, kickProfile: profile.id,
      modelAvailable,
      modelBeat: modelAvailable ? this.modelAssist.beat : 0,
      modelDownbeat: modelAvailable ? this.modelAssist.downbeat : 0,
      modelGroove,
      modelInferenceMs: modelAvailable ? this.modelAssist.inferenceMs : 0,
      modelBeatNow: fusion.modelBeatNow,
      modelTempoBpm: fusion.modelTempoBpm,
      modelTempoConfidence: fusion.modelTempoConfidence,
      modelPulsePeriodMs: fusion.modelPulsePeriodMs,
      modelPulseConfidence: fusion.modelPulseConfidence,
      rhythmSource: fusion.source,
      waveform: this.waveform,
      frequency: this.frequency
    };
    return this.metrics;
  }
}
