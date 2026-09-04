'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUDIO_GENRE_MODEL_REVISION,
  audioGenreMemoryKey,
  audioGenreMemoryStorageKey,
  createAudioGenreMemories,
  createAudioGenreMemoryCandidate,
  durationsCompatible,
  getAudioGenreMemory,
  hasFullTrackAnalysisCoverage,
  isNearTrackBeginning,
  isNearTrackEnd,
  shouldCollectAudioGenreMemory,
  setAudioGenreMemory
} = require('../src/audio-genre-memory');

const metadata = {
  title: 'Fake Friends',
  artist: 'Revelation ft. Vetufice',
  source: 'Local file',
  durationMs: 180000,
  positionMs: 165000
};

function strongCandidate(overrides = {}) {
  return createAudioGenreMemoryCandidate({
    metadata,
    metadataKind: 'broad',
    startedNearBeginning: true,
    acceptedWindows: 75,
    winnerHistory: Array(12).fill('hardcore'),
    trackResult: {
      id: 'hardcore',
      confidence: 0.46,
      margin: 0.13,
      scores: {
        hardcore: 0.46,
        hardstyle: 0.33,
        electronic: 0.2,
        pop: 0.08,
        trance: 0.06,
        folk: 0.02
      }
    },
    now: '2026-09-01T00:00:00.000Z',
    ...overrides
  });
}

test('audio genre memory uses a stable opaque key and guards different track durations', () => {
  const key = audioGenreMemoryKey(metadata);
  assert.match(key, /^[a-f\d]{64}$/);
  assert.equal(key.includes('fake'), false);
  assert.equal(audioGenreMemoryKey({ ...metadata, durationMs: 181000 }), key);
  assert.equal(durationsCompatible(180000, 187000), true);
  assert.equal(durationsCompatible(180000, 195000), false);
});

test('near-completion requires a real duration and late playback position', () => {
  assert.equal(isNearTrackEnd(metadata), true);
  assert.equal(isNearTrackEnd({ ...metadata, positionMs: 120000 }), false);
  assert.equal(isNearTrackEnd({ ...metadata, durationMs: 0 }), false);
  assert.equal(isNearTrackEnd({ ...metadata, durationMs: 600000, positionMs: 582000 }), true);
});

test('analysis coverage can confirm a full play when the final SMTC position update is missed', () => {
  assert.equal(hasFullTrackAnalysisCoverage({
    acceptedWindows: 350,
    durationMs: 370000,
    startedNearBeginning: true
  }), true);
  assert.equal(hasFullTrackAnalysisCoverage({
    acceptedWindows: 300,
    durationMs: 370000,
    startedNearBeginning: true
  }), false);
  assert.equal(hasFullTrackAnalysisCoverage({
    acceptedWindows: 350,
    durationMs: 370000,
    startedNearBeginning: false
  }), false);
});

test('full-play memory distinguishes a start near the beginning from a mid-track start', () => {
  assert.equal(isNearTrackBeginning({ ...metadata, positionMs: 8000 }), true);
  assert.equal(isNearTrackBeginning({ ...metadata, positionMs: 20000 }), false);
  assert.equal(strongCandidate()?.fullPlaybackEvidence, true);
  assert.equal(strongCandidate({ startedNearBeginning: false })?.fullPlaybackEvidence, false);
});

test('memory collection continues through a first full play and stops for a satisfied memory', () => {
  assert.equal(shouldCollectAudioGenreMemory({
    metadataKind: 'broad',
    startedNearBeginning: true,
    acceptedWindows: 59
  }), true);
  assert.equal(shouldCollectAudioGenreMemory({
    metadataKind: 'broad',
    startedNearBeginning: true,
    acceptedWindows: 600
  }), true);
  assert.equal(shouldCollectAudioGenreMemory({
    metadataKind: 'broad',
    startedNearBeginning: false,
    acceptedWindows: 20
  }), false);
  assert.equal(shouldCollectAudioGenreMemory({
    playing: false,
    metadataKind: 'broad',
    startedNearBeginning: true
  }), false);
  assert.equal(shouldCollectAudioGenreMemory({
    metadataKind: 'broad',
    startedNearBeginning: true,
    memorySatisfied: true,
    acceptedWindows: 20
  }), false);
  assert.equal(shouldCollectAudioGenreMemory({
    metadataKind: 'specific',
    startedNearBeginning: true,
    acceptedWindows: 20
  }), false);
});

