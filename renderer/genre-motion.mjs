const DEFAULT_PROFILE = Object.freeze({
  kind: 'dot', flow: 'radial', count: 2, speed: 1.15,
  startRadius: 2, size: 0.85, decay: 0.025,
  drag: 0.988, gravity: 0, curve: 0, jitter: 0
});

const PROFILES = Object.freeze({
  asmr: { kind: 'mote', flow: 'rise', count: 0, speed: 0.24, startRadius: 72, size: 0.9, decay: 0.009, drag: 0.997, curve: 0.004 },
  bilibili: { kind: 'bead', flow: 'lateral', count: 3, speed: 0.86, startRadius: 76, size: 0.78, decay: 0.018, drag: 0.993, curve: 0.014 },
  hardcore: { kind: 'spark', flow: 'radial', count: 4, speed: 2.45, startRadius: 62, size: 0.78, decay: 0.03, drag: 0.982 },
  hardstyle: { kind: 'chevron', flow: 'radial', count: 3, speed: 1.95, startRadius: 68, size: 0.88, decay: 0.028, drag: 0.984 },
  house: { kind: 'orb', flow: 'orbit', count: 3, speed: 1.05, startRadius: 84, size: 0.9, decay: 0.018, drag: 0.993, curve: 0.025 },
  'future-bass': { kind: 'bubble', flow: 'rise', count: 4, speed: 0.85, startRadius: 58, size: 1.15, decay: 0.016, drag: 0.994, curve: 0.008 },
  'kawaii-bass': { kind: 'paw', flow: 'rise', count: 3, speed: 0.72, startRadius: 69, size: 1.05, decay: 0.022, drag: 0.992, curve: 0.006 },
  dubstep: { kind: 'block', flow: 'radial', count: 6, speed: 1.75, startRadius: 65, size: 1.15, decay: 0.027, drag: 0.978, jitter: 0.038 },
  trap: { kind: 'triangle', flow: 'fall', count: 5, speed: 0.82, startRadius: 64, size: 1.05, decay: 0.021, drag: 0.991, gravity: 0.035 },
  garage: { kind: 'bead', flow: 'lateral', count: 4, speed: 1.35, startRadius: 74, size: 0.82, decay: 0.023, drag: 0.987, curve: 0.018 },
  breakbeat: { kind: 'shard', flow: 'lateral', count: 5, speed: 1.7, startRadius: 72, size: 0.78, decay: 0.027, drag: 0.979 },
  'drum-bass': { kind: 'streak', flow: 'warp', count: 0, speed: 3.7, startRadius: 62, size: 0.7, decay: 0.02, drag: 0.996, jitter: 0.004 },
  techno: { kind: 'square', flow: 'orbit', count: 3, speed: 1.18, startRadius: 82, size: 0.86, decay: 0.022, drag: 0.991, curve: 0.031 },
  trance: { kind: 'mote', flow: 'inward', count: 6, speed: 0.76, startRadius: 126, size: 1.08, decay: 0.013, drag: 0.996, curve: 0.012 },
  pop: { kind: 'sparkle', flow: 'rise', count: 4, speed: 0.82, startRadius: 66, size: 1.05, decay: 0.018, drag: 0.993, curve: 0.012 },
  'j-pop': { kind: 'sparkle', flow: 'orbit', count: 5, speed: 1.02, startRadius: 79, size: 0.95, decay: 0.02, drag: 0.991, curve: 0.026 },
  rock: { kind: 'dust', flow: 'radial', count: 4, speed: 1.28, startRadius: 64, size: 0.78, decay: 0.025, drag: 0.983, gravity: 0.025 },
  metal: { kind: 'spark', flow: 'radial', count: 7, speed: 2.35, startRadius: 66, size: 0.74, decay: 0.03, drag: 0.976, gravity: 0.045 },
  'hip-hop': { kind: 'block', flow: 'orbit', count: 3, speed: 0.76, startRadius: 75, size: 0.96, decay: 0.019, drag: 0.993, curve: 0.022 },
  phonk: { kind: 'dust', flow: 'orbit', count: 4, speed: 0.92, startRadius: 73, size: 0.82, decay: 0.022, drag: 0.99, curve: 0.036, jitter: 0.016 },
  rnb: { kind: 'mote', flow: 'orbit', count: 3, speed: 0.48, startRadius: 77, size: 0.92, decay: 0.013, drag: 0.996, curve: 0.013 },
  ambient: { kind: 'mote', flow: 'orbit', count: 1, speed: 0.28, startRadius: 84, size: 1, decay: 0.01, drag: 0.997, curve: 0.012 },
  experimental: { kind: 'square', flow: 'orbit', count: 3, speed: 1.08, startRadius: 78, size: 0.7, decay: 0.022, drag: 0.99, curve: 0.024, jitter: 0.014 },
  latin: { kind: 'bead', flow: 'orbit', count: 4, speed: 0.94, startRadius: 76, size: 0.84, decay: 0.02, drag: 0.991, curve: 0.035, jitter: 0.004 },
  electronic: DEFAULT_PROFILE
});

