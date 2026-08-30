const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const smoothstep = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

const PROFILES = Object.freeze({
  asmr: { bloom: 0, blur: 0, echo: 0, chroma: 0, slice: 0, exposure: 0, saturation: 0 },
  bilibili: { bloom: 0, blur: 0, echo: 0, chroma: 0, slice: 0, exposure: 0, saturation: 0 },
  'hard-dance': { bloom: 0.56, blur: 0.16, echo: 0.34, chroma: 1, slice: 0.9, exposure: 0.2, saturation: 0.26 },
  hardstyle: { bloom: 0.5, blur: 0.13, echo: 0.3, chroma: 0.72, slice: 0.64, exposure: 0.18, saturation: 0.22 },
  'bright-hardcore': { bloom: 0.52, blur: 0.25, echo: 0.27, chroma: 0.32, slice: 0.24, exposure: 0.17, saturation: 0.22 },
  metal: { bloom: 0.48, blur: 0.11, echo: 0.3, chroma: 0.7, slice: 0.78, exposure: 0.18, saturation: 0.18 },
  bass: { bloom: 0.52, blur: 0.14, echo: 0.3, chroma: 0.64, slice: 0.62, exposure: 0.17, saturation: 0.22 },
  'trap-tension': { bloom: 0.5, blur: 0.12, echo: 0.32, chroma: 0.45, slice: 0.4, exposure: 0.18, saturation: 0.22 },
  groove: { bloom: 0.38, blur: 0.15, echo: 0.14, chroma: 0.05, slice: 0.04, exposure: 0.1, saturation: 0.12 },
  degraded: { bloom: 0.42, blur: 0.1, echo: 0.22, chroma: 0.4, slice: 0.24, exposure: 0.13, saturation: 0.18 },
  'degraded-drift': { bloom: 0.5, blur: 0.1, echo: 0.35, chroma: 0.62, slice: 0.42, exposure: 0.17, saturation: 0.24 },
  breakbeat: { bloom: 0.42, blur: 0.08, echo: 0.27, chroma: 0.42, slice: 0.76, exposure: 0.15, saturation: 0.18 },
  'drum-bass': { bloom: 0.4, blur: 0.06, echo: 0.26, chroma: 0.34, slice: 0.5, exposure: 0.14, saturation: 0.16 },
  luminous: { bloom: 0.8, blur: 0.52, echo: 0.44, chroma: 0.18, slice: 0.06, exposure: 0.22, saturation: 0.2 },
  elastic: { bloom: 0.68, blur: 0.32, echo: 0.34, chroma: 0.14, slice: 0.035, exposure: 0.17, saturation: 0.2 },
  'kawaii-elastic': { bloom: 0.44, blur: 0.22, echo: 0.24, chroma: 0.16, slice: 0.025, exposure: 0.08, saturation: 0.24 },
  hypnotic: { bloom: 0.56, blur: 0.3, echo: 0.15, chroma: 0.08, slice: 0.01, exposure: 0.12, saturation: 0.15 },
  glossy: { bloom: 0.48, blur: 0.17, echo: 0.16, chroma: 0.1, slice: 0.025, exposure: 0.12, saturation: 0.13 },
  'polished-switch': { bloom: 0.57, blur: 0.16, echo: 0.22, chroma: 0.18, slice: 0.07, exposure: 0.15, saturation: 0.2 },
  warm: { bloom: 0.36, blur: 0.25, echo: 0.1, chroma: 0.035, slice: 0, exposure: 0.09, saturation: 0.09 },
  velvet: { bloom: 0.42, blur: 0.28, echo: 0.15, chroma: 0.025, slice: 0, exposure: 0.1, saturation: 0.11 },
  synthwave: { bloom: 0.57, blur: 0.19, echo: 0.22, chroma: 0.17, slice: 0.055, exposure: 0.14, saturation: 0.2 },
  club: { bloom: 0.5, blur: 0.2, echo: 0.27, chroma: 0.15, slice: 0.1, exposure: 0.18, saturation: 0.16 },
  'melodic-club': { bloom: 0.43, blur: 0.24, echo: 0.18, chroma: 0.08, slice: 0.035, exposure: 0.13, saturation: 0.14 },
  'big-room': { bloom: 0.62, blur: 0.16, echo: 0.34, chroma: 0.14, slice: 0.08, exposure: 0.2, saturation: 0.18 },
  techno: { bloom: 0.4, blur: 0.08, echo: 0.23, chroma: 0.3, slice: 0.42, exposure: 0.16, saturation: 0.12 },
  'garage-swing': { bloom: 0.44, blur: 0.18, echo: 0.22, chroma: 0.14, slice: 0.14, exposure: 0.14, saturation: 0.17 },
  'garage-heavy': { bloom: 0.49, blur: 0.14, echo: 0.27, chroma: 0.23, slice: 0.28, exposure: 0.17, saturation: 0.2 },
  'garage-mist': { bloom: 0.46, blur: 0.3, echo: 0.18, chroma: 0.08, slice: 0.04, exposure: 0.11, saturation: 0.13 },
  'latin-groove': { bloom: 0.47, blur: 0.2, echo: 0.19, chroma: 0.1, slice: 0.055, exposure: 0.13, saturation: 0.2 },
  rock: { bloom: 0.4, blur: 0.08, echo: 0.23, chroma: 0.24, slice: 0.34, exposure: 0.16, saturation: 0.14 },
  neutral: { bloom: 0.44, blur: 0.16, echo: 0.24, chroma: 0.16, slice: 0.12, exposure: 0.15, saturation: 0.14 }
});