test('stable concrete cumulative results are remembered independently of the earlier UI choice', () => {
  assert.equal(strongCandidate()?.genreId, 'hardcore');
  assert.equal(strongCandidate({ acceptedWindows: 59 }), null);
  assert.equal(strongCandidate({ metadata: { ...metadata, positionMs: 10000 } }), null);
  assert.equal(strongCandidate({ metadataKind: 'specific' }), null);
  assert.equal(strongCandidate({
    trackResult: {
      id: 'hardcore',
      confidence: 0.22,
      margin: 0.095,
      scores: { hardcore: 0.22, hardstyle: 0.125 }
    }
  })?.genreId, 'hardcore');
  assert.equal(strongCandidate({
    trackResult: {
      id: 'hardcore',
      confidence: 0.22,
      margin: 0.07,
      scores: { hardcore: 0.22, hardstyle: 0.15 }
    }
  })?.genreId, 'hardcore');
  assert.equal(strongCandidate({
    trackResult: {
      id: 'hardcore',
      confidence: 0.17,
      margin: 0.02,
      scores: { hardcore: 0.17, hardstyle: 0.15 }
    }
  })?.genreId, 'hardcore');
  assert.equal(strongCandidate({
    trackResult: {
      id: 'hardcore',
      confidence: 0.14,
      margin: 0.01,
      scores: { hardcore: 0.14, hardstyle: 0.13 }
    }
  }), null);
  assert.equal(strongCandidate({
    winnerHistory: [...Array(9).fill('hardcore'), ...Array(3).fill('trance')]
  }), null);
  assert.equal(strongCandidate({
    winnerHistory: [...Array(10).fill('hardcore'), ...Array(2).fill('trance')]
  })?.genreId, 'hardcore');
  const ambiguousTrance = strongCandidate({
    trackResult: {
      id: 'psytrance',
      confidence: 0.350824,
      margin: 0.000878,
      scores: { psytrance: 0.350824, 'progressive-trance': 0.349946 }
    },
    winnerHistory: Array(12).fill('psytrance')
  });
  assert.equal(ambiguousTrance?.genreId, 'trance');
  assert.ok(ambiguousTrance?.scores.psytrance > 0);
  assert.ok(ambiguousTrance?.scores['progressive-trance'] > 0);
  assert.equal(strongCandidate({
    winnerHistory: [...Array(8).fill('hardcore'), ...Array(4).fill('trance')],
    trackResult: {
      id: 'trance',
      confidence: 0.46,
      margin: 0.13,
      scores: { trance: 0.46, hardcore: 0.33 }
    }
  }), null);
  assert.equal(strongCandidate({
    trackResult: {
      id: 'electronic',
      confidence: 0.7,
      margin: 0.3,
      scores: { electronic: 0.7, house: 0.4 }
    },
    winnerHistory: Array(12).fill('electronic')
  }), null);
});

test('saved results are restored only for compatible duration and model revision', () => {
  const candidate = strongCandidate();
  const stored = setAudioGenreMemory(createAudioGenreMemories(), metadata, candidate);
  assert.equal(stored.changed, true);
  assert.equal(Object.keys(stored.state.entries).length, 1);
  assert.equal(getAudioGenreMemory(stored.state, metadata)?.genreId, 'hardcore');
  assert.equal(getAudioGenreMemory(stored.state, { ...metadata, durationMs: 220000 }), null);
  assert.equal(getAudioGenreMemory(stored.state, metadata, { modelRevision: 'next-model' }), null);
  assert.equal(stored.state.entries[stored.memory.key].scores.folk, undefined);
});