export function genreMotionProfile(theme = {}) {
  const mode = String(theme.mode || 'electronic');
  const id = String(theme.id || '');
  const base = PROFILES[mode] || DEFAULT_PROFILE;
  if (mode === 'ambient') {
    if (id === 'ambient') return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'orbit', count: 1, speed: 0.22, startRadius: 86, size: 1.04, decay: 0.009, drag: 0.998, curve: 0.01, jitter: 0.001 };
    if (id === 'chillout') return { ...DEFAULT_PROFILE, ...base, kind: 'bubble', flow: 'rise', count: 2, speed: 0.38, startRadius: 80, size: 0.92, decay: 0.012, drag: 0.996, curve: 0.009, jitter: 0.002 };
    return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'lateral', count: 2, speed: 0.46, startRadius: 81, size: 0.88, decay: 0.014, drag: 0.995, curve: 0.018, jitter: 0.003 };
  }
  if (mode === 'experimental') {
    if (id === 'glitch') return { ...DEFAULT_PROFILE, ...base, kind: 'square', flow: 'lateral', count: 4, speed: 1.28, startRadius: 76, size: 0.68, decay: 0.025, drag: 0.986, curve: 0.008, jitter: 0.038 };
    return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'orbit', count: 3, speed: 0.88, startRadius: 80, size: 0.72, decay: 0.02, drag: 0.992, curve: 0.044, jitter: 0.016 };
  }
  if (id === 'instrumental-hip-hop') return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'orbit', count: 3, speed: 0.62, startRadius: 79, size: 0.84, decay: 0.017, drag: 0.994, curve: 0.028, jitter: 0.004 };
  if (id === 'lo-fi-hip-hop') return { ...DEFAULT_PROFILE, ...base, kind: 'dust', flow: 'lateral', count: 2, speed: 0.34, startRadius: 82, size: 0.72, decay: 0.012, drag: 0.996, curve: 0.014, jitter: 0.012 };
  if (id === 'k-pop') {
    return {
      ...DEFAULT_PROFILE,
      ...base,
      kind: 'sparkle', flow: 'orbit', count: 5, speed: 1.12,
      startRadius: 76, size: 0.82, decay: 0.021,
      drag: 0.991, curve: 0.028, jitter: 0.006
    };
  }
  if (mode === 'j-pop') {
    if (id === 'city-pop') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'mote', flow: 'orbit', count: 2, speed: 0.56,
        startRadius: 82, size: 0.96, decay: 0.014,
        drag: 0.996, curve: 0.018, jitter: 0.002
      };
    }
    if (id === 'anime') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'sparkle', flow: 'radial', count: 6, speed: 1.34,
        startRadius: 72, size: 0.92, decay: 0.023,
        drag: 0.987, curve: 0.01, jitter: 0.008
      };
    }
    if (id === 'vocaloid') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'bead', flow: 'orbit', count: 6, speed: 1.18,
        startRadius: 77, size: 0.72, decay: 0.022,
        drag: 0.99, curve: 0.033, jitter: 0.006
      };
    }
    return { ...DEFAULT_PROFILE, ...base };
  }
  if (mode === 'phonk' && id === 'drift-phonk') {
    return {
      ...DEFAULT_PROFILE,
      ...base,
      kind: 'spark', flow: 'orbit', count: 5, speed: 1.42,
      startRadius: 72, size: 0.72, decay: 0.027,
      drag: 0.985, curve: 0.047, jitter: 0.024
    };
  }
  if (mode === 'garage') {
    if (id === 'future-garage') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'mote', flow: 'lateral', count: 2, speed: 0.72,
        startRadius: 75, size: 0.92, decay: 0.015,
        drag: 0.995, curve: 0.026, jitter: 0.003
      };
    }
    if (id === 'two-step-garage') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'bead', flow: 'lateral', count: 4, speed: 1.2,
        startRadius: 73, size: 0.78, decay: 0.022,
        drag: 0.99, curve: 0.04, jitter: 0.004
      };
    }
    if (id === 'speed-garage') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'bead', flow: 'lateral', count: 5, speed: 1.62,
        startRadius: 73, size: 0.76, decay: 0.025,
        drag: 0.984, curve: 0.032, jitter: 0.006
      };
    }
    if (id === 'bassline') {
      return {
        ...DEFAULT_PROFILE, ...base,
        kind: 'block', flow: 'lateral', count: 4, speed: 1.28,
        startRadius: 71, size: 0.92, decay: 0.024,
        drag: 0.987, curve: 0.03, jitter: 0.006
      };
    }
    return {
      ...DEFAULT_PROFILE, ...base,
      kind: 'bead', flow: 'lateral', count: 4, speed: 1.3,
      startRadius: 74, size: 0.82, decay: 0.022,
      drag: 0.989, curve: 0.034, jitter: 0.004
    };
  }
  if (mode === 'drum-bass') {
    if (id === 'liquid-dnb') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'warp', count: 1, speed: 2.1, size: 0.82, decay: 0.016, drag: 0.996, curve: 0.008, jitter: 0.002 };
    }
    if (id === 'dancefloor-dnb') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'streak', flow: 'warp', count: 1, speed: 4.1, size: 0.76, decay: 0.022, drag: 0.994, curve: 0.004, jitter: 0.003 };
    }
    if (id === 'jump-up-dnb') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'radial', count: 2, speed: 1.68, size: 0.94, decay: 0.026, drag: 0.983, jitter: 0.018 };
    }
    if (id === 'neurofunk') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'shard', flow: 'warp', count: 1, speed: 4.45, size: 0.7, decay: 0.026, drag: 0.988, curve: 0.006, jitter: 0.014 };
    }
    if (id === 'drumstep') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'warp', count: 1, speed: 3.25, size: 1.02, decay: 0.025, drag: 0.988, jitter: 0.012 };
    }
    if (id === 'jungle') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'shard', flow: 'lateral', count: 2, speed: 2.3, size: 0.72, decay: 0.029, drag: 0.979, curve: 0.02, jitter: 0.03 };
    }
    return { ...DEFAULT_PROFILE, ...base };
  }
  if (mode === 'techno') {
    if (id === 'minimal-techno') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'square', flow: 'orbit', count: 1, speed: 0.58, size: 0.66, decay: 0.017, drag: 0.995, curve: 0.024, jitter: 0.001 };
    }
    if (id === 'acid-techno') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'orbit', count: 4, speed: 1.22, size: 0.78, decay: 0.022, drag: 0.989, curve: 0.052, jitter: 0.012 };
    }
    if (id === 'melodic-techno') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'orbit', count: 3, speed: 0.66, size: 0.92, decay: 0.015, drag: 0.995, curve: 0.022, jitter: 0.003 };
    }
    if (id === 'industrial-techno') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'shard', flow: 'orbit', count: 5, speed: 1.52, size: 0.76, decay: 0.028, drag: 0.981, curve: 0.035, jitter: 0.026 };
    }
    if (id === 'hard-techno') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'square', flow: 'orbit', count: 4, speed: 1.48, size: 0.84, decay: 0.026, drag: 0.984, curve: 0.034, jitter: 0.006 };
    }
    return { ...DEFAULT_PROFILE, ...base };
  }
  if (mode === 'trance' && theme.family !== 'classical' && !['soundtrack', 'synthwave'].includes(id)) {
    if (id === 'psytrance') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'inward', count: 8, speed: 1.06, size: 0.86, decay: 0.017, drag: 0.993, curve: 0.021, jitter: 0.012 };
    }
    if (id === 'uplifting-trance') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'inward', count: 7, speed: 0.64, size: 1.18, decay: 0.012, drag: 0.997, curve: 0.014, jitter: 0.003 };
    }
    if (id === 'progressive-trance') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'inward', count: 4, speed: 0.48, size: 0.98, decay: 0.011, drag: 0.997, curve: 0.009, jitter: 0.002 };
    }
    if (id === 'tech-trance') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'square', flow: 'inward', count: 6, speed: 0.94, size: 0.72, decay: 0.019, drag: 0.991, curve: 0.01, jitter: 0.006 };
    }
    if (id === 'hard-trance') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'streak', flow: 'inward', count: 7, speed: 1.16, size: 0.76, decay: 0.022, drag: 0.989, curve: 0.012, jitter: 0.008 };
    }
    return { ...DEFAULT_PROFILE, ...base };
  }
  if (mode === 'hardcore' && ['happy-hardcore', 'uk-hardcore'].includes(theme.id)) {
    return { ...base, kind: 'orb', count: 3, speed: 1.15, decay: 0.023, drag: 0.989 };
  }
  if (theme.id === 'industrial-hardcore') {
    return {
      ...DEFAULT_PROFILE, ...base,
      kind: 'shard', count: 3, speed: 1.62, size: 0.82,
      decay: 0.026, drag: 0.981, gravity: 0.028, jitter: 0.014
    };
  }
  if (theme.id === 'puzzycore') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'spark', count: 5, speed: 2.7, size: 0.7, decay: 0.03, drag: 0.979 };
  }
  if (theme.id === 'rawstyle') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'chevron', count: 4, speed: 2.28, size: 0.8, decay: 0.03, drag: 0.98 };
  }
  if (theme.id === 'euphoric-hardstyle') {
    return {
      ...DEFAULT_PROFILE, ...base,
      kind: 'orb', count: 3, speed: 1.08, size: 1.02,
      decay: 0.021, drag: 0.991, curve: 0.012
    };
  }
  if (mode === 'dubstep') {
    if (id === 'melodic-dubstep') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'bubble', flow: 'rise', count: 3, speed: 0.68, size: 1.12, decay: 0.016, drag: 0.994, curve: 0.01, jitter: 0.002 };
    }
    if (id === 'colour-bass') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'bubble', flow: 'orbit', count: 5, speed: 0.82, size: 0.96, decay: 0.018, drag: 0.993, curve: 0.032, jitter: 0.006 };
    }
    if (id === 'future-riddim') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'radial', count: 4, speed: 1.02, size: 0.92, decay: 0.019, drag: 0.991, curve: 0.014, jitter: 0.004 };
    }
    if (id === 'riddim') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'radial', count: 4, speed: 1.28, size: 1.02, decay: 0.024, drag: 0.984, jitter: 0.008 };
    }
    if (id === 'brostep') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'radial', count: 7, speed: 2.12, size: 1.08, decay: 0.029, drag: 0.976, jitter: 0.052 };
    }
    if (id === 'deathstep') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'shard', flow: 'radial', count: 7, speed: 2.38, size: 0.78, decay: 0.031, drag: 0.974, gravity: 0.036, jitter: 0.028 };
    }
    if (id === 'moombahcore') {
      return { ...DEFAULT_PROFILE, ...base, kind: 'triangle', flow: 'orbit', count: 4, speed: 1.16, size: 0.9, decay: 0.023, drag: 0.987, curve: 0.045, jitter: 0.012 };
    }
  }
  if (mode === 'trap' && ['trap-edm', 'festival-trap', 'hybrid-trap', 'hard-trap'].includes(id)) {
    return { ...DEFAULT_PROFILE, ...base, kind: 'triangle', flow: 'fall', count: 4, speed: 1.08, startRadius: 70, size: 0.82, decay: 0.024, drag: 0.989, gravity: 0.052 };
  }
  if (id === 'complextro') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'shard', flow: 'lateral', count: 5, speed: 1.5, size: 0.75, decay: 0.026, drag: 0.982, jitter: 0.022 };
  }
  if (id === 'electro-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'orbit', count: 3, speed: 1.28, size: 0.88, decay: 0.023, drag: 0.987, curve: 0.019 };
  }
  if (id === 'big-room-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'spark', flow: 'radial', count: 2, speed: 1.65, size: 1.05, decay: 0.02, drag: 0.986 };
  }
  if (id === 'future-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'bubble', flow: 'orbit', count: 3, speed: 1.15, size: 1.02, decay: 0.019, drag: 0.992, curve: 0.027 };
  }
  if (id === 'tech-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'square', flow: 'orbit', count: 2, speed: 0.96, size: 0.78, decay: 0.02, drag: 0.993, curve: 0.026 };
  }
  if (id === 'deep-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'orbit', count: 1, speed: 0.44, size: 0.96, decay: 0.013, drag: 0.996, curve: 0.014, jitter: 0.002 };
  }
  if (id === 'melodic-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'orbit', count: 3, speed: 0.58, size: 0.9, decay: 0.015, drag: 0.995, curve: 0.022, jitter: 0.003 };
  }
  if (id === 'tropical-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'bubble', flow: 'orbit', count: 2, speed: 0.66, size: 1.02, decay: 0.017, drag: 0.994, curve: 0.028, jitter: 0.003 };
  }
  if (id === 'afro-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'orbit', count: 5, speed: 0.96, size: 0.8, decay: 0.021, drag: 0.99, curve: 0.042, jitter: 0.01 };
  }
  if (id === 'amapiano') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'block', flow: 'orbit', count: 4, speed: 0.82, size: 0.96, decay: 0.022, drag: 0.989, gravity: 0.018, curve: 0.038, jitter: 0.012 };
  }
  if (id === 'french-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'streak', flow: 'orbit', count: 3, speed: 1.02, size: 0.75, decay: 0.022, drag: 0.989, curve: 0.034, jitter: 0.006 };
  }
  if (id === 'disco-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'sparkle', flow: 'orbit', count: 5, speed: 0.94, size: 0.88, decay: 0.021, drag: 0.991, curve: 0.038, jitter: 0.006 };
  }
  if (id === 'hard-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'chevron', flow: 'radial', count: 4, speed: 1.78, size: 0.82, decay: 0.027, drag: 0.982, jitter: 0.014 };
  }
  if (id === 'acid-house') {
    return { ...DEFAULT_PROFILE, ...base, kind: 'bead', flow: 'orbit', count: 4, speed: 1.12, size: 0.78, decay: 0.023, drag: 0.988, curve: 0.048, jitter: 0.012 };
  }
  if (['progressive-house', 'melodic-house', 'deep-house', 'tropical-house', 'afro-house'].includes(id)) {
    return { ...DEFAULT_PROFILE, ...base, kind: 'mote', flow: 'orbit', count: 2, speed: 0.62, size: 0.92, decay: 0.014, drag: 0.995, curve: 0.018 };
  }
  if (id === 'synthwave') {
    return { ...DEFAULT_PROFILE, kind: 'streak', flow: 'lateral', count: 3, speed: 1.08, startRadius: 74, size: 0.72, decay: 0.023, drag: 0.989, jitter: 0.006 };
  }
  if (id === 'blues') {
    return { ...DEFAULT_PROFILE, kind: 'bead', flow: 'orbit', count: 3, speed: 0.48, startRadius: 81, size: 0.86, decay: 0.015, drag: 0.995, curve: 0.035, jitter: 0.004 };
  }
  if (theme.family === 'rnb' && [
    'rnb', 'contemporary-rnb', 'alternative-rnb', 'neo-soul',
    'new-jack-swing', 'soul', 'gospel', 'funk'
  ].includes(id)) {
    if (id === 'alternative-rnb') return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'lateral', count: 2, speed: 0.4, startRadius: 81, size: 0.84, decay: 0.014, drag: 0.996, curve: 0.026, jitter: 0.004 };
    if (id === 'neo-soul') return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'orbit', count: 2, speed: 0.36, startRadius: 82, size: 0.94, decay: 0.012, drag: 0.997, curve: 0.026, jitter: 0.002 };
    if (id === 'new-jack-swing') return { ...DEFAULT_PROFILE, kind: 'bead', flow: 'lateral', count: 5, speed: 1.12, startRadius: 77, size: 0.78, decay: 0.022, drag: 0.989, curve: 0.04, jitter: 0.008 };
    if (id === 'soul') return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'orbit', count: 2, speed: 0.44, startRadius: 81, size: 0.96, decay: 0.013, drag: 0.996, curve: 0.02, jitter: 0.002 };
    if (id === 'gospel') return { ...DEFAULT_PROFILE, kind: 'sparkle', flow: 'rise', count: 3, speed: 0.56, startRadius: 76, size: 0.86, decay: 0.016, drag: 0.994, curve: 0.009, jitter: 0.003 };
    if (id === 'funk') return { ...DEFAULT_PROFILE, kind: 'bead', flow: 'orbit', count: 5, speed: 1.14, startRadius: 77, size: 0.76, decay: 0.023, drag: 0.988, curve: 0.048, jitter: 0.014 };
    return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'orbit', count: 3, speed: 0.5, startRadius: 79, size: 0.9, decay: 0.014, drag: 0.996, curve: 0.016, jitter: 0.003 };
  }
  if (theme.family === 'jazz') {
    if (id === 'bebop') return { ...DEFAULT_PROFILE, kind: 'bead', flow: 'orbit', count: 4, speed: 1.08, startRadius: 79, size: 0.72, decay: 0.021, drag: 0.99, curve: 0.048, jitter: 0.018 };
    if (id === 'swing-jazz') return { ...DEFAULT_PROFILE, kind: 'bead', flow: 'orbit', count: 3, speed: 0.76, startRadius: 81, size: 0.86, decay: 0.017, drag: 0.994, curve: 0.055, jitter: 0.006 };
    if (id === 'bossa-nova') return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'orbit', count: 2, speed: 0.42, startRadius: 82, size: 0.9, decay: 0.013, drag: 0.996, curve: 0.022, jitter: 0.002 };
    if (id === 'jazz-fusion') return { ...DEFAULT_PROFILE, kind: 'sparkle', flow: 'orbit', count: 4, speed: 0.92, startRadius: 80, size: 0.78, decay: 0.02, drag: 0.991, curve: 0.038, jitter: 0.012 };
    return { ...DEFAULT_PROFILE, kind: 'mote', flow: 'orbit', count: 3, speed: 0.58, startRadius: 80, size: 0.88, decay: 0.015, drag: 0.995, curve: 0.032, jitter: 0.006 };
  }
  if (theme.family === 'classical' || id === 'soundtrack') {
    const modern = id === 'modern-classical';
    return { ...DEFAULT_PROFILE, kind: modern ? 'square' : 'mote', flow: 'orbit', count: modern ? 2 : 2, speed: modern ? 0.5 : 0.42, startRadius: 82, size: modern ? 0.7 : 0.9, decay: 0.012, drag: 0.996, curve: modern ? 0.008 : 0.014 };
  }
  return { ...DEFAULT_PROFILE, ...base };
}

