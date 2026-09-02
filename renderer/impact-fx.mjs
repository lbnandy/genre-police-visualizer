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
  'raw-hardstyle': { bloom: 0.5, blur: 0.09, echo: 0.34, chroma: 0.9, slice: 0.78, exposure: 0.19, saturation: 0.22 },
  'euphoric-hardstyle': { bloom: 0.66, blur: 0.3, echo: 0.3, chroma: 0.22, slice: 0.1, exposure: 0.2, saturation: 0.24 },
  'industrial-hardcore': { bloom: 0.43, blur: 0.08, echo: 0.32, chroma: 0.52, slice: 0.72, exposure: 0.17, saturation: 0.12 },
  'bright-hardcore': { bloom: 0.52, blur: 0.25, echo: 0.27, chroma: 0.32, slice: 0.24, exposure: 0.17, saturation: 0.22 },
  metal: { bloom: 0.48, blur: 0.11, echo: 0.3, chroma: 0.7, slice: 0.78, exposure: 0.18, saturation: 0.18 },
  bass: { bloom: 0.52, blur: 0.14, echo: 0.3, chroma: 0.64, slice: 0.62, exposure: 0.17, saturation: 0.22 },
  'bass-aggressive': { bloom: 0.54, blur: 0.1, echo: 0.32, chroma: 0.82, slice: 0.75, exposure: 0.18, saturation: 0.24 },
  'bass-fractured': { bloom: 0.48, blur: 0.07, echo: 0.34, chroma: 0.72, slice: 0.88, exposure: 0.18, saturation: 0.14 },
  'bass-quantized': { bloom: 0.45, blur: 0.09, echo: 0.34, chroma: 0.42, slice: 0.54, exposure: 0.15, saturation: 0.2 },
  'bass-prismatic': { bloom: 0.7, blur: 0.34, echo: 0.38, chroma: 0.24, slice: 0.12, exposure: 0.2, saturation: 0.3 },
  'bass-melodic': { bloom: 0.72, blur: 0.4, echo: 0.36, chroma: 0.12, slice: 0.07, exposure: 0.2, saturation: 0.22 },
  'bass-swing': { bloom: 0.5, blur: 0.15, echo: 0.28, chroma: 0.36, slice: 0.32, exposure: 0.16, saturation: 0.24 },
  'trap-tension': { bloom: 0.5, blur: 0.12, echo: 0.32, chroma: 0.45, slice: 0.4, exposure: 0.18, saturation: 0.22 },
  groove: { bloom: 0.38, blur: 0.15, echo: 0.14, chroma: 0.05, slice: 0.04, exposure: 0.1, saturation: 0.12 },
  degraded: { bloom: 0.42, blur: 0.1, echo: 0.22, chroma: 0.4, slice: 0.24, exposure: 0.13, saturation: 0.18 },
  'degraded-drift': { bloom: 0.5, blur: 0.1, echo: 0.35, chroma: 0.62, slice: 0.42, exposure: 0.17, saturation: 0.24 },
  breakbeat: { bloom: 0.42, blur: 0.08, echo: 0.27, chroma: 0.42, slice: 0.76, exposure: 0.15, saturation: 0.18 },
  'drum-bass': { bloom: 0.4, blur: 0.06, echo: 0.26, chroma: 0.34, slice: 0.5, exposure: 0.14, saturation: 0.16 },
  'dnb-liquid': { bloom: 0.52, blur: 0.28, echo: 0.3, chroma: 0.08, slice: 0.12, exposure: 0.15, saturation: 0.18 },
  'dnb-dancefloor': { bloom: 0.62, blur: 0.16, echo: 0.3, chroma: 0.2, slice: 0.22, exposure: 0.2, saturation: 0.22 },
  'dnb-jump-up': { bloom: 0.48, blur: 0.08, echo: 0.32, chroma: 0.52, slice: 0.58, exposure: 0.17, saturation: 0.2 },
  'dnb-neuro': { bloom: 0.46, blur: 0.06, echo: 0.36, chroma: 0.7, slice: 0.72, exposure: 0.17, saturation: 0.16 },
  'dnb-jungle': { bloom: 0.42, blur: 0.05, echo: 0.34, chroma: 0.48, slice: 0.9, exposure: 0.16, saturation: 0.17 },
  'dnb-drumstep': { bloom: 0.5, blur: 0.1, echo: 0.34, chroma: 0.46, slice: 0.6, exposure: 0.17, saturation: 0.2 },
  luminous: { bloom: 0.8, blur: 0.52, echo: 0.44, chroma: 0.18, slice: 0.06, exposure: 0.22, saturation: 0.2 },
  elastic: { bloom: 0.68, blur: 0.32, echo: 0.34, chroma: 0.14, slice: 0.035, exposure: 0.17, saturation: 0.2 },
  'kawaii-elastic': { bloom: 0.44, blur: 0.22, echo: 0.24, chroma: 0.16, slice: 0.025, exposure: 0.08, saturation: 0.24 },
  hypnotic: { bloom: 0.56, blur: 0.3, echo: 0.15, chroma: 0.08, slice: 0.01, exposure: 0.12, saturation: 0.15 },
  glossy: { bloom: 0.48, blur: 0.17, echo: 0.16, chroma: 0.1, slice: 0.025, exposure: 0.12, saturation: 0.13 },
  'jpop-city': { bloom: 0.38, blur: 0.25, echo: 0.12, chroma: 0.04, slice: 0.008, exposure: 0.1, saturation: 0.12 },
  'jpop-anime': { bloom: 0.67, blur: 0.3, echo: 0.29, chroma: 0.14, slice: 0.045, exposure: 0.19, saturation: 0.23 },
  'jpop-vocaloid': { bloom: 0.58, blur: 0.16, echo: 0.3, chroma: 0.28, slice: 0.18, exposure: 0.16, saturation: 0.24 },
  'polished-switch': { bloom: 0.57, blur: 0.16, echo: 0.22, chroma: 0.18, slice: 0.07, exposure: 0.15, saturation: 0.2 },
  warm: { bloom: 0.36, blur: 0.25, echo: 0.1, chroma: 0.035, slice: 0, exposure: 0.09, saturation: 0.09 },
  velvet: { bloom: 0.42, blur: 0.28, echo: 0.15, chroma: 0.025, slice: 0, exposure: 0.1, saturation: 0.11 },
  atmospheric: { bloom: 0.3, blur: 0.38, echo: 0.12, chroma: 0.015, slice: 0, exposure: 0.06, saturation: 0.07 },
  downtempo: { bloom: 0.34, blur: 0.24, echo: 0.14, chroma: 0.025, slice: 0.008, exposure: 0.08, saturation: 0.1 },
  microstructure: { bloom: 0.39, blur: 0.1, echo: 0.24, chroma: 0.22, slice: 0.28, exposure: 0.12, saturation: 0.13 },
  'controlled-glitch': { bloom: 0.42, blur: 0.06, echo: 0.29, chroma: 0.46, slice: 0.62, exposure: 0.14, saturation: 0.16 },
  dusty: { bloom: 0.27, blur: 0.24, echo: 0.09, chroma: 0.018, slice: 0.006, exposure: 0.06, saturation: 0.07 },
  synthwave: { bloom: 0.57, blur: 0.19, echo: 0.22, chroma: 0.17, slice: 0.055, exposure: 0.14, saturation: 0.2 },
  club: { bloom: 0.5, blur: 0.2, echo: 0.27, chroma: 0.15, slice: 0.1, exposure: 0.18, saturation: 0.16 },
  'melodic-club': { bloom: 0.43, blur: 0.24, echo: 0.18, chroma: 0.08, slice: 0.035, exposure: 0.13, saturation: 0.14 },
  'deep-club': { bloom: 0.36, blur: 0.28, echo: 0.14, chroma: 0.035, slice: 0.015, exposure: 0.1, saturation: 0.11 },
  'percussive-club': { bloom: 0.45, blur: 0.15, echo: 0.22, chroma: 0.08, slice: 0.08, exposure: 0.14, saturation: 0.2 },
  'filtered-club': { bloom: 0.54, blur: 0.2, echo: 0.29, chroma: 0.2, slice: 0.08, exposure: 0.17, saturation: 0.24 },
  'acid-club': { bloom: 0.48, blur: 0.11, echo: 0.28, chroma: 0.38, slice: 0.28, exposure: 0.16, saturation: 0.2 },
  'hard-club': { bloom: 0.52, blur: 0.09, echo: 0.3, chroma: 0.42, slice: 0.46, exposure: 0.18, saturation: 0.19 },
  'big-room': { bloom: 0.62, blur: 0.16, echo: 0.34, chroma: 0.14, slice: 0.08, exposure: 0.2, saturation: 0.18 },
  techno: { bloom: 0.4, blur: 0.08, echo: 0.23, chroma: 0.3, slice: 0.42, exposure: 0.16, saturation: 0.12 },
  'techno-hard': { bloom: 0.48, blur: 0.07, echo: 0.29, chroma: 0.4, slice: 0.56, exposure: 0.18, saturation: 0.15 },
  'techno-industrial': { bloom: 0.4, blur: 0.05, echo: 0.32, chroma: 0.5, slice: 0.7, exposure: 0.16, saturation: 0.1 },
  'techno-acid': { bloom: 0.5, blur: 0.14, echo: 0.3, chroma: 0.42, slice: 0.25, exposure: 0.16, saturation: 0.2 },
  'techno-melodic': { bloom: 0.58, blur: 0.3, echo: 0.25, chroma: 0.12, slice: 0.05, exposure: 0.16, saturation: 0.17 },
  'techno-minimal': { bloom: 0.3, blur: 0.08, echo: 0.12, chroma: 0.08, slice: 0.08, exposure: 0.1, saturation: 0.08 },
  'trance-psy': { bloom: 0.56, blur: 0.22, echo: 0.24, chroma: 0.22, slice: 0.08, exposure: 0.14, saturation: 0.22 },
  'trance-uplifting': { bloom: 0.76, blur: 0.46, echo: 0.34, chroma: 0.08, slice: 0.01, exposure: 0.2, saturation: 0.2 },
  'trance-progressive': { bloom: 0.46, blur: 0.34, echo: 0.16, chroma: 0.04, slice: 0, exposure: 0.1, saturation: 0.11 },
  'trance-tech': { bloom: 0.48, blur: 0.14, echo: 0.25, chroma: 0.28, slice: 0.26, exposure: 0.15, saturation: 0.17 },
  'trance-hard': { bloom: 0.57, blur: 0.13, echo: 0.3, chroma: 0.38, slice: 0.34, exposure: 0.19, saturation: 0.2 },
  'garage-swing': { bloom: 0.44, blur: 0.18, echo: 0.22, chroma: 0.14, slice: 0.14, exposure: 0.14, saturation: 0.17 },
  'garage-two-step': { bloom: 0.45, blur: 0.16, echo: 0.26, chroma: 0.15, slice: 0.2, exposure: 0.14, saturation: 0.18 },
  'garage-speed': { bloom: 0.52, blur: 0.11, echo: 0.3, chroma: 0.25, slice: 0.37, exposure: 0.18, saturation: 0.21 },
  'garage-bassline': { bloom: 0.49, blur: 0.15, echo: 0.28, chroma: 0.21, slice: 0.25, exposure: 0.17, saturation: 0.22 },
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
  if (id === 'industrial-hardcore') return PROFILES['industrial-hardcore'];
  if (mode === 'hardcore') return PROFILES['hard-dance'];
  if (id === 'rawstyle') return PROFILES['raw-hardstyle'];
  if (id === 'euphoric-hardstyle') return PROFILES['euphoric-hardstyle'];
  if (mode === 'hardstyle') return PROFILES.hardstyle;
  if (mode === 'metal') return PROFILES.metal;
  if (mode === 'trap') {
    return ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(id)
      ? PROFILES['trap-tension']
      : PROFILES.bass;
  }
  if (mode === 'dubstep') {
    if (id === 'deathstep') return PROFILES['bass-fractured'];
    if (id === 'brostep') return PROFILES['bass-aggressive'];
    if (id === 'riddim') return PROFILES['bass-quantized'];
    if (['future-riddim', 'colour-bass'].includes(id)) return PROFILES['bass-prismatic'];
    if (id === 'melodic-dubstep') return PROFILES['bass-melodic'];
    if (id === 'moombahcore') return PROFILES['bass-swing'];
    return PROFILES.bass;
  }
  if (mode === 'breakbeat') return PROFILES.breakbeat;
  if (mode === 'drum-bass') {
    if (id === 'liquid-dnb') return PROFILES['dnb-liquid'];
    if (id === 'dancefloor-dnb') return PROFILES['dnb-dancefloor'];
    if (id === 'jump-up-dnb') return PROFILES['dnb-jump-up'];
    if (id === 'neurofunk') return PROFILES['dnb-neuro'];
    if (id === 'jungle') return PROFILES['dnb-jungle'];
    if (id === 'drumstep') return PROFILES['dnb-drumstep'];
    return PROFILES['drum-bass'];
  }
  if (mode === 'kawaii-bass') return PROFILES['kawaii-elastic'];
  if (mode === 'future-bass') return PROFILES.elastic;
  if (mode === 'trance') {
    if (theme.family === 'classical' || id === 'soundtrack') return PROFILES.warm;
    if (id === 'synthwave') return PROFILES.synthwave;
    if (id === 'psytrance') return PROFILES['trance-psy'];
    if (id === 'uplifting-trance') return PROFILES['trance-uplifting'];
    if (id === 'progressive-trance') return PROFILES['trance-progressive'];
    if (id === 'tech-trance') return PROFILES['trance-tech'];
    if (id === 'hard-trance') return PROFILES['trance-hard'];
    return PROFILES.hypnotic;
  }
  if (id === 'k-pop') return PROFILES['polished-switch'];
  if (mode === 'j-pop') {
    if (id === 'city-pop') return PROFILES['jpop-city'];
    if (id === 'anime') return PROFILES['jpop-anime'];
    if (id === 'vocaloid') return PROFILES['jpop-vocaloid'];
    return PROFILES.glossy;
  }
  if (['pop', 'j-pop'].includes(mode)) return PROFILES.glossy;
  if (mode === 'rnb') {
    if (['rnb', 'contemporary-rnb', 'alternative-rnb'].includes(id)) return PROFILES.velvet;
    if (['new-jack-swing', 'funk'].includes(id)) return PROFILES.groove;
    if (id === 'gospel') return PROFILES.luminous;
    return PROFILES.warm;
  }
  if (mode === 'ambient') return id === 'ambient' ? PROFILES.atmospheric : PROFILES.downtempo;
  if (mode === 'experimental') return id === 'glitch' ? PROFILES['controlled-glitch'] : PROFILES.microstructure;
  if (mode === 'hip-hop') return id === 'lo-fi-hip-hop' ? PROFILES.dusty : PROFILES.groove;
  if (mode === 'phonk') return id === 'drift-phonk' ? PROFILES['degraded-drift'] : PROFILES.degraded;
  if (mode === 'techno') {
    if (id === 'hard-techno') return PROFILES['techno-hard'];
    if (id === 'industrial-techno') return PROFILES['techno-industrial'];
    if (id === 'acid-techno') return PROFILES['techno-acid'];
    if (id === 'melodic-techno') return PROFILES['techno-melodic'];
    if (id === 'minimal-techno') return PROFILES['techno-minimal'];
    return PROFILES.techno;
  }
  if (mode === 'garage') {
    if (id === 'future-garage') return PROFILES['garage-mist'];
    if (id === 'two-step-garage') return PROFILES['garage-two-step'];
    if (id === 'speed-garage') return PROFILES['garage-speed'];
    if (id === 'bassline') return PROFILES['garage-bassline'];
    return PROFILES['garage-swing'];
  }
  if (mode === 'latin') return PROFILES['latin-groove'];
  if (mode === 'house') {
    if (id === 'big-room-house') return PROFILES['big-room'];
    if (id === 'deep-house') return PROFILES['deep-club'];
    if (['afro-house', 'amapiano'].includes(id)) return PROFILES['percussive-club'];
    if (['french-house', 'disco-house'].includes(id)) return PROFILES['filtered-club'];
    if (id === 'acid-house') return PROFILES['acid-club'];
    if (id === 'hard-house') return PROFILES['hard-club'];
    if (['progressive-house', 'melodic-house', 'tropical-house'].includes(id)) {
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
