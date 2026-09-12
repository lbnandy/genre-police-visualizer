// Shared material/light direction. Geometry and rhythm stay in their existing
// genre renderers; these profiles keep the label from overpowering that material.
const finishes = {
  neon: {},
  score: {
    spectrum: { hidden: true }, atmosphere: false, bezel: false, impact: false,
    signatureBlur: 0.14, signatureAlpha: 2.6,
    textGlow: 0.13, textMotion: 0.22, maxBrightness: 1.08
  },
  acoustic: {
    spectrum: { hidden: true }, atmosphere: false, bezel: false, impact: false,
    signatureBlur: 0.08, signatureAlpha: 1.6,
    textGlow: 0.12, textMotion: 0.28, maxBrightness: 1.08
  },
  jazz: {
    spectrum: { hideBandFill: true, hideInnerEdge: true, ridgeDepths: [], echoes: 0, edgeAlphaScale: 0.18 },
    atmosphere: false, bezel: false, impact: false, signatureBlur: 0.22, signatureAlpha: 2.4,
    textGlow: 0.22, textMotion: 0.5, maxBrightness: 1.14
  },
  deco: {
    spectrum: { hidden: true }, atmosphere: false, bezel: false, impact: false,
    signatureBlur: 0.18, signatureAlpha: 1.5,
    textGlow: 0.2, textMotion: 0.65, maxBrightness: 1.15
  },
  cel: {
    spectrum: { material: 'cel', fillAlphaScale: 0.65, hideInnerEdge: true, ridgeDepths: [], echoes: 0, lightBlurScale: 0 },
    atmosphere: false, bezel: false, impact: false, signatureBlur: 0, signatureAlpha: 1.35,
    textGlow: 0, textMotion: 1.08, maxBrightness: 1.06
  },
  sunset: {
    spectrum: { fillAlphaScale: 0.38, ridgeDepths: [0.4], lightBlurScale: 0.35, edgeAlphaScale: 0.75 },
    atmosphere: false, signatureBlur: 0.4,
    textGlow: 0.25, textMotion: 0.5, maxBrightness: 1.12
  },
  fractured: {
    spectrum: { fillAlphaScale: 0.32, ridgeDepths: [], lightBlurScale: 0.4, edgeAlphaScale: 0.64 },
    signatureBlur: 0.42, signatureAlpha: 1.45, textGlow: 0.58, maxBrightness: 1.26
  },
  cutRhythm: {
    spectrum: { fillAlphaScale: 0.72, ridgeDepths: [0.5], lightBlurScale: 0.55 },
    atmosphere: false, bezel: false,
    signatureBlur: 0.24, signatureAlpha: 1.5,
    textGlow: 0.38, textMotion: 0.85, maxBrightness: 1.2
  },
  cinematic: {
    spectrum: { hidden: true }, atmosphere: false, bezel: false, impact: false,
    signatureBlur: 0.42, signatureAlpha: 1.7,
    textGlow: 0.32, textMotion: 0.45, maxBrightness: 1.15
  },
  forged: {
    spectrum: { fillAlphaScale: 0.45, ridgeDepths: [], lightBlurScale: 0.24, edgeWidthScale: 1.15 },
    atmosphere: false, bezel: false, signatureBlur: 0.25,
    textGlow: 0.42, maxBrightness: 1.2
  },
  prism: {
    spectrum: { fillAlphaScale: 0.78, ridgeDepths: [0.3, 0.62], ribs: false, lightBlurScale: 0.65, edgeWidthScale: 1.18 },
    bezel: false, signatureBlur: 0.24, signatureAlpha: 1.5, textGlow: 0.62, maxBrightness: 1.22
  },
  pressure: {
    spectrum: { fillAlphaScale: 0.9, ridgeDepths: [0.25, 0.62], lightBlurScale: 0.65, edgeWidthScale: 1.15 },
    atmosphere: false, bezel: false, signatureBlur: 0.28, signatureAlpha: 1.55,
    textGlow: 0.42, textMotion: 0.7, maxBrightness: 1.18
  },
  syncopated: {
    spectrum: { fillAlphaScale: 0.8, ridgeDepths: [0.5], lightBlurScale: 0.65, edgeWidthScale: 1.2 },
    bezel: false, signatureBlur: 0.32, signatureAlpha: 1.45,
    textGlow: 0.5, textMotion: 0.85, maxBrightness: 1.2
  },
  mirror: {
    spectrum: { fillAlphaScale: 0.72, ridgeDepths: [0.48], nodes: false, echoes: 1, lightBlurScale: 0.65, edgeAlphaScale: 0.9 },
    bezel: false, signatureBlur: 0.55, signatureAlpha: 1.2,
    textGlow: 0.34, textMotion: 0.65, maxBrightness: 1.15
  },
  digital: {
    spectrum: { fillAlphaScale: 0.32, ridgeDepths: [], lightBlurScale: 0.18, edgeAlphaScale: 0.7 },
    atmosphere: false, bezel: false, signatureBlur: 0.12, signatureAlpha: 1.5,
    textGlow: 0.3, textMotion: 0.8, maxBrightness: 1.14
  },
  plush: {
    spectrum: { fillAlphaScale: 0.72, ridgeDepths: [0.52], lightBlurScale: 0.48, edgeWidthScale: 1.18 },
    atmosphere: false, bezel: false, signatureBlur: 0.5,
    textGlow: 0.58, maxBrightness: 1.2
  },
  soft: {
    spectrum: { fillAlphaScale: 0.72, lightBlurScale: 0.72, ridgeDepths: [0.44] },
    textGlow: 0.7, maxBrightness: 1.22
  },
  metal: {
    spectrum: { fillAlphaScale: 0.62, lightBlurScale: 0.45, edgeWidthScale: 1.15 },
    signatureBlur: 0.6, textGlow: 0.55, maxBrightness: 1.22
  },
  club: {
    spectrum: { fillAlphaScale: 0.68, lightBlurScale: 0.65, ridgeAlphaScale: 1.16 },
    signatureBlur: 0.7, signatureAlpha: 1.15, textGlow: 0.72, maxBrightness: 1.25
  },
  velvet: {
    spectrum: { fillAlphaScale: 0.6, lightBlurScale: 0.5 },
    signatureBlur: 0.55, signatureAlpha: 1.2, textGlow: 0.45, textMotion: 0.65, maxBrightness: 1.18
  },
  punch: { textGlow: 0.62, maxBrightness: 1.32 },
  bright: { textGlow: 0.68, maxBrightness: 1.23 }
};