test('v3 keeps compatible v2 memories available after the mapping revision', () => {
  const candidate = strongCandidate({
    modelRevision: 'discogs-effnet-bsdynamic-1-major-map-v2'
  });
  const identityHash = audioGenreMemoryKey(metadata);
  const storageKey = audioGenreMemoryStorageKey(identityHash, metadata.durationMs);
  const restored = createAudioGenreMemories({
    version: 1,
    modelRevision: 'discogs-effnet-bsdynamic-1-major-map-v2',
    entries: {
      [storageKey]: { ...candidate, identityHash }
    }
  });

  const memory = getAudioGenreMemory(restored, metadata);
  assert.equal(memory?.genreId, 'hardcore');
  assert.equal(memory?.fullPlaybackEvidence, true);
  assert.equal(memory?.modelRevision, 'discogs-effnet-bsdynamic-1-major-map-v2');
});

test('a later full playback upgrades an otherwise stronger partial-play memory', () => {
  const partial = strongCandidate({
    startedNearBeginning: false,
    acceptedWindows: 90,
    trackResult: {
      id: 'hardcore',
      confidence: 0.5,
      margin: 0.16,
      scores: { hardcore: 0.5, hardstyle: 0.34 }
    }
  });
  const full = strongCandidate({ acceptedWindows: 75 });
  const first = setAudioGenreMemory(createAudioGenreMemories(), metadata, partial);
  const upgraded = setAudioGenreMemory(first.state, metadata, full);
  assert.equal(first.memory.fullPlaybackEvidence, false);
  assert.equal(upgraded.changed, true);
  assert.equal(upgraded.memory.fullPlaybackEvidence, true);

  const laterPartial = strongCandidate({
    startedNearBeginning: false,
    acceptedWindows: 95,
    winnerHistory: Array(12).fill('hardstyle'),
    trackResult: {
      id: 'hardstyle',
      confidence: 0.55,
      margin: 0.2,
      scores: { hardstyle: 0.55, hardcore: 0.35 }
    }
  });
  const preserved = setAudioGenreMemory(upgraded.state, metadata, laterPartial);
  assert.equal(preserved.changed, false);
  assert.equal(preserved.memory.genreId, 'hardcore');
  assert.equal(preserved.memory.fullPlaybackEvidence, true);
});

test('different-duration versions of the same title can keep separate memories', () => {
  const original = strongCandidate();
  const remixMetadata = { ...metadata, durationMs: 220000, positionMs: 205000 };
  const remix = strongCandidate({
    metadata: remixMetadata,
    trackResult: {
      id: 'hardstyle',
      confidence: 0.48,
      margin: 0.12,
      scores: { hardstyle: 0.48, hardcore: 0.36 }
    },
    winnerHistory: Array(12).fill('hardstyle'),
    now: '2026-09-01T00:01:00.000Z'
  });
  let state = setAudioGenreMemory(createAudioGenreMemories(), metadata, original).state;
  state = setAudioGenreMemory(state, remixMetadata, remix).state;
  assert.equal(Object.keys(state.entries).length, 2);
  assert.equal(getAudioGenreMemory(state, metadata)?.genreId, 'hardcore');
  assert.equal(getAudioGenreMemory(state, remixMetadata)?.genreId, 'hardstyle');
});

test('the memory store remains bounded and prefers the newest entries', () => {
  let state = createAudioGenreMemories();
  for (let index = 0; index < 3; index += 1) {
    const track = { ...metadata, title: `Track ${index}` };
    const candidate = strongCandidate({
      metadata: track,
      now: `2026-09-01T00:00:0${index}.000Z`
    });
    state = setAudioGenreMemory(state, track, candidate, { maximumEntries: 2 }).state;
  }
  assert.equal(Object.keys(state.entries).length, 2);
  assert.equal(getAudioGenreMemory(state, { ...metadata, title: 'Track 0' }), null);
  assert.equal(getAudioGenreMemory(state, { ...metadata, title: 'Track 2' })?.genreId, 'hardcore');
});

test('malformed, broad, or stale-model entries are discarded on load', () => {
  const key = audioGenreMemoryKey(metadata);
  const base = {
    genreId: 'hardcore',
    confidence: 0.5,
    margin: 0.1,
    acceptedWindows: 80,
    modelRevision: AUDIO_GENRE_MODEL_REVISION
  };
  const state = createAudioGenreMemories({
    entries: {
      invalid: base,
      [key]: { ...base, genreId: 'electronic' }
    }
  });
  assert.deepEqual(state.entries, {});
  assert.deepEqual(createAudioGenreMemories({
    version: 2,
    entries: { [key]: base }
  }).entries, {});
});
