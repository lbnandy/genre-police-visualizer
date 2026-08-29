const profile = (settings) => Object.freeze(settings);

// These are intentionally broad production families rather than subgenre
// presets. Every family still has to pass the same local-peak kick detector;
// the profile only changes which spectral evidence is most trustworthy.
export const KICK_PROFILES = Object.freeze({
  general: profile({
    id: 'general',
    novelty: { lowFlux: 2.2, midFlux: 0.82, highFlux: 0.16, bassRise: 0.82, attack: 0.34 },
    evidence: { lowFlux: 12, bassRise: 5, bassPulse: 0.55, midFlux: 1.8, attack: 2.2 },
    rhythm: { lowFlux: 10, midFlux: 6, highFlux: 1.2, bassRise: 4, attack: 3 },
    rhythmFloor: 0.34,
    rhythmGate: 0.5,
    kickinessFloor: 0.39,
    strengthFloor: 0.47,
    bodyFloor: 0.085,
    impactGate: 0.5,
    impactGain: 1,
    releaseMs: 120
  }),
  synthwave: profile({
    id: 'synthwave',
    // Synthwave usually combines a steady kick/bass foundation with a snare
    // body and bright sequenced ornaments. Let kick and snare/body establish
    // the visual pulse while preventing rapid air-band hats from firing it.
    novelty: {
      lowFlux: 2.15, midFlux: 0.94, highFlux: 0.055,
      bodyFlux: 0.86, presenceFlux: 0.46, airFlux: 0.018,
      bassRise: 0.84, attack: 0.42
    },
    evidence: {
      lowFlux: 12.2, bassRise: 5.4, bassPulse: 0.5, midFlux: 1.5,
      bodyFlux: 2.65, presenceFlux: 0.58, airFlux: 0.02, airPenalty: 1.6,
      attack: 2.25
    },
    rhythm: {
      lowFlux: 8.8, midFlux: 7.15, highFlux: 0.38,
      bodyFlux: 3.85, presenceFlux: 1.4, airFlux: 0.025, airPenalty: 1.15,
      bassRise: 4.2, attack: 3.55
    },
    rhythmFloor: 0.33,
    rhythmGate: 0.47,
    kickinessFloor: 0.38,
    strengthFloor: 0.46,
    bodyFloor: 0.068,
    impactGate: 0.49,
    impactGain: 1.01,
    releaseMs: 148
  }),
  'hip-hop': profile({
    id: 'hip-hop',
    // Hip-Hop rhythm is the pocket shared by kick, snare/body and Rap
    // phrasing. Mid/body attacks may therefore confirm the beat, while an
    // unsupported air-band hat remains too weak to launch the impact layer.
    novelty: {
      lowFlux: 2.05, midFlux: 0.96, highFlux: 0.07,
      bodyFlux: 0.92, presenceFlux: 0.48, airFlux: 0.025,
      bassRise: 0.78, attack: 0.42
    },
    evidence: {
      lowFlux: 11.4, bassRise: 5.1, bassPulse: 0.48, midFlux: 1.75,
      bodyFlux: 2.8, presenceFlux: 0.72, airFlux: 0.03, airPenalty: 1.15,
      attack: 2.35
    },
    rhythm: {
      lowFlux: 7.8, midFlux: 7.1, highFlux: 0.45,
      bodyFlux: 4.25, presenceFlux: 1.45, airFlux: 0.035, airPenalty: 0.95,
      bassRise: 3.8, attack: 3.65
    },
    rhythmFloor: 0.35,
    rhythmGate: 0.49,
    kickinessFloor: 0.39,
    strengthFloor: 0.47,
    bodyFloor: 0.074,
    impactGate: 0.5,
    impactGain: 1,
    releaseMs: 145
  }),
  trap: profile({
    id: 'trap',
    // EDM Trap couples a slow half-time body with rapid hats. Visual impacts
    // trust the 808/kick and snare body, never the fast air-band ornaments.
    novelty: {
      lowFlux: 2.35, midFlux: 0.76, highFlux: 0.045,
      bodyFlux: 0.84, presenceFlux: 0.24, airFlux: 0.01,
      bassRise: 1.02, attack: 0.43
    },
    evidence: {
      lowFlux: 13.8, bassRise: 6.4, bassPulse: 0.42, midFlux: 1.05,
      bodyFlux: 2.25, presenceFlux: 0.34, airFlux: 0, airPenalty: 1.9,
      attack: 2.55
    },
    rhythm: {
      lowFlux: 9.7, midFlux: 5.45, highFlux: 0.24,
      bodyFlux: 3.9, presenceFlux: 0.85, airFlux: 0.015, airPenalty: 1.35,
      bassRise: 5.15, attack: 3.2
    },
    rhythmFloor: 0.37,
    rhythmGate: 0.51,
    kickinessFloor: 0.42,
    strengthFloor: 0.5,
    bodyFloor: 0.082,
    impactGate: 0.52,
    impactGain: 1.04,
    releaseMs: 152
  }),
  'hard-dance': profile({
    id: 'hard-dance',
    // Distorted hard-dance kicks are broadband: low-end body, 200–900 Hz
    // punch and a short presence-band click/crunch can all mark the attack.
    // Air-only energy is kept weak so ordinary hats do not drive the core.
    novelty: {
      lowFlux: 2.1, midFlux: 0.7, highFlux: 0.08,
      bodyFlux: 1.05, presenceFlux: 1.5, airFlux: 0.08,
      bassRise: 0.82, attack: 0.38
    },
    evidence: {
      lowFlux: 9.8, bassRise: 4.6, bassPulse: 0.4, midFlux: 0.85,
      bodyFlux: 5.2, presenceFlux: 3.8, airFlux: 0.12, airPenalty: 2.0,
      attack: 2.2
    },
    rhythm: {
      lowFlux: 9.5, midFlux: 1.35, highFlux: 0.12,
      bodyFlux: 5.6, presenceFlux: 4.7, airFlux: 0.12, airPenalty: 1.4,
      bassRise: 4.8, attack: 1.8
    },
    rhythmFloor: 0.33,
    rhythmGate: 0.46,
    kickinessFloor: 0.38,
    strengthFloor: 0.47,
    bodyFloor: 0.065,
    impactGate: 0.48,
    impactGain: 1.08,
    releaseMs: 100
  }),
  hardcore: profile({
    id: 'hardcore',
    // Hardcore clipping/compression can flatten the textbook attack while the
    // 220–900 Hz body and 900–5200 Hz distorted mass still jump together.
    // Rely less on one clean bass transient and accept that coherent broadband
    // rise, while continuing to veto an unsupported air-only hat.
    novelty: {
      lowFlux: 1.9, midFlux: 0.74, highFlux: 0.07,
      bodyFlux: 1.18, presenceFlux: 1.68, airFlux: 0.07,
      bassRise: 0.68, attack: 0.28
    },
    evidence: {
      lowFlux: 8.9, bassRise: 3.8, bassPulse: 0.32, midFlux: 0.96,
      bodyFlux: 5.9, presenceFlux: 4.45, airFlux: 0.12, airPenalty: 1.85,
      attack: 1.5
    },
    rhythm: {
      lowFlux: 8.6, midFlux: 1.55, highFlux: 0.1,
      bodyFlux: 6.25, presenceFlux: 5.35, airFlux: 0.1, airPenalty: 1.34,
      bassRise: 4, attack: 1.3
    },
    rhythmFloor: 0.31,
    rhythmGate: 0.44,
    kickinessFloor: 0.35,
    strengthFloor: 0.45,
    bodyFloor: 0.052,
    impactGate: 0.46,
    impactGain: 1.12,
    releaseMs: 88
  }),
  hardstyle: profile({
    id: 'hardstyle',
    // Hardstyle more often preserves an explicit punch/tock before its tuned,
    // distorted tail. Weight low/body support and the presence attack together,
    // but keep a slightly firmer onset gate than compressed Hardcore.
    novelty: {
      lowFlux: 2.25, midFlux: 0.66, highFlux: 0.07,
      bodyFlux: 0.96, presenceFlux: 1.46, airFlux: 0.06,
      bassRise: 0.9, attack: 0.48
    },
    evidence: {
      lowFlux: 10.6, bassRise: 5.2, bassPulse: 0.46, midFlux: 0.76,
      bodyFlux: 4.7, presenceFlux: 3.65, airFlux: 0.1, airPenalty: 2.15,
      attack: 2.65
    },
    rhythm: {
      lowFlux: 10.4, midFlux: 1.18, highFlux: 0.1,
      bodyFlux: 5.05, presenceFlux: 4.25, airFlux: 0.1, airPenalty: 1.5,
      bassRise: 5.3, attack: 2.25
    },
    rhythmFloor: 0.34,
    rhythmGate: 0.47,
    kickinessFloor: 0.39,
    strengthFloor: 0.48,
    bodyFloor: 0.068,
    impactGate: 0.49,
    impactGain: 1.06,
    releaseMs: 112
  }),
  'four-floor': profile({
    id: 'four-floor',
    novelty: { lowFlux: 2.55, midFlux: 0.58, highFlux: 0.1, bassRise: 1.05, attack: 0.25 },
    evidence: { lowFlux: 14, bassRise: 6, bassPulse: 0.48, midFlux: 0.8, attack: 1.4 },
    rhythm: { lowFlux: 14, midFlux: 2, highFlux: 0.4, bassRise: 7, attack: 1.5 },
    rhythmFloor: 0.36,
    rhythmGate: 0.5,
    kickinessFloor: 0.4,
    strengthFloor: 0.49,
    bodyFloor: 0.09,
    impactGate: 0.51,
    impactGain: 1.02,
    releaseMs: 125
  }),
  trance: profile({
    id: 'trance',
    // Trance is four-floor: low-frequency flux and bass-envelope rise identify
    // the visual hit. A smaller 220–900 Hz body allowance recovers layered
    // kicks, while presence/air evidence is deliberately too weak for hats,
    // claps or bright arpeggios to masquerade as the bass drum.
    novelty: {
      lowFlux: 2.35, midFlux: 0.68, highFlux: 0.06,
      bodyFlux: 0.72, presenceFlux: 0.18, airFlux: 0.02,
      bassRise: 0.94, attack: 0.3
    },
    evidence: {
      lowFlux: 14.4, bassRise: 6.3, bassPulse: 0.56, midFlux: 0.62,
      bodyFlux: 1.85, presenceFlux: 0.16, airFlux: 0, airPenalty: 2,
      attack: 1.25
    },
    rhythm: {
      lowFlux: 12.2, midFlux: 3.25, highFlux: 0.28,
      bodyFlux: 3.1, presenceFlux: 0.72, airFlux: 0.03, airPenalty: 1.15,
      bassRise: 5.8, attack: 2.15
    },
    rhythmFloor: 0.34,
    rhythmGate: 0.48,
    kickinessFloor: 0.38,
    strengthFloor: 0.46,
    bodyFloor: 0.075,
    impactGate: 0.49,
    impactGain: 1.03,
    releaseMs: 145
  }),
  'bass-music': profile({
    id: 'bass-music',
    novelty: { lowFlux: 2.35, midFlux: 0.72, highFlux: 0.12, bassRise: 1, attack: 0.45 },
    evidence: { lowFlux: 13, bassRise: 6, bassPulse: 0.22, midFlux: 1.35, attack: 3 },
    rhythm: { lowFlux: 10, midFlux: 6, highFlux: 1, bassRise: 5, attack: 3 },
    rhythmFloor: 0.38,
    rhythmGate: 0.52,
    kickinessFloor: 0.43,
    strengthFloor: 0.51,
    bodyFloor: 0.09,
    impactGate: 0.53,
    impactGain: 1.02,
    releaseMs: 130
  }),
  garage: profile({
    id: 'garage',
    // UKG's visible groove is shared by the syncopated kick/sub pocket and
    // snare/clap body. Mid/body attacks may confirm a step, while unsupported
    // air-band hats remain too weak to launch an impact despite the shuffle.
    novelty: {
      lowFlux: 2.02, midFlux: 0.96, highFlux: 0.055,
      bodyFlux: 0.9, presenceFlux: 0.46, airFlux: 0.018,
      bassRise: 0.8, attack: 0.44
    },
    evidence: {
      lowFlux: 10.7, bassRise: 4.8, bassPulse: 0.36, midFlux: 2.25,
      bodyFlux: 3.15, presenceFlux: 0.9, airFlux: 0.025, airPenalty: 1.55,
      attack: 3.05
    },
    rhythm: {
      lowFlux: 7.9, midFlux: 7.55, highFlux: 0.38,
      bodyFlux: 4.5, presenceFlux: 1.2, airFlux: 0.025, airPenalty: 1.12,
      bassRise: 3.9, attack: 3.65
    },
    rhythmFloor: 0.34,
    rhythmGate: 0.48,
    kickinessFloor: 0.39,
    strengthFloor: 0.47,
    bodyFloor: 0.068,
    impactGate: 0.5,
    impactGain: 1.01,
    releaseMs: 118
  }),
  latin: profile({
    id: 'latin',
    // A broad Latin umbrella needs kick/sub and hand-percussion body to share
    // the groove. Mid/body transients can confirm a step, but an unsupported
    // shaker or air-band hat is deliberately too weak to fire the impact.
    novelty: {
      lowFlux: 1.95, midFlux: 1.02, highFlux: 0.06,
      bodyFlux: 1.02, presenceFlux: 0.62, airFlux: 0.02,
      bassRise: 0.68, attack: 0.52
    },
    evidence: {
      lowFlux: 9.2, bassRise: 4.05, bassPulse: 0.32, midFlux: 2.35,
      bodyFlux: 3.85, presenceFlux: 1.3, airFlux: 0.035, airPenalty: 1.4,
      attack: 3.25
    },
    rhythm: {
      lowFlux: 7.0, midFlux: 8.0, highFlux: 0.55,
      bodyFlux: 4.85, presenceFlux: 1.75, airFlux: 0.04, airPenalty: 1.05,
      bassRise: 3.25, attack: 4.0
    },
    rhythmFloor: 0.33,
    rhythmGate: 0.47,
    kickinessFloor: 0.37,
    strengthFloor: 0.46,
    bodyFloor: 0.066,
    impactGate: 0.49,
    impactGain: 1.01,
    releaseMs: 108
  }),
  'melodic-bass': profile({
    id: 'melodic-bass',
    // Future/Kawaii Bass accents often arrive as a broad chord/bass swell
    // rather than a sub-only kick. Mid/body evidence is therefore allowed to
    // reinforce the low end, while hats and air still cannot fire an impact.
    novelty: {
      lowFlux: 2.15, midFlux: 0.94, highFlux: 0.08,
      bodyFlux: 0.82, presenceFlux: 0.46, airFlux: 0.04,
      bassRise: 0.92, attack: 0.42
    },
    evidence: {
      lowFlux: 11.4, bassRise: 5.4, bassPulse: 0.3, midFlux: 2.35,
      bodyFlux: 2.6, presenceFlux: 0.72, airFlux: 0.06, airPenalty: 1.2,
      attack: 2.75
    },
    rhythm: {
      lowFlux: 8.8, midFlux: 7.4, highFlux: 0.55,
      bodyFlux: 3.2, presenceFlux: 1.15, airFlux: 0.08, airPenalty: 0.9,
      bassRise: 4.7, attack: 3.35
    },
    rhythmFloor: 0.35,
    rhythmGate: 0.49,
    kickinessFloor: 0.4,
    strengthFloor: 0.48,
    bodyFloor: 0.075,
    impactGate: 0.5,
    impactGain: 1.02,
    releaseMs: 150
  }),
  breakbeat: profile({
    id: 'breakbeat',
    // Fast breaks need the snare/body transient as well as the kick. The
    // shorter release keeps adjacent DnB hits distinct without promoting hats.
    novelty: {
      lowFlux: 1.95, midFlux: 1.12, highFlux: 0.1,
      bodyFlux: 0.95, presenceFlux: 0.68, airFlux: 0.04,
      bassRise: 0.76, attack: 0.56
    },
    evidence: {
      lowFlux: 9.4, bassRise: 4.1, bassPulse: 0.24, midFlux: 3.15,
      bodyFlux: 3.5, presenceFlux: 1.5, airFlux: 0.08, airPenalty: 1.35,
      attack: 3.7
    },
    rhythm: {
      lowFlux: 7.2, midFlux: 8.6, highFlux: 0.75,
      bodyFlux: 4.4, presenceFlux: 2.2, airFlux: 0.08, airPenalty: 1.05,
      bassRise: 3.6, attack: 4.25
    },
    rhythmFloor: 0.36,
    rhythmGate: 0.49,
    kickinessFloor: 0.4,
    strengthFloor: 0.49,
    bodyFloor: 0.07,
    impactGate: 0.51,
    impactGain: 1.04,
    releaseMs: 98
  }),
  'rock-metal': profile({
    id: 'rock-metal',
    novelty: { lowFlux: 2.05, midFlux: 1.05, highFlux: 0.16, bassRise: 0.82, attack: 0.52 },
    evidence: { lowFlux: 9.5, bassRise: 4.4, bassPulse: 0.28, midFlux: 2.75, attack: 3.6 },
    rhythm: { lowFlux: 7, midFlux: 8, highFlux: 2, bassRise: 3.5, attack: 4 },
    rhythmFloor: 0.4,
    rhythmGate: 0.53,
    kickinessFloor: 0.44,
    strengthFloor: 0.52,
    bodyFloor: 0.08,
    impactGate: 0.54,
    impactGain: 1.03,
    releaseMs: 95
  })
});

