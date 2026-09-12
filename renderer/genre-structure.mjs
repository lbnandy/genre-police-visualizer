const TAU = Math.PI * 2;
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const fragments = Object.freeze({
  breakcore: { count: 11, subdivisions: 4, displacement: 10, gap: 0.17, width: 7 }
});
for (const profile of Object.values(fragments)) Object.freeze(profile);

export function fragmentProfile(id) {
  return fragments[id];
}

// A short, continuous excursion returns to zero before the active slice changes.
// Time selects a slice, but silence never supplies its movement or brightness.
export function fragmentMotion(id, index, metrics = {}, time = 0) {
  const profile = fragments[id];
  if (!profile) return { x: 0, y: 0, activity: 0 };
  const bpm = Math.max(45, Math.min(260, Number(metrics.bpm) || 120));
  const position = time / (60000 / bpm) * profile.subdivisions;
  const phase = position - Math.floor(position);
  const stride = 7;
  const active = (Math.floor(position) * stride) % profile.count;
  const drive = clamp(clamp(metrics.rhythmPulse) * 0.5 + clamp(metrics.flux) * 0.3 + clamp(metrics.bass) * 0.2);
  const activity = index === active ? Math.sin(phase * Math.PI) ** 2 * drive : 0;
  const angle = index / profile.count * TAU;
  const distance = activity * profile.displacement;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.8,
    activity
  };
}

export function genreSpectrumVariation(theme = {}, metrics = {}, time = 0) {
  const bass = clamp(metrics.bass);
  const mid = clamp(metrics.mid);
  const pulse = clamp(metrics.rhythmPulse);
  switch (theme.id) {
    case 'breakcore': return { ribs: false, nodes: false, echoes: 0, spectrumBins: 52, fracture: 4, serration: 1, waveAmplitude: 7, amplitude: 62 };
    case 'festival-trap': return { points: 144, spectrumBins: 36, smoothBins: 4, smoothPath: true, sectorBins: 0, step: 0, facets: 0, ribs: false, chroma: false, thickness: 34, waveSmooth: 14, broadWave: { lobes: 2, amount: 3 + bass * 4, speed: 0.00035 } };
    case 'hard-trap': return { ribs: false, chroma: false, points: 112, spectrumBins: 32, facets: 8, thickness: 32, amplitude: 60, waveAmplitude: 4, sectorBins: 4, contactCompression: 5, pulseRadius: 1.1, innerFollow: 0.15 };
    case 'melbourne-bounce': return { gravitySag: 4 + bass * 8, contactCompression: 3.8, pulseRadius: 5 };
    case 'melodic-house': return { ribs: false, nodes: false, echoes: 0, lobes: 3, lobeAmount: 5 + mid * 3, lobePhase: 0.3, thickness: 16, smoothBins: 6, waveSmooth: 20, broadWave: { lobes: 3, amount: 4 + mid * 3, speed: 0.00022 } };
    case 'afro-house': return { ribs: false, nodes: false, lobes: 6, lobeAmount: 5 + mid * 5 + pulse * 4, lobePhase: Math.sin(time * 0.0004) * 0.24, smoothBins: 4, waveSmooth: 12, thickness: 23, broadWave: { lobes: 3, amount: 2, speed: 0.0004 } };
    case 'amapiano': return { ribs: false, nodes: false, smoothBins: 6, waveSmooth: 18, thickness: 31, lobes: 2, lobeAmount: 2 + bass * 5, gravitySag: 8 + bass * 12, broadWave: { lobes: 2, amount: 4 + bass * 3, speed: 0.0003 }, contactCompression: 2.8 };
    case 'industrial-metal': return { ribs: false, chroma: false, facets: 12, sectorBins: 4, step: 0.07, fracture: 1.2, serration: 0, spike: 1, thickness: 25, waveAmplitude: 4, smoothBins: 1 };
    case 'black-metal': return { ribs: false, chroma: false, points: 148, spectrumBins: 60, thickness: 9, fracture: 7, serration: 3.5, spike: 8, highWeight: 1.2, waveAmplitude: 5 };
    case 'deathcore': return { ribs: false, spectrumBins: 36, thickness: 33, amplitude: 56, waveAmplitude: 5, smoothBins: 2, fracture: 5, serration: 1, spike: 5, contactCompression: 5.5, pulseRadius: 0.8, innerFollow: 0.1 };
    case 'progressive-metal': return { ribs: false, points: 144, spectrumBins: 50, thickness: 17, fracture: 2.8, serration: 0.8, spike: 2, smoothBins: 2, broadWave: { lobes: 5, amount: 3 + mid * 2, speed: 0.00024 } };
    default: return {};
  }
}

export function scoreVoiceCount(id) {
  return id === 'baroque' ? 5 : id === 'modern-classical' ? 3 : 4;
}

export function scoreVoicePoint(id, voice, progress, radius, metrics = {}, time = 0) {
  const modern = id === 'modern-classical';
  const romantic = id === 'romantic-classical';
  const opera = id === 'opera';
  const baroque = id === 'baroque';
  const count = scoreVoiceCount(id);
  const frequencies = metrics.frequency || [];
  const bandStart = Math.floor(voice / count * frequencies.length * 0.65);
  const bandSpan = Math.max(1, Math.floor(frequencies.length * 0.18));
  const bandIndex = Math.min(frequencies.length - 1, bandStart + Math.floor(progress * bandSpan));
  const band = clamp((frequencies[bandIndex] || 0) / 255);
  const drive = clamp(metrics.volume) * 0.45 + band * 0.55;
  const phrase = Math.sin(time * (modern ? 0.00024 : 0.00014) + voice * 1.7);
  const envelope = Math.sin(progress * Math.PI);
  const side = voice % 2 ? 1 : -1;
  const lane = Math.floor(voice / 2);
  const span = (radius + 16 + lane * (baroque ? 7 : 11)) * (modern ? 0.83 : romantic ? 1.08 : 1);
  const px = (progress * 2 - 1) * span;
  const bow = envelope * (radius * (opera ? 0.58 : 0.44) + band * (romantic ? 23 : 16));
  const py = side * (radius * 0.42 + lane * 12 + bow)
    + Math.sin(progress * Math.PI * (baroque ? 3 : 2) + phrase) * envelope * drive * 7;
  const tilt = (lane ? -0.1 : 0.08) + phrase * 0.035;
  return {
    x: px * Math.cos(tilt) - py * Math.sin(tilt),
    y: px * Math.sin(tilt) + py * Math.cos(tilt),
    width: (modern ? 0.65 : 0.9) + envelope * (0.6 + drive * (romantic ? 1.35 : 0.95)),
    alpha: 0.1 + envelope * (0.08 + drive * 0.1)
  };
}