export function genreParticleCount(theme, strength = 0) {
  const profile = genreMotionProfile(theme);
  const energy = Math.max(0, Math.min(1, Number(strength) || 0));
  return Math.max(0, Math.round((energy - 0.25) * profile.count));
}

export function genreImpactRadiusRatio(theme = {}, angle = 0, strength = 0) {
  const mode = String(theme.mode || 'electronic');
  const amount = Math.max(0, Math.min(1, Number(strength) || 0));
  if (mode === 'asmr') return 1;
  if (theme.id === 'synthwave') return 1 + amount * 0.018 * Math.max(0, Math.cos(angle * 4 - 0.35));
  if (theme.family === 'classical' || theme.id === 'soundtrack') return 1 + amount * 0.009 * Math.sin(angle * 3 + 0.4);
  if (mode === 'hardcore') {
    const gentle = ['happy-hardcore', 'uk-hardcore'].includes(theme.id);
    const puzzy = theme.id === 'puzzycore';
    const uptempo = theme.id === 'uptempo-hardcore';
    const teeth = gentle ? 10 : puzzy ? 14 : uptempo ? 18 : 16;
    const sharpness = gentle ? 1.8 : puzzy ? 3.5 : uptempo ? 3.25 : 2.9;
    const depth = gentle ? 0.012 : puzzy ? 0.056 : uptempo ? 0.05 : 0.039;
    return 1 + amount * depth * Math.max(0, Math.cos(angle * teeth)) ** sharpness;
  }
  if (mode === 'hardstyle') {
    const teeth = theme.id === 'rawstyle' ? 10 : theme.id === 'euphoric-hardstyle' ? 6 : 8;
    const depth = theme.id === 'rawstyle' ? 0.037 : theme.id === 'euphoric-hardstyle' ? 0.018 : 0.028;
    return 1 + amount * depth * Math.max(0, Math.cos(angle * teeth)) ** 2.45;
  }
  if (mode === 'latin') {
    const bodySway = 0.5 + 0.5 * Math.sin(angle * 3 + 0.38);
    const handPercussion = Math.max(0, Math.cos(angle * 5 - 0.72)) ** 1.7;
    return 1 + amount * (0.009 + bodySway * 0.025 + handPercussion * 0.013);
  }
  if (mode === 'house') {
    const future = theme.id === 'future-house';
    const progressive = theme.id === 'progressive-house';
    const bigRoom = theme.id === 'big-room-house';
    const bassHouse = theme.id === 'bass-house';
    if (theme.id === 'deep-house') {
      const breath = 0.5 + 0.5 * Math.cos(angle * 2 - 0.28);
      return 1 + amount * (0.007 + 0.014 * breath ** 0.8);
    }
    if (theme.id === 'melodic-house') {
      const phrase = Math.max(0, Math.cos(angle * 3 - 0.2)) ** 0.9;
      return 1 + amount * (0.009 + 0.021 * phrase);
    }
    if (theme.id === 'tropical-house') {
      const breeze = Math.max(0, Math.cos(angle * 4 + 0.35)) ** 0.72;
      return 1 + amount * (0.009 + 0.023 * breeze);
    }
    if (theme.id === 'afro-house') {
      const percussion = Math.max(0, Math.cos(angle * 5 + 0.46)) ** 1.55;
      const sway = 0.5 + 0.5 * Math.sin(angle * 3 - 0.38);
      return 1 + amount * (0.009 + 0.024 * percussion + 0.009 * sway);
    }
    if (theme.id === 'amapiano') {
      const logDrum = Math.max(0, Math.sin(angle)) ** 1.5;
      const shuffle = Math.max(0, Math.cos(angle * 3 + 0.7)) ** 1.8;
      return 1 + amount * (0.009 + 0.035 * logDrum + 0.014 * shuffle);
    }
    if (theme.id === 'french-house') {
      const filterSweep = 0.5 + 0.5 * Math.cos(angle * 2 + 0.42);
      return 1 + amount * (0.01 + 0.028 * filterSweep ** 1.2);
    }
    if (theme.id === 'disco-house') {
      const mirror = Math.max(0, Math.cos(angle * 8)) ** 2;
      return 1 + amount * (0.01 + 0.026 * mirror);
    }
    if (theme.id === 'hard-house') {
      const strike = Math.max(0, Math.cos(angle * 8 - 0.16)) ** 2.6;
      return 1 + amount * (0.01 + 0.041 * strike);
    }
    if (theme.id === 'acid-house') {
      const squelch = Math.max(0, Math.cos(angle * 6 + 0.3)) ** 1.8;
      return 1 + amount * (0.01 + 0.032 * squelch);
    }
    const lobe = Math.max(0, Math.cos(angle * 4));
    const depth = future ? 0.04 : progressive ? 0.018 : bigRoom ? 0.052 : bassHouse ? 0.046 : 0.028;
    const shape = future ? 1.55 : progressive ? 0.82 : bigRoom ? 1.18 : bassHouse ? 1.42 : 1;
    const bassTorque = bassHouse ? 0.01 * Math.abs(Math.sin(angle * 2 + 0.42)) ** 1.8 : 0;
    return 1 + amount * (depth * lobe ** shape + bassTorque);
  }
  if (mode === 'kawaii-bass') {
    // The source waveform already grows its ears from low-frequency energy.
    // Preserve that silhouette in every impact echo instead of relaxing back
    // toward a circular shockwave. The broad side lift keeps the head round,
    // while two smooth, separated peaks and a shallow crown notch read as ears.
    const wrappedDistance = (target) => Math.abs(Math.atan2(
      Math.sin(angle - target),
      Math.cos(angle - target)
    ));
    const leftEar = Math.max(0, 1 - wrappedDistance(-Math.PI / 2 - 0.72) / 0.25) ** 2.15;
    const rightEar = Math.max(0, 1 - wrappedDistance(-Math.PI / 2 + 0.72) / 0.25) ** 2.15;
    const crown = Math.max(0, 1 - wrappedDistance(-Math.PI / 2) / 0.24) ** 2;
    const cheek = Math.max(0, Math.sin(angle)) ** 2;
    return 1 + amount * (0.052 * (leftEar + rightEar) - 0.012 * crown + 0.009 * cheek);
  }
  if (mode === 'future-bass') return 1 + amount * 0.034 * Math.max(0, Math.cos(angle * 2));
  if (mode === 'dubstep') {
    if (theme.id === 'bass-music') {
      const broadMass = 0.5 + 0.5 * Math.cos(angle * 3 - 0.45);
      return 1 + amount * (0.022 + 0.026 * broadMass ** 1.45);
    }
    if (theme.id === 'riddim') {
      const square = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
      return 1 + amount * (0.014 + 0.052 * (square - Math.SQRT1_2));
    }
    if (theme.id === 'future-riddim') {
      const chordBlocks = Math.max(0, Math.cos(angle * 4 - 0.2)) ** 1.35;
      return 1 + amount * (0.012 + 0.032 * chordBlocks);
    }
    if (theme.id === 'colour-bass') {
      const spectralBands = 0.5 + 0.5 * Math.cos(angle * 9 + 0.35);
      return 1 + amount * (0.012 + 0.029 * spectralBands ** 1.25);
    }
    if (theme.id === 'melodic-dubstep') {
      const broadLift = Math.max(0, Math.cos(angle * 2 - 0.15)) ** 0.8;
      return 1 + amount * (0.011 + 0.023 * broadLift);
    }
    if (theme.id === 'deathstep') {
      const teeth = Math.max(0, Math.cos(angle * 14 + 0.25)) ** 3.2;
      return 1 + amount * (0.045 * Math.abs(Math.cos(angle)) ** 4 + 0.034 * teeth);
    }
    if (theme.id === 'brostep') {
      const growlTeeth = Math.max(0, Math.cos(angle * 10 - 0.2)) ** 2.4;
      return 1 + amount * (0.058 * Math.abs(Math.cos(angle)) ** 4 + 0.02 * growlTeeth);
    }
    if (theme.id === 'moombahcore') {
      const syncopation = 0.5 + 0.5 * Math.sin(angle * 3 + 0.62);
      return 1 + amount * (0.012 + 0.034 * syncopation ** 1.45);
    }
    return 1 + amount * 0.06 * Math.abs(Math.cos(angle)) ** 4;
  }
  if (mode === 'trap') return 1 + amount * 0.07 * Math.max(0, Math.sin(angle)) ** 2;
  if (mode === 'garage') {
    const future = theme.id === 'future-garage';
    const twoStep = theme.id === 'two-step-garage';
    const heavy = ['speed-garage', 'bassline'].includes(theme.id);
    const broadSwing = 0.5 + 0.5 * Math.sin(angle * 2 + 0.7);
    const skippedPockets = Math.max(0, Math.cos(angle * 4 + 0.48)) ** (twoStep ? 1.8 : 1.45);
    const depth = future ? 0.014 : theme.id === 'bassline' ? 0.041 : heavy ? 0.035 : twoStep ? 0.032 : 0.029;
    return 1 + amount * (future ? 0.006 : 0.009) + amount * depth * (broadSwing * 0.64 + skippedPockets * 0.36);
  }
  if (mode === 'breakbeat') return 1 + amount * 0.035 * (Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 2 ? -0.35 : 1);
  if (mode === 'drum-bass') {
    if (theme.id === 'drumstep') {
      return 1 + amount * (0.012 + 0.055 * Math.abs(Math.cos(angle)) ** 4);
    }
    if (theme.id === 'liquid-dnb') {
      const current = 0.5 + 0.5 * Math.cos(angle * 2 - 0.24);
      return 1 + amount * (0.006 + 0.018 * current ** 0.78);
    }
    if (theme.id === 'dancefloor-dnb') {
      const stageGate = Math.max(0, Math.cos(angle * 4)) ** 1.35;
      return 1 + amount * (0.009 + 0.039 * stageGate);
    }
    if (theme.id === 'jump-up-dnb') {
      const bassAnswer = Math.abs(Math.cos(angle)) ** 4.2;
      const rebound = Math.max(0, Math.cos(angle * 2 + 0.45)) ** 2;
      return 1 + amount * (0.009 + 0.052 * bassAnswer + 0.012 * rebound);
    }
    if (theme.id === 'neurofunk') {
      const servoTeeth = Math.max(0, Math.cos(angle * 10 + 0.18)) ** 2.7;
      const torque = Math.max(0, Math.cos(angle * 3 - 0.42)) ** 1.4;
      return 1 + amount * (0.009 + 0.036 * servoTeeth + 0.015 * torque);
    }
    if (theme.id === 'jungle') {
      const pattern = [1, 0.24, 0.72, 0.38, 0.92, 0.18, 0.58, 0.32, 0.8, 0.22, 0.66, 0.44];
      const normalized = ((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      const slice = Math.floor(normalized * pattern.length) % pattern.length;
      return 1 + amount * (0.008 + 0.046 * pattern[slice]);
    }
    return 1 + amount * (0.01 + 0.034 * Math.abs(Math.cos(angle)) ** 3);
  }
  if (mode === 'techno') {
    if (theme.id === 'minimal-techno') {
      return 1 + amount * 0.026 * (Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))) - Math.SQRT1_2);
    }
    if (theme.id === 'acid-techno') {
      return 1 + amount * (0.008 + 0.024 * (0.5 + 0.5 * Math.sin(angle * 3 + 0.45)));
    }
    if (theme.id === 'melodic-techno') {
      return 1 + amount * (0.006 + 0.02 * Math.max(0, Math.cos(angle * 3 - 0.3)) ** 0.9);
    }
    if (theme.id === 'industrial-techno') {
      const brokenTooth = Math.max(0, Math.cos(angle * 12 + Math.sin(angle * 5) * 0.72)) ** 2.2;
      return 1 + amount * (0.009 + brokenTooth * 0.052);
    }
    const depth = theme.id === 'hard-techno' ? 0.075 : 0.06;
    return 1 + amount * depth * (Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))) - Math.SQRT1_2);
  }
  if (mode === 'trance') {
    if (theme.id === 'psytrance') return 1 - amount * (0.026 * Math.abs(Math.sin(angle)) + 0.01 * Math.max(0, Math.cos(angle * 12)));
    if (theme.id === 'uplifting-trance') return 1 - amount * 0.026 * Math.abs(Math.sin(angle)) + amount * 0.012 * Math.max(0, Math.cos(angle * 3 - 0.25));
    if (theme.id === 'progressive-trance') return 1 - amount * 0.022 * Math.abs(Math.sin(angle));
    if (theme.id === 'tech-trance') return 1 - amount * 0.028 * Math.abs(Math.sin(angle)) + amount * 0.012 * Math.max(0, Math.cos(angle * 10)) ** 2;
    if (theme.id === 'hard-trance') return 1 - amount * 0.033 * Math.abs(Math.sin(angle)) + amount * 0.02 * Math.max(0, Math.cos(angle * 8)) ** 2.2;
    return 1 - amount * 0.038 * Math.abs(Math.sin(angle));
  }
  if (mode === 'j-pop') {
    if (theme.id === 'city-pop') {
      return 1 + amount * 0.014 * (0.35 + 0.65 * Math.max(0, Math.cos(angle * 4 - 0.22)));
    }
    if (theme.id === 'anime') {
      return 1 + amount * 0.034 * Math.max(0, Math.cos(angle * 7 - 0.18)) ** 1.65;
    }
    if (theme.id === 'vocaloid') {
      return 1 + amount * 0.027 * Math.max(0, Math.cos(angle * 12)) ** 2.2;
    }
    return 1 + amount * 0.022 * Math.max(0, Math.cos(angle * 6));
  }
  if (mode === 'pop') {
    if (theme.id === 'k-pop') {
      const pointMove = Math.max(0, Math.cos(angle * 8)) ** 2.1;
      const hookBody = Math.max(0, Math.cos(angle * 4 + 0.35)) ** 1.45;
      return 1 + amount * (0.016 * hookBody + 0.014 * pointMove);
    }
    return 1 + amount * 0.016 * Math.max(0, Math.cos(angle * 4));
  }
  if (mode === 'rock') return 1 + amount * 0.032 * Math.abs(Math.sin(angle));
  if (mode === 'metal') return 1 + amount * 0.042 * Math.max(0, Math.cos(angle * 6));
  if (mode === 'hip-hop') return 1 + amount * 0.055 * Math.max(0, Math.sin(angle));
  if (mode === 'phonk') {
    const drift = theme.id === 'drift-phonk';
    const bassMass = Math.max(0, Math.sin(angle)) ** 1.6;
    const bellTeeth = Math.max(0, Math.cos(angle * (drift ? 12 : 8) + 0.2)) ** (drift ? 3 : 2.4);
    return 1 + amount * ((drift ? 0.045 : 0.034) * bassMass + (drift ? 0.026 : 0.015) * bellTeeth);
  }
  return 1;
}