export function resolveKickProfile(theme = {}) {
  const id = String(theme.id || '').toLowerCase();
  const mode = String(theme.mode || '').toLowerCase();
  const family = String(theme.family || '').toLowerCase();
  if (id === 'synthwave') return KICK_PROFILES.synthwave;
  if (id === 'hard-dance') return KICK_PROFILES['hard-dance'];
  if (mode === 'hardstyle' || family === 'hardstyle') return KICK_PROFILES.hardstyle;
  if (mode === 'hardcore' || family === 'hardcore') return KICK_PROFILES.hardcore;
  if (mode === 'trance' || family === 'trance') {
    if (['classical', 'soundtrack', 'synthwave'].includes(id)) return KICK_PROFILES.general;
    return KICK_PROFILES.trance;
  }
  if (mode === 'hip-hop' || mode === 'phonk' || family === 'hip-hop' || family === 'phonk') {
    return KICK_PROFILES['hip-hop'];
  }
  if (mode === 'trap' || family === 'trap') {
    if (['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(id)) {
      return KICK_PROFILES.trap;
    }
    return KICK_PROFILES['bass-music'];
  }
  if (['house', 'techno'].includes(mode) || ['house', 'techno'].includes(family)) {
    return KICK_PROFILES['four-floor'];
  }
  if (['future-bass', 'kawaii-bass'].includes(mode) || family === 'future-bass') {
    return KICK_PROFILES['melodic-bass'];
  }
  if (['breakbeat', 'drum-bass'].includes(mode) || ['breakbeat', 'drum-bass'].includes(family)) {
    return KICK_PROFILES.breakbeat;
  }
  if (mode === 'garage' || family === 'garage') {
    if (['speed-garage', 'bassline'].includes(id)) return KICK_PROFILES['four-floor'];
    return KICK_PROFILES.garage;
  }
  if (mode === 'latin' || family === 'latin') return KICK_PROFILES.latin;
  if (mode === 'dubstep' || family === 'dubstep') {
    return KICK_PROFILES['bass-music'];
  }
  if (['rock', 'metal'].includes(mode) || ['rock', 'metal'].includes(family)) {
    return KICK_PROFILES['rock-metal'];
  }
  return KICK_PROFILES.general;
}