export function impactFxProfile(theme = {}) {
  const mode = String(theme.mode || 'electronic').toLowerCase();
  const id = String(theme.id || '').toLowerCase();
  if (mode === 'asmr') return PROFILES.asmr;
  if (mode === 'bilibili') return PROFILES.bilibili;
  if (['happy-hardcore', 'uk-hardcore'].includes(id)) return PROFILES['bright-hardcore'];
  if (mode === 'hardcore') return PROFILES['hard-dance'];
  if (mode === 'hardstyle') return PROFILES.hardstyle;
  if (mode === 'metal') return PROFILES.metal;
  if (mode === 'trap') {
    return ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(id)
      ? PROFILES['trap-tension']
      : PROFILES.bass;
  }
  if (mode === 'dubstep') return PROFILES.bass;
  if (mode === 'breakbeat') return PROFILES.breakbeat;
  if (mode === 'drum-bass') return PROFILES['drum-bass'];
  if (mode === 'kawaii-bass') return PROFILES['kawaii-elastic'];
  if (mode === 'future-bass') return PROFILES.elastic;
  if (mode === 'trance') {
    if (['classical', 'soundtrack'].includes(id)) return PROFILES.warm;
    if (id === 'synthwave') return PROFILES.synthwave;
    return PROFILES.hypnotic;
  }
  if (id === 'k-pop') return PROFILES['polished-switch'];
  if (['pop', 'j-pop'].includes(mode)) return PROFILES.glossy;
  if (mode === 'rnb') return id === 'rnb' ? PROFILES.velvet : PROFILES.warm;
  if (mode === 'hip-hop') return PROFILES.groove;
  if (mode === 'phonk') return id === 'drift-phonk' ? PROFILES['degraded-drift'] : PROFILES.degraded;
  if (mode === 'techno') return PROFILES.techno;
  if (mode === 'garage') {
    if (id === 'future-garage') return PROFILES['garage-mist'];
    if (['speed-garage', 'bassline'].includes(id)) return PROFILES['garage-heavy'];
    return PROFILES['garage-swing'];
  }
  if (mode === 'latin') return PROFILES['latin-groove'];
  if (mode === 'house') {
    if (id === 'big-room-house') return PROFILES['big-room'];
    if (['progressive-house', 'melodic-house', 'deep-house', 'tropical-house', 'afro-house'].includes(id)) {
      return PROFILES['melodic-club'];
    }
    return PROFILES.club;
  }
  if (mode === 'rock') return PROFILES.rock;
  return PROFILES.neutral;
}

export function resolveImpactFx(theme = {}, metrics = {}) {
  if (['asmr', 'bilibili'].includes(String(theme.mode || '').toLowerCase())) {
    return { amount: 0, bloom: 0, blur: 0, echo: 0, chroma: 0, slice: 0, exposure: 1, saturation: 1 };
  }
  const pulse = clamp(metrics.rhythmPulse);
  const eventStrength = metrics.rhythmNow ? clamp(metrics.rhythmStrength ?? metrics.impact) : 0;
  const source = Math.max(pulse, eventStrength);
  const amount = smoothstep((source - 0.08) / 0.92);
  const profile = impactFxProfile(theme);
  return {
    amount,
    bloom: amount * profile.bloom,
    blur: amount * profile.blur,
    echo: amount * profile.echo,
    chroma: amount * profile.chroma,
    slice: amount * profile.slice,
    exposure: 1 + amount * profile.exposure,
    saturation: 1 + amount * profile.saturation
  };
}
