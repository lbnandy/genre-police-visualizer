import { resolveImpactFx } from './impact-fx.mjs';
import { reduceDenseSpectrumBins } from './spectrum-density.mjs';
import { impactContourRatios, impactFrontProgress } from './impact-motion.mjs';
import { genreImpactRadiusRatio, genreMotionProfile, genreParticleCount } from './genre-motion.mjs';
import {
  distributeGroupsOutsideTopGap,
  genreTopFrequencyGap,
  mapFrequencyOutsideTopGap
} from './spectrum-layout.mjs';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const value = String(hex || '#ffffff').replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const number = Number.parseInt(full, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function fullscreenUsesCenteredScene() {
  return document.body.dataset.stageOutput === 'true'
    && (document.body.dataset.stageOutputText === 'false'
      || document.body.dataset.fullscreenLayout === 'stacked');
}

export class VisualEngine {
  constructor(canvas) {
    this.canvas = canvas;
    // A desynchronized canvas can bypass Chromium's normal alpha compositor on
    // transparent Windows windows, exposing its full backing rectangle as black.
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.fxCanvas = document.createElement('canvas');
    this.fxCtx = this.fxCanvas.getContext('2d', { alpha: true, desynchronized: true });
    this.tintCanvas = document.createElement('canvas');
    this.tintCtx = this.tintCanvas.getContext('2d', { alpha: true, desynchronized: true });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.outputResolutionScale = 1;
    this.effectiveResolutionScale = 1;
    this.theme = null;
    this.trackContext = { genrePolice: false };
    this.particles = [];
    this.rings = [];
    this.glitches = [];
    this.lastMode = '';
    this.transitionSnapshot = null;
    this.transitionStartedAt = 0;
    this.transitionDuration = 920;
    this.motionStartedAt = -Infinity;
    this.motionStrength = 0;
    this.motionDirection = 1;
    this.dnbLaneAnchors = [];
    this.dnbTravelPhase = 0;
    this.dnbLastAt = 0;
    this.dnbDensity = 0;
    this.dnbImpactFlash = 0;
    this.futureHouseBounce = 0;
    this.futureHouseVelocity = 0;
    this.futureHouseLastAt = 0;
    this.futureHouseLastTriggerAt = -Infinity;
    this.futureHouseStabOffset = 0;
    this.futureHouseStabDirection = 1;
    this.progressiveHouseLayers = [0, 0, 0];
    this.progressiveHouseFlow = 0;
    this.progressiveHouseLastAt = 0;
    this.tranceFlowPhase = 0;
    this.tranceArmPhase = 0;
    this.tranceLastAt = 0;
    this.tranceEnergy = 0;
    this.tranceDust = [];
    this.tranceOuterParticleBudget = 0;
    this.tranceOuterParticleLastAt = 0;
    this.tranceArmCache = document.createElement('canvas');
    this.tranceFixedParticleCache = document.createElement('canvas');
    this.tranceBackdropCanvas = document.createElement('canvas');
    this.tranceBackdropCtx = this.tranceBackdropCanvas.getContext('2d', { alpha: true, desynchronized: true });
    this.synthForegroundCanvas = document.createElement('canvas');
    this.synthForegroundCtx = this.synthForegroundCanvas.getContext('2d', { alpha: true, desynchronized: true });
    this.synthArtworkCanvas = document.createElement('canvas');
    this.synthArtworkCtx = this.synthArtworkCanvas.getContext('2d', { alpha: true, desynchronized: true });
    this.tranceArmCacheKey = '';
    this.synthGridPhase = 0;
    this.synthSunScanPhase = 0;
    this.synthSceneLastAt = 0;
    this.synthCapsuleHorizonY = 0;
    this.synthCapsuleHorizonMeasuredAt = 0;
    this.asmrReference = 0.035;
    this.bilibiliVoiceActivity = 0;
    this.bilibiliSectionDrive = 0;
    this.bilibiliTransientDrive = 0;
    this.bilibiliMotionDrive = 0;
    this.bilibiliTvScaleX = 1;
    this.bilibiliTvScaleY = 1;
    this.bilibiliMotionLastAt = 0;
    this.bilibiliDanmakuLastAt = 0;
    const bilibiliDanmakuCount = 22;
    const bilibiliDanmakuLanes = 9;
    this.bilibiliDanmaku = Array.from({ length: bilibiliDanmakuCount }, (_, index) => {
      const sample = (offset) => {
        const value = Math.sin((index * 7 + offset + 1) * 127.1) * 43758.5453;
        return value - Math.floor(value);
      };
      const lane = index % bilibiliDanmakuLanes;
      const laneSlot = Math.floor(index / bilibiliDanmakuLanes);
      const laneSlots = Math.ceil((bilibiliDanmakuCount - lane) / bilibiliDanmakuLanes);
      const laneSample = (offset) => {
        const value = Math.sin((lane * 11 + offset + 1) * 127.1) * 43758.5453;
        return value - Math.floor(value);
      };
      return {
        lane,
        y: (lane + 0.5 + (sample(0) - 0.5) * 0.28) / bilibiliDanmakuLanes,
        width: 30 + Math.round(sample(1) * 62),
        height: 2.2 + sample(2) * 1.8,
        speed: 0.014 + laneSample(3) * 0.018,
        phase: sample(4),
        progress: (laneSlot / laneSlots + sample(4) * 0.06) % 1,
        color: Math.floor(sample(5) * 3),
        alpha: 0.078 + sample(6) * 0.07,
        spawnAt: 0.2 + sample(7) * 0.72
      };
    });
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    // clientWidth/clientHeight stay in the selected layout's design coordinate
    // space even when the complete transparent stage is scaled by a preset.
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    const renderedWidth = this.canvas.getBoundingClientRect().width;
    const outputScale = document.body.dataset.stageOutput === 'true'
      ? Math.max(1, renderedWidth / this.width)
      : 1;
    // Fullscreen enlarges the fixed design canvas with a CSS transform. Match
    // that transform in the backing store so it is not upscaled as a bitmap.
    const nativeDpr = Math.min(3, (window.devicePixelRatio || 1) * outputScale);
    // Keep CSS geometry and the HUD at native resolution. Only the animated
    // canvas backing store may step down when sustained compositor pressure is
    // detected; a 1x floor prevents small desktop layouts from becoming soft.
    this.dpr = Math.max(1, nativeDpr * this.outputResolutionScale);
    this.effectiveResolutionScale = this.dpr / nativeDpr;
    const layoutStyles = getComputedStyle(this.canvas);
    this.centerX = Number.parseFloat(layoutStyles.getPropertyValue('--visual-center-x'));
    this.centerY = Number.parseFloat(layoutStyles.getPropertyValue('--visual-center-y'));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.fxCanvas.width = this.canvas.width;
    this.fxCanvas.height = this.canvas.height;
    this.tintCanvas.width = this.canvas.width;
    this.tintCanvas.height = this.canvas.height;
    this.tranceBackdropCanvas.width = this.canvas.width;
    this.tranceBackdropCanvas.height = this.canvas.height;
    this.synthForegroundCanvas.width = this.canvas.width;
    this.synthForegroundCanvas.height = this.canvas.height;
    this.synthArtworkCanvas.width = this.canvas.width;
    this.synthArtworkCanvas.height = this.canvas.height;
    this.synthCapsuleHorizonY = 0;
    this.synthCapsuleHorizonMeasuredAt = 0;
    document.body.style.removeProperty('--synth-capsule-horizon-y');
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const fullscreenOutput = document.body.dataset.stageOutput === 'true';
    const posterScene = document.body.dataset.layout === 'poster'
      || fullscreenUsesCenteredScene();
    if (!posterScene) {
      const bounds = fullscreenOutput
        ? { left: 0, top: 0, right: this.width, bottom: this.height, radius: 0 }
        : { left: 54, top: 48, right: this.width - 108, bottom: this.height - 48, radius: 152 };
      // Force the new layout now. Waiting for the animation loop would expose
      // one frame of the 53% fallback before the progress rule is measured.
      this.resolveSynthwaveHorizonY(bounds, false, performance.now());
    }
  }

  setOutputResolutionScale(value) {
    const next = clamp(Number(value) || 1, 0.75, 1);
    if (Math.abs(next - this.outputResolutionScale) < 0.005) return false;
    this.outputResolutionScale = next;
    this.resize();
    return true;
  }

  setTheme(theme) {
    if (this.theme?.id !== theme?.id) {
      if (this.canvas.width && this.canvas.height) {
        const snapshot = document.createElement('canvas');
        snapshot.width = this.canvas.width;
        snapshot.height = this.canvas.height;
        snapshot.getContext('2d').drawImage(this.canvas, 0, 0);
        this.transitionSnapshot = snapshot;
        this.transitionStartedAt = performance.now();
      }
      this.particles.length = 0;
      this.rings.length = 0;
      this.glitches.length = 0;
      this.dnbLaneAnchors.length = 0;
      this.dnbTravelPhase = 0;
      this.dnbLastAt = 0;
      this.dnbDensity = 0;
      this.dnbImpactFlash = 0;
      this.futureHouseBounce = 0;
      this.futureHouseVelocity = 0;
      this.futureHouseLastAt = 0;
      this.futureHouseLastTriggerAt = -Infinity;
      this.futureHouseStabOffset = 0;
      this.futureHouseStabDirection = 1;
      this.progressiveHouseLayers = [0, 0, 0];
      this.progressiveHouseFlow = 0;
      this.progressiveHouseLastAt = 0;
      this.tranceFlowPhase = 0;
      this.tranceArmPhase = 0;
      this.tranceLastAt = 0;
      this.tranceEnergy = 0;
      this.tranceDust.length = 0;
      this.tranceOuterParticleBudget = 0;
      this.tranceOuterParticleLastAt = 0;
      this.tranceArmCacheKey = '';
      this.synthGridPhase = 0;
      this.synthSunScanPhase = 0;
      this.synthSceneLastAt = 0;
    }
    this.theme = theme;
  }

  setTrackContext(context = {}) {
    const next = { genrePolice: Boolean(context.genrePolice) };
    if (this.trackContext.genrePolice !== next.genrePolice && this.canvas.width && this.canvas.height) {
      const snapshot = document.createElement('canvas');
      snapshot.width = this.canvas.width;
      snapshot.height = this.canvas.height;
      snapshot.getContext('2d').drawImage(this.canvas, 0, 0);
      this.transitionSnapshot = snapshot;
      this.transitionStartedAt = performance.now();
      this.particles.length = 0;
      this.rings.length = 0;
      this.glitches.length = 0;
    }
    this.trackContext = next;
  }

  center() {
    return {
      x: clamp(Number.isFinite(this.centerX) ? this.centerX : Math.min(206, this.width * .255), 1, this.width - 1),
      y: clamp(Number.isFinite(this.centerY) ? this.centerY : this.height * .5, 1, this.height - 1)
    };
  }

  featherCanvasEdges(x, y) {
    const ctx = this.ctx;
    const radiusX = Math.max(116, Math.min(196, x - 8, this.width - x - 8));
    // The tallest low-frequency peaks live above the core. Give them more of
    // the transparent stage before feathering, while keeping the mask itself
    // fully transparent at the real canvas edges.
    const maskCenterY = y - 9;
    const radiusY = Math.max(106, Math.min(
      168,
      maskCenterY - 5,
      this.height - maskCenterY - 5
    ));
    const scaleY = radiusY / radiusX;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.shadowBlur = 0;
    ctx.translate(x, maskCenterY);
    ctx.scale(1, scaleY);
    const mask = ctx.createRadialGradient(0, 0, radiusX * 0.5, 0, 0, radiusX);
    mask.addColorStop(0, 'rgba(0, 0, 0, 1)');
    mask.addColorStop(0.78, 'rgba(0, 0, 0, 1)');
    mask.addColorStop(0.92, 'rgba(0, 0, 0, 0.7)');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mask;
    ctx.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
    ctx.restore();
  }

  glowCircle(x, y, radius, color, alpha = 0.35) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, alpha));
    gradient.addColorStop(0.34, rgba(color, alpha * 0.42));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  strokeGlow(color, width, blur = 12, alpha = 1) {
    const ctx = this.ctx;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  spectrumAt(metrics, frequencyRatio) {
    const data = metrics.frequency;
    if (!data?.length) return 0.045;
    const curved = Math.pow(clamp(frequencyRatio), 1.62);
    const upper = Math.min(data.length - 3, 470);
    const index = Math.max(2, Math.floor(2 + curved * (upper - 2)));
    const average = (
      (data[index - 2] || 0) + (data[index - 1] || 0) * 2
      + (data[index] || 0) * 3 + (data[index + 1] || 0) * 2 + (data[index + 2] || 0)
    ) / 9;
    const spectrumGain = Math.max(0.5, Number(metrics.spectrumGain) || 1);
    return clamp(Math.pow(Math.max(0, average / 255 * spectrumGain - 0.018) / 0.982, 0.7));
  }

  updateSpectrumProfile(metrics, bins) {
    if (!this.spectrumEnvelope || this.spectrumEnvelope.length !== bins) {
      this.spectrumEnvelope = new Float32Array(bins);
    }
    for (let index = 0; index < bins; index += 1) {
      const ratio = index / Math.max(1, bins - 1);
      const raw = this.spectrumAt(metrics, ratio);
      const previous = this.spectrumEnvelope[index] || 0;
      const response = raw > previous ? 0.52 : 0.13;
      this.spectrumEnvelope[index] = previous + (raw - previous) * response;
    }
    return this.spectrumEnvelope;
  }

  waveformAt(metrics, ratio, smoothing = 0) {
    const waveform = metrics.waveform;
    if (!waveform?.length) return Math.sin(ratio * TAU * 5) * 0.025;
    const index = Math.min(waveform.length - 1, Math.floor(ratio * waveform.length));
    const waveformGain = Math.max(0.5, Number(metrics.waveformGain) || 1);
    if (!smoothing) return clamp(((waveform[index] || 128) - 128) / 128 * waveformGain, -1, 1);
    const radius = Math.max(1, Math.round(smoothing));
    let total = 0;
    let weightTotal = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const wrapped = (index + offset + waveform.length) % waveform.length;
      const weight = radius + 1 - Math.abs(offset);
      total += ((waveform[wrapped] || 128) - 128) / 128 * waveformGain * weight;
      weightTotal += weight;
    }
    return clamp(total / weightTotal, -1, 1);
  }

  spectrumPoints(x, y, metrics, options = {}) {
    const points = options.points || 96;
    const profile = options.profile || this.updateSpectrumProfile(metrics, Math.floor(points / 2) + 1);
    const sortedProfile = Array.from(profile).sort((a, b) => a - b);
    const percentile = (ratio) => sortedProfile[Math.min(sortedProfile.length - 1, Math.floor((sortedProfile.length - 1) * ratio))] || 0;
    const spectralFloor = percentile(options.floorPercentile ?? 0.22);
    const spectralCeiling = Math.max(spectralFloor + 0.08, percentile(options.ceilingPercentile ?? 0.94));
    // Global restraint keeps the per-genre settings expressive without making
    // one active band tower over the rest of the composition.
    const spectralContrast = (options.spectralContrast ?? 0.62) * 0.86;
    const requestedPower = options.contrastPower ?? 1.4;
    const contrastPower = 1 + (requestedPower - 1) * 0.82;
    const contrastSpectrum = (value) => {
      const normalized = clamp((value - spectralFloor) / Math.max(0.08, spectralCeiling - spectralFloor));
      // Keep the original peak height while pulling quiet bands back toward
      // the base circle. This exaggerates differences between frequency bands
      // instead of enlarging the complete visualizer.
      const separated = Math.pow(normalized, contrastPower) * spectralCeiling;
      return value * (1 - spectralContrast) + separated * spectralContrast;
    };
    const sampleProfile = (position, smoothing = 0) => {
      const center = clamp(position, 0, profile.length - 1);
      if (!smoothing) {
        const low = Math.floor(center);
        const blend = center - low;
        return (profile[low] || 0) * (1 - blend) + (profile[low + 1] || profile[low] || 0) * blend;
      }
      let total = 0;
      let weightTotal = 0;
      const radius = Math.max(1, Math.round(smoothing));
      for (let offset = -radius; offset <= radius; offset += 1) {
        const weight = radius + 1 - Math.abs(offset);
        total += (profile[Math.round(clamp(center + offset, 0, profile.length - 1))] || 0) * weight;
        weightTotal += weight;
      }
      return total / weightTotal;
    };
    const topGapHalfRatio = options.topFrequencyGapRatio ?? (15 / 180);
    const topGapFeather = options.topFrequencyGapFeather ?? (5 / 180);
    const lowContourEnd = Math.max(1, Math.ceil((profile.length - 1) * 0.14));
    let lowContourEnergy = 0;
    for (let profileIndex = 0; profileIndex <= lowContourEnd; profileIndex += 1) {
      lowContourEnergy = Math.max(lowContourEnergy, sampleProfile(profileIndex, 1));
    }
    // This is a structural bridge rather than another frequency band. It only
    // rises when the same low-frequency energy that forms the two side lobes
    // is present, then follows the smoothed spectrum envelope back to rest.
    const topGapActivity = smoothstep(
      options.topGapLiftFloor ?? 0.12,
      options.topGapLiftCeiling ?? 0.5,
      lowContourEnergy * 0.82 + (metrics.bass || 0) * 0.18
    );
    let catLowPeakRatio = null;
    let catLowPeakEnergy = 0;
    if (options.catEarFromLow && profile.length > 2) {
      const lowStart = clamp(options.catEarLowMinRatio ?? 0.07, 0, 0.45);
      const lowEnd = clamp(options.catEarLowMaxRatio ?? 0.27, lowStart + 0.02, 0.5);
      const startIndex = Math.max(0, Math.floor(lowStart * (profile.length - 1)));
      const endIndex = Math.min(profile.length - 1, Math.ceil(lowEnd * (profile.length - 1)));
      for (let profileIndex = startIndex; profileIndex <= endIndex; profileIndex += 1) {
        const energy = sampleProfile(profileIndex, options.catEarBaseSmoothBins ?? 5);
        if (energy > catLowPeakEnergy) {
          catLowPeakEnergy = energy;
          catLowPeakRatio = profileIndex / Math.max(1, profile.length - 1);
        }
      }
    }
    const catEarWidth = Math.max(0.04, options.catEarWidth ?? 0.17);
    const resolvedCatEarAngle = options.catEarCenterOnTopGap
      ? topGapHalfRatio * Math.PI + catEarWidth
      : options.catEarFromLow && catLowPeakRatio != null
        ? clamp(
          catLowPeakRatio * Math.PI + (options.catEarAngleOffset || 0),
          options.catEarMinAngle ?? 0.52,
          options.catEarMaxAngle ?? 0.76
        )
        : options.catEarAngle ?? 0.48;
    const output = [];
    for (let index = 0; index < points; index += 1) {
      const ratio = index / points;
      // Leave a real, frequency-free zone around twelve o'clock. Each edge of
      // that zone starts again at the lowest band, then both mirrored halves
      // progress toward the highest band at the bottom of the circle.
      const spatialFrequencyRatio = ratio <= 0.5 ? ratio * 2 : (1 - ratio) * 2;
      const frequencyLayout = mapFrequencyOutsideTopGap(spatialFrequencyRatio, {
        halfGapRatio: topGapHalfRatio,
        featherRatio: topGapFeather
      });
      const frequencyRatio = frequencyLayout.frequencyRatio;
      let profileIndex = frequencyRatio * (profile.length - 1);
      if (options.sectorBins) profileIndex = Math.round(profileIndex / options.sectorBins) * options.sectorBins;
      const profileLow = Math.floor(profileIndex);
      let spectrum = sampleProfile(profileIndex, options.smoothBins || 0);
      if (options.catEarFromLow) {
        const lowBandEdge = options.catEarLowMaxRatio ?? 0.27;
        const lowBandBlend = (1 - smoothstep(lowBandEdge, lowBandEdge + 0.1, frequencyRatio))
          * (options.catEarLowSmoothing ?? 0.78);
        const smoothedLow = sampleProfile(profileIndex, options.catEarBaseSmoothBins ?? 5);
        spectrum = spectrum * (1 - lowBandBlend) + smoothedLow * lowBandBlend;
      }
      spectrum *= frequencyLayout.response;
      const earDrive = clamp(
        spectrum * 0.74
        + (metrics.bass || 0) * 0.2
        + (metrics.rhythmPulse || 0) * 0.06
      );
      const earActivation = options.catEarFromLow
        ? smoothstep(
          options.catEarLowFloor ?? 0.25,
          options.catEarLowCeiling ?? 0.62,
          catLowPeakEnergy * 0.82 + (metrics.bass || 0) * 0.18
        )
        : options.catEarThreshold == null
          ? 1
          : smoothstep(options.catEarThreshold, options.catEarCeiling ?? 0.78, earDrive);
      const seamWidth = options.seamWidth ?? 0.12;
      // Keep the seam treatment spatially stable: only the spectrum mapping
      // expands, rather than widening an artificial notch at twelve o'clock.
      const seamDistance = clamp(spatialFrequencyRatio / Math.max(0.001, seamWidth));
      const seamDip = 1 - (options.catEarDip ?? 0) * earActivation * (1 - seamDistance) ** 2;
      spectrum *= seamDip;
      if (options.lowWeight || options.highWeight || options.midBoost) {
        const emphasis = (options.lowWeight ?? 1) * (1 - frequencyRatio)
          + (options.highWeight ?? 1) * frequencyRatio
          + (options.midBoost || 0) * 4 * frequencyRatio * (1 - frequencyRatio);
        spectrum *= emphasis;
      }
      spectrum = clamp(contrastSpectrum(spectrum));
      if (options.step) spectrum = Math.round(spectrum / options.step) * options.step;
      const waveform = this.waveformAt(
        metrics,
        (ratio + (options.wavePhase || 0) + 1) % 1,
        options.waveSmooth || 0
      );
      const angle = ratio * TAU - Math.PI / 2 + (options.rotation || 0);
      const neighborLeft = contrastSpectrum(profile[Math.max(0, profileLow - 1)] || spectrum);
      const neighborRight = contrastSpectrum(profile[Math.min(profile.length - 1, profileLow + 2)] || spectrum);
      const localPeak = Math.max(0, spectrum - (neighborLeft + neighborRight) * 0.5)
        * frequencyLayout.response;
      const serration = options.serration
        ? Math.sin(index * Math.PI * 0.92) * options.serration * (0.18 + spectrum * 0.82)
        : 0;
      const wobble = options.wobble
        ? Math.sin(angle * (options.wobbleRate || 3) + (options.time || 0) * 0.002) * options.wobble * (0.35 + spectrum)
        : 0;
      const broadWave = options.broadWave
        ? (() => {
          const wave = typeof options.broadWave === 'object' ? options.broadWave : {};
          const lobes = wave.lobes || 3;
          const speed = wave.speed || 0.0006;
          const amount = wave.amount || 3;
          return (
            Math.sin(angle * lobes - (options.time || 0) * speed)
            + Math.sin(angle * (lobes + 1) + (options.time || 0) * speed * 0.58) * 0.3
          ) * amount * (0.72 + metrics.mid * 0.28);
        })()
        : 0;
      const gravitySag = options.gravitySag
        ? Math.max(0, Math.sin(angle)) ** 1.55
          * options.gravitySag
          * (0.42 + spectrum * 0.58)
        : 0;
      // Raise the whole frequency-free valley and let that support continue
      // underneath the inner cat-ear slope. A narrow bell exactly on the seam
      // leaves a low spot on either side; this broad shoulder keeps the radius
      // and its slope continuous from the valley into both ears.
      const topGapLiftOuterWidth = options.catEarCenterOnTopGap
        ? Math.max(topGapFeather, (catEarWidth / Math.PI) * (options.catEarRootBlend ?? 0.72))
        : topGapFeather;
      const topGapInteriorLift = 0.84 + smoothstep(
        0,
        topGapHalfRatio,
        spatialFrequencyRatio
      ) * 0.16;
      const topGapLiftEnvelope = topGapInteriorLift * (1 - smoothstep(
        topGapHalfRatio,
        topGapHalfRatio + topGapLiftOuterWidth,
        spatialFrequencyRatio
      ));
      const topGapLift = topGapLiftEnvelope
        * topGapActivity
        * (options.topFrequencyGapLift ?? 6.5);
      const polygonScale = options.facets
        ? Math.cos(Math.PI / options.facets) / Math.cos(
          ((angle + Math.PI / options.facets + TAU) % (TAU / options.facets)) - Math.PI / options.facets
        )
        : 1;
      const shapedBaseRadius = (options.radius || 72) * polygonScale;
      const lobes = options.lobes
        ? (0.5 + Math.cos(angle * options.lobes + (options.lobePhase || 0)) * 0.5)
          * (options.lobeAmount || 0) * (0.28 + spectrum * 0.72)
        : 0;
      const fracture = options.fracture
        ? (Math.sin(index * 12.9898 + Math.floor(index / 3) * 4.1414) * 0.5 + 0.5)
          * options.fracture * (0.18 + spectrum * 0.82)
        : 0;
      const spike = options.spike
        ? Math.max(0, localPeak * 2.5 + spectrum - (options.spikeThreshold ?? 0.42))
          * options.spike * (index % 2 ? 0.48 : 1)
        : 0;
      const topRelative = Math.atan2(Math.sin(angle + Math.PI / 2), Math.cos(angle + Math.PI / 2));
      const earAngle = resolvedCatEarAngle;
      const earShapePower = Math.max(1, options.catEarShapePower ?? 2);
      const leftEarDistance = Math.abs(topRelative - earAngle);
      const rightEarDistance = Math.abs(topRelative + earAngle);
      const nearestEarDistance = Math.min(leftEarDistance, rightEarDistance);
      const earEnvelope = options.catEarBoost || options.catEarFromLow
        ? options.catEarTriangle
          ? Math.max(0, 1 - leftEarDistance / catEarWidth)
            + Math.max(0, 1 - rightEarDistance / catEarWidth)
          : Math.exp(-((leftEarDistance / catEarWidth) ** earShapePower))
            + Math.exp(-((rightEarDistance / catEarWidth) ** earShapePower))
        : 0;
      const catEarMagnitude = options.catEarFromLow
        ? catLowPeakEnergy * (options.amplitude || 30) * (options.catEarLowGain ?? 0.68)
        : options.catEarBoost || 0;
      const catEarDynamicScale = Math.pow(earActivation, options.catEarGatePower ?? 1)
        * (options.catEarFromLow ? 0.72 + spectrum * 0.28 : 0.44 + spectrum * 0.56);
      const catEar = earEnvelope * catEarMagnitude * catEarDynamicScale;
      const catEarRootAngle = topGapHalfRatio * Math.PI;
      const catEarRootDistance = Math.abs(Math.abs(topRelative) - catEarRootAngle);
      const catEarRootWidth = Math.max(
        TAU / points * 1.25,
        topGapFeather * Math.PI * 0.9
      );
      const catEarRootBridge = options.catEarCenterOnTopGap
        ? Math.exp(-((catEarRootDistance / catEarRootWidth) ** 2))
          * catEarMagnitude
          * catEarDynamicScale
          * (options.catEarRootBridge ?? 0)
        : 0;
      const catEarApex = Boolean(
        options.catEarTriangle
        && earActivation > 0.08
        && nearestEarDistance <= (TAU / points) * 0.52
      );
      const catNotchWidth = Math.max(0.03, options.catEarNotchWidth ?? 0.09);
      const catNotch = options.catEarNotch
        ? Math.exp(-((topRelative / catNotchWidth) ** 2))
          * options.catEarNotch
          * Math.pow(earActivation, options.catEarGatePower ?? 1)
        : 0;
      const catHeadEdge = earAngle + catEarWidth * 1.2;
      const catHeadMask = options.catEarFromLow
        ? 1 - smoothstep(catHeadEdge, catHeadEdge + 0.18, Math.abs(topRelative))
        : 0;
      const catMotionScale = 1 - catHeadMask * earActivation * (options.catEarWaveSuppression ?? 0);
      let vortexEdgeDisturbance = 0;
      if (options.vortexEdge?.arms) {
        const vortex = options.vortexEdge;
        for (let armIndex = 0; armIndex < vortex.arms; armIndex += 1) {
          const armPhase = vortex.phaseOffsets?.[armIndex] ?? armIndex / vortex.arms;
          const joinAngle = vortex.rotation + armPhase * TAU
            - vortex.direction * (
              (vortex.joinTravel ?? 0.62) * vortex.curl
              + (armIndex % 2 ? -0.045 : 0.035)
            );
          const delta = Math.atan2(Math.sin(angle - joinAngle), Math.cos(angle - joinAngle));
          const envelope = Math.exp(-((delta / (vortex.width ?? 0.25)) ** 2));
          const flow = 0.76 + 0.24 * Math.sin((options.time || 0) * 0.00115 + armIndex * 1.7);
          vortexEdgeDisturbance += envelope
            * (vortex.strength ?? 3.5)
            * flow
            * (0.4 + spectrum * 0.6);
        }
      }
      const radius = shapedBaseRadius
        + spectrum * (options.amplitude || 30)
        + waveform * (options.waveAmplitude || 7) * catMotionScale
        + topGapLift
        + localPeak * (options.amplitude || 30) * (options.peakBoost ?? 0.72)
        + serration
        + wobble * catMotionScale
        + broadWave * catMotionScale
        + gravitySag
        + lobes
        + fracture
        + spike
        + vortexEdgeDisturbance;
      // Trance can drag loud spectral peaks tangentially so the waveform
      // itself becomes an accretion flow instead of a conventional radial
      // ring. Other genres keep the original purely radial geometry.
      const drawAngle = angle + (options.spiralTwist || 0)
        * (spectrum * 0.78 + waveform * 0.22)
        * (0.45 + Math.max(0, radius - shapedBaseRadius) / Math.max(1, options.amplitude || 30));
      output.push({
        x: x + (options.offsetX || 0) + Math.cos(drawAngle) * radius,
        y: y + (options.offsetY || 0) + Math.sin(drawAngle) * radius,
        angle: drawAngle,
        sourceAngle: angle,
        radius,
        catEar: catEar + catEarRootBridge,
        catNotch,
        sharp: catEarApex,
        baseRadius: shapedBaseRadius,
        spectrum,
        frequencyRatio
      });
    }
    if (options.topFrequencyGapMatchLowerAverage && topGapHalfRatio > 0 && output.length > 5) {
      const lowerHalf = output.filter((point) => Math.sin(point.sourceAngle) > 0);
      const lowerAverageRadius = lowerHalf.reduce((total, point) => total + point.radius, 0)
        / Math.max(1, lowerHalf.length);
      const shoulderPeak = { left: lowerAverageRadius, right: lowerAverageRadius };
      const shoulderSearchEnd = topGapHalfRatio + Math.max(topGapFeather * 3.1, 0.065);
      output.forEach((point) => {
        const topRelative = Math.atan2(
          Math.sin(point.sourceAngle + Math.PI / 2),
          Math.cos(point.sourceAngle + Math.PI / 2)
        );
        const topDistanceRatio = Math.abs(topRelative) / Math.PI;
        if (topDistanceRatio < topGapHalfRatio || topDistanceRatio > shoulderSearchEnd) return;
        const side = topRelative < 0 ? 'left' : 'right';
        shoulderPeak[side] = Math.max(shoulderPeak[side], point.radius);
      });
      const audioPresence = smoothstep(
        options.topGapPresenceFloor ?? 0.025,
        options.topGapPresenceCeiling ?? 0.18,
        (metrics.volume || 0) * 0.58
          + (metrics.bass || 0) * 0.24
          + (metrics.mid || 0) * 0.18
      );
      const shapeFeather = Math.max(topGapFeather, 0.001);
      output.forEach((point) => {
        const topRelative = Math.atan2(
          Math.sin(point.sourceAngle + Math.PI / 2),
          Math.cos(point.sourceAngle + Math.PI / 2)
        );
        const topDistanceRatio = Math.abs(topRelative) / Math.PI;
        const matchEnvelope = 1 - smoothstep(
          topGapHalfRatio,
          topGapHalfRatio + shapeFeather,
          topDistanceRatio
        );
        const blend = matchEnvelope * audioPresence;
        const side = topRelative < 0 ? 'left' : 'right';
        const valleyProgress = smoothstep(0, topGapHalfRatio, topDistanceRatio);
        const curvedTarget = lowerAverageRadius + Math.max(
          0,
          shoulderPeak[side] - lowerAverageRadius
        ) * valleyProgress * (options.topFrequencyGapValleyCurve || 0);
        point.radius += (curvedTarget - point.radius) * blend;
        point.x = x + (options.offsetX || 0) + Math.cos(point.angle) * point.radius;
        point.y = y + (options.offsetY || 0) + Math.sin(point.angle) * point.radius;
      });
    }
    if ((options.topFrequencyGapWaveAmplitude || 0) > 0 && topGapHalfRatio > 0) {
      const signal = clamp(
        (metrics.volume || 0) * 0.62
          + (metrics.bass || 0) * 0.23
          + (metrics.mid || 0) * 0.15
      );
      const signalGate = smoothstep(0.008, 0.075, signal);
      output.forEach((point) => {
        const topRelative = Math.atan2(
          Math.sin(point.sourceAngle + Math.PI / 2),
          Math.cos(point.sourceAngle + Math.PI / 2)
        );
        const topDistanceRatio = Math.abs(topRelative) / Math.PI;
        if (topDistanceRatio > topGapHalfRatio) return;
        const localRatio = clamp(topRelative / (topGapHalfRatio * Math.PI) * 0.5 + 0.5);
        const edgeFade = 1 - smoothstep(0.82, 1, topDistanceRatio / topGapHalfRatio);
        const wave = this.waveformAt(
          metrics,
          localRatio,
          options.topFrequencyGapWaveSmoothing
        );
        point.radius += wave
          * options.topFrequencyGapWaveAmplitude
          * signalGate
          * (0.72 + edgeFade * 0.28);
        point.x = x + (options.offsetX || 0) + Math.cos(point.angle) * point.radius;
        point.y = y + (options.offsetY || 0) + Math.sin(point.angle) * point.radius;
      });
    }
    if ((options.topFrequencyGapNotchGuard || 0) > 0 && topGapHalfRatio > 0 && output.length > 7) {
      const signal = clamp(
        (metrics.volume || 0) * 0.62
          + (metrics.bass || 0) * 0.23
          + (metrics.lowMid || 0) * 0.15
      );
      const signalGate = smoothstep(0.008, 0.065, signal);
      if (signalGate > 0) {
        const sourceRadii = output.map((point) => point.radius);
        const boundaryOffset = topGapHalfRatio * output.length / 2;
        const indexAt = (offset, side) => side > 0
          ? (offset + output.length) % output.length
          : (output.length - offset) % output.length;
        for (const side of [1, -1]) {
          for (const offset of [Math.floor(boundaryOffset), Math.ceil(boundaryOffset)]) {
            const index = indexAt(offset, side);
            const previousRadius = sourceRadii[indexAt(offset - 1, side)];
            const nextRadius = sourceRadii[indexAt(offset + 1, side)];
            const localFloor = Math.min(previousRadius, nextRadius);
            const notchDepth = localFloor - sourceRadii[index];
            if (notchDepth <= 0.22) continue;
            // Leave a tiny angular corner, but remove the needle-like inward V.
            const lift = (notchDepth - 0.14)
              * options.topFrequencyGapNotchGuard
              * signalGate;
            output[index].radius += Math.max(0, lift);
            output[index].x = x + (options.offsetX || 0) + Math.cos(output[index].angle) * output[index].radius;
            output[index].y = y + (options.offsetY || 0) + Math.sin(output[index].angle) * output[index].radius;
          }
        }
      }
    }
    if ((options.topFrequencyGapValleyGuard || 0) > 0 && topGapHalfRatio > 0 && output.length > 11) {
      const signal = clamp(
        (metrics.volume || 0) * 0.58
          + (metrics.bass || 0) * 0.27
          + (metrics.lowMid || 0) * 0.15
      );
      const signalGate = smoothstep(0.008, 0.065, signal);
      if (signalGate > 0) {
        const sourceRadii = output.map((point) => point.radius);
        const halfCount = output.length / 2;
        const boundaryOffset = topGapHalfRatio * halfCount;
        const innerOffset = Math.max(0, Math.floor(
          boundaryOffset - Math.max(1.5, topGapFeather * halfCount * 0.65)
        ));
        const searchEnd = Math.min(Math.floor(halfCount), Math.ceil(
          boundaryOffset + Math.max(5, topGapFeather * halfCount * 3.2)
        ));
        const indexAt = (offset, side) => side > 0
          ? Math.round(offset) % output.length
          : (output.length - Math.round(offset)) % output.length;

        for (const side of [1, -1]) {
          let outerOffset = Math.max(innerOffset + 2, Math.ceil(boundaryOffset));
          let outerRadius = -Infinity;
          for (let offset = outerOffset; offset <= searchEnd; offset += 1) {
            const radius = sourceRadii[indexAt(offset, side)];
            if (radius > outerRadius) {
              outerRadius = radius;
              outerOffset = offset;
            }
          }
          if (outerOffset <= innerOffset + 1) continue;
          const innerRadius = sourceRadii[indexAt(innerOffset, side)];
          for (let offset = innerOffset + 1; offset < outerOffset; offset += 1) {
            const index = indexAt(offset, side);
            const progress = smoothstep(innerOffset, outerOffset, offset);
            const bridgeRadius = innerRadius + (outerRadius - innerRadius) * progress;
            if (output[index].radius >= bridgeRadius) continue;
            const lift = (bridgeRadius - output[index].radius)
              * options.topFrequencyGapValleyGuard
              * signalGate;
            output[index].radius += lift;
            output[index].x = x + (options.offsetX || 0) + Math.cos(output[index].angle) * output[index].radius;
            output[index].y = y + (options.offsetY || 0) + Math.sin(output[index].angle) * output[index].radius;
          }
        }
      }
    }
    if ((options.topFrequencyGapShoulderSmoothing || 0) > 0 && output.length > 9) {
      const sourceRadii = output.map((point) => point.radius);
      const windowRadius = 4;
      const smoothedRadii = sourceRadii.map((radius, index) => {
        let total = 0;
        let weightTotal = 0;
        for (let offset = -windowRadius; offset <= windowRadius; offset += 1) {
          const wrapped = (index + offset + sourceRadii.length) % sourceRadii.length;
          const weight = windowRadius + 1 - Math.abs(offset);
          total += sourceRadii[wrapped] * weight;
          weightTotal += weight;
        }
        return total / weightTotal;
      });
      output.forEach((point, index) => {
        const topDistanceRatio = Math.abs(Math.atan2(
          Math.sin(point.sourceAngle + Math.PI / 2),
          Math.cos(point.sourceAngle + Math.PI / 2)
        )) / Math.PI;
        const shoulderDistance = Math.abs(topDistanceRatio - topGapHalfRatio);
        const shoulderMask = 1 - smoothstep(
          topGapFeather * 0.2,
          topGapFeather * 2.4,
          shoulderDistance
        );
        const interiorArcMask = options.topFrequencyGapPreserveInteriorArc
          ? smoothstep(
            Math.max(0, topGapHalfRatio - 2.5 / output.length),
            topGapHalfRatio,
            topDistanceRatio
          )
          : 1;
        const blend = shoulderMask
          * interiorArcMask
          * options.topFrequencyGapShoulderSmoothing;
        point.radius = point.radius * (1 - blend) + smoothedRadii[index] * blend;
        point.x = x + (options.offsetX || 0) + Math.cos(point.angle) * point.radius;
        point.y = y + (options.offsetY || 0) + Math.sin(point.angle) * point.radius;
      });
    }
    if (options.radialSmooth && output.length > 5) {
      const smoothing = typeof options.radialSmooth === 'object' ? options.radialSmooth : {};
      const windowRadius = smoothing.window ?? 4;
      const passes = smoothing.passes ?? 2;
      const blend = smoothing.blend ?? 0.88;
      let radii = output.map((point) => point.radius);
      for (let pass = 0; pass < passes; pass += 1) {
        const next = new Array(radii.length);
        for (let index = 0; index < radii.length; index += 1) {
          let total = 0;
          let weightTotal = 0;
          for (let offset = -windowRadius; offset <= windowRadius; offset += 1) {
            const wrapped = (index + offset + radii.length) % radii.length;
            const weight = windowRadius + 1 - Math.abs(offset);
            total += radii[wrapped] * weight;
            weightTotal += weight;
          }
          const average = total / weightTotal;
          next[index] = radii[index] * (1 - blend) + average * blend;
        }
        radii = next;
      }
      output.forEach((point, index) => {
        point.radius = radii[index];
        point.x = x + (options.offsetX || 0) + Math.cos(point.angle) * point.radius;
        point.y = y + (options.offsetY || 0) + Math.sin(point.angle) * point.radius;
      });
    }
    output.forEach((point) => {
      point.radius += (point.catEar || 0) - (point.catNotch || 0);
      point.x = x + (options.offsetX || 0) + Math.cos(point.angle) * point.radius;
      point.y = y + (options.offsetY || 0) + Math.sin(point.angle) * point.radius;
    });
    return output;
  }

  appendPointLoop(points, smooth = false) {
    const ctx = this.ctx;
    if (!points.length) return;
    if (smooth && points.length > 2) {
      const tension = typeof smooth === 'number' ? smooth : 0.68;
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 0; index < points.length; index += 1) {
        const previous = points[(index - 1 + points.length) % points.length];
        const point = points[index];
        const next = points[(index + 1) % points.length];
        const afterNext = points[(index + 2) % points.length];
        if (point.sharp || next.sharp) {
          ctx.lineTo(next.x, next.y);
          continue;
        }
        ctx.bezierCurveTo(
          point.x + (next.x - previous.x) * tension / 6,
          point.y + (next.y - previous.y) * tension / 6,
          next.x - (afterNext.x - point.x) * tension / 6,
          next.y - (afterNext.y - point.y) * tension / 6,
          next.x,
          next.y
        );
      }
      return;
    }
    points.forEach((point, index) => {
      if (!index) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
  }

  tracePoints(points, close = true, smooth = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.appendPointLoop(points, close ? smooth : false);
    if (close) ctx.closePath();
  }

  traceBand(outer, inner, smooth = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.appendPointLoop(outer, smooth);
    ctx.closePath();
    this.appendPointLoop(inner, smooth);
    ctx.closePath();
  }

  updateBilibiliResponse(metrics, time) {
    const deltaMs = this.bilibiliMotionLastAt
      ? clamp(time - this.bilibiliMotionLastAt, 4, 64)
      : 16.667;
    this.bilibiliMotionLastAt = time;
    const follow = (current, target, attackMs, releaseMs) => {
      const tau = target > current ? attackMs : releaseMs;
      return current + (target - current) * (1 - Math.exp(-deltaMs / tau));
    };

    // Speech carries a syllabic envelope and many short consonant peaks. Track
    // the sustained mid-band body, then apply a long release so plosives and
    // edits do not read as musical hits.
    const speechBody = clamp(
      (metrics.volume || 0) * 0.46
        + (metrics.lowMid || 0) * 0.23
        + (metrics.mid || 0) * 0.27
        + (metrics.high || 0) * 0.04
    );
    const activityTarget = smoothstep(0.022, 0.31, speechBody);
    const relativeEnergy = Number.isFinite(metrics.relativeEnergy) ? metrics.relativeEnergy : 1;
    const sectionTarget = smoothstep(0.72, 1.36, relativeEnergy);
    const transient = Math.max(
      metrics.impact || 0,
      metrics.rhythmPulse || 0,
      metrics.rhythmStrength || 0
    );
    const transientTarget = smoothstep(0.42, 0.9, transient);

    this.bilibiliVoiceActivity = follow(this.bilibiliVoiceActivity, activityTarget, 260, 920);
    this.bilibiliSectionDrive = follow(this.bilibiliSectionDrive, sectionTarget, 780, 1450);
    this.bilibiliTransientDrive = follow(this.bilibiliTransientDrive, transientTarget, 90, 480);
    const motionTarget = clamp(
      this.bilibiliVoiceActivity * 0.22
        + this.bilibiliSectionDrive * 0.48
        + this.bilibiliTransientDrive * 0.3
    );
    this.bilibiliMotionDrive = follow(this.bilibiliMotionDrive, motionTarget, 220, 700);
    const sectionOffset = this.bilibiliSectionDrive - 0.34;
    this.bilibiliTvScaleX = 1 + sectionOffset * 0.03 + this.bilibiliTransientDrive * 0.045;
    this.bilibiliTvScaleY = 1 + sectionOffset * 0.012 - this.bilibiliTransientDrive * 0.022;
  }

  drawBilibiliStock(metrics, time) {
    if (document.body.dataset.backgroundStyle !== 'themed') return;
    const ctx = this.ctx;
    const fullscreenOutput = document.body.dataset.stageOutput === 'true';
    const posterLayout = document.body.dataset.layout === 'poster';
    const bounds = fullscreenOutput
      ? { left: 0, top: 0, right: this.width, bottom: this.height, radius: 0 }
      : posterLayout
      ? { left: 16, top: 16, right: this.width - 16, bottom: this.height - 16, radius: 24 }
      : { left: 54, top: 48, right: this.width - 108, bottom: this.height - 48, radius: 152 };
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    // The stock itself remains evenly lit. Only the two broad colour bands get
    // an almost imperceptible ambient drift; audio never changes brightness.
    const bandAmplitude = 1.6
      + this.bilibiliSectionDrive * 4.2
      + this.bilibiliTransientDrive * 4.8;
    const bandDrift = Math.sin(time * 0.00034) * bandAmplitude;
    const pinkBandOffset = width * 0.06;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const stock = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
    stock.addColorStop(0, '#fffafb');
    stock.addColorStop(0.48, '#f8f8f8');
    stock.addColorStop(1, '#eaf8fd');
    ctx.fillStyle = stock;
    ctx.beginPath();
    ctx.roundRect(bounds.left, bounds.top, width, height, bounds.radius);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(bounds.left, bounds.top, width, height, bounds.radius);
    ctx.clip();

    ctx.fillStyle = 'rgba(251, 114, 153, 0.22)';
    ctx.beginPath();
    ctx.moveTo(bounds.left + width * 0.13 + pinkBandOffset + bandDrift, bounds.top);
    ctx.lineTo(bounds.left + width * 0.30 + pinkBandOffset + bandDrift, bounds.top);
    ctx.lineTo(bounds.left + width * 0.20 + pinkBandOffset + bandDrift, bounds.bottom);
    ctx.lineTo(bounds.left + width * 0.03 + pinkBandOffset + bandDrift, bounds.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(35, 173, 229, 0.25)';
    ctx.beginPath();
    ctx.moveTo(bounds.left + width * 0.74 - bandDrift, bounds.top);
    ctx.lineTo(bounds.left + width * 0.91 - bandDrift, bounds.top);
    ctx.lineTo(bounds.left + width * 0.81 - bandDrift, bounds.bottom);
    ctx.lineTo(bounds.left + width * 0.64 - bandDrift, bounds.bottom);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawAtmosphere(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const pulse = metrics.rhythmPulse || 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (theme.mode === 'asmr') {
      const breath = 0.5 + 0.5 * Math.sin(time * 0.00062);
      const softDrive = clamp(metrics.volume * 0.38 + metrics.mid * 0.4 + metrics.high * 0.22);
      this.glowCircle(x, y, 144 + breath * 14 + softDrive * 7, theme.accent, 0.03 + breath * 0.03 + softDrive * 0.018);
      this.glowCircle(x + Math.sin(time * 0.00011) * 7, y - 6, 120 + breath * 10, theme.accent2, 0.026 + (1 - breath) * 0.025);
      this.glowCircle(x - 8, y + 5, 92 + (1 - breath) * 9, theme.hot, 0.012 + softDrive * 0.018);
      this.strokeGlow(theme.accent2, 0.72, 19, 0.075 + breath * 0.05 + softDrive * 0.025);
      ctx.beginPath();
      ctx.arc(x, y, 112 + breath * 7, time * 0.000025, time * 0.000025 + Math.PI * 0.94);
      ctx.stroke();
      this.strokeGlow(theme.accent, 0.52, 22, 0.05 + (1 - breath) * 0.04 + softDrive * 0.018);
      ctx.beginPath();
      ctx.arc(x, y, 128 + (1 - breath) * 6, -time * 0.000018 + Math.PI * 0.7, -time * 0.000018 + Math.PI * 1.55);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (theme.mode === 'bilibili') {
      const activity = this.bilibiliVoiceActivity;
      const motionDrive = this.bilibiliMotionDrive;
      const population = clamp(
        0.08
          + activity * 0.12
          + this.bilibiliSectionDrive * 0.58
          + this.bilibiliTransientDrive * 0.5
      );
      const fullscreenOutput = document.body.dataset.stageOutput === 'true';
      const posterLayout = document.body.dataset.layout === 'poster';
      const bounds = fullscreenOutput
        ? { left: 0, top: 0, right: this.width, bottom: this.height, radius: 0 }
        : posterLayout
        ? { left: 16, top: 16, right: this.width - 16, bottom: this.height - 16, radius: 24 }
        : { left: 54, top: 48, right: this.width - 108, bottom: this.height - 48, radius: 152 };
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.roundRect(bounds.left + 4, bounds.top + 4, width - 8, height - 8, Math.max(2, bounds.radius - 4));
      ctx.clip();
      const deltaMs = this.bilibiliDanmakuLastAt
        ? clamp(time - this.bilibiliDanmakuLastAt, 0, 64)
        : 16.667;
      this.bilibiliDanmakuLastAt = time;
      for (const item of this.bilibiliDanmaku) {
        // Every item shares one travel distance and every lane shares one speed.
        // Their initial lane slots therefore remain separated over time. The
        // extra 18px at each end keeps a bar hidden until it has fully entered
        // and delays its reset until the widest possible bar has fully exited.
        const cycleWidth = width + 92 + 36;
        const entryX = bounds.right + 18;
        const speed = item.speed + (motionDrive ** 1.35) * 0.07;
        const previousProgress = item.progress;
        item.progress = (item.progress + deltaMs * speed / cycleWidth) % 1;
        const looped = item.progress < previousProgress;
        if (typeof item.active !== 'boolean' || looped) {
          item.active = item.spawnAt <= population;
        } else if (!item.active && item.progress < 0.06 && item.spawnAt <= population) {
          item.active = true;
        }
        if (!item.active) continue;
        const distance = item.progress * cycleWidth;
        const itemX = entryX - distance;
        const itemY = bounds.top + 10 + item.y * (height - 20);
        const color = item.color === 0 ? theme.accent : item.color === 1 ? theme.accent2 : '#9bdff2';
        ctx.fillStyle = rgba(color, item.alpha);
        ctx.beginPath();
        ctx.roundRect(itemX, itemY, item.width, item.height, item.height * 0.5);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (theme.mode === 'trance' && theme.family !== 'classical' && theme.id !== 'soundtrack') {
      // Trance lives in a slowly breathing color field. Avoid another visible
      // orbit here: its signature layer already carries the single hypnotic
      // path, while these offset glows create depth without line clutter.
      const breath = 0.5 + 0.5 * Math.sin(time * 0.00028);
      const drift = time * 0.000045;
      const immersion = clamp(metrics.volume * 0.34 + metrics.mid * 0.42 + metrics.high * 0.24);
      this.glowCircle(
        x + Math.cos(drift) * 6,
        y + Math.sin(drift * 1.17) * 4,
        158 + breath * 17,
        theme.accent,
        0.035 + breath * 0.03 + immersion * 0.045
      );
      this.glowCircle(
        x - Math.cos(drift * 0.83) * 10,
        y - 6 + Math.sin(drift) * 7,
        132 + (1 - breath) * 20,
        theme.accent2,
        0.03 + (1 - breath) * 0.032 + immersion * 0.038
      );
      this.glowCircle(x, y, 94 + breath * 9, theme.hot, 0.012 + immersion * 0.02);
      ctx.restore();
      return;
    }
    if (theme.mode === 'phonk') {
      // Phonk gets pressure and stained light, not the generic circular
      // atmosphere arc. The weighted waveform and impact front carry its
      // geometry; another steady arc would rebuild the ring we removed.
      const drift = theme.id === 'drift-phonk';
      const bassPressure = clamp(metrics.bass * 0.66 + metrics.lowMid * 0.34);
      const smear = Math.sin(time * (drift ? 0.00031 : 0.00019));
      // Offset stains keep the atmosphere nocturnal without placing another
      // centred disc beneath the waveform.
      this.glowCircle(x - 38 + smear * 12, y + 29, 108 + bassPressure * 16, theme.accent, 0.021 + bassPressure * 0.052);
      this.glowCircle(x + 46 - smear * 10, y - 31, 84 + metrics.mid * 12, theme.accent2, 0.018 + metrics.mid * 0.044);
      this.glowCircle(x - 29, y - 13, 58 + pulse * 7, theme.hot, 0.009 + pulse * 0.02);
      ctx.restore();
      return;
    }
    this.glowCircle(x, y, 154 + metrics.bass * 20, theme.accent, 0.035 + metrics.volume * 0.075);
    this.glowCircle(x + Math.sin(time * 0.00024) * 8, y - 3, 126, theme.accent2, 0.025 + metrics.mid * 0.052);
    // The old shared partial orbit looked like the same rotating C-shaped
    // bezel on almost every genre and expanded again on impact. Atmosphere is
    // now colour volume only; geometry belongs to each genre signature and
    // the short-lived impact layer.
    ctx.restore();
  }

  resolveSynthwaveHorizonY(bounds, posterLayout, time) {
    const fullscreenCentered = fullscreenUsesCenteredScene();
    const fallbackY = fullscreenCentered
      ? this.centerY + 22
      : bounds.top + (bounds.bottom - bounds.top) * (posterLayout ? 0.39 : 0.53);
    if (posterLayout) {
      this.synthCapsuleHorizonMeasuredAt = 0;
      return fallbackY;
    }
    const measurementStale = !this.synthCapsuleHorizonY
      || time - this.synthCapsuleHorizonMeasuredAt >= 250;
    if (measurementStale) {
      const progressRule = document.querySelector('.track-rule');
      const canvasBounds = this.canvas.getBoundingClientRect();
      const progressBounds = progressRule?.getBoundingClientRect();
      if (progressBounds?.height > 0 && canvasBounds.height > 0) {
        const canvasScaleY = this.height / canvasBounds.height;
        const progressCenterY = (
          progressBounds.top + progressBounds.height * 0.5 - canvasBounds.top
        ) * canvasScaleY;
        if (Number.isFinite(progressCenterY)) {
          this.synthCapsuleHorizonY = clamp(progressCenterY, bounds.top, bounds.bottom);
          const horizonPercent = this.synthCapsuleHorizonY / Math.max(1, this.height) * 100;
          document.body.style.setProperty(
            '--synth-capsule-horizon-y',
            `${horizonPercent.toFixed(3)}%`
          );
        }
      }
      this.synthCapsuleHorizonMeasuredAt = time;
    }
    return this.synthCapsuleHorizonY || fallbackY;
  }

  drawSynthwaveHorizonScene(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const fullscreenOutput = document.body.dataset.stageOutput === 'true';
    const posterLayout = document.body.dataset.layout === 'poster'
      || fullscreenUsesCenteredScene();
    const themedBackground = document.body.dataset.backgroundStyle === 'themed';
    if (!themedBackground) return;
    const bounds = fullscreenOutput
      ? { left: 0, top: 0, right: this.width, bottom: this.height, radius: 0 }
      : posterLayout
      ? { left: 16, top: 16, right: this.width - 16, bottom: this.height - 16, radius: 24 }
      : { left: 54, top: 48, right: this.width - 108, bottom: this.height - 48, radius: 152 };
    const horizonY = this.resolveSynthwaveHorizonY(bounds, posterLayout, time);
    const floorDepth = Math.max(1, bounds.bottom - horizonY);
    const synthwaveResponse = metrics.synthwaveResponse || null;
    const impact = clamp(synthwaveResponse?.impact
      ?? Math.max(metrics.rhythmPulse || 0, metrics.impact || 0));
    const localEnergy = clamp(
      metrics.volume * 0.24 + metrics.bass * 0.34
        + metrics.lowMid * 0.22 + metrics.mid * 0.12
    );
    const fallbackSectionEnergy = clamp(Math.max(
      localEnergy,
      clamp(((metrics.relativeEnergy || 1) - 0.72) / 1.06) * 0.68
        + clamp(metrics.drive || 0) * 0.32
    ));
    const sectionEnergy = clamp(synthwaveResponse?.sectionEnergy ?? fallbackSectionEnergy);
    const lineEnergy = clamp(synthwaveResponse?.lineEnergy ?? sectionEnergy);
    const gridMotion = clamp(synthwaveResponse?.gridMotion ?? sectionEnergy);
    const sunMotion = clamp(synthwaveResponse?.sunMotion ?? sectionEnergy);
    const elapsedMs = this.synthSceneLastAt
      ? clamp(time - this.synthSceneLastAt, 0, 50)
      : 16.667;
    this.synthSceneLastAt = time;
    // Both clocks respond continuously to section intensity, while a transient
    // provides a brief acceleration instead of resizing any scene element.
    this.synthGridPhase = (
      this.synthGridPhase
        + elapsedMs * (0.00015 + gridMotion * 0.00074 + impact * 0.00035)
    ) % 1;
    this.synthSunScanPhase = (
      this.synthSunScanPhase
        + elapsedMs * (0.000052 + sunMotion * 0.00012 + impact * 0.00006)
    ) % 1;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      bounds.left,
      bounds.top,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
      bounds.radius
    );
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';

    // The sun and album cover live on a dedicated transparent canvas. Scan
    // seams are erased only from this foreground buffer, so they can never cut
    // the road. The finished plane is then clipped above the true horizon.
    const sunRadius = posterLayout ? 110 : 108;
    const foreground = this.synthForegroundCtx;
    foreground.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    foreground.clearRect(0, 0, this.width, this.height);
    foreground.save();
    const sunFill = foreground.createLinearGradient(0, y - sunRadius, 0, y + sunRadius);
    sunFill.addColorStop(0, '#fff0b2');
    sunFill.addColorStop(0.3, '#ffad76');
    sunFill.addColorStop(0.56, '#ff667f');
    sunFill.addColorStop(0.8, '#ff2ba6');
    sunFill.addColorStop(1, '#d80caa');
    foreground.globalAlpha = 0.9 + sectionEnergy * 0.08 + impact * 0.02;
    foreground.fillStyle = sunFill;
    foreground.beginPath();
    foreground.arc(x, y, sunRadius, 0, TAU);
    foreground.fill();

    const artwork = document.querySelector('#artwork');
    const artworkLayer = this.synthArtworkCtx;
    artworkLayer.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    artworkLayer.clearRect(0, 0, this.width, this.height);
    if (artwork?.complete && artwork.naturalWidth > 0) {
      const artworkRadius = sunRadius;
      artworkLayer.save();
      artworkLayer.beginPath();
      artworkLayer.arc(x, y, artworkRadius, 0, TAU);
      artworkLayer.clip();
      artworkLayer.globalAlpha = 0.15;
      artworkLayer.imageSmoothingEnabled = true;
      artworkLayer.imageSmoothingQuality = 'high';
      artworkLayer.drawImage(
        artwork,
        x - artworkRadius,
        y - artworkRadius,
        artworkRadius * 2,
        artworkRadius * 2
      );
      artworkLayer.restore();
      foreground.save();
      foreground.globalAlpha = 1;
      foreground.drawImage(this.synthArtworkCanvas, 0, 0, this.width, this.height);
      foreground.restore();
    }

    foreground.globalCompositeOperation = 'destination-out';
    foreground.globalAlpha = 1;
    foreground.fillStyle = '#000';
    const scanLineCount = 5;
    for (let index = 0; index < scanLineCount; index += 1) {
      const progress = (this.synthSunScanPhase + index / scanLineCount) % 1;
      const travel = progress;
      const entryFade = smoothstep(0, 0.07, progress);
      const exitFade = 1 - smoothstep(0.68, 1, progress);
      const gapCenterY = y + sunRadius * 0.34 - travel * sunRadius * 1.15;
      const gapHeight = (1.2 + (1 - travel) * 5.4) * entryFade * exitFade;
      if (gapHeight <= 0.03) continue;
      foreground.fillRect(
        x - sunRadius - 1,
        gapCenterY - gapHeight * 0.5,
        sunRadius * 2 + 2,
        gapHeight
      );
    }
    foreground.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, horizonY - bounds.top);
    ctx.clip();
    ctx.drawImage(this.synthForegroundCanvas, 0, 0, this.width, this.height);
    ctx.restore();

    // Low polygon ridges break up the empty horizon without competing with the
    // sun. Two offset depth layers keep the landscape readable in both layouts,
    // while the generous central gap preserves the artwork and vanishing point.
    const mountainGap = sunRadius * 0.58;
    const farMountainHeight = posterLayout ? 40 : 30;
    const nearMountainHeight = posterLayout ? 58 : 42;
    const drawMountainRange = ({ startX, endX, height, profile, near, facetDirection }) => {
      if (endX - startX < 24) return;
      const ridge = profile.map(([progress, elevation]) => ({
        x: startX + (endX - startX) * progress,
        y: horizonY - height * elevation
      }));
      const fill = ctx.createLinearGradient(0, horizonY - height, 0, horizonY);
      if (near) {
        fill.addColorStop(0, rgba('#3a2467', 0.86));
        fill.addColorStop(0.58, rgba('#201953', 0.91));
        fill.addColorStop(1, rgba('#10143b', 0.95));
      } else {
        fill.addColorStop(0, rgba('#56317f', 0.52));
        fill.addColorStop(0.62, rgba('#33246a', 0.66));
        fill.addColorStop(1, rgba('#181a4b', 0.78));
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, horizonY);
      ridge.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.lineTo(endX, horizonY);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.shadowColor = 'rgba(2, 1, 14, 0.48)';
      ctx.shadowBlur = near ? 6 : 4;
      ctx.shadowOffsetY = near ? 2 : 1;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Each local summit is split into a sun-facing plane and a deep reverse
      // plane. This creates the graphic low-poly depth of classic Outrun art
      // without adding a soft, floating drop shadow around the whole ridge.
      const peakFacets = [];
      for (let index = 1; index < ridge.length - 1; index += 1) {
        const peak = ridge[index];
        if (peak.y >= ridge[index - 1].y || peak.y >= ridge[index + 1].y) continue;
        const baseX = clamp(
          peak.x + facetDirection * height * (near ? 0.34 : 0.27),
          startX + 2,
          endX - 2
        );
        const base = { x: baseX, y: horizonY };
        const lightFace = facetDirection > 0
          ? [peak, ridge[index + 1], base]
          : [ridge[index - 1], peak, base];
        const shadowFace = facetDirection > 0
          ? [ridge[index - 1], peak, base]
          : [peak, ridge[index + 1], base];
        peakFacets.push({ peak, base, lightFace, shadowFace });
      }

      const traceFacet = (points) => {
        ctx.beginPath();
        points.forEach((point, index) => {
          if (!index) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
      };
      peakFacets.forEach(({ lightFace, shadowFace }) => {
        ctx.globalCompositeOperation = 'source-over';
        traceFacet(shadowFace);
        ctx.fillStyle = near
          ? rgba('#07102d', 0.34)
          : rgba('#151035', 0.22);
        ctx.fill();

        ctx.globalCompositeOperation = 'screen';
        traceFacet(lightFace);
        ctx.fillStyle = near
          ? rgba(theme.accent, 0.14 + lineEnergy * 0.05)
          : rgba(theme.accent2, 0.09 + lineEnergy * 0.03);
        ctx.fill();
      });

      // A short contact shadow lets the mountains sit on the grid plane. The
      // road and luminous horizon are drawn later, so their neon lines remain
      // crisp over this dark footing instead of being blurred away.
      ctx.globalCompositeOperation = 'source-over';
      const footing = ctx.createLinearGradient(0, horizonY - 2, 0, horizonY + (near ? 8 : 5));
      footing.addColorStop(0, 'rgba(2, 2, 14, 0.22)');
      footing.addColorStop(0.45, 'rgba(2, 2, 14, 0.1)');
      footing.addColorStop(1, 'rgba(2, 2, 14, 0)');
      ctx.fillStyle = footing;
      ctx.fillRect(startX, horizonY - 2, endX - startX, near ? 10 : 7);

      ctx.globalCompositeOperation = 'screen';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = near
        ? rgba(theme.accent, 0.24 + lineEnergy * 0.08)
        : rgba(theme.accent2, 0.14 + lineEnergy * 0.05);
      ctx.lineWidth = near ? 0.9 : 0.65;
      ctx.shadowColor = near ? theme.accent : theme.accent2;
      ctx.shadowBlur = (near ? 3.5 : 2) + lineEnergy * 3;
      ctx.beginPath();
      ridge.forEach((point, index) => {
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.globalAlpha = near ? 0.2 : 0.11;
      ctx.strokeStyle = near ? theme.accent2 : '#947eea';
      ctx.lineWidth = near ? 0.62 : 0.5;
      ctx.beginPath();
      peakFacets.forEach(({ peak, base }) => {
        ctx.moveTo(peak.x, peak.y + 1);
        ctx.lineTo(base.x, base.y);
      });
      ctx.stroke();
      ctx.restore();
    };

    const mountainProfiles = {
      farLeft: [[0, 0.08], [0.13, 0.36], [0.25, 0.22], [0.39, 0.58], [0.53, 0.3], [0.68, 0.72], [0.82, 0.4], [0.92, 0.17], [1, 0.025]],
      farRight: [[0, 0.025], [0.08, 0.16], [0.18, 0.4], [0.31, 0.68], [0.46, 0.35], [0.62, 0.56], [0.79, 0.27], [1, 0.08]],
      nearLeft: [[0, 0.06], [0.12, 0.29], [0.24, 0.18], [0.38, 0.63], [0.51, 0.36], [0.66, 0.82], [0.79, 0.45], [0.91, 0.3], [0.97, 0.13], [1, 0.025]],
      nearRight: [[0, 0.025], [0.06, 0.13], [0.15, 0.36], [0.29, 0.76], [0.44, 0.42], [0.61, 0.66], [0.8, 0.31], [1, 0.06]]
    };
    drawMountainRange({
      startX: bounds.left,
      endX: x - mountainGap * 0.72,
      height: farMountainHeight,
      profile: mountainProfiles.farLeft,
      near: false,
      facetDirection: 1
    });
    drawMountainRange({
      startX: x + mountainGap * 0.72,
      endX: bounds.right,
      height: farMountainHeight,
      profile: mountainProfiles.farRight,
      near: false,
      facetDirection: -1
    });
    drawMountainRange({
      startX: bounds.left,
      endX: x - mountainGap * 0.96,
      height: nearMountainHeight,
      profile: mountainProfiles.nearLeft,
      near: true,
      facetDirection: 1
    });
    drawMountainRange({
      startX: x + mountainGap * 0.96,
      endX: bounds.right,
      height: nearMountainHeight,
      profile: mountainProfiles.nearRight,
      near: true,
      facetDirection: -1
    });

    // A shallow atmospheric veil pushes the range behind the road. It is
    // strongest at the mountain feet and dissolves before reaching the peaks.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const mountainHaze = ctx.createLinearGradient(0, horizonY - 34, 0, horizonY + 10);
    mountainHaze.addColorStop(0, rgba(theme.accent2, 0));
    mountainHaze.addColorStop(0.48, rgba(theme.accent2, 0.055 + lineEnergy * 0.025));
    mountainHaze.addColorStop(0.78, rgba('#ff65bd', 0.2 + lineEnergy * 0.06));
    mountainHaze.addColorStop(1, rgba('#8a78ff', 0));
    ctx.fillStyle = mountainHaze;
    ctx.filter = 'blur(4px)';
    ctx.fillRect(bounds.left, horizonY - 34, bounds.right - bounds.left, 44);
    ctx.restore();

    // The road keeps its fixed geometry. Only forward travel and light output
    // react to section energy and impacts, so it never pumps or changes scale.
    const phase = this.synthGridPhase;
    const rowCount = posterLayout ? 14 : 11;
    const horizonLaneSpacing = posterLayout ? 32 : 38;
    const horizonSpread = 0.29;
    // The base grid stays inside a neon magenta-violet-electric-blue axis.
    // Warm sunset colour is reserved for the separate sunlight reflections.
    const roadGlow = ctx.createLinearGradient(0, horizonY, 0, bounds.bottom);
    roadGlow.addColorStop(0, rgba(theme.accent, 0.26 + lineEnergy * 0.12 + impact * 0.07));
    roadGlow.addColorStop(0.52, rgba('#b22bd8', 0.16 + lineEnergy * 0.08 + impact * 0.05));
    roadGlow.addColorStop(0.68, rgba('#5c49e4', 0.15 + lineEnergy * 0.07 + impact * 0.04));
    roadGlow.addColorStop(1, rgba('#4f7cff', 0.22 + lineEnergy * 0.08 + impact * 0.04));
    const roadCore = ctx.createLinearGradient(0, horizonY, 0, bounds.bottom);
    roadCore.addColorStop(0, rgba(theme.accent, 0.7 + lineEnergy * 0.12 + impact * 0.07));
    roadCore.addColorStop(0.52, rgba('#b22bd8', 0.46 + lineEnergy * 0.11 + impact * 0.06));
    roadCore.addColorStop(0.68, rgba('#5c49e4', 0.42 + lineEnergy * 0.11 + impact * 0.06));
    roadCore.addColorStop(1, rgba('#4f7cff', 0.52 + lineEnergy * 0.13 + impact * 0.06));

    const firstLane = Math.floor((bounds.left - x) / horizonLaneSpacing) - 1;
    const lastLane = Math.ceil((bounds.right - x) / horizonLaneSpacing) + 1;
    const lanes = [];
    for (let lane = firstLane; lane <= lastLane; lane += 1) {
      const laneHorizonX = x + lane * horizonLaneSpacing;
      lanes.push({
        horizonX: laneHorizonX,
        endX: x + (laneHorizonX - x) / horizonSpread
      });
    }
    const rows = [];
    for (let row = 0; row < rowCount; row += 1) {
      const depth = (row + phase) / rowCount;
      const perspective = depth ** 2.28;
      rows.push({ perspective, y: horizonY + perspective * floorDepth });
    }

    const traceRoad = () => {
      ctx.beginPath();
      lanes.forEach((lane) => {
        ctx.moveTo(lane.horizonX, horizonY);
        ctx.lineTo(lane.endX, bounds.bottom);
      });
      rows.forEach((row) => {
        ctx.moveTo(bounds.left, row.y);
        ctx.lineTo(bounds.right, row.y);
      });
    };

    ctx.strokeStyle = roadGlow;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.56;
    traceRoad();
    ctx.stroke();
    ctx.strokeStyle = roadCore;
    ctx.lineWidth = 0.82;
    ctx.globalAlpha = 1;
    traceRoad();
    ctx.stroke();

    // Sunlight is carried by the grid itself rather than a translucent sheet
    // over the floor. Central longitudinal rails receive the strongest warm
    // reflection; short widening highlights bind the horizontal rows to it.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const roadWidth = bounds.right - bounds.left;
    const reflectionFloorHalfWidth = roadWidth * 0.4;
    const reflectionDepthRatio = 0.72;
    const reflectionDepth = floorDepth * reflectionDepthRatio;
    const reflectionEndY = horizonY + reflectionDepth;
    const reflectionNeckProgress = 0.84;
    const reflectionTailHalfWidth = roadWidth * 0.045;
    const reflectionHalfWidthAt = (progress) => {
      const normalized = clamp(progress);
      if (normalized <= reflectionNeckProgress) {
        const bodyProgress = normalized / reflectionNeckProgress;
        const bodyTaper = Math.pow(smoothstep(0, 1, bodyProgress), 1.35);
        return reflectionTailHalfWidth
          + (reflectionFloorHalfWidth - reflectionTailHalfWidth) * (1 - bodyTaper);
      }
      const capProgress = (normalized - reflectionNeckProgress)
        / (1 - reflectionNeckProgress);
      return reflectionTailHalfWidth
        * Math.sqrt(Math.max(0, 1 - capProgress * capProgress));
    };
    const reflectionEnvelopeSteps = 32;
    const traceReflectionEnvelope = () => {
      ctx.beginPath();
      for (let step = 0; step <= reflectionEnvelopeSteps; step += 1) {
        const perspective = step / reflectionEnvelopeSteps;
        const edgeX = x - reflectionHalfWidthAt(perspective);
        const edgeY = horizonY + perspective * reflectionDepth;
        if (step === 0) ctx.moveTo(edgeX, edgeY);
        else ctx.lineTo(edgeX, edgeY);
      }
      for (let step = reflectionEnvelopeSteps; step >= 0; step -= 1) {
        const perspective = step / reflectionEnvelopeSteps;
        ctx.lineTo(
          x + reflectionHalfWidthAt(perspective),
          horizonY + perspective * reflectionDepth
        );
      }
      ctx.closePath();
    };
    // The ground tint and illuminated grid share one sun-path envelope: a
    // broad, hazy shoulder at the horizon that gathers into a short round tail.
    // That slow-then-steep taper reads more like low-angle light on a surface
    // than a geometric trapezoid or a pointed half-ellipse.
    const groundReflection = ctx.createLinearGradient(0, horizonY, 0, reflectionEndY);
    groundReflection.addColorStop(0, rgba('#ffd5a6', 0.16 + lineEnergy * 0.055 + impact * 0.035));
    groundReflection.addColorStop(0.2, rgba(theme.hot, 0.14 + lineEnergy * 0.055 + impact * 0.035));
    groundReflection.addColorStop(0.55, rgba('#ff4f9f', 0.075 + lineEnergy * 0.04 + impact * 0.025));
    groundReflection.addColorStop(0.82, rgba('#b83ad5', 0.02 + lineEnergy * 0.018));
    groundReflection.addColorStop(1, rgba(theme.accent, 0));
    ctx.globalAlpha = 1;
    ctx.filter = `blur(${(16 + lineEnergy * 6 + impact * 3).toFixed(2)}px)`;
    ctx.fillStyle = groundReflection;
    traceReflectionEnvelope();
    ctx.fill();
    ctx.filter = 'none';

    const longitudinalReflection = ctx.createLinearGradient(0, horizonY, 0, reflectionEndY);
    longitudinalReflection.addColorStop(0, rgba('#ffe0a8', 0.86 + lineEnergy * 0.08 + impact * 0.04));
    longitudinalReflection.addColorStop(0.2, rgba(theme.hot, 0.78 + lineEnergy * 0.12 + impact * 0.05));
    longitudinalReflection.addColorStop(0.58, rgba('#ff7895', 0.5 + lineEnergy * 0.16 + impact * 0.05));
    longitudinalReflection.addColorStop(0.84, rgba('#ff4fa4', 0.14 + lineEnergy * 0.09));
    longitudinalReflection.addColorStop(1, rgba(theme.accent, 0));
    const longitudinalSegments = 16;
    // Each rail is sampled in short pieces so its opacity can follow the
    // curved envelope. Flat caps keep adjacent samples from piling up into
    // bright beads under additive blending.
    ctx.lineCap = 'butt';
    lanes.forEach((lane) => {
      ctx.strokeStyle = longitudinalReflection;
      for (let segment = 0; segment < longitudinalSegments; segment += 1) {
        const startProgress = segment / longitudinalSegments;
        const endProgress = (segment + 1) / longitudinalSegments;
        const middleProgress = (startProgress + endProgress) * 0.5;
        const start = startProgress * reflectionDepthRatio;
        const end = endProgress * reflectionDepthRatio;
        const middle = middleProgress * reflectionDepthRatio;
        const middleX = lane.horizonX + (lane.endX - lane.horizonX) * middle;
        const distance = Math.abs(middleX - x) / Math.max(1, reflectionHalfWidthAt(middleProgress));
        const edgeFade = 1 - smoothstep(0.68, 1.08, distance);
        const reflection = Math.exp(-distance * distance * 1.35);
        if (edgeFade <= 0.01 || reflection < 0.025) continue;
        ctx.globalAlpha = edgeFade * reflection
          * (0.58 + lineEnergy * 0.28 + impact * 0.12);
        ctx.lineWidth = 0.92 + reflection * 1.12;
        ctx.beginPath();
        ctx.moveTo(
          lane.horizonX + (lane.endX - lane.horizonX) * start,
          horizonY + floorDepth * start
        );
        ctx.lineTo(
          lane.horizonX + (lane.endX - lane.horizonX) * end,
          horizonY + floorDepth * end
        );
        ctx.stroke();
      }
    });
    rows.forEach((row) => {
      const reflectionProgress = row.perspective / reflectionDepthRatio;
      if (reflectionProgress >= 1) return;
      const halfWidth = reflectionHalfWidthAt(reflectionProgress);
      const crossReflection = ctx.createLinearGradient(x - halfWidth, 0, x + halfWidth, 0);
      crossReflection.addColorStop(0, rgba(theme.accent, 0));
      crossReflection.addColorStop(0.2, rgba('#ff5ba8', 0.28));
      crossReflection.addColorStop(0.5, rgba('#ffd7a0', 0.84 + lineEnergy * 0.1));
      crossReflection.addColorStop(0.8, rgba('#ff5ba8', 0.28));
      crossReflection.addColorStop(1, rgba(theme.accent, 0));
      ctx.strokeStyle = crossReflection;
      ctx.lineWidth = 1.16;
      ctx.globalAlpha = (0.58 + lineEnergy * 0.28 + impact * 0.12)
        * (1 - smoothstep(0.78, 1, reflectionProgress));
      ctx.beginPath();
      ctx.moveTo(x - halfWidth, row.y);
      ctx.lineTo(x + halfWidth, row.y);
      ctx.stroke();
    });
    ctx.restore();

    // A dedicated luminous seam separates sky from floor. It is intentionally
    // drawn after the road and outside the cutout buffer, so scanning gaps can
    // neither interrupt the horizon nor erase any part of the ground.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const horizonGlow = ctx.createLinearGradient(0, horizonY - 42, 0, horizonY + 44);
    horizonGlow.addColorStop(0, rgba(theme.accent, 0));
    horizonGlow.addColorStop(0.2, rgba(theme.accent, 0.085 + lineEnergy * 0.055));
    horizonGlow.addColorStop(0.4, rgba(theme.accent, 0.25 + lineEnergy * 0.13 + impact * 0.07));
    horizonGlow.addColorStop(0.5, rgba('#ffe1ef', 0.52 + lineEnergy * 0.15 + impact * 0.09));
    horizonGlow.addColorStop(0.6, rgba(theme.accent2, 0.24 + lineEnergy * 0.12 + impact * 0.07));
    horizonGlow.addColorStop(0.8, rgba(theme.accent2, 0.085 + lineEnergy * 0.055));
    horizonGlow.addColorStop(1, rgba(theme.accent2, 0));
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(bounds.left, horizonY - 42, bounds.right - bounds.left, 86);
    ctx.shadowColor = rgba('#ff5fc9', 0.78);
    ctx.shadowBlur = 34 + lineEnergy * 14 + impact * 8;
    ctx.strokeStyle = rgba('#ff63ca', 0.18 + lineEnergy * 0.06 + impact * 0.03);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bounds.left, horizonY);
    ctx.lineTo(bounds.right, horizonY);
    ctx.stroke();
    ctx.shadowColor = rgba('#ff8bd7', 0.9);
    ctx.shadowBlur = 46 + lineEnergy * 20 + impact * 12;
    ctx.strokeStyle = rgba('#ff7fd1', 0.56 + lineEnergy * 0.14 + impact * 0.09);
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(bounds.left, horizonY);
    ctx.lineTo(bounds.right, horizonY);
    ctx.stroke();
    ctx.shadowBlur = 12 + lineEnergy * 6 + impact * 4;
    ctx.strokeStyle = rgba('#ffe5f3', 0.62 + lineEnergy * 0.14);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  drawSpectrumVolume(x, y, theme, metrics, time, options = {}) {
    const ctx = this.ctx;
    const pulse = metrics.rhythmPulse || 0;
    const contactStrength = metrics.rhythmNow
      ? clamp(metrics.rhythmStrength ?? metrics.impact ?? 0)
      : 0;
    const gravityCompression = options.gravityField
      ? metrics.volume * 1.7 + metrics.mid * 0.85
      : 0;
    // A confirmed hit briefly pulls the membrane inward. The decaying pulse
    // then releases it outward, creating a readable compression/launch pair.
    const baseRadius = (options.radius || 72)
      + pulse * (options.pulseRadius || 4.5)
      - contactStrength * (options.contactCompression || 3.2)
      - gravityCompression;
    const points = options.points || 120;
    // Geometry resolution and spectral resolution are intentionally separate:
    // a smooth circular path can still use fewer, wider frequency peaks.
    const profileBins = options.spectrumBins || Math.floor(points / 2) + 1;
    const profile = this.updateSpectrumProfile(metrics, profileBins);
    const pointOptions = {
      ...options,
      points,
      profile,
      radius: baseRadius,
      time,
      amplitude: (options.amplitude || 42) * (0.76 + metrics.volume * 0.52)
    };
    const outer = this.spectrumPoints(x, y, metrics, pointOptions);
    const innerRadiusFor = (point) => point.baseRadius - (options.thickness || 20)
      + (point.radius - point.baseRadius) * (options.innerFollow ?? 0.32)
      - point.spectrum * (options.innerResponse || 3);
    const inner = [...outer].reverse().map((point) => {
      const radius = innerRadiusFor(point);
      return {
        x: x + Math.cos(point.angle) * radius,
        y: y + Math.sin(point.angle) * radius,
        radius,
        angle: point.angle
      };
    });

    // Trance uses the sampled spectrum only as an invisible geometry field for
    // its vortex. The spiral, stardust and aperture now carry the full visual,
    // so drawing the usual circular membrane would create a competing wave.
    if (options.hidden) {
      this.lastSpectrum = { outer, baseRadius, options };
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = ['facet', 'block', 'steel'].includes(options.material) ? 'miter' : 'round';

    const material = options.material || 'membrane';
    const materialProfile = {
      razor: { fill: 0.64, edge: 1.3, blur: 11, ridges: [0.22, 0.7] },
      facet: { fill: 0.58, edge: 1.18, blur: 8, ridges: [0.18, 0.52, 0.84] },
      liquid: { fill: 0.94, edge: 0.96, blur: 18, ridges: [0.3, 0.72] },
      chrome: { fill: 0.9, edge: 1.16, blur: 17, ridges: [0.2, 0.66] },
      plush: { fill: 1.3, edge: 1.48, blur: 24, ridges: [0.16, 0.48, 0.8] },
      glitch: { fill: 0.63, edge: 1.22, blur: 10, ridges: [0.24, 0.76] },
      wire: { fill: 0.35, edge: 0.92, blur: 7, ridges: [0.5] },
      glass: { fill: 0.8, edge: 0.9, blur: 22, ridges: [0.24, 0.58] },
      bubble: { fill: 1.16, edge: 1.32, blur: 22, ridges: [0.18, 0.56, 0.84] },
      steel: { fill: 0.46, edge: 1.08, blur: 7, ridges: [0.2, 0.66] },
      bass: { fill: 0.86, edge: 1.45, blur: 17, ridges: [0.25, 0.62] },
      membrane: { fill: 0.82, edge: 1, blur: 16, ridges: [0.2, 0.48, 0.74] }
    }[material] || { fill: 0.82, edge: 1, blur: 16, ridges: [0.2, 0.48, 0.74] };

    if (!options.hideBandFill) {
      const shadowAlphaScale = options.shadowAlphaScale ?? 1;
      const shadowFill = ctx.createRadialGradient(x, y, baseRadius - (options.thickness || 20) - 6, x, y, baseRadius + (options.amplitude || 42) + 20);
      shadowFill.addColorStop(0, `rgba(2, 4, 10, ${Math.min(0.42, 0.2 * shadowAlphaScale)})`);
      shadowFill.addColorStop(0.66, `rgba(2, 4, 10, ${Math.min(0.24, 0.09 * shadowAlphaScale)})`);
      shadowFill.addColorStop(1, 'rgba(2, 4, 10, 0)');
      this.traceBand(outer, inner, options.smoothPath);
      ctx.fillStyle = shadowFill;
      ctx.fill('evenodd');
    }

    ctx.globalCompositeOperation = 'lighter';

    if ((options.outerBodyWidth || 0) > 0) {
      const bodyWidth = options.outerBodyWidth
        + metrics.bass * (options.outerBodyBassGain ?? 3)
        + pulse * (options.outerBodyPulseGain ?? 1.5);
      ctx.save();
      // A slightly lowered dark shoulder gives the waveform physical weight
      // without filling the whole annulus back into a circular membrane.
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(0, options.outerBodyShadowOffset ?? 1.5);
      ctx.strokeStyle = `rgba(2, 4, 8, ${(options.outerBodyShadowAlpha ?? 0.22).toFixed(3)})`;
      ctx.lineWidth = bodyWidth + (options.outerBodyShadowSpread ?? 5);
      ctx.shadowBlur = 0;
      this.tracePoints(outer, true, options.smoothPath);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bodyInk = ctx.createConicGradient(time * (options.outerBodyFlow ?? 0.00006), x, y);
      const bodyAlpha = options.outerBodyAlpha ?? 0.18;
      bodyInk.addColorStop(0, rgba(theme.hot, bodyAlpha * 0.82));
      bodyInk.addColorStop(0.3, rgba(theme.accent, bodyAlpha));
      bodyInk.addColorStop(0.62, rgba(theme.accent2, bodyAlpha * 0.78));
      bodyInk.addColorStop(0.84, rgba(theme.hot, bodyAlpha * 0.92));
      bodyInk.addColorStop(1, rgba(theme.hot, bodyAlpha * 0.82));
      ctx.strokeStyle = bodyInk;
      ctx.lineWidth = bodyWidth;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = options.outerBodyBlur ?? 15;
      this.tracePoints(outer, true, options.smoothPath);
      ctx.stroke();
      ctx.restore();
    }

    if (options.chroma && pulse > 0.15) {
      const split = (pulse - 0.1) * 3.2;
      for (const layer of [
        { dx: -split, dy: split * 0.28, color: theme.accent },
        { dx: split, dy: -split * 0.28, color: theme.accent2 }
      ]) {
        const shifted = outer.map((point) => ({ x: point.x + layer.dx, y: point.y + layer.dy }));
        this.strokeGlow(layer.color, 0.8 + pulse, 10, 0.06 + pulse * 0.18);
        this.tracePoints(shifted, true, options.smoothPath);
        ctx.stroke();
      }
    }

    if (!options.hideBandFill) {
      const fillAlphaScale = options.fillAlphaScale ?? 1;
      const fill = ctx.createRadialGradient(x, y, Math.max(8, baseRadius - (options.thickness || 20) - 3), x, y, baseRadius + (options.amplitude || 42) + 14);
      fill.addColorStop(0, rgba(theme.accent2, 0.035 * materialProfile.fill * fillAlphaScale));
      fill.addColorStop(0.42, rgba(theme.accent2, (0.12 + metrics.mid * 0.09) * materialProfile.fill * fillAlphaScale));
      fill.addColorStop(0.73, rgba(theme.accent, (0.28 + metrics.volume * 0.16) * materialProfile.fill * fillAlphaScale));
      fill.addColorStop(0.92, rgba(theme.hot, (0.075 + metrics.high * 0.05) * materialProfile.fill * fillAlphaScale));
      fill.addColorStop(1, rgba(theme.hot, 0.01));
      this.traceBand(outer, inner, options.smoothPath);
      ctx.fillStyle = fill;
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = materialProfile.blur + metrics.volume * 22;
      ctx.fill('evenodd');
    }

    // Internal ridges show the band as a volume instead of one flat outline.
    const ridgeDepths = options.ridgeDepths ?? materialProfile.ridges;
    for (const [ridgeIndex, depth] of ridgeDepths.entries()) {
      const ridge = outer.map((point) => {
        const innerRadius = innerRadiusFor(point);
        const radius = innerRadius + (point.radius - innerRadius) * depth;
        return { x: x + Math.cos(point.angle) * radius, y: y + Math.sin(point.angle) * radius };
      });
      this.strokeGlow(
        ridgeIndex === 1 ? theme.accent2 : theme.accent,
        0.55 + ridgeIndex * 0.12,
        7 + (options.ridgeBlurAdd || 0),
        (0.08 + metrics.volume * 0.08) * (options.ridgeAlphaScale ?? 1)
      );
      this.tracePoints(ridge, true, options.smoothPath);
      ctx.stroke();
    }

    this.strokeGlow(
      options.outerEdgeColor || theme.hot,
      (1.05 + metrics.high * 1.25 + pulse * 0.65) * materialProfile.edge * (options.edgeWidthScale ?? 1),
      materialProfile.blur + (options.edgeBlurAdd || 0),
      (0.46 + metrics.volume * 0.4) * (options.edgeAlphaScale ?? 1)
    );
    this.tracePoints(outer, true, options.smoothPath);
    ctx.stroke();

    if (!options.hideInnerEdge) {
      this.strokeGlow(theme.accent2, 0.75, 8, 0.22 + metrics.mid * 0.2);
      this.tracePoints([...inner].reverse(), true, options.smoothPath);
      ctx.stroke();
    }

    const echoes = Math.min(2, options.echoes ?? 1);
    for (let echo = 1; echo <= echoes; echo += 1) {
      const ghost = this.spectrumPoints(x, y, metrics, {
        ...pointOptions,
        radius: baseRadius + echo * (7 + (options.echoSpacing || 0)),
        amplitude: pointOptions.amplitude * (0.73 - echo * 0.1),
        waveAmplitude: (options.waveAmplitude || 9) * (0.68 - echo * 0.08),
        serration: (options.serration || 0) * (0.7 - echo * 0.1)
      });
      this.strokeGlow(echo % 2 ? theme.accent : theme.accent2, Math.max(0.45, 0.9 - echo * 0.14), 10, 0.095 - echo * 0.018 + metrics.volume * 0.07);
      this.tracePoints(ghost, true, options.smoothPath);
      ctx.stroke();
    }

    if (options.ribs) {
      const stride = options.ribStride || 4;
      for (let index = 0; index < outer.length; index += stride) {
        const point = outer[index];
        const innerRadius = innerRadiusFor(point) + 2;
        ctx.strokeStyle = rgba(index % (stride * 3) ? theme.accent : theme.accent2, 0.1 + point.spectrum * 0.24);
        ctx.lineWidth = 0.55 + point.spectrum * 0.8;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(point.angle) * innerRadius, y + Math.sin(point.angle) * innerRadius);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }

    if (options.nodes) {
      for (let index = 0; index < outer.length; index += 8) {
        const point = outer[index];
        if (point.spectrum < 0.2) continue;
        ctx.fillStyle = rgba(index % 16 ? theme.accent : theme.hot, 0.28 + point.spectrum * 0.42);
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 0.65 + point.spectrum * 1.35, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    this.lastSpectrum = { outer, baseRadius, options };
  }

  drawGenreVolume(x, y, theme, metrics, time) {
    if (theme.id === 'synthwave') {
      this.lastSpectrum = null;
      return;
    }
    if (theme.mode === 'bilibili') {
      this.lastSpectrum = null;
      return;
    }
    const mode = theme.mode || 'electronic';
    const base = {
      points: 128, spectrumBins: 48, radius: 68, amplitude: 49, thickness: 23, waveAmplitude: 12,
      echoes: 1, peakBoost: 0.78, spectralContrast: 0.62, contrastPower: 1.4,
      material: 'membrane'
    };
    let options = base;
    if (mode === 'asmr') {
      options = {
        ...base, points: 176, spectrumBins: 26, radius: 61, amplitude: 28, thickness: 38,
        waveAmplitude: 15, smoothBins: 6, waveSmooth: 21, smoothPath: true,
        radialSmooth: { window: 6, passes: 3, blend: 0.9 },
        broadWave: { amount: 2.2, lobes: 3, speed: 0.00018 },
        spectralContrast: 0.36, contrastPower: 1.08, lowWeight: 0.92, highWeight: 0.65,
        echoes: 2, echoSpacing: 3, peakBoost: 0.18, catEarDip: 0.04,
        contactCompression: 0.35, pulseRadius: 0.45,
        innerFollow: 0.84, material: 'glass'
      };
    }
    else if (mode === 'hardcore') {
      const happy = theme.id === 'happy-hardcore';
      const uk = theme.id === 'uk-hardcore';
      const gabber = theme.id === 'gabber';
      const frenchcore = theme.id === 'frenchcore';
      const industrial = theme.id === 'industrial-hardcore';
      const uptempo = theme.id === 'uptempo-hardcore';
      const puzzy = theme.id === 'puzzycore';
      const gentle = happy || uk;
      const spectrumBins = gentle ? 48
        : puzzy ? 68
          : uptempo ? 64
            : frenchcore ? 60
              : gabber ? 52
                : industrial ? 48 : 54;
      options = {
        ...base,
        points: gentle ? 144 : puzzy || uptempo || frenchcore ? 156 : industrial ? 132 : gabber ? 120 : 144,
        spectrumBins,
        radius: gentle ? 61 : industrial ? 65 : gabber ? 64 : 63,
        amplitude: gentle ? 69 : industrial ? 60 : gabber ? 64 : frenchcore ? 67 : 70,
        thickness: gentle ? 31 : industrial ? 25 : gabber ? 22 : frenchcore ? 19 : 17,
        waveAmplitude: gentle ? 16 : frenchcore ? 10 : industrial ? 4 : gabber ? 5 : 7,
        smoothBins: gentle ? 3 : frenchcore ? 2 : industrial ? 1 : 0,
        waveSmooth: gentle ? 0 : frenchcore ? 5 : 0,
        smoothPath: gentle || frenchcore,
        facets: gabber ? 12 : industrial ? 10 : 0,
        sectorBins: gabber ? 2 : industrial ? 3 : 0,
        step: gabber ? 0.055 : industrial ? 0.07 : 0,
        lobes: gentle ? 8 : frenchcore ? 12 : 0,
        lobeAmount: gentle ? 6 : frenchcore ? 3.8 : 0,
        fracture: industrial ? 6.2 : 0,
        spectralContrast: gentle ? 0.68 : frenchcore ? 0.76 : industrial ? 0.82 : 0.88,
        contrastPower: gentle ? 1.28 : frenchcore ? 1.46 : industrial ? 1.58 : 1.7,
        spike: gentle ? 0 : puzzy ? 8.2 : uptempo ? 7.2 : industrial ? 3.2 : gabber ? 3.8 : frenchcore ? 4.2 : 5,
        spikeThreshold: puzzy ? 0.34 : uptempo ? 0.35 : industrial ? 0.42 : gabber ? 0.4 : frenchcore ? 0.39 : 0.37,
        serration: gentle ? 0 : puzzy ? 3.8 : uptempo ? 4.2 : industrial ? 1.2 : gabber ? 1.6 : frenchcore ? 1.5 : 2.7,
        ribs: false, nodes: gentle, chroma: !gentle, echoes: gentle ? 1 : 0,
        peakBoost: gentle ? 0.6 : puzzy ? 1.32 : industrial ? 1.06 : gabber ? 1.14 : frenchcore ? 1.1 : 1.24,
        catEarDip: gentle ? 0.13 : industrial ? 0.28 : 0.36,
        lowWeight: gentle ? 1 : 1.15, highWeight: gentle ? 1 : 0.92,
        contactCompression: gentle ? 3.2 : puzzy ? 5.4 : industrial ? 4 : gabber ? 4.5 : frenchcore ? 4.3 : 4.9,
        pulseRadius: gentle ? 4.5 : puzzy ? 7.4 : industrial ? 5.2 : gabber ? 5.5 : frenchcore ? 5.6 : 6.3,
        innerFollow: gentle ? 0.72 : industrial ? 0.22 : gabber ? 0.2 : frenchcore ? 0.3 : 0.16,
        ridgeDepths: [], hideInnerEdge: true,
        material: gentle ? 'bubble' : industrial ? 'steel' : gabber ? 'facet' : 'razor'
      };
    }
    else if (mode === 'hardstyle') {
      const raw = theme.id === 'rawstyle';
      const euphoric = theme.id === 'euphoric-hardstyle';
      options = {
        ...base,
        points: raw ? 120 : euphoric ? 144 : 104,
        spectrumBins: raw ? 50 : euphoric ? 42 : 46,
        radius: 66,
        amplitude: raw ? 66 : euphoric ? 58 : 63,
        thickness: raw ? 20 : euphoric ? 30 : 23,
        waveAmplitude: raw ? 6 : euphoric ? 12 : 7,
        smoothBins: euphoric ? 3 : 0,
        waveSmooth: euphoric ? 10 : 0,
        smoothPath: euphoric,
        facets: raw ? 14 : euphoric ? 0 : 18,
        sectorBins: euphoric ? 0 : 2,
        step: raw ? 0.05 : euphoric ? 0 : 0.055,
        lobes: euphoric ? 6 : 0,
        lobeAmount: euphoric ? 4.6 : 0,
        fracture: raw ? 3.4 : 0,
        spike: raw ? 2.6 : 0,
        spikeThreshold: raw ? 0.4 : 0.42,
        serration: raw ? 4.2 : euphoric ? 0 : 0.9,
        ribs: false,
        chroma: !euphoric,
        echoes: euphoric ? 1 : 0,
        peakBoost: raw ? 1.18 : euphoric ? 0.72 : 1.05,
        catEarDip: raw ? 0.34 : euphoric ? 0.16 : 0.3,
        lowWeight: raw ? 1.18 : euphoric ? 1.04 : 1.14,
        spectralContrast: raw ? 0.9 : euphoric ? 0.64 : 0.84,
        contrastPower: raw ? 1.7 : euphoric ? 1.3 : 1.58,
        contactCompression: raw ? 4.2 : euphoric ? 2.8 : 3.5,
        pulseRadius: raw ? 5.8 : euphoric ? 4.2 : 4.8,
        innerFollow: raw ? 0.2 : euphoric ? 0.62 : 0.28,
        ridgeDepths: [], hideInnerEdge: true,
        material: euphoric ? 'bubble' : 'facet'
      };
    }
    else if (mode === 'latin') {
      options = {
        ...base,
        points: 168,
        spectrumBins: 46,
        radius: 66,
        amplitude: 55,
        thickness: 34,
        waveAmplitude: 13,
        smoothBins: 2,
        waveSmooth: 10,
        smoothPath: true,
        radialSmooth: { window: 2, passes: 1, blend: 0.58 },
        broadWave: { amount: 2.9, lobes: 3, speed: 0.00068 },
        spectralContrast: 0.79,
        contrastPower: 1.5,
        lowWeight: 1.08,
        highWeight: 1.02,
        ribs: true,
        ribStride: 7,
        nodes: false,
        echoes: 1,
        echoSpacing: 3.6,
        peakBoost: 0.72,
        catEarDip: 0.1,
        contactCompression: 1.15,
        pulseRadius: 5.5,
        innerFollow: 0.62,
        material: 'membrane'
      };
    }
    else if (mode === 'house') {
      const electroIds = ['electro-house', 'complextro', 'big-room-house', 'dutch-house', 'fidget-house', 'melbourne-bounce'];
      const electro = electroIds.includes(theme.id);
      const future = theme.id === 'future-house';
      const progressive = theme.id === 'progressive-house';
      const techHouse = theme.id === 'tech-house';
      const complex = theme.id === 'complextro';
      const bigRoom = theme.id === 'big-room-house';
      const deepHouse = theme.id === 'deep-house';
      const melodicHouse = theme.id === 'melodic-house';
      const tropicalHouse = theme.id === 'tropical-house';
      const afroHouse = theme.id === 'afro-house';
      const amapiano = theme.id === 'amapiano';
      const frenchHouse = theme.id === 'french-house';
      const discoHouse = theme.id === 'disco-house';
      const hardHouse = theme.id === 'hard-house';
      const acidHouse = theme.id === 'acid-house';
      const electroBins = complex ? 56
        : theme.id === 'electro-house' ? 48
          : ['fidget-house', 'melbourne-bounce'].includes(theme.id) ? 46
            : theme.id === 'dutch-house' ? 44 : 40;
      const smoothHouse = ['deep-house', 'tropical-house', 'melodic-house', 'afro-house'].includes(theme.id);
      const detailedHouse = ['tech-house', 'bass-house', 'future-house', 'acid-house', 'hard-house'].includes(theme.id);
      const bassHouse = theme.id === 'bass-house';
      const regularBins = smoothHouse ? 34
        : bassHouse ? 48
          : detailedHouse ? 44
          : ['french-house', 'disco-house', 'nu-disco', 'disco-funk'].includes(theme.id) ? 42
            : theme.id === 'progressive-house' ? 38 : 38;
      options = electro ? {
        ...base,
        points: bigRoom ? 136 : complex ? 132 : electroBins >= 46 ? 116 : 108,
        spectrumBins: bigRoom ? 30 : electroBins,
        radius: bigRoom ? 68 : 66,
        amplitude: complex ? 62 : bigRoom ? 52 : 53,
        thickness: complex ? 22 : bigRoom ? 35 : 27,
        waveAmplitude: complex ? 8 : bigRoom ? 9 : 12,
        smoothBins: complex ? 1 : bigRoom ? 3 : 2,
        waveSmooth: complex ? 3 : bigRoom ? 10 : 7,
        smoothPath: bigRoom || theme.id === 'melbourne-bounce',
        radialSmooth: bigRoom ? { window: 3, passes: 2, blend: 0.72 } : false,
        facets: 0,
        sectorBins: complex ? 2 : 0, step: complex ? 0.045 : 0,
        broadWave: bigRoom
          ? { amount: 3.1, lobes: 4, speed: 0.00042 }
          : theme.id === 'melbourne-bounce' ? { amount: 3.5, lobes: 4, speed: 0.00086 } : false,
        spectralContrast: complex ? 0.84 : bigRoom ? 0.68 : 0.76,
        contrastPower: complex ? 1.62 : bigRoom ? 1.38 : 1.48,
        lobes: bigRoom ? 4 : 0, lobeAmount: bigRoom ? 3.8 : 0,
        echoes: bigRoom ? 1 : 0, ribs: !bigRoom, ribStride: complex ? 3 : 5,
        nodes: complex || theme.id === 'melbourne-bounce',
        peakBoost: complex ? 0.92 : bigRoom ? 0.58 : 0.72,
        catEarDip: bigRoom ? 0.12 : 0.22,
        innerFollow: complex ? 0.3 : bigRoom ? 0.66 : 0.48,
        material: complex ? 'glitch' : 'membrane'
      } : techHouse ? {
        ...base,
        points: 144,
        spectrumBins: 40,
        radius: 68,
        amplitude: 49,
        thickness: 32,
        waveAmplitude: 11,
        smoothBins: 3,
        waveSmooth: 9,
        smoothPath: true,
        radialSmooth: { window: 3, passes: 2, blend: 0.76 },
        broadWave: { amount: 2.15, lobes: 4, speed: 0.00042 },
        spectralContrast: 0.74,
        contrastPower: 1.48,
        lobes: 4,
        lobeAmount: 2.15,
        echoes: 1,
        echoSpacing: 3.4,
        ribs: false,
        nodes: false,
        peakBoost: 0.66,
        catEarDip: 0.15,
        contactCompression: 1.35,
        pulseRadius: 5.2,
        innerFollow: 0.62,
        material: 'membrane'
      } : progressive ? {
        ...base,
        points: 164,
        spectrumBins: 36,
        radius: 67,
        amplitude: 51,
        thickness: 36,
        waveAmplitude: 14,
        smoothBins: 4,
        waveSmooth: 14,
        smoothPath: true,
        radialSmooth: { window: 4, passes: 2, blend: 0.84 },
        broadWave: { amount: 3.25, lobes: 3, speed: 0.0003 },
        spectralContrast: 0.7,
        contrastPower: 1.42,
        lobes: 0,
        lobeAmount: 0,
        echoes: 1,
        echoSpacing: 4.2,
        ribs: false,
        nodes: false,
        peakBoost: 0.62,
        catEarDip: 0.12,
        contactCompression: 0.8,
        pulseRadius: 5.8,
        innerFollow: 0.76,
        material: 'liquid'
      } : {
        ...base,
        points: future ? 144 : bassHouse ? 136 : discoHouse ? 144 : hardHouse ? 116 : amapiano ? 128 : smoothHouse ? 148 : 132,
        spectrumBins: amapiano ? 34 : hardHouse ? 46 : discoHouse ? 44 : regularBins,
        radius: future ? 68 : bassHouse ? 66 : amapiano ? 67 : hardHouse ? 65 : 69,
        amplitude: future ? 52
          : bassHouse ? 61
            : hardHouse ? 61
              : amapiano ? 57
                : afroHouse ? 51
                  : discoHouse ? 52
                    : frenchHouse ? 49
                      : acidHouse ? 54
                        : melodicHouse ? 48
                          : deepHouse ? 41 : 46,
        thickness: future ? 34 : bassHouse ? 37 : deepHouse ? 35 : melodicHouse ? 36 : amapiano ? 34 : hardHouse ? 25 : 31,
        waveAmplitude: future ? 12 : bassHouse ? 10 : deepHouse ? 11 : melodicHouse ? 14 : amapiano ? 9 : hardHouse ? 8 : 15,
        smoothBins: future ? 2 : bassHouse ? 1 : hardHouse || acidHouse ? 1 : amapiano ? 2 : smoothHouse ? 4 : 3,
        waveSmooth: future ? 11 : bassHouse ? 6 : hardHouse ? 4 : acidHouse ? 5 : amapiano ? 7 : smoothHouse ? 13 : 10,
        smoothPath: !hardHouse,
        radialSmooth: bassHouse
          ? { window: 2, passes: 2, blend: 0.6 }
          : hardHouse
            ? false
            : { window: smoothHouse ? 4 : amapiano ? 2 : 3, passes: 2, blend: future ? 0.78 : deepHouse ? 0.86 : melodicHouse ? 0.82 : smoothHouse ? 0.76 : 0.72 },
        sectorBins: hardHouse ? 3 : amapiano ? 4 : acidHouse ? 2 : 0,
        step: hardHouse ? 0.06 : amapiano ? 0.045 : acidHouse ? 0.04 : 0,
        facets: discoHouse ? 14 : hardHouse ? 12 : 0,
        serration: hardHouse ? 2.8 : acidHouse ? 1.15 : 0,
        broadWave: future
          ? { amount: 4.1, lobes: 4, speed: 0.00072 }
          : bassHouse
            ? { amount: 3.6, lobes: 4, speed: 0.00068 }
            : tropicalHouse
              ? { amount: 2.8, lobes: 4, speed: 0.00042 }
              : afroHouse
                ? { amount: 3.2, lobes: 5, speed: 0.00055 }
                : amapiano
                  ? { amount: 3.5, lobes: 3, speed: 0.00072 }
                  : melodicHouse
                    ? { amount: 3.3, lobes: 3, speed: 0.00032 }
                    : deepHouse
                      ? { amount: 2.5, lobes: 2, speed: 0.00024 }
                      : frenchHouse
                        ? { amount: 2.9, lobes: 2, speed: 0.00062 }
                        : { amount: 2.2, lobes: 2, speed: 0.0005 },
        spectralContrast: future ? 0.8 : bassHouse ? 0.86 : hardHouse ? 0.88 : amapiano ? 0.76 : tropicalHouse ? 0.66 : deepHouse ? 0.58 : 0.68,
        contrastPower: future ? 1.58 : bassHouse ? 1.62 : hardHouse ? 1.68 : amapiano ? 1.5 : tropicalHouse ? 1.38 : deepHouse ? 1.28 : 1.42,
        lobes: future || bassHouse ? 4 : tropicalHouse ? 4 : afroHouse ? 5 : amapiano ? 3 : melodicHouse ? 3 : discoHouse ? 8 : 0,
        lobeAmount: future ? 4.4 : bassHouse ? 3.1 : tropicalHouse ? 2.8 : afroHouse ? 3.4 : amapiano ? 3.8 : melodicHouse ? 3.2 : discoHouse ? 2.4 : 0,
        lobePhase: afroHouse ? 0.46 : amapiano ? 0.7 : 0,
        echoes: future || bassHouse || hardHouse || amapiano ? 1 : deepHouse ? 2 : 2,
        echoSpacing: future || bassHouse ? 4 : deepHouse ? 4.5 : 3,
        ribs: bassHouse || afroHouse || amapiano || hardHouse,
        ribStride: bassHouse ? 5 : afroHouse ? 8 : amapiano ? 6 : hardHouse ? 4 : 0,
        nodes: discoHouse,
        peakBoost: future ? 0.68 : bassHouse ? 0.84 : hardHouse ? 0.9 : amapiano ? 0.76 : discoHouse ? 0.66 : deepHouse ? 0.48 : 0.58,
        catEarDip: 0.16,
        contactCompression: future ? 2.7 : bassHouse ? 2.35 : hardHouse ? 2.2 : amapiano ? 1.8 : deepHouse ? 0.25 : 0,
        pulseRadius: future ? 7.2 : bassHouse ? 6.4 : hardHouse ? 6.5 : amapiano ? 5.8 : 4.5,
        lowWeight: bassHouse ? 1.22 : amapiano ? 1.3 : afroHouse ? 1.12 : deepHouse ? 1.08 : 1,
        highWeight: bassHouse ? 0.86 : amapiano ? 0.78 : hardHouse ? 0.92 : deepHouse ? 0.86 : 1,
        innerFollow: future ? 0.7 : bassHouse ? 0.46 : deepHouse ? 0.8 : melodicHouse ? 0.76 : amapiano ? 0.42 : hardHouse ? 0.34 : 0.64,
        material: future ? 'chrome'
          : bassHouse ? 'bass'
            : discoHouse ? 'chrome'
              : frenchHouse ? 'glass'
                : hardHouse ? 'facet'
                  : amapiano ? 'bass'
                    : deepHouse ? 'glass'
                      : melodicHouse ? 'plush' : 'liquid'
      };
    }
    else if (mode === 'future-bass' || mode === 'kawaii-bass') {
      const kawaii = mode === 'kawaii-bass';
      options = kawaii ? {
        ...base, points: 184, spectrumBins: 36, radius: 62, amplitude: 60, thickness: 42, waveAmplitude: 16,
        smoothBins: 3, waveSmooth: 15, smoothPath: true,
        radialSmooth: { window: 3, passes: 2, blend: 0.8 },
        broadWave: { amount: 2.2, lobes: 4, speed: 0.00078 },
        spectralContrast: 0.72, contrastPower: 1.34, lobes: 0, lobeAmount: 0,
        echoes: 1, echoSpacing: 4, nodes: false, wobble: 0.75, wobbleRate: 2,
        ridgeDepths: [0.28, 0.7],
        peakBoost: 0.36, catEarDip: 0.16, seamWidth: 0.2,
        catEarFromLow: true, catEarLowMinRatio: 0.07, catEarLowMaxRatio: 0.27,
        catEarMinAngle: 0.6, catEarMaxAngle: 0.84, catEarAngleOffset: 0.08,
        catEarWidth: 0.235, catEarTriangle: true, catEarCenterOnTopGap: true,
        catEarRootBridge: 0.06, catEarRootBlend: 0.72,
        catEarLowGain: 0.5, catEarLowFloor: 0.39, catEarLowCeiling: 0.7,
        catEarBaseSmoothBins: 6, catEarLowSmoothing: 0.84, catEarWaveSuppression: 0.78,
        catEarNotch: 0, catEarNotchWidth: 0.15, catEarGatePower: 1.22,
        lowWeight: 0.9, highWeight: 0.82,
        contactCompression: 1.7, pulseRadius: 6.8,
        innerFollow: 0.8, material: 'plush'
      } : {
        ...base, points: 168, spectrumBins: 56, radius: 61, amplitude: 74, thickness: 39, waveAmplitude: 17,
        smoothBins: 2, waveSmooth: 11, smoothPath: true,
        radialSmooth: { window: 2, passes: 2, blend: 0.68 },
        broadWave: { amount: 4.2, lobes: 6, speed: 0.00105 },
        spectralContrast: 0.88, contrastPower: 1.5, lobes: 7, lobeAmount: 5.2,
        echoes: 1, echoSpacing: 4, nodes: false, wobble: 2.2, wobbleRate: 2,
        ridgeDepths: [0.3, 0.68],
        peakBoost: 0.5, catEarDip: 0.12,
        contactCompression: 2.45, pulseRadius: 8.6,
        innerFollow: 0.76, material: 'plush'
      };
    }
    else if (mode === 'dubstep') {
      const umbrellaBass = theme.id === 'bass-music';
      const classicDubstep = theme.id === 'dubstep';
      const brostep = theme.id === 'brostep';
      const deathstep = theme.id === 'deathstep';
      const riddim = theme.id === 'riddim';
      const futureRiddim = theme.id === 'future-riddim';
      const colourBass = theme.id === 'colour-bass';
      const melodicDubstep = theme.id === 'melodic-dubstep';
      const moombahcore = theme.id === 'moombahcore';
      const smoothBass = melodicDubstep || colourBass || futureRiddim;
      options = {
        ...base,
        points: umbrellaBass ? 148
          : colourBass ? 176
            : melodicDubstep ? 168
              : futureRiddim ? 144
                : moombahcore ? 132
                  : riddim ? 112
                    : deathstep ? 108 : 120,
        spectrumBins: umbrellaBass ? 42
          : colourBass ? 60
            : melodicDubstep ? 48
              : futureRiddim ? 46
                : riddim ? 34
                  : deathstep ? 58 : 52,
        radius: smoothBass ? 64 : 62,
        amplitude: umbrellaBass ? 66 : melodicDubstep ? 68 : colourBass ? 72 : futureRiddim ? 72 : deathstep ? 74 : 69,
        thickness: umbrellaBass ? 38
          : melodicDubstep ? 39
            : colourBass ? 34
              : futureRiddim ? 31
                : deathstep ? 21 : 24,
        waveAmplitude: umbrellaBass ? 11 : melodicDubstep ? 14 : colourBass ? 17 : futureRiddim ? 12 : 9,
        smoothBins: umbrellaBass ? 2 : melodicDubstep ? 4 : colourBass ? 2 : futureRiddim ? 2 : 0,
        waveSmooth: umbrellaBass ? 9 : melodicDubstep ? 13 : colourBass ? 9 : futureRiddim ? 7 : 0,
        smoothPath: umbrellaBass || smoothBass,
        radialSmooth: umbrellaBass
          ? { window: 2, passes: 2, blend: 0.64 }
          : melodicDubstep
            ? { window: 3, passes: 2, blend: 0.78 }
            : colourBass
              ? { window: 2, passes: 2, blend: 0.62 }
              : futureRiddim
                ? { window: 1, passes: 1, blend: 0.38 }
                : false,
        sectorBins: umbrellaBass || melodicDubstep || colourBass ? 0 : riddim ? 7 : futureRiddim ? 5 : deathstep ? 2 : 3,
        step: umbrellaBass || melodicDubstep || colourBass ? 0 : riddim ? 0.1 : futureRiddim ? 0.065 : deathstep ? 0.04 : 0.052,
        facets: riddim ? 16 : futureRiddim ? 12 : deathstep ? 18 : 0,
        fracture: deathstep ? 8.8 : brostep ? 3.8 : 0,
        serration: deathstep ? 5.4 : brostep ? 3.4 : classicDubstep ? 1.2 : 0,
        wobble: umbrellaBass ? 3.4
          : colourBass ? 1.2
            : melodicDubstep ? 0.75
              : futureRiddim ? 2.5
                : riddim ? 2.1
                  : brostep ? 7.8
                    : deathstep ? 4.8
                      : moombahcore ? 4.2 : 5.8,
        wobbleRate: umbrellaBass ? 3 : riddim ? 4 : futureRiddim ? 4 : moombahcore ? 3 : 3,
        broadWave: umbrellaBass
          ? { amount: 3.4, lobes: 5, speed: 0.00064 }
          : colourBass
            ? { amount: 3.4, lobes: 9, speed: 0.00094 }
            : melodicDubstep
              ? { amount: 3, lobes: 5, speed: 0.00048 }
              : futureRiddim
                ? { amount: 2.4, lobes: 4, speed: 0.00058 }
                : moombahcore
                  ? { amount: 3.6, lobes: 3, speed: 0.00082 }
                  : false,
        lobes: colourBass ? 9 : melodicDubstep ? 5 : futureRiddim ? 4 : moombahcore ? 3 : 0,
        lobeAmount: colourBass ? 7.4 : melodicDubstep ? 5.6 : futureRiddim ? 3.2 : moombahcore ? 2.8 : 0,
        lobePhase: moombahcore ? 0.55 : 0,
        chroma: brostep || deathstep || colourBass,
        ribs: !melodicDubstep && !colourBass,
        ribStride: umbrellaBass ? 5 : riddim ? 7 : futureRiddim ? 6 : moombahcore ? 6 : 4,
        peakBoost: umbrellaBass ? 0.72
          : melodicDubstep ? 0.52
            : colourBass ? 0.66
              : riddim ? 0.88
                : futureRiddim ? 0.72
                  : deathstep ? 1.18 : 1.08,
        spectralContrast: umbrellaBass ? 0.78
          : melodicDubstep ? 0.72
            : colourBass ? 0.86
              : riddim ? 0.82
                : futureRiddim ? 0.8
                  : deathstep ? 0.94 : 0.88,
        contrastPower: umbrellaBass ? 1.48
          : melodicDubstep ? 1.36
            : colourBass ? 1.54
              : riddim ? 1.46
                : futureRiddim ? 1.5
                  : deathstep ? 1.82 : 1.68,
        catEarDip: umbrellaBass ? 0.15 : smoothBass ? 0.12 : deathstep ? 0.34 : 0.28,
        lowWeight: umbrellaBass ? 1.24 : melodicDubstep ? 1.02 : colourBass ? 1.03 : riddim ? 1.2 : 1.12,
        highWeight: umbrellaBass ? 0.84 : melodicDubstep ? 0.94 : colourBass ? 1.08 : deathstep ? 1.02 : 0.9,
        innerFollow: umbrellaBass ? 0.62
          : melodicDubstep ? 0.76
            : colourBass ? 0.69
              : futureRiddim ? 0.58
                : riddim ? 0.22
                  : deathstep ? 0.18 : 0.31,
        material: umbrellaBass ? 'bass'
          : melodicDubstep ? 'plush'
            : colourBass ? 'glass'
              : futureRiddim ? 'bubble'
                : riddim ? 'facet'
                  : deathstep ? 'razor'
                    : brostep ? 'glitch'
                      : moombahcore ? 'bass' : 'steel'
      };
    }
    else if (mode === 'trap') {
      const edmTrap = ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(theme.id);
      options = {
        ...base,
        points: theme.id === 'glitch-hop' ? 120 : theme.id === 'midtempo-bass' ? 112 : edmTrap ? 116 : 104,
        spectrumBins: theme.id === 'glitch-hop' ? 52
          : theme.id === 'midtempo-bass' ? 48
            : ['hybrid-trap', 'hard-trap', 'festival-trap'].includes(theme.id) ? 48 : edmTrap ? 46 : 44,
        radius: edmTrap ? 61 : 64,
        amplitude: edmTrap ? 69 : 72,
        thickness: edmTrap ? 31 : 27,
        waveAmplitude: edmTrap ? 9 : 8,
        smoothBins: 1,
        waveSmooth: edmTrap ? 5 : 7,
        lowWeight: edmTrap ? 1.38 : 1.34,
        highWeight: edmTrap ? 0.82 : 0.68,
        midBoost: edmTrap ? 0.02 : 0.04,
        sectorBins: theme.id === 'glitch-hop' ? 2 : edmTrap ? 4 : 3,
        step: edmTrap ? 0.062 : 0.055,
        facets: theme.id === 'festival-trap' || theme.id === 'hard-trap' ? 14 : 0,
        wobble: theme.id === 'midtempo-bass' ? 5 : edmTrap ? 1.25 : 1.8,
        wobbleRate: 3,
        broadWave: edmTrap ? { amount: 1.6, lobes: 2, speed: 0.00042 } : false,
        spectralContrast: edmTrap ? 0.88 : 0.88,
        contrastPower: edmTrap ? 1.68 : 1.66,
        ribs: true,
        ribStride: edmTrap ? 5 : 4,
        chroma: ['hybrid-trap', 'hard-trap', 'midtempo-bass'].includes(theme.id),
        peakBoost: edmTrap ? 0.96 : 1.02,
        catEarDip: edmTrap ? 0.28 : 0.42,
        seamWidth: edmTrap ? 0.12 : 0.16,
        innerFollow: edmTrap ? 0.3 : 0.34,
        material: theme.id === 'midtempo-bass' ? 'glitch' : 'bass'
      };
    }
    else if (mode === 'garage') {
      const futureGarage = theme.id === 'future-garage';
      const twoStepGarage = theme.id === 'two-step-garage';
      const speedGarage = theme.id === 'speed-garage';
      const basslineGarage = theme.id === 'bassline';
      const heavyGarage = speedGarage || basslineGarage;
      options = {
        ...base,
        points: futureGarage ? 160 : twoStepGarage ? 152 : heavyGarage ? 148 : 156,
        spectrumBins: futureGarage ? 34 : twoStepGarage ? 42 : speedGarage ? 50 : basslineGarage ? 44 : 46,
        radius: 67,
        amplitude: futureGarage ? 50 : basslineGarage ? 59 : speedGarage ? 57 : 54,
        thickness: futureGarage ? 32 : basslineGarage ? 31 : speedGarage ? 24 : 28,
        waveAmplitude: futureGarage ? 12 : heavyGarage ? 12 : 14,
        smoothBins: futureGarage ? 5 : twoStepGarage ? 3 : heavyGarage ? 2 : 3,
        waveSmooth: futureGarage ? 13 : twoStepGarage ? 10 : speedGarage ? 7 : 9,
        smoothPath: !speedGarage,
        radialSmooth: futureGarage
          ? { window: 3, passes: 2, blend: 0.82 }
          : twoStepGarage
            ? { window: 2, passes: 1, blend: 0.54 }
            : { window: 2, passes: 1, blend: heavyGarage ? 0.36 : 0.46 },
        broadWave: futureGarage
          ? { amount: 3.1, lobes: 3, speed: 0.00034 }
          : { amount: basslineGarage ? 3.4 : 2.45, lobes: 2, speed: heavyGarage ? 0.00082 : 0.00062 },
        sectorBins: 0,
        spectralContrast: futureGarage ? 0.56 : basslineGarage ? 0.82 : speedGarage ? 0.84 : 0.76,
        contrastPower: futureGarage ? 1.28 : heavyGarage ? 1.58 : 1.46,
        lowWeight: basslineGarage ? 1.42 : speedGarage ? 1.28 : futureGarage ? 1.05 : 1.2,
        midBoost: twoStepGarage ? 0.12 : futureGarage ? 0.08 : 0.06,
        highWeight: futureGarage ? 0.88 : twoStepGarage ? 1.04 : heavyGarage ? 0.92 : 1,
        // The side-to-side shuffle belt is the family signature. Dense radial
        // ribs made the still silhouette read as a generic shield, so only the
        // four-floor branches retain a few drive braces.
        ribs: heavyGarage,
        ribStride: basslineGarage ? 11 : 9,
        ridgeDepths: futureGarage
          ? [0.52]
          : twoStepGarage
            ? [0.32, 0.7]
            : basslineGarage ? [0.2, 0.62] : speedGarage ? [0.28, 0.68] : [0.34, 0.7],
        ridgeAlphaScale: futureGarage ? 0.48 : twoStepGarage ? 0.68 : heavyGarage ? 0.8 : 0.7,
        fillAlphaScale: futureGarage ? 0.62 : twoStepGarage ? 0.76 : basslineGarage ? 0.94 : 0.84,
        edgeWidthScale: futureGarage ? 0.78 : basslineGarage ? 1.15 : speedGarage ? 1.06 : 0.94,
        nodes: false,
        // UKG's identity comes from the sideways shuffled belt below. Extra
        // concentric echoes made it read like Hip-Hop/Phonk with new colors.
        echoes: futureGarage ? 1 : 0,
        peakBoost: futureGarage ? 0.5 : basslineGarage ? 0.82 : speedGarage ? 0.88 : 0.7,
        catEarDip: futureGarage ? 0.08 : 0.12,
        innerFollow: futureGarage ? 0.72 : basslineGarage ? 0.56 : 0.62,
        material: futureGarage ? 'glass' : basslineGarage ? 'bass' : 'membrane'
      };
    }
    else if (mode === 'breakbeat') options = {
      ...base, points: theme.id === 'electro-swing' ? 136 : 148,
      spectrumBins: theme.id === 'electro-swing' ? 46 : theme.id === 'big-beat' ? 52 : 54,
      radius: 67, amplitude: 57, thickness: 16, waveAmplitude: 10,
      smoothBins: theme.id === 'electro-swing' ? 2 : 0,
      sectorBins: theme.id === 'big-beat' ? 3 : 2, step: 0.045,
      fracture: theme.id === 'big-beat' ? 6 : 3.8, serration: theme.id === 'big-beat' ? 2.8 : 1.4,
      spectralContrast: 0.79, contrastPower: 1.54, highWeight: 1.08, midBoost: 0.1,
      ribs: true, ribStride: theme.id === 'big-beat' ? 3 : 5,
      chroma: theme.id === 'electro-swing', nodes: theme.id === 'electro-swing',
      echoes: 0, peakBoost: 0.92, catEarDip: 0.25,
      innerFollow: 0.22, material: theme.id === 'big-beat' ? 'steel' : 'wire'
    };
    else if (mode === 'drum-bass') {
      const liquid = theme.id === 'liquid-dnb';
      const drumstep = theme.id === 'drumstep';
      const neuro = theme.id === 'neurofunk';
      const dancefloor = theme.id === 'dancefloor-dnb';
      const jumpUp = theme.id === 'jump-up-dnb';
      const jungle = theme.id === 'jungle';
      const hyperDetailed = ['neurofunk', 'jump-up-dnb', 'jungle', 'drumstep'].includes(theme.id);
      options = drumstep ? {
      ...base,
      // Drumstep keeps DnB's travelling field, but its physical waveform is
      // deliberately cut from the same heavy, quantised language as Dubstep.
      // Fewer points and a stepped low-weighted spectrum create broad bass
      // blocks instead of the evenly radiating DnB wire aperture.
      points: 126,
      spectrumBins: 52,
      radius: 55,
      amplitude: 34,
      thickness: 20,
      waveAmplitude: 7,
      smoothBins: 0,
      waveSmooth: 2,
      smoothPath: false,
      radialSmooth: false,
      sectorBins: 2,
      step: 0.045,
      wobble: 3.8,
      wobbleRate: 3,
      spectralContrast: 0.87,
      contrastPower: 1.64,
      highWeight: 0.96,
      lowWeight: 1.23,
      midBoost: 0.07,
      ribs: true,
      ribStride: 4,
      nodes: false,
      echoes: 1,
      echoSpacing: 4.4,
      peakBoost: 0.82,
      catEarDip: 0.18,
      innerFollow: 0.44,
      contactCompression: 2.18,
      pulseRadius: 2.4,
      material: 'glitch'
      } : {
      ...base,
      points: liquid ? 168 : neuro ? 184 : jungle ? 196 : jumpUp ? 152 : dancefloor ? 172 : hyperDetailed ? 176 : 164,
      spectrumBins: liquid ? 44 : neuro ? 60 : jungle ? 64 : jumpUp ? 46 : dancefloor ? 52 : hyperDetailed ? 58 : 50,
      // Neurofunk uses the same compact vanishing aperture as its DnB and
      // Drumstep relatives, leaving more room for the biomechanical tunnel.
      radius: liquid ? 61 : neuro ? 53 : jumpUp ? 57 : jungle ? 54 : 55,
      amplitude: liquid ? 44 : neuro ? 36 : jumpUp ? 43 : jungle ? 38 : dancefloor ? 40 : 39,
      thickness: liquid ? 25 : neuro ? 17.5 : jungle ? 15.5 : jumpUp ? 19 : dancefloor ? 22 : 20,
      waveAmplitude: liquid ? 11 : neuro ? 3 : jungle ? 2.5 : jumpUp ? 4.5 : dancefloor ? 5 : 4,
      smoothBins: liquid ? 4 : neuro ? 1 : jungle ? 0 : jumpUp ? 1 : 2,
      waveSmooth: liquid ? 14 : neuro ? 4 : jungle ? 2 : jumpUp ? 4 : dancefloor ? 9 : 7,
      smoothPath: !jungle,
      radialSmooth: liquid
        ? { window: 4, passes: 2, blend: 0.82 }
        : neuro ? { window: 1, passes: 1, blend: 0.42 }
          : jungle ? false
            : jumpUp ? { window: 1, passes: 1, blend: 0.48 }
              : dancefloor ? { window: 3, passes: 2, blend: 0.72 }
                : { window: 2, passes: 2, blend: 0.64 },
      sectorBins: jungle ? 1 : jumpUp ? 3 : dancefloor ? 4 : 2,
      step: jungle ? 0.026 : jumpUp ? 0.052 : dancefloor ? 0.02 : 0,
      spectralContrast: liquid ? 0.66 : neuro ? 0.83 : jungle ? 0.88 : jumpUp ? 0.8 : dancefloor ? 0.7 : 0.72,
      contrastPower: liquid ? 1.34 : neuro ? 1.62 : jungle ? 1.72 : jumpUp ? 1.58 : dancefloor ? 1.38 : 1.42,
      lowWeight: liquid ? 1.02 : neuro ? 1.18 : jumpUp ? 1.38 : jungle ? 1.08 : 1.12,
      highWeight: liquid ? 1.02 : neuro ? 1.24 : jungle ? 1.38 : jumpUp ? 0.98 : dancefloor ? 1.17 : 1.2,
      midBoost: liquid ? 0.07 : neuro ? 0.16 : jungle ? 0.12 : jumpUp ? 0.08 : dancefloor ? 0.13 : 0.1,
      ribs: jungle,
      ribStride: jungle ? 3 : 6,
      nodes: false, echoes: liquid ? 2 : 1, echoSpacing: liquid ? 4 : neuro ? 4.2 : jungle ? 3.5 : 5,
      peakBoost: liquid ? 0.68 : neuro ? 0.9 : jungle ? 0.96 : jumpUp ? 0.88 : dancefloor ? 0.82 : 0.76,
      catEarDip: liquid ? 0.06 : neuro ? 0.04 : 0.08,
      innerFollow: liquid ? 0.72 : neuro ? 0.5 : jungle ? 0.42 : jumpUp ? 0.48 : dancefloor ? 0.7 : 0.68,
      contactCompression: liquid ? 0.7 : neuro ? 2.15 : jungle ? 2.35 : jumpUp ? 2.05 : dancefloor ? 1.45 : 1.8,
      pulseRadius: liquid ? 0.35 : neuro ? -2.8 : jungle ? -3.1 : jumpUp ? -2.3 : dancefloor ? -1.4 : -2.2,
      material: liquid ? 'glass' : dancefloor ? 'chrome' : jumpUp ? 'bass' : jungle ? 'glitch' : 'wire'
      };
    }
    else if (mode === 'techno') {
      const hardTechno = theme.id === 'hard-techno';
      const industrialTechno = theme.id === 'industrial-techno';
      const acidTechno = theme.id === 'acid-techno';
      const melodicTechno = theme.id === 'melodic-techno';
      const minimalTechno = theme.id === 'minimal-techno';
      options = {
      ...base,
      points: industrialTechno ? 116 : acidTechno ? 132 : melodicTechno ? 144 : hardTechno ? 104 : minimalTechno ? 80 : 88,
      spectrumBins: industrialTechno ? 52 : acidTechno ? 48 : hardTechno ? 44 : melodicTechno ? 42 : minimalTechno ? 28 : 36,
      radius: 70,
      amplitude: industrialTechno ? 55 : hardTechno ? 53 : acidTechno ? 48 : melodicTechno ? 43 : minimalTechno ? 38 : 48,
      thickness: industrialTechno ? 15 : hardTechno ? 18 : acidTechno ? 19 : melodicTechno ? 30 : minimalTechno ? 20 : 21,
      waveAmplitude: acidTechno ? 13 : melodicTechno ? 12 : minimalTechno ? 3.5 : industrialTechno ? 3 : 5,
      smoothBins: melodicTechno ? 4 : acidTechno ? 2 : minimalTechno ? 5 : industrialTechno ? 0 : hardTechno ? 0 : 1,
      waveSmooth: melodicTechno ? 15 : acidTechno ? 9 : minimalTechno ? 12 : industrialTechno ? 3 : hardTechno ? 5 : 7,
      smoothPath: !industrialTechno,
      radialSmooth: melodicTechno
        ? { window: 4, passes: 2, blend: 0.82 }
        : acidTechno ? { window: 2, passes: 2, blend: 0.62 }
          : minimalTechno ? { window: 5, passes: 2, blend: 0.86 }
            : industrialTechno ? false
              : { window: 1, passes: 1, blend: 0.45 },
      facets: industrialTechno ? 36 : hardTechno ? 28 : minimalTechno ? 12 : acidTechno || melodicTechno ? 0 : 24,
      sectorBins: industrialTechno ? 2 : hardTechno ? 3 : acidTechno ? 2 : melodicTechno ? 6 : minimalTechno ? 8 : 4,
      step: industrialTechno ? 0.09 : hardTechno ? 0.065 : minimalTechno ? 0.035 : acidTechno || melodicTechno ? 0 : 0.08,
      ribs: industrialTechno || hardTechno || (!acidTechno && !melodicTechno && !minimalTechno),
      ribStride: industrialTechno ? 2 : hardTechno ? 2 : 3,
      spectralContrast: industrialTechno ? 0.9 : hardTechno ? 0.82 : acidTechno ? 0.76 : melodicTechno ? 0.58 : minimalTechno ? 0.5 : 0.74,
      contrastPower: industrialTechno ? 1.82 : hardTechno ? 1.7 : acidTechno ? 1.48 : melodicTechno ? 1.28 : minimalTechno ? 1.24 : 1.62,
      echoes: melodicTechno ? 2 : acidTechno ? 2 : minimalTechno ? 0 : 1,
      echoSpacing: melodicTechno ? 5.5 : acidTechno ? 3.8 : 5,
      peakBoost: industrialTechno ? 0.82 : hardTechno ? 0.72 : acidTechno ? 0.66 : melodicTechno ? 0.46 : minimalTechno ? 0.38 : 0.55,
      catEarDip: minimalTechno ? 0.12 : 0.22,
      innerFollow: melodicTechno ? 0.64 : acidTechno ? 0.5 : minimalTechno ? 0.48 : industrialTechno ? 0.18 : hardTechno ? 0.24 : 0.3,
      material: industrialTechno ? 'glitch' : acidTechno ? 'liquid' : melodicTechno ? 'glass' : 'wire'
      };
    }
    else if (mode === 'trance') {
      const classicalFamily = theme.family === 'classical';
      const orchestral = classicalFamily || theme.id === 'soundtrack';
      const synthwave = theme.id === 'synthwave';
      const drivingTrance = ['psytrance', 'tech-trance', 'hard-trance'].includes(theme.id);
      const vortexDirection = 1;
      const spectrumBins = theme.id === 'baroque' ? 38
        : theme.id === 'romantic-classical' ? 30
          : theme.id === 'opera' ? 32
            : theme.id === 'modern-classical' ? 42
              : theme.id === 'classical' ? 28
        : theme.id === 'soundtrack' ? 34
          : synthwave ? 32
          : drivingTrance ? 42
            : theme.id === 'uplifting-trance' ? 38
              : theme.id === 'progressive-trance' ? 34 : 38;
      options = {
      ...base, points: orchestral ? 152 : synthwave ? 160 : 172, spectrumBins,
      radius: orchestral ? 70 : synthwave ? 68 : 68, amplitude: orchestral ? 43 : synthwave ? 37 : drivingTrance ? 48 : 45,
      thickness: orchestral ? 38 : synthwave ? 33 : 29, waveAmplitude: orchestral ? 23 : synthwave ? 10 : 15,
      smoothBins: orchestral ? 5 : synthwave ? 5 : drivingTrance ? 3 : 5,
      waveSmooth: orchestral ? 20 : synthwave ? 18 : drivingTrance ? 13 : 18, smoothPath: true,
      radialSmooth: { window: orchestral ? 5 : synthwave ? 5 : drivingTrance ? 4 : 5, passes: 2, blend: orchestral ? 0.84 : synthwave ? 0.84 : drivingTrance ? 0.76 : 0.84 },
      broadWave: theme.id === 'uplifting-trance'
        ? { amount: 2.5, lobes: 5, speed: 0.00042 }
        : theme.id === 'synthwave'
          ? { amount: 2.2, lobes: 4, speed: 0.00022 }
          : { amount: drivingTrance ? 2.55 : 1.65, lobes: drivingTrance ? 5 : 4, speed: 0.00038 },
      lobes: theme.id === 'uplifting-trance' ? 6 : 0,
      lobeAmount: theme.id === 'uplifting-trance' ? 2.8 : 0,
      rotation: orchestral || synthwave ? 0 : vortexDirection * this.tranceFlowPhase * 0.035,
      wavePhase: orchestral || synthwave ? 0 : vortexDirection * this.tranceFlowPhase * 0.18,
      spiralTwist: 0,
      vortexEdge: null,
      spectralContrast: orchestral ? 0.48
        : theme.id === 'uplifting-trance' ? 0.74
          : theme.id === 'synthwave' ? 0.76
            : drivingTrance ? 0.72 : theme.id === 'progressive-trance' ? 0.68 : 0.62,
      contrastPower: orchestral ? 1.18
        : theme.id === 'uplifting-trance' ? 1.46
          : theme.id === 'synthwave' ? 1.5
            : drivingTrance ? 1.46 : theme.id === 'progressive-trance' ? 1.4 : 1.34,
      echoes: classicalFamily ? 0 : orchestral ? 2 : synthwave ? 1 : 0, echoSpacing: 5, nodes: false, peakBoost: orchestral ? 0.48 : synthwave ? 0.52 : 0.34,
      ridgeDepths: classicalFamily ? [0.5] : orchestral ? [0.24, 0.58] : [0.3, 0.66],
      ridgeAlphaScale: orchestral ? 1 : synthwave ? 0.88 : 0.34,
      ridgeBlurAdd: orchestral ? 0 : synthwave ? 1 : 9,
      hideInnerEdge: classicalFamily || (!orchestral && !synthwave),
      fillAlphaScale: orchestral ? 1 : synthwave ? 1.4 : 1.12,
      shadowAlphaScale: synthwave ? 1.55 : 1,
      edgeAlphaScale: orchestral ? 1 : synthwave ? 0.96 : 0.38,
      edgeWidthScale: orchestral ? 1 : synthwave ? 1 : 0.74,
      edgeBlurAdd: orchestral ? 0 : synthwave ? 2 : 12,
      outerEdgeColor: orchestral ? theme.hot : synthwave ? theme.accent2 : theme.accent,
      hidden: !orchestral && !synthwave,
      gravityField: !orchestral && !synthwave,
      contactCompression: orchestral ? 3.2 : synthwave ? 1.1 : 2.4,
      pulseRadius: orchestral ? 4.5 : synthwave ? 2 : 2.8,
      catEarDip: 0.1, innerFollow: synthwave ? 0.5 : 0.72, material: 'glass'
      };
    }
    else if (mode === 'pop' || mode === 'j-pop') {
      const kPop = theme.id === 'k-pop';
      const cityPop = theme.id === 'city-pop';
      const anime = theme.id === 'anime';
      const vocaloid = theme.id === 'vocaloid';
      const jPopBins = theme.id === 'city-pop' ? 28
        : theme.id === 'vocaloid' ? 44
          : theme.id === 'anime' ? 40 : 36;
      const popBins = kPop ? 48 : theme.id === 'dance-pop' ? 38
        : theme.id === 'indie-pop' ? 28 : 30;
      const smoothPop = cityPop || theme.id === 'indie-pop';
      const popLobes = vocaloid ? 9
        : anime ? 7
          : cityPop ? 4
            : mode === 'j-pop' ? 6 : theme.id === 'dance-pop' || theme.id === 'k-pop' ? 6 : 4;
      options = {
      ...base, points: cityPop ? 152 : vocaloid ? 184 : anime ? 176 : mode === 'j-pop' ? 168 : kPop ? 176 : 156,
      spectrumBins: mode === 'j-pop' ? jPopBins : popBins,
      radius: kPop ? 63 : 62,
      amplitude: cityPop ? 52 : anime ? 63 : vocaloid ? 57 : mode === 'j-pop' ? 59 : kPop ? 58 : 54,
      thickness: cityPop ? 39 : anime ? 31 : vocaloid ? 28 : mode === 'j-pop' ? 34 : kPop ? 30 : 38,
      waveAmplitude: cityPop ? 13 : anime ? 20 : vocaloid ? 16 : mode === 'j-pop' ? 17 : kPop ? 14 : 15,
      smoothBins: cityPop ? 7 : vocaloid ? 2 : anime ? 3 : theme.id === 'dance-pop' || kPop ? 3 : mode === 'j-pop' ? 4 : 5,
      waveSmooth: cityPop ? 20 : vocaloid ? 8 : anime ? 10 : kPop ? 10 : mode === 'j-pop' ? 14 : 15, smoothPath: true,
      radialSmooth: {
        window: cityPop ? 7 : vocaloid ? 2 : anime || kPop ? 3 : mode === 'j-pop' ? 4 : 5,
        passes: vocaloid || anime || kPop ? 1 : 2,
        blend: cityPop ? 0.9 : vocaloid ? 0.58 : anime ? 0.66 : kPop ? 0.68 : mode === 'j-pop' ? 0.8 : 0.84
      },
      broadWave: {
        amount: cityPop ? 1.75 : vocaloid ? 2.25 : anime ? 3.05 : mode === 'j-pop' ? 2.65 : kPop ? 2.8 : 2.15,
        lobes: cityPop ? 4 : vocaloid ? 8 : anime ? 7 : mode === 'j-pop' ? 5 : kPop ? 5 : 4,
        speed: cityPop ? 0.00032 : vocaloid ? 0.00084 : anime ? 0.00076 : mode === 'j-pop' ? 0.00062 : kPop ? 0.0007 : 0.00048
      },
      spectralContrast: vocaloid ? 0.8
        : anime ? 0.74
          : cityPop ? 0.46
        : theme.id === 'dance-pop' ? 0.68
          : kPop ? 0.78
            : mode === 'j-pop' ? 0.64 : 0.54,
      contrastPower: vocaloid ? 1.52
        : anime ? 1.42
          : cityPop ? 1.12
        : theme.id === 'dance-pop' ? 1.34 : kPop ? 1.5
          : mode === 'j-pop' ? 1.28 : 1.18,
      lobes: popLobes,
      lobeAmount: vocaloid ? 3.45
        : anime ? 4.45
          : cityPop ? 2.35
          : mode === 'j-pop' ? 3.8
            : theme.id === 'dance-pop' ? 4.8 : kPop ? 4.2 : 3.1,
      echoes: kPop ? 1 : 0, nodes: false,
      peakBoost: vocaloid ? 0.55 : anime ? 0.68 : cityPop ? 0.24 : mode === 'j-pop' ? 0.38 : kPop ? 0.72 : 0.3,
      catEarDip: 0.08,
      innerFollow: cityPop ? 0.86 : vocaloid ? 0.7 : anime ? 0.75 : mode === 'j-pop' ? 0.78 : 0.82,
      material: cityPop ? 'glass' : vocaloid ? 'chrome' : 'bubble'
      };
    }
    else if (mode === 'rock') options = {
      ...base, points: theme.id === 'punk' ? 128 : 116,
      spectrumBins: theme.id === 'punk' ? 56
        : theme.id === 'pop-rock' ? 42
          : theme.id === 'alternative' ? 46
            : theme.id === 'country' ? 40 : 50,
      radius: 64, amplitude: 57, thickness: 20, waveAmplitude: 11,
      fracture: theme.id === 'punk' ? 6 : 3.5, serration: theme.id === 'punk' ? 4.5 : 2,
      ribs: true, ribStride: theme.id === 'punk' ? 7 : 9, peakBoost: 0.9, spectralContrast: 0.76, contrastPower: 1.5, catEarDip: 0.2,
      innerFollow: 0.24, material: 'steel'
    };
    else if (mode === 'metal') options = {
      ...base, points: ['deathcore', 'death-metal', 'black-metal'].includes(theme.id) ? 140 : 124,
      spectrumBins: ['deathcore', 'death-metal', 'black-metal'].includes(theme.id) ? 60
        : theme.id === 'progressive-metal' ? 58
          : theme.id === 'industrial-metal' ? 52
            : theme.id === 'nu-metal' ? 50 : 54,
      radius: 61, amplitude: 66, thickness: 18, waveAmplitude: 8,
      fracture: 8.5, spike: 4.5, spikeThreshold: 0.38, serration: 4.6,
      ribs: true, ribStride: 7, chroma: theme.id === 'industrial-metal', echoes: 0,
      peakBoost: 1.08, spectralContrast: 0.86, contrastPower: 1.72,
      catEarDip: 0.3, innerFollow: 0.14, material: 'steel'
    };
    else if (mode === 'ambient') {
      const pureAmbient = theme.id === 'ambient';
      const chillout = theme.id === 'chillout';
      options = {
        ...base,
        points: pureAmbient ? 192 : chillout ? 176 : 168,
        spectrumBins: pureAmbient ? 22 : chillout ? 28 : 34,
        radius: pureAmbient ? 70 : 68,
        amplitude: pureAmbient ? 31 : chillout ? 38 : 44,
        thickness: pureAmbient ? 46 : chillout ? 40 : 34,
        waveAmplitude: pureAmbient ? 24 : chillout ? 19 : 15,
        smoothBins: pureAmbient ? 8 : chillout ? 6 : 5,
        waveSmooth: pureAmbient ? 30 : chillout ? 25 : 20,
        smoothPath: true,
        radialSmooth: {
          window: pureAmbient ? 8 : chillout ? 6 : 5,
          passes: pureAmbient ? 4 : 3,
          blend: pureAmbient ? 0.94 : chillout ? 0.9 : 0.84
        },
        broadWave: {
          amount: pureAmbient ? 3.4 : chillout ? 2.7 : 2.35,
          lobes: pureAmbient ? 2 : chillout ? 3 : 2,
          speed: pureAmbient ? 0.0001 : chillout ? 0.0002 : 0.00027
        },
        spectralContrast: pureAmbient ? 0.24 : chillout ? 0.36 : 0.48,
        contrastPower: pureAmbient ? 1.04 : chillout ? 1.12 : 1.24,
        lowWeight: pureAmbient ? 0.82 : chillout ? 0.94 : 1.08,
        highWeight: pureAmbient ? 0.58 : chillout ? 0.7 : 0.76,
        midBoost: pureAmbient ? 0.08 : 0.05,
        echoes: pureAmbient ? 3 : chillout ? 2 : 1,
        echoSpacing: pureAmbient ? 4 : 3,
        peakBoost: pureAmbient ? 0.12 : chillout ? 0.26 : 0.42,
        contactCompression: pureAmbient ? 0.15 : chillout ? 0.45 : 0.8,
        pulseRadius: pureAmbient ? 0.25 : chillout ? 0.7 : 1.2,
        innerFollow: pureAmbient ? 0.92 : chillout ? 0.88 : 0.82,
        material: pureAmbient ? 'glass' : chillout ? 'plush' : 'membrane'
      };
    }
    else if (mode === 'experimental') {
      const glitch = theme.id === 'glitch';
      options = {
        ...base,
        points: glitch ? 136 : 164,
        spectrumBins: glitch ? 64 : 56,
        radius: glitch ? 65 : 67,
        amplitude: glitch ? 57 : 50,
        thickness: glitch ? 18 : 25,
        waveAmplitude: glitch ? 7 : 12,
        smoothBins: glitch ? 0 : 2,
        waveSmooth: glitch ? 2 : 7,
        smoothPath: !glitch,
        radialSmooth: glitch
          ? { window: 1, passes: 1, blend: 0.34 }
          : { window: 2, passes: 1, blend: 0.58 },
        broadWave: { amount: glitch ? 1.2 : 2.1, lobes: glitch ? 7 : 5, speed: glitch ? 0.00077 : 0.00041 },
        facets: glitch ? 16 : 9,
        sectorBins: glitch ? 2 : 3,
        fracture: glitch ? 7.2 : 2.4,
        serration: glitch ? 3.1 : 0.8,
        spectralContrast: glitch ? 0.94 : 0.78,
        contrastPower: glitch ? 1.78 : 1.5,
        lowWeight: glitch ? 0.92 : 1.04,
        highWeight: glitch ? 1.22 : 1.08,
        echoes: glitch ? 0 : 1,
        peakBoost: glitch ? 1.02 : 0.72,
        contactCompression: glitch ? 2.2 : 1.25,
        pulseRadius: glitch ? 2.8 : 1.7,
        innerFollow: glitch ? 0.24 : 0.52,
        material: 'glitch'
      };
    }
    else if (mode === 'hip-hop') {
      const experimentalHipHop = theme.id === 'experimental-hip-hop';
      const instrumentalHipHop = theme.id === 'instrumental-hip-hop';
      const lofiHipHop = theme.id === 'lo-fi-hip-hop';
      options = {
        ...base,
        points: experimentalHipHop ? 152 : lofiHipHop ? 168 : 144,
        spectrumBins: experimentalHipHop ? 46 : lofiHipHop ? 30 : instrumentalHipHop ? 36 : 40,
        radius: experimentalHipHop ? 65 : lofiHipHop ? 69 : 67,
        amplitude: experimentalHipHop ? 58 : lofiHipHop ? 44 : instrumentalHipHop ? 51 : 56,
        thickness: experimentalHipHop ? 30 : lofiHipHop ? 42 : instrumentalHipHop ? 37 : 34,
        waveAmplitude: experimentalHipHop ? 11 : lofiHipHop ? 19 : instrumentalHipHop ? 16 : 14,
        smoothBins: experimentalHipHop ? 2 : lofiHipHop ? 6 : instrumentalHipHop ? 4 : 3,
        waveSmooth: experimentalHipHop ? 9 : lofiHipHop ? 24 : instrumentalHipHop ? 17 : 13,
        smoothPath: true,
        radialSmooth: experimentalHipHop
          ? { window: 2, passes: 1, blend: 0.56 }
          : lofiHipHop
            ? { window: 6, passes: 3, blend: 0.9 }
            : instrumentalHipHop
              ? { window: 4, passes: 2, blend: 0.8 }
              : { window: 3, passes: 2, blend: 0.72 },
        broadWave: experimentalHipHop
          ? { amount: 2.2, lobes: 3, speed: 0.00047 }
          : lofiHipHop
            ? { amount: 2.8, lobes: 2, speed: 0.00019 }
            : { amount: 2.55, lobes: 2, speed: 0.00032 },
        lowWeight: lofiHipHop ? 1.12 : 1.26,
        highWeight: experimentalHipHop ? 0.84 : lofiHipHop ? 0.54 : 0.72,
        midBoost: lofiHipHop ? 0.08 : 0.05,
        spectralContrast: experimentalHipHop ? 0.76 : lofiHipHop ? 0.38 : instrumentalHipHop ? 0.54 : 0.64,
        contrastPower: experimentalHipHop ? 1.5 : lofiHipHop ? 1.1 : instrumentalHipHop ? 1.24 : 1.36,
        // Standard Hip-Hop stays broad and low-slung; radial spokes belong to
        // the deliberately fractured Experimental Rap variant only.
        ribs: experimentalHipHop, ribStride: experimentalHipHop ? 5 : 7,
        echoes: 0, peakBoost: experimentalHipHop ? 0.74 : 0.66,
        catEarDip: 0.12, seamWidth: 0.08,
        innerFollow: experimentalHipHop ? 0.52 : lofiHipHop ? 0.88 : instrumentalHipHop ? 0.74 : 0.64,
        material: experimentalHipHop ? 'glitch' : lofiHipHop ? 'plush' : instrumentalHipHop ? 'glass' : 'bass'
      };
    }
    else if (mode === 'phonk') {
      const driftPhonk = theme.id === 'drift-phonk';
      options = {
      ...base,
      points: driftPhonk ? 160 : 148,
      spectrumBins: driftPhonk ? 52 : 44,
      radius: 64,
      amplitude: driftPhonk ? 60 : 53,
      thickness: driftPhonk ? 24 : 30,
      waveAmplitude: driftPhonk ? 9 : 12,
      smoothBins: driftPhonk ? 2 : 3,
      waveSmooth: driftPhonk ? 8 : 11,
      smoothPath: true,
      radialSmooth: {
        window: driftPhonk ? 2 : 3,
        passes: 1,
        blend: driftPhonk ? 0.52 : 0.66
      },
      broadWave: {
        amount: driftPhonk ? 2.25 : 2.7,
        lobes: driftPhonk ? 3 : 2,
        speed: driftPhonk ? 0.00052 : 0.00034
      },
      lowWeight: driftPhonk ? 1.46 : 1.34,
      highWeight: driftPhonk ? 0.94 : 0.72,
      midBoost: 0.04,
      spectralContrast: driftPhonk ? 0.86 : 0.76,
      contrastPower: driftPhonk ? 1.68 : 1.5,
      serration: driftPhonk ? 1.75 : 0.28,
      ribs: false, ribStride: 8,
      // Heavy chromatic tearing is a Drift Phonk identifier. Mainline Phonk
      // keeps only the restrained damaged-tape registration in its signature.
      chroma: driftPhonk, echoes: 0,
      // The material follows the live outer contour as a wide, softly layered
      // ribbon. A closed annulus created a second inner ring, while filling to
      // the centre looked like a circular plate.
      ridgeDepths: [], hideInnerEdge: true, hideBandFill: true,
      peakBoost: driftPhonk ? 0.9 : 0.72,
      catEarDip: 0.13, seamWidth: 0.11,
      gravitySag: driftPhonk ? 5.5 : 9,
      offsetY: driftPhonk ? 1 : 3,
      edgeWidthScale: driftPhonk ? 1.05 : 1.16,
      outerBodyWidth: driftPhonk ? 14 : 18,
      outerBodyAlpha: driftPhonk ? 0.14 : 0.17,
      outerBodyBlur: driftPhonk ? 10 : 14,
      outerBodyBassGain: driftPhonk ? 2.2 : 3,
      outerBodyShadowSpread: driftPhonk ? 5 : 7,
      outerBodyShadowAlpha: driftPhonk ? 0.17 : 0.2,
      innerFollow: driftPhonk ? 0.48 : 0.58,
      material: 'bass'
      };
    }
    else if (mode === 'rnb') {
      const acoustic = ['singer-songwriter', 'folk'].includes(theme.id);
      const rnbVisualIds = [
        'rnb', 'contemporary-rnb', 'alternative-rnb', 'neo-soul',
        'new-jack-swing', 'soul', 'gospel', 'funk', 'blues'
      ];
      const rnbFamily = rnbVisualIds.includes(theme.id);
      const blues = theme.id === 'blues';
      const contemporaryRnb = ['rnb', 'contemporary-rnb'].includes(theme.id);
      const alternativeRnb = theme.id === 'alternative-rnb';
      const neoSoul = theme.id === 'neo-soul';
      const newJackSwing = theme.id === 'new-jack-swing';
      const soul = theme.id === 'soul';
      const gospel = theme.id === 'gospel';
      const funk = theme.id === 'funk';
      const jazzFamily = theme.family === 'jazz';
      const bebop = theme.id === 'bebop';
      const bossa = theme.id === 'bossa-nova';
      const fusion = theme.id === 'jazz-fusion';
      const rnbBins = acoustic ? 28
        : blues ? 34
        : bebop ? 46
          : fusion ? 42
            : bossa ? 30
              : jazzFamily ? 38
                : newJackSwing ? 46
                  : funk ? 48
                    : gospel ? 36
                      : alternativeRnb ? 32
                        : neoSoul || soul ? 30
                          : theme.id === 'contemporary-rnb' ? 38
                            : theme.id === 'reggae' ? 42
                              : contemporaryRnb ? 34 : 32;
      options = {
      ...base,
      points: rnbFamily || jazzFamily ? (newJackSwing || funk ? 156 : 168) : 144,
      spectrumBins: rnbBins,
      radius: rnbFamily ? 68 : jazzFamily ? 69 : 70,
      amplitude: newJackSwing || funk ? 54 : gospel ? 47 : rnbFamily ? 50 : bebop || fusion ? 48 : jazzFamily ? 45 : 43,
      thickness: newJackSwing ? 30 : funk ? 28 : alternativeRnb ? 32 : rnbFamily ? 38 : jazzFamily ? 34 : 36,
      waveAmplitude: newJackSwing ? 13 : funk ? 11 : neoSoul ? 21 : rnbFamily ? 19 : bossa ? 17 : jazzFamily ? 22 : 23,
      smoothBins: acoustic ? 6 : bebop ? 2 : bossa ? 5 : fusion ? 3 : jazzFamily ? 3 : newJackSwing || funk ? 2 : neoSoul || soul ? 6 : rnbFamily ? 4 : 5,
      waveSmooth: acoustic ? 22 : bossa ? 24 : neoSoul || soul || gospel ? 25 : newJackSwing || funk ? 11 : rnbFamily ? 22 : jazzFamily ? 17 : 20,
      smoothPath: true,
      radialSmooth: {
        window: acoustic ? 5 : newJackSwing || funk ? 2 : rnbFamily ? 5 : bebop ? 2 : jazzFamily ? 3 : 4,
        passes: rnbFamily ? (newJackSwing || funk ? 1 : 3) : bossa ? 3 : 2,
        blend: acoustic ? 0.86 : newJackSwing || funk ? 0.6 : rnbFamily ? 0.84 : jazzFamily ? 0.76 : 0.82
      },
      broadWave: rnbFamily
        ? { amount: neoSoul || soul ? 2.6 : newJackSwing ? 3.25 : funk ? 3.5 : 3.15, lobes: newJackSwing ? 4 : funk ? 3 : 3, speed: newJackSwing ? 0.00062 : funk ? 0.0007 : 0.00027 }
        : jazzFamily
          ? { amount: bossa ? 1.7 : 2.35, lobes: theme.id === 'swing-jazz' ? 3 : 2, speed: bossa ? 0.00022 : 0.00042 }
          : { amount: 2.5, lobes: 2, speed: 0.00034 },
      spectralContrast: newJackSwing || funk ? 0.72 : alternativeRnb ? 0.58 : rnbFamily ? 0.5 : bebop || fusion ? 0.58 : jazzFamily ? 0.48 : 0.42,
      contrastPower: newJackSwing || funk ? 1.48 : alternativeRnb ? 1.34 : rnbFamily ? 1.22 : bebop ? 1.34 : jazzFamily ? 1.2 : 1.15,
      lowWeight: funk ? 1.3 : newJackSwing ? 1.2 : rnbFamily ? 1.16 : bossa ? 0.9 : jazzFamily ? 1.04 : 1,
      highWeight: gospel ? 1.08 : newJackSwing ? 0.92 : rnbFamily ? 0.76 : bebop || fusion ? 1.12 : jazzFamily ? 0.98 : 1,
      midBoost: gospel ? 0.12 : rnbFamily ? 0.07 : jazzFamily ? 0.06 : 0,
      echoes: rnbFamily ? 0 : jazzFamily ? 1 : 2,
      ridgeDepths: rnbFamily ? [] : undefined,
      peakBoost: newJackSwing || funk ? 0.7 : gospel ? 0.56 : rnbFamily ? 0.5 : bebop ? 0.62 : fusion ? 0.58 : jazzFamily ? 0.46 : 0.4,
      catEarDip: 0.08,
      contactCompression: newJackSwing || funk ? 1.8 : rnbFamily ? 1.25 : 0,
      pulseRadius: newJackSwing ? 3.1 : funk ? 2.5 : rnbFamily ? 1.9 : 0,
      hideInnerEdge: rnbFamily,
      innerFollow: newJackSwing || funk ? 0.66 : rnbFamily ? 0.86 : jazzFamily ? 0.72 : 0.8,
      material: newJackSwing ? 'chrome' : funk ? 'bass' : gospel ? 'plush' : 'glass'
      };
    }
    const topGap = genreTopFrequencyGap(theme);
    options = {
      ...options,
      ...topGap,
      // Modes with a continuous top should not retain the old artificial
      // twelve-o'clock spectrum notch after their reserved zone is disabled.
      catEarDip: topGap.topFrequencyGapRatio > 0
        ? (topGap.topFrequencyGapSeamDip ?? options.catEarDip)
        : 0,
      spectrumBins: reduceDenseSpectrumBins(options.spectrumBins)
    };
    this.drawSpectrumVolume(x, y, theme, metrics, time, options);
  }

  drawGenrePoliceBeacon(x, y, metrics, time) {
    const ctx = this.ctx;
    const red = '#ff2d55';
    const blue = '#34c8ff';
    // Trance flashes are kick-locked. The general rhythm pulse also contains
    // snares, claps and hats; kickPulse has already passed the low-frequency
    // body/rise gate and therefore follows the four-floor bass drum instead.
    const pulse = clamp(metrics.kickPulse || 0);
    const rotation = time * 0.00108;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';

    for (const [index, color] of [red, blue].entries()) {
      const angle = rotation + index * Math.PI;
      ctx.save();
      ctx.rotate(angle);
      const outer = 148 + pulse * 4;
      const halfWidth = 0.4 + pulse * 0.035;
      const beam = ctx.createRadialGradient(0, 0, 26, 0, 0, outer);
      beam.addColorStop(0, rgba(color, 0.02));
      beam.addColorStop(0.24, rgba(color, 0.17 + pulse * 0.06));
      beam.addColorStop(0.66, rgba(color, 0.085 + pulse * 0.035));
      beam.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(27, -5);
      ctx.lineTo(Math.cos(-halfWidth) * outer, Math.sin(-halfWidth) * outer);
      ctx.arc(0, 0, outer, -halfWidth, halfWidth);
      ctx.lineTo(27, 5);
      ctx.closePath();
      ctx.fill();

      const coreBeam = ctx.createRadialGradient(0, 0, 34, 0, 0, outer * 0.92);
      coreBeam.addColorStop(0, rgba(color, 0.14 + pulse * 0.08));
      coreBeam.addColorStop(0.55, rgba(color, 0.055));
      coreBeam.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = coreBeam;
      ctx.beginPath();
      ctx.moveTo(32, -3);
      ctx.lineTo(outer * 0.92, -16);
      ctx.arc(0, 0, outer * 0.92, -0.12, 0.12);
      ctx.lineTo(32, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawGenrePoliceOverlay(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const red = '#ff2d55';
    const blue = '#34c8ff';
    const ivory = '#fff4dc';
    const pulse = clamp(metrics.rhythmPulse || 0);
    const baseRadius = this.lastSpectrum?.baseRadius || 68;
    const radius = Math.min(122, baseRadius + 45);
    const patrolAngle = time * 0.00108;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';

    // Counter-rotating segmented enforcement ring: separate from the regular
    // genre signature and visible even in quieter sections of the track.
    ctx.save();
    ctx.rotate(-time * 0.00031);
    for (let index = 0; index < 28; index += 1) {
      const start = index / 28 * TAU;
      const color = Math.floor(index / 3) % 2 ? blue : red;
      const active = 0.5 + 0.5 * Math.sin(time * 0.0045 - index * 0.48);
      this.strokeGlow(color, 0.72 + pulse * 0.5, 8 + pulse * 8, 0.17 + active * 0.16 + pulse * 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, radius, start + 0.025, start + TAU / 28 * 0.62);
      ctx.stroke();
    }
    ctx.restore();

    // A restrained eight-point badge sits around the artwork bezel. The DOM
    // album art remains above it, so the badge reads as hardware, not a logo.
    ctx.save();
    ctx.rotate(time * 0.00008);
    ctx.beginPath();
    for (let index = 0; index < 16; index += 1) {
      const angle = index / 16 * TAU - Math.PI / 2;
      const badgeRadius = index % 2 ? 49 + pulse * 1.2 : 56 + pulse * 2.6;
      const px = Math.cos(angle) * badgeRadius;
      const py = Math.sin(angle) * badgeRadius;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    this.strokeGlow(ivory, 0.72 + pulse * 0.45, 11 + pulse * 8, 0.18 + pulse * 0.24);
    ctx.stroke();
    ctx.restore();

    // The two rotating light heads make the siren motion readable even when
    // the transparent desktop happens to be very bright.
    for (const [index, color] of [red, blue].entries()) {
      const angle = patrolAngle + index * Math.PI;
      const nodeRadius = radius + 7;
      const nx = Math.cos(angle) * nodeRadius;
      const ny = Math.sin(angle) * nodeRadius;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(angle + Math.PI / 2);
      ctx.lineCap = 'round';
      this.strokeGlow(color, 3.1 + pulse * 2.1, 18 + pulse * 13, 0.56 + pulse * 0.35);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Crosshair gates and beat-driven violation ticks add a second cadence:
    // constant scanning plus musical alerts on strong rhythmic events.
    for (let gate = 0; gate < 4; gate += 1) {
      const angle = gate / 4 * TAU;
      const color = gate % 2 ? blue : red;
      this.strokeGlow(color, 0.85 + pulse * 0.7, 9 + pulse * 7, 0.2 + pulse * 0.32);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius - 10), Math.sin(angle) * (radius - 10));
      ctx.lineTo(Math.cos(angle) * (radius + 4 + pulse * 8), Math.sin(angle) * (radius + 4 + pulse * 8));
      ctx.stroke();
    }
    if (pulse > 0.025) {
      for (let tick = 0; tick < 8; tick += 1) {
        const angle = tick / 8 * TAU + Math.PI / 8;
        const inner = radius + 3;
        const outer = inner + 3 + pulse * 13;
        this.strokeGlow(tick % 2 ? blue : red, 1 + pulse * 1.2, 12, pulse * 0.52);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (metrics.rhythmNow) {
      const policeTheme = { ...theme, accent: red, accent2: blue, hot: ivory };
      const count = 3 + Math.round(clamp(metrics.impact || 0) * 4);
      for (let index = 0; index < count; index += 1) {
        this.spawnParticle(x, y, policeTheme, metrics, {
          angle: index / count * TAU + patrolAngle,
          shape: index % 2 ? 'dot' : 'shard',
          speed: 1.25 + pulse * 1.5,
          size: 0.65 + pulse,
          decay: 0.028
        });
      }
    }
  }

  drawTranceAccretionVortex(x, y, theme, metrics, time, spectrum) {
    const ctx = this.ctx;
    // A Trance impact is the four-on-the-floor low-end anchor, not any generic
    // rhythmic transient (hats, claps and bright arpeggio attacks included).
    const pulse = clamp(metrics.kickPulse || 0);
    const psychedelic = theme.id === 'psytrance';
    const uplifting = theme.id === 'uplifting-trance';
    const progressive = theme.id === 'progressive-trance';
    const techTrance = theme.id === 'tech-trance';
    const hardTrance = theme.id === 'hard-trance';
    const vortexBrightnessScale = psychedelic ? 0.8
      : uplifting ? 1.08
        : progressive ? 0.9
          : techTrance ? 0.94
            : hardTrance ? 1.02 : 1;
    const armWidthScale = psychedelic ? 0.86
      : uplifting ? 1.22
        : progressive ? 0.9
          : techTrance ? 0.68
            : hardTrance ? 1.2 : 1;
    const dustFlowScale = psychedelic ? 1.16
      : uplifting ? 0.92
        : progressive ? 0.74
          : techTrance ? 1.18
            : hardTrance ? 1.28 : 1;
    const direction = 1;
    // Trance motion has two deliberately separate time scales. A sustained,
    // multiband section envelope drives the vortex; kickPulse below only flashes
    // particles. A drop normally restores the full bassline while retaining the
    // layered melodic spectrum, so require low-end foundation and mid/high fill
    // together instead of treating one bright build-up or one kick as a climax.
    const relativeLift = clamp(((metrics.relativeEnergy || 1) - 0.72) / 1.08);
    const lowFoundation = clamp(metrics.bass * 0.62 + metrics.lowMid * 0.38);
    const melodicFill = clamp(metrics.mid * 0.72 + metrics.high * 0.28);
    const fullSpectrumFill = Math.sqrt(lowFoundation * melodicFill);
    const rawEnergy = clamp(
      metrics.volume * 0.14
        + metrics.bass * 0.12
        + metrics.lowMid * 0.12
        + metrics.mid * 0.22
        + metrics.high * 0.06
        + relativeLift * 0.18
        + fullSpectrumFill * 0.3
    );
    const deltaMs = this.tranceLastAt ? clamp(time - this.tranceLastAt, 4, 36) : 16.667;
    this.tranceLastAt = time;
    const attackMs = psychedelic ? 300 : uplifting ? 430 : progressive ? 560 : techTrance ? 330 : hardTrance ? 285 : 380;
    const releaseMs = psychedelic ? 780 : uplifting ? 1250 : progressive ? 1450 : techTrance ? 930 : hardTrance ? 760 : 1100;
    const responseMs = rawEnergy > this.tranceEnergy ? attackMs : releaseMs;
    const response = 1 - Math.exp(-deltaMs / responseMs);
    this.tranceEnergy += (rawEnergy - this.tranceEnergy) * response;
    const energy = clamp(this.tranceEnergy);
    // Expand the quiet/climax separation without turning it into a binary drop
    // detector. This remains a sustained Trance section envelope: restored
    // kick/bass foundation plus the layered mid/high synth field.
    const sectionDrive = smoothstep(0.24, 0.78, energy);
    // Quiet passages drift while the sustained section/climax envelope controls
    // every non-lighting motion. Individual impacts are reserved for relighting
    // only, so the vortex does not jerk forward on every detected beat.
    const impactDrive = Math.pow(pulse, 0.72);
    const particleImpactLift = Math.pow(impactDrive, 0.68);
    const flowSpeed = (psychedelic ? 0.00006 : uplifting ? 0.000036 : progressive ? 0.000032 : techTrance ? 0.000052 : hardTrance ? 0.000058 : 0.000042)
      + Math.pow(sectionDrive, 1.55) * (psychedelic ? 0.00062 : uplifting ? 0.0005 : progressive ? 0.00048 : techTrance ? 0.00064 : hardTrance ? 0.00071 : 0.00055);
    // Keep an unbounded phase. Wrapping a phase and then scaling it by a
    // non-integer caused a visible jump at the loop boundary.
    this.tranceFlowPhase += deltaMs * flowSpeed;
    const flowPhase = this.tranceFlowPhase * TAU;
    // Keep quiet sections drifting at the previous speed, then open a wider
    // nonlinear range at high energy so a climax visibly winds up the vortex.
    const rotationSurge = Math.pow(sectionDrive, 1.72);
    const armRotationSpeed = (psychedelic ? 0.000034 : uplifting ? 0.000018 : progressive ? 0.000017 : techTrance ? 0.000027 : hardTrance ? 0.000031 : 0.000022)
      + rotationSurge * (psychedelic ? 0.00076 : uplifting ? 0.00059 : progressive ? 0.00058 : techTrance ? 0.00072 : hardTrance ? 0.00078 : 0.00067);
    this.tranceArmPhase += deltaMs * armRotationSpeed;

    const wavePoints = spectrum?.outer || [];
    const waveSamples = wavePoints.map((point) => ({
      angle: point.angle ?? Math.atan2(point.y - y, point.x - x),
      radius: Math.hypot(point.x - x, point.y - y),
      spectrum: point.spectrum || 0
    }));
    const waveMean = waveSamples.length
      ? waveSamples.reduce((sum, point) => sum + point.radius, 0) / waveSamples.length
      : 84;
    // Keep the event horizon geometrically fixed. Audio may accelerate and
    // relight the flow, but must not make the vortex breathe or deform.
    const horizon = 50;
    // A few density-wave families, each split into many short filaments, read
    // as a galaxy. Too many complete families overlap into either a fan or ring.
    // Family count and arm body are the primary subtype cues: Uplifting opens
    // into fewer broad streams, Tech Trance uses more narrow tributaries, and
    // Psytrance retains the densest field. None changes the vortex direction.
    const armCount = psychedelic ? 12 : uplifting ? 6 : techTrance ? 10 : 8;
    const armPhaseOffsets = Array.from({ length: armCount }, (_, index) => {
      const base = index / armCount;
      return (base + Math.sin(index * 2.17 + (psychedelic ? 0.7 : 0.2)) * 0.018 + 1) % 1;
    });
    const armReachOffsets = Array.from(
      { length: armCount },
      (_, index) => 3.5 + Math.sin(index * 1.73 + 0.4) * 8
    );
    const armWeightScales = Array.from(
      { length: armCount },
      (_, index) => 0.72 + (Math.sin(index * 2.31 + 1.1) + 1) * 0.14
    );
    const armBrightnessScale = vortexBrightnessScale;
    const armRotation = direction * this.tranceArmPhase;
    const armCurl = uplifting ? 3.36 : progressive ? 3.25 : techTrance ? 3.88 : hardTrance ? 3.5 : 3.65;
    const armColors = [theme.accent, theme.accent2, theme.hot];

    // The artwork is the dark aperture. One restrained glow behind the live
    // waveform supplies depth without adding another visible circular layer.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const well = ctx.createRadialGradient(0, 0, horizon - 7, 0, 0, waveMean + 35);
    well.addColorStop(0, 'rgba(0, 0, 5, .43)');
    well.addColorStop(0.42, rgba(theme.accent2, 0.055 + energy * 0.04));
    well.addColorStop(0.76, rgba(theme.accent, 0.022 + energy * 0.025));
    well.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = well;
    ctx.beginPath();
    ctx.arc(0, 0, waveMean + 35, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Keep the arm silhouette geometrically stable. Rotation, travelling light
    // packets and infalling dust carry the motion; changing the whole path on
    // every beat made the spiral nervous and prevented its glow body from being
    // cached efficiently.
    const armPointAt = (armIndex, travel, laneOffset = 0) => {
      const angle = armRotation + armPhaseOffsets[armIndex] * TAU
        - direction * (
          travel * (armCurl + (armIndex % 2 ? -0.045 : 0.035))
          + laneOffset * 0.1
        );
      // Extend the mathematical vortex beneath the circular artwork. The DOM
      // cover then occludes the last turn naturally, so the flow appears to
      // disappear inside the black-hole core instead of stopping at its rim.
      const innerRadius = 30;
      const outerRadius = 105 + laneOffset * 2.5
        + armReachOffsets[armIndex] * 0.72;
      // Exponential radial growth paired with a linear angular sweep produces
      // a stable logarithmic-spiral silhouette instead of a propeller blade.
      const radius = innerRadius * Math.pow(Math.max(1.02, outerRadius / innerRadius), travel);
      return { angle, radius, spectrum: energy };
    };

    const laneProfiles = [
      { offset: -1.15, width: 8.2 * armWidthScale, span: 0.84, blur: 2.2, alpha: 0.78, color: 'primary', phase: 0 },
      { offset: 0, width: 5.2 * armWidthScale, span: 0.76, blur: 1.4, alpha: 0.7, color: 'hot', phase: 0.075 },
      { offset: 1.1, width: 3.5 * armWidthScale, span: 0.68, blur: 0.9, alpha: 0.6, color: 'secondary', phase: 0.155 }
    ];
    const profileColor = (profile, armIndex) => {
      if (profile.color === 'hot') {
        return psychedelic ? (armIndex % 2 ? theme.accent : theme.accent2) : theme.hot;
      }
      if (profile.color === 'secondary') return theme.accent2;
      return armColors[armIndex % armColors.length];
    };
    const traceArmLine = (armIndex, laneOffset, from = 0, to = 1, steps = 30) => {
      ctx.beginPath();
      for (let step = 0; step <= steps; step += 1) {
        const travel = from + (to - from) * (step / steps);
        const point = armPointAt(armIndex, travel, laneOffset);
        const px = Math.cos(point.angle) * point.radius;
        const py = Math.sin(point.angle) * point.radius;
        if (!step) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    };
    const traceVariableArmBand = (armIndex, laneOffset, baseWidth, steps = 28) => {
      const centers = [];
      for (let step = 0; step <= steps; step += 1) {
        const travel = step / steps;
        const point = armPointAt(armIndex, travel, laneOffset);
        centers.push({
          x: Math.cos(point.angle) * point.radius,
          y: Math.sin(point.angle) * point.radius,
          travel
        });
      }
      const outer = [];
      const inner = [];
      centers.forEach((point, index) => {
        const previous = centers[Math.max(0, index - 1)];
        const next = centers[Math.min(centers.length - 1, index + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const nx = -dy / length;
        const ny = dx / length;
        const localBreathing = Math.sin(
          point.travel * TAU * 1.35 - flowPhase * 0.32 + armIndex * 0.9 + laneOffset * 0.4
        ) * (0.025 + energy * 0.035);
        const widthEnvelope = 0.68 + Math.pow(point.travel, 0.82) * 0.72 + localBreathing;
        const halfWidth = baseWidth * widthEnvelope;
        outer.push({ x: point.x + nx * halfWidth, y: point.y + ny * halfWidth });
        inner.push({ x: point.x - nx * halfWidth, y: point.y - ny * halfWidth });
      });
      ctx.beginPath();
      outer.forEach((point, index) => {
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      for (let index = inner.length - 1; index >= 0; index -= 1) {
        ctx.lineTo(inner[index].x, inner[index].y);
      }
      ctx.closePath();
    };

    // Ten interlaced streams (fourteen for Psytrance) form one broad stardust
    // whirl rather than a few propeller-like blades. The expensive glow body is
    // rendered once into a snug offscreen canvas; live frames only rotate and
    // relight that bitmap, while packets and particles keep flowing separately.
    const cacheSize = 288;
    const cacheDpr = Math.max(1, this.dpr);
    const armCacheKey = [
      theme.id,
      theme.accent,
      theme.accent2,
      theme.hot,
      armCount,
      cacheDpr
    ].join('|');
    if (!this.tranceArmCache || this.tranceArmCacheKey !== armCacheKey) {
      const cache = this.tranceArmCache || document.createElement('canvas');
      const fixedParticleCache = this.tranceFixedParticleCache || document.createElement('canvas');
      cache.width = Math.round(cacheSize * cacheDpr);
      cache.height = Math.round(cacheSize * cacheDpr);
      fixedParticleCache.width = Math.round(cacheSize * cacheDpr);
      fixedParticleCache.height = Math.round(cacheSize * cacheDpr);
      const cacheCtx = cache.getContext('2d', { alpha: true });
      const fixedParticleCtx = fixedParticleCache.getContext('2d', { alpha: true });
      cacheCtx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
      cacheCtx.clearRect(0, 0, cacheSize, cacheSize);
      cacheCtx.translate(cacheSize / 2, cacheSize / 2);
      cacheCtx.globalCompositeOperation = 'screen';
      cacheCtx.lineCap = 'round';
      cacheCtx.lineJoin = 'round';
      fixedParticleCtx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
      fixedParticleCtx.clearRect(0, 0, cacheSize, cacheSize);
      fixedParticleCtx.translate(cacheSize / 2, cacheSize / 2);
      fixedParticleCtx.globalCompositeOperation = 'screen';

      const cachedPointAt = (armIndex, travel, laneOffset = 0) => {
        const angle = armPhaseOffsets[armIndex] * TAU
          - direction * (
            travel * (armCurl + (armIndex % 2 ? -0.045 : 0.035))
            + laneOffset * 0.1
          );
        const innerRadius = 30;
        const outerRadius = 105 + laneOffset * 2.5
          + armReachOffsets[armIndex] * 0.72;
        const radius = innerRadius * Math.pow(Math.max(1.02, outerRadius / innerRadius), travel);
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
      };
      const traceCachedBand = (armIndex, laneOffset, baseWidth, steps = 40) => {
        const centers = [];
        for (let step = 0; step <= steps; step += 1) {
          const travel = step / steps;
          centers.push({ ...cachedPointAt(armIndex, travel, laneOffset), travel });
        }
        const outer = [];
        const inner = [];
        centers.forEach((point, index) => {
          const previous = centers[Math.max(0, index - 1)];
          const next = centers[Math.min(centers.length - 1, index + 1)];
          const dx = next.x - previous.x;
          const dy = next.y - previous.y;
          const length = Math.max(0.001, Math.hypot(dx, dy));
          const nx = -dy / length;
          const ny = dx / length;
          const halfWidth = baseWidth * (0.48 + Math.pow(point.travel, 0.72) * 0.9);
          outer.push({ x: point.x + nx * halfWidth, y: point.y + ny * halfWidth });
          inner.push({ x: point.x - nx * halfWidth, y: point.y - ny * halfWidth });
        });
        cacheCtx.beginPath();
        outer.forEach((point, index) => {
          if (!index) cacheCtx.moveTo(point.x, point.y);
          else cacheCtx.lineTo(point.x, point.y);
        });
        for (let index = inner.length - 1; index >= 0; index -= 1) {
          cacheCtx.lineTo(inner[index].x, inner[index].y);
        }
        cacheCtx.closePath();
      };
      const randomAt = (value) => {
        const raw = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
        return raw - Math.floor(raw);
      };
      for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
        const armWeight = armWeightScales[armIndex];
        // Only a very soft density haze is continuous. It gives the dust a
        // shared flow field without exposing a solid blade silhouette.
        // Only every third family carries a broad gas cloud. The intervening
        // families are fragmented stardust tributaries, so the vortex gains
        // many apparent arms without becoming nine solid fan blades.
        const broadArmStride = psychedelic ? 3 : 2;
        if (armIndex % broadArmStride === 0) [-1.15, 0.05, 1.2].forEach((laneOffset, laneIndex) => {
          const color = armColors[(armIndex + laneIndex) % armColors.length];
          traceCachedBand(
            armIndex,
            laneOffset,
            (psychedelic ? 7.2 : 8.4) * armWidthScale * armWeight * (laneIndex === 1 ? 0.7 : 1)
          );
          const fill = cacheCtx.createRadialGradient(0, 0, 24, 0, 0, 134);
          fill.addColorStop(0, rgba(color, 0.025));
          fill.addColorStop(0.16, rgba(color, 0.62));
          fill.addColorStop(0.55, rgba(color, 0.48));
          fill.addColorStop(0.86, rgba(color, 0.18));
          fill.addColorStop(1, rgba(color, 0));
          cacheCtx.fillStyle = fill;
          cacheCtx.filter = 'blur(2.6px)';
          cacheCtx.shadowColor = color;
          cacheCtx.shadowBlur = 9;
          cacheCtx.globalAlpha = (laneIndex === 1 ? 0.12 : 0.145) * (0.78 + armWeight * 0.22);
          cacheCtx.fill('evenodd');
        });

        // Several incomplete hairline streams imply rotation without outlining
        // an entire sector. Their different start/end points break fan symmetry.
        const filamentCount = psychedelic ? 5 : techTrance ? 7 : hardTrance ? 4 : uplifting ? 3 : 4;
        for (let filament = 0; filament < filamentCount; filament += 1) {
          const seed = armIndex * 41.13 + filament * 17.91;
          const from = 0.08 + randomAt(seed) * 0.26;
          const to = Math.min(0.98, from + 0.34 + randomAt(seed + 2.3) * 0.4);
          const laneOffset = (randomAt(seed + 5.7) * 2 - 1) * 1.9;
          cacheCtx.beginPath();
          for (let step = 0; step <= 24; step += 1) {
            const travel = from + (to - from) * (step / 24);
            const point = cachedPointAt(armIndex, travel, laneOffset);
            if (!step) cacheCtx.moveTo(point.x, point.y);
            else cacheCtx.lineTo(point.x, point.y);
          }
          const color = armColors[(armIndex + filament) % armColors.length];
          const stroke = cacheCtx.createRadialGradient(0, 0, 26, 0, 0, 134);
          stroke.addColorStop(0, rgba(color, 0.04));
          stroke.addColorStop(0.24, rgba(color, 0.46));
          stroke.addColorStop(0.68, rgba(color, 0.3));
          stroke.addColorStop(1, rgba(color, 0));
          cacheCtx.filter = 'none';
          cacheCtx.strokeStyle = stroke;
          cacheCtx.lineWidth = (0.55 + randomAt(seed + 8.2) * 1.15)
            * (techTrance ? 0.72 : uplifting ? 1.18 : hardTrance ? 1.08 : 1);
          cacheCtx.shadowColor = color;
          cacheCtx.shadowBlur = 3.4;
          cacheCtx.globalAlpha = 0.24 + randomAt(seed + 10.4) * 0.2;
          cacheCtx.stroke();
        }

        // The visible arm is primarily a density wave of irregular points, as
        // in procedural galaxy renderers, rather than one continuous surface.
        const grainCount = psychedelic ? 47 : uplifting ? 46 : progressive ? 32 : techTrance ? 35 : hardTrance ? 42 : 40;
        for (let grain = 0; grain < grainCount; grain += 1) {
          const seed = armIndex * 97.17 + grain * 19.73;
          // Stratify both distance and lane placement, then add restrained
          // deterministic jitter. Pure random sampling left obvious clumps and
          // empty stretches on otherwise smooth Trance arms.
          const travelUnit = (grain + 0.18 + randomAt(seed) * 0.64) / grainCount;
          const travel = 0.08 + travelUnit * 0.9;
          const laneUnit = (
            grain * 0.61803398875
              + armIndex * 0.137
              + randomAt(seed + 1.7) * 0.14
          ) % 1;
          const laneOffset = (laneUnit * 2 - 1) * (1.2 + travel * 1.9);
          const anchor = cachedPointAt(armIndex, travel, laneOffset);
          const scatterAngle = anchor.angle + (randomAt(seed + 3.1) * 2 - 1) * (0.035 + travel * 0.045);
          const scatterRadius = (randomAt(seed + 4.9) * 2 - 1) * (1.5 + travel * 4.8);
          const radius = Math.hypot(anchor.x, anchor.y) + scatterRadius;
          const point = { x: Math.cos(scatterAngle) * radius, y: Math.sin(scatterAngle) * radius };
          const color = armColors[(armIndex + Math.floor(randomAt(seed + 6.3) * 3)) % armColors.length];
          const sparkle = randomAt(seed + 9.7);
          fixedParticleCtx.filter = 'none';
          fixedParticleCtx.shadowColor = color;
          fixedParticleCtx.shadowBlur = sparkle > 0.88 ? 5.2 : 1.8;
          fixedParticleCtx.globalAlpha = 0.16 + sparkle * 0.36;
          fixedParticleCtx.fillStyle = color;
          fixedParticleCtx.beginPath();
          fixedParticleCtx.arc(point.x, point.y, 0.25 + sparkle * sparkle * 1.35, 0, TAU);
          fixedParticleCtx.fill();
        }
      }
      // Cross-fade the cached foreground vortex into the themed backdrop.
      // The main arm body stays intact through its readable radius, then both
      // gas and fixed dust disappear gradually instead of ending at one ring.
      const fadeCachedArmTail = (targetCtx) => {
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'destination-in';
        targetCtx.globalAlpha = 1;
        targetCtx.filter = 'none';
        targetCtx.shadowBlur = 0;
        const tailMask = targetCtx.createRadialGradient(0, 0, 72, 0, 0, 112);
        tailMask.addColorStop(0, 'rgba(255,255,255,1)');
        tailMask.addColorStop(0.42, 'rgba(255,255,255,.58)');
        tailMask.addColorStop(0.72, 'rgba(255,255,255,.18)');
        tailMask.addColorStop(0.9, 'rgba(255,255,255,.035)');
        tailMask.addColorStop(1, 'rgba(255,255,255,0)');
        targetCtx.fillStyle = tailMask;
        targetCtx.fillRect(-cacheSize / 2, -cacheSize / 2, cacheSize, cacheSize);
        targetCtx.restore();
      };
      fadeCachedArmTail(cacheCtx);
      fadeCachedArmTail(fixedParticleCtx);
      cacheCtx.setTransform(1, 0, 0, 1, 0, 0);
      fixedParticleCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.tranceArmCache = cache;
      this.tranceFixedParticleCache = fixedParticleCache;
      this.tranceArmCacheKey = armCacheKey;
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.rotate(armRotation);
    // Arm luminance is intentionally invariant. Section intensity controls its
    // motion, while beat flashes belong exclusively to the particle systems.
    ctx.globalAlpha = 0.78 * armBrightnessScale;
    ctx.drawImage(this.tranceArmCache, -cacheSize / 2, -cacheSize / 2, cacheSize, cacheSize);
    ctx.restore();

    // Fixed stardust shares the arm rotation, but lives on its own layer so the
    // Trance section envelope and individual kick flashes can relight the stars
    // without changing the brightness or silhouette of the gaseous arms.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.rotate(armRotation);
    const fixedParticleBase = 0.21 + Math.pow(sectionDrive, 1.48) * 0.66;
    ctx.globalAlpha = fixedParticleBase * armBrightnessScale;
    ctx.drawImage(
      this.tranceFixedParticleCache,
      -cacheSize / 2,
      -cacheSize / 2,
      cacheSize,
      cacheSize
    );
    if (impactDrive > 0.015) {
      ctx.filter = `brightness(${1.16 + particleImpactLift * 0.94})`;
      ctx.globalAlpha = particleImpactLift * 0.9 * armBrightnessScale;
      ctx.drawImage(
        this.tranceFixedParticleCache,
        -cacheSize / 2,
        -cacheSize / 2,
        cacheSize,
        cacheSize
      );
    }
    ctx.restore();

    // A feathered event-horizon aura, not a stroke. The artwork occludes the
    // inner half while the outer half dissolves into the density-wave arms.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const horizonAura = ctx.createRadialGradient(0, 0, horizon - 7, 0, 0, horizon + 23);
    horizonAura.addColorStop(0, rgba(theme.hot, 0));
    horizonAura.addColorStop(0.2, rgba(theme.hot, 0.16 + energy * 0.035));
    horizonAura.addColorStop(0.43, rgba(theme.accent2, 0.2 + energy * 0.035));
    horizonAura.addColorStop(0.7, rgba(theme.accent, 0.095 + energy * 0.02));
    horizonAura.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = horizonAura;
    ctx.shadowColor = theme.accent2;
    ctx.shadowBlur = 11 + energy * 3;
    ctx.globalAlpha = 0.72 * vortexBrightnessScale;
    ctx.beginPath();
    ctx.arc(0, 0, horizon + 24, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Subgenre accents grow from the live spiral field. Uplifting carries long
    // luminous crests, while Tech and Hard Trance use short mechanical gates
    // and compression teeth attached directly to their arm streamlines.
    if (uplifting) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      for (let armIndex = 0; armIndex < armCount; armIndex += 2) {
        const crest = ctx.createRadialGradient(0, 0, horizon - 2, 0, 0, 112);
        crest.addColorStop(0, rgba(theme.hot, 0.22 + sectionDrive * 0.08));
        crest.addColorStop(0.55, rgba(theme.accent, 0.18 + sectionDrive * 0.07));
        crest.addColorStop(1, rgba(theme.accent2, 0));
        ctx.strokeStyle = crest;
        ctx.lineWidth = 2.2 + sectionDrive * 0.8;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 11 + sectionDrive * 5;
        ctx.globalAlpha = 0.5;
        traceArmLine(armIndex, -0.35, 0.18, 0.88, 34);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (techTrance || hardTrance) {
      const drawArmGate = (armIndex, travel, halfLength, color, alpha) => {
        const point = armPointAt(armIndex, travel, 0);
        const before = armPointAt(armIndex, Math.max(0, travel - 0.012), 0);
        const after = armPointAt(armIndex, Math.min(1, travel + 0.012), 0);
        const px = Math.cos(point.angle) * point.radius;
        const py = Math.sin(point.angle) * point.radius;
        const bx = Math.cos(before.angle) * before.radius;
        const by = Math.sin(before.angle) * before.radius;
        const ax = Math.cos(after.angle) * after.radius;
        const ay = Math.sin(after.angle) * after.radius;
        const tangentLength = Math.max(0.001, Math.hypot(ax - bx, ay - by));
        const nx = -(ay - by) / tangentLength;
        const ny = (ax - bx) / tangentLength;
        ctx.strokeStyle = rgba(color, alpha);
        ctx.lineWidth = techTrance ? 1.02 : 1.28;
        ctx.lineCap = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = techTrance ? 5 : 8;
        ctx.beginPath();
        ctx.moveTo(px - nx * halfLength, py - ny * halfLength);
        ctx.lineTo(px + nx * halfLength, py + ny * halfLength);
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
        if (techTrance) {
          const travel = 0.3 + (armIndex % 3) * 0.15;
          drawArmGate(
            armIndex,
            travel,
            4.1 + (armIndex % 2) * 0.9,
            armIndex % 2 ? theme.accent2 : theme.accent,
            0.24 + metrics.high * 0.15 + pulse * 0.1
          );
        } else {
          drawArmGate(
            armIndex,
            0.2 + (armIndex % 2) * 0.045,
            4.5 + pulse * 2.1,
            armIndex % 2 ? theme.hot : theme.accent,
            0.27 + sectionDrive * 0.12 + pulse * 0.2
          );
        }
      }
      ctx.restore();
    }

    // Each arm is a family of broad and fine streams with different offsets,
    // widths and phases. Their overlapping tapers look like fluid strands and
    // ensure no single filled wedge can read as a propeller blade.
    const drawOpenBand = (outer, inner) => {
      ctx.beginPath();
      outer.forEach((point, index) => {
        if (!index) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      for (let index = inner.length - 1; index >= 0; index -= 1) {
        ctx.lineTo(inner[index].x, inner[index].y);
      }
      ctx.closePath();
    };
    // Hard-edged travelling bands read as solid blades inside the mist. Keep
    // transport particle-based; the cached body rotates continuously beneath it.
    const packetCount = 0;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let armIndex = 0; armIndex < armCount; armIndex += 2) {
      const armWeight = armWeightScales[armIndex];
      for (let lane = 0; lane < laneProfiles.length; lane += 1) {
        const profile = laneProfiles[lane];
        const laneOffset = profile.offset;
        for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
          const inwardProgress = (
            this.tranceFlowPhase * (psychedelic ? 1.18 : 1.06)
            + packetIndex / packetCount
            + profile.phase
            + armIndex * 0.047
          ) % 1;
          const life = smoothstep(0, 0.055, inwardProgress)
            * (1 - smoothstep(0.945, 1, inwardProgress));
          if (life <= 0.01) continue;
          const headTravel = 1 - inwardProgress;
          const segmentSpan = profile.span + energy * 0.045;
          const tailTravel = Math.min(1, headTravel + segmentSpan);
          const segmentSteps = profile.width > 5 ? 17 : profile.width > 3 ? 15 : 13;
          const outer = [];
          const inner = [];
          for (let step = 0; step <= segmentSteps; step += 1) {
            const along = step / segmentSteps;
            const travel = headTravel + (tailTravel - headTravel) * along;
            const point = armPointAt(armIndex, travel, laneOffset);
            const tapered = Math.pow(Math.sin(Math.PI * along), 0.34);
            const radialWidthScale = 0.62 + Math.pow(travel, 0.82) * 0.68;
            const halfWidth = 0.4
              + tapered * profile.width * armWeight * radialWidthScale * (1.3 + energy * 0.24);
            outer.push({
              x: Math.cos(point.angle) * (point.radius + halfWidth),
              y: Math.sin(point.angle) * (point.radius + halfWidth)
            });
            inner.push({
              x: Math.cos(point.angle) * Math.max(1, point.radius - halfWidth),
              y: Math.sin(point.angle) * Math.max(1, point.radius - halfWidth)
            });
          }
          drawOpenBand(outer, inner);
          const primaryColor = armColors[armIndex % armColors.length];
          const color = profileColor(profile, armIndex);
          const streamFill = ctx.createRadialGradient(0, 0, horizon, 0, 0, waveMean + 40);
          streamFill.addColorStop(0, rgba(theme.hot, 0.25));
          streamFill.addColorStop(0.28, rgba(color, 0.265));
          streamFill.addColorStop(0.7, rgba(primaryColor, 0.205));
          streamFill.addColorStop(0.9, rgba(primaryColor, 0.072));
          streamFill.addColorStop(1, rgba(primaryColor, 0));
          ctx.filter = 'none';
          ctx.fillStyle = streamFill;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8.5 + profile.width * 0.85;
          ctx.globalAlpha = life * (profile.alpha * 0.86)
            * (0.78 + armWeight * 0.22) * armBrightnessScale;
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // No independent circular photon band: the cached density waves continue
    // beneath the artwork, so only their irregular local glow escapes at the
    // edge. This keeps the core integrated without reintroducing a hard ring.

    // Sparse stardust is entrained by the same spiral field. It starts loosely
    // around an arm and is pulled closer to that streamline near the artwork.
    const vortexDrive = clamp(sectionDrive);
    const targetDust = psychedelic
      ? 34 + Math.round(Math.pow(vortexDrive, 1.42) * 166)
      : uplifting ? 32 + Math.round(Math.pow(vortexDrive, 1.42) * 156)
        : progressive ? 22 + Math.round(Math.pow(vortexDrive, 1.42) * 112)
          : techTrance ? 24 + Math.round(Math.pow(vortexDrive, 1.42) * 130)
            : hardTrance ? 30 + Math.round(Math.pow(vortexDrive, 1.42) * 160)
              : 28 + Math.round(Math.pow(vortexDrive, 1.42) * 148);
    const dustScatter = psychedelic ? 0.32
      : uplifting ? 0.3
        : progressive ? 0.24
          : techTrance ? 0.18
            : hardTrance ? 0.22 : 0.26;
    while (this.tranceDust.length < targetDust) {
      const armIndex = Math.floor(Math.random() * armCount);
      this.tranceDust.push({
        progress: Math.random(),
        armIndex,
        laneOffset: Math.random() * 2 - 1,
        angularScatter: (Math.random() * 2 - 1) * dustScatter,
        radialScatter: (Math.random() * 2 - 1) * 11,
        depth: Math.random(),
        speed: 0.72 + Math.random() * 0.72,
        size: 0.45 + Math.random() * 0.85,
        colorIndex: armIndex,
        twinkle: Math.random() * TAU
      });
    }
    if (this.tranceDust.length > targetDust) {
      // Let a climax recede naturally instead of deleting a bright cloud in
      // one frame when the energy envelope falls.
      this.tranceDust.length = Math.max(
        targetDust,
        this.tranceDust.length - Math.max(1, Math.ceil((this.tranceDust.length - targetDust) * 0.06))
      );
    }

    const dustPosition = (dust, progress) => {
      const travel = 1 - progress;
      const anchor = armPointAt(dust.armIndex % armCount, travel, dust.laneOffset);
      const loose = 0.18 + travel * 0.82;
      const angle = anchor.angle + dust.angularScatter * loose;
      const radius = anchor.radius + dust.radialScatter * loose;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
    };

    const dustGroups = armColors.map(() => []);
    for (const dust of this.tranceDust) {
      const acceleration = 0.72 + dust.progress * dust.progress * 3.2;
      dust.progress += deltaMs * (0.000026 + Math.pow(sectionDrive, 1.68) * 0.00062)
        * dust.speed * acceleration * dustFlowScale;
      if (dust.progress >= 1) {
        dust.progress %= 1;
        dust.armIndex = Math.floor(Math.random() * armCount);
        dust.laneOffset = Math.random() * 2 - 1;
        dust.angularScatter = (Math.random() * 2 - 1) * dustScatter;
        dust.radialScatter = (Math.random() * 2 - 1) * 11;
        dust.colorIndex = dust.armIndex;
        dust.depth = Math.random();
      }
      const point = dustPosition(dust, dust.progress);
      const tail = dustPosition(dust, Math.max(0, dust.progress - 0.018 - dust.progress * 0.012));
      // Live dust used to refill the cached arm's feathered outer edge,
      // especially in Psytrance where its density is higher. Apply the same
      // radial handoff to every moving mote and its short trail.
      const tailFeather = 1 - smoothstep(72, 110, Math.hypot(point.x, point.y));
      const inwardGlow = smoothstep(0.28, 0.94, dust.progress);
      const twinkle = 0.72 + Math.sin(time * 0.0023 + dust.twinkle) * 0.28;
      const alpha = clamp(
        0.055
          + Math.pow(sectionDrive, 1.42) * 0.36
          + particleImpactLift * 0.9
      )
        * (0.62 + inwardGlow * 0.74) * twinkle * tailFeather;
      if (alpha <= 0.002) continue;
      dustGroups[dust.colorIndex % armColors.length].push({
        point,
        tail,
        alpha,
        radius: dust.size * (0.62 + inwardGlow * 0.54)
      });
    }

    // Batch the dust by its three arm colours. The previous implementation
    // issued a shadowed stroke and fill for every particle (up to 112 native
    // canvas calls per frame in Psytrance); batching retains individual paths
    // and sizes while reducing that to six compositing calls.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `brightness(${1 + particleImpactLift * 0.42})`;
    dustGroups.forEach((group, colorIndex) => {
      if (!group.length) return;
      const color = armColors[colorIndex];
      const averageAlpha = group.reduce((sum, dust) => sum + dust.alpha, 0) / group.length;
      ctx.shadowColor = color;
      ctx.shadowBlur = 2.2
        + Math.pow(sectionDrive, 1.35) * 8
        + particleImpactLift * 25;
      ctx.strokeStyle = rgba(color, averageAlpha * 0.82);
      ctx.lineWidth = 0.92;
      ctx.beginPath();
      group.forEach(({ point, tail }) => {
        ctx.moveTo(tail.x, tail.y);
        ctx.quadraticCurveTo((tail.x + point.x) * 0.5, (tail.y + point.y) * 0.5, point.x, point.y);
      });
      ctx.stroke();
      ctx.fillStyle = rgba(color, averageAlpha);
      ctx.beginPath();
      group.forEach(({ point, radius, alpha }) => {
        const twinkleScale = 0.78 + clamp(alpha / Math.max(0.001, averageAlpha), 0.45, 1.45) * 0.22;
        ctx.moveTo(point.x + radius * twinkleScale, point.y);
        ctx.arc(point.x, point.y, radius * twinkleScale, 0, TAU);
      });
      ctx.fill();
    });
    ctx.restore();
  }

  drawTranceBackdropExtensions(x, y, theme, metrics) {
    if (document.body.dataset.backgroundStyle !== 'themed') return;
    const backdrop = this.tranceBackdropCtx;
    const pixelWidth = this.tranceBackdropCanvas.width;
    const pixelHeight = this.tranceBackdropCanvas.height;
    backdrop.setTransform(1, 0, 0, 1, 0, 0);
    backdrop.clearRect(0, 0, pixelWidth, pixelHeight);
    backdrop.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    backdrop.save();

    // Keep the Canvas extension inside the same themed stock as the CSS
    // backdrop. Drawing it here, rather than in a pseudo-element, makes the
    // extension share the foreground vortex's exact coordinate system.
    backdrop.beginPath();
    if (document.body.dataset.layout === 'poster') {
      backdrop.roundRect(16, 16, this.width - 32, this.height - 32, 24);
    } else {
      backdrop.roundRect(54, 48, this.width - 162, this.height - 96, 152);
    }
    backdrop.clip();
    backdrop.translate(x, y);

    const psychedelic = theme.id === 'psytrance';
    const progressive = theme.id === 'progressive-trance';
    const direction = 1;
    const armCount = psychedelic ? 12 : 8;
    const armCurl = progressive ? 3.25 : 3.65;
    const armPhaseOffsets = Array.from({ length: armCount }, (_, index) => {
      const base = index / armCount;
      return (base + Math.sin(index * 2.17 + (psychedelic ? 0.7 : 0.2)) * 0.018 + 1) % 1;
    });
    const armReachOffsets = Array.from(
      { length: armCount },
      (_, index) => 3.5 + Math.sin(index * 1.73 + 0.4) * 8
    );
    const armWeightScales = Array.from(
      { length: armCount },
      (_, index) => 0.72 + (Math.sin(index * 2.31 + 1.1) + 1) * 0.14
    );
    const mainArmStride = psychedelic ? 3 : 2;
    const mainArms = Array.from(
      { length: 4 },
      (_, index) => index * mainArmStride
    );
    const farthestX = Math.max(x, this.width - x);
    const farthestY = Math.max(y, this.height - y);
    const maxRadius = Math.hypot(farthestX, farthestY) + 48;
    const sectionDrive = smoothstep(0.24, 0.78, clamp(this.tranceEnergy));
    const impact = Math.pow(clamp(metrics.kickPulse || 0), 0.72);
    const laneOffset = 0.05;
    const armRotation = direction * this.tranceArmPhase;
    backdrop.rotate(armRotation);
    backdrop.globalCompositeOperation = 'screen';
    backdrop.lineJoin = 'round';

    const traceExtension = (armIndex, widthScale) => {
      const innerRadius = 30;
      const outerRadius = 105 + laneOffset * 2.5
        + armReachOffsets[armIndex] * 0.72;
      const radialRatio = Math.max(1.02, outerRadius / innerRadius);
      const endTravel = Math.log(maxRadius / innerRadius) / Math.log(radialRatio);
      const startTravel = 0.7;
      const steps = Math.max(64, Math.ceil((endTravel - startTravel) * 42));
      const outer = [];
      const inner = [];
      const centers = [];
      for (let step = 0; step <= steps; step += 1) {
        const travel = startTravel + (endTravel - startTravel) * (step / steps);
        const angle = armPhaseOffsets[armIndex] * TAU
          - direction * (
            travel * (armCurl + (armIndex % 2 ? -0.045 : 0.035))
            + laneOffset * 0.1
          );
        const radius = innerRadius * Math.pow(radialRatio, travel);
        centers.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          travel
        });
      }
      centers.forEach((point, index) => {
        const previous = centers[Math.max(0, index - 1)];
        const next = centers[Math.min(centers.length - 1, index + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const nx = -dy / length;
        const ny = dx / length;
        const widthEnvelope = 0.48 + Math.pow(point.travel, 0.72) * 0.9;
        const halfWidth = widthScale * widthEnvelope;
        outer.push({ x: point.x + nx * halfWidth, y: point.y + ny * halfWidth });
        inner.push({ x: point.x - nx * halfWidth, y: point.y - ny * halfWidth });
      });
      backdrop.beginPath();
      outer.forEach((point, index) => {
        if (!index) backdrop.moveTo(point.x, point.y);
        else backdrop.lineTo(point.x, point.y);
      });
      for (let index = inner.length - 1; index >= 0; index -= 1) {
        backdrop.lineTo(inner[index].x, inner[index].y);
      }
      backdrop.closePath();
    };

    mainArms.forEach((armIndex, index) => {
      const color = [theme.accent, theme.accent2, theme.hot][index % 3];
      const widthScale = (psychedelic ? 7.2 : 8.4) * armWeightScales[armIndex];
      const fill = backdrop.createRadialGradient(0, 0, 72, 0, 0, maxRadius);
      fill.addColorStop(0, rgba(color, 0));
      fill.addColorStop(Math.min(0.18, 82 / maxRadius), rgba(color, 0));
      fill.addColorStop(Math.min(0.24, 108 / maxRadius), rgba(color, 0.032));
      fill.addColorStop(Math.min(0.33, 145 / maxRadius), rgba(color, 0.105 + sectionDrive * 0.035));
      fill.addColorStop(0.72, rgba(color, 0.072 + sectionDrive * 0.028));
      fill.addColorStop(1, rgba(color, 0));

      traceExtension(armIndex, widthScale * 1.8);
      backdrop.fillStyle = fill;
      backdrop.filter = 'blur(6px)';
      backdrop.globalAlpha = 0.55 + sectionDrive * 0.12 + impact * 0.035;
      backdrop.fill('evenodd');

      traceExtension(armIndex, widthScale);
      backdrop.filter = 'blur(1.4px)';
      backdrop.globalAlpha = 0.72 + sectionDrive * 0.12 + impact * 0.035;
      backdrop.fill('evenodd');
    });
    backdrop.restore();

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.drawImage(this.tranceBackdropCanvas, 0, 0, this.width, this.height);
    ctx.restore();
  }

  drawTranceStardustVortex(x, y, theme, metrics, time, spectrum) {
    const ctx = this.ctx;
    const pulse = clamp(metrics.rhythmPulse || 0);
    const psychedelic = theme.id === 'psytrance';
    const progressive = theme.id === 'progressive-trance';
    const direction = 1;
    const rawEnergy = clamp(metrics.volume * 0.3 + metrics.mid * 0.46 + metrics.high * 0.24);
    const deltaMs = this.tranceLastAt ? clamp(time - this.tranceLastAt, 4, 36) : 16.667;
    this.tranceLastAt = time;
    const energyResponse = rawEnergy > this.tranceEnergy ? 0.11 : 0.036;
    this.tranceEnergy += (rawEnergy - this.tranceEnergy) * energyResponse * (deltaMs / 16.667);
    const energy = clamp(this.tranceEnergy);
    const flowSpeed = (psychedelic ? 0.00022 : progressive ? 0.000135 : 0.00017)
      + energy * 0.000072 + pulse * 0.000028;
    this.tranceFlowPhase = (this.tranceFlowPhase + deltaMs * flowSpeed) % 1;
    const flowPhase = this.tranceFlowPhase * TAU;

    const wavePoints = spectrum?.outer || [];
    const waveSamples = wavePoints.map((point) => ({
      angle: point.angle ?? Math.atan2(point.y - y, point.x - x),
      radius: Math.hypot(point.x - x, point.y - y),
      spectrum: point.spectrum || 0
    }));
    const waveMean = waveSamples.length
      ? waveSamples.reduce((sum, point) => sum + point.radius, 0) / waveSamples.length
      : 86;
    const sampleWave = (angle) => {
      if (!waveSamples.length) return { radius: waveMean, spectrum: energy };
      const ratio = ((angle + Math.PI / 2) % TAU + TAU) % TAU / TAU;
      const position = ratio * waveSamples.length;
      const low = Math.floor(position) % waveSamples.length;
      const high = (low + 1) % waveSamples.length;
      const mix = position - Math.floor(position);
      return {
        radius: waveSamples[low].radius * (1 - mix) + waveSamples[high].radius * mix,
        spectrum: waveSamples[low].spectrum * (1 - mix) + waveSamples[high].spectrum * mix
      };
    };

    // The artwork becomes the shadow of the black hole. A dark gravitational
    // well behind it increases depth without painting over the DOM artwork.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    const well = ctx.createRadialGradient(0, 0, 37, 0, 0, waveMean + 32);
    well.addColorStop(0, 'rgba(0, 0, 4, .48)');
    well.addColorStop(0.28, 'rgba(0, 0, 7, .34)');
    well.addColorStop(0.58, rgba(theme.accent2, 0.035 + energy * 0.025));
    well.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = well;
    ctx.beginPath();
    ctx.arc(0, 0, waveMean + 33, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Turn the live waveform into the body of an accretion disc. It is a
    // broad filled film with no ridge/cord: frequency peaks drag sideways via
    // spectrumPoints(), and this glow occupies the same moving contour.
    if (waveSamples.length) {
      const outer = waveSamples.map((point, index) => {
        const turbulence = Math.sin(point.angle * (psychedelic ? 6 : 4) - flowPhase * 1.2 + index * 0.035)
          * (1.15 + energy * 2.2);
        const radius = point.radius + 8.5 + turbulence + pulse * 2.2;
        return { x: Math.cos(point.angle) * radius, y: Math.sin(point.angle) * radius };
      });
      const inner = [...waveSamples].reverse().map((point, index) => {
        const turbulence = Math.sin(point.angle * (psychedelic ? 5 : 3) - flowPhase + index * 0.027)
          * (0.55 + energy * 1.1);
        const radius = point.radius - 11.5 + turbulence;
        return { x: Math.cos(point.angle) * radius, y: Math.sin(point.angle) * radius };
      });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${(2.2 + energy * 2.5).toFixed(2)}px)`;
      this.traceBand(outer, inner, true);
      const disk = ctx.createConicGradient(direction * flowPhase * 0.24 - Math.PI / 2, 0, 0);
      disk.addColorStop(0, rgba(theme.accent, 0.02));
      disk.addColorStop(0.12, rgba(theme.accent, 0.28 + energy * 0.2));
      disk.addColorStop(0.3, rgba(theme.hot, 0.055 + pulse * 0.08));
      disk.addColorStop(0.47, rgba(theme.accent2, 0.25 + energy * 0.18));
      disk.addColorStop(0.68, rgba(theme.accent2, 0.018));
      disk.addColorStop(0.84, rgba(theme.accent, 0.2 + energy * 0.14));
      disk.addColorStop(1, rgba(theme.accent, 0.02));
      ctx.fillStyle = disk;
      ctx.shadowColor = theme.accent2;
      ctx.shadowBlur = 18 + energy * 18 + pulse * 8;
      ctx.globalAlpha = 0.58 + energy * 0.26;
      ctx.fill('evenodd');
      ctx.restore();
    }

    // A soft photon ring defines the event horizon. It is a filled annulus,
    // not another stroked circle, and breathes with the same audio energy.
    const horizon = 49.5 + energy * 1.4 + pulse * 1.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${(1.25 + pulse * 1.4).toFixed(2)}px)`;
    ctx.beginPath();
    ctx.arc(0, 0, horizon + 3.4, 0, TAU);
    ctx.arc(0, 0, Math.max(1, horizon - 2.1), 0, TAU, true);
    const photon = ctx.createConicGradient(direction * flowPhase * 0.42, 0, 0);
    photon.addColorStop(0, rgba(theme.accent2, 0.1));
    photon.addColorStop(0.22, rgba(theme.hot, 0.54 + pulse * 0.2));
    photon.addColorStop(0.46, rgba(theme.accent, 0.2 + energy * 0.2));
    photon.addColorStop(0.72, rgba(theme.accent2, 0.42 + energy * 0.2));
    photon.addColorStop(1, rgba(theme.accent2, 0.1));
    ctx.fillStyle = photon;
    ctx.shadowColor = theme.accent2;
    ctx.shadowBlur = 16 + energy * 15;
    ctx.fill('evenodd');
    ctx.restore();

    // Keep most particles inside coherent density lanes. Varying the pitch too
    // much makes the field read as a generic orbital halo instead of spiral
    // arms, especially at the visualizer's compact desktop-pet size.
    const targetDust = psychedelic ? 260 : 224;
    const armCount = psychedelic ? 4 : 3;
    while (this.tranceDust.length < targetDust) {
      const armIndex = Math.floor(Math.random() * armCount);
      const freeDust = Math.random() < 0.07;
      this.tranceDust.push({
        progress: Math.random(),
        seed: Math.random() * TAU,
        armIndex,
        armScatter: (Math.random() + Math.random() + Math.random() - 1.5) * (psychedelic ? 0.2 : 0.145),
        freeDust,
        depth: Math.random(),
        speed: 0.78 + Math.random() * 0.85,
        size: 0.5 + Math.random() * 1.15,
        colorIndex: Math.floor(Math.random() * 3),
        twinkle: Math.random() * TAU,
        lastX: null,
        lastY: null
      });
    }
    if (this.tranceDust.length > targetDust) this.tranceDust.length = targetDust;

    const positionFor = (dust, progress) => {
      const turns = (psychedelic ? 1.76 : progressive ? 1.14 : 1.38) + dust.depth * 0.12;
      const armBase = dust.freeDust
        ? dust.seed
        : dust.armIndex / armCount * TAU + dust.armScatter;
      const angle = armBase + direction * (
        progress * turns * TAU
        + flowPhase * (0.22 + dust.depth * 0.025)
        + Math.sin(flowPhase * 0.42 + dust.seed) * 0.055
      );
      const localWave = sampleWave(angle);
      const outerRadius = localWave.radius + 38 + dust.depth * 18 + energy * 8;
      const innerRadius = horizon - 1 + dust.depth * 3;
      const inward = Math.pow(progress, 0.73);
      const radius = innerRadius + (outerRadius - innerRadius) * (1 - inward);
      const flatten = 0.92 + dust.depth * 0.05;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * flatten,
        angle,
        radius,
        spectrum: localWave.spectrum
      };
    };

    const colors = [theme.accent, theme.accent2, theme.hot];

    // A faint bed of overlapping dust motes makes the arm density legible at
    // desktop-pet scale. It deliberately avoids a stroked spiral path: each
    // arm is still perceived as particulate stardust, and it shares the same
    // spectrum-coupled position field as the moving foreground particles.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${(2.8 + energy * 1.7).toFixed(2)}px)`;
    for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
      const guideDust = {
        freeDust: false,
        seed: 0,
        armIndex,
        armScatter: 0,
        depth: 0.28
      };
      const color = colors[armIndex % colors.length];
      ctx.fillStyle = rgba(color, 0.032 + energy * 0.055 + pulse * 0.012);
      ctx.shadowColor = color;
      ctx.shadowBlur = 10 + energy * 15;
      ctx.beginPath();
      for (let step = 0; step <= 48; step += 1) {
        const progress = step / 48;
        const point = positionFor(guideDust, progress);
        const envelope = Math.pow(Math.sin(Math.PI * progress), 0.58);
        const moteRadius = 1.25 + envelope * (2 + energy * 1.8);
        ctx.moveTo(point.x + moteRadius, point.y);
        ctx.arc(point.x, point.y, moteRadius, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'none';
    for (const dust of this.tranceDust) {
      const acceleration = 0.62 + dust.progress * dust.progress * 4.4 + pulse * 0.38;
      dust.progress += deltaMs * (0.00007 + energy * 0.00008) * dust.speed * acceleration;
      let reset = false;
      if (dust.progress >= 1) {
        dust.progress %= 1;
        dust.seed = Math.random() * TAU;
        dust.armIndex = Math.floor(Math.random() * armCount);
        dust.armScatter = (Math.random() + Math.random() + Math.random() - 1.5) * (psychedelic ? 0.2 : 0.145);
        dust.freeDust = Math.random() < 0.07;
        dust.depth = Math.random();
        reset = true;
      }
      const point = positionFor(dust, dust.progress);
      const twinkle = 0.68 + 0.32 * Math.sin(time * (0.002 + dust.depth * 0.0018) + dust.twinkle);
      const inwardGlow = smoothstep(0.24, 0.94, dust.progress);
      const armPresence = dust.freeDust ? 0.54 : 1;
      const alpha = (0.18 + energy * 0.4 + pulse * 0.1)
        * (0.54 + inwardGlow * 0.82)
        * twinkle
        * armPresence;
      const color = colors[dust.colorIndex];
      if (!reset) {
        const trailBack = 0.006 + inwardGlow * 0.022 + energy * 0.007;
        const trailProgress = Math.max(0, dust.progress - trailBack);
        const trailPoint = positionFor(dust, trailProgress);
        const middlePoint = positionFor(dust, (dust.progress + trailProgress) * 0.5);
        const trailDistance = Math.hypot(point.x - trailPoint.x, point.y - trailPoint.y);
        if (trailDistance < 34) {
          ctx.strokeStyle = rgba(color, alpha * (0.68 + inwardGlow * 0.78));
          ctx.lineWidth = 0.32 + dust.size * 0.38 + inwardGlow * (0.42 + energy * 0.42);
          ctx.shadowColor = color;
          ctx.shadowBlur = 5 + energy * 11 + inwardGlow * 7;
          ctx.beginPath();
          ctx.moveTo(trailPoint.x, trailPoint.y);
          ctx.quadraticCurveTo(middlePoint.x, middlePoint.y, point.x, point.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(color, alpha * 0.9);
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 + energy * 9;
      if (!dust.freeDust && dust.depth < 0.42) {
        ctx.fillStyle = rgba(color, alpha * 0.075);
        ctx.beginPath();
        ctx.arc(point.x, point.y, dust.size * (2.8 + energy * 1.8), 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(color, alpha * 0.9);
      }
      ctx.beginPath();
      ctx.arc(point.x, point.y, dust.size * (0.72 + inwardGlow * 0.78 + pulse * 0.2), 0, TAU);
      ctx.fill();
      dust.lastX = point.x;
      dust.lastY = point.y;
    }
    ctx.restore();
  }

  drawGenreSignature(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const mode = theme.mode || 'electronic';
    const pulse = metrics.rhythmPulse || 0;
    const spectrum = this.lastSpectrum;
    const signatureDrive = clamp(0.28 + metrics.volume * 0.34 + metrics.mid * 0.2 + pulse * 0.34);
    // Keep the signature just outside the spectrum's average body so its
    // language remains legible instead of dissolving into internal ridges.
    const radius = (spectrum?.baseRadius || 68) + 22 + metrics.volume * 2;
    ctx.save();
    ctx.translate(x, y);
    const integratedTranceFx = mode === 'trance'
      && theme.family !== 'classical'
      && !['soundtrack', 'synthwave'].includes(theme.id);
    const integratedRnbFx = mode === 'rnb' && [
      'rnb', 'contemporary-rnb', 'alternative-rnb', 'neo-soul',
      'new-jack-swing', 'soul', 'gospel', 'funk', 'blues'
    ].includes(theme.id);
    const integratedAmbientFx = mode === 'ambient';
    const integratedExperimentalFx = mode === 'experimental';
    const integratedHipHopFx = mode === 'hip-hop'
      && ['hip-hop', 'experimental-hip-hop', 'instrumental-hip-hop', 'lo-fi-hip-hop'].includes(theme.id);
    const integratedPhonkFx = mode === 'phonk';
    const integratedEdmTrapFx = mode === 'trap'
      && ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(theme.id);
    // The Trance signature owns the entire vortex. Keep its geometry at a
    // fixed scale; audio may alter its light and angular speed, but never make
    // the whole spiral pump in and out.
    const signatureScale = mode === 'bilibili'
      ? 1
      : integratedTranceFx
      ? 1
      : integratedPhonkFx
        ? 1 + metrics.bass * 0.004 + pulse * 0.007
        : 1 + metrics.mid * 0.008 + pulse * 0.014;
    ctx.scale(signatureScale, signatureScale);
    ctx.globalCompositeOperation = 'lighter';
    // Applying a CSS-like Canvas filter to the parent context forces the
    // complete Trance vortex through an offscreen surface. Its own materials
    // already modulate brightness and colour with the same drive, so this
    // wrapper pass was redundant and could turn one missed frame into three.
    ctx.filter = integratedTranceFx
      ? 'none'
      : `brightness(${(1.01 + signatureDrive * 0.08).toFixed(3)}) saturate(${(1.03 + signatureDrive * 0.1).toFixed(3)})`;

    const signatureStroke = (color, width, blur, alpha) => this.strokeGlow(
      color,
      width * (1.02 + signatureDrive * 0.12),
      blur + 1 + signatureDrive * 2,
      Math.min(0.82, alpha * 1.12 + signatureDrive * 0.035)
    );
    const beatPeriod = metrics.bpm >= 45 && metrics.bpm <= 260 ? 60000 / metrics.bpm : 500;
    const beatPhase = (time % beatPeriod) / beatPeriod;

    // Most modes use a quiet circular bezel. Hard Dance replaces it below
    // with a spectrum-derived pressure chamber so it does not fight the shell.
    if (!['bilibili', 'hardcore', 'hardstyle', 'trance', 'garage', 'latin'].includes(mode)
      && !integratedRnbFx
      && !integratedAmbientFx
      && !integratedExperimentalFx
      && !integratedHipHopFx
      && !integratedPhonkFx
      && !integratedEdmTrapFx) {
      signatureStroke(theme.accent2, 0.85, 9, 0.16 + metrics.mid * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, 51 + metrics.bass * 3, 0, TAU);
      ctx.stroke();
    }

    const drawBasslineRail = ({
      steps = 8, rate = 0.003, phaseStep = 0.7, gatePower = 1.35,
      span = 0.62, reach = 10, width = 1.6, offset = -7,
      floor = 0.22, wobble = 0, reverse = false
    } = {}) => {
      const bassDrive = clamp((metrics.bass || 0) * 0.5 + (metrics.lowMid || 0) * 0.2 + (metrics.bassPulse || 0) * 0.78);
      const chase = time * rate * (reverse ? -1 : 1);
      for (let step = 0; step < steps; step += 1) {
        const angle = step / steps * TAU - Math.PI / 2;
        const bin = 3 + Math.floor(step / steps * 34);
        const band = clamp((metrics.frequency?.[bin] || 0) / 255);
        const gateBase = 0.5 + 0.5 * Math.sin(chase - step * phaseStep);
        const gate = floor + (1 - floor) * Math.pow(Math.max(0, gateBase), gatePower);
        const shapedBass = band * 0.58 + bassDrive * 0.42;
        const displacement = shapedBass * reach * gate
          + Math.sin(chase * 0.63 + step * 1.7) * wobble * bassDrive;
        const railRadius = radius + offset + 2 + displacement;
        const arcSpan = TAU / steps * span;
        signatureStroke(
          step % 2 ? theme.accent2 : theme.accent,
          width + bassDrive * width * 0.72,
          10 + bassDrive * 9,
          0.13 + band * 0.23 + bassDrive * 0.24
        );
        ctx.beginPath();
        ctx.arc(0, 0, railRadius, angle - arcSpan * 0.5, angle + arcSpan * 0.5);
        ctx.stroke();
      }
    };

    const spectrumContour = ({
      scale = 1, offset = 0, shiftX = 0, shiftY = 0,
      phase = 0, lobes = 0, waveAmount = 0,
      teeth = 0, toothThreshold = 0.7, toothAmount = 0
    } = {}) => (spectrum?.outer || []).map((point) => {
      const sourceX = point.x - x;
      const sourceY = point.y - y;
      const sourceAngle = Math.atan2(sourceY, sourceX) + phase;
      const sourceRadius = Math.hypot(sourceX, sourceY);
      const wave = lobes ? Math.sin(sourceAngle * lobes + time * 0.0014) * waveAmount : 0;
      const toothSignal = teeth
        ? Math.max(0, (Math.cos(sourceAngle * teeth + time * 0.0005) - toothThreshold) / Math.max(0.01, 1 - toothThreshold))
        : 0;
      const contourRadius = sourceRadius * scale + offset + wave + toothSignal * toothAmount;
      return {
        x: Math.cos(sourceAngle) * contourRadius + shiftX,
        y: Math.sin(sourceAngle) * contourRadius + shiftY
      };
    });

    const spectrumShell = ({ scale = 0.72, detail = 0.3, offset = 0, smoothing = 4 } = {}) => {
      const source = (spectrum?.outer || []).map((point) => {
        const px = point.x - x;
        const py = point.y - y;
        return { angle: Math.atan2(py, px), radius: Math.hypot(px, py) };
      });
      if (source.length < 3) return [];
      const smoothed = source.map((point, index) => {
        let total = 0;
        let weightTotal = 0;
        for (let shift = -smoothing; shift <= smoothing; shift += 1) {
          const weight = smoothing + 1 - Math.abs(shift);
          total += source[(index + shift + source.length) % source.length].radius * weight;
          weightTotal += weight;
        }
        return total / Math.max(1, weightTotal);
      });
      const mean = smoothed.reduce((sum, value) => sum + value, 0) / smoothed.length;
      return source.map((point, index) => {
        const shellRadius = mean * scale + (smoothed[index] - mean) * detail + offset;
        return { x: Math.cos(point.angle) * shellRadius, y: Math.sin(point.angle) * shellRadius };
      });
    };

    const strokeContourSegment = (points, centerRatio, spanRatio) => {
      if (points.length < 3) return;
      const center = Math.round(centerRatio * points.length) % points.length;
      const half = Math.max(1, Math.round(points.length * spanRatio * 0.5));
      ctx.beginPath();
      for (let offset = -half; offset <= half; offset += 1) {
        const point = points[(center + offset + points.length) % points.length];
        if (offset === -half) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    };

    const strokeAngularContour = (points, centerAngle, angularSpan) => {
      if (points.length < 3) return;
      const candidates = points
        .map((point) => ({
          point,
          delta: Math.atan2(
            Math.sin(Math.atan2(point.y, point.x) - centerAngle),
            Math.cos(Math.atan2(point.y, point.x) - centerAngle)
          )
        }))
        .filter(({ delta }) => Math.abs(delta) <= angularSpan * 0.5)
        .sort((left, right) => left.delta - right.delta);
      if (candidates.length < 2) return;
      ctx.beginPath();
      candidates.forEach(({ point }, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    };

    const drawHardDanceArrows = ({ family, contact = 0, release = 0 } = {}) => {
      const hardcore = family === 'hardcore';
      const gentle = hardcore && ['happy-hardcore', 'uk-hardcore'].includes(theme.id);
      const puzzy = hardcore && theme.id === 'puzzycore';
      const uptempo = hardcore && theme.id === 'uptempo-hardcore';
      const gabber = hardcore && theme.id === 'gabber';
      const frenchcore = hardcore && theme.id === 'frenchcore';
      const industrial = hardcore && theme.id === 'industrial-hardcore';
      const raw = !hardcore && theme.id === 'rawstyle';
      const euphoric = !hardcore && theme.id === 'euphoric-hardstyle';
      const count = hardcore
        ? gentle ? 8 : puzzy ? 12 : uptempo ? 16 : frenchcore ? 12 : industrial ? 10 : 14
        : raw ? 8 : euphoric ? 5 : 6;
      const rotationSpeed = hardcore
        ? theme.id === 'happy-hardcore' ? -0.000026
          : gentle ? 0.00003
            : puzzy ? -0.00009
              : uptempo ? 0.000075
                : frenchcore ? 0.000082
                  : industrial ? 0.000028
                    : gabber ? 0.000046 : 0.00006
        : raw ? -0.000036 : euphoric ? -0.000018 : -0.00003;
      const rotation = time * rotationSpeed + (hardcore ? 0 : Math.PI / count);
      // The arrow rail mirrors the same contact-compression/release motion as
      // the spectrum and chamber, while remaining a fixed-radius overlay that
      // visibly crosses the translucent waveform.
      const railRadius = radius
        - contact * (gentle ? 1.35 : hardcore ? 2.8 : raw ? 2.35 : 1.9)
        + release * (gentle ? 0.65 : hardcore ? 1.35 : 1.05);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = gentle ? 'round' : 'butt';
      ctx.lineJoin = hardcore && !gentle ? 'miter' : 'round';
      for (let arrowIndex = 0; arrowIndex < count; arrowIndex += 1) {
        const staticOffset = hardcore && !gentle
          ? (Math.abs(Math.sin((arrowIndex + 1) * 31.731)) - 0.5) * (puzzy ? 0.008 : 0.006)
          : 0;
        const sway = Math.sin(time * 0.00105 + arrowIndex * 1.73)
          * (gentle ? 0.0012 : hardcore ? 0.0032 : 0.0015)
          * (0.32 + release * 0.68);
        const angle = arrowIndex / count * TAU + rotation + staticOffset + sway;
        const color = hardcore
          ? arrowIndex % 3 ? theme.accent : theme.accent2
          : arrowIndex % 2 ? theme.accent2 : theme.accent;
        if (hardcore) {
          const length = (gentle ? 3 : puzzy ? 4.5 : industrial ? 7 : gabber ? 6.5 : frenchcore ? 5 : 6)
            + release * (gentle ? 9 : puzzy ? 23 : industrial ? 14 : gabber ? 16 : frenchcore ? 17 : 19)
            + contact * (gentle ? 1.2 : 2.6)
            + (arrowIndex % 3 === 0 ? metrics.high * (gentle ? 5 : puzzy ? 10 : 7) : 0)
            + (!gentle && arrowIndex % 2 === 0 ? metrics.bass * 4 : 0);
          signatureStroke(
            color,
            (gentle ? 0.72 : 0.82) + release * (gentle ? 0.62 : 0.82) + contact * 0.22,
            gentle ? 7 : 8,
            (gentle ? 0.11 : 0.135) + release * (gentle ? 0.17 : 0.22) + contact * 0.06
          );
          ctx.beginPath();
          if (gentle) {
            ctx.moveTo(Math.cos(angle) * railRadius, Math.sin(angle) * railRadius);
            ctx.lineTo(Math.cos(angle) * (railRadius + length), Math.sin(angle) * (railRadius + length));
          } else {
            const halfBase = (puzzy ? 0.017 : industrial ? 0.04 : gabber ? 0.034 : frenchcore ? 0.022 : 0.026)
              + release * (puzzy ? 0.01 : industrial ? 0.009 : gabber ? 0.011 : 0.014);
            const lean = (arrowIndex % 2 ? 1 : -1)
              * ((puzzy ? 0.02 : industrial ? 0.006 : gabber ? 0.009 : frenchcore ? 0.018 : 0.012)
                + release * (puzzy ? 0.03 : industrial ? 0.012 : gabber ? 0.016 : 0.022));
            const inner = railRadius - 1.5 - release * 0.65;
            const tip = railRadius + length;
            ctx.moveTo(Math.cos(angle - halfBase) * inner, Math.sin(angle - halfBase) * inner);
            ctx.lineTo(Math.cos(angle + lean) * tip, Math.sin(angle + lean) * tip);
            ctx.lineTo(Math.cos(angle + halfBase) * inner, Math.sin(angle + halfBase) * inner);
          }
          ctx.stroke();
        } else {
          const wing = (raw ? 0.05 : euphoric ? 0.075 : 0.055) + metrics.high * (euphoric ? 0.015 : 0.025);
          const inner = railRadius - 1;
          const tip = railRadius + (euphoric ? 5 : 7) + release * (raw ? 16 : euphoric ? 10 : 14) + contact * 2.1
            + (arrowIndex % 2 ? 0 : metrics.bass * 6);
          signatureStroke(
            color,
            (euphoric ? 1.08 : 0.88) + release * (euphoric ? 0.62 : 0.84) + contact * 0.18,
            euphoric ? 11 : 8,
            (euphoric ? 0.17 : 0.14) + release * (euphoric ? 0.18 : 0.22) + contact * 0.05
          );
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle - wing) * inner, Math.sin(angle - wing) * inner);
          ctx.lineTo(Math.cos(angle) * tip, Math.sin(angle) * tip);
          ctx.lineTo(Math.cos(angle + wing) * inner, Math.sin(angle + wing) * inner);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const strokeSpectrumContour = (points, smooth = false) => {
      if (points.length < 3) return;
      this.tracePoints(points, true, smooth);
      ctx.stroke();
    };

    const localSpectrumPointAtAngle = (targetAngle) => {
      const points = spectrum?.outer || [];
      if (!points.length) {
        return { x: Math.cos(targetAngle) * radius, y: Math.sin(targetAngle) * radius };
      }
      let nearest = points[0];
      let nearestDelta = Infinity;
      for (const point of points) {
        const pointAngle = Math.atan2(point.y - y, point.x - x);
        const delta = Math.abs(Math.atan2(Math.sin(pointAngle - targetAngle), Math.cos(pointAngle - targetAngle)));
        if (delta < nearestDelta) {
          nearest = point;
          nearestDelta = delta;
        }
      }
      return { x: nearest.x - x, y: nearest.y - y };
    };

    if (mode === 'asmr') {
      const breath = 0.5 + 0.5 * Math.sin(time * 0.00062);
      const softDrive = clamp(metrics.volume * 0.34 + metrics.mid * 0.43 + metrics.high * 0.23);
      const localWave = (spectrum?.outer || []).map((point) => ({ x: point.x - x, y: point.y - y }));
      const mistInner = localWave.map((point) => ({ x: point.x * (1.025 + breath * 0.006), y: point.y * (1.025 + breath * 0.006) }));
      const mistOuter = localWave.map((point) => ({ x: point.x * (1.105 + breath * 0.012 + softDrive * 0.01), y: point.y * (1.105 + breath * 0.012 + softDrive * 0.01) }));
      if (mistInner.length && mistOuter.length) {
        this.traceBand(mistOuter, [...mistInner].reverse(), true);
        ctx.fillStyle = rgba(theme.accent2, 0.018 + breath * 0.012 + softDrive * 0.018);
        ctx.fill('evenodd');
      }
      for (let halo = 0; halo < 4; halo += 1) {
        const scale = 1.035 + halo * 0.065 + breath * (0.008 + halo * 0.004);
        const haloWave = localWave.map((point) => ({ x: point.x * scale, y: point.y * scale }));
        signatureStroke(
          halo % 2 ? theme.accent2 : theme.accent,
          0.68 + halo * 0.12,
          16 + halo * 6,
          0.07 + (3 - halo) * 0.014 + breath * 0.042 + softDrive * 0.025
        );
        strokeSpectrumContour(haloWave, true);
      }
      for (let mote = 0; mote < 13; mote += 1) {
        const drift = time * (0.000055 + (mote % 3) * 0.000008) + mote * 1.91;
        const moteRadius = radius + 15 + (mote % 4) * 8 + Math.sin(drift * 1.7) * 3;
        const moteX = Math.cos(drift) * moteRadius;
        const rise = Math.sin(time * 0.00018 + mote * 1.37) * 9;
        const moteY = Math.sin(drift) * moteRadius * 0.72 - 4 + rise;
        const shimmer = 0.5 + 0.5 * Math.sin(drift * 2.3);
        ctx.fillStyle = rgba(mote % 2 ? theme.accent2 : theme.hot, 0.11 + shimmer * 0.16 + softDrive * 0.035);
        ctx.shadowColor = mote % 2 ? theme.accent2 : theme.accent;
        ctx.shadowBlur = 10 + shimmer * 8;
        ctx.beginPath();
        ctx.arc(moteX, moteY, 0.72 + shimmer * 0.9, 0, TAU);
        ctx.fill();
      }
    } else if (mode === 'bilibili') {
      const frameWidth = 174;
      const frameHeight = 112;
      const frameLeft = -frameWidth * 0.5;
      const frameTop = -frameHeight * 0.5;
      const activity = this.bilibiliVoiceActivity;
      const section = this.bilibiliSectionDrive;
      const transient = this.bilibiliTransientDrive;
      const response = clamp(activity * 0.12 + section * 0.2 + transient * 0.34);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.scale(this.bilibiliTvScaleX, this.bilibiliTvScaleY);

      const antennaTop = frameTop - 25;
      const antennaBaseY = frameTop + 1;
      ctx.strokeStyle = '#40505e';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-14, antennaBaseY);
      ctx.lineTo(-38, antennaTop);
      ctx.moveTo(14, antennaBaseY);
      ctx.lineTo(40, antennaTop - 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.roundRect(frameLeft, frameTop, frameWidth, frameHeight, 22);
      const panel = ctx.createLinearGradient(frameLeft, frameTop, -frameLeft, -frameTop);
      panel.addColorStop(0, '#ffffff');
      panel.addColorStop(0.58, '#f4f4f4');
      panel.addColorStop(1, '#e7f7fc');
      ctx.fillStyle = panel;
      ctx.shadowColor = 'rgba(35, 173, 229, .24)';
      ctx.shadowBlur = 12 + response * 3;
      ctx.fill();

      const frameStroke = ctx.createLinearGradient(frameLeft, 0, -frameLeft, 0);
      frameStroke.addColorStop(0, theme.accent);
      frameStroke.addColorStop(1, theme.accent2);
      ctx.strokeStyle = frameStroke;
      ctx.lineWidth = 3.05 + response * 0.3;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.roundRect(frameLeft, frameTop, frameWidth, frameHeight, 22);
      ctx.stroke();

      const progressY = frameTop + frameHeight - 14;
      const progressWidth = 112;
      const playhead = clamp(0.1 + activity * 0.06 + section * 0.62 + transient * 0.26);
      ctx.strokeStyle = 'rgba(64, 80, 94, .16)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-progressWidth * 0.5, progressY);
      ctx.lineTo(progressWidth * 0.5, progressY);
      ctx.stroke();
      const progressGradient = ctx.createLinearGradient(-progressWidth * 0.5, 0, progressWidth * 0.5, 0);
      progressGradient.addColorStop(0, theme.accent);
      progressGradient.addColorStop(1, theme.accent2);
      ctx.strokeStyle = progressGradient;
      ctx.lineWidth = 2.4 + response * 0.24;
      ctx.shadowColor = rgba(theme.accent2, 0.45);
      ctx.shadowBlur = 4 + response * 2;
      ctx.beginPath();
      ctx.moveTo(-progressWidth * 0.5, progressY);
      ctx.lineTo(-progressWidth * 0.5 + progressWidth * playhead, progressY);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-progressWidth * 0.5 + progressWidth * playhead, progressY, 2.3 + response * 0.22, 0, TAU);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(-65, progressY, 2.1 + response * 0.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (mode === 'hardcore') {
      const cheerful = theme.id === 'happy-hardcore';
      const uk = theme.id === 'uk-hardcore';
      const puzzy = theme.id === 'puzzycore';
      const gentle = cheerful || uk;
      const attack = Math.pow(pulse, 0.8);
      const contact = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? 0)
        : 0;
      const pressureOuter = spectrumShell({
        scale: (gentle ? 0.74 : 0.7) - contact * (gentle ? 0.012 : 0.026) + attack * 0.01,
        detail: gentle ? 0.34 : 0.43,
        offset: gentle ? 2 : 3,
        smoothing: gentle ? 6 : 4
      });
      const pressureInner = spectrumShell({
        scale: (gentle ? 0.66 : 0.62) - contact * (gentle ? 0.008 : 0.018) + attack * 0.007,
        detail: gentle ? 0.22 : 0.28,
        offset: gentle ? 1 : 2,
        smoothing: gentle ? 7 : 5
      });
      if (pressureOuter.length && pressureInner.length) {
        this.traceBand(pressureOuter, [...pressureInner].reverse(), true);
        ctx.fillStyle = rgba(theme.accent, (gentle ? 0.022 : 0.034) + contact * 0.06 + attack * 0.025);
        ctx.fill('evenodd');
      }
      // The chamber is carried by the translucent band. Avoid tracing its
      // inner edge again: the main spectrum, chamber and impact ring should
      // not read as three copies of the same contour.
      // Shared Hard Dance language: an inner pressure membrane and separate
      // outward Kick arrows. Hardcore keeps more and sharper arrows.
      drawHardDanceArrows({ family: 'hardcore', contact, release: attack });
      // Puzzycore keeps its piep identity, but needles only exist during the
      // kick release and never become a permanent decorative crown.
      if (puzzy && attack > 0.055) {
        for (let needle = 0; needle < 10; needle += 1) {
          const angle = needle / 10 * TAU - Math.PI / 2;
          const membrane = localSpectrumPointAtAngle(angle);
          const membraneRadius = Math.max(1, Math.hypot(membrane.x, membrane.y));
          const length = attack * (9 + (needle % 2) * 5);
          signatureStroke(needle % 2 ? theme.accent2 : theme.hot, 0.5 + attack * 0.9, 10, attack * 0.22);
          ctx.beginPath();
          ctx.moveTo(membrane.x, membrane.y);
          ctx.lineTo(
            membrane.x + membrane.x / membraneRadius * length,
            membrane.y + membrane.y / membraneRadius * length
          );
          ctx.stroke();
        }
      }
    } else if (mode === 'hardstyle') {
      // Hardstyle shares Hardcore's pressure chamber, but four symmetrical
      // load bridges make it more engineered and regular than Hardcore.
      const raw = theme.id === 'rawstyle';
      const euphoric = theme.id === 'euphoric-hardstyle';
      const attack = Math.pow(pulse, 0.82);
      const contact = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? 0)
        : 0;
      const pressureOuter = spectrumShell({
        scale: 0.72 - contact * (raw ? 0.022 : euphoric ? 0.009 : 0.015) + attack * 0.008,
        detail: raw ? 0.42 : euphoric ? 0.3 : 0.36,
        offset: 3,
        smoothing: raw ? 3 : 5
      });
      const pressureInner = spectrumShell({
        scale: 0.64 - contact * (raw ? 0.015 : 0.009) + attack * 0.005,
        detail: raw ? 0.3 : 0.22,
        offset: 2,
        smoothing: raw ? 4 : 6
      });
      if (pressureOuter.length && pressureInner.length) {
        this.traceBand(pressureOuter, [...pressureInner].reverse(), true);
        ctx.fillStyle = rgba(theme.accent2, 0.026 + contact * 0.055 + attack * 0.022);
        ctx.fill('evenodd');
      }
      // Hardstyle keeps the same outward arrow language with fewer, broader
      // shapes, so it remains related without looking as needle-sharp.
      drawHardDanceArrows({ family: 'hardstyle', contact, release: attack });
    } else if (mode === 'latin') {
      // Latin is treated as a broad rhythmic family rather than one literal
      // clave. A spectrum-following body membrane carries three linked layers:
      // low-end body sway, complementary syncopated accents and fine hand-
      // percussion texture. Every mark stays on the same live contour.
      const rhythmHit = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? 0)
        : 0;
      const body = clamp(
        metrics.bass * 0.36
          + metrics.lowMid * 0.38
          + (metrics.bassPulse || 0) * 0.38
          + rhythmHit * 0.14
      );
      const percussion = clamp(
        metrics.mid * 0.38
          + metrics.high * 0.2
          + metrics.flux * 0.26
          + rhythmHit * 0.24
      );
      const groove = clamp(body * 0.56 + percussion * 0.44);
      const phrase = time / Math.max(280, beatPeriod);
      const sway = Math.sin(phrase * Math.PI) * (1.4 + groove * 3.9);
      const outerBase = spectrumShell({
        scale: 0.965,
        detail: 0.72,
        offset: 1.8 + body * 2.2,
        smoothing: 3
      });
      const innerBase = spectrumShell({
        scale: 0.745,
        detail: 0.3,
        offset: 2,
        smoothing: 6
      });
      const shapeLatinPoint = (point, index, inner = false) => {
        const angle = Math.atan2(point.y, point.x);
        const pointRadius = Math.max(1, Math.hypot(point.x, point.y));
        const bodyWave = Math.sin(angle * 3 - phrase * 1.08)
          * body * (inner ? 0.72 : 2.85);
        const handWave = Math.sin(angle * 5 + phrase * 1.62 + index * 0.012)
          * percussion * (inner ? 0.46 : 1.2);
        const radiusWithGroove = pointRadius + bodyWave + handWave;
        const sideWeight = 0.24 + Math.abs(Math.sin(angle)) * 0.76;
        return {
          x: Math.cos(angle) * radiusWithGroove + sway * sideWeight,
          y: Math.sin(angle) * radiusWithGroove
        };
      };
      const outer = outerBase.map((point, index) => shapeLatinPoint(point, index, false));
      const inner = innerBase.map((point, index) => shapeLatinPoint(point, index, true));
      if (outer.length && inner.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const membrane = ctx.createLinearGradient(-radius, radius, radius, -radius);
        membrane.addColorStop(0, rgba(theme.accent, 0.04 + body * 0.09));
        membrane.addColorStop(0.48, rgba(theme.hot, 0.045 + groove * 0.08));
        membrane.addColorStop(1, rgba(theme.accent2, 0.035 + percussion * 0.09));
        this.traceBand(outer, [...inner].reverse(), true);
        ctx.fillStyle = membrane;
        ctx.fill('evenodd');

        signatureStroke(
          theme.accent,
          0.78 + body * 0.72 + rhythmHit * 0.34,
          9 + body * 10,
          0.1 + body * 0.2 + rhythmHit * 0.08
        );
        this.tracePoints(outer, true, true);
        ctx.stroke();
        signatureStroke(
          theme.accent2,
          0.58 + percussion * 0.62,
          7 + percussion * 8,
          0.075 + percussion * 0.17
        );
        this.tracePoints(inner, true, true);
        ctx.stroke();

        // Twelve positions express an interlocking, syncopated percussion
        // puzzle without claiming that every Latin subgenre uses one clave.
        // The warm body accents and cool hand-percussion accents occupy
        // complementary slots and travel together around the live membrane.
        const bodySteps = new Set([0, 3, 5, 8, 10]);
        const handSteps = new Set([1, 4, 6, 9, 11]);
        const loopTravel = (phrase / 4) % 1;
        const circularDistance = (left, right) => {
          const distance = Math.abs(left - right);
          return Math.min(distance, 1 - distance);
        };
        for (let step = 0; step < 12; step += 1) {
          const offset = step % 2 ? 0.012 : 0;
          const center = (step / 12 + offset) % 1;
          const active = Math.exp(-((circularDistance(loopTravel, center) / 0.055) ** 2));
          const bodyStep = bodySteps.has(step);
          const handStep = handSteps.has(step);
          const stepDrive = bodyStep ? body : handStep ? percussion : groove * 0.34;
          const color = bodyStep ? theme.accent : handStep ? theme.accent2 : theme.hot;
          signatureStroke(
            color,
            (bodyStep ? 1.18 : handStep ? 0.9 : 0.54)
              + stepDrive * 0.6 + active * 0.76,
            6 + stepDrive * 5 + active * 9,
            0.085 + stepDrive * 0.16 + active * 0.22
          );
          strokeContourSegment(
            outer,
            center,
            bodyStep ? 0.068 + body * 0.014 : handStep ? 0.045 : 0.026
          );
        }

        // Fine paired ticks sit across the membrane seam like concise hand-
        // percussion strokes. Their tangential lean creates swing without an
        // unrelated detached particle ring.
        for (let tick = 0; tick < 6; tick += 1) {
          const centerRatio = (tick / 6 + 0.028 + Math.sin(phrase * 1.15 + tick) * 0.006) % 1;
          const index = Math.round(centerRatio * outer.length) % outer.length;
          const outerPoint = outer[index];
          const innerPoint = inner[index];
          const dx = outerPoint.x - innerPoint.x;
          const dy = outerPoint.y - innerPoint.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const tangentX = -dy / length;
          const tangentY = dx / length;
          const lean = (tick % 2 ? -1 : 1) * (2.2 + percussion * 2.8);
          signatureStroke(
            tick % 2 ? theme.accent2 : theme.hot,
            0.76 + percussion * 0.52,
            6 + percussion * 6,
            0.1 + percussion * 0.18
          );
          ctx.beginPath();
          ctx.moveTo(innerPoint.x - tangentX * lean, innerPoint.y - tangentY * lean);
          ctx.lineTo(outerPoint.x + tangentX * lean, outerPoint.y + tangentY * lean);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (mode === 'house') {
      const electro = ['electro-house', 'complextro', 'big-room-house', 'dutch-house', 'fidget-house', 'melbourne-bounce'].includes(theme.id);
      const acid = theme.id === 'acid-house';
      const future = theme.id === 'future-house';
      const progressive = theme.id === 'progressive-house';
      const techHouse = theme.id === 'tech-house';
      const deepHouse = theme.id === 'deep-house';
      const melodicHouse = theme.id === 'melodic-house';
      const tropicalHouse = theme.id === 'tropical-house';
      const afroHouse = theme.id === 'afro-house';
      const amapiano = theme.id === 'amapiano';
      const frenchHouse = theme.id === 'french-house';
      const discoHouse = theme.id === 'disco-house';
      const hardHouse = theme.id === 'hard-house';
      const progressiveLayers = progressive ? this.progressiveHouseLayers : [0, 0, 0];
      const progressiveLift = progressive
        ? progressiveLayers.reduce((sum, value) => sum + value, 0) / progressiveLayers.length
        : 0;
      const futureBounce = future ? clamp(this.futureHouseBounce, -0.6, 1.1) : 0;
      const futureBody = future
        ? clamp(metrics.bass * 0.34 + metrics.lowMid * 0.34 + metrics.mid * 0.2 + (metrics.bassPulse || 0) * 0.52)
        : 0;
      const futureStab = future
        ? clamp(this.futureHouseStabOffset * 0.76 + Math.max(0, futureBounce) * 0.48 + futureBody * 0.2 + pulse * 0.24)
        : 0;
      // Four-on-the-floor remains one continuous groove. A broad highlight
      // travels from lobe to lobe over four beats, recovering the playful
      // chase without turning the membrane back into four hard panels.
      const wave = (spectrum?.outer || []).map((point) => ({ x: point.x - x, y: point.y - y }));
      if (wave.length > 8) {
        const chasePosition = (time / beatPeriod) % 4;
        // Four broad membrane patches use the real spectrum as their outer
        // edge. Nothing traces a second complete ring: the chase is literally
        // painted onto the waveform and its inner depth forms the four lobes.
        for (let quarter = 0; quarter < 4; quarter += 1) {
          const chaseDistance = Math.abs(chasePosition - quarter);
          const wrappedDistance = Math.min(chaseDistance, 4 - chaseDistance);
          const chase = Math.exp(-wrappedDistance * wrappedDistance * (
            future ? 3.4 : techHouse ? 2.8 : progressive ? 1.35 : 2.25
          ));
          // Preserve a quiet four-lobe footprint between beats. At compact
          // sizes a zero-floor chase collapses back into a generic circle and
          // House loses its four-on-the-floor identity entirely.
          const lobeFloor = progressive ? 0.06 : techHouse ? 0.1 : 0.14;
          const lobePresence = lobeFloor + chase * (1 - lobeFloor);
          let lobeAngle = -Math.PI / 2 + quarter * Math.PI / 2;
          if (future) {
            // A detected bass/chord stab nudges the active petal sideways,
            // alternating direction on each hit to create syncopated bounce.
            lobeAngle += this.futureHouseStabDirection
              * this.futureHouseStabOffset * 0.055 * (0.64 + chase * 0.36);
          }
          const color = quarter % 2 ? theme.accent2 : theme.accent;
          let centerIndex = 0;
          let nearestDelta = Infinity;
          for (let index = 0; index < wave.length; index += 1) {
            const pointAngle = Math.atan2(wave[index].y, wave[index].x);
            const delta = Math.abs(Math.atan2(Math.sin(pointAngle - lobeAngle), Math.cos(pointAngle - lobeAngle)));
            if (delta < nearestDelta) {
              nearestDelta = delta;
              centerIndex = index;
            }
          }
          const halfSpan = Math.max(2, Math.round(wave.length * (
            future
              ? 0.094 + chase * 0.014
              : techHouse
                ? 0.087 + chase * 0.009
                : progressive ? 0.075 + chase * 0.008 : 0.105 + chase * 0.012
          )));
          const outer = [];
          const inner = [];
          for (let offset = -halfSpan; offset <= halfSpan; offset += 1) {
            const point = wave[(centerIndex + offset + wave.length) % wave.length];
            const normalized = offset / Math.max(1, halfSpan);
            const lobeShape = Math.pow(
              Math.max(0, Math.cos(normalized * Math.PI / 2)),
              future ? 1.2 : techHouse ? 1.7 : progressive ? 1.15 : 1.45
            );
            const outerScale = 1
              + lobeShape * lobePresence * (0.004 + pulse * 0.004)
              + (future ? lobeShape * (futureBounce * 0.018 + futureStab * chase * 0.012) : 0)
              + (progressive ? lobeShape * (progressiveLift * 0.006 + progressiveLayers[0] * chase * 0.0025) : 0);
            const depth = (progressive ? 0.048 : techHouse ? 0.076 : 0.09)
              + lobeShape * (
                progressive
                  ? 0.012 + metrics.mid * 0.006
                  : techHouse ? 0.026 + metrics.bass * 0.013 : 0.035 + metrics.bass * 0.016
              )
              + lobeShape * lobePresence * (
                progressive ? 0.006 + pulse * 0.003 : techHouse ? 0.013 + pulse * 0.007 : 0.018 + pulse * 0.012
              )
              + (future ? lobeShape * (Math.max(0, futureBounce) * 0.025 + futureStab * chase * 0.018) : 0);
            outer.push({ x: point.x * outerScale, y: point.y * outerScale });
            inner.push({ x: point.x * (1 - depth), y: point.y * (1 - depth) });
          }
          ctx.save();
          // Keep the chasing petal in the House palette. Brightness comes from
          // additive alpha and glow, not from bleaching the lobe to white.
          const highlightColor = color;
          ctx.filter = 'blur(1.05px)';
          ctx.fillStyle = rgba(
            highlightColor,
            progressive
              ? 0.014 + lobePresence * 0.075 + progressiveLift * 0.035 + pulse * chase * 0.025
              : techHouse
                ? 0.018 + lobePresence * 0.165 + pulse * chase * 0.065
                : 0.024 + lobePresence * 0.235 + pulse * chase * 0.13 + (future ? futureStab * chase * 0.065 : 0)
          );
          ctx.shadowColor = highlightColor;
          ctx.shadowBlur = progressive
            ? 7 + chase * 7 + progressiveLift * 5 + pulse * chase * 2
            : techHouse
              ? 7 + chase * 11 + pulse * chase * 4
              : 8 + chase * 17 + pulse * chase * 9 + (future ? futureStab * chase * 8 : 0);
          ctx.beginPath();
          for (let index = 0; index < outer.length; index += 1) {
            const point = outer[index];
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          }
          for (let index = inner.length - 1; index >= 0; index -= 1) {
            const point = inner[index];
            ctx.lineTo(point.x, point.y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          if (progressive) {
            // Keep House's four-beat chase as a moving highlight rather than
            // four connected outlines, leaving the melodic layers to define
            // the silhouette and preventing a rigid rounded-square shell.
            const trim = Math.max(1, Math.round(outer.length * (0.29 - chase * 0.1)));
            signatureStroke(
              highlightColor,
              0.58 + chase * 0.48 + progressiveLift * 0.18,
              7 + chase * 7 + progressiveLift * 4,
              0.035 + chase * 0.15 + progressiveLift * 0.045 + pulse * chase * 0.025
            );
            ctx.beginPath();
            for (let index = trim; index < outer.length - trim; index += 1) {
              const point = outer[index];
              if (index === trim) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
          } else {
            signatureStroke(
              highlightColor,
              0.78 + lobePresence * 1.16 + pulse * chase * 0.76 + (future ? futureStab * chase * 0.38 : 0),
              9 + lobePresence * 15 + pulse * chase * 8.5 + (future ? futureStab * chase * 6 : 0),
              0.065 + lobePresence * 0.31 + pulse * chase * 0.18 + (future ? futureStab * chase * 0.08 : 0)
            );
            ctx.beginPath();
            for (let index = 0; index < outer.length; index += 1) {
              const point = outer[index];
              if (index === 0) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
          }
          if (future && chase > 0.04 && outer.length > 8) {
            // A narrow chrome glint is the visual chord stab. It lives on the
            // active membrane edge, flashes briefly, and never becomes a
            // second free-standing ring.
            const trim = Math.max(2, Math.round(outer.length * (0.25 - futureStab * 0.045)));
            signatureStroke(
              theme.hot,
              0.48 + futureStab * 0.9 + pulse * 0.28,
              11 + futureStab * 10,
              0.025 + chase * 0.07 + futureStab * chase * 0.2
            );
            ctx.beginPath();
            for (let index = trim; index < outer.length - trim; index += 1) {
              const point = outer[index];
              if (index === trim) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
          }
        }
        if (techHouse) {
          // Tech House fuses the soft four-petal House membrane above with a
          // restrained Techno conveyor. The belt is cut from the live spectrum
          // itself, so its repeating cells and bass compression remain one body
          // with the waveform instead of forming a detached machine ring.
          const bassGroove = clamp(
            metrics.bass * 0.43
              + metrics.lowMid * 0.3
              + metrics.mid * 0.11
              + (metrics.bassPulse || 0) * 0.38
          );
          const percussion = clamp(metrics.mid * 0.28 + metrics.high * 0.32 + metrics.flux * 0.28);
          const stepPosition = (time / beatPeriod * 2) % 8;
          const groovePhase = time / beatPeriod * Math.PI;
          const beltOuter = spectrumShell({
            scale: 0.982 - pulse * 0.0045,
            detail: 0.54,
            offset: 0.8,
            smoothing: 4
          });
          const beltInnerBase = spectrumShell({
            scale: 0.79 - pulse * 0.006,
            detail: 0.16,
            offset: 1.2,
            smoothing: 7
          });
          const beltInner = beltInnerBase.map((point) => {
            const angle = Math.atan2(point.y, point.x);
            const pointRadius = Math.max(1, Math.hypot(point.x, point.y));
            const cam = Math.sin(angle * 4 - groovePhase) * (0.42 + bassGroove * 1.45);
            const radiusWithGroove = pointRadius + cam;
            return {
              x: Math.cos(angle) * radiusWithGroove,
              y: Math.sin(angle) * radiusWithGroove
            };
          });
          if (beltOuter.length && beltInner.length) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const beltFill = ctx.createRadialGradient(0, 0, radius * 0.54, 0, 0, radius + 16);
            beltFill.addColorStop(0, rgba(theme.accent2, 0.025 + bassGroove * 0.025));
            beltFill.addColorStop(0.56, rgba(theme.accent2, 0.045 + bassGroove * 0.055));
            beltFill.addColorStop(1, rgba(theme.accent, 0.07 + bassGroove * 0.075));
            this.traceBand(beltOuter, [...beltInner].reverse(), true);
            ctx.fillStyle = beltFill;
            ctx.fill('evenodd');

            signatureStroke(
              theme.accent,
              0.72 + bassGroove * 0.4,
              7 + bassGroove * 7,
              0.095 + bassGroove * 0.13 + pulse * 0.055
            );
            this.tracePoints(beltOuter, true, true);
            ctx.stroke();
            signatureStroke(
              theme.accent2,
              0.64 + bassGroove * 0.32,
              6 + bassGroove * 5,
              0.075 + bassGroove * 0.105
            );
            this.tracePoints(beltInner, true, true);
            ctx.stroke();

            const beltLength = beltOuter.length;
            const cellHalf = Math.max(3, Math.round(beltLength * 0.035));
            for (let cell = 0; cell < 8; cell += 1) {
              const distance = Math.abs(stepPosition - cell);
              const wrappedDistance = Math.min(distance, 8 - distance);
              const active = Math.exp(-wrappedDistance * wrappedDistance * 3.7);
              const primaryBeat = cell % 2 === 0;
              const color = primaryBeat ? theme.accent : theme.accent2;
              const center = Math.round(cell / 8 * beltLength) % beltLength;
              const cellOuter = [];
              const cellInner = [];
              for (let offset = -cellHalf; offset <= cellHalf; offset += 1) {
                const index = (center + offset + beltLength) % beltLength;
                const normalized = offset / Math.max(1, cellHalf);
                const envelope = Math.max(0, Math.cos(normalized * Math.PI / 2)) ** 1.55;
                const outerPoint = beltOuter[index];
                const innerPoint = beltInner[index];
                const outerScale = 1 + envelope * active * (0.0045 + bassGroove * 0.0065);
                const innerScale = 1 - envelope * active * (0.002 + bassGroove * 0.0035);
                cellOuter.push({ x: outerPoint.x * outerScale, y: outerPoint.y * outerScale });
                cellInner.push({ x: innerPoint.x * innerScale, y: innerPoint.y * innerScale });
              }
              ctx.beginPath();
              cellOuter.forEach((point, index) => {
                if (!index) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              for (let index = cellInner.length - 1; index >= 0; index -= 1) {
                ctx.lineTo(cellInner[index].x, cellInner[index].y);
              }
              ctx.closePath();
              ctx.fillStyle = rgba(
                color,
                (primaryBeat ? 0.035 : 0.022)
                  + bassGroove * 0.045
                  + active * (0.12 + bassGroove * 0.1)
              );
              ctx.shadowColor = color;
              ctx.shadowBlur = 4 + active * 10 + percussion * active * 4;
              ctx.fill();

              signatureStroke(
                color,
                0.62 + active * 0.48,
                5 + active * 8,
                (primaryBeat ? 0.055 : 0.035)
                  + active * 0.17
                  + percussion * active * 0.08
              );
              ctx.beginPath();
              cellOuter.forEach((point, index) => {
                if (!index) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
              });
              ctx.stroke();

              if (primaryBeat) {
                // Four restrained drive bridges connect the mechanical belt's
                // two seams. They inherit the active step rather than flashing
                // independently, tying Techno repetition to House's four floor.
                const middle = Math.floor(cellOuter.length / 2);
                signatureStroke(
                  theme.accent2,
                  0.94 + active * 0.54,
                  6 + active * 8,
                  0.115 + bassGroove * 0.075 + active * 0.24
                );
                ctx.beginPath();
                ctx.moveTo(cellInner[middle].x, cellInner[middle].y);
                ctx.lineTo(cellOuter[middle].x, cellOuter[middle].y);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        }
        if (progressive) {
          // Progressive House unfolds three long melodic ribbons from the live
          // House membrane. Each ribbon follows a slower envelope than the one
          // inside it, so increasing section energy reveals depth in sequence;
          // on release they linger instead of collapsing on a single kick.
          const flowPhase = this.progressiveHouseFlow * TAU;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let layer = 0; layer < progressiveLayers.length; layer += 1) {
            const layerEnergy = clamp(progressiveLayers[layer]);
            const revealStart = [0.025, 0.11, 0.19][layer];
            const layerReveal = smoothstep(revealStart, revealStart + 0.24, layerEnergy);
            const layerPresence = layer === 0
              ? 0.3 + layerReveal * 0.7
              : 0.035 + layerReveal * 0.965;
            const arcSpan = 1.92 + layer * 0.22 + layerReveal * 1.03 + progressiveLift * 0.24;
            const arcCenter = -Math.PI / 2
              + Math.sin(flowPhase + layer * 0.38) * (0.075 + layer * 0.012);
            const samples = 48;
            const outerRibbon = [];
            const innerRibbon = [];
            const centerRibbon = [];
            for (let sample = 0; sample <= samples; sample += 1) {
              const ratio = sample / samples;
              const angle = arcCenter - arcSpan * 0.5 + ratio * arcSpan;
              const membrane = localSpectrumPointAtAngle(angle);
              const membraneRadius = Math.max(1, Math.hypot(membrane.x, membrane.y));
              const endEnvelope = Math.sin(ratio * Math.PI) ** 0.58;
              const melodicCrest = Math.sin(ratio * Math.PI) * (1.5 + metrics.mid * 4.2)
                + Math.sin(angle * 2 - flowPhase * 1.25 + layer * 1.35)
                  * (0.45 + metrics.high * 1.3) * endEnvelope;
              const ribbonRadius = membraneRadius
                + 6 + layer * 8.1
                + layerReveal * (6.5 + layer * 1.5)
                + melodicCrest;
              const halfWidth = endEnvelope * (
                1.2 + layerReveal * 3 + progressiveLift * 0.55
              );
              const radialX = Math.cos(angle);
              const radialY = Math.sin(angle);
              centerRibbon.push({ x: radialX * ribbonRadius, y: radialY * ribbonRadius });
              outerRibbon.push({
                x: radialX * (ribbonRadius + halfWidth),
                y: radialY * (ribbonRadius + halfWidth)
              });
              innerRibbon.push({
                x: radialX * (ribbonRadius - halfWidth),
                y: radialY * (ribbonRadius - halfWidth)
              });
            }
            const start = centerRibbon[0];
            const end = centerRibbon[centerRibbon.length - 1];
            const ribbonGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
            ribbonGradient.addColorStop(0, rgba(theme.accent2, 0));
            ribbonGradient.addColorStop(0.14, rgba(theme.accent2, 0.11 + layerEnergy * 0.13));
            ribbonGradient.addColorStop(0.5, rgba(theme.hot, 0.2 + layerEnergy * 0.25));
            ribbonGradient.addColorStop(0.86, rgba(theme.accent, 0.11 + layerEnergy * 0.13));
            ribbonGradient.addColorStop(1, rgba(theme.accent, 0));
            ctx.beginPath();
            outerRibbon.forEach((point, index) => {
              if (!index) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            });
            for (let index = innerRibbon.length - 1; index >= 0; index -= 1) {
              ctx.lineTo(innerRibbon[index].x, innerRibbon[index].y);
            }
            ctx.closePath();
            ctx.filter = `blur(${(0.45 + layer * 0.14 + layerEnergy * 0.42).toFixed(2)}px)`;
            ctx.fillStyle = ribbonGradient;
            ctx.shadowColor = layer === 1 ? theme.hot : layer === 2 ? theme.accent : theme.accent2;
            ctx.shadowBlur = 8 + layerReveal * 12 + progressiveLift * 5;
            ctx.globalAlpha = layerPresence * (0.78 + layerReveal * 0.2);
            ctx.fill('evenodd');

            // A narrow crest keeps each broad band legible as one continuous
            // melodic phrase without turning the layer into another full ring.
            ctx.filter = 'none';
            ctx.strokeStyle = ribbonGradient;
            ctx.lineWidth = 0.72 + layerReveal * 0.72;
            ctx.shadowBlur = 4 + layerReveal * 7;
            ctx.globalAlpha = layerPresence * (0.68 + layerReveal * 0.24);
            ctx.beginPath();
            centerRibbon.forEach((point, index) => {
              if (!index) ctx.moveTo(point.x, point.y);
              else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
          ctx.restore();
        }
        if (future) {
          // Four compact chrome pads are suspended directly on the House
          // petals. The active pad lands on the live waveform, squashes
          // tangentially, then springs back with the shared bounce state.
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let pad = 0; pad < 4; pad += 1) {
            const chaseDistance = Math.abs(chasePosition - pad);
            const wrappedDistance = Math.min(chaseDistance, 4 - chaseDistance);
            const landing = Math.exp(-wrappedDistance * wrappedDistance * 4.2);
            const angle = -Math.PI / 2 + pad * Math.PI / 2
              + this.futureHouseStabDirection * this.futureHouseStabOffset * 0.052
                * (0.6 + landing * 0.4);
            const membrane = localSpectrumPointAtAngle(angle);
            const membraneRadius = Math.max(1, Math.hypot(membrane.x, membrane.y));
            const padImpulse = clamp(
              this.futureHouseStabOffset * landing + Math.max(0, futureBounce) * 0.48
            );
            const padDrive = clamp(0.12 + landing * 0.24 + padImpulse * 0.72);
            const squash = clamp(padImpulse * 0.82 + Math.max(0, futureBounce) * 0.28);
            const reboundStretch = clamp(Math.max(0, -futureBounce) * 1.45);
            const centerRadius = membraneRadius - 4.8
              + futureBounce * 3.8
              + padImpulse * 3.7;
            const centerX = Math.cos(angle) * centerRadius;
            const centerY = Math.sin(angle) * centerRadius;
            const tangentHalf = 5 + landing * 1.05 + squash * 3.2 - reboundStretch * 0.35;
            const radialHalf = Math.max(
              1.2,
              1.7 + landing * 0.38 - squash * 0.38 + reboundStretch * 0.9
            );
            const radialX = Math.cos(angle);
            const radialY = Math.sin(angle);
            const gradient = ctx.createLinearGradient(
              centerX - radialX * radialHalf * 1.5,
              centerY - radialY * radialHalf * 1.5,
              centerX + radialX * radialHalf * 1.5,
              centerY + radialY * radialHalf * 1.5
            );
            const padColor = pad % 2 ? theme.accent2 : theme.accent;
            gradient.addColorStop(0, rgba(theme.accent2, 0.08 + padDrive * 0.14));
            gradient.addColorStop(0.52, rgba(theme.hot, 0.14 + padDrive * 0.45));
            gradient.addColorStop(1, rgba(padColor, 0.1 + padDrive * 0.28));
            ctx.fillStyle = gradient;
            ctx.shadowColor = padColor;
            ctx.shadowBlur = 7 + padDrive * 12;
            ctx.beginPath();
            ctx.ellipse(
              centerX,
              centerY,
              tangentHalf,
              radialHalf,
              angle + Math.PI / 2,
              0,
              TAU
            );
            ctx.fill();
            signatureStroke(
              padDrive > 0.52 ? theme.hot : padColor,
              0.42 + padDrive * 0.72,
              7 + padDrive * 9,
              0.07 + padDrive * 0.28
            );
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      if (theme.id === 'bass-house') {
        // Bass House keeps the four House membrane patches above, but replaces
        // the detached arc rail with a thick pressure belt grown from the live
        // waveform. Low-end energy changes the belt's mass, while low-mid and
        // mid energy twist its inner seam like an evolving bass sound design.
        const bassDrive = clamp(
          metrics.bass * 0.44
          + metrics.lowMid * 0.3
          + (metrics.bassPulse || 0) * 0.62
          + pulse * 0.18
        );
        const timbreDrive = clamp(
          metrics.lowMid * 0.46
          + metrics.mid * 0.34
          + metrics.high * 0.08
          + pulse * 0.2
        );
        const contact = metrics.rhythmNow
          ? clamp(metrics.rhythmStrength ?? metrics.impact ?? pulse)
          : pulse * 0.34;
        const phrase = time / Math.max(260, beatPeriod);
        const beltOuterBase = spectrumShell({
          scale: 0.925 - contact * 0.008,
          detail: 0.78,
          offset: 1.5 + bassDrive * 2.8,
          smoothing: 2
        });
        const beltInnerBase = spectrumShell({
          scale: 0.735 - contact * 0.018,
          detail: 0.32,
          offset: 2 + bassDrive * 1.1,
          smoothing: 6
        });
        const torquePoint = (point, index, inner = false) => {
          const angle = Math.atan2(point.y, point.x);
          const pointRadius = Math.hypot(point.x, point.y);
          const fourFloor = Math.max(0, Math.cos((angle + Math.PI / 2) * 4 - beatPhase * TAU));
          const growl = Math.sin(angle * 3 - phrase * 1.28 + Math.sin(phrase * 0.38) * 0.7);
          const cut = Math.sin(angle * 7 + phrase * 2.18 + index * 0.018);
          const displacement = inner
            ? growl * (0.75 + timbreDrive * 2.3) + cut * timbreDrive * 0.65
            : fourFloor ** 1.7 * bassDrive * 2.8 + growl * timbreDrive * 1.05;
          const shapedRadius = pointRadius + displacement;
          return { x: Math.cos(angle) * shapedRadius, y: Math.sin(angle) * shapedRadius };
        };
        const beltOuter = beltOuterBase.map((point, index) => torquePoint(point, index, false));
        const beltInner = beltInnerBase.map((point, index) => torquePoint(point, index, true));
        if (beltOuter.length && beltInner.length) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const beltGradient = ctx.createLinearGradient(-radius, -radius * 0.72, radius, radius * 0.72);
          beltGradient.addColorStop(0, rgba(theme.accent, 0.055 + bassDrive * 0.1));
          beltGradient.addColorStop(0.5, rgba(theme.accent2, 0.035 + timbreDrive * 0.09));
          beltGradient.addColorStop(1, rgba(theme.accent, 0.045 + bassDrive * 0.08));
          this.traceBand(beltOuter, [...beltInner].reverse(), true);
          ctx.fillStyle = beltGradient;
          ctx.fill('evenodd');

          signatureStroke(
            theme.accent,
            0.72 + bassDrive * 0.95 + contact * 0.42,
            10 + bassDrive * 13 + contact * 7,
            0.11 + bassDrive * 0.24 + contact * 0.14
          );
          this.tracePoints(beltOuter, true, true);
          ctx.stroke();

          // Four alternating pressure pockets preserve the House grid, but
          // their brightness and reach are driven by the bass body instead of
          // behaving like an independent sequencer ring.
          const pocketPosition = (time / beatPeriod) % 4;
          for (let quarter = 0; quarter < 4; quarter += 1) {
            const distance = Math.abs(pocketPosition - quarter);
            const wrapped = Math.min(distance, 4 - distance);
            const chase = Math.exp(-wrapped * wrapped * 3.15);
            const color = quarter % 2 ? theme.accent2 : theme.accent;
            signatureStroke(
              color,
              1.05 + bassDrive * 1.35 + chase * 0.72,
              12 + bassDrive * 12 + chase * 10,
              0.09 + bassDrive * 0.15 + chase * 0.22 + contact * chase * 0.13
            );
            strokeContourSegment(beltOuter, quarter / 4, 0.155 + bassDrive * 0.022);
          }

          // One continuous inner seam makes the changing bass timbre legible
          // without adding another detached orbit or a row of small fragments.
          signatureStroke(
            theme.accent2,
            0.66 + timbreDrive * 0.72,
            7 + timbreDrive * 10,
            0.075 + timbreDrive * 0.16
          );
          this.tracePoints(beltInner, true, true);
          ctx.stroke();
          ctx.restore();
        }
      } else if (['fidget-house', 'melbourne-bounce'].includes(theme.id)) {
        drawBasslineRail({
          steps: 9, rate: 0.0045, phaseStep: 1.08, gatePower: 1.8,
          span: 0.44, reach: 13, width: 1.45, offset: -11, floor: 0.14, wobble: 2.6
        });
      } else if (acid) {
        drawBasslineRail({
          steps: 10, rate: 0.0054, phaseStep: 0.58, gatePower: 1.5,
          span: 0.4, reach: 10, width: 1.25, offset: -11, floor: 0.16, wobble: 3.8
        });
      }
      if (deepHouse) {
        const lowContour = spectrumShell({ scale: 0.86, detail: 0.28, offset: 1.5, smoothing: 8 });
        const drift = ((time * 0.000018) % 1 + 1) % 1;
        for (const [index, center] of [drift, (drift + 0.5) % 1].entries()) {
          signatureStroke(
            index ? theme.accent2 : theme.accent,
            0.72 + metrics.bass * 0.48,
            12 + metrics.bass * 8,
            0.08 + metrics.bass * 0.13 + pulse * 0.035
          );
          strokeContourSegment(lowContour, center, 0.34);
        }
      } else if (melodicHouse) {
        const phrase = time * 0.000055;
        for (let voice = 0; voice < 3; voice += 1) {
          const contour = spectrumShell({
            scale: 0.82 + voice * 0.065,
            detail: 0.22 + voice * 0.12,
            offset: 1 + voice * 1.4,
            smoothing: 8 - voice
          });
          const center = (phrase + voice * 0.31) % 1;
          signatureStroke(
            [theme.accent2, theme.hot, theme.accent][voice],
            0.58 + metrics.mid * 0.44 + voice * 0.08,
            9 + metrics.mid * 7,
            0.06 + metrics.mid * 0.095 + pulse * 0.025
          );
          strokeContourSegment(contour, center, 0.34 + voice * 0.025);
        }
      } else if (tropicalHouse) {
        const breezeContour = spectrumShell({ scale: 0.91, detail: 0.36, offset: 2.5, smoothing: 7 });
        const breeze = ((time * 0.000032) % 1 + 1) % 1;
        for (let current = 0; current < 3; current += 1) {
          signatureStroke(
            current === 1 ? theme.hot : current ? theme.accent2 : theme.accent,
            0.62 + metrics.mid * 0.38,
            10 + metrics.mid * 7,
            0.065 + metrics.mid * 0.1 + pulse * 0.025
          );
          strokeContourSegment(breezeContour, (breeze + current / 3) % 1, 0.24);
        }
      } else if (afroHouse) {
        const percussionDrive = clamp(metrics.mid * 0.38 + metrics.high * 0.25 + metrics.flux * 0.32 + pulse * 0.2);
        const patternOffset = time / Math.max(260, beatPeriod) * 0.11;
        for (let strike = 0; strike < 9; strike += 1) {
          const uneven = strike / 9 * TAU + Math.sin(strike * 2.4) * 0.08 + patternOffset;
          const point = localSpectrumPointAtAngle(uneven);
          const pointRadius = Math.max(1, Math.hypot(point.x, point.y));
          const radialX = point.x / pointRadius;
          const radialY = point.y / pointRadius;
          const hand = 0.5 + 0.5 * Math.sin(strike * 2.1 - time * 0.0042);
          signatureStroke(
            strike % 3 ? theme.accent : theme.accent2,
            0.66 + hand * 0.72 + percussionDrive * 0.32,
            7 + hand * 9,
            0.065 + hand * 0.14 + percussionDrive * 0.08
          );
          ctx.beginPath();
          ctx.moveTo(point.x - radialX * (7 + hand * 2), point.y - radialY * (7 + hand * 2));
          ctx.lineTo(point.x + radialX * (2 + hand * 5), point.y + radialY * (2 + hand * 5));
          ctx.stroke();
        }
      } else if (amapiano) {
        const logDrive = clamp(metrics.bass * 0.54 + metrics.lowMid * 0.28 + (metrics.bassPulse || 0) * 0.62);
        const shuffle = time / Math.max(280, beatPeriod) * 0.72;
        for (let log = 0; log < 6; log += 1) {
          const ratio = log / 5;
          const angle = 0.12 * Math.PI + ratio * 0.76 * Math.PI;
          const point = localSpectrumPointAtAngle(angle);
          const pointRadius = Math.max(1, Math.hypot(point.x, point.y));
          const radialX = point.x / pointRadius;
          const radialY = point.y / pointRadius;
          const roll = Math.max(0, Math.sin(shuffle - log * 1.18)) ** 2.1;
          const length = 5 + logDrive * 7 + roll * 8;
          signatureStroke(
            log % 2 ? theme.accent2 : theme.accent,
            1.15 + logDrive * 0.75 + roll * 0.55,
            10 + logDrive * 10 + roll * 5,
            0.11 + logDrive * 0.15 + roll * 0.15
          );
          ctx.beginPath();
          ctx.moveTo(point.x - radialX * (length * 0.7), point.y - radialY * (length * 0.7));
          ctx.lineTo(point.x + radialX * (length * 0.3), point.y + radialY * (length * 0.3));
          ctx.stroke();
        }
      } else if (frenchHouse) {
        const sweep = ((time * 0.000085) % 1 + 1) % 1;
        for (let band = 0; band < 2; band += 1) {
          const contour = spectrumShell({ scale: 0.84 + band * 0.1, detail: 0.34 + band * 0.18, offset: band * 2, smoothing: 6 });
          signatureStroke(
            band ? theme.hot : theme.accent,
            0.78 + metrics.mid * 0.68,
            11 + metrics.mid * 10,
            0.08 + metrics.mid * 0.15 + pulse * 0.04
          );
          strokeContourSegment(contour, (sweep + band * 0.46) % 1, 0.31);
        }
      } else if (discoHouse) {
        const mirrorContour = spectrumShell({ scale: 0.94, detail: 0.52, offset: 1.5, smoothing: 4 });
        for (let mirror = 0; mirror < 8; mirror += 1) {
          const index = Math.round(mirror / 8 * mirrorContour.length) % Math.max(1, mirrorContour.length);
          const point = mirrorContour[index];
          if (!point) continue;
          const sparkle = 0.5 + 0.5 * Math.sin(time * 0.004 + mirror * 1.7);
          ctx.fillStyle = rgba(mirror % 2 ? theme.hot : theme.accent, 0.12 + sparkle * 0.25 + pulse * 0.08);
          ctx.shadowColor = mirror % 2 ? theme.hot : theme.accent2;
          ctx.shadowBlur = 7 + sparkle * 10;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 0.8 + sparkle * 1.35, 0, TAU);
          ctx.fill();
        }
      } else if (hardHouse) {
        const strikePhase = time / Math.max(240, beatPeriod) * 2;
        for (let strike = 0; strike < 8; strike += 1) {
          const angle = strike / 8 * TAU;
          const point = localSpectrumPointAtAngle(angle);
          const pointRadius = Math.max(1, Math.hypot(point.x, point.y));
          const radialX = point.x / pointRadius;
          const radialY = point.y / pointRadius;
          const active = Math.max(0, Math.cos(strikePhase * Math.PI - strike * Math.PI / 2)) ** 2.4;
          signatureStroke(
            strike % 2 ? theme.accent2 : theme.accent,
            0.82 + active * 1.1 + pulse * 0.42,
            7 + active * 10,
            0.08 + active * 0.22 + pulse * 0.1
          );
          ctx.beginPath();
          ctx.moveTo(point.x - radialX * 10, point.y - radialY * 10);
          ctx.lineTo(point.x + radialX * (3 + active * 7), point.y + radialY * (3 + active * 7));
          ctx.stroke();
        }
      } else if (acid) {
        const acidContour = spectrumShell({ scale: 0.9, detail: 0.68, offset: 1.5, smoothing: 3 });
        signatureStroke(theme.accent, 0.92 + metrics.mid * 0.68, 12, 0.1 + metrics.mid * 0.18 + pulse * 0.06);
        strokeContourSegment(acidContour, ((time * 0.00012) % 1 + 1) % 1, 0.28);
      }
      if (electro) {
        const electroRiff = ['electro-house', 'complextro'].includes(theme.id);
        if (electroRiff) {
          const complex = theme.id === 'complextro';
          const cells = complex ? 12 : 6;
          const cellArc = TAU / cells;
          const halfSpan = cellArc * (complex ? 0.29 : 0.32);
          const pairOffset = complex ? 0.23 * (TAU / 6) : 0;
          const groupHalfSpan = halfSpan + pairOffset;
          const gapLayout = genreTopFrequencyGap(theme);
          const parentAngles = distributeGroupsOutsideTopGap(
            6,
            gapLayout.topFrequencyGapRatio,
            groupHalfSpan
          );
          const phrase = time / Math.max(240, beatPeriod);
          const commonDrive = clamp(
            metrics.bass * 0.38
            + metrics.lowMid * 0.34
            + metrics.mid * 0.14
            + pulse * 0.34
          );
          const timbres = [metrics.bass, metrics.lowMid, metrics.mid, metrics.high];
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineJoin = complex ? 'bevel' : 'round';

          // Electro House and Complextro share one six-sector riff chassis
          // attached to the live House membrane. Electro House keeps each
          // sector broad and forceful; Complextro splits every parent sector
          // into two rapidly switching timbre cells.
          for (let index = 0; index < cells; index += 1) {
            const parent = complex ? Math.floor(index / 2) : index;
            const subOffset = complex ? (index % 2 ? pairOffset : -pairOffset) : 0;
            // The six parent groups occupy only the arc outside the reserved
            // top sector. The two upper inward edges therefore coincide with
            // the low-frequency restart at the two gap boundaries.
            const angle = parentAngles[parent] + subOffset;
            const left = localSpectrumPointAtAngle(angle - halfSpan);
            const center = localSpectrumPointAtAngle(angle);
            const right = localSpectrumPointAtAngle(angle + halfSpan);
            const timbre = clamp(timbres[index % timbres.length] || 0);
            const slowGate = Math.max(0, Math.sin(phrase * TAU * 0.5 - parent * 0.86));
            const fastGate = 0.5 + 0.5 * Math.sin(
              phrase * TAU * 2.15 + index * 2.17 + Math.sin(phrase * 1.7 + index) * 0.65
            );
            const gate = complex
              ? Math.pow(fastGate, 2.15) * (0.46 + timbre * 0.54)
              : 0.3 + Math.pow(slowGate, 1.65) * 0.7;
            const drive = clamp(commonDrive * (complex ? 0.68 : 0.78) + gate * (complex ? 0.44 : 0.34));
            const extension = (complex ? 2.5 : 4.5) + drive * (complex ? 9.5 : 12.5);
            const depth = complex ? 0.105 + drive * 0.045 : 0.13 + drive * 0.055;
            const push = (point, amount) => {
              const length = Math.max(1, Math.hypot(point.x, point.y));
              return {
                x: point.x + point.x / length * amount,
                y: point.y + point.y / length * amount
              };
            };
            const outerLeft = push(left, extension * (complex ? 0.66 + timbre * 0.34 : 0.84));
            const outerCenter = push(center, extension * (complex ? 0.82 + gate * 0.42 : 1.08));
            const outerRight = push(right, extension * (complex ? 0.66 + (1 - timbre) * 0.28 : 0.84));
            const innerLeft = { x: left.x * (1 - depth), y: left.y * (1 - depth) };
            const innerCenter = { x: center.x * (1 - depth * 1.08), y: center.y * (1 - depth * 1.08) };
            const innerRight = { x: right.x * (1 - depth), y: right.y * (1 - depth) };
            const color = complex
              ? [theme.accent, theme.accent2, theme.hot][index % 3]
              : (parent % 2 ? theme.accent2 : theme.accent);

            const fill = ctx.createRadialGradient(0, 0, radius * 0.72, 0, 0, radius + extension + 18);
            fill.addColorStop(0, rgba(color, 0.018 + drive * 0.035));
            fill.addColorStop(0.72, rgba(color, 0.055 + drive * (complex ? 0.19 : 0.24)));
            fill.addColorStop(1, rgba(theme.hot, 0.025 + drive * 0.13));
            ctx.fillStyle = fill;
            ctx.shadowColor = color;
            ctx.shadowBlur = 5 + drive * (complex ? 10 : 13);
            ctx.beginPath();
            ctx.moveTo(innerLeft.x, innerLeft.y);
            ctx.lineTo(outerLeft.x, outerLeft.y);
            ctx.quadraticCurveTo(outerCenter.x, outerCenter.y, outerRight.x, outerRight.y);
            ctx.lineTo(innerRight.x, innerRight.y);
            ctx.quadraticCurveTo(innerCenter.x, innerCenter.y, innerLeft.x, innerLeft.y);
            ctx.closePath();
            ctx.fill();
            signatureStroke(color, 0.58 + drive * (complex ? 0.72 : 0.92), 6 + drive * 12, 0.055 + drive * 0.18);
            ctx.stroke();

            if (complex && drive > 0.48) {
              // A short internal splice makes the active timbre hand-off
              // legible without adding another detached ring.
              const spliceScale = 0.9 + gate * 0.035;
              signatureStroke(index % 2 ? theme.hot : theme.accent2, 0.54 + drive * 0.48, 7, 0.06 + drive * 0.12);
              ctx.beginPath();
              ctx.moveTo(innerCenter.x * spliceScale, innerCenter.y * spliceScale);
              ctx.lineTo(outerCenter.x * (0.965 + gate * 0.025), outerCenter.y * (0.965 + gate * 0.025));
              ctx.stroke();
            }
          }
          ctx.restore();
        } else if (theme.id === 'big-room-house') {
          const energy = clamp(
            metrics.bass * 0.36
            + metrics.lowMid * 0.25
            + metrics.mid * 0.17
            + metrics.volume * 0.22
          );
          const buildPressure = clamp(
            metrics.flux * 0.38
            + metrics.high * 0.32
            + metrics.mid * 0.2
            - metrics.bass * 0.16
          );
          const kick = metrics.rhythmNow
            ? clamp(metrics.rhythmStrength ?? metrics.impact ?? pulse)
            : 0;
          const festivalRelease = clamp(energy * 0.66 + pulse * 0.7 + kick * 0.42);
          const beatIndex = Math.floor(time / Math.max(240, beatPeriod)) % 4;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const appendSmoothArc = (points, move = true) => {
            if (!points.length) return;
            if (move) ctx.moveTo(points[0].x, points[0].y);
            else ctx.lineTo(points[0].x, points[0].y);
            for (let index = 1; index < points.length - 1; index += 1) {
              const point = points[index];
              const next = points[index + 1];
              ctx.quadraticCurveTo(
                point.x,
                point.y,
                (point.x + next.x) * 0.5,
                (point.y + next.y) * 0.5
              );
            }
            const last = points[points.length - 1];
            ctx.lineTo(last.x, last.y);
          };
          // Four broad curved sound-field gates use the live House membrane as
          // their baseline. They are light-pressure arcs, not filled plates:
          // sparse/building passages pull inward and a kick opens them wide.
          for (let quarter = 0; quarter < 4; quarter += 1) {
            const angle = -Math.PI / 2 + quarter * Math.PI / 2;
            const halfSpan = 0.49;
            const motifActive = quarter === beatIndex;
            const gateRelease = clamp(
              festivalRelease * (0.78 + (motifActive ? 0.22 : 0))
              + kick * 0.18
            );
            const outerArc = [];
            const innerArc = [];
            const motifArc = [];
            const samples = 15;
            for (let sample = 0; sample < samples; sample += 1) {
              const ratio = sample / (samples - 1);
              const sampleAngle = angle - halfSpan + ratio * halfSpan * 2;
              const point = localSpectrumPointAtAngle(sampleAngle);
              const length = Math.max(1, Math.hypot(point.x, point.y));
              const radialX = point.x / length;
              const radialY = point.y / length;
              const envelope = Math.sin(ratio * Math.PI) ** 0.72;
              const inward = (2 + buildPressure * 7) * envelope * (1 - gateRelease * 0.42);
              const outward = (1.5 + gateRelease * 15 + kick * 4.5) * envelope;
              outerArc.push({
                x: point.x + radialX * (outward - inward),
                y: point.y + radialY * (outward - inward)
              });
              const bandDepth = (2.2 + buildPressure * 2.8 + gateRelease * 2.2) * envelope;
              innerArc.push({
                x: point.x - radialX * (inward + bandDepth),
                y: point.y - radialY * (inward + bandDepth)
              });
              if (ratio >= 0.24 && ratio <= 0.76) {
                const motifInset = 7 - gateRelease * 2.2;
                motifArc.push({
                  x: point.x - radialX * motifInset,
                  y: point.y - radialY * motifInset
                });
              }
            }
            const color = quarter % 2 ? theme.accent2 : theme.accent;
            const fill = ctx.createRadialGradient(0, 0, radius * 0.72, 0, 0, radius + 30);
            fill.addColorStop(0, rgba(color, 0.008 + buildPressure * 0.012));
            fill.addColorStop(0.72, rgba(color, 0.022 + gateRelease * 0.075));
            fill.addColorStop(1, rgba(theme.hot, 0.012 + gateRelease * 0.045));
            ctx.fillStyle = fill;
            ctx.shadowColor = color;
            ctx.shadowBlur = 7 + gateRelease * 18 + kick * 8;
            ctx.beginPath();
            appendSmoothArc(outerArc, true);
            appendSmoothArc([...innerArc].reverse(), false);
            ctx.closePath();
            ctx.fill();
            signatureStroke(color, 0.9 + gateRelease * 1.12 + kick * 0.28, 9 + gateRelease * 17, 0.12 + gateRelease * 0.26);
            ctx.beginPath();
            appendSmoothArc(outerArc, true);
            ctx.stroke();

            // One short curved anthem mark carries the simple repeating lead.
            // Its curvature and baseline are inherited from the same waveform.
            signatureStroke(
              motifActive ? theme.hot : color,
              0.9 + gateRelease * 0.72,
              8 + gateRelease * 9,
              0.11 + (motifActive ? 0.18 : 0.055) + pulse * 0.08
            );
            ctx.beginPath();
            appendSmoothArc(motifArc, true);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          const divisions = 6;
          for (let index = 0; index < divisions; index += 1) {
            const angle = index / divisions * TAU + 0.045 + Math.sin(time * 0.00016) * 0.025;
            const membrane = localSpectrumPointAtAngle(angle);
            const alternating = index % 2 ? theme.accent2 : theme.accent;
            signatureStroke(alternating, 0.72 + pulse * 0.58, 8, 0.1 + metrics.mid * 0.14 + pulse * 0.12);
            ctx.beginPath();
            ctx.moveTo(membrane.x * 0.79, membrane.y * 0.79);
            ctx.lineTo(membrane.x * 0.92, membrane.y * 0.92);
            ctx.stroke();
          }
        }
      }
    } else if (mode === 'kawaii-bass' || mode === 'future-bass') {
      const kawaii = mode === 'kawaii-bass';
      const bassDrive = clamp(
        (metrics.bass || 0) * 0.5
        + (metrics.bassPulse || 0) * 0.64
        + pulse * 0.2
      );
      const chordDrive = clamp(
        metrics.mid * 0.46
        + metrics.high * 0.16
        + metrics.volume * 0.24
        + pulse * 0.22
      );
      const slowBreath = 0.5 + 0.5 * Math.sin(time * 0.00072 - 0.65);
      const emotionalSwell = clamp(chordDrive * 0.82 + slowBreath * 0.18);
      const contact = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? pulse)
        : 0;

      // Both styles share a pair of wide, waveform-attached chord sheets.
      // The bright outer sheet opens with the synth chord, while the softer
      // inner edge briefly compresses on a hit and rebounds with the bass.
      // Kawaii Bass inherits the same body at a gentler contrast before adding
      // its cat silhouette and character details below.
      const chordOuterBase = spectrumShell({
        scale: (kawaii ? 0.965 : 0.98) - contact * (kawaii ? 0.004 : 0.007) + pulse * (kawaii ? 0.008 : 0.015),
        detail: kawaii ? 0.54 : 0.68,
        offset: 2.5 + emotionalSwell * (kawaii ? 3.6 : 5.2) + bassDrive * (kawaii ? 1.7 : 2.7),
        smoothing: kawaii ? 5 : 3
      });
      // Future Bass chords deliberately open wider than the source spectrum.
      // Kawaii Bass now inherits a softer, narrower version of the same motion
      // language, so it reads as a child style rather than a separate skin.
      const horizontalChordSpread = kawaii
        ? 1.012 + emotionalSwell * 0.012 + bassDrive * 0.004 - contact * 0.003
        : 1.044 + emotionalSwell * 0.043 + bassDrive * 0.014 - contact * 0.009;
      const chordOuter = chordOuterBase.map((point) => ({
        x: point.x * horizontalChordSpread,
        y: point.y * (kawaii ? 1 : 0.995 + emotionalSwell * 0.006)
      }));
      const chordInner = spectrumShell({
        scale: (kawaii ? 0.82 : 0.785) - contact * (kawaii ? 0.012 : 0.018),
        detail: kawaii ? 0.27 : 0.32,
        offset: 1 + pulse * (kawaii ? 0.7 : 1.2),
        smoothing: kawaii ? 8 : 7
      });
      if (chordOuter.length && chordInner.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const chordFill = ctx.createLinearGradient(-radius, -radius * 0.45, radius, radius * 0.45);
        chordFill.addColorStop(0, rgba(theme.accent, 0.02 + emotionalSwell * (kawaii ? 0.038 : 0.078)));
        chordFill.addColorStop(0.48, rgba(theme.hot, 0.018 + chordDrive * (kawaii ? 0.025 : 0.062)));
        chordFill.addColorStop(1, rgba(theme.accent2, 0.02 + emotionalSwell * (kawaii ? 0.038 : 0.078)));
        this.traceBand(chordOuter, [...chordInner].reverse(), true);
        ctx.fillStyle = chordFill;
        ctx.fill('evenodd');

        const drawChordWing = (centerRatio, color) => {
            const center = Math.round(centerRatio * chordOuter.length) % chordOuter.length;
            const half = Math.max(4, Math.round(chordOuter.length * (
              kawaii
                ? 0.112 + emotionalSwell * 0.01
                : 0.142 + emotionalSwell * 0.016
            )));
            const outerWing = [];
            const innerWing = [];
            for (let offset = -half; offset <= half; offset += 1) {
              const index = (center + offset + chordOuter.length) % chordOuter.length;
              const taper = Math.max(0, Math.cos(offset / half * Math.PI / 2)) ** 0.72;
              const outerPoint = chordOuter[index];
              const innerPoint = chordInner[index];
              const ribbonPhase = offset / Math.max(1, half) * Math.PI * 2.15
                + time * 0.00155
                + centerRatio * TAU;
              const ribbonWave = Math.sin(ribbonPhase)
                * (kawaii
                  ? 0.32 + chordDrive * 0.82 + emotionalSwell * 0.3
                  : 0.58 + chordDrive * 1.48 + emotionalSwell * 0.55)
                * taper;
              // Taper the wing into the parent membrane at both ends instead
              // of cutting it off like a separate plate.
              const innerWingPoint = {
                x: innerPoint.x + (outerPoint.x - innerPoint.x) * (0.08 * (1 - taper)),
                y: innerPoint.y + (outerPoint.y - innerPoint.y) * (0.08 * (1 - taper))
              };
              const outerWingPoint = {
                x: innerPoint.x + (outerPoint.x - innerPoint.x) * (0.5 + taper * 0.5),
                y: innerPoint.y + (outerPoint.y - innerPoint.y) * (0.5 + taper * 0.5)
              };
              const outerAngle = Math.atan2(outerWingPoint.y, outerWingPoint.x);
              const outerRadius = Math.hypot(outerWingPoint.x, outerWingPoint.y) + ribbonWave;
              const innerAngle = Math.atan2(innerWingPoint.y, innerWingPoint.x);
              const innerRadius = Math.hypot(innerWingPoint.x, innerWingPoint.y) + ribbonWave * 0.18;
              outerWing.push({
                x: Math.cos(outerAngle) * outerRadius,
                y: Math.sin(outerAngle) * outerRadius
              });
              innerWing.push({
                x: Math.cos(innerAngle) * innerRadius,
                y: Math.sin(innerAngle) * innerRadius
              });
            }
            const wingFill = ctx.createRadialGradient(0, 0, radius * 0.54, 0, 0, radius + 35);
            wingFill.addColorStop(0, rgba(color, kawaii ? 0.009 : 0.015));
            wingFill.addColorStop(0.56, rgba(color, (kawaii ? 0.034 : 0.058) + chordDrive * (kawaii ? 0.07 : 0.115)));
            wingFill.addColorStop(0.86, rgba(theme.hot, (kawaii ? 0.018 : 0.03) + emotionalSwell * (kawaii ? 0.052 : 0.09)));
            wingFill.addColorStop(1, rgba(color, kawaii ? 0.008 : 0.012));
            this.traceBand(outerWing, [...innerWing].reverse(), true);
            ctx.fillStyle = wingFill;
            ctx.shadowColor = color;
            ctx.shadowBlur = (kawaii ? 7 : 9) + emotionalSwell * (kawaii ? 9 : 12);
            ctx.fill('evenodd');

            // One harmonic lamination is enough to read as a flowing chord
            // sheet. The previous pair, full inner ring and endpoint glints
            // repeated the same information and made Future Bass look busy.
            for (const [voice, depth] of [0.58].entries()) {
              const voiceContour = outerWing.map((outerPoint, index) => {
                const innerPoint = innerWing[index];
                const ratio = index / Math.max(1, outerWing.length - 1);
                const taper = Math.sin(ratio * Math.PI) ** 0.7;
                const baseX = innerPoint.x + (outerPoint.x - innerPoint.x) * depth;
                const baseY = innerPoint.y + (outerPoint.y - innerPoint.y) * depth;
                const angle = Math.atan2(baseY, baseX);
                const wave = Math.sin(
                  ratio * Math.PI * 4.25
                  - time * (0.00115 + voice * 0.00022)
                  + voice * 1.35
                  + centerRatio * TAU
                ) * (0.35 + chordDrive * 0.82) * taper;
                const voiceRadius = Math.hypot(baseX, baseY) + wave;
                return {
                  x: Math.cos(angle) * voiceRadius,
                  y: Math.sin(angle) * voiceRadius
                };
              });
              signatureStroke(
                voice ? theme.hot : color,
                (kawaii ? 0.42 : 0.52) + chordDrive * (kawaii ? 0.36 : 0.48),
                (kawaii ? 6 : 7) + emotionalSwell * (kawaii ? 5 : 7),
                (kawaii ? 0.042 : 0.06) + chordDrive * (kawaii ? 0.07 : 0.095) + emotionalSwell * (kawaii ? 0.025 : 0.038)
              );
              this.tracePoints(voiceContour, false, true);
              ctx.stroke();
            }
          };
        drawChordWing(0.25, theme.accent);
        drawChordWing(0.75, theme.accent2);

        // Two opposing, broad contour highlights read as a wide supersaw
        // chord opening around the centre instead of two detached circle arcs.
        for (const [center, color] of [[0.25, theme.accent], [0.75, theme.accent2]]) {
          signatureStroke(
            color,
            (kawaii ? 0.9 : 1.35) + chordDrive * (kawaii ? 0.55 : 0.95) + bassDrive * (kawaii ? 0.18 : 0.35),
            12 + emotionalSwell * (kawaii ? 6 : 10),
            (kawaii ? 0.07 : 0.13) + emotionalSwell * (kawaii ? 0.11 : 0.22) + pulse * (kawaii ? 0.04 : 0.06)
          );
          strokeContourSegment(chordOuter, center, kawaii ? 0.305 : 0.345);
        }
        ctx.restore();
      }

      if (kawaii) {
        ctx.lineCap = 'round';
        // The inherited chord wings now cradle the cheeks, so only two quiet
        // whisker groups remain as the cat-specific outer detail.
        for (const side of [-1, 1]) {
          for (const whisker of [-1, 0, 1]) {
            const startX = side * (radius - 18);
            const startY = whisker * 4.2 + 9;
            const whiskerColor = whisker < 0 ? theme.accent : whisker > 0 ? theme.accent2 : theme.hot;
            signatureStroke(whiskerColor, 0.9 + bassDrive * 0.34, 8, 0.135 + bassDrive * 0.11);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(side * (radius - 1), startY + whisker * 1.6, side * (radius + 9 + bassDrive * 2), startY + whisker * 4.2);
            ctx.stroke();
          }
        }
        for (const angle of [0.79, 2.35]) {
          const twinkle = 0.7 + 0.3 * Math.sin(time * 0.003 + angle * 3);
          ctx.fillStyle = rgba(theme.hot, 0.09 + twinkle * 0.13 + bassDrive * 0.055);
          ctx.shadowColor = angle > 0 ? theme.accent2 : theme.accent;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * (radius + 11), Math.sin(angle) * (radius + 11), 0.62 + twinkle * 0.7, 0, TAU);
          ctx.fill();
        }
      }
    } else if (mode === 'ambient') {
      const pureAmbient = theme.id === 'ambient';
      const chillout = theme.id === 'chillout';
      const air = clamp(metrics.volume * 0.3 + metrics.mid * 0.38 + metrics.high * 0.16);
      const warmth = clamp(metrics.bass * 0.38 + metrics.lowMid * 0.42 + pulse * 0.08);
      const outerField = spectrumShell({
        scale: pureAmbient ? 1.015 : 1,
        detail: pureAmbient ? 0.22 : chillout ? 0.34 : 0.46,
        offset: 2 + air * (pureAmbient ? 2.2 : 3.8),
        smoothing: pureAmbient ? 10 : chillout ? 8 : 6
      });
      if (outerField.length) {
        if (pureAmbient) {
          // Ambient is a continuous space rather than a beat diagram. Three
          // slowly separating pressure contours respond to long-term tone.
          for (let layer = 0; layer < 3; layer += 1) {
            const drift = Math.sin(time * 0.00012 + layer * 1.9) * (0.8 + layer * 0.45);
            const field = outerField.map((point) => {
              const angle = Math.atan2(point.y, point.x);
              const sourceRadius = Math.hypot(point.x, point.y);
              const breathe = Math.sin(angle * 2 - time * 0.00016 + layer * 1.3)
                * (1.2 + air * 2.8);
              const layerRadius = sourceRadius * (0.78 + layer * 0.105) + breathe;
              return {
                x: Math.cos(angle) * layerRadius + drift,
                y: Math.sin(angle) * layerRadius - drift * 0.35
              };
            });
            signatureStroke(
              layer === 1 ? theme.accent2 : layer === 2 ? theme.hot : theme.accent,
              0.7 + air * 0.42,
              13 + layer * 4,
              0.065 + air * 0.09 + layer * 0.018
            );
            this.tracePoints(field, true, true);
            ctx.stroke();
          }
        } else if (chillout) {
          // Chillout uses three long, open horizon-like phrases. The gaps keep
          // it airier than Downtempo's explicit loop and beat pockets.
          const breeze = Math.sin(time * 0.00024) * 0.08;
          [
            { center: -2.3, span: 1.12, color: theme.accent2 },
            { center: -0.15, span: 0.86, color: theme.hot },
            { center: 1.75, span: 1.04, color: theme.accent }
          ].forEach((phrase, index) => {
            signatureStroke(
              phrase.color,
              0.82 + air * 0.52,
              11 + air * 9,
              0.09 + air * 0.14
            );
            strokeAngularContour(outerField, phrase.center + breeze * (index - 1), phrase.span);
          });
        } else {
          // Downtempo keeps a recognisable slow beat loop, with unequal spaces
          // and warm low-frequency emphasis rather than a club four-on-floor.
          const pattern = [1, 0.26, 0.58, 0.2, 0.78, 0.32, 0.52, 0.18];
          const travel = (time / Math.max(3200, beatPeriod * 8)) % 1;
          const active = Math.floor(travel * pattern.length) % pattern.length;
          pattern.forEach((weight, step) => {
            const center = (step + 0.5) / pattern.length;
            const isActive = step === active ? 1 : 0;
            signatureStroke(
              step % 3 === 0 ? theme.accent : step % 2 ? theme.accent2 : theme.hot,
              0.72 + warmth * 0.55 + isActive * 0.42,
              8 + isActive * 7,
              0.07 + weight * warmth * 0.12 + isActive * 0.13
            );
            strokeContourSegment(outerField, center, 0.072 + weight * 0.018);
          });
        }
      }
    } else if (mode === 'experimental') {
      const glitch = theme.id === 'glitch';
      const detail = clamp(metrics.mid * 0.34 + metrics.high * 0.34 + metrics.bodyFlux * 0.8 + metrics.presenceFlux * 0.55);
      const outerCode = spectrumContour({
        scale: 1,
        offset: 1 + detail * 1.8,
        lobes: glitch ? 7 : 5,
        waveAmount: glitch ? 0.8 : 1.4
      });
      if (outerCode.length) {
        if (glitch) {
          // Glitch exposes discontinuity itself: a few live-contour packets
          // briefly lose registration, without turning the whole card into a
          // flashing RGB fault effect.
          const packets = [0.03, 0.14, 0.31, 0.47, 0.7, 0.86];
          const activePacket = Math.floor(time / 190) % packets.length;
          packets.forEach((center, index) => {
            const active = index === activePacket ? 1 : 0;
            const shift = active * (1.5 + detail * 2.2) * (index % 2 ? -1 : 1);
            const shifted = outerCode.map((point) => ({ x: point.x + shift, y: point.y - shift * 0.32 }));
            const color = index % 3 === 0 ? theme.hot : index % 2 ? theme.accent2 : theme.accent;
            signatureStroke(color, 0.72 + detail * 0.72 + active * 0.55, 6 + active * 5, 0.1 + detail * 0.15 + active * 0.14);
            strokeContourSegment(shifted, center, 0.045 + (index % 2) * 0.018);
            if (active) {
              const point = shifted[Math.floor(center * shifted.length) % shifted.length];
              ctx.fillStyle = rgba(color, 0.12 + detail * 0.16);
              ctx.shadowColor = color;
              ctx.shadowBlur = 7;
              ctx.fillRect(point.x - 3.5, point.y - 1.1, 7 + detail * 5, 2.2);
            }
          });
        } else {
          // IDM's structure is coherent but deliberately non-repeating: two
          // coprime step groups cross the same live contour at different rates.
          const groups = [5, 7];
          groups.forEach((steps, group) => {
            const phase = (time / (group ? 4100 : 3300)) % 1;
            for (let step = 0; step < steps; step += 1) {
              const center = (step / steps + phase * (group ? -0.19 : 0.16) + 1) % 1;
              const accent = Math.max(0, Math.sin((phase - step / steps) * TAU));
              signatureStroke(
                group ? theme.accent2 : step % 2 ? theme.hot : theme.accent,
                0.62 + detail * 0.5 + accent * 0.34,
                7 + accent * 6,
                0.075 + detail * 0.11 + accent * 0.08
              );
              strokeContourSegment(outerCode, center, group ? 0.038 : 0.052);
            }
          });
        }
      }
    } else if (mode === 'rnb') {
      if (integratedRnbFx) {
        const blues = theme.id === 'blues';
        const contemporaryRnb = ['rnb', 'contemporary-rnb'].includes(theme.id);
        const alternativeRnb = theme.id === 'alternative-rnb';
        const neoSoul = theme.id === 'neo-soul';
        const newJackSwing = theme.id === 'new-jack-swing';
        const soul = theme.id === 'soul';
        const gospel = theme.id === 'gospel';
        const funk = theme.id === 'funk';
        const bassDrive = clamp(
          metrics.bass * 0.47
            + metrics.lowMid * 0.29
            + (metrics.bassPulse || 0) * 0.48
        );
        const vocalDrive = clamp(
          metrics.mid * 0.54
            + metrics.high * 0.12
            + metrics.volume * 0.22
        );
        const grooveDrive = clamp(
          bassDrive * 0.5
            + vocalDrive * 0.2
            + pulse * 0.42
        );
        const flowPhase = time * (
          (newJackSwing ? 0.00082 : funk ? 0.00094 : neoSoul ? 0.00032 : 0.00048)
            + bassDrive * (funk ? 0.00032 : 0.0002)
        );
        const sway = Math.sin(time * (neoSoul || soul ? 0.0002 : 0.00027))
          * (alternativeRnb ? 0.055 : neoSoul ? 0.045 : 0.035);
        const outerBase = spectrumShell({
          scale: 0.985,
          detail: newJackSwing || funk ? 0.72 : alternativeRnb ? 0.48 : neoSoul || soul ? 0.38 : 0.56,
          offset: 2 + bassDrive * (funk ? 4.8 : 3.4) + vocalDrive * (gospel ? 2 : 1.2),
          smoothing: newJackSwing || funk ? 3 : neoSoul || soul || gospel ? 7 : 5
        });
        const innerBase = spectrumShell({
          scale: newJackSwing || funk ? 0.76 : 0.73,
          detail: newJackSwing || funk ? 0.28 : 0.2,
          offset: 1 - pulse * 0.55,
          smoothing: 9
        });

        const shapeVelvetPoint = (point, index, inner = false, voiceOffset = 0) => {
          const angle = Math.atan2(point.y, point.x);
          const sourceRadius = Math.hypot(point.x, point.y);
          const bottomWeight = 0.3 + smoothstep(-0.2, 0.96, Math.sin(angle)) * 0.7;
          const vocalLift = Math.pow(Math.max(0, -Math.sin(angle)), 1.65)
            * vocalDrive * (inner ? 0.65 : 2.7);
          const grooveLobes = newJackSwing ? 4 : funk ? 5 : 3;
          const syncopatedFlow = Math.sin(angle * grooveLobes - flowPhase * (funk ? 3.1 : 2.25) + voiceOffset)
            * (0.3 + bassDrive * (inner ? 0.92 : funk ? 3.8 : 2.8))
            * bottomWeight;
          const harmonicFlow = Math.sin(angle * 2 + flowPhase * 1.15 + voiceOffset * 1.7)
            * (0.2 + vocalDrive * (inner ? 0.52 : 1.28));
          const shapedRadius = sourceRadius + vocalLift + syncopatedFlow + harmonicFlow;
          const shapedAngle = angle + sway + Math.sin(angle - flowPhase + index * 0.002) * grooveDrive * 0.006;
          const rawX = Math.cos(shapedAngle) * shapedRadius * (1.018 + vocalDrive * 0.008);
          const rawY = Math.sin(shapedAngle) * shapedRadius * (gospel ? 0.94 : alternativeRnb ? 0.84 : 0.89);
          const lateralGlide = Math.sin(angle * 2 - flowPhase * 1.35 + voiceOffset * 0.9)
            * vocalDrive * (inner ? 0.42 : 1.45);
          return { x: rawX + lateralGlide, y: rawY };
        };

        const outer = outerBase.map((point, index) => shapeVelvetPoint(point, index, false));
        const inner = innerBase.map((point, index) => shapeVelvetPoint(point, index, true));
        if (outer.length && inner.length) {
          // Harmony guides stay inside the live waveform band and feed the
          // genre-specific phrase accents below. They are not painted as full
          // loops: the base spectrum membrane alone defines the silhouette,
          // while these paths only position the short subtype accents.
          const voices = [
            { depth: 0.3, color: theme.accent, phase: 0 },
            { depth: 0.54, color: theme.hot, phase: 1.8 },
            { depth: 0.78, color: theme.accent2, phase: 3.6 }
          ];
          const voiceContours = voices.map((voice) => outer.map((outerPoint, index) => {
            const innerPoint = inner[index];
            const ratio = index / Math.max(1, outer.length - 1);
            const baseX = innerPoint.x + (outerPoint.x - innerPoint.x) * voice.depth;
            const baseY = innerPoint.y + (outerPoint.y - innerPoint.y) * voice.depth;
            const angle = Math.atan2(baseY, baseX);
            const phrase = Math.sin(ratio * TAU * 2 - flowPhase * 1.7 + voice.phase)
              * (0.24 + vocalDrive * 0.72 + bassDrive * 0.26);
            const voiceRadius = Math.hypot(baseX, baseY) + phrase;
            return { x: Math.cos(angle) * voiceRadius, y: Math.sin(angle) * voiceRadius };
          }));

          // A pair of short highlights glides on the off-beat around the same
          // band. Pulse changes their presence rather than shaking the whole
          // structure, preserving R&B's laid-back pocket.
          if (blues) {
            // Twelve uneven phrases travel around the same live contour. The
            // repeated four-bar grouping suggests a blues form without adding
            // a detached staff, equalizer, or decorative instrument drawing.
            const barPosition = (time / Math.max(1850, beatPeriod * 5.5)) % 12;
            for (let bar = 0; bar < 12; bar += 1) {
              const distance = Math.min(Math.abs(barPosition - bar), 12 - Math.abs(barPosition - bar));
              const active = Math.exp(-distance * distance * 2.6);
              const center = (0.57 + bar / 12 * 0.72) % 1;
              const turnaround = bar >= 8;
              signatureStroke(
                turnaround ? theme.accent2 : bar % 4 === 0 ? theme.hot : theme.accent,
                0.72 + active * 0.7,
                9 + active * 8,
                0.075 + vocalDrive * 0.09 + active * 0.12
              );
              strokeContourSegment(voiceContours[bar % voiceContours.length], center, 0.055 + (bar % 3) * 0.012);
            }
          } else if (contemporaryRnb) {
            const grooveTravel = ((time / Math.max(2200, beatPeriod * 7.5)) + 0.08) % 1;
            const grooveAccent = 0.24 + grooveDrive * 0.4 + pulse * 0.18;
            [grooveTravel, (grooveTravel + 0.5) % 1].forEach((center, index) => {
              signatureStroke(
                index ? theme.accent2 : theme.hot,
                1.05 + grooveDrive * 0.72,
                12 + grooveDrive * 11,
                grooveAccent
              );
              strokeContourSegment(voiceContours[index ? 2 : 1], center, 0.15 + bassDrive * 0.03);
            });
          } else if (alternativeRnb) {
            // Sparse, unequal fragments leave deliberate negative space around
            // the vocal contour instead of resolving into a polished loop.
            for (let fragment = 0; fragment < 5; fragment += 1) {
              const center = ((time * (0.000024 + fragment * 0.000003) + fragment * 0.193) % 1 + 1) % 1;
              signatureStroke(fragment % 2 ? theme.accent2 : theme.hot, 0.62 + vocalDrive * 0.5, 10, 0.065 + vocalDrive * 0.11);
              strokeContourSegment(voiceContours[fragment % voiceContours.length], center, 0.07 + (fragment % 3) * 0.025);
            }
          } else if (neoSoul) {
            // Long phrases arrive just behind the pulse, giving Neo Soul a
            // relaxed pocket while remaining tied to the live spectrum.
            const laidBack = ((time / Math.max(2600, beatPeriod * 9) - 0.045) % 1 + 1) % 1;
            [0, 0.34, 0.68].forEach((offset, index) => {
              signatureStroke(index === 1 ? theme.hot : index ? theme.accent2 : theme.accent, 0.7 + grooveDrive * 0.48, 11, 0.075 + grooveDrive * 0.12);
              strokeContourSegment(voiceContours[index], (laidBack + offset) % 1, 0.22 - index * 0.025);
            });
          } else if (newJackSwing) {
            // Eight gated steps combine drum-machine precision with a swung
            // vocal pocket. Every gate bridges the two live harmony contours.
            const stepPosition = (time / beatPeriod * 2) % 8;
            for (let step = 0; step < 8; step += 1) {
              const distance = Math.min(Math.abs(stepPosition - step), 8 - Math.abs(stepPosition - step));
              const active = Math.exp(-distance * distance * 3.4);
              const index = Math.round(step / 8 * outer.length) % outer.length;
              const outerPoint = outer[index];
              const innerPoint = inner[index];
              signatureStroke(step % 2 ? theme.accent2 : theme.hot, 0.8 + active * 0.9, 7 + active * 10, 0.08 + active * 0.22 + grooveDrive * 0.07);
              ctx.beginPath();
              ctx.moveTo(innerPoint.x, innerPoint.y);
              ctx.lineTo(outerPoint.x * (1 + active * 0.055), outerPoint.y * (1 + active * 0.055));
              ctx.stroke();
            }
          } else if (soul) {
            // Call and response alternates two broad phrases across the live
            // band, leaving the centre open for the lead vocal.
            const call = ((time / Math.max(2800, beatPeriod * 8)) % 1 + 1) % 1;
            [call, (1 - call + 0.5) % 1].forEach((center, index) => {
              signatureStroke(index ? theme.accent2 : theme.hot, 0.92 + vocalDrive * 0.64, 14, 0.1 + vocalDrive * 0.15);
              strokeContourSegment(voiceContours[index ? 2 : 0], center, 0.27);
            });
          } else if (gospel) {
            // Choir voices rise in a fan from the lower ensemble, brightening
            // with midrange energy rather than behaving like kick rays.
            for (let voice = 0; voice < 7; voice += 1) {
              const ratio = 0.16 + voice / 6 * 0.68;
              const index = Math.floor(ratio * outer.length) % outer.length;
              const point = outer[index];
              const lift = 5 + voice % 2 * 4 + vocalDrive * 10;
              signatureStroke(voice % 2 ? theme.accent2 : theme.hot, 0.64 + vocalDrive * 0.52, 12, 0.07 + vocalDrive * 0.13);
              ctx.beginPath();
              ctx.moveTo(point.x * 0.78, point.y * 0.78);
              ctx.quadraticCurveTo(point.x * 0.92, point.y - lift, point.x, point.y - lift * 0.45);
              ctx.stroke();
            }
          } else if (funk) {
            // Short syncopated chops land around the contour with one heavier
            // downbeat, echoing bass slaps and clipped guitar on the one.
            const stepPosition = (time / beatPeriod * 4) % 12;
            for (let chop = 0; chop < 12; chop += 1) {
              const distance = Math.min(Math.abs(stepPosition - chop), 12 - Math.abs(stepPosition - chop));
              const active = Math.exp(-distance * distance * 4.2);
              const index = Math.round(chop / 12 * outer.length) % outer.length;
              const outerPoint = outer[index];
              const innerPoint = inner[index];
              const downbeat = chop % 4 === 0;
              signatureStroke(downbeat ? theme.hot : chop % 2 ? theme.accent2 : theme.accent, 0.72 + active * 0.82 + (downbeat ? bassDrive * 0.4 : 0), 7 + active * 9, 0.07 + active * 0.2 + (downbeat ? bassDrive * 0.09 : 0));
              ctx.beginPath();
              ctx.moveTo(innerPoint.x, innerPoint.y);
              ctx.lineTo(outerPoint.x * (1 + active * (downbeat ? 0.07 : 0.035)), outerPoint.y * (1 + active * (downbeat ? 0.07 : 0.035)));
              ctx.stroke();
            }
          }

          // drawSpectrumVolume already owns the one complete live outline.
          // Keeping a second closed contour here made every R&B-family visual
          // read as two offset circles; the subtype phrases above now carry
          // the groove language without duplicating that silhouette.
        }
      } else if (theme.family === 'jazz') {
        const bebop = theme.id === 'bebop';
        const swing = theme.id === 'swing-jazz';
        const bossa = theme.id === 'bossa-nova';
        const fusion = theme.id === 'jazz-fusion';
        const improvDrive = clamp(metrics.mid * 0.42 + metrics.high * 0.25 + metrics.volume * 0.18 + pulse * 0.28);
        const phraseContour = spectrumShell({
          scale: 0.91,
          detail: bebop ? 0.7 : fusion ? 0.58 : bossa ? 0.3 : 0.48,
          offset: 4 + improvDrive * (bebop ? 5 : 3),
          smoothing: bebop ? 2 : bossa ? 8 : 5
        });
        const phraseCount = bebop ? 7 : fusion ? 5 : swing ? 4 : bossa ? 3 : 4;
        const phraseRate = bebop ? 0.00012 : fusion ? 0.000075 : swing ? 0.000055 : bossa ? 0.000028 : 0.000045;
        const phraseSpan = bebop ? 0.08 : fusion ? 0.14 : swing ? 0.18 : bossa ? 0.23 : 0.17;
        const colors = [theme.accent, theme.hot, theme.accent2];

        // Improvised phrases travel over the live spectrum contour. Their
        // unequal entries and lengths keep Jazz conversational, not looped.
        for (let phrase = 0; phrase < phraseCount; phrase += 1) {
          const stagger = phrase * (bebop ? 0.137 : 0.219);
          const rubato = Math.sin(time * (0.00019 + phrase * 0.000011) + phrase * 1.73)
            * (bebop ? 0.024 : bossa ? 0.012 : 0.018);
          const center = ((time * phraseRate + stagger + rubato) % 1 + 1) % 1;
          const span = phraseSpan * (0.72 + ((phrase * 7) % 5) * 0.09) + improvDrive * 0.018;
          signatureStroke(
            colors[phrase % colors.length],
            0.7 + improvDrive * (bebop || fusion ? 0.78 : 0.52),
            9 + improvDrive * 10,
            0.075 + improvDrive * 0.13 + (phrase % 3 === 1 ? pulse * 0.055 : 0)
          );
          strokeContourSegment(phraseContour, center, span);
        }

        const pointAt = (ratio) => {
          if (!phraseContour.length) return { x: 0, y: 0 };
          const wrapped = ((ratio % 1) + 1) % 1;
          return phraseContour[Math.floor(wrapped * phraseContour.length) % phraseContour.length];
        };

        if (bebop) {
          // Short angled answers punctuate the rapidly changing horn line.
          for (let note = 0; note < 8; note += 1) {
            const ratio = time * 0.000095 + note * 0.119 + (note % 3) * 0.027;
            const point = pointAt(ratio);
            const angle = Math.atan2(point.y, point.x);
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(angle + Math.PI / 2 + (note % 2 ? 0.34 : -0.22));
            signatureStroke(note % 2 ? theme.accent2 : theme.hot, 0.8 + improvDrive * 0.68, 8, 0.08 + improvDrive * 0.12);
            ctx.beginPath();
            ctx.moveTo(-2.5, 0);
            ctx.lineTo(2.5 + improvDrive * 3, 0);
            ctx.stroke();
            ctx.restore();
          }
        } else if (swing) {
          // A weighted lower arc rocks in triplet-like groups while the live
          // phrases above it remain free to answer off the beat.
          const pendulum = Math.sin(time * 0.00125) * 0.12;
          for (let beat = 0; beat < 6; beat += 1) {
            const angle = Math.PI * (0.18 + beat * 0.128) + pendulum;
            const inner = radius + 5 + (beat % 3 === 1 ? 3 : 0);
            const outer = inner + 7 + (beat % 3 === 0 ? 5 : 0) + pulse * 3;
            signatureStroke(beat % 3 === 1 ? theme.hot : theme.accent2, 0.75 + improvDrive * 0.45, 9, 0.08 + improvDrive * 0.1);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.78);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.78);
            ctx.stroke();
          }
        } else if (bossa) {
          // Quiet guitar strings sit on the lower half of the spectrum and
          // lean gently with the syncopated midrange instead of kick-pumping.
          ctx.save();
          ctx.rotate(-0.08 + Math.sin(time * 0.00024) * 0.025);
          for (let string = 0; string < 6; string += 1) {
            const y = radius * 0.35 + string * 6.2;
            const half = Math.sqrt(Math.max(0, (radius + 18) ** 2 - y ** 2)) * 0.92;
            signatureStroke(string % 2 ? theme.accent2 : theme.hot, 0.48 + metrics.mid * 0.42, 7, 0.055 + metrics.mid * 0.075);
            ctx.beginPath();
            ctx.moveTo(-half, y + Math.sin(time * 0.0011 + string) * 0.7);
            ctx.quadraticCurveTo(0, y - metrics.mid * (2 + string * 0.2), half, y);
            ctx.stroke();
          }
          ctx.restore();
        } else if (fusion) {
          // Electric instruments connect distant phrases into one harmonic
          // circuit; the nodes remain samples of the same live contour.
          const ratios = [0.05, 0.23, 0.41, 0.62, 0.82].map((offset) => offset + time * 0.000026);
          const points = ratios.map(pointAt);
          signatureStroke(theme.accent2, 0.8 + improvDrive * 0.7, 12, 0.09 + improvDrive * 0.14);
          ctx.beginPath();
          points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
          ctx.stroke();
          points.forEach((point, index) => {
            ctx.fillStyle = rgba(index % 2 ? theme.hot : theme.accent, 0.16 + improvDrive * 0.28);
            ctx.shadowColor = index % 2 ? theme.hot : theme.accent;
            ctx.shadowBlur = 8 + improvDrive * 8;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 1.2 + improvDrive * 1.4, 0, TAU);
            ctx.fill();
          });
        }
      } else {
        ctx.rotate(Math.sin(time * 0.00032) * 0.035);
        for (let ribbon = 0; ribbon < 3; ribbon += 1) {
          const ribbonRadius = radius + 2 + ribbon * 7;
          signatureStroke(ribbon % 2 ? theme.accent2 : theme.accent, 0.8 + metrics.mid * 0.9, 16, 0.12 + metrics.mid * 0.22);
          ctx.beginPath();
          ctx.ellipse(0, (ribbon - 1) * 2.5, ribbonRadius, ribbonRadius * (0.72 + ribbon * 0.04), ribbon * 0.46, -0.72, 0.72);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(0, (1 - ribbon) * 2.5, ribbonRadius, ribbonRadius * (0.72 + ribbon * 0.04), ribbon * 0.46, Math.PI - 0.72, Math.PI + 0.72);
          ctx.stroke();
        }
      }
    } else if (mode === 'dubstep') {
      const umbrellaBass = theme.id === 'bass-music';
      const riddim = theme.id === 'riddim';
      const futureRiddim = theme.id === 'future-riddim';
      const colourBass = theme.id === 'colour-bass';
      const melodicDubstep = theme.id === 'melodic-dubstep';
      const brostep = theme.id === 'brostep';
      const deathstep = theme.id === 'deathstep';
      const moombahcore = theme.id === 'moombahcore';
      const riddimLike = riddim || futureRiddim;
      const melodicBass = melodicDubstep || colourBass;
      const wobbleDrive = clamp(metrics.bass * 0.52 + metrics.lowMid * 0.24 + (metrics.bassPulse || 0) * 0.68);
      if (umbrellaBass) {
        // Bass Music is an umbrella rather than a disguised Dubstep preset.
        // A continuous pressure membrane carries low-frequency weight across
        // the full contour, while broad currents reveal changing bass timbres.
        const massDrive = clamp(
          metrics.bass * 0.46
          + metrics.lowMid * 0.3
          + metrics.mid * 0.12
          + pulse * 0.28
        );
        const pressureOuter = spectrumShell({
          scale: 0.94,
          detail: 0.72,
          offset: 2 + massDrive * 5,
          smoothing: 3
        });
        const pressureInner = spectrumShell({
          scale: 0.72 - pulse * 0.012,
          detail: 0.34,
          offset: -1,
          smoothing: 7
        });
        if (pressureOuter.length && pressureInner.length) {
          this.traceBand(pressureOuter, [...pressureInner].reverse(), true);
          const massFill = ctx.createRadialGradient(0, 0, radius * 0.54, 0, 0, radius + 22);
          massFill.addColorStop(0, rgba(theme.accent2, 0.012 + massDrive * 0.025));
          massFill.addColorStop(0.6, rgba(theme.accent, 0.035 + massDrive * 0.075));
          massFill.addColorStop(1, rgba(theme.hot, 0.014 + pulse * 0.045));
          ctx.fillStyle = massFill;
          ctx.fill('evenodd');
          signatureStroke(theme.accent, 0.92 + massDrive * 0.72, 13 + massDrive * 8, 0.13 + massDrive * 0.2 + pulse * 0.08);
          this.tracePoints(pressureOuter, true, true);
          ctx.stroke();
        }
        const timbreContour = spectrumShell({
          scale: 0.84,
          detail: 0.52,
          offset: Math.sin(time * 0.0011) * 1.8,
          smoothing: 5
        });
        const timbreDrives = [metrics.bass, metrics.lowMid, metrics.mid];
        for (let current = 0; current < 3; current += 1) {
          const timbre = clamp(timbreDrives[current] || 0);
          const center = (time * (0.000025 + current * 0.000006) + current / 3) % 1;
          signatureStroke(
            [theme.accent, theme.accent2, theme.hot][current],
            0.7 + timbre * 0.72,
            11 + timbre * 8,
            0.09 + timbre * 0.18 + pulse * 0.045
          );
          strokeContourSegment(timbreContour, center, 0.19 + timbre * 0.075);
        }
      } else {
        const accentPhase = (time % beatPeriod) / beatPeriod;
        const halfTimeStep = Math.floor(time / beatPeriod) % 2;
        const hitEnvelope = Math.exp(-accentPhase * 8.5);
        const twistEnvelope = Math.sin(Math.PI * smoothstep(0.04, 0.78, accentPhase))
          * (1 - smoothstep(0.72, 0.96, accentPhase));
        const pauseEnvelope = smoothstep(0.7, 0.94, accentPhase);
        const cadence = clamp(0.48 + hitEnvelope * 0.34 + twistEnvelope * 0.36 - pauseEnvelope * 0.18, 0.28, 1);
        ctx.save();
        ctx.globalAlpha *= cadence;
        const railOptions = riddim
          ? { steps: 8, rate: 0.0048, phaseStep: Math.PI / 2, gatePower: 3.15, span: 0.28, reach: 14, width: 1.65, offset: -13, floor: 0.06, wobble: 2.2, reverse: true }
          : futureRiddim
            ? { steps: 8, rate: 0.0034, phaseStep: Math.PI / 2, gatePower: 1.55, span: 0.44, reach: 12, width: 1.45, offset: -12, floor: 0.22, wobble: 2.1, reverse: true }
            : colourBass
              ? { steps: 10, rate: 0.0026, phaseStep: 0.72, gatePower: 1.2, span: 0.58, reach: 12, width: 1.35, offset: -11, floor: 0.3, wobble: 1.4, reverse: true }
              : melodicDubstep
                ? { steps: 6, rate: 0.0021, phaseStep: 0.7, gatePower: 1.1, span: 0.64, reach: 10, width: 1.4, offset: -11, floor: 0.34, wobble: 0.9, reverse: true }
                : deathstep
                  ? { steps: 12, rate: 0.0054, phaseStep: 1.86, gatePower: 2.65, span: 0.24, reach: 20, width: 1.45, offset: -14, floor: 0.04, wobble: 6.4, reverse: true }
                  : brostep
                    ? { steps: 6, rate: 0.0038, phaseStep: 1.18, gatePower: 2.25, span: 0.36, reach: 19, width: 1.65, offset: -13, floor: 0.06, wobble: 5.2, reverse: true }
                    : moombahcore
                      ? { steps: 6, rate: 0.0036, phaseStep: 1.82, gatePower: 1.9, span: 0.34, reach: 16, width: 1.55, offset: -12, floor: 0.1, wobble: 4.4 }
                      : { steps: 6, rate: 0.0024, phaseStep: 1.12, gatePower: 2.05, span: 0.4, reach: 16, width: 1.55, offset: -13, floor: 0.08, wobble: 3.6, reverse: true };
        drawBasslineRail(railOptions);
        ctx.restore();
        // Preserve the jaws, but phrase their motion as hit, modulated twist,
        // then a short pause instead of continuous undifferentiated motion.
        ctx.rotate(
          Math.sin(time * (moombahcore ? 0.00135 : 0.001)) * (melodicBass ? 0.01 : riddim ? 0.012 : deathstep ? 0.035 : 0.025)
          + (halfTimeStep ? 1 : -1) * twistEnvelope * (melodicBass ? 0.007 : riddim ? 0.01 : deathstep ? 0.028 : 0.019)
        );
        const jawOffsets = deathstep ? [-1.5, -0.5, 0.5, 1.5] : [-1, 0, 1];
        for (const side of [-1, 1]) {
          for (const jaw of jawOffsets) {
            const yOffset = jaw * (melodicBass ? 15 : riddimLike ? 14 : deathstep ? 10 : 13);
            const innerX = side * (radius - 5);
            const hingeX = side * (radius + 7 + Math.abs(jaw) * 3);
            const motion = 0.5 + hitEnvelope * 0.14 + twistEnvelope * 0.46 - pauseEnvelope * 0.16;
            const reach = deathstep ? 20 : brostep ? 17 : riddim ? 14 : futureRiddim ? 12 : melodicBass ? 9 : moombahcore ? 15 : 12;
            const tipX = side * (radius + 12 + wobbleDrive * reach * motion);
            const biteScale = deathstep ? 8.5 : brostep ? 7.5 : riddim ? 4.5 : melodicBass ? 4 : 6;
            const bite = (1 - Math.abs(jaw) * (deathstep ? 0.1 : 0.18)) * (3 + wobbleDrive * biteScale * motion);
            signatureStroke(
              jaw ? theme.accent2 : theme.accent,
              melodicBass ? 0.84 : deathstep ? 1.3 : riddim ? 1.05 : 1.18,
              melodicBass ? 14 : deathstep ? 8 : 11,
              0.1 + wobbleDrive * 0.22 + pulse * 0.12 + twistEnvelope * 0.08 - pauseEnvelope * 0.035
            );
            ctx.beginPath();
            ctx.moveTo(innerX, yOffset - 5);
            ctx.lineTo(hingeX, yOffset - 7);
            ctx.lineTo(tipX, yOffset - bite);
            ctx.lineTo(hingeX, yOffset + 7);
            ctx.lineTo(innerX, yOffset + 5);
            ctx.stroke();
          }
        }
      }
    } else if (mode === 'trap') {
      if (integratedEdmTrapFx) {
        const subDrive = clamp(
          metrics.bass * 0.5
            + metrics.lowMid * 0.2
            + (metrics.bassPulse || 0) * 0.52
            + (metrics.kickPulse || 0) * 0.32
        );
        const hatDrive = clamp(
          metrics.high * 0.42
            + (metrics.highPulse || 0) * 0.68
            + metrics.presenceFlux * 1.8
        );
        const stopBurst = clamp(pulse * 0.62 + (metrics.kickPulse || 0) * 0.48);
        const subOuter = spectrumShell({
          // Let the 808 jaw sit just beyond the average waveform. Keeping it
          // inside the spectrum made the half-time mass disappear at normal
          // UI scale even though the geometry was present.
          scale: 1.025,
          detail: 0.66,
          offset: 3.5 + subDrive * 4.5,
          smoothing: 2
        });
        const subInner = spectrumShell({
          scale: 0.7 - stopBurst * 0.018,
          detail: 0.2,
          offset: -1,
          smoothing: 7
        });

        if (subOuter.length && subInner.length) {
          // The 808 is a lower pressure field cut directly from the live
          // contour. It reads as mass behind the waveform instead of three
          // detached decorative crescents.
          ctx.save();
          ctx.beginPath();
          ctx.rect(-radius * 1.55, -radius * 0.05, radius * 3.1, radius * 1.65);
          ctx.clip();
          this.traceBand(subOuter, [...subInner].reverse(), true);
          const pressureFill = ctx.createLinearGradient(0, -radius * 0.1, 0, radius * 1.1);
          pressureFill.addColorStop(0, rgba(theme.accent2, 0));
          pressureFill.addColorStop(0.35, rgba(theme.accent2, 0.025 + subDrive * 0.045));
          pressureFill.addColorStop(0.72, rgba(theme.accent, 0.07 + subDrive * 0.12));
          pressureFill.addColorStop(1, rgba(theme.hot, 0.025 + stopBurst * 0.055));
          ctx.fillStyle = pressureFill;
          ctx.shadowColor = theme.accent;
          ctx.shadowBlur = 13 + subDrive * 12;
          ctx.fill('evenodd');

          const floorCenters = [Math.PI / 2 - 0.58, Math.PI / 2, Math.PI / 2 + 0.58];
          floorCenters.forEach((center, index) => {
            signatureStroke(
              index === 1 ? theme.hot : (index ? theme.accent2 : theme.accent),
              1.1 + subDrive * 1.05 + (index === 1 ? stopBurst * 0.45 : 0),
              12 + subDrive * 10,
              0.12 + subDrive * 0.25 + stopBurst * (index === 1 ? 0.14 : 0.07)
            );
            strokeAngularContour(subOuter, center, 0.43 + subDrive * 0.035);
          });
          signatureStroke(
            theme.accent2,
            1.35 + subDrive * 1.15,
            11 + subDrive * 9,
            0.13 + subDrive * 0.23 + stopBurst * 0.08
          );
          strokeAngularContour(subInner, Math.PI / 2, Math.PI - 0.56);
          ctx.restore();

          // Fast hats live on the opposite half of the same contour. Only a
          // few ratchet ticks are lit at once; they move quickly around a slow
          // half-time body without being allowed to fire the impact layer.
          const hatContour = spectrumShell({
            scale: 1.065,
            detail: 0.5,
            offset: 4.5,
            smoothing: 3
          });
          const pointNearAngle = (targetAngle) => hatContour.reduce((best, point) => {
            const pointAngle = Math.atan2(point.y, point.x);
            const distance = Math.abs(Math.atan2(
              Math.sin(pointAngle - targetAngle),
              Math.cos(pointAngle - targetAngle)
            ));
            return !best || distance < best.distance ? { point, distance } : best;
          }, null)?.point;
          // Ten concise ticks keep the rapid ratchet legible without turning
          // the upper half into another noisy spectrum crown.
          const hatCount = 10;
          const ratchetTravel = (time / Math.max(185, beatPeriod * 0.23)) % 1;
          for (let hat = 0; hat < hatCount; hat += 1) {
            const angle = -Math.PI + ((hat + 0.5) / hatCount) * Math.PI;
            const anchor = pointNearAngle(angle);
            if (!anchor) continue;
            const phase = (ratchetTravel - hat / hatCount + 1) % 1;
            const gate = Math.max(0, 1 - Math.min(phase, 1 - phase) * 8) ** 2.2;
            const presence = 0.055 + hatDrive * 0.15 + gate * (0.28 + hatDrive * 0.36);
            const radialX = Math.cos(angle);
            const radialY = Math.sin(angle);
            const tangentX = -radialY;
            const tangentY = radialX;
            const tickLength = 5.2 + gate * 7.2 + hatDrive * 2.8;
            const lift = 8.5 + gate * 4.2;
            const px = anchor.x + radialX * lift;
            const py = anchor.y + radialY * lift;
            signatureStroke(hat % 3 === 0 ? theme.hot : (hat % 2 ? theme.accent2 : theme.accent), 0.72 + gate * 0.52, 7 + gate * 5, presence);
            ctx.beginPath();
            ctx.moveTo(px - tangentX * tickLength * 0.5, py - tangentY * tickLength * 0.5);
            ctx.lineTo(px + tangentX * tickLength * 0.5, py + tangentY * tickLength * 0.5);
            ctx.stroke();
          }
        }
      } else {
        drawBasslineRail({
          steps: 6, rate: 0.00215, phaseStep: 1.22, gatePower: 2.4,
          span: 0.26, reach: 15, width: 1.75, offset: -12, floor: 0.06, wobble: 2.2
        });
        const drop = metrics.bass * 5 + pulse * 8;
        for (let floor = 0; floor < 3; floor += 1) {
          const floorRadius = radius + 1 + floor * 8;
          signatureStroke(floor % 2 ? theme.accent2 : theme.accent, 1.2 + metrics.bass * 0.8, 12, 0.14 + metrics.bass * 0.26 + pulse * 0.14);
          ctx.beginPath();
          ctx.arc(0, drop * (0.36 + floor * 0.12), floorRadius, 0.28, Math.PI - 0.28);
          ctx.stroke();
        }
        for (let hat = -2; hat <= 2; hat += 1) {
          const hatPhase = (beatPhase * 2 + hat * 0.17 + 1) % 1;
          const px = hat * 12;
          const py = -radius - 14 + hatPhase * 24;
          const size = 2.3 + metrics.high * 2;
          signatureStroke(hat % 2 ? theme.accent2 : theme.hot, 0.72, 8, 0.1 + metrics.high * 0.22);
          ctx.beginPath();
          ctx.moveTo(px, py - size);
          ctx.lineTo(px + size, py + size);
          ctx.lineTo(px - size, py + size);
          ctx.closePath();
          ctx.stroke();
        }
      }
    } else if (mode === 'garage') {
      const futureGarage = theme.id === 'future-garage';
      const twoStepGarage = theme.id === 'two-step-garage';
      const speedGarage = theme.id === 'speed-garage';
      const basslineGarage = theme.id === 'bassline';
      const fourFloor = speedGarage || basslineGarage;
      const gatePresence = twoStepGarage ? 1
        : futureGarage ? 0.28
          : speedGarage ? 0.48
            : basslineGarage ? 0.42 : 0.72;
      const contact = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? pulse)
        : pulse * 0.32;
      const bassDrive = clamp(
        metrics.bass * (basslineGarage ? 0.54 : 0.42)
        + metrics.lowMid * 0.24
        + (metrics.bassPulse || 0) * (basslineGarage ? 0.58 : 0.42)
        + contact * 0.18
      );
      const shuffleDrive = clamp(
        metrics.mid * 0.42
        + metrics.high * 0.18
        + metrics.volume * 0.12
        + contact * 0.2
      );
      // Odd 16ths arrive late in UKG. The whole live-spectrum belt therefore
      // rocks across the centre with a delayed second half-cycle rather than
      // jittering randomly or rotating as another detached decoration.
      const halfBeat = (beatPhase * 2) % 1;
      const swungHalf = halfBeat < 0.58
        ? halfBeat / 0.58 * 0.5
        : 0.5 + (halfBeat - 0.58) / 0.42 * 0.5;
      const lateralSwing = Math.sin(swungHalf * TAU)
        * (1.2 + shuffleDrive * (twoStepGarage ? 3.1 : futureGarage ? 1.7 : 2.5));
      const bassSpring = Math.sin(beatPhase * TAU - 0.45) * bassDrive;
      const outerBase = spectrumShell({
        scale: futureGarage ? 0.94 : 0.96,
        detail: futureGarage ? 0.54 : basslineGarage ? 0.72 : 0.68,
        offset: 1 + bassDrive * (basslineGarage ? 3.8 : 2.6),
        smoothing: futureGarage ? 7 : speedGarage ? 2 : 4
      });
      const innerBase = spectrumShell({
        scale: futureGarage ? 0.7 : basslineGarage ? 0.72 : 0.74,
        detail: futureGarage ? 0.22 : 0.34,
        offset: 1 + bassDrive * 0.8,
        smoothing: futureGarage ? 10 : 7
      });
      const shapeGaragePoint = (point, index, inner = false) => {
        const angle = Math.atan2(point.y, point.x);
        const pointRadius = Math.hypot(point.x, point.y);
        const broadBass = Math.sin(angle * 2 - time * (fourFloor ? 0.00125 : 0.00092) + 0.5);
        const skippedStep = Math.max(0, Math.cos(angle * 4 - beatPhase * TAU + 0.55));
        const radialMove = inner
          ? broadBass * bassDrive * (basslineGarage ? 2.4 : 1.3)
          : broadBass * bassDrive * (basslineGarage ? 3.2 : speedGarage ? 2.1 : 1.75)
            + skippedStep ** 2 * shuffleDrive * (twoStepGarage ? 1.9 : 1.15)
            + bassSpring * (inner ? 0.25 : 0.55);
        const shapedRadius = pointRadius + radialMove;
        const sideWeight = 0.34 + Math.abs(Math.sin(angle)) * 0.66;
        return {
          x: Math.cos(angle) * shapedRadius + lateralSwing * sideWeight,
          y: Math.sin(angle) * shapedRadius
        };
      };
      const outer = outerBase.map((point, index) => shapeGaragePoint(point, index, false));
      const inner = innerBase.map((point, index) => shapeGaragePoint(point, index, true));
      const shuffleRail = outer.map((point, index) => {
        const innerPoint = inner[index] || point;
        const blend = futureGarage ? 0.48 : 0.58;
        return {
          x: innerPoint.x + (point.x - innerPoint.x) * blend,
          y: innerPoint.y + (point.y - innerPoint.y) * blend
        };
      });
      if (outer.length && inner.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // One translucent, spectrum-following belt carries bass mass, shuffle
        // steps and impact light as a single object. It replaces the old four
        // detached side brackets and the unrelated circular bezel.
        this.traceBand(outer, [...inner].reverse(), true);
        const beltGradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
        beltGradient.addColorStop(0, rgba(theme.accent2, 0.035 + shuffleDrive * 0.08));
        beltGradient.addColorStop(0.48, rgba(theme.accent, 0.055 + bassDrive * 0.11));
        beltGradient.addColorStop(1, rgba(theme.hot, futureGarage ? 0.025 : 0.04 + contact * 0.05));
        ctx.fillStyle = beltGradient;
        ctx.fill('evenodd');

        signatureStroke(
          theme.accent,
          0.75 + bassDrive * (basslineGarage ? 1.3 : 0.9) + contact * 0.35,
          10 + bassDrive * 12,
          0.1 + bassDrive * 0.2 + contact * 0.11
        );
        this.tracePoints(outer, true, true);
        ctx.stroke();

        // Do not close the inner contour into another ring. UKG is a lateral
        // push-pull: two elastic side pockets answer one another with the
        // swung half-beat while remaining attached to the same membrane.
        const sideExchange = 0.5 + 0.5 * Math.sin(swungHalf * TAU);
        [
          { angle: 0, color: theme.accent2, activity: sideExchange },
          { angle: Math.PI, color: theme.hot, activity: 1 - sideExchange }
        ].forEach((pocket) => {
          signatureStroke(
            pocket.color,
            0.62 + shuffleDrive * 0.5 + pocket.activity * 0.48,
            8 + shuffleDrive * 6 + pocket.activity * 5,
            0.075 + shuffleDrive * 0.12 + pocket.activity * 0.13
          );
          strokeAngularContour(shuffleRail, pocket.angle, futureGarage ? 0.72 : 0.92);
        });

        // A pair of elastic 2-step gates sits on the left and right seams of
        // the membrane. They alternately bow out on the swung half-beat, so
        // UKG reads as lateral push-pull even in a still frame instead of as
        // another circular spectrum with different smoothing.
        const nearestContourPoint = (points, targetAngle) => points.reduce((nearest, point) => {
          const angle = Math.atan2(point.y, point.x);
          const delta = Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle)));
          return !nearest || delta < nearest.delta ? { point, delta } : nearest;
        }, null)?.point;
        [
          { side: -1, activity: 1 - sideExchange, color: theme.hot },
          { side: 1, activity: sideExchange, color: theme.accent2 }
        ].forEach(({ side, activity, color }) => {
          const sideAngle = side > 0 ? 0 : Math.PI;
          const topAngle = side > 0 ? -0.58 : Math.PI + 0.58;
          const bottomAngle = side > 0 ? 0.58 : Math.PI - 0.58;
          const top = nearestContourPoint(outer, topAngle);
          const bottom = nearestContourPoint(outer, bottomAngle);
          if (!top || !bottom) return;
          const gateX = side * (radius + 3 + shuffleDrive * 3.2 + activity * 4.8);
          const gateY = (activity - 0.5) * (twoStepGarage ? 7 : 5.2);
          signatureStroke(
            color,
            0.48 + gatePresence * (0.57 + shuffleDrive * 0.56 + activity * 0.58),
            7 + gatePresence * (3 + shuffleDrive * 8 + activity * 7),
            gatePresence * (0.12 + shuffleDrive * 0.16 + activity * 0.2)
          );
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.bezierCurveTo(
            gateX,
            top.y * 0.62 + gateY,
            gateX,
            bottom.y * 0.62 + gateY,
            bottom.x,
            bottom.y
          );
          ctx.stroke();

          // Three attached late-hat notches turn the gate into a readable
          // shuffle mechanism without adding another orbit around the art.
          for (let notch = -1; notch <= 1; notch += 1) {
            const notchY = gateY + notch * 11;
            const length = 3.2 + activity * 3.6 + (notch === 0 ? shuffleDrive * 2.4 : 0);
            signatureStroke(
              color,
              0.42 + gatePresence * (0.22 + activity * 0.32),
              5 + gatePresence * (1 + activity * 4),
              gatePresence * (0.075 + activity * 0.11)
            );
            ctx.beginPath();
            ctx.moveTo(gateX - side * length * 0.5, notchY - 2.2);
            ctx.lineTo(gateX + side * length * 0.5, notchY + 2.2);
            ctx.stroke();
          }
        });

        // One bar is mapped to eight contour positions. 2-step uses kick slots
        // 0 and 5 and snare slots 2 and 6, leaving the expected empty kick
        // spaces. Speed Garage/Bassline retain the same shuffled hats over a
        // four-floor kick chassis, so the family resemblance remains visible.
        const kickSteps = fourFloor ? new Set([0, 2, 4, 6]) : new Set([0, 5]);
        const snareSteps = new Set([2, 6]);
        const loopTravel = (time / Math.max(900, beatPeriod * 4)) % 1;
        const circularDistance = (left, right) => {
          const distance = Math.abs(left - right);
          return Math.min(distance, 1 - distance);
        };
        for (let step = 0; step < 8; step += 1) {
          const oddSwing = step % 2 ? (twoStepGarage ? 0.024 : futureGarage ? 0.018 : 0.021) : 0;
          const center = (step / 8 + oddSwing) % 1;
          const active = Math.exp(-((circularDistance(loopTravel, center) / 0.07) ** 2));
          const isKick = kickSteps.has(step);
          const isSnare = snareSteps.has(step);
          const stepDrive = isKick
            ? bassDrive
            : isSnare
              ? clamp(metrics.mid * 0.65 + contact * 0.35)
              : shuffleDrive * (step % 2 ? 0.78 : 0.48);
          const color = isKick ? theme.accent : isSnare ? theme.hot : theme.accent2;
          signatureStroke(
            color,
            (isKick ? 1.05 : isSnare ? 0.9 : 0.58) + stepDrive * 0.72 + active * 0.65,
            7 + active * 9 + stepDrive * 5,
            (futureGarage ? 0.065 : 0.09) + stepDrive * 0.17 + active * 0.18
          );
          // Alternating steps sit on alternating sides of the same belt. The
          // eye reads the late odd 16ths as a braid, not a circular sequencer.
          const stepContour = step % 2 ? shuffleRail : outer;
          strokeContourSegment(
            stepContour,
            center,
            isKick ? 0.09 + bassDrive * 0.018 : isSnare ? 0.067 : 0.037
          );
        }

        if (twoStepGarage) {
          // Two deliberately broken bridges mark the kick positions omitted
          // by the canonical 2-step pattern. Each bridge still connects the
          // two membrane seams, but its silent middle makes the missing beat
          // readable without cutting a literal hole in the canvas.
          [3 / 8, 7 / 8].forEach((center, restIndex) => {
            const index = Math.round(center * outer.length) % outer.length;
            const outerPoint = outer[index];
            const innerPoint = inner[index];
            if (!outerPoint || !innerPoint) return;
            const pointAt = (ratio) => ({
              x: innerPoint.x + (outerPoint.x - innerPoint.x) * ratio,
              y: innerPoint.y + (outerPoint.y - innerPoint.y) * ratio
            });
            const nearInner = pointAt(0.34);
            const nearOuter = pointAt(0.66);
            signatureStroke(
              restIndex ? theme.accent2 : theme.hot,
              0.92 + shuffleDrive * 0.48,
              8 + shuffleDrive * 7,
              0.11 + shuffleDrive * 0.15
            );
            ctx.beginPath();
            ctx.moveTo(innerPoint.x, innerPoint.y);
            ctx.lineTo(nearInner.x, nearInner.y);
            ctx.moveTo(nearOuter.x, nearOuter.y);
            ctx.lineTo(outerPoint.x, outerPoint.y);
            ctx.stroke();
          });
        } else if (speedGarage) {
          // Four evenly spaced drive bridges expose Speed Garage's house kick
          // chassis while the shuffled belt and off-beat steps remain visible.
          for (let drive = 0; drive < 4; drive += 1) {
            const center = (drive / 4 + 0.01) % 1;
            const index = Math.round(center * outer.length) % outer.length;
            const outerPoint = outer[index];
            const innerPoint = inner[index];
            if (!outerPoint || !innerPoint) continue;
            signatureStroke(
              drive % 2 ? theme.accent2 : theme.accent,
              1 + bassDrive * 0.62 + contact * 0.35,
              9 + bassDrive * 8 + contact * 5,
              0.12 + bassDrive * 0.16 + contact * 0.11
            );
            ctx.beginPath();
            ctx.moveTo(innerPoint.x, innerPoint.y);
            ctx.lineTo(outerPoint.x, outerPoint.y);
            ctx.stroke();
            strokeContourSegment(outer, center, 0.09 + contact * 0.018);
          }
        } else if (futureGarage) {
          // Sparse, long reflections keep the broken UKG timing but let it
          // dissolve into atmosphere instead of reconstructing a hard grid.
          [0.08, 0.43, 0.76].forEach((center, echoIndex) => {
            signatureStroke(
              echoIndex === 1 ? theme.accent : theme.accent2,
              0.56 + shuffleDrive * 0.34,
              13 + shuffleDrive * 8,
              0.055 + shuffleDrive * 0.085
            );
            strokeContourSegment(echoIndex === 1 ? shuffleRail : inner, center, 0.2 + echoIndex * 0.025);
          });
        }

        // Bassline keeps two broad opposing low-end chambers rather than the
        // four narrow Speed Garage braces. Their alternating depth follows the
        // wobble and keeps the 4x4 branch visibly heavier without becoming
        // another Dubstep construction.
        if (basslineGarage) {
          [0.08, 0.58].forEach((center, index) => {
            signatureStroke(
              index ? theme.accent2 : theme.accent,
              0.88 + bassDrive * 1.35,
              9 + bassDrive * 10,
              0.07 + bassDrive * 0.22
            );
            strokeContourSegment(inner, center, 0.22 + bassDrive * 0.035);
          });
        }
        ctx.restore();
      }
    } else if (mode === 'breakbeat') {
      // Offset film-strip chunks jump in alternating directions on broken
      // beats. Small sprocket blocks make the discontinuity readable.
      ctx.rotate(-time * 0.00009);
      const chunks = 8;
      for (let chunk = 0; chunk < chunks; chunk += 1) {
        const angle = chunk / chunks * TAU;
        const direction = chunk % 2 ? -1 : 1;
        const jump = direction * (2.5 + metrics.high * 4 + (chunk % 3 === 0 ? pulse * 5 : 0));
        const inner = radius - 5 + jump;
        const outer = inner + 11 + metrics.high * 6;
        const slant = 0.055 * direction;
        signatureStroke(chunk % 3 ? theme.accent : theme.accent2, chunk % 3 ? 0.88 : 1.18, 9, 0.14 + metrics.high * 0.28 + pulse * 0.08);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle - 0.08) * inner, Math.sin(angle - 0.08) * inner);
        ctx.lineTo(Math.cos(angle + slant) * outer, Math.sin(angle + slant) * outer);
        ctx.lineTo(Math.cos(angle + 0.08) * inner, Math.sin(angle + 0.08) * inner);
        ctx.stroke();
        const blockX = Math.cos(angle + slant) * outer;
        const blockY = Math.sin(angle + slant) * outer;
        ctx.save();
        ctx.translate(blockX, blockY);
        ctx.rotate(angle);
        ctx.fillStyle = rgba(chunk % 3 ? theme.accent : theme.accent2, 0.18 + metrics.high * 0.3);
        ctx.shadowColor = chunk % 3 ? theme.accent : theme.accent2;
        ctx.shadowBlur = 8;
        ctx.fillRect(-2.2, -1.15, 4.4, 2.3);
        ctx.restore();
      }
    } else if (mode === 'drum-bass') {
      // The waveform is the hyperspace aperture. Every lane is anchored to its
      // smoothed live edge, then rendered as one gradient stroke. This is both
      // visually continuous and far cheaper than dozens of shadowed segments.
      const liquid = theme.id === 'liquid-dnb';
      const drumstep = theme.id === 'drumstep';
      const neuro = theme.id === 'neurofunk';
      const dancefloor = theme.id === 'dancefloor-dnb';
      const jumpUp = theme.id === 'jump-up-dnb';
      const jungle = theme.id === 'jungle';
      const aggressive = ['neurofunk', 'jump-up-dnb', 'drumstep'].includes(theme.id);
      const rhythmHit = metrics.rhythmNow
        ? clamp(metrics.rhythmStrength ?? metrics.impact ?? 0)
        : 0;
      const impactSurge = clamp(Math.pow(pulse, 0.62) * 0.76 + rhythmHit * 0.72);
      const neuroModulation = neuro
        ? clamp(
          metrics.lowMid * 0.28
            + metrics.mid * 0.22
            + metrics.flux * 0.34
            + (metrics.bassPulse || 0) * 0.3
        )
        : 0;
      const travelDrive = clamp(
        metrics.high * 0.28 + metrics.mid * 0.16 + metrics.flux * 0.24
          + pulse * 0.22 + neuroModulation * 0.16
      );
      const relativeLift = clamp(((metrics.relativeEnergy || 1) - 0.82) / 1.05);
      const sectionDrive = clamp(metrics.drive || 0);
      const drumDrive = drumstep
        ? clamp(metrics.high * 0.34 + metrics.mid * 0.22 + metrics.flux * 0.3 + (metrics.highPulse || 0) * 0.24)
        : 0;
      const halfTimeStep = Math.floor(time / beatPeriod) % 2;
      const halfTimeWeight = halfTimeStep ? 1 : 0.24;
      const bassSlam = drumstep
        ? clamp(
          (metrics.bass * 0.28
            + metrics.lowMid * 0.2
            + (metrics.bassPulse || 0) * 0.62
            + rhythmHit * 0.48) * halfTimeWeight
        )
        : 0;
      const energyDrive = Math.pow(clamp(Math.max(
        (travelDrive - 0.1) / 0.9,
        relativeLift * 0.72,
        sectionDrive * 0.78
      )), 1.3);
      const fullscreenOutput = document.body.dataset.stageOutput === 'true';
      const minimumLanes = liquid ? 5 : neuro ? 9 : drumstep ? 8 : aggressive ? 8 : 6;
      const baseMaximumLanes = liquid ? 17 : neuro ? 34 : drumstep ? 30 : aggressive ? 32 : 27;
      // Fullscreen makes every blurred streak several times more expensive.
      // Preserve the same depth range and density envelope with fewer lanes;
      // Neurofunk gets the strongest reduction because it also draws its
      // biomechanical link chain and an impact core over each live packet.
      const laneBudgetScale = fullscreenOutput ? (neuro ? 0.68 : 0.82) : 1;
      const maximumLanes = Math.max(minimumLanes, Math.round(baseMaximumLanes * laneBudgetScale));
      const densityDrive = drumstep
        ? clamp(0.02 + energyDrive * 0.66 + drumDrive * 0.52 + impactSurge * 0.18)
        : clamp(0.025 + energyDrive * 0.88 + impactSurge * 0.3);
      const targetDensity = minimumLanes + (maximumLanes - minimumLanes) * densityDrive;
      const densityFollow = targetDensity > this.dnbDensity
        ? impactSurge > 0.18 ? 0.21 : 0.08
        : 0.032;
      this.dnbDensity += (targetDensity - this.dnbDensity) * densityFollow;
      if (rhythmHit > 0.2) {
        const hitDensity = minimumLanes + (maximumLanes - minimumLanes)
          * clamp(0.32 + rhythmHit * 0.34);
        this.dnbDensity = Math.max(this.dnbDensity, hitDensity);
      }
      // A circular field-of-view boundary makes every direction feel like the
      // same first-person tunnel instead of a wide screen-space fan.
      // The capsule's visual centre sits only 152 px from its feathered left
      // stock edge, while the poster has more vertical stock around the key
      // visual. Keep the travelling field inside the capsule and deliberately
      // open the poster tunnel farther before its lines disappear.
      const posterLayout = document.body.dataset.layout === 'poster';
      const viewRadius = posterLayout
        ? liquid ? 170 : drumstep ? 178 : 176
        : liquid ? 145 : drumstep ? 152 : 150;
      const baseSpeed = liquid ? 0.00068 : neuro ? 0.0018 : drumstep ? 0.00158 : aggressive ? 0.00172 : 0.00148;
      const deltaMs = this.dnbLastAt ? clamp(time - this.dnbLastAt, 0, 42) : 16.667;
      this.dnbLastAt = time;
      // Keep the white flash on-screen long enough to be perceived while
      // preserving a sharp attack. It decays quickly after the detected hit.
      const flashTarget = Math.max(rhythmHit, clamp(pulse * 1.04));
      this.dnbImpactFlash = Math.max(
        flashTarget,
        this.dnbImpactFlash * Math.exp(-deltaMs / 108)
      );
      const impactFlash = clamp(this.dnbImpactFlash);
      // A detected impact briefly multiplies travel speed instead of merely
      // scaling the line brightness. The accumulated phase keeps the burst
      // continuous and prevents the tunnel from teleporting between frames.
      const speedDrive = drumstep
        ? 0.27 + energyDrive * 1.18 + drumDrive * 0.46 + impactSurge * 0.62 - bassSlam * 0.08
        : neuro
          ? 0.3 + energyDrive * 1.3 + neuroModulation * 0.38 + impactSurge * 0.9
          : 0.29 + energyDrive * 1.25 + impactSurge * 1.02;
      this.dnbTravelPhase += deltaMs * baseSpeed * speedDrive;
      const fract = (value) => value - Math.floor(value);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const lanes = [];

      for (let depthLayer = 0; depthLayer < 2; depthLayer += 1) {
        const depth = fract(this.dnbTravelPhase * (liquid ? 0.38 : 0.52) + depthLayer * 0.5);
        const shellFade = Math.sin(depth * Math.PI);
        const depthShell = spectrumShell({
          scale: 0.985 + depth * (liquid ? 0.14 : 0.19),
          detail: liquid ? 0.7 : neuro ? 0.9 : 0.78,
          offset: 0.5 + depth * 1.8,
          smoothing: liquid ? 6 : neuro ? 2 : 4
        });
        signatureStroke(
          depthLayer ? theme.accent2 : theme.accent,
          liquid ? 0.46 : 0.52,
          8 + travelDrive * 6,
          shellFade * (0.042 + travelDrive * 0.05 + impactSurge * 0.105)
        );
        strokeSpectrumContour(depthShell, true);
      }

      const portalRim = spectrumShell({
        scale: 1.012 - pulse * (liquid ? 0.002 : 0.008),
        detail: liquid ? 0.78 : neuro ? 0.96 : 0.86,
        offset: 1.2,
        smoothing: liquid ? 5 : neuro ? 2 : 3
      });
      signatureStroke(
        theme.accent2,
        (liquid ? 0.64 : 0.74) + impactSurge * 0.62,
        (liquid ? 11 : 8) + impactSurge * 9,
        (liquid ? 0.09 : 0.11) + travelDrive * 0.1 + impactSurge * 0.31
      );
      strokeSpectrumContour(portalRim, true);

      if (dancefloor) {
        // Four disciplined launch gates turn the shared DnB aperture into a
        // bright, symmetrical main-stage structure.
        const gatePulse = Math.exp(-beatPhase * 3.25);
        for (let gate = 0; gate < 4; gate += 1) {
          const angle = -Math.PI / 2 + gate * Math.PI / 2;
          const anchor = localSpectrumPointAtAngle(angle);
          const radiusAtGate = Math.max(1, Math.hypot(anchor.x, anchor.y));
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const tangentX = -sin;
          const tangentY = cos;
          const extension = 8 + gatePulse * 4.5 + impactSurge * 3.5;
          const halfWidth = 5.2 + gatePulse * 1.5;
          const innerRadius = radiusAtGate * 0.92;
          const outerRadius = radiusAtGate + extension;
          const color = gate % 2 ? theme.accent2 : theme.accent;
          ctx.beginPath();
          ctx.moveTo(cos * innerRadius + tangentX * halfWidth, sin * innerRadius + tangentY * halfWidth);
          ctx.lineTo(cos * outerRadius + tangentX * halfWidth * 0.58, sin * outerRadius + tangentY * halfWidth * 0.58);
          ctx.lineTo(cos * (outerRadius + 2.4), sin * (outerRadius + 2.4));
          ctx.lineTo(cos * outerRadius - tangentX * halfWidth * 0.58, sin * outerRadius - tangentY * halfWidth * 0.58);
          ctx.lineTo(cos * innerRadius - tangentX * halfWidth, sin * innerRadius - tangentY * halfWidth);
          signatureStroke(color, 0.9 + gatePulse * 0.48, 8 + gatePulse * 7, 0.12 + gatePulse * 0.2 + impactSurge * 0.12);
          ctx.stroke();
        }
      }

      if (jumpUp) {
        // Alternating low-frequency answers sit on opposite sides of the
        // portal, preserving the fast tunnel while making the bassline lead.
        const callSide = Math.floor(time / Math.max(1, beatPeriod)) % 2 ? 1 : -1;
        const callPulse = Math.exp(-beatPhase * 3.7);
        const bassBody = clamp(metrics.bass * 0.52 + metrics.lowMid * 0.28 + (metrics.bassPulse || 0) * 0.5);
        for (const side of [-1, 1]) {
          const angle = side > 0 ? 0 : Math.PI;
          const anchor = localSpectrumPointAtAngle(angle);
          const active = side === callSide ? 1 : 0.36;
          const extension = 7 + bassBody * 8 + callPulse * active * 10;
          const height = 5 + bassBody * 4.5 + callPulse * active * 2.5;
          const outerX = anchor.x + side * extension;
          const color = side > 0 ? theme.accent : theme.accent2;
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y - height * 0.58);
          ctx.quadraticCurveTo(anchor.x + side * extension * 0.45, anchor.y - height, outerX, anchor.y - height * 0.34);
          ctx.lineTo(outerX + side * 2.8, anchor.y);
          ctx.lineTo(outerX, anchor.y + height * 0.34);
          ctx.quadraticCurveTo(anchor.x + side * extension * 0.45, anchor.y + height, anchor.x, anchor.y + height * 0.58);
          ctx.closePath();
          ctx.fillStyle = rgba(color, 0.04 + bassBody * 0.09 + callPulse * active * 0.11);
          ctx.shadowColor = color;
          ctx.shadowBlur = 7 + callPulse * active * 12;
          ctx.fill();
          signatureStroke(color, 0.9 + callPulse * active * 0.72, 8 + callPulse * active * 10, 0.13 + bassBody * 0.14 + callPulse * active * 0.24);
          ctx.stroke();
        }
      }

      if (jungle) {
        // Uneven, rapidly re-ordered slices evoke chopped Amen breaks without
        // replacing the common forward motion with a separate badge.
        const amenPattern = [1, 0.28, 0.74, 0.42, 0.92, 0.2, 0.58, 0.34, 0.84, 0.24, 0.68, 0.46];
        const breakStep = Math.floor(time / Math.max(28, beatPeriod / 4));
        for (let slice = 0; slice < amenPattern.length; slice += 1) {
          const weight = amenPattern[(slice + breakStep) % amenPattern.length];
          const center = (slice / amenPattern.length + time * 0.000012) % 1;
          const width = 0.028 + weight * 0.018;
          const color = slice % 3 === 1 ? theme.accent2 : slice % 3 === 2 ? theme.hot : theme.accent;
          signatureStroke(color, 0.65 + weight * 0.7, 4 + weight * 7, 0.055 + weight * 0.14 + impactSurge * 0.08);
          strokeContourSegment(portalRim, center, width);

          const angle = center * TAU - Math.PI / 2;
          const anchor = localSpectrumPointAtAngle(angle);
          const radiusAtSlice = Math.max(1, Math.hypot(anchor.x, anchor.y));
          const notch = 2.5 + weight * 6 + metrics.high * 3;
          ctx.beginPath();
          ctx.moveTo(anchor.x * 0.95, anchor.y * 0.95);
          ctx.lineTo(Math.cos(angle) * (radiusAtSlice + notch), Math.sin(angle) * (radiusAtSlice + notch));
          ctx.stroke();
        }
      }

      if (neuro) {
        // Neurofunk keeps the DnB portal and turns its inner edge into a
        // biomechanical modulation chain. Each hinged link is anchored to the
        // live spectrum, so it appears to flex the aperture instead of sitting
        // on top as an unrelated mechanical ring.
        const servoOuter = spectrumShell({
          scale: 0.91,
          detail: 0.82,
          offset: -0.8 + Math.sin(time * 0.00125) * neuroModulation * 1.4,
          smoothing: 2
        });
        const servoInner = spectrumShell({
          scale: 0.765,
          detail: 0.44,
          offset: 0.5 - Math.sin(time * 0.00125) * neuroModulation * 0.9,
          smoothing: 4
        });
        if (servoOuter.length && servoInner.length) {
          const linkCount = 9;
          const crawl = time * (0.000055 + neuroModulation * 0.000028);
          ctx.save();
          ctx.lineCap = 'butt';
          ctx.lineJoin = 'miter';
          for (let link = 0; link < linkCount; link += 1) {
            const ratio = (link / linkCount + crawl) % 1;
            const index = Math.floor(ratio * servoOuter.length) % servoOuter.length;
            const outer = servoOuter[index];
            const inner = servoInner[index];
            const angle = Math.atan2(outer.y, outer.x);
            const tangentX = -Math.sin(angle);
            const tangentY = Math.cos(angle);
            const flex = Math.sin(time * 0.0021 + link * 1.73)
              * (1.2 + neuroModulation * 3.6);
            const joint = {
              x: inner.x * 0.44 + outer.x * 0.56 + tangentX * flex,
              y: inner.y * 0.44 + outer.y * 0.56 + tangentY * flex
            };
            const gate = 0.58 + 0.42 * Math.sin(time * 0.00155 + link * 1.19) ** 2;
            const color = link % 3 === 1 ? theme.accent2 : theme.accent;
            signatureStroke(
              color,
              0.68 + neuroModulation * 0.72,
              5 + neuroModulation * 7,
              (0.085 + neuroModulation * 0.17 + impactSurge * 0.1) * gate
            );
            ctx.beginPath();
            ctx.moveTo(inner.x, inner.y);
            ctx.lineTo(joint.x, joint.y);
            ctx.lineTo(outer.x, outer.y);
            ctx.stroke();

            const brace = 2.1 + neuroModulation * 2.3;
            ctx.beginPath();
            ctx.moveTo(joint.x - tangentX * brace, joint.y - tangentY * brace);
            ctx.lineTo(joint.x + tangentX * brace, joint.y + tangentY * brace);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (drumstep) {
        // Two bass jaws grow directly from the DnB portal on each side. Their
        // slower half-time slam contrasts with the continuously advancing drum
        // streaks, while low-mid modulation bends the jaws between impacts.
        const bassBody = clamp(
          metrics.bass * 0.46
            + metrics.lowMid * 0.3
            + metrics.mid * 0.1
            + (metrics.bassPulse || 0) * 0.42
        );
        const twistEnvelope = Math.sin(Math.PI * smoothstep(0.04, 0.84, beatPhase))
          * (1 - smoothstep(0.76, 0.98, beatPhase));
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.lineJoin = 'round';
        for (const side of [-1, 1]) {
          for (const row of [-1, 1]) {
            const targetAngle = Math.atan2(row * 14, side * 72);
            const anchor = localSpectrumPointAtAngle(targetAngle);
            const modulation = Math.sin(time * 0.0032 + row * 1.25 + side * 0.7)
              * bassBody * 2.2 * twistEnvelope;
            const anchorX = anchor.x;
            const anchorY = anchor.y + modulation;
            const extension = 5.8 + bassBody * 6.2 + bassSlam * 8.5;
            const hingeX = anchorX + side * (3.5 - bassSlam * 1.05);
            const tipX = anchorX + side * extension;
            // A narrow tip keeps this legible as a bass clamp rather than
            // another rounded waveform lobe. The root still follows the live
            // spectrum so it never becomes a detached Dubstep badge.
            const shoulder = 3.25 + bassBody * 1.25;
            const tipHalf = 0.75 + bassSlam * 0.72;
            const color = row > 0 ? theme.accent : theme.accent2;
            const jawFill = ctx.createLinearGradient(anchorX, anchorY, tipX, anchorY);
            jawFill.addColorStop(0, rgba(color, 0.035 + bassBody * 0.05));
            jawFill.addColorStop(0.58, rgba(color, 0.105 + bassBody * 0.11));
            jawFill.addColorStop(1, rgba(theme.hot, 0.06 + bassSlam * 0.15));
            ctx.beginPath();
            ctx.moveTo(anchorX, anchorY - shoulder * 0.72);
            ctx.lineTo(hingeX, anchorY - shoulder);
            ctx.lineTo(tipX, anchorY - tipHalf);
            ctx.lineTo(tipX, anchorY + tipHalf);
            ctx.lineTo(hingeX, anchorY + shoulder);
            ctx.lineTo(anchorX, anchorY + shoulder * 0.72);
            ctx.closePath();
            ctx.fillStyle = jawFill;
            ctx.shadowColor = color;
            ctx.shadowBlur = 7 + bassBody * 8 + bassSlam * 9;
            ctx.fill();
            signatureStroke(
              color,
              0.92 + bassBody * 0.62 + bassSlam * 0.52,
              7 + bassBody * 7 + bassSlam * 7,
              0.105 + bassBody * 0.15 + bassSlam * 0.22
            );
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      for (let lane = 0; lane < maximumLanes; lane += 1) {
        const visibility = clamp(this.dnbDensity - lane);
        if (visibility <= 0.001) continue;
        // Each streak owns a lifetime. When it exits the frame it respawns at
        // a genuinely new direction, curvature and speed instead of replaying
        // the same deterministic lane forever.
        let laneState = this.dnbLaneAnchors[lane];
        if (!laneState || !Number.isFinite(laneState.progress)) {
          laneState = {
            progress: Math.random(),
            angle: Math.random() * TAU - Math.PI,
            bend: (Math.random() - 0.5) * (liquid ? 12 : neuro ? 10 : 6),
            speed: neuro ? 0.78 + Math.random() * 0.6 : 0.86 + Math.random() * 0.3,
            colorSeed: Math.random(),
            anchor: null
          };
          this.dnbLaneAnchors[lane] = laneState;
        }
        laneState.progress += deltaMs * baseSpeed * speedDrive * laneState.speed;
        // Let a streak travel beyond the perspective ellipse and become fully
        // transparent before assigning it a new random lane. Resetting at 1.0
        // made fast passages look as if lines were being switched off.
        const exitProgress = 1.18;
        if (laneState.progress >= exitProgress) {
          laneState.progress %= exitProgress;
          laneState.angle = Math.random() * TAU - Math.PI;
          laneState.bend = (Math.random() - 0.5) * (liquid ? 12 : neuro ? 10 : 6);
          laneState.speed = neuro ? 0.78 + Math.random() * 0.6 : 0.86 + Math.random() * 0.3;
          laneState.colorSeed = Math.random();
          laneState.anchor = null;
        }
        const angle = laneState.angle;
        const livePortal = localSpectrumPointAtAngle(angle);
        const anchor = laneState.anchor || { ...livePortal };
        const anchorFollow = liquid ? 0.055 : 0.085;
        anchor.x += (livePortal.x - anchor.x) * anchorFollow;
        anchor.y += (livePortal.y - anchor.y) * anchorFollow;
        laneState.anchor = anchor;
        // Drumstep's Dubstep-weighted membrane is deliberately thick. Launch
        // its travel packets from the outside face of that membrane so the
        // first moving pixels are not visually swallowed by the bass body.
        const launchScale = drumstep
          ? 1.016 + drumDrive * 0.012 + impactSurge * 0.014
          : 0.99 + travelDrive * 0.016 + impactSurge * 0.018;
        const portal = { x: anchor.x * launchScale, y: anchor.y * launchScale };
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const edgeRadius = viewRadius;
        const edge = { x: cos * edgeRadius, y: sin * edgeRadius };
        // Curvature stays stable for one lifetime, avoiding jitter while the
        // next lifetime still gets a fresh path.
        const bend = laneState.bend + (neuro
          ? Math.sin(time * 0.00105 + lane * 1.37) * (2.2 + neuroModulation * 5.2)
          : 0);
        const control = {
          x: portal.x * 0.48 + edge.x * 0.52 - sin * bend,
          y: portal.y * 0.48 + edge.y * 0.52 + cos * bend
        };
        const warpPoint = (amount) => {
          if (amount > 1) {
            // Continue along the Bezier tangent at the screen edge. This gives
            // the line a first-person fly-past exit rather than bending back or
            // vanishing on the boundary of the visualizer.
            const overshoot = amount - 1;
            return {
              x: edge.x + (edge.x - control.x) * 2 * overshoot,
              y: edge.y + (edge.y - control.y) * 2 * overshoot
            };
          }
          const inverse = 1 - amount;
          return {
            x: inverse * inverse * portal.x + 2 * inverse * amount * control.x + amount * amount * edge.x,
            y: inverse * inverse * portal.y + 2 * inverse * amount * control.y + amount * amount * edge.y
          };
        };

        const color = drumstep
          // Bias the moving layer toward the secondary colour so its high-speed
          // filaments remain distinct from the low-frequency membrane.
          ? laneState.colorSeed > 0.72
            ? theme.hot
            : laneState.colorSeed > 0.2 ? theme.accent2 : theme.accent
          : laneState.colorSeed > 0.82
            ? theme.hot
            : laneState.colorSeed > 0.42 ? theme.accent2 : theme.accent;
        const phase = laneState.progress;
        const head = Math.pow(phase, liquid ? 1.16 : 1.28);
        const baseTail = Math.max(
          0,
          head - (liquid ? 0.22 : 0.25) - head * (liquid ? 0.36 : 0.44) - impactSurge * 0.06
        );
        // Once the head crosses the circular viewport, pull the tail toward it
        // so the visible segment becomes shorter as it leaves the field of
        // view, rather than keeping a full-length line until reset.
        const exitContraction = smoothstep(0.87, exitProgress, phase);
        const tail = baseTail + (head - baseTail) * exitContraction;
        const packet = [];
        const packetSegments = fullscreenOutput ? 12 : 18;
        for (let sample = 0; sample <= packetSegments; sample += 1) {
          packet.push(warpPoint(tail + (head - tail) * sample / packetSegments));
        }
        const fadeIn = smoothstep(0, 0.055, phase);
        const fadeOut = 1 - smoothstep(0.9, exitProgress, phase);
        const fade = fadeIn * fadeOut;
        lanes.push({
          color,
          guide: [warpPoint(0), control, edge],
          packet,
          head,
          fade,
          visibility,
          impactCore: !fullscreenOutput || lane % 2 === 0
        });
      }

      // Clip only the travelling field. A line can continue mathematically
      // beyond this lens, but the visible portion is progressively eaten by
      // the circular boundary while its lifetime fade completes.
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, viewRadius, 0, TAU);
      ctx.clip();

      // One batched, nearly invisible perspective field joins all moving
      // streaks to the same aperture without looking like a physical cage.
      ctx.strokeStyle = rgba(
        theme.accent2,
        (liquid ? 0.01 : 0.014) + travelDrive * (liquid ? 0.025 : 0.035)
      );
      ctx.lineWidth = 0.36;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      for (const lane of lanes) {
        const [start, control, end] = lane.guide;
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
      }
      ctx.stroke();

      for (const lane of lanes) {
        const tailPoint = lane.packet[0];
        const headPoint = lane.packet[lane.packet.length - 1];
        const opacity = clamp(lane.visibility * lane.fade * (
          drumstep
            ? 0.14 + lane.head * 0.38 + energyDrive * 0.38 + drumDrive * 0.34 + impactSurge * 0.48
            : 0.12 + lane.head * (liquid ? 0.32 : 0.42) + energyDrive * 0.46 + impactSurge * 0.72
        ));
        const gradient = ctx.createLinearGradient(tailPoint.x, tailPoint.y, headPoint.x, headPoint.y);
        // Keep the moving streak as one evenly weighted filament. Only the
        // very ends fade, avoiding the bright head/thin tail silhouette of a
        // meteor while the whole line can still brighten with section energy.
        gradient.addColorStop(0, rgba(lane.color, opacity * (drumstep ? 0.25 : 0.12)));
        gradient.addColorStop(0.08, rgba(lane.color, opacity * (drumstep ? 0.84 : 0.72)));
        gradient.addColorStop(0.5, rgba(lane.color, opacity * 0.82));
        gradient.addColorStop(0.92, rgba(lane.color, opacity * 0.72));
        gradient.addColorStop(1, rgba(lane.color, opacity * 0.12));
        ctx.strokeStyle = gradient;
        const streakWidth = liquid ? 0.82 : neuro ? 1.02 : drumstep ? 0.98 : aggressive ? 0.9 : 0.86;
        ctx.lineWidth = streakWidth;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 2 + travelDrive * 1.5 + impactSurge * 4.8;
        ctx.beginPath();
        ctx.moveTo(tailPoint.x, tailPoint.y);
        for (let index = 1; index < lane.packet.length; index += 1) {
          ctx.lineTo(lane.packet[index].x, lane.packet[index].y);
        }
        ctx.stroke();
        if (impactFlash > 0.01 && lane.impactCore) {
          // Brighten the complete filament on impact without adding a larger
          // head or a thicker white core; its apparent width stays constant.
          const coreAlpha = clamp(
            ((impactFlash - 0.01) * 2.05 + rhythmHit * 0.58)
            * lane.visibility * Math.max(0.38, lane.fade)
          );
          const whiteCore = ctx.createLinearGradient(tailPoint.x, tailPoint.y, headPoint.x, headPoint.y);
          whiteCore.addColorStop(0, rgba('#ffffff', coreAlpha * 0.06));
          whiteCore.addColorStop(0.09, rgba('#ffffff', coreAlpha * 0.56));
          whiteCore.addColorStop(0.5, rgba('#ffffff', coreAlpha * 0.64));
          whiteCore.addColorStop(0.91, rgba('#ffffff', coreAlpha * 0.56));
          whiteCore.addColorStop(1, rgba('#ffffff', coreAlpha * 0.06));
          ctx.strokeStyle = whiteCore;
          ctx.lineWidth = streakWidth;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 4 + impactFlash * 8;
          ctx.beginPath();
          ctx.moveTo(tailPoint.x, tailPoint.y);
          for (let index = 1; index < lane.packet.length; index += 1) {
            ctx.lineTo(lane.packet[index].x, lane.packet[index].y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      // The lens is primarily communicated by the streaks shortening at its
      // edge. Keep the physical rim almost imperceptible so it reads as a
      // field of view rather than another detached decorative circle.
      signatureStroke(theme.accent2, 0.36, 5, 0.012 + travelDrive * 0.018 + impactSurge * 0.025);
      ctx.beginPath();
      ctx.arc(0, 0, viewRadius, 0, TAU);
      ctx.stroke();
    } else if (mode === 'techno') {
      const hardTechno = theme.id === 'hard-techno';
      const industrialTechno = theme.id === 'industrial-techno';
      const acidTechno = theme.id === 'acid-techno';
      const melodicTechno = theme.id === 'melodic-techno';
      const minimalTechno = theme.id === 'minimal-techno';
      const forcefulTechno = hardTechno || industrialTechno;
      const bracketCount = minimalTechno ? 4 : industrialTechno ? 12 : 8;
      const fourStep = Math.floor(time / beatPeriod) % 4;
      const slotsPerStep = bracketCount / 4;
      const sequenceSlot = fourStep * slotsPerStep;
      const beatLatch = Math.exp(-beatPhase * (hardTechno ? 3.8 : industrialTechno ? 4.15 : 3.15));
      const textureTravel = ((time * (acidTechno ? -0.000018 : 0.000014)) % 1 + 1) % 1;

      // A narrow conveyor membrane turns the individual sequencer blocks into
      // one machine. It follows the live spectrum, compresses subtly on every
      // four-on-the-floor beat, and keeps the cold mechanical body coherent.
      const railOuter = spectrumShell({
        scale: (hardTechno ? 0.992 : industrialTechno ? 0.986 : 0.982)
          - beatLatch * (forcefulTechno ? 0.012 : 0.008),
        detail: industrialTechno ? 0.38 : hardTechno ? 0.22 : melodicTechno ? 0.1 : minimalTechno ? 0.06 : 0.14,
        offset: industrialTechno ? 3.1 : hardTechno ? 2.7 : 2,
        smoothing: industrialTechno ? 1 : hardTechno ? 3 : melodicTechno ? 9 : minimalTechno ? 11 : 5
      });
      const railInner = spectrumShell({
        scale: (industrialTechno ? 0.82 : 0.845) - beatLatch * (forcefulTechno ? 0.014 : 0.01),
        detail: industrialTechno ? 0.2 : hardTechno ? 0.12 : melodicTechno ? 0.04 : 0.06,
        offset: industrialTechno ? -0.2 : 0.4,
        smoothing: industrialTechno ? 2 : hardTechno ? 5 : melodicTechno ? 10 : 8
      });

      ctx.rotate(time * (hardTechno ? 0.000042 : industrialTechno ? 0.000033 : acidTechno ? -0.000034 : melodicTechno ? 0.000018 : 0.000026));
      if (railOuter.length && railInner.length) {
        const railFill = ctx.createRadialGradient(0, 0, radius * 0.58, 0, 0, radius + 18);
        railFill.addColorStop(0, rgba(theme.accent2, minimalTechno ? 0.022 : 0.04));
        railFill.addColorStop(0.58, rgba(theme.accent, (minimalTechno ? 0.032 : melodicTechno ? 0.052 : 0.065) + metrics.mid * (minimalTechno ? 0.035 : 0.065)));
        railFill.addColorStop(1, rgba(theme.hot, (minimalTechno ? 0.018 : industrialTechno ? 0.055 : 0.045) + beatLatch * 0.045));
        this.traceBand(railOuter, [...railInner].reverse(), true);
        ctx.fillStyle = railFill;
        ctx.fill('evenodd');

        signatureStroke(theme.accent, industrialTechno ? 1.24 : hardTechno ? 1.12 : melodicTechno ? 0.72 : 0.92, industrialTechno ? 7 : hardTechno ? 9 : melodicTechno ? 12 : 7, 0.135 + metrics.mid * 0.105 + beatLatch * 0.075);
        this.tracePoints(railOuter, true, true);
        ctx.stroke();
        signatureStroke(theme.accent2, industrialTechno ? 1.02 : hardTechno ? 0.92 : melodicTechno ? 0.66 : 0.76, industrialTechno ? 5 : melodicTechno ? 11 : 7, 0.1 + metrics.mid * 0.08 + beatLatch * 0.035);
        this.tracePoints(railInner, true, true);
        ctx.stroke();

        // Slow scan seams provide the small, continuous timbral evolution of
        // Techno without flashing a new random decoration every frame.
        const textureCount = industrialTechno ? 6 : hardTechno ? 4 : minimalTechno ? 2 : melodicTechno ? 3 : 3;
        for (let texture = 0; texture < textureCount; texture += 1) {
          const center = (textureTravel + texture / textureCount) % 1;
          signatureStroke(
            texture % 2 ? theme.accent2 : theme.hot,
            industrialTechno ? 1.02 : hardTechno ? 0.92 : melodicTechno ? 0.66 : 0.76,
            industrialTechno ? 5 : melodicTechno ? 10 : 7,
            (minimalTechno ? 0.06 : 0.09) + metrics.high * 0.105 + beatLatch * 0.035
          );
          strokeContourSegment(railOuter, center, industrialTechno ? 0.032 : hardTechno ? 0.052 : melodicTechno ? 0.1 : 0.068);
        }
      }

      for (let bracket = 0; bracket < bracketCount; bracket += 1) {
        const phase = time * 0.00022 + bracket * 1.37;
        const angle = bracket / bracketCount * TAU
          + (acidTechno ? Math.sin(phase) * 0.012 : 0)
          + (industrialTechno ? Math.sin(bracket * 2.41 + 0.3) * 0.034 : 0);
        const membrane = localSpectrumPointAtAngle(angle);
        const membraneRadius = Math.max(1, Math.hypot(membrane.x, membrane.y));
        const slotDistance = (bracket - sequenceSlot + bracketCount) % bracketCount;
        const primaryDrive = bracket % slotsPerStep === 0;
        const active = slotDistance === 0
          ? beatLatch
          : (slotsPerStep > 1 && slotDistance === 1 ? beatLatch * 0.38 : 0);
        const bandRadius = membraneRadius * (primaryDrive ? 0.975 : 0.87)
          + Math.sin(phase) * (minimalTechno ? 0.28 : 0.55)
          + (hardTechno ? (bracket % 2) * 1.15 : 0)
          + (industrialTechno ? Math.sin(bracket * 4.83) * 3.2 : 0)
          + active * (0.7 + pulse * 0.55);
        const blockWidth = minimalTechno
          ? 16
          : primaryDrive
            ? industrialTechno ? 17 + (bracket % 3) * 2.4 : hardTechno ? 23 : acidTechno ? 21.5 : melodicTechno ? 18 : 21
            : industrialTechno ? 8 + (bracket % 2) * 2.5 : hardTechno ? 11.5 : melodicTechno ? 8.5 : 10.5;
        const blockHeight = (minimalTechno ? 5.2 : primaryDrive ? industrialTechno ? 7.4 : hardTechno ? 8.3 : melodicTechno ? 5.8 : 7.3 : industrialTechno ? 4.1 : 3.25)
          + active * (2 + pulse * 1.25);
        const color = bracket % 2 ? theme.accent2 : theme.accent;
        ctx.save();
        ctx.rotate(angle + Math.PI / 2);
        ctx.translate(0, -bandRadius);
        if (industrialTechno) {
          const shear = Math.sin(bracket * 3.17) * 0.18;
          ctx.transform(1, shear, shear * 0.18, 1, 0, 0);
        }
        ctx.fillStyle = rgba(color,
          (minimalTechno ? 0.07 : primaryDrive ? 0.12 : 0.045)
          + metrics.mid * (primaryDrive ? 0.075 : 0.035)
          + active * 0.2);
        ctx.shadowColor = color;
        ctx.shadowBlur = (primaryDrive ? 9 : 4) + active * 13 + pulse * active * 5;
        ctx.fillRect(-blockWidth * 0.5, -blockHeight * 0.5, blockWidth, blockHeight);
        signatureStroke(
          color,
          industrialTechno ? 1.16 : hardTechno ? 1.18 : melodicTechno ? 0.72 : minimalTechno ? 0.82 : primaryDrive ? 1.04 : 0.78,
          industrialTechno ? 7 : hardTechno ? 10 : melodicTechno ? 10 : primaryDrive ? 8 : 6,
          (minimalTechno ? 0.14 : primaryDrive ? 0.22 : 0.095) + active * 0.32 + metrics.mid * 0.1
        );
        ctx.strokeRect(-blockWidth * 0.5, -blockHeight * 0.5, blockWidth, blockHeight);
        if (industrialTechno) {
          signatureStroke(theme.hot, 0.72, 3, 0.13 + metrics.high * 0.1 + active * 0.18);
          ctx.beginPath();
          ctx.moveTo(-blockWidth * 0.34, blockHeight * 0.42);
          ctx.lineTo(blockWidth * 0.27, -blockHeight * 0.42);
          ctx.stroke();
          ctx.fillStyle = rgba(theme.accent2, 0.26 + active * 0.22);
          ctx.shadowBlur = 4;
          ctx.fillRect(-blockWidth * 0.37, -1, 2, 2);
          ctx.fillRect(blockWidth * 0.29, -1, 2, 2);
        }
        if (primaryDrive) {
          // A short radial spindle distinguishes the four driving pistons from
          // the connector cells while keeping every part attached to the rail.
          signatureStroke(color, forcefulTechno ? 1.05 : melodicTechno ? 0.7 : 0.88, forcefulTechno ? 7 : melodicTechno ? 10 : 7, 0.105 + active * 0.2 + metrics.mid * 0.055);
          ctx.beginPath();
          ctx.moveTo(0, -blockHeight * 0.28);
          ctx.lineTo(0, blockHeight * 0.5 + (forcefulTechno ? 5.4 : melodicTechno ? 3.2 : 4.5));
          ctx.stroke();
        }
        ctx.restore();
      }

      if (acidTechno) {
        // Two continuous, phase-shifted resonance traces evoke the coupled
        // cutoff/resonance motion of a 303 without abandoning the Techno rail.
        for (let voice = 0; voice < 2; voice += 1) {
          ctx.beginPath();
          for (let pointIndex = 0; pointIndex <= 112; pointIndex += 1) {
            const angle = pointIndex / 112 * TAU;
            const membrane = localSpectrumPointAtAngle(angle);
            const membraneRadius = Math.hypot(membrane.x, membrane.y);
            const squelch = Math.sin(angle * 3 + time * 0.00115 + voice * 1.9)
              * (2.1 + metrics.mid * 3.8);
            const resonance = Math.sin(angle * 9 - time * 0.0017 + voice) * (0.5 + metrics.high * 1.2);
            const lineRadius = membraneRadius * (0.78 - voice * 0.095) + squelch + resonance;
            const px = Math.cos(angle) * lineRadius;
            const py = Math.sin(angle) * lineRadius;
            if (!pointIndex) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          signatureStroke(voice ? theme.accent2 : theme.accent, voice ? 0.78 : 1.08, 12, 0.18 + metrics.mid * 0.18 + pulse * 0.08);
          ctx.stroke();
        }
      } else if (melodicTechno) {
        // Slowly evolving partial contours form a harmonic stack. Each voice
        // remains tied to the live spectrum instead of becoming a static ring.
        for (let voice = 0; voice < 3; voice += 1) {
          const contour = spectrumShell({
            scale: 0.8 - voice * 0.095,
            detail: 0.045 + voice * 0.018,
            offset: Math.sin(time * (0.00042 + voice * 0.00007) + voice * 1.8) * 1.7,
            smoothing: 11
          });
          signatureStroke(
            voice === 1 ? theme.accent2 : voice === 2 ? theme.hot : theme.accent,
            0.66 + voice * 0.08,
            12 + voice * 2,
            0.08 + metrics.mid * 0.1 + (2 - voice) * 0.022
          );
          const center = ((time * (0.000018 + voice * 0.000005) + voice * 0.31) % 1 + 1) % 1;
          strokeContourSegment(contour, center, 0.2 + voice * 0.035);
        }
      }
    } else if (mode === 'trance') {
      const classicalFamily = theme.family === 'classical';
      const orchestral = classicalFamily || theme.id === 'soundtrack';
      const synthwave = theme.id === 'synthwave';
      const psychedelic = theme.id === 'psytrance';
      const uplifting = theme.id === 'uplifting-trance';
      const progressive = theme.id === 'progressive-trance';
      const immersion = clamp(metrics.mid * 0.46 + metrics.high * 0.24 + metrics.volume * 0.3);
      const breath = 0.5 + 0.5 * Math.sin(time * (progressive ? 0.0002 : 0.00027));

      if (synthwave) {
        // Synthwave owns a full-width horizon background drawn before this
        // local signature pass. The foreground visualizer remains empty so the
        // sunset, masked artwork and road are the complete visual language.
      } else if (classicalFamily) {
        const baroque = theme.id === 'baroque';
        const romantic = theme.id === 'romantic-classical';
        const opera = theme.id === 'opera';
        const modern = theme.id === 'modern-classical';
        const ensembleDrive = clamp(metrics.mid * 0.48 + metrics.high * 0.2 + metrics.volume * 0.32);
        const voiceCount = baroque ? 3 : modern ? 3 : romantic ? 2 : opera ? 3 : 2;

        // Each contour is a live orchestral voice: related enough to read as
        // one ensemble, but independently phrased instead of forming portals.
        for (let voice = 0; voice < voiceCount; voice += 1) {
          const contourRadius = radius + 2 + voice * (baroque ? 5.4 : modern ? 6.8 : 7.2);
          const direction = voice % 2 ? -1 : 1;
          const phrase = time * (modern ? 0.000032 : 0.000018) * direction + voice * 0.62;
          const verticalScale = modern ? 0.82 + voice * 0.012 : romantic ? 0.7 + voice * 0.045 : opera ? 0.76 + voice * 0.025 : 0.74 + voice * 0.03;
          const start = modern ? phrase : -Math.PI * (0.74 + voice * 0.035) + Math.sin(phrase) * 0.12;
          const span = modern ? Math.PI * (0.72 + voice * 0.08) : Math.PI * (1.38 + ensembleDrive * 0.24);
          ctx.save();
          ctx.rotate((voice - (voiceCount - 1) / 2) * (baroque ? 0.17 : modern ? 0.11 : 0.075));
          if (modern) ctx.setLineDash([5 + voice * 1.5, 9 - voice]);
          signatureStroke(
            voice % 3 === 1 ? theme.accent2 : voice % 3 === 2 ? theme.hot : theme.accent,
            (modern ? 0.62 : 0.7) + ensembleDrive * (romantic ? 0.7 : 0.42),
            11 + ensembleDrive * 8,
            0.07 + ensembleDrive * (romantic || opera ? 0.16 : 0.1)
          );
          ctx.beginPath();
          ctx.ellipse(0, (voice - (voiceCount - 1) / 2) * 1.8, contourRadius, contourRadius * verticalScale, phrase * 0.12, start, start + span);
          ctx.stroke();
          ctx.restore();
        }

        if (baroque) {
          // Counterpoint enters in paired, interlocking figures.
          for (let entry = 0; entry < 8; entry += 1) {
            const angle = entry * TAU / 8 + Math.sin(time * 0.00018 + entry) * 0.07;
            const inner = radius - 4 + (entry % 2) * 5;
            const outer = radius + 18 + (entry % 3) * 4 + ensembleDrive * 3;
            signatureStroke(entry % 2 ? theme.accent2 : theme.hot, 0.55 + ensembleDrive * 0.3, 7, 0.07 + ensembleDrive * 0.08);
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.78, 3 + entry % 2, angle + Math.PI * 0.7, angle + Math.PI * 1.55);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.78);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.78);
            ctx.stroke();
          }
        } else if (romantic) {
          // Broad crescendos lean beyond the ensemble without pulsing its scale.
          for (const side of [-1, 1]) {
            signatureStroke(side > 0 ? theme.accent : theme.accent2, 1.1 + ensembleDrive * 0.9, 18, 0.1 + ensembleDrive * 0.16);
            ctx.beginPath();
            ctx.ellipse(side * 5, 2, radius + 28 + ensembleDrive * 8, radius * 0.66, side * 0.13, side > 0 ? -1.42 : 1.7, side > 0 ? 0.56 : 3.7);
            ctx.stroke();
          }
        } else if (opera) {
          // Mirrored vocal fans open from a common stage rather than orbiting.
          for (const side of [-1, 1]) {
            for (let line = 0; line < 3; line += 1) {
              const spread = 0.34 + line * 0.2 + ensembleDrive * 0.06;
              signatureStroke(line === 1 ? theme.hot : side > 0 ? theme.accent2 : theme.accent, 0.75 + ensembleDrive * 0.62, 14, 0.08 + ensembleDrive * 0.13);
              ctx.beginPath();
              ctx.arc(0, radius * 0.42, radius + 12 + line * 8, -Math.PI / 2 + side * 0.04, -Math.PI / 2 + side * spread, side < 0);
              ctx.stroke();
            }
          }
        }
      } else if (orchestral) {
        // Soundtrack keeps a neutral cinematic portal, distinct from the
        // score-like voices used by the Classical family.
        for (let portal = 0; portal < 3; portal += 1) {
          const portalRadius = radius + 3 + portal * 9;
          const tilt = time * 0.000025 * (portal % 2 ? -1 : 1) + portal * 0.48;
          signatureStroke(portal % 2 ? theme.accent2 : theme.accent, 0.62 + portal * 0.05, 15, 0.07 + metrics.mid * 0.13);
          ctx.beginPath();
          ctx.ellipse(0, -portal, portalRadius, portalRadius * (0.74 + portal * 0.03), tilt, 0, TAU);
          ctx.stroke();
        }
      } else {
        this.drawTranceAccretionVortex(x, y, theme, metrics, time, spectrum);
        ctx.restore();
        return;

        // Treat the vortex as a refraction emitted by the spectrum membrane,
        // not an independent decal. Its inner/outer halves meet on the live
        // spectrum radius, while broad caustic pulses visibly travel inward.
        const wavePoints = spectrum?.outer || [];
        const waveSamples = wavePoints.map((point) => ({
          angle: Math.atan2(point.y - y, point.x - x),
          radius: Math.hypot(point.x - x, point.y - y),
          spectrum: point.spectrum || 0
        }));
        const waveMean = waveSamples.length
          ? waveSamples.reduce((sum, point) => sum + point.radius, 0) / waveSamples.length
          : radius;
        const waveSpread = waveSamples.length
          ? Math.sqrt(waveSamples.reduce((sum, point) => sum + (point.radius - waveMean) ** 2, 0) / waveSamples.length)
          : 0;
        const sampleWave = (angle) => {
          if (!waveSamples.length) return { radius: waveMean, spectrum: immersion };
          const ratio = ((angle + Math.PI / 2) % TAU + TAU) % TAU / TAU;
          const position = ratio * waveSamples.length;
          const low = Math.floor(position) % waveSamples.length;
          const high = (low + 1) % waveSamples.length;
          const mix = position - Math.floor(position);
          return {
            radius: waveSamples[low].radius * (1 - mix) + waveSamples[high].radius * mix,
            spectrum: waveSamples[low].spectrum * (1 - mix) + waveSamples[high].spectrum * mix
          };
        };

        const deltaMs = this.tranceLastAt ? clamp(time - this.tranceLastAt, 4, 36) : 16.667;
        this.tranceLastAt = time;
        const energyResponse = immersion > this.tranceEnergy ? 0.105 : 0.035;
        this.tranceEnergy += (immersion - this.tranceEnergy) * energyResponse * (deltaMs / 16.667);
        const flowSpeed = (psychedelic ? 0.00024 : progressive ? 0.000145 : 0.00018)
          + this.tranceEnergy * 0.000075 + pulse * 0.000035;
        this.tranceFlowPhase = (this.tranceFlowPhase + deltaMs * flowSpeed) % 1;
        const flowPhase = this.tranceFlowPhase * TAU;
        const liveDrive = clamp(this.tranceEnergy * 0.72 + pulse * 0.36 + waveSpread * 0.015);
        const vortexRotation = time * (psychedelic ? -0.00024 : progressive ? 0.000115 : 0.00017);

        // A thin refractive film shares the exact live spectrum contour. This
        // is the physical join between the audio wave and the spiral field.
        if (waveSamples.length) {
          const couplingOuter = waveSamples.map((point) => {
            const ripple = Math.sin(point.angle * (psychedelic ? 5 : 3) - flowPhase) * (0.55 + liveDrive * 1.45);
            const coupledRadius = point.radius + 1.5 + ripple + pulse * 1.6;
            return { x: Math.cos(point.angle) * coupledRadius, y: Math.sin(point.angle) * coupledRadius };
          });
          const couplingInner = [...waveSamples].reverse().map((point) => {
            const ripple = Math.sin(point.angle * (psychedelic ? 5 : 3) - flowPhase) * (0.22 + liveDrive * 0.62);
            const coupledRadius = point.radius - 3.2 + ripple;
            return { x: Math.cos(point.angle) * coupledRadius, y: Math.sin(point.angle) * coupledRadius };
          });
          this.traceBand(couplingOuter, couplingInner, true);
          const couplingFill = ctx.createRadialGradient(0, 0, Math.max(20, waveMean - 18), 0, 0, waveMean + 18);
          couplingFill.addColorStop(0, rgba(theme.accent2, 0.012));
          couplingFill.addColorStop(0.62, rgba(theme.accent, 0.06 + liveDrive * 0.055));
          couplingFill.addColorStop(0.86, rgba(theme.accent2, 0.13 + liveDrive * 0.12));
          couplingFill.addColorStop(1, rgba(theme.hot, 0));
          ctx.fillStyle = couplingFill;
          ctx.shadowColor = theme.accent2;
          ctx.shadowBlur = 12 + liveDrive * 14;
          ctx.globalAlpha = 0.62 + liveDrive * 0.22;
          ctx.fill('evenodd');
        }

        ctx.save();
        ctx.rotate(vortexRotation + Math.sin(flowPhase) * 0.018);
        ctx.scale(1.035 + Math.min(0.025, waveSpread * 0.0012), 0.9 + liveDrive * 0.012);
        const conic = ctx.createConicGradient(-Math.PI * 0.5 + breath * 0.24 + flowPhase * 0.045, 0, 0);
        conic.addColorStop(0, rgba(theme.accent, 0));
        conic.addColorStop(0.14, rgba(theme.accent, 0.38 + liveDrive * 0.2));
        conic.addColorStop(0.32, rgba(theme.accent2, 0.035));
        conic.addColorStop(0.52, rgba(theme.accent2, 0.34 + liveDrive * 0.22));
        conic.addColorStop(0.72, rgba(theme.hot, 0.025));
        conic.addColorStop(0.88, rgba(theme.hot, 0.2 + liveDrive * 0.14));
        conic.addColorStop(1, rgba(theme.accent, 0));
        ctx.globalAlpha = 0.12 + liveDrive * 0.13 + pulse * 0.025;
        ctx.filter = `blur(${(15 + liveDrive * 8).toFixed(1)}px)`;
        ctx.fillStyle = conic;
        ctx.beginPath();
        ctx.arc(0, 0, waveMean + 48 + breath * 7 + pulse * 3, 0, TAU);
        ctx.fill();
        ctx.restore();

        const armCount = psychedelic ? 4 : 3;
        const curl = psychedelic ? 1.82 : uplifting ? 1.22 : progressive ? 1.08 : 1.42;
        const armRotation = vortexRotation * 1.08 + Math.sin(flowPhase * 0.5) * (0.025 + liveDrive * 0.025);
        const armSteps = 42;
        const armPointAt = (arm, travel) => {
          const eased = travel * travel * (3 - 2 * travel);
          const travelingWave = Math.sin((travel * (psychedelic ? 1.72 : 1.28) - this.tranceFlowPhase) * TAU + arm * 0.73);
          const phaseWarp = Math.sin(flowPhase * 0.78 + arm * 1.7 + travel * TAU * (psychedelic ? 1.8 : 1.05));
          const angle = armRotation + arm / armCount * TAU
            + eased * curl
            + phaseWarp * (0.026 + liveDrive * (psychedelic ? 0.092 : 0.058))
            + travelingWave * (0.008 + liveDrive * 0.018);
          const localWave = sampleWave(angle);
          const join = 0.42;
          const joined = travel <= join
            ? smoothstep(0, join, travel)
            : 1;
          const outward = travel <= join ? 0 : smoothstep(join, 1, travel);
          const innerRadius = 49 + breath * 1.6;
          const coupledRadius = innerRadius + (localWave.radius - innerRadius) * joined
            + outward * (34 + (uplifting ? 7 : 0) + liveDrive * 6)
            + travelingWave * (0.5 + liveDrive * 2.15) * (0.2 + travel * 0.8)
            + pulse * Math.sin(Math.PI * travel) * 2.2;
          return {
            angle,
            radius: coupledRadius,
            x: Math.cos(angle) * coupledRadius,
            y: Math.sin(angle) * coupledRadius,
            spectrum: localWave.spectrum,
            travelingWave
          };
        };
        for (let arm = 0; arm < armCount; arm += 1) {
          const color = arm % 3 === 0 ? theme.accent : arm % 3 === 1 ? theme.accent2 : theme.hot;
          const outer = [];
          const inner = [];
          for (let step = 0; step <= armSteps; step += 1) {
            const travel = step / armSteps;
            const point = armPointAt(arm, travel);
            const halfWidth = (1.7 + travel * 5.5 + liveDrive * 2.8 + point.spectrum * 1.5 + point.travelingWave * 0.35)
              * Math.sin(Math.PI * (0.12 + travel * 0.82));
            const ellipse = 0.91 + travel * 0.04;
            outer.push({
              x: Math.cos(point.angle) * (point.radius + halfWidth) * (1.02 + travel * 0.025),
              y: Math.sin(point.angle) * (point.radius + halfWidth) * ellipse
            });
            inner.push({
              x: Math.cos(point.angle) * Math.max(1, point.radius - halfWidth) * (1.02 + travel * 0.025),
              y: Math.sin(point.angle) * Math.max(1, point.radius - halfWidth) * ellipse
            });
          }
          this.traceBand(outer, [...inner].reverse(), true);
          const ribbonFill = ctx.createRadialGradient(0, 0, 44, 0, 0, waveMean + 58);
          ribbonFill.addColorStop(0, rgba(color, 0.02));
          ribbonFill.addColorStop(0.24, rgba(color, 0.28 + liveDrive * 0.17));
          ribbonFill.addColorStop(0.7, rgba(color, 0.17 + liveDrive * 0.26));
          ribbonFill.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = ribbonFill;
          ctx.shadowColor = color;
          ctx.shadowBlur = 19 + liveDrive * 19 + pulse * 4;
          ctx.globalAlpha = 0.58 + liveDrive * 0.33;
          ctx.fill('evenodd');

          // Broad caustic packets move from the outside toward the spectrum
          // and core. They are surfaces, not extra orbiting dots, so the
          // motion stays immersive and visibly belongs to each ribbon.
          const packetCount = psychedelic ? 2 : 1;
          for (let packet = 0; packet < packetCount; packet += 1) {
            const travel = 1 - ((this.tranceFlowPhase + arm / armCount * 0.26 + packet * 0.49) % 1);
            const point = armPointAt(arm, travel);
            const packetSize = 5.5 + liveDrive * 5 + point.spectrum * 2.2 + pulse * 1.6;
            ctx.save();
            ctx.translate(point.x, point.y * (0.91 + travel * 0.04));
            ctx.rotate(point.angle + Math.PI / 2 + (psychedelic ? -0.22 : 0.16));
            ctx.scale(1.75 + liveDrive * 0.35, 0.52 + liveDrive * 0.16);
            const caustic = ctx.createRadialGradient(0, 0, 0, 0, 0, packetSize);
            caustic.addColorStop(0, rgba(theme.hot, 0.3 + liveDrive * 0.34 + pulse * 0.12));
            caustic.addColorStop(0.35, rgba(color, 0.22 + liveDrive * 0.26));
            caustic.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = caustic;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12 + liveDrive * 17;
            ctx.globalAlpha = 0.62 + liveDrive * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, packetSize, 0, TAU);
            ctx.fill();
            ctx.restore();
          }

          const joinPoint = armPointAt(arm, 0.42);
          this.glowCircle(
            joinPoint.x,
            joinPoint.y * 0.93,
            4.5 + liveDrive * 4 + pulse * 1.5,
            color,
            0.045 + liveDrive * 0.075 + pulse * 0.045
          );
        }

        // A soft central focus expands with the phrase energy, making the
        // vortex read as a deep aperture rather than a flat pinwheel.
        ctx.save();
        ctx.scale(1.03, 0.9);
        const focus = ctx.createRadialGradient(0, 0, 48, 0, 0, waveMean + 43);
        focus.addColorStop(0, rgba(theme.hot, 0));
        focus.addColorStop(0.48, rgba(theme.accent2, 0.018));
        focus.addColorStop(0.74, rgba(theme.accent, 0.105 + liveDrive * 0.12));
        focus.addColorStop(1, rgba(theme.accent2, 0));
        ctx.fillStyle = focus;
        ctx.shadowColor = theme.accent2;
        ctx.shadowBlur = 24 + liveDrive * 18;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(0, 0, waveMean + 41 + breath * 5 + pulse * 2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    } else if (mode === 'j-pop') {
      // The broad J-Pop fallback keeps a balanced melody braid. Subgenres use
      // that same live membrane as a shared base, then phrase it differently:
      // City Pop rolls through smooth chord pockets, Anime launches brighter
      // call-and-response arcs, and Vocaloid exposes a quantized syllable rail.
      const cityPop = theme.id === 'city-pop';
      const anime = theme.id === 'anime';
      const vocaloid = theme.id === 'vocaloid';
      const melodicDrive = clamp(
        metrics.mid * 0.43
        + metrics.high * 0.34
        + metrics.flux * 0.13
        + pulse * 0.2
      );
      const melodyLobes = cityPop ? 4 : vocaloid ? 8 : anime ? 7 : 6;
      const weaveRate = cityPop ? 0.0002 : vocaloid ? 0.00052 : anime ? 0.00044 : 0.00034;
      const weave = Math.sin(time * weaveRate) * (cityPop ? 0.003 : vocaloid ? 0.0045 : anime ? 0.0075 : 0.0065);
      const innerMelody = spectrumContour({
        scale: cityPop ? 0.99 : vocaloid ? 0.982 : 0.986,
        offset: cityPop ? -0.4 : vocaloid ? -1.8 : -1.2,
        phase: -weave,
        lobes: melodyLobes,
        waveAmount: 0.32 + melodicDrive * (cityPop ? 0.48 : vocaloid ? 0.66 : anime ? 0.94 : 0.78),
        teeth: vocaloid ? 12 : 0,
        toothThreshold: 0.82,
        toothAmount: vocaloid ? 0.7 + melodicDrive * 0.85 : 0
      });
      const hookMelody = spectrumContour({
        scale: 1.012,
        offset: cityPop ? 1.25 : anime ? 1.15 : 0.8,
        phase: weave * 0.35,
        lobes: melodyLobes,
        waveAmount: 0.62 + melodicDrive * (cityPop ? 0.78 : vocaloid ? 1.12 : anime ? 1.58 : 1.32),
        teeth: vocaloid ? 12 : 0,
        toothThreshold: 0.78,
        toothAmount: vocaloid ? 0.9 + melodicDrive * 1.15 : 0
      });
      const outerHarmony = spectrumContour({
        scale: cityPop ? 1.045 : anime ? 1.048 : 1.039,
        offset: cityPop ? 2.9 : anime ? 3.1 : 2.5,
        phase: weave,
        lobes: melodyLobes + (cityPop ? 0 : 1),
        waveAmount: 0.86 + melodicDrive * (cityPop ? 1.02 : vocaloid ? 1.52 : anime ? 2.12 : 1.78),
        teeth: vocaloid ? 12 : 0,
        toothThreshold: 0.75,
        toothAmount: vocaloid ? 1.15 + melodicDrive * 1.35 : 0
      });
      if (innerMelody.length && outerHarmony.length) {
        this.traceBand(outerHarmony, [...innerMelody].reverse(), true);
        const harmonyFill = ctx.createRadialGradient(0, 0, radius * 0.58, 0, 0, radius + 36);
        harmonyFill.addColorStop(0, rgba(theme.accent, 0.008));
        harmonyFill.addColorStop(0.72, rgba(theme.accent2, 0.018 + melodicDrive * 0.035));
        harmonyFill.addColorStop(1, rgba(theme.hot, 0.008 + melodicDrive * 0.016));
        ctx.fillStyle = harmonyFill;
        ctx.fill('evenodd');
      }

      const melodyLanes = cityPop
        ? [
            { points: hookMelody, color: theme.hot, width: 0.92, alpha: 0.13, span: 0.15, offset: 0 },
            { points: outerHarmony, color: theme.accent2, width: 1.02, alpha: 0.16, span: 0.12, offset: 0.46 }
          ]
        : [
            { points: innerMelody, color: theme.accent, width: vocaloid ? 0.72 : 0.62, alpha: vocaloid ? 0.12 : 0.095, span: vocaloid ? 0.055 : 0.085, offset: 0.62, reverse: true },
            { points: hookMelody, color: theme.hot, width: anime ? 1.02 : 0.84, alpha: anime ? 0.17 : 0.13, span: anime ? 0.16 : vocaloid ? 0.072 : 0.11, offset: 0 },
            { points: outerHarmony, color: theme.accent2, width: anime ? 1.18 : 1.06, alpha: anime ? 0.2 : 0.17, span: anime ? 0.11 : vocaloid ? 0.05 : 0.075, offset: 0.34 }
          ];
      const phraseRate = cityPop ? 0.000052 : vocaloid ? 0.00016 : anime ? 0.000132 : 0.000105;
      const phraseProgress = ((time * phraseRate) % 1 + 1) % 1;
      for (const [laneIndex, lane] of melodyLanes.entries()) {
        signatureStroke(
          lane.color,
          lane.width + melodicDrive * 0.32,
          9 + laneIndex * 2,
          lane.alpha + melodicDrive * 0.12
        );
        strokeSpectrumContour(lane.points, true);
        const laneProgress = lane.reverse ? 1 - phraseProgress : phraseProgress;
        const highlightCenter = (laneProgress + lane.offset) % 1;
        signatureStroke(
          laneIndex === 1 && !cityPop ? theme.hot : lane.color,
          lane.width + 0.72 + melodicDrive * 0.58,
          14 + melodicDrive * 8,
          0.16 + melodicDrive * 0.3
        );
        strokeContourSegment(lane.points, highlightCenter, lane.span + melodicDrive * 0.025);
        const headIndex = Math.floor(highlightCenter * lane.points.length) % Math.max(1, lane.points.length);
        const head = lane.points[headIndex];
        if (head) this.glowCircle(
          head.x,
          head.y,
          1.15 + melodicDrive * (anime ? 1.9 : 1.45),
          lane.color,
          0.09 + melodicDrive * (anime ? 0.22 : 0.16)
        );
      }

      if (cityPop) {
        // Four broad, syncopated chord pockets make the slower groove legible
        // without turning the visual into a literal record-player motif.
        const chordTravel = ((time * 0.000038) % 1 + 1) % 1;
        for (let chord = 0; chord < 4; chord += 1) {
          const center = (chord / 4 + 0.07) % 1;
          const distance = Math.abs(chordTravel - center);
          const wrapped = Math.min(distance, 1 - distance);
          const active = Math.exp(-wrapped * wrapped * 54);
          signatureStroke(
            chord % 2 ? theme.accent2 : theme.hot,
            0.82 + melodicDrive * 0.42 + active * 0.72,
            10 + active * 9,
            0.1 + melodicDrive * 0.1 + active * 0.18
          );
          strokeContourSegment(outerHarmony, center, 0.14 + active * 0.035);
        }
      } else if (anime) {
        // Paired sweeps trade places like an opening sequence moving from setup
        // to chorus. Their long spans keep Anime broad rather than pretending
        // it has one fixed acoustic instrumentation.
        const launch = ((time * 0.000115) % 1 + 1) % 1;
        for (let arc = 0; arc < 3; arc += 1) {
          const center = (launch + arc / 3) % 1;
          const response = (1 - launch + arc / 3 + 0.12) % 1;
          signatureStroke(
            arc === 1 ? theme.hot : theme.accent2,
            1.1 + melodicDrive * 0.72,
            15 + melodicDrive * 12,
            0.12 + melodicDrive * 0.22 + pulse * 0.07
          );
          strokeContourSegment(outerHarmony, center, 0.17 + melodicDrive * 0.025);
          signatureStroke(
            theme.accent,
            0.72 + melodicDrive * 0.45,
            10 + melodicDrive * 8,
            0.08 + melodicDrive * 0.15
          );
          strokeContourSegment(innerMelody, response, 0.1);
        }
      } else if (vocaloid && outerHarmony.length) {
        // Quantized ticks are anchored to the live contour so they read as
        // programmed syllables and note gates, not detached UI decoration.
        const activeStep = Math.floor(time / Math.max(90, beatPeriod / 4)) % 12;
        for (let step = 0; step < 12; step += 1) {
          const index = Math.round(step / 12 * outerHarmony.length) % outerHarmony.length;
          const point = outerHarmony[index];
          const next = outerHarmony[(index + 1) % outerHarmony.length];
          if (!point || !next) continue;
          const active = step === activeStep ? 1 : 0;
          const angle = Math.atan2(next.y - point.y, next.x - point.x);
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(angle);
          ctx.fillStyle = rgba(
            step % 3 === 0 ? theme.hot : step % 2 ? theme.accent2 : theme.accent,
            0.12 + melodicDrive * 0.17 + active * 0.3
          );
          ctx.shadowColor = step % 2 ? theme.accent2 : theme.accent;
          ctx.shadowBlur = 5 + melodicDrive * 5 + active * 10;
          ctx.fillRect(-2.4 - active * 0.8, -0.65 - active * 0.25, 4.8 + active * 1.6, 1.3 + active * 0.5);
          ctx.restore();
        }
      }
    } else if (mode === 'pop') {
      if (theme.id === 'k-pop') {
        // K-Pop keeps Pop's memorable hook at the center, but presents it as
        // a polished, tightly coordinated arrangement stack. Three contours
        // share one live spectrum membrane (low / vocal-mid / bright detail),
        // while short highlights exchange lanes every two beats. The result
        // reads as deliberate section and timbre switching, not random debris.
        const arrangementDrive = clamp(
          metrics.mid * 0.42
          + metrics.high * 0.27
          + metrics.bass * 0.18
          + metrics.flux * 0.13
        );
        const switchDrive = clamp(metrics.flux * 0.5 + metrics.high * 0.22 + pulse * 0.32);
        const switchPeriod = Math.max(420, beatPeriod * 2);
        const switchIndex = Math.floor(time / switchPeriod);
        const switchPhase = (time % switchPeriod) / switchPeriod;
        const switchSnap = Math.exp(-switchPhase * 7.5);
        const weave = Math.sin(time * 0.00048) * 0.0045;
        const bassLayer = spectrumContour({
          scale: 0.982,
          offset: -1.2,
          phase: -weave,
          lobes: 5,
          waveAmount: 0.3 + metrics.bass * 0.82
        });
        const hookLayer = spectrumContour({
          scale: 1.012,
          offset: 0.9 + switchSnap * 0.35,
          phase: weave * 0.3,
          lobes: 6,
          waveAmount: 0.64 + arrangementDrive * 1.18
        });
        const detailLayer = spectrumContour({
          scale: 1.043,
          offset: 2.8 + switchSnap * 0.7,
          phase: weave,
          lobes: 8,
          waveAmount: 0.72 + metrics.high * 1.65 + switchDrive * 0.35
        });

        if (bassLayer.length && detailLayer.length) {
          this.traceBand(detailLayer, [...bassLayer].reverse(), true);
          const stackFill = ctx.createRadialGradient(0, 0, radius * 0.57, 0, 0, radius + 36);
          stackFill.addColorStop(0, rgba(theme.accent2, 0.008));
          stackFill.addColorStop(0.58, rgba(theme.accent2, 0.024 + arrangementDrive * 0.03));
          stackFill.addColorStop(0.82, rgba(theme.accent, 0.035 + arrangementDrive * 0.055));
          stackFill.addColorStop(1, rgba(theme.hot, 0.006));
          ctx.fillStyle = stackFill;
          ctx.fill('evenodd');
        }

        const arrangementLayers = [
          { points: bassLayer, color: theme.accent2, width: 0.58, alpha: 0.075 },
          { points: hookLayer, color: theme.hot, width: 0.94, alpha: 0.14 },
          { points: detailLayer, color: theme.accent, width: 0.76, alpha: 0.105 }
        ];
        for (const [layerIndex, layer] of arrangementLayers.entries()) {
          signatureStroke(
            layer.color,
            layer.width + arrangementDrive * 0.34 + switchSnap * 0.22,
            8 + layerIndex * 3 + switchDrive * 5,
            layer.alpha + arrangementDrive * 0.1 + switchSnap * 0.06
          );
          strokeSpectrumContour(layer.points, true);
        }

        // Four coordinated point moves stay attached to the spectrum. Their
        // lane/color ordering changes as a group, like a new arrangement
        // section snapping into place while the underlying song stays whole.
        const laneColors = [theme.accent, theme.hot, theme.accent2];
        for (let move = 0; move < 4; move += 1) {
          const laneIndex = (move + switchIndex) % arrangementLayers.length;
          const lane = arrangementLayers[laneIndex];
          const center = (
            move / 4
            + switchIndex * 0.071
            + Math.sin(time * 0.0002 + move * 1.7) * 0.006
            + 1
          ) % 1;
          const color = laneColors[(laneIndex + switchIndex) % laneColors.length];
          signatureStroke(
            color,
            1.05 + arrangementDrive * 0.58 + switchSnap * 0.48,
            12 + arrangementDrive * 8 + switchSnap * 6,
            0.13 + arrangementDrive * 0.18 + switchSnap * 0.14
          );
          strokeContourSegment(lane.points, center, 0.055 + switchDrive * 0.018);
          const nodeIndex = Math.floor(center * lane.points.length) % Math.max(1, lane.points.length);
          const node = lane.points[nodeIndex];
          if (node) this.glowCircle(
            node.x,
            node.y,
            0.9 + arrangementDrive * 1.05 + switchSnap * 0.75,
            color,
            0.055 + arrangementDrive * 0.1 + switchSnap * 0.08
          );
        }

        // One brighter phrase repeatedly completes the loop: the visual Hook.
        // Its return is smooth and predictable even while the smaller layers
        // reconfigure around it.
        const hookProgress = ((time * 0.000135) % 1 + 1) % 1;
        signatureStroke(
          theme.hot,
          1.6 + arrangementDrive * 0.72 + pulse * 0.32,
          17 + arrangementDrive * 9,
          0.19 + arrangementDrive * 0.25 + pulse * 0.1
        );
        strokeContourSegment(hookLayer, hookProgress, 0.11 + arrangementDrive * 0.025);
      } else {
      // Pop uses one clean, rounded hook ribbon. A bright phrase repeatedly
      // travels through the same contour, giving it an immediate, memorable
      // pulse without forcing a strong geometric motif onto a broad genre.
      const clubPop = ['dance-pop', 'k-pop'].includes(theme.id);
      const softPop = theme.id === 'indie-pop';
      const hookDrive = clamp(metrics.mid * 0.5 + metrics.high * 0.24 + pulse * 0.22);
      const hookLobes = softPop ? 3 : clubPop ? 6 : 4;
      const drift = Math.sin(time * 0.00025) * (softPop ? 0.003 : 0.005);
      const innerVocal = spectrumContour({
        scale: 0.991,
        offset: -1,
        phase: -drift,
        lobes: hookLobes,
        waveAmount: 0.26 + hookDrive * (softPop ? 0.42 : 0.62)
      });
      const hookRibbon = spectrumContour({
        scale: 1.03,
        offset: 2.1,
        phase: drift,
        lobes: hookLobes,
        waveAmount: 0.62 + hookDrive * (softPop ? 1.05 : clubPop ? 1.85 : 1.38)
      });
      if (innerVocal.length && hookRibbon.length) {
        this.traceBand(hookRibbon, [...innerVocal].reverse(), true);
        const vocalFill = ctx.createRadialGradient(0, 0, radius * 0.58, 0, 0, radius + 32);
        vocalFill.addColorStop(0, rgba(theme.accent2, 0.006));
        vocalFill.addColorStop(0.74, rgba(theme.accent, 0.018 + hookDrive * 0.034));
        vocalFill.addColorStop(1, rgba(theme.hot, 0.006 + hookDrive * 0.012));
        ctx.fillStyle = vocalFill;
        ctx.fill('evenodd');
      }
      signatureStroke(theme.accent2, 0.54 + hookDrive * 0.24, 8, 0.07 + hookDrive * 0.09);
      strokeSpectrumContour(innerVocal, true);
      signatureStroke(theme.accent, 1.02 + hookDrive * 0.46, 13, 0.14 + hookDrive * 0.18);
      strokeSpectrumContour(hookRibbon, true);

      const hookProgress = ((time * (clubPop ? 0.000145 : softPop ? 0.000078 : 0.000105)) % 1 + 1) % 1;
      signatureStroke(theme.hot, 1.66 + hookDrive * 0.72, 17 + hookDrive * 7, 0.2 + hookDrive * 0.3);
      strokeContourSegment(hookRibbon, hookProgress, (softPop ? 0.12 : 0.105) + hookDrive * 0.025);
      // A short, quieter repeat trails the main phrase: the visual equivalent
      // of a hook returning, not another independent decorative orbit.
      signatureStroke(theme.accent2, 0.92 + hookDrive * 0.4, 11, 0.1 + hookDrive * 0.18);
      strokeContourSegment(innerVocal, (hookProgress + 0.9) % 1, 0.065 + hookDrive * 0.018);
      const hookIndex = Math.floor(hookProgress * hookRibbon.length) % Math.max(1, hookRibbon.length);
      const hookHead = hookRibbon[hookIndex];
      if (hookHead) this.glowCircle(
        hookHead.x,
        hookHead.y,
        1.35 + hookDrive * 1.55,
        theme.hot,
        0.1 + hookDrive * 0.18
      );
      if (clubPop) {
        signatureStroke(theme.accent2, 1 + hookDrive * 0.44, 13, 0.12 + hookDrive * 0.2);
        strokeContourSegment(hookRibbon, (hookProgress + 0.5) % 1, 0.06 + hookDrive * 0.014);
      }
      }
    } else if (mode === 'rock') {
      // The foreground sound-hole strings are rendered above the artwork.
      // This contour remains as the organic amplifier-feedback body beneath.
      const feedback = clamp(metrics.mid * 0.55 + metrics.high * 0.25 + pulse * 0.32);
      const sway = Math.sin(time * 0.0021) * (1.2 + feedback * 2.8);
      const outerFeedback = spectrumContour({
        scale: 1.014,
        offset: 0.7,
        shiftX: sway * 0.62,
        shiftY: -sway * 0.22,
        phase: 0.002 + feedback * 0.004,
        lobes: theme.id === 'punk' ? 5 : 3,
        waveAmount: 0.65 + feedback * (theme.id === 'punk' ? 2.5 : 1.65)
      });
      signatureStroke(theme.accent, 0.9 + feedback * 0.55, 11, 0.115 + feedback * 0.21);
      strokeSpectrumContour(outerFeedback, true);
    } else if (mode === 'metal') {
      // Metal inherits the foreground sound-hole strings while this live shell
      // supplies the compressed, distorted body beneath them.
      const extreme = ['deathcore', 'death-metal', 'black-metal'].includes(theme.id);
      const crack = Math.pow(pulse, 0.72);
      const teeth = extreme ? 12 : 9;
      const innerShell = spectrumContour({
        scale: 0.962 + crack * 0.006,
        offset: -1.2,
        phase: -0.003,
        teeth,
        toothThreshold: 0.58,
        toothAmount: 1.2 + metrics.high * 2.2
      });
      const outerShell = spectrumContour({
        scale: 1.03 - crack * 0.012,
        offset: 1.2,
        phase: 0.003,
        lobes: 5,
        waveAmount: 0.5 + metrics.high * 1.3,
        teeth,
        toothThreshold: extreme ? 0.5 : 0.62,
        toothAmount: (extreme ? 4.1 : 2.9) + crack * (extreme ? 6.8 : 4.8)
      });
      if (innerShell.length && outerShell.length) {
        this.traceBand(outerShell, [...innerShell].reverse(), false);
        ctx.fillStyle = rgba(theme.accent, 0.018 + metrics.high * 0.024 + crack * 0.04);
        ctx.fill('evenodd');
      }
      signatureStroke(theme.accent2, 0.72 + crack * 0.38, 8, 0.08 + metrics.high * 0.13 + crack * 0.1);
      strokeSpectrumContour(innerShell, false);
      signatureStroke(theme.accent, 1.17 + crack * 0.78, 13, 0.16 + metrics.high * 0.22 + crack * 0.26);
      strokeSpectrumContour(outerShell, false);
      if (crack > 0.15 && outerShell.length) {
        const crackCount = extreme ? 4 : 3;
        for (let fracture = 0; fracture < crackCount; fracture += 1) {
          const index = Math.floor((fracture / crackCount + 0.08) * outerShell.length) % outerShell.length;
          const anchor = outerShell[index];
          const angle = Math.atan2(anchor.y, anchor.x);
          const tangentX = -Math.sin(angle);
          const tangentY = Math.cos(angle);
          signatureStroke(fracture % 2 ? theme.accent2 : theme.hot, 0.58 + crack * 0.5, 9, crack * 0.2);
          ctx.beginPath();
          ctx.moveTo(anchor.x * 0.9, anchor.y * 0.9);
          ctx.lineTo(anchor.x * 0.96 + tangentX * 3.2, anchor.y * 0.96 + tangentY * 3.2);
          ctx.lineTo(anchor.x * 1.025 - tangentX * 2.1, anchor.y * 1.025 - tangentY * 2.1);
          ctx.stroke();
        }
      }
    } else if (mode === 'phonk') {
      const driftPhonk = theme.id === 'drift-phonk';
      const bassPressure = clamp(
        metrics.bass * 0.58
          + metrics.lowMid * 0.24
          + (metrics.bassPulse || 0) * 0.3
      );
      const texture = clamp(
        metrics.mid * 0.32
          + metrics.high * 0.18
          + (metrics.bodyFlux || 0) * 0.62
          + (metrics.presenceFlux || 0) * 0.42
      );
      const liveSurface = spectrumContour({
        scale: 1,
        offset: 0.4 + bassPressure * 0.9
      });
      const sampleBed = spectrumShell({
        scale: driftPhonk ? 0.75 : 0.68,
        detail: driftPhonk ? 0.6 : 0.52,
        offset: driftPhonk ? 2 : 4,
        smoothing: driftPhonk ? 3 : 5
      });

      if (liveSurface.length && sampleBed.length === liveSurface.length) {
        // Chopped sample cells occupy the full live waveform band. Their
        // stepped activation recalls looped sampler gates; broad filled cells
        // avoid the loose-line clutter that fought the artwork before.
        const sampleSlices = driftPhonk
          ? [
              { center: 0.06, span: 0.075, color: theme.accent },
              { center: 0.27, span: 0.06, color: theme.hot },
              { center: 0.49, span: 0.08, color: theme.accent2 },
              { center: 0.7, span: 0.055, color: theme.hot },
              { center: 0.88, span: 0.07, color: theme.accent }
            ]
          : [
              { center: 0.09, span: 0.13, color: theme.accent },
              { center: 0.37, span: 0.09, color: theme.hot },
              { center: 0.63, span: 0.14, color: theme.accent2 },
              { center: 0.86, span: 0.075, color: theme.hot }
            ];
        const stepDuration = Math.max(driftPhonk ? 180 : 320, beatPeriod * (driftPhonk ? 0.5 : 1));
        const activeSlice = Math.floor(time / stepDuration) % sampleSlices.length;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        sampleSlices.forEach((slice, index) => {
          const center = Math.round(slice.center * liveSurface.length) % liveSurface.length;
          const half = Math.max(3, Math.round(liveSurface.length * slice.span * 0.5));
          const active = index === activeSlice ? 1 : 0;
          const slicePath = (dx = 0, dy = 0) => {
            ctx.beginPath();
            for (let offset = -half; offset <= half; offset += 1) {
              const point = liveSurface[(center + offset + liveSurface.length) % liveSurface.length];
              if (offset === -half) ctx.moveTo(point.x + dx, point.y + dy);
              else ctx.lineTo(point.x + dx, point.y + dy);
            }
            for (let offset = half; offset >= -half; offset -= 1) {
              const point = sampleBed[(center + offset + sampleBed.length) % sampleBed.length];
              ctx.lineTo(point.x + dx, point.y + dy);
            }
            ctx.closePath();
          };
          const alpha = (driftPhonk ? 0.075 : 0.09)
            + texture * 0.075
            + active * (0.1 + pulse * 0.08);
          slicePath();
          const cellFill = ctx.createLinearGradient(-radius, -radius, radius, radius);
          cellFill.addColorStop(0, rgba(slice.color, alpha * 0.7));
          cellFill.addColorStop(0.52, rgba(slice.color, alpha));
          cellFill.addColorStop(1, rgba(theme.hot, alpha * 0.48));
          ctx.fillStyle = cellFill;
          ctx.shadowColor = slice.color;
          ctx.shadowBlur = (driftPhonk ? 6 : 9) + active * 6;
          ctx.fill();

          // Drift Phonk's clipped 808/cowbell transients briefly mis-register
          // the same filled cell along its tangent. No permanent RGB rails.
          if (driftPhonk && active && pulse > 0.12) {
            const anchor = liveSurface[center];
            const angle = Math.atan2(anchor.y, anchor.x);
            const tangentX = -Math.sin(angle);
            const tangentY = Math.cos(angle);
            const split = 1.2 + pulse * 2.1;
            ctx.shadowBlur = 3;
            slicePath(tangentX * -split, tangentY * -split);
            ctx.fillStyle = rgba(theme.accent, pulse * 0.08);
            ctx.fill();
            slicePath(tangentX * split, tangentY * split);
            ctx.fillStyle = rgba(theme.hot, pulse * 0.075);
            ctx.fill();
          }
        });
        ctx.restore();

        // Sparse rectangular oxide grain is embedded in the band instead of
        // orbiting in the empty centre. It remains secondary to the cells.
        const grainCount = driftPhonk ? 12 : 9;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let grain = 0; grain < grainCount; grain += 1) {
          const seed = grain * 12.9898 + 4.37;
          const travel = (0.5 + 0.5 * Math.sin(seed * 1.73 + time * (driftPhonk ? 0.0011 : 0.00042))) * 0.78 + 0.1;
          const index = Math.floor(((grain / grainCount + time * (driftPhonk ? 0.000025 : 0.000009)) % 1) * liveSurface.length);
          const outerPoint = liveSurface[index];
          const innerPoint = sampleBed[index];
          const gx = innerPoint.x + (outerPoint.x - innerPoint.x) * travel;
          const gy = innerPoint.y + (outerPoint.y - innerPoint.y) * travel;
          const angle = Math.atan2(outerPoint.y, outerPoint.x);
          const width = (driftPhonk ? 2.1 : 2.6) + (grain % 3) * 0.75;
          const height = 1.1 + (grain % 2) * 0.65;
          const color = grain % 3 === 0 ? theme.hot : grain % 2 ? theme.accent2 : theme.accent;
          const alpha = (driftPhonk ? 0.075 : 0.06) + texture * 0.065;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(angle + Math.PI / 2);
          ctx.fillStyle = rgba(color, alpha);
          ctx.shadowColor = color;
          ctx.shadowBlur = driftPhonk ? 4 : 5;
          ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
          ctx.restore();
        }
        ctx.restore();
      }
    } else if (mode === 'hip-hop') {
      if (integratedHipHopFx) {
        const experimentalHipHop = theme.id === 'experimental-hip-hop';
        const instrumentalHipHop = theme.id === 'instrumental-hip-hop';
        const lofiHipHop = theme.id === 'lo-fi-hip-hop';
        const pocketDrive = clamp(
          metrics.bass * 0.44
            + metrics.lowMid * 0.27
            + (metrics.bassPulse || 0) * 0.36
            + pulse * 0.22
        );
        const cadenceDrive = clamp(
          metrics.mid * 0.43
            + metrics.bodyFlux * 1.15
            + metrics.presenceFlux * 0.7
            + (metrics.midPulse || 0) * 0.32
        );
        const groove = clamp(
          0.24
            + pocketDrive * 0.38
            + cadenceDrive * 0.24
            + (metrics.modelGroove || 0) * 0.24
        );
        const grooveOuter = spectrumShell({
          scale: 0.99,
          detail: lofiHipHop ? 0.38 : instrumentalHipHop ? 0.56 : 0.7,
          offset: 2 + pocketDrive * (lofiHipHop ? 1.5 : instrumentalHipHop ? 2.2 : 2.8),
          smoothing: lofiHipHop ? 8 : instrumentalHipHop ? 6 : 4
        });
        const grooveInner = spectrumShell({
          scale: lofiHipHop ? 0.68 : 0.72,
          detail: lofiHipHop ? 0.16 : instrumentalHipHop ? 0.22 : 0.26,
          offset: 0,
          smoothing: lofiHipHop ? 11 : 8
        });

        if (grooveOuter.length && grooveInner.length) {
          // Hip-Hop's core is one repeating pocket. The filled loop follows
          // the live spectrum; it is neither a separate sequencer ring nor a
          // loose set of blocks pasted below it.
          this.traceBand(grooveOuter, [...grooveInner].reverse(), true);
          const loopFill = ctx.createLinearGradient(-radius, -radius, radius, radius);
          loopFill.addColorStop(0, rgba(theme.accent2, 0.035 + cadenceDrive * 0.045));
          loopFill.addColorStop(0.5, rgba(theme.hot, 0.018 + groove * 0.035));
          loopFill.addColorStop(1, rgba(theme.accent, 0.055 + pocketDrive * 0.085));
          ctx.fillStyle = loopFill;
          ctx.shadowColor = theme.accent;
          ctx.shadowBlur = 9 + pocketDrive * 9;
          ctx.fill('evenodd');

          signatureStroke(theme.accent, 1 + pocketDrive * 0.74, 11 + pocketDrive * 7, 0.11 + pocketDrive * 0.22);
          if (experimentalHipHop) {
            const cutDrift = Math.sin(time * 0.00037) * 0.07;
            [
              { center: -2.54, span: 0.48 },
              { center: -0.62, span: 0.31 },
              { center: 1.35, span: 0.59 }
            ].forEach((cut) => strokeAngularContour(grooveOuter, cut.center + cutDrift, cut.span));
          } else if (lofiHipHop) {
            // Lo-Fi Hip-Hop is a worn tape loop: four long phrases wobble
            // together while sparse oxide flecks live inside the spectrum.
            const tapeWobble = Math.sin(time * 0.00072) * (0.8 + cadenceDrive * 1.1);
            const tapeContour = grooveOuter.map((point) => {
              const angle = Math.atan2(point.y, point.x);
              const sourceRadius = Math.hypot(point.x, point.y) + Math.sin(angle * 2 + time * 0.00031) * 0.9;
              return {
                x: Math.cos(angle) * sourceRadius + tapeWobble,
                y: Math.sin(angle) * sourceRadius - tapeWobble * 0.22
              };
            });
            [
              { center: 0.08, span: 0.16, color: theme.accent },
              { center: 0.34, span: 0.12, color: theme.hot },
              { center: 0.59, span: 0.18, color: theme.accent2 },
              { center: 0.84, span: 0.1, color: theme.hot }
            ].forEach((phrase, index) => {
              const breathe = 0.5 + 0.5 * Math.sin(time * 0.00036 + index * 1.7);
              signatureStroke(
                phrase.color,
                0.72 + groove * 0.5 + breathe * 0.2,
                10 + breathe * 5,
                0.075 + groove * 0.11 + breathe * 0.045
              );
              strokeContourSegment(tapeContour, phrase.center, phrase.span);
            });
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            for (let grain = 0; grain < 10; grain += 1) {
              const travel = (grain / 10 + time * 0.000006 * (grain % 2 ? 1 : -1) + 1) % 1;
              const outerPoint = tapeContour[Math.floor(travel * tapeContour.length) % tapeContour.length];
              const innerPoint = grooveInner[Math.floor(travel * grooveInner.length) % grooveInner.length];
              const depth = 0.25 + (grain % 4) * 0.16;
              const gx = innerPoint.x + (outerPoint.x - innerPoint.x) * depth;
              const gy = innerPoint.y + (outerPoint.y - innerPoint.y) * depth;
              ctx.fillStyle = rgba(grain % 3 ? theme.accent : theme.accent2, 0.035 + cadenceDrive * 0.045);
              ctx.fillRect(gx - 1.4, gy - 0.55, 2.8 + (grain % 3), 1.1);
            }
            ctx.restore();
          } else if (instrumentalHipHop) {
            // Instrumental Hip-Hop puts composition and sampling in front:
            // twelve curved pads circulate around one unbroken low-end loop.
            const sampleContour = spectrumShell({ scale: 0.88, detail: 0.4, offset: 1, smoothing: 6 });
            const sampleTravel = (time / Math.max(2400, beatPeriod * 6)) % 1;
            const pattern = [1, 0.22, 0.5, 0.34, 0.82, 0.2, 0.62, 0.29, 0.74, 0.18, 0.46, 0.31];
            const activePad = Math.floor(sampleTravel * pattern.length) % pattern.length;
            pattern.forEach((weight, pad) => {
              const active = pad === activePad ? 1 : 0;
              const color = pad % 4 === 0 ? theme.accent : pad % 3 === 0 ? theme.hot : theme.accent2;
              signatureStroke(
                color,
                0.72 + weight * groove * 0.68 + active * 0.54,
                7 + active * 7,
                0.07 + weight * groove * 0.13 + active * 0.14
              );
              strokeContourSegment(sampleContour, (pad + 0.5) / pattern.length, 0.052);
            });
            signatureStroke(theme.accent, 1.02 + pocketDrive * 0.7, 11, 0.11 + pocketDrive * 0.18);
            strokeAngularContour(grooveOuter, Math.PI / 2, 1.28);
          } else {
            strokeAngularContour(grooveOuter, Math.PI / 2, Math.PI - 0.34);
          }

          if (experimentalHipHop) {
            // Experimental Rap deliberately breaks the loop into uneven
            // sample slots and phrase fragments.
            const loopContour = spectrumShell({
              scale: 0.9,
              detail: 0.48,
              offset: 1,
              smoothing: 5
            });
            const loopTravel = (time / Math.max(2200, beatPeriod * 8)) % 1;
            const circularDistance = (left, right) => {
              const distance = Math.abs(left - right) % 1;
              return Math.min(distance, 1 - distance);
            };
            const experimentalOffsets = [0, 0.11, 0.265, 0.39, 0.57, 0.745, 0.89];
            for (let step = 0; step < experimentalOffsets.length; step += 1) {
              const swingOffset = step % 2 ? 0.014 + groove * 0.007 : -0.002;
              const center = (experimentalOffsets[step] + swingOffset + 1) % 1;
              const active = Math.exp(-((circularDistance(loopTravel, center) / 0.085) ** 2));
              const kickStep = [0, 3, 5].includes(step);
              const snareStep = [2, 6].includes(step);
              const stepDrive = kickStep ? pocketDrive : snareStep ? cadenceDrive : groove * 0.55;
              const color = kickStep ? theme.accent : snareStep ? theme.hot : theme.accent2;
              signatureStroke(
                color,
                0.82 + stepDrive * 0.72 + active * 0.76,
                8 + active * 10,
                0.105 + stepDrive * 0.14 + active * (0.17 + groove * 0.1)
              );
              strokeContourSegment(loopContour, center, 0.062 + (kickStep ? pocketDrive * 0.012 : 0));
            }

            const cadenceContour = grooveInner.map((point, index) => {
              const angle = Math.atan2(point.y, point.x);
              const baseRadius = Math.hypot(point.x, point.y);
              const phrase = Math.sin(angle * 5 - time * 0.0011 + index * 0.003)
                * cadenceDrive * 1.35;
              return {
                x: Math.cos(angle) * (baseRadius + phrase),
                y: Math.sin(angle) * (baseRadius + phrase)
              };
            });
            const phraseDrift = Math.sin(time * 0.00048) * 0.055;
            [
              { center: -2.62, span: 0.3, color: theme.accent2 },
              { center: -2.03, span: 0.2, color: theme.hot },
              { center: -1.4, span: 0.36, color: theme.accent },
              { center: -0.72, span: 0.23, color: theme.accent2 }
            ].forEach((phrase, index) => {
              const looseTiming = Math.sin(time * 0.0017 + index * 1.8) * 0.025 * groove;
              signatureStroke(
                phrase.color,
                0.62 + cadenceDrive * 0.46,
                7 + cadenceDrive * 7,
                0.085 + cadenceDrive * 0.16 + (index === 2 ? pulse * 0.035 : 0)
              );
              strokeAngularContour(cadenceContour, phrase.center + phraseDrift + looseTiming, phrase.span);
            });
          } else {
            // Mainline Hip-Hop is deliberately horizontal and low-slung.
            // Three clipped cadence traces breathe like Rap phrasing while
            // the lower half of the live membrane carries the kick pocket.
            // This avoids the circular sequencer shared by the old UKG and
            // Phonk treatments.
            ctx.save();
            this.tracePoints(grooveOuter, true, true);
            ctx.clip();
            const laneLayouts = [
              { y: 23, span: 0.82, color: theme.accent2, speed: 0.00108 },
              { y: 35, span: 0.72, color: theme.hot, speed: 0.00134 },
              { y: 47, span: 0.58, color: theme.accent, speed: 0.0009 }
            ];
            laneLayouts.forEach((lane, laneIndex) => {
              const travel = Math.sin(time * 0.00042 + laneIndex * 1.7) * 6;
              const halfWidth = radius * lane.span;
              signatureStroke(
                lane.color,
                0.88 + cadenceDrive * 0.64 + (laneIndex === 2 ? pocketDrive * 0.34 : 0),
                7 + cadenceDrive * 8,
                0.12 + cadenceDrive * 0.2
              );
              ctx.beginPath();
              for (let point = 0; point <= 24; point += 1) {
                const ratio = point / 24;
                const px = -halfWidth + ratio * halfWidth * 2 + travel;
                const gate = Math.sin(Math.PI * ratio) ** 0.72;
                const syllable = Math.sin(ratio * TAU * (3 + laneIndex) - time * lane.speed + laneIndex)
                  * (1.2 + cadenceDrive * 3.1) * gate;
                const py = lane.y + syllable + (laneIndex === 2 ? pocketDrive * 2 : 0);
                if (point === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.stroke();
            });
            ctx.restore();

            // Hip-Hop's sampler is bent onto the lower live contour. Eight
            // unequal pads retain the kick/snare pocket of an MPC-style strip,
            // but the arc now shares the visualizer's radial construction and
            // no longer looks like a rectangular widget pasted underneath it.
            const deckTravel = (time / Math.max(1700, beatPeriod * 4)) % 1;
            const deckPattern = [1, 0.34, 0.58, 0.86, 0.4, 0.72, 0.3, 0.9];
            const activePad = Math.floor(deckTravel * deckPattern.length) % deckPattern.length;
            const deckSpan = 1.76;
            const padCell = deckSpan / deckPattern.length;
            // Leave a stable pocket between the sampler pads and the live
            // outer edge, whose low-frequency peaks can grow substantially.
            const deckRadiusScale = 0.84;
            const deckContour = grooveOuter.map((point) => ({
              x: point.x * deckRadiusScale,
              y: point.y * deckRadiusScale
            }));
            signatureStroke(theme.accent2, 0.86 + cadenceDrive * 0.32, 7, 0.1 + cadenceDrive * 0.1);
            strokeAngularContour(deckContour, Math.PI / 2, deckSpan + 0.08);
            for (let pad = 0; pad < deckPattern.length; pad += 1) {
              const active = pad === activePad ? 1 : 0;
              const padDrive = deckPattern[pad] * (pad % 4 === 0 ? pocketDrive : cadenceDrive);
              const color = pad % 4 === 0 ? theme.accent : pad % 4 === 2 ? theme.hot : theme.accent2;
              const oddSwing = pad % 2 ? 0.018 + groove * 0.012 : -0.004;
              const centerAngle = Math.PI / 2 - deckSpan / 2
                + (pad + 0.5) * padCell + oddSwing;
              const radialScale = deckRadiusScale + active * (0.014 + groove * 0.009);
              const padContour = grooveOuter.map((point) => ({
                x: point.x * radialScale,
                y: point.y * radialScale
              }));
              signatureStroke(
                color,
                3.05 + padDrive * 1.7 + active * (1.65 + groove * 0.9),
                8 + padDrive * 7 + active * 9,
                0.18 + padDrive * 0.24 + active * 0.31
              );
              strokeAngularContour(padContour, centerAngle, padCell * 0.7);

              // Short radial seams make the eight curved pads readable as a
              // sampler phrase, while remaining physically attached to it.
              const seamAngle = centerAngle - padCell * 0.35;
              const seamAnchor = padContour.reduce((nearest, point) => {
                const pointAngle = Math.atan2(point.y, point.x);
                const delta = Math.abs(Math.atan2(
                  Math.sin(pointAngle - seamAngle),
                  Math.cos(pointAngle - seamAngle)
                ));
                return !nearest || delta < nearest.delta ? { point, delta } : nearest;
              }, null)?.point;
              if (seamAnchor) {
                signatureStroke(color, 0.58 + active * 0.35, 5 + active * 4, 0.055 + padDrive * 0.09);
                ctx.beginPath();
                ctx.moveTo(seamAnchor.x * 0.972, seamAnchor.y * 0.972);
                ctx.lineTo(seamAnchor.x * 1.022, seamAnchor.y * 1.022);
                ctx.stroke();
              }
            }

            signatureStroke(theme.accent, 1.15 + pocketDrive * 0.92, 12 + pocketDrive * 10, 0.13 + pocketDrive * 0.24);
            strokeAngularContour(grooveOuter, Math.PI / 2, 1.08);
          }
        }
      } else {
        for (let block = -3; block <= 3; block += 1) {
          const angle = Math.PI / 2 + block * 0.14;
          const length = 4 + metrics.bass * (12 - Math.abs(block));
          signatureStroke(block % 2 ? theme.accent2 : theme.accent, 2.1, 8, 0.2 + metrics.bass * 0.34);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          ctx.lineTo(Math.cos(angle) * (radius + length), Math.sin(angle) * (radius + length));
          ctx.stroke();
        }
      }
    } else {
      for (let marker = 0; marker < 4; marker += 1) {
        const start = marker / 4 * TAU + time * 0.00004;
        signatureStroke(marker % 2 ? theme.accent2 : theme.accent, 0.8, 7, 0.14 + metrics.volume * 0.15);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 6, start, start + 0.24);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawImpactLayer(x, y, theme, metrics, heavy = false) {
    const ctx = this.ctx;
    const pulse = metrics.rhythmPulse || 0;
    const mode = theme.mode || 'electronic';
    if (mode === 'asmr' || theme.id === 'synthwave') return;
    if (mode === 'bilibili') return;
    const vortexTrance = mode === 'trance'
      && !['classical', 'soundtrack', 'synthwave'].includes(theme.id);
    const edmTrapImpact = mode === 'trap'
      && ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(theme.id);
    const style = {
      hardcore: { reach: 32, duration: 260, alpha: 0.6, width: 1.3, shapeResponse: 0.38, spring: 8.3, deform: 0.068, particles: 5, shard: true, impactSmooth: false },
      hardstyle: { reach: 30, duration: 280, alpha: 0.59, width: 1.3, shapeResponse: 0.28, spring: 7.5, deform: 0.064, particles: 4, shard: true, impactSmooth: false },
      house: { reach: 27, duration: 355, alpha: 0.3, width: 0.78, shapeResponse: 0.72, spring: 6.3, oscillation: 7.2, deform: 0.045, particles: 1 },
      'future-bass': { reach: 39, duration: 420, alpha: 0.42, width: 1.36, shapeResponse: 0.78, spring: 5.8, oscillation: 8.1, deform: 0.11, particles: 3 },
      'kawaii-bass': { reach: 34, duration: 450, alpha: 0.45, width: 1.5, shapeResponse: 0.82, spring: 6.1, oscillation: 8.5, deform: 0.095, particles: 3, paw: true },
      dubstep: { reach: 34, duration: 270, alpha: 0.5, width: 1.18, shapeResponse: 0.43, spring: 7.8, oscillation: 10.4, deform: 0.075, particles: 5, shard: true },
      trap: edmTrapImpact
        ? { reach: 35, duration: 350, alpha: 0.49, width: 1.45, shapeResponse: 0.48, spring: 6.5, oscillation: 7.5, deform: 0.078, particles: 4, shard: true }
        : { reach: 35, duration: 295, alpha: 0.48, width: 1.3, shapeResponse: 0.52, spring: 7.4, oscillation: 9.3, deform: 0.085, particles: 4, shard: true },
      garage: { reach: 29, duration: 345, alpha: 0.38, width: 1.02, shapeResponse: 0.76, spring: 6.35, oscillation: 8.4, deform: 0.058, particles: 2, impactSmooth: true },
      latin: { reach: 30, duration: 390, alpha: 0.38, width: 1.12, shapeResponse: 0.8, spring: 5.8, oscillation: 7.4, deform: 0.06, particles: 4, impactSmooth: true },
      breakbeat: { reach: 31, duration: 225, alpha: 0.44, width: 0.9, shapeResponse: 0.46, spring: 8.8, oscillation: 11.7, deform: 0.06, broken: 8, particles: 3, shard: true },
      'drum-bass': { reach: 22, duration: 205, alpha: 0.3, width: 0.72, shapeResponse: 0.24, spring: 10.2, deform: 0.036, particles: 1 },
      techno: { reach: 25, duration: 250, alpha: 0.38, width: 0.82, shapeResponse: 0.3, spring: 8, oscillation: 8, deform: 0.038, particles: 1 },
      trance: { reach: 34, duration: 470, alpha: 0.3, width: 0.72, shapeResponse: 0.78, spring: 5.4, oscillation: 6.8, deform: 0.055, particles: 0 },
      pop: { reach: 32, duration: 390, alpha: 0.35, width: 1.15, shapeResponse: 0.76, spring: 6.2, oscillation: 8.4, deform: 0.085, particles: 3 },
      'j-pop': { reach: 34, duration: 360, alpha: 0.4, width: 1.1, shapeResponse: 0.7, spring: 6.7, oscillation: 9.2, deform: 0.085, particles: 4 },
      rock: { reach: 28, duration: 255, alpha: 0.43, width: 1, shapeResponse: 0.42, spring: 8.3, oscillation: 10.3, deform: 0.06, particles: 4, shard: true },
      metal: { reach: 32, duration: 265, alpha: 0.63, width: 1.32, shapeResponse: 0.32, spring: 9.2, deform: 0.068, particles: 6, shard: true },
      'hip-hop': { reach: 28, duration: 390, alpha: 0.4, width: 1.55, shapeResponse: 0.74, spring: 5.35, oscillation: 6.2, deform: 0.058, particles: 2 },
      phonk: theme.id === 'drift-phonk'
        ? { reach: 30, duration: 235, alpha: 0.43, width: 1.2, shapeResponse: 0.48, spring: 7.9, oscillation: 9.4, deform: 0.068, particles: 4, shard: true }
        : { reach: 25, duration: 300, alpha: 0.34, width: 1.3, shapeResponse: 0.7, spring: 6.2, oscillation: 7.1, deform: 0.052, particles: 3 },
      rnb: { reach: 22, duration: 500, alpha: 0.24, width: 1.05, shapeResponse: 0.9, spring: 4.4, oscillation: 5.4, deform: 0.035, particles: 1 },
      bilibili: { reach: 24, duration: 410, alpha: 0.3, width: 0.92, shapeResponse: 0.82, spring: 5.8, oscillation: 6.8, deform: 0.038, particles: 2, impactSmooth: true },
      electronic: { reach: 29, duration: 310, alpha: 0.36, width: 0.9, shapeResponse: 0.55, spring: 6.8, oscillation: 8.2, deform: 0.055, particles: 2 }
    }[mode] || { reach: 29, duration: 310, alpha: 0.36, width: 0.9, shapeResponse: 0.55, spring: 6.8, oscillation: 8.2, deform: 0.055, particles: 2 };

    // Happy and UK Hardcore retain the fast pulse, but use the friendlier
    // rounded impact language instead of Gabber/Frenchcore-style shrapnel.
    if (mode === 'hardcore' && ['happy-hardcore', 'uk-hardcore'].includes(theme.id)) {
      Object.assign(style, {
        reach: 28, duration: 315, alpha: 0.44, width: 1.05,
        shapeResponse: 0.58, spring: 7.1, deform: 0.05,
        particles: 2, shard: false, impactSmooth: true
      });
    }
    if (theme.id === 'future-house') {
      Object.assign(style, {
        reach: 31, duration: 325, alpha: 0.36, width: 0.94,
        shapeResponse: 0.78, spring: 7.5, oscillation: 9,
        deform: 0.058, particles: 1, impactSmooth: true
      });
    }
    if (theme.id === 'tech-house') {
      Object.assign(style, {
        reach: 29, duration: 320, alpha: 0.34, width: 0.9,
        shapeResponse: 0.68, spring: 7.1, oscillation: 8.2,
        deform: 0.044, particles: 1, impactSmooth: true
      });
    }
    if (theme.id === 'progressive-house') {
      Object.assign(style, {
        reach: 35, duration: 430, alpha: 0.34, width: 1.02,
        shapeResponse: 0.84, spring: 5.35, oscillation: 6.4,
        deform: 0.05, particles: 2, impactSmooth: true
      });
    }
    if (theme.id === 'bass-house') {
      Object.assign(style, {
        reach: 34, duration: 305, alpha: 0.46, width: 1.08,
        shapeResponse: 0.68, spring: 7.8, oscillation: 9.4,
        deform: 0.072, particles: 3, impactSmooth: true
      });
    }
    if (mode === 'garage') {
      if (theme.id === 'future-garage') {
        Object.assign(style, {
          reach: 25, duration: 430, alpha: 0.27, width: 1.08,
          shapeResponse: 0.88, spring: 4.9, oscillation: 6,
          deform: 0.035, particles: 1, impactSmooth: true
        });
      } else if (theme.id === 'two-step-garage') {
        Object.assign(style, {
          reach: 30, duration: 365, alpha: 0.38, width: 1.05,
          shapeResponse: 0.82, spring: 6.5, oscillation: 8.8,
          deform: 0.06, particles: 2, impactSmooth: true
        });
      } else if (['speed-garage', 'bassline'].includes(theme.id)) {
        Object.assign(style, {
          reach: theme.id === 'bassline' ? 34 : 31,
          duration: theme.id === 'bassline' ? 330 : 295,
          alpha: 0.43, width: 1.12,
          shapeResponse: 0.68, spring: theme.id === 'bassline' ? 6.8 : 7.4,
          oscillation: 9.2, deform: 0.067, particles: 3, impactSmooth: true
        });
      }
    }
    if (theme.id === 'big-room-house') {
      Object.assign(style, {
        reach: 40, duration: 365, alpha: 0.48, width: 1.08,
        shapeResponse: 0.84, spring: 6.9, oscillation: 7.4,
        deform: 0.078, particles: 2, impactSmooth: true
      });
    }
    if (theme.id === 'bass-music') {
      Object.assign(style, {
        reach: 35, duration: 345, alpha: 0.46, width: 1.22,
        shapeResponse: 0.7, spring: 6.7, oscillation: 7.5,
        deform: 0.076, particles: 3, shard: false, impactSmooth: true
      });
    }
    if (theme.id === 'drumstep') {
      Object.assign(style, {
        reach: 32, duration: 255, alpha: 0.48, width: 1.06,
        shapeResponse: 0.4, spring: 9.1, oscillation: 10.1,
        deform: 0.066, particles: 3, shard: true, impactSmooth: false
      });
    }

    // The Trance vortex replaces both the normal spectrum membrane and its
    // derived contour shockwave. Beats remain visible through title motion,
    // spiral acceleration, relighting and the all-direction particle front.
    if (!vortexTrance) this.shockwave(x, y, theme, metrics, style);
    if (!vortexTrance && mode !== 'phonk' && pulse > 0.025 && this.lastSpectrum?.outer?.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const radius = (this.lastSpectrum.baseRadius || 64) + pulse * style.reach;
      const glow = ctx.createRadialGradient(x, y, 40, x, y, radius);
      glow.addColorStop(0, rgba(theme.hot, pulse * (['future-bass', 'kawaii-bass', 'pop'].includes(mode) ? 0.17 : 0.11)));
      glow.addColorStop(0.55, rgba(theme.accent, pulse * 0.08));
      glow.addColorStop(1, rgba(theme.accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
      const deformation = 1 + pulse * style.deform;
      const pulseShape = this.lastSpectrum.outer.map((point) => {
        const angle = point.angle ?? Math.atan2(point.y - y, point.x - x);
        const genreShape = genreImpactRadiusRatio(theme, angle, pulse);
        return {
          x: x + (point.x - x) * deformation * genreShape,
          y: y + (point.y - y) * deformation * genreShape
        };
      });
      const contact = pulse ** 2.35;
      this.strokeGlow(theme.hot, style.width + contact * (heavy ? 2.4 : 1.55), heavy ? 21 : 16, contact * (0.28 + style.alpha * 0.82));
      this.tracePoints(pulseShape, true, this.lastSpectrum.options?.smoothPath);
      ctx.stroke();
      if (contact > 0.08) {
        this.strokeGlow(theme.accent, 0.72 + contact * 1.15, 24, contact * 0.32);
        this.tracePoints(pulseShape, true, this.lastSpectrum.options?.smoothPath);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (metrics.rhythmNow && !vortexTrance) this.spawnGenreParticles(x, y, theme, metrics);
  }

  applyImpactPostFx(x, y, theme, metrics) {
    const fx = resolveImpactFx(theme, metrics);
    if (fx.amount < 0.015 || !this.fxCtx) return;
    // At fullscreen resolution this pass copies the entire transparent canvas,
    // then replays it up to four more times for blur, echo, chroma and slices.
    // The foreground already carries its impact through the live contour,
    // shockwave, particles and text treatment, so the redundant full-frame
    // post-process is reserved for the much smaller desktop layouts.
    if (document.body.dataset.stageOutput === 'true') return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const pixelX = x * this.dpr;
    const pixelY = y * this.dpr;
    const buffer = this.fxCtx;
    buffer.save();
    buffer.setTransform(1, 0, 0, 1, 0, 0);
    buffer.clearRect(0, 0, width, height);
    buffer.globalCompositeOperation = 'source-over';
    buffer.globalAlpha = 1;
    buffer.filter = 'none';
    buffer.drawImage(this.canvas, 0, 0);
    buffer.restore();

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // Soft genres receive a wider bloom; hard genres retain a crisper base
    // and put more of the same impact value into slices and chroma echoes.
    if (fx.bloom > 0.01) {
      ctx.globalAlpha = 0.035 + fx.bloom * 0.15;
      ctx.filter = `blur(${((0.65 + fx.blur * 4.6) * this.dpr).toFixed(2)}px) brightness(${fx.exposure.toFixed(3)}) saturate(${fx.saturation.toFixed(3)})`;
      ctx.drawImage(this.fxCanvas, 0, 0);
    }

    if (fx.echo > 0.012) {
      const scale = 1 + fx.echo * 0.022;
      ctx.globalAlpha = 0.025 + fx.echo * 0.13;
      ctx.filter = 'none';
      ctx.drawImage(
        this.fxCanvas,
        pixelX * (1 - scale), pixelY * (1 - scale),
        width * scale, height * scale
      );
    }

    if (fx.chroma > 0.018) {
      const offset = Math.max(1, fx.chroma * 3.8 * this.dpr);
      ctx.globalAlpha = 0.018 + fx.chroma * 0.075;
      ctx.filter = 'none';
      const drawThemeTint = (color, xOffset) => {
        const tint = this.tintCtx;
        tint.save();
        tint.setTransform(1, 0, 0, 1, 0, 0);
        tint.clearRect(0, 0, width, height);
        tint.globalCompositeOperation = 'source-over';
        tint.globalAlpha = 1;
        tint.drawImage(this.fxCanvas, 0, 0);
        tint.globalCompositeOperation = 'source-in';
        tint.fillStyle = color;
        tint.fillRect(0, 0, width, height);
        tint.restore();
        ctx.drawImage(this.tintCanvas, xOffset, 0);
      };
      drawThemeTint(theme.accent, -offset);
      drawThemeTint(theme.accent2, offset);
    }

    if (fx.slice > 0.02) {
      ctx.globalAlpha = 0.035 + fx.slice * 0.12;
      ctx.filter = 'saturate(1.45) brightness(1.12)';
      const bandHeight = Math.max(2, Math.round((7 + fx.slice * 10) * this.dpr));
      const bands = [-0.52, -0.08, 0.36];
      bands.forEach((position, index) => {
        const sourceY = Math.max(0, Math.min(height - bandHeight, Math.round(pixelY + position * 120 * this.dpr)));
        const offset = (index % 2 ? -1 : 1) * fx.slice * (5 + index * 1.8) * this.dpr;
        ctx.drawImage(this.fxCanvas, 0, sourceY, width, bandHeight, offset, sourceY, width, bandHeight);
      });
    }
    ctx.restore();
  }

  emitTranceOuterParticles(x, y, theme, metrics, time) {
    const energy = clamp(this.tranceEnergy);
    const deltaMs = this.tranceOuterParticleLastAt
      ? clamp(time - this.tranceOuterParticleLastAt, 4, 36)
      : 16.667;
    this.tranceOuterParticleLastAt = time;

    // The flow never becomes completely sterile, but particle density expands
    // strongly with the sustained section envelope rather than individual hits.
    const sectionDrive = smoothstep(0.24, 0.78, energy);
    const particlesPerSecond = 0.18 + Math.pow(sectionDrive, 1.72) * 28;
    this.tranceOuterParticleBudget = Math.min(
      3,
      this.tranceOuterParticleBudget + deltaMs * particlesPerSecond / 1000
    );
    while (this.tranceOuterParticleBudget >= 1) {
      this.tranceOuterParticleBudget -= 1;
      this.spawnGenreParticles(x, y, theme, metrics, { count: 1, strength: energy });
    }
  }

  spawnGenreParticles(x, y, theme, metrics, options = {}) {
    const strength = clamp(options.strength ?? metrics.rhythmStrength ?? metrics.impact ?? 0);
    const profile = genreMotionProfile(theme);
    const tranceInflow = theme.mode === 'trance'
      && theme.family !== 'classical'
      && !['soundtrack', 'synthwave'].includes(theme.id);
    const tranceDirection = 1;
    const tranceArmCount = theme.id === 'psytrance' ? 12 : 8;
    const count = Number.isFinite(options.count)
      ? Math.max(0, Math.round(options.count))
      : genreParticleCount(theme, strength);
    const tranceCurl = theme.id === 'progressive-trance' ? 3.25 : 3.65;
    const spectrumRadius = (this.lastSpectrum?.baseRadius || 62) + Math.max(0, profile.startRadius - 62);
    for (let index = 0; index < count; index += 1) {
      const unit = (index + Math.random() * 0.55) / Math.max(1, count);
      let positionAngle = unit * TAU;
      let velocityAngle = positionAngle;
      let startRadius = spectrumRadius;
      let curve = profile.curve || 0;
      let startX = x + Math.cos(positionAngle) * startRadius;
      let startY = y + Math.sin(positionAngle) * startRadius;
      if (profile.flow === 'orbit' || profile.flow === 'tangent') {
        const direction = index % 2 ? -1 : 1;
        velocityAngle += direction * Math.PI / 2;
        curve *= direction;
      } else if (profile.flow === 'inward') {
        if (tranceInflow) {
          // Spawn on the outer end of a visible arm and enter the aperture
          // tangentially. The curved velocity then follows the same winding
          // direction as the cached density wave instead of cutting straight
          // across it.
          const armIndex = Math.floor(Math.random() * tranceArmCount);
          positionAngle = tranceDirection * this.tranceArmPhase
            + armIndex / tranceArmCount * TAU
            - tranceDirection * tranceCurl
            + (Math.random() - 0.5) * 0.18;
          velocityAngle = positionAngle + Math.PI - tranceDirection * 0.56;
          startRadius = profile.startRadius + Math.random() * 9;
          curve = tranceDirection * Math.abs(profile.curve || 0.012);
        } else {
          velocityAngle += Math.PI;
          startRadius = profile.startRadius;
        }
      } else if (profile.flow === 'rise') {
        positionAngle = Math.PI * (0.22 + Math.random() * 0.56);
        velocityAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      } else if (profile.flow === 'fall') {
        positionAngle = -Math.PI * (0.22 + Math.random() * 0.56);
        velocityAngle = Math.PI / 2 + (Math.random() - 0.5) * 0.34;
      } else if (profile.flow === 'lateral') {
        const side = index % 2 ? -1 : 1;
        positionAngle = side > 0 ? 0 : Math.PI;
        velocityAngle = side > 0 ? 0.08 : Math.PI - 0.08;
        positionAngle += (Math.random() - 0.5) * 0.38;
      } else if (profile.flow === 'stream') {
        const side = index % 2 ? -1 : 1;
        startX = x - startRadius - 24 - Math.random() * 12;
        startY = y + side * (22 + Math.random() * 47);
        velocityAngle = (Math.random() - 0.5) * 0.055;
      } else if (profile.flow === 'warp') {
        positionAngle = unit * TAU + (Math.random() - 0.5) * 0.12;
        velocityAngle = positionAngle;
        startRadius = profile.startRadius;
      }
      if (profile.flow !== 'stream') {
        startX = x + Math.cos(positionAngle) * startRadius;
        startY = y + Math.sin(positionAngle) * startRadius;
      }
      const tranceSpeedScale = tranceInflow
        ? 0.34 + Math.pow(strength, 1.5) * 2.15
        : 0.72 + strength * 0.92;
      const particleSpeed = profile.speed * tranceSpeedScale
        * (tranceInflow ? 1.35 : 1)
        * (0.86 + Math.random() * 0.28);
      this.spawnParticle(
        startX,
        startY,
        theme,
        metrics,
        {
          vx: Math.cos(velocityAngle) * particleSpeed,
          vy: Math.sin(velocityAngle) * particleSpeed,
          angle: velocityAngle,
          shape: profile.kind,
          size: profile.size * (0.78 + strength * 0.58) * (0.85 + Math.random() * 0.3),
          decay: profile.decay,
          drag: profile.drag,
          gravity: profile.gravity,
          curve,
          jitter: profile.jitter
        }
      );
    }
  }

  spawnParticle(x, y, theme, metrics, options = {}) {
    const angle = options.angle ?? Math.random() * TAU;
    const speed = (options.speed ?? (0.35 + Math.random() * 1.8)) * (0.7 + metrics.volume * 2.2);
    this.particles.push({
      x, y,
      vx: options.vx ?? Math.cos(angle) * speed,
      vy: options.vy ?? Math.sin(angle) * speed,
      life: 1,
      decay: options.decay ?? (0.012 + Math.random() * 0.02),
      size: options.size ?? (0.7 + Math.random() * 2.2),
      color: Math.random() > 0.46 ? theme.accent : theme.accent2,
      shape: options.shape || 'dot',
      spin: (Math.random() - 0.5) * 0.2,
      angle,
      drag: options.drag ?? 0.988,
      gravity: options.gravity || 0,
      curve: options.curve || 0,
      jitter: options.jitter || 0
    });
    if (this.particles.length > 180) this.particles.splice(0, this.particles.length - 180);
  }

  updateParticles(theme, metrics) {
    const ctx = this.ctx;
    const tranceFlash = theme.mode === 'trance'
      ? clamp(metrics.kickPulse || 0)
      : 0;
    const tranceSectionGlow = theme.mode === 'trance'
      ? smoothstep(0.24, 0.78, clamp(this.tranceEnergy))
      : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      if (p.curve) {
        const cosine = Math.cos(p.curve);
        const sine = Math.sin(p.curve);
        const nextVx = p.vx * cosine - p.vy * sine;
        p.vy = p.vx * sine + p.vy * cosine;
        p.vx = nextVx;
      }
      if (p.jitter) {
        p.vx += (Math.random() - 0.5) * p.jitter;
        p.vy += (Math.random() - 0.5) * p.jitter;
      }
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= p.decay;
      p.angle += p.spin;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const particleLight = theme.mode === 'trance'
        ? Math.min(
          1,
          0.11
            + Math.pow(tranceSectionGlow, 1.42) * 0.62
            + Math.pow(tranceFlash, 0.68) * 0.82
        )
        : Math.min(1, 0.8 + tranceFlash * 0.2);
      ctx.fillStyle = rgba(p.color, p.life * particleLight);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = theme.mode === 'trance'
        ? 1.8
          + Math.pow(tranceSectionGlow, 1.35) * 11.5
          + Math.pow(tranceFlash, 0.68) * 38
        : 8 + tranceFlash * 12;
      if (['shard', 'streak', 'spark', 'plate'].includes(p.shape)) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        const length = p.shape === 'streak' ? 7.2 : p.shape === 'spark' ? 5.6 : p.shape === 'plate' ? 3.8 : 4.6;
        const thickness = p.shape === 'plate' ? 1.15 : p.shape === 'spark' ? 0.34 : 0.7;
        ctx.fillRect(-p.size * length * 0.5, -p.size * thickness * 0.5, p.size * length, p.size * thickness);
        ctx.restore();
      } else if (p.shape === 'chevron') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.strokeStyle = rgba(p.color, p.life * 0.72);
        ctx.lineWidth = Math.max(0.55, p.size * 0.72);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-p.size * 2.3, -p.size * 1.15);
        ctx.lineTo(p.size * 1.8, 0);
        ctx.lineTo(-p.size * 2.3, p.size * 1.15);
        ctx.stroke();
        ctx.restore();
      } else if (p.shape === 'paw') {
        const pawScale = p.size * (0.78 + p.life * 0.22);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.scale(pawScale, pawScale);
        ctx.fillStyle = rgba(p.color, p.life * 0.68);
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0.55, 1.05, 0.7, 0, 0, TAU);
        for (const [toeX, toeY, toeSize] of [
          [-0.95, -0.53, 0.28], [-0.33, -1, 0.32],
          [0.33, -1, 0.32], [0.95, -0.53, 0.28]
        ]) {
          ctx.moveTo(toeX + toeSize, toeY);
          ctx.arc(toeX, toeY, toeSize, 0, TAU);
        }
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'bubble') {
        ctx.strokeStyle = rgba(p.color, p.life * 0.62);
        ctx.lineWidth = 0.72;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.7 + (1 - p.life) * 1.5), 0, TAU);
        ctx.stroke();
      } else if (p.shape === 'triangle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.8);
        ctx.lineTo(p.size * 1.45, p.size * 1.15);
        ctx.lineTo(-p.size * 1.45, p.size * 1.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'block' || p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const width = p.shape === 'block' ? p.size * 2.8 : p.size * 1.7;
        const height = p.shape === 'block' ? p.size * 1.2 : p.size * 1.7;
        ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
        ctx.restore();
      } else if (p.shape === 'sparkle') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        for (let point = 0; point < 8; point += 1) {
          const angle = point / 8 * TAU;
          const radius = p.size * (point % 2 ? 0.35 : 1.75) * p.life;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        const moteScale = p.shape === 'mote' ? 1.35 : p.shape === 'dust' ? 0.62 : p.shape === 'bead' ? 0.9 : 1;
        ctx.arc(p.x, p.y, p.size * p.life * moteScale, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  shockwave(x, y, theme, metrics, style = {}, legacyViolent = false) {
    const config = typeof style === 'object'
      ? style
      : { jagged: Boolean(style), violent: Boolean(legacyViolent) };
    const impulse = clamp(metrics.rhythmStrength ?? metrics.impact ?? 0);
    if (metrics.rhythmNow && impulse >= 0.2) {
      const count = 1;
      for (let index = 0; index < count; index += 1) {
        const startRadius = (this.lastSpectrum?.baseRadius || 58) + 3;
        const response = config.shapeResponse ?? 0.45;
        const sampledSpectrum = this.lastSpectrum?.outer?.filter((_, pointIndex) => pointIndex % 2 === 0) || [];
        const contourRatios = impactContourRatios(
          sampledSpectrum,
          this.lastSpectrum?.baseRadius,
          response,
          config.directionality ?? 0.12
        );
        const spectrumShape = sampledSpectrum.map((point, pointIndex) => ({
          angle: point.angle,
          // The launched front inherits the spectrum's broad direction (for
          // example a top-heavy pair of ears), not its individual teeth.
          ratio: contourRatios[pointIndex]
        }));
        this.rings.push({
          radius: startRadius,
          startRadius,
          targetRadius: startRadius + (config.reach ?? (config.violent ? 36 : 30)) * (0.52 + impulse * 0.48),
          bornAt: this.currentTime || performance.now(),
          delayMs: 0,
          durationMs: (config.duration ?? (config.violent ? 215 : 280)) + (1 - impulse) * 34,
          life: 1,
          jagged: Boolean(config.jagged) && impulse >= 0.42,
          width: (0.72 + impulse * 2.05) * (config.width ?? 1),
          alpha: 0.1 + impulse * (config.alpha ?? 0.42),
          impulse,
          spectrumShape,
          themeId: theme.id,
          themeMode: theme.mode,
          smooth: config.impactSmooth !== false,
          broken: config.broken || 0,
          spring: config.spring || 7.2,
          oscillation: config.oscillation || 9.2,
          isRhythmHit: true,
          color: index % 2 ? theme.accent2 : theme.accent
        });
      }
    }
    const ctx = this.ctx;
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      const elapsed = (this.currentTime || performance.now()) - ring.bornAt - ring.delayMs;
      if (elapsed < 0) continue;
      const progress = clamp(elapsed / ring.durationMs);
      const elastic = ring.isRhythmHit;
      const expansion = elastic
        ? impactFrontProgress(progress, ring.spring)
        : 1 - (1 - progress) ** 3;
      ring.radius = ring.startRadius + (ring.targetRadius - ring.startRadius) * expansion;
      ring.life = (1 - progress) ** (elastic ? 0.88 : 1.4);
      if (progress >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const ringAlpha = ring.life * ring.alpha;
      this.strokeGlow(ring.color || (i % 2 ? theme.accent2 : theme.accent), Math.max(0.55, ring.width * (0.48 + ring.life * 0.52)), ring.isRhythmHit ? 14 : 9, ringAlpha);
      ctx.beginPath();
      const elasticRadius = ring.radius;
      if (ring.spectrumShape?.length) {
        const transformed = ring.spectrumShape.map((point) => {
          const genreShape = genreImpactRadiusRatio(
            { id: ring.themeId, mode: ring.themeMode },
            point.angle,
            ring.impulse * ring.life
          );
          return {
            x: x + Math.cos(point.angle) * elasticRadius * point.ratio * genreShape,
            y: y + Math.sin(point.angle) * elasticRadius * point.ratio * genreShape
          };
        });
        if (ring.broken) {
          const segmentLength = Math.max(3, Math.floor(transformed.length / (ring.broken * 2)));
          for (let start = 0; start < transformed.length; start += segmentLength * 2) {
            const segment = transformed.slice(start, Math.min(transformed.length, start + segmentLength));
            if (segment.length > 1) {
              this.tracePoints(segment, false);
              ctx.stroke();
            }
          }
          continue;
        }
        this.tracePoints(transformed, true, ring.smooth);
      } else if (ring.jagged) {
        const count = 42;
        for (let point = 0; point <= count; point += 1) {
          const angle = (point / count) * TAU;
          const r = ring.radius + (point % 2 ? 5 : -2) * ring.life;
          const px = x + Math.cos(angle) * r * (elasticRadius / ring.radius);
          const py = y + Math.sin(angle) * r * (elasticRadius / ring.radius);
          if (!point) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      } else {
        ctx.arc(x, y, elasticRadius, 0, TAU);
      }
      ctx.stroke();
    }
  }

  impactBurst(x, y, theme, metrics, time, violent = false) {
    const ctx = this.ctx;
    const pulse = metrics.rhythmPulse || 0;
    if (pulse <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.glowCircle(x, y, 86 + pulse * (violent ? 62 : 50), theme.hot, pulse * 0.2);
    ctx.translate(x, y);
    ctx.rotate(time * 0.0007);
    const spokes = violent ? 16 : 12;
    for (let index = 0; index < spokes; index += 1) {
      const angle = index / spokes * TAU;
      const inner = 76 + (index % 2) * 8;
      const outer = inner + 14 + pulse * (violent ? 30 : 22);
      this.strokeGlow(index % 2 ? theme.accent : theme.hot, 0.8 + pulse * 1.8, 13, pulse * 0.46);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  rhythmImpact(x, y, theme, metrics, violent = false) {
    const ctx = this.ctx;
    const pulse = metrics.rhythmPulse || 0;
    const impact = Math.max((metrics.impact || 0) * (pulse > 0.08 ? 1 : 0.48), pulse * 0.92);
    if (impact <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const radius = (pulse > 0.08 ? 62 : 48) + impact * (pulse > 0.08 && violent ? 72 : 34);
    const gradient = ctx.createRadialGradient(x, y, 28, x, y, radius);
    gradient.addColorStop(0, rgba(theme.hot, impact * 0.2));
    gradient.addColorStop(0.38, rgba(theme.accent, impact * 0.16));
    gradient.addColorStop(0.72, rgba(theme.accent2, impact * 0.1));
    gradient.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    if (violent && (pulse > 0.08 || (metrics.rhythmNow && (metrics.impact || 0) > 0.82))) {
      const arcCount = pulse > 0.08 ? 4 : 2;
      for (let arc = 0; arc < arcCount; arc += 1) {
        const phase = arc / arcCount * TAU + impact * 0.2;
        this.strokeGlow(arc % 2 ? theme.hot : theme.accent, 1.2 + impact * 2.6, 16, impact * 0.62);
        ctx.beginPath();
        ctx.arc(x, y, 72 + arc * 9 + impact * 16, phase, phase + 0.62 + impact * 0.28);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawCore(x, y, theme, metrics, time, geometry = 'circle') {
    const ctx = this.ctx;
    const beat = metrics.beat;
    const base = 48 + metrics.bass * 12 + beat * 8;
    this.glowCircle(x, y, base * 2.2, theme.accent, 0.14 + metrics.volume * 0.18);
    this.glowCircle(x, y, base * 1.65, theme.accent2, 0.1 + metrics.mid * 0.12);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(geometry === 'diamond' ? Math.PI / 4 + Math.sin(time * 0.0007) * 0.04 : 0);
    const gradient = ctx.createLinearGradient(-base, -base, base, base);
    gradient.addColorStop(0, rgba(theme.accent, 0.68));
    gradient.addColorStop(0.52, rgba(theme.hot, 0.13));
    gradient.addColorStop(1, rgba(theme.accent2, 0.7));
    ctx.fillStyle = gradient;
    ctx.strokeStyle = rgba(theme.hot, 0.76);
    ctx.lineWidth = 1.2;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 18 + beat * 18;
    ctx.beginPath();
    if (geometry === 'diamond') {
      ctx.roundRect(-base * 0.64, -base * 0.64, base * 1.28, base * 1.28, 7);
    } else if (geometry === 'hex') {
      for (let i = 0; i < 6; i += 1) {
        const angle = i / 6 * TAU;
        const px = Math.cos(angle) * base;
        const py = Math.sin(angle) * base;
        if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, base, 0, TAU);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawWaveform(x, y, radius, theme, metrics, angular = true) {
    const ctx = this.ctx;
    const waveform = metrics.waveform;
    this.strokeGlow(theme.hot, 1.05, 8, 0.66);
    ctx.beginPath();
    if (angular) {
      const points = 96;
      for (let index = 0; index <= points; index += 1) {
        const angle = index / points * TAU;
        const sampleIndex = waveform ? Math.floor(index / points * waveform.length) : index;
        const sample = waveform ? (waveform[sampleIndex] - 128) / 128 : Math.sin(index * 0.55) * 0.04;
        const r = radius + sample * 20 + metrics.high * (index % 2 ? 5 : -2);
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    } else {
      const points = 110;
      for (let index = 0; index <= points; index += 1) {
        const sampleIndex = waveform ? Math.floor(index / points * waveform.length) : index;
        const sample = waveform ? (waveform[sampleIndex] - 128) / 128 : Math.sin(index * 0.45) * 0.04;
        const px = x - radius + index / points * radius * 2;
        const py = y + sample * (28 + metrics.bass * 26);
        if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  hardcore(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const count = theme.id === 'uptempo-hardcore' ? 72 : 56;
    const rotation = time * 0.00022 * (theme.id === 'frenchcore' ? -1 : 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalCompositeOperation = 'lighter';
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * TAU;
      const spectrum = metrics.frequency?.[Math.floor(index / count * 160)] / 255 || 0.08;
      const inner = 64 + (index % 2) * 5;
      const outer = inner + 10 + spectrum * 40 + metrics.beat * (index % 4 === 0 ? 19 : 5);
      this.strokeGlow(index % 3 ? theme.accent : theme.accent2, index % 4 === 0 ? 2.2 : 0.9, 10, 0.5 + spectrum * 0.7);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle + (index % 2 ? 0.012 : -0.012)) * outer, Math.sin(angle + (index % 2 ? 0.012 : -0.012)) * outer);
      ctx.stroke();
    }
    ctx.restore();
    this.rhythmImpact(x, y, theme, metrics, true);
    this.drawCore(x, y, theme, metrics, time, theme.id === 'industrial-hardcore' ? 'hex' : 'circle');
    this.drawWaveform(x, y, 60 + metrics.beat * 3, theme, metrics);
    this.shockwave(x, y, theme, metrics, true, true);
    if (metrics.rhythmNow) {
      const count = Math.max(0, Math.round(((metrics.rhythmStrength ?? metrics.impact ?? 0) - 0.2) * 12));
      for (let i = 0; i < count; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 1.8 + Math.random() * 3.4 });
    }
  }

  hardstyle(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const spread = 78 + metrics.bass * 24 + metrics.beat * 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    for (const direction of [-1, 1]) {
      for (let layer = 0; layer < 5; layer += 1) {
        ctx.beginPath();
        ctx.moveTo(direction * 22, -24 + layer * 8);
        ctx.lineTo(direction * (spread + layer * 13), -48 + layer * 18);
        ctx.lineTo(direction * (58 + layer * 7), 2 + layer * 13);
        ctx.closePath();
        ctx.strokeStyle = rgba(layer % 2 ? theme.accent2 : theme.accent, 0.28 + metrics.mid * 0.55);
        ctx.lineWidth = 1.3;
        ctx.shadowColor = layer % 2 ? theme.accent2 : theme.accent;
        ctx.shadowBlur = 12;
        ctx.stroke();
      }
    }
    ctx.restore();
    this.rhythmImpact(x, y, theme, metrics, true);
    this.drawCore(x, y, theme, metrics, time, 'diamond');
    this.drawWaveform(x, y, 64 + metrics.impact * 5, theme, metrics);
    this.shockwave(x, y, theme, metrics, true, true);
    if (metrics.rhythmNow) {
      const count = Math.max(0, Math.round(((metrics.rhythmStrength ?? metrics.impact ?? 0) - 0.2) * 10));
      for (let i = 0; i < count; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 2.3 + metrics.impact * 2.2 });
    }
  }

  house(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.00008);
    ctx.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 6; ring += 1) {
      const radius = 58 + ring * 12 + Math.sin(time * 0.0012 + ring) * 3 + metrics.beat * ring * 1.4;
      this.strokeGlow(ring % 2 ? theme.accent2 : theme.accent, ring === 0 ? 2 : 1, 12, 0.24 + metrics.mid * 0.5);
      ctx.beginPath();
      const start = time * 0.0003 * (ring % 2 ? -1 : 1) + ring;
      ctx.ellipse(0, 0, radius, radius * (0.56 + ring * 0.035), ring * 0.28, start, start + Math.PI * (0.72 + metrics.high));
      ctx.stroke();
    }
    for (let dot = 0; dot < 14; dot += 1) {
      const angle = time * 0.00035 * (dot % 2 ? -1 : 1) + dot / 14 * TAU;
      const radius = 72 + (dot % 4) * 10;
      ctx.fillStyle = rgba(dot % 2 ? theme.accent : theme.accent2, 0.45 + metrics.high * 0.5);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7, 1.2 + metrics.high * 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
  }

  futureBass(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let ribbon = 0; ribbon < 7; ribbon += 1) {
      const phase = time * 0.0011 + ribbon * 0.78;
      const radius = 58 + ribbon * 10;
      const yShift = Math.sin(phase) * (13 + metrics.mid * 17);
      this.strokeGlow(ribbon % 2 ? theme.accent2 : theme.accent, 1.4 + metrics.volume * 2, 16, 0.2 + metrics.mid * 0.55);
      ctx.beginPath();
      ctx.moveTo(x - radius, y + yShift);
      ctx.bezierCurveTo(x - radius * 0.35, y - 58 - yShift, x + radius * 0.25, y + 58 + yShift, x + radius, y - yShift);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'hex');
    this.shockwave(x, y, theme, metrics, false);
    if (metrics.rhythmNow) for (let i = 0; i < 12; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 1.3, decay: 0.018 });
  }

  dubstep(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const wobble = 1 + Math.sin(time * 0.012) * metrics.bass * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(wobble, 1 / wobble);
    ctx.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 12; arm += 1) {
      const angle = arm / 12 * TAU + Math.sin(time * 0.001 + arm) * 0.1;
      const length = 74 + (arm % 3) * 12 + metrics.bass * 35;
      this.strokeGlow(arm % 2 ? theme.accent : theme.accent2, 1.4 + (arm % 3 === 0 ? metrics.bass * 4 : 0), 13, 0.42);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 52, Math.sin(angle) * 52);
      ctx.lineTo(Math.cos(angle + 0.15) * (length * 0.72), Math.sin(angle + 0.15) * (length * 0.72));
      ctx.lineTo(Math.cos(angle - 0.08) * length, Math.sin(angle - 0.08) * length);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'hex');
    this.drawWaveform(x, y, 90, theme, metrics, false);
    this.shockwave(x, y, theme, metrics, true);
    if (metrics.rhythmNow) {
      for (let i = 0; i < 5; i += 1) this.glitches.push({
        x: x - 100 + Math.random() * 200,
        y: y - 95 + Math.random() * 190,
        w: 18 + Math.random() * 70,
        h: 1 + Math.random() * 5,
        life: 0.4 + Math.random() * 0.6,
        color: i % 2 ? theme.accent : theme.accent2
      });
    }
    for (let i = this.glitches.length - 1; i >= 0; i -= 1) {
      const g = this.glitches[i];
      g.life -= 0.12;
      if (g.life <= 0) this.glitches.splice(i, 1);
      else {
        ctx.fillStyle = rgba(g.color, g.life * 0.7);
        ctx.fillRect(g.x, g.y, g.w, g.h);
      }
    }
  }

  drumBass(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const speed = time * 0.0009;
    for (let line = 0; line < 32; line += 1) {
      const angle = line / 32 * TAU + speed;
      const spectrum = metrics.frequency?.[line * 4] / 255 || 0.1;
      const inner = 52 + ((time * 0.12 + line * 13) % 44);
      const outer = inner + 12 + spectrum * 34;
      this.strokeGlow(line % 3 ? theme.accent : theme.accent2, 0.8 + spectrum * 2, 8, 0.25 + spectrum * 0.65);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner * 0.76);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer * 0.76);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
    if (metrics.rhythmNow) for (let i = 0; i < 18; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 2.8, decay: 0.025 });
  }

  techno(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.00015);
    ctx.globalCompositeOperation = 'lighter';
    for (let grid = 0; grid < 5; grid += 1) {
      const size = 58 + grid * 17 + metrics.beat * grid * 4;
      ctx.rotate(grid % 2 ? 0.12 : -0.08);
      this.strokeGlow(grid % 2 ? theme.accent2 : theme.accent, grid === 0 ? 2 : 0.8, 10, 0.22 + metrics.mid * 0.46);
      ctx.strokeRect(-size * 0.62, -size * 0.62, size * 1.24, size * 1.24);
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'diamond');
    this.shockwave(x, y, theme, metrics, true);
  }

  trance(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    for (let petal = 0; petal < 16; petal += 1) {
      const angle = petal / 16 * TAU + time * 0.00016;
      const radius = 54 + (petal % 4) * 10 + metrics.mid * 16;
      ctx.save();
      ctx.rotate(angle);
      this.strokeGlow(petal % 2 ? theme.accent2 : theme.accent, 1.05, 13, 0.26 + metrics.high * 0.5);
      ctx.beginPath();
      ctx.ellipse(radius, 0, 34 + metrics.beat * 8, 9 + metrics.mid * 8, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
  }

  pop(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.00055) * 0.08);
    ctx.globalCompositeOperation = 'lighter';
    for (let orbit = 0; orbit < 6; orbit += 1) {
      const phase = time * 0.00042 * (orbit % 2 ? -1 : 1) + orbit * 0.92;
      const radius = 63 + orbit * 11 + metrics.beat * (2 + orbit * 0.8);
      this.strokeGlow(orbit % 2 ? theme.accent2 : theme.accent, 1.1 + metrics.mid * 1.6, 13, 0.22 + metrics.volume * 0.46);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (0.58 + orbit * 0.03), phase, phase, phase + Math.PI * 1.15);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
    if (metrics.rhythmNow) {
      const count = 6;
      for (let i = 0; i < count; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: i % 3 ? 'dot' : 'shard', speed: 1.1 + Math.random() * 1.8, decay: 0.02 });
    }
  }

  jPop(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.00008);
    ctx.globalCompositeOperation = 'lighter';
    const petals = 10;
    for (let petal = 0; petal < petals; petal += 1) {
      const angle = petal / petals * TAU + Math.sin(time * 0.001 + petal) * 0.035;
      const reach = 76 + (petal % 2) * 13 + metrics.mid * 18 + metrics.beat * 7;
      ctx.save();
      ctx.rotate(angle);
      this.strokeGlow(petal % 2 ? theme.accent2 : theme.accent, 1.15, 14, 0.32 + metrics.high * 0.5);
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.bezierCurveTo(reach * .62, -16 - metrics.high * 10, reach, -9, reach, 0);
      ctx.bezierCurveTo(reach, 9, reach * .62, 16 + metrics.high * 10, 46, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'hex');
    this.shockwave(x, y, theme, metrics, false);
    if (metrics.rhythmNow) {
      const count = 8;
      for (let i = 0; i < count; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 1.2 + Math.random() * 2.1, size: .7 + Math.random() * 1.2, decay: 0.018 });
    }
  }

  rock(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.0008) * 0.035);
    ctx.globalCompositeOperation = 'lighter';
    for (let ray = 0; ray < 22; ray += 1) {
      const angle = ray / 22 * TAU;
      const spectrum = metrics.frequency?.[8 + ray * 3] / 255 || 0.08;
      const inner = 61 + (ray % 3) * 3;
      const outer = inner + 13 + spectrum * 30 + metrics.beat * (ray % 2 ? 5 : 11);
      this.strokeGlow(ray % 4 ? theme.accent : theme.accent2, ray % 5 === 0 ? 2 : 0.9, 10, 0.3 + spectrum * 0.55);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle + (ray % 2 ? .04 : -.04)) * outer, Math.sin(angle + (ray % 2 ? .04 : -.04)) * outer);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'hex');
    this.drawWaveform(x, y, 72, theme, metrics);
    this.shockwave(x, y, theme, metrics, true, false);
    if (metrics.rhythmNow) for (let i = 0; i < 5; i += 1) this.spawnParticle(x, y, theme, metrics, { shape: 'shard', speed: 1.5 + Math.random() * 2.2, decay: 0.024 });
  }

  hipHop(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.05 + Math.sin(time * 0.0005) * 0.025);
    ctx.globalCompositeOperation = 'lighter';
    for (let bar = 0; bar < 24; bar += 1) {
      const angle = bar / 24 * TAU;
      const spectrum = metrics.frequency?.[2 + bar * 2] / 255 || 0.05;
      const length = 7 + spectrum * 33 + metrics.bass * 12;
      const radius = 65 + (bar % 2) * 7;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = rgba(bar % 3 ? theme.accent : theme.accent2, 0.34 + spectrum * 0.58);
      ctx.shadowColor = bar % 3 ? theme.accent : theme.accent2;
      ctx.shadowBlur = 10;
      ctx.fillRect(radius, -1.5, length, 3);
      ctx.restore();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
  }

  rnb(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let ribbon = 0; ribbon < 7; ribbon += 1) {
      const phase = time * 0.00075 + ribbon * 0.7;
      const radius = 56 + ribbon * 9;
      this.strokeGlow(ribbon % 2 ? theme.accent2 : theme.accent, 1.2 + metrics.volume * 1.4, 16, 0.18 + metrics.mid * 0.48);
      ctx.beginPath();
      ctx.moveTo(x - radius, y + Math.sin(phase) * 9);
      ctx.bezierCurveTo(x - radius * .32, y - 45 - metrics.mid * 18, x + radius * .3, y + 45 + metrics.bass * 15, x + radius, y - Math.sin(phase) * 9);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.shockwave(x, y, theme, metrics, false);
  }

  metal(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const count = 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.0008) * 0.025);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let index = 0; index <= count; index += 1) {
      const angle = index / count * TAU;
      const spectrum = metrics.frequency?.[Math.floor(index / count * 280)] / 255 || 0.08;
      const serration = index % 2 ? 74 : 58;
      const radius = serration + spectrum * 28 + metrics.beat * (index % 2 ? 12 : 3);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    this.strokeGlow(theme.accent, 2, 16, 0.74);
    ctx.stroke();
    ctx.rotate(-0.2);
    ctx.beginPath();
    for (let index = 0; index <= count; index += 1) {
      const angle = index / count * TAU;
      const radius = index % 2 ? 92 + metrics.high * 15 : 82;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    this.strokeGlow(theme.accent2, 0.8, 8, 0.38);
    ctx.stroke();
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'hex');
    this.shockwave(x, y, theme, metrics, true);
    if (metrics.rhythmNow) {
      for (let i = 0; i < 12; i += 1) this.spawnParticle(x, y, theme, metrics, {
        angle: -Math.PI * (0.15 + Math.random() * 0.7), shape: 'shard', speed: 2.4, decay: 0.025
      });
    } else if (metrics.high > 0.5 && Math.random() < 0.035) {
      this.spawnParticle(x, y, theme, metrics, {
        angle: -Math.PI * (0.15 + Math.random() * 0.7), shape: 'shard', speed: 1.2, decay: 0.025
      });
    }
  }

  electronic(x, y, theme, metrics, time) {
    const ctx = this.ctx;
    const count = 48;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * TAU - Math.PI / 2;
      const spectrum = metrics.frequency?.[index * 3] / 255 || (0.04 + Math.sin(time * 0.001 + index) * 0.02);
      const inner = 60;
      const outer = inner + 8 + spectrum * 38;
      this.strokeGlow(index % 2 ? theme.accent : theme.accent2, 1.1, 8, 0.3 + spectrum * 0.6);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
    this.drawCore(x, y, theme, metrics, time, 'circle');
    this.drawWaveform(x, y, 58, theme, metrics);
    this.shockwave(x, y, theme, metrics, false);
  }

  render(metrics, time = performance.now()) {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!theme) return;
    const renderTheme = this.trackContext.genrePolice
      ? {
          ...theme,
          accent: '#ff2d55',
          accent2: '#34c8ff',
          hot: '#8ee5ff'
        }
      : theme;
    this.currentTime = time;
    ctx.clearRect(0, 0, this.width, this.height);
    const transitionRaw = this.transitionSnapshot
      ? clamp((time - this.transitionStartedAt) / this.transitionDuration)
      : 1;
    const transition = transitionRaw * transitionRaw * (3 - 2 * transitionRaw);
    if (this.transitionSnapshot && transition < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - transition;
      const drift = transition * 12;
      ctx.drawImage(this.transitionSnapshot, -drift, 0, this.width + drift * 2, this.height);
      ctx.restore();
    } else if (this.transitionSnapshot) {
      this.transitionSnapshot = null;
    }
    ctx.save();
    ctx.globalAlpha = 0.2 + transition * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = this.center();
    const mode = renderTheme.mode || 'electronic';
    const energyMetrics = { ...metrics };
    if (mode === 'asmr') {
      // ASMR is mastered far below ordinary music. A slow, render-only AGC
      // raises its detail without feeding false onsets back into rhythm DSP.
      const rawActivity = Math.max(
        metrics.volume || 0,
        (metrics.bass || 0) * 0.38 + (metrics.lowMid || 0) * 0.27
          + (metrics.mid || 0) * 0.23 + (metrics.high || 0) * 0.12
      );
      const referenceFollow = rawActivity > this.asmrReference ? 0.022 : 0.0035;
      this.asmrReference += (rawActivity - this.asmrReference) * referenceFollow;
      const asmrGain = clamp(0.17 / Math.max(0.018, this.asmrReference), 1.25, 5.4);
      for (const key of ['bass', 'lowMid', 'mid', 'high', 'volume', 'flux']) {
        energyMetrics[key] = clamp(Math.pow((metrics[key] || 0) * asmrGain, 0.76) * 0.78);
      }
      energyMetrics.spectrumGain = asmrGain * 1.08;
      energyMetrics.waveformGain = Math.max(1, asmrGain * 0.82);
    } else {
      for (const key of ['bass', 'lowMid', 'mid', 'high', 'volume', 'flux']) {
        energyMetrics[key] = clamp((metrics[key] || 0) * (renderTheme.energy || 1));
      }
    }

    const progressiveHouseMode = renderTheme.id === 'progressive-house';
    if (progressiveHouseMode) {
      const deltaMs = this.progressiveHouseLastAt
        ? clamp(time - this.progressiveHouseLastAt, 4, 36)
        : 16.667;
      const frameScale = deltaMs / 16.667;
      this.progressiveHouseLastAt = time;
      const relativeLift = clamp(((metrics.relativeEnergy || 1) - 0.72) / 1.02);
      const phraseTarget = clamp(
        energyMetrics.volume * 0.24
          + energyMetrics.lowMid * 0.18
          + energyMetrics.mid * 0.22
          + energyMetrics.high * 0.1
          + relativeLift * 0.22
          + (metrics.drive || 0) * 0.18
      );
      // Three deliberately delayed envelopes let a new layer arrive after the
      // previous one instead of making every ornament flash on the same beat.
      // Their slow release preserves the emotional plateau through a breakdown.
      const attackRates = [0.042, 0.021, 0.0095];
      const releaseRates = [0.011, 0.0055, 0.0028];
      for (let layer = 0; layer < this.progressiveHouseLayers.length; layer += 1) {
        const previous = this.progressiveHouseLayers[layer] || 0;
        const rate = phraseTarget > previous ? attackRates[layer] : releaseRates[layer];
        const response = 1 - Math.pow(1 - rate, frameScale);
        this.progressiveHouseLayers[layer] = previous + (phraseTarget - previous) * response;
      }
      const sustainedLift = this.progressiveHouseLayers.reduce((sum, value) => sum + value, 0) / 3;
      this.progressiveHouseFlow = (
        this.progressiveHouseFlow
          + deltaMs * (0.000022 + sustainedLift * 0.00003)
      ) % 1;
    }

    const futureHouseMode = renderTheme.id === 'future-house';
    if (futureHouseMode) {
      const deltaMs = this.futureHouseLastAt
        ? clamp(time - this.futureHouseLastAt, 4, 36)
        : 16.667;
      const frameScale = deltaMs / 16.667;
      this.futureHouseLastAt = time;
      const body = clamp(
        energyMetrics.bass * 0.36 + energyMetrics.lowMid * 0.36
          + energyMetrics.mid * 0.2 + (metrics.bassPulse || 0) * 0.42
      );
      // Rhythm hits provide the House floor; short low/mid onsets catch the
      // syncopated bass and chord stabs without promoting air-only hi-hats.
      const stabNow = Boolean(metrics.rhythmNow)
        || Boolean(metrics.onsetNow && body > 0.31 && energyMetrics.high < body + 0.38);
      if (stabNow && time - this.futureHouseLastTriggerAt > 72) {
        const strength = clamp(
          Math.max(metrics.rhythmStrength || 0, metrics.impact || 0, body * 0.75) * 0.72
            + body * 0.4
        );
        this.futureHouseVelocity = clamp(
          this.futureHouseVelocity + 0.32 + strength * 0.34,
          -0.72,
          0.84
        );
        this.futureHouseStabOffset = Math.max(
          this.futureHouseStabOffset,
          0.5 + strength * 0.5
        );
        this.futureHouseStabDirection *= -1;
        this.futureHouseLastTriggerAt = time;
      }
      this.futureHouseVelocity += -this.futureHouseBounce * 0.23 * frameScale;
      this.futureHouseVelocity *= 0.74 ** frameScale;
      this.futureHouseBounce += this.futureHouseVelocity * frameScale;
      this.futureHouseBounce = clamp(this.futureHouseBounce, -0.62, 1.1);
      this.futureHouseStabOffset *= 0.72 ** frameScale;
    }

    const synthwaveMode = renderTheme.id === 'synthwave';
    const bilibiliMode = mode === 'bilibili';
    if (bilibiliMode) {
      this.updateBilibiliResponse(energyMetrics, time);
      this.drawBilibiliStock(energyMetrics, time);
    }
    if (synthwaveMode) {
      this.drawSynthwaveHorizonScene(x, y, renderTheme, energyMetrics, time);
    }

    const integratedTranceFx = mode === 'trance'
      && !['classical', 'soundtrack', 'synthwave'].includes(renderTheme.id);
    const gentleHardcore = mode === 'hardcore' && ['happy-hardcore', 'uk-hardcore'].includes(renderTheme.id);
    const violentMode = (mode === 'hardcore' && !gentleHardcore) || mode === 'hardstyle' || mode === 'metal';
    if (metrics.rhythmNow && !bilibiliMode) {
      this.motionStartedAt = time;
      this.motionStrength = metrics.impact || 0;
      this.motionDirection *= -1;
    }
    const motionElapsed = time - this.motionStartedAt;
    if (!integratedTranceFx && !synthwaveMode && !bilibiliMode && motionElapsed >= 0 && motionElapsed < 280) {
      const response = Math.exp(-motionElapsed / 82) * Math.sin(motionElapsed / 24);
      const motionScale = this.motionStrength * (violentMode ? 5.2 : 2.8);
      ctx.translate(this.motionDirection * response * motionScale, -Math.abs(response) * motionScale * 0.32);
    }
    if (futureHouseMode) {
      // One uniform radial spring transform binds waveform, House petals,
      // chrome stabs and impact fronts into the same bounce. Uniform scaling
      // keeps circular fronts circular instead of turning them into ellipses.
      const elasticScale = clamp(1 + this.futureHouseBounce * 0.034, 0.978, 1.042);
      ctx.translate(x, y);
      ctx.scale(elasticScale, elasticScale);
      ctx.translate(-x, -y);
    }
    if (this.trackContext.genrePolice) this.drawGenrePoliceBeacon(x, y, energyMetrics, time);
    if (!synthwaveMode) this.drawAtmosphere(x, y, renderTheme, energyMetrics, time);
    this.drawGenreVolume(x, y, renderTheme, energyMetrics, time);
    this.drawGenreSignature(x, y, renderTheme, energyMetrics, time);
    this.drawImpactLayer(x, y, renderTheme, energyMetrics, violentMode);
    if (integratedTranceFx) {
      this.emitTranceOuterParticles(x, y, renderTheme, energyMetrics, time);
    }
    if (this.trackContext.genrePolice) this.drawGenrePoliceOverlay(x, y, renderTheme, energyMetrics, time);
    if (!synthwaveMode && !bilibiliMode) this.updateParticles(renderTheme, metrics);
    ctx.restore();
    // The vortex already feeds pulse into every light stream, particle and
    // photon band. Re-copying and blurring the entire canvas added a second,
    // visually redundant full-frame pass and was the largest seek-time hitch.
    if (!integratedTranceFx && !synthwaveMode && !bilibiliMode) {
      this.applyImpactPostFx(x, y, renderTheme, energyMetrics);
    }
    if (!synthwaveMode && !bilibiliMode) this.featherCanvasEdges(x, y);
  }
}