for (const [name, values] of Object.entries(finishes)) {
  finishes[name] = Object.freeze({
    atmosphere: true, bezel: true, impact: true, signatureBlur: 1, signatureAlpha: 1,
    textGlow: 1, textMotion: 1, maxBrightness: Infinity,
    ...values,
    spectrum: Object.freeze(values.spectrum || {})
  });
}

export function visualFinish(theme = {}) {
  const { id, family, mode } = theme;
  if (family === 'classical') return finishes.score;
  if (['folk', 'singer-songwriter', 'country'].includes(id)) return finishes.acoustic;
  if (family === 'jazz' && id !== 'jazz-fusion') return finishes.jazz;
  if (id === 'electro-swing') return finishes.deco;
  if (id === 'anime') return finishes.cel;
  if (id === 'city-pop') return finishes.sunset;
  if (id === 'breakcore') return finishes.cutRhythm;
  if (['glitch', 'idm'].includes(id)) return finishes.fractured;
  if (id === 'soundtrack') return finishes.cinematic;
  if (['industrial-metal', 'black-metal', 'deathcore', 'progressive-metal'].includes(id)) return finishes.forged;
  if (['colour-bass', 'future-riddim'].includes(id)) return finishes.prism;
  if (id === 'midtempo-bass') return finishes.pressure;
  if (id === 'moombahton') return finishes.syncopated;
  if (['nu-disco', 'disco-house', 'disco-funk'].includes(id)) return finishes.mirror;
  if (id === 'vocaloid') return finishes.digital;
  if (id === 'kawaii-bass') return finishes.plush;
  if (mode === 'future-bass') return finishes.soft;
  if (['hardcore', 'hardstyle'].includes(mode)) {
    return ['happy-hardcore', 'uk-hardcore'].includes(id) ? finishes.bright : finishes.punch;
  }
  if (['techno', 'metal', 'rock'].includes(mode)) return finishes.metal;
  if (mode === 'house' || id === 'funk' || id === 'jazz-fusion') return finishes.club;
  if (mode === 'rnb' && id !== 'reggae') return finishes.velvet;
  if (mode === 'pop' || mode === 'j-pop') return finishes.bright;
  return finishes.neon;
}
