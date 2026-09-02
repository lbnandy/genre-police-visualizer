'use strict';

const { createHash } = require('node:crypto');
const { correctionKey } = require('./genre-corrections');
const { isBroadAudioGenre } = require('./audio-genre-model');

const AUDIO_GENRE_MEMORY_VERSION = 1;
const AUDIO_GENRE_MODEL_REVISION = 'discogs-effnet-bsdynamic-1-major-map-v2';
const MAX_AUDIO_GENRE_MEMORIES = 500;
const MIN_PERSISTED_WINDOWS = 60;
const MIN_PERSISTED_CONFIDENCE = 0.2;
const MIN_PERSISTED_MARGIN = 0.06;
const NORMAL_PERSISTED_CONFIDENCE = 0.28;
const STRONG_PERSISTED_MARGIN = 0.09;
const WINNER_HISTORY_SIZE = 12;
const MIN_WINNER_AGREEMENT = 0.75;
const PATCH_INTERVAL_SECONDS = 0.992;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function audioGenreMemoryKey(metadata = {}) {
  const identity = correctionKey({ ...metadata, durationMs: 0 });
  if (!identity) return '';
  return createHash('sha256').update(identity).digest('hex');
}

function audioGenreMemoryStorageKey(identityHash, durationMs) {
  const durationSeconds = Math.max(0, finiteNumber(durationMs)) / 1000;
  const durationBucket = durationSeconds ? Math.round(durationSeconds / 5) * 5 : 0;
  return createHash('sha256')
    .update(`${identityHash}::${durationBucket || 'unknown-duration'}`)
    .digest('hex');
}

function createAudioGenreMemories(value, { modelRevision = AUDIO_GENRE_MODEL_REVISION } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const supportedVersion = !source.version || source.version === AUDIO_GENRE_MEMORY_VERSION;
  const entries = {};
  const candidates = Object.entries(
    supportedVersion && source.entries && typeof source.entries === 'object' ? source.entries : {}
  );
  for (const [key, entry] of candidates) {
    if (!/^[a-f\d]{64}$/i.test(key) || !entry || typeof entry !== 'object') continue;
    const genreId = String(entry.genreId || '').trim();
    if (!genreId || isBroadAudioGenre(genreId) || entry.modelRevision !== modelRevision) continue;
    const identityHash = /^[a-f\d]{64}$/i.test(entry.identityHash) ? entry.identityHash.toLowerCase() : key.toLowerCase();
    entries[key.toLowerCase()] = {
      identityHash,
      genreId,
      confidence: finiteNumber(entry.confidence),
      margin: finiteNumber(entry.margin),
      acceptedWindows: Math.max(0, Math.round(finiteNumber(entry.acceptedWindows))),
      analyzedSeconds: Math.max(0, finiteNumber(entry.analyzedSeconds)),
      durationMs: Math.max(0, finiteNumber(entry.durationMs)),
      coverageRatio: Math.max(0, Math.min(1, finiteNumber(entry.coverageRatio))),
      scores: sanitizeScores(entry.scores),
      modelRevision,
      updatedAt: String(entry.updatedAt || '')
    };
  }
  return {
    version: AUDIO_GENRE_MEMORY_VERSION,
    modelRevision,
    updatedAt: String(source.updatedAt || ''),
    entries
  };
}

function sanitizeScores(scores) {
  const result = {};
  const candidates = scores && typeof scores === 'object' ? Object.entries(scores) : [];
  for (const [id, score] of candidates) {
    const cleanId = String(id || '').trim();
    const cleanScore = finiteNumber(score, Number.NaN);
    if (!cleanId || !Number.isFinite(cleanScore)) continue;
    result[cleanId] = Math.max(0, Math.min(1, cleanScore));
  }
  return Object.fromEntries(
    Object.entries(result)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
  );
}

function durationsCompatible(storedDurationMs, currentDurationMs) {
  const stored = Math.max(0, finiteNumber(storedDurationMs));
  const current = Math.max(0, finiteNumber(currentDurationMs));
  if (!stored || !current) return true;
  const tolerance = Math.max(8000, Math.min(stored, current) * 0.05);
  return Math.abs(stored - current) <= tolerance;
}

function getAudioGenreMemory(existing, metadata = {}, options = {}) {
  const state = createAudioGenreMemories(existing, options);
  const identityHash = audioGenreMemoryKey(metadata);
  if (!identityHash) return null;
  const currentDurationMs = Math.max(0, finiteNumber(metadata.durationMs));
  const candidates = Object.entries(state.entries)
    .filter(([_key, entry]) => entry.identityHash === identityHash
      && durationsCompatible(entry.durationMs, metadata.durationMs))
    .sort((left, right) => {
      if (!currentDurationMs) {
        return String(right[1].updatedAt).localeCompare(String(left[1].updatedAt));
      }
      const leftDistance = Math.abs(finiteNumber(left[1].durationMs) - currentDurationMs);
      const rightDistance = Math.abs(finiteNumber(right[1].durationMs) - currentDurationMs);
      return leftDistance - rightDistance
        || String(right[1].updatedAt).localeCompare(String(left[1].updatedAt));
    });
  if (!candidates.length) return null;
  const [key, entry] = candidates[0];
  return { ...entry, key };
}

function isNearTrackEnd(metadata = {}) {
  const durationMs = Math.max(0, finiteNumber(metadata.durationMs));
  const positionMs = Math.max(0, finiteNumber(metadata.positionMs));
  if (durationMs < 30000 || positionMs <= 0) return false;
  const remainingMs = Math.max(0, durationMs - positionMs);
  return positionMs / durationMs >= 0.9 || remainingMs <= 20000;
}

function recentWinnerAgreement(winnerHistory, genreId) {
  const recent = Array.isArray(winnerHistory)
    ? winnerHistory.slice(-WINNER_HISTORY_SIZE).map((value) => String(value || ''))
    : [];
  if (recent.length < WINNER_HISTORY_SIZE) return 0;
  return recent.filter((value) => value === genreId).length / recent.length;
}

function createAudioGenreMemoryCandidate({
  metadata = {},
  metadataKind = 'broad',
  trackResult = {},
  acceptedWindows = 0,
  winnerHistory = [],
  nearComplete = isNearTrackEnd(metadata),
  validGenreIds,
  modelRevision = AUDIO_GENRE_MODEL_REVISION,
  now = new Date().toISOString()
} = {}) {
  const genreId = String(trackResult.id || '').trim();
  const windows = Math.max(0, Math.round(finiteNumber(acceptedWindows)));
  const confidence = finiteNumber(trackResult.confidence);
  const margin = finiteNumber(trackResult.margin);
  const allowedMetadata = ['broad', 'artist'].includes(metadataKind);
  const allowedGenre = genreId
    && !isBroadAudioGenre(genreId)
    && (!validGenreIds || validGenreIds.has(genreId));
  const agreement = recentWinnerAgreement(winnerHistory, genreId);
  const scoreQualified = confidence >= NORMAL_PERSISTED_CONFIDENCE
    ? margin >= MIN_PERSISTED_MARGIN
    : confidence >= MIN_PERSISTED_CONFIDENCE && margin >= STRONG_PERSISTED_MARGIN;
  if (!nearComplete
    || !allowedMetadata
    || !allowedGenre
    || windows < MIN_PERSISTED_WINDOWS
    || !scoreQualified
    || agreement < MIN_WINNER_AGREEMENT) return null;

  const durationMs = Math.max(0, finiteNumber(metadata.durationMs));
  const analyzedSeconds = windows * PATCH_INTERVAL_SECONDS;
  return {
    genreId,
    confidence,
    margin,
    acceptedWindows: windows,
    analyzedSeconds,
    durationMs,
    coverageRatio: durationMs ? Math.min(1, analyzedSeconds / (durationMs / 1000)) : 0,
    scores: sanitizeScores(trackResult.scores),
    modelRevision,
    updatedAt: now
  };
}

function setAudioGenreMemory(existing, metadata = {}, candidate, options = {}) {
  const modelRevision = options.modelRevision || AUDIO_GENRE_MODEL_REVISION;
  const maximumEntries = Math.max(1, Math.round(options.maximumEntries || MAX_AUDIO_GENRE_MEMORIES));
  const state = createAudioGenreMemories(existing, { modelRevision });
  const identityHash = audioGenreMemoryKey(metadata);
  if (!identityHash || !candidate || candidate.modelRevision !== modelRevision) {
    return { state, changed: false, memory: null };
  }
  const key = audioGenreMemoryStorageKey(identityHash, candidate.durationMs);
  const next = { ...candidate, identityHash, scores: sanitizeScores(candidate.scores) };
  const previous = state.entries[key];
  const comparablePrevious = previous && durationsCompatible(previous.durationMs, next.durationMs);

  if (comparablePrevious
    && previous.genreId === next.genreId
    && previous.acceptedWindows >= next.acceptedWindows
    && previous.confidence >= next.confidence
    && previous.margin >= next.margin) {
    return { state, changed: false, memory: { ...previous, key } };
  }

  state.entries[key] = next;
  state.updatedAt = next.updatedAt;
  const ordered = Object.entries(state.entries)
    .sort((left, right) => String(right[1].updatedAt).localeCompare(String(left[1].updatedAt)));
  state.entries = Object.fromEntries(ordered.slice(0, maximumEntries));
  return { state, changed: true, memory: { ...next, key } };
}

module.exports = {
  AUDIO_GENRE_MEMORY_VERSION,
  AUDIO_GENRE_MODEL_REVISION,
  MAX_AUDIO_GENRE_MEMORIES,
  MIN_PERSISTED_CONFIDENCE,
  MIN_PERSISTED_MARGIN,
  MIN_PERSISTED_WINDOWS,
  MIN_WINNER_AGREEMENT,
  NORMAL_PERSISTED_CONFIDENCE,
  PATCH_INTERVAL_SECONDS,
  STRONG_PERSISTED_MARGIN,
  WINNER_HISTORY_SIZE,
  audioGenreMemoryKey,
  audioGenreMemoryStorageKey,
  createAudioGenreMemories,
  createAudioGenreMemoryCandidate,
  durationsCompatible,
  getAudioGenreMemory,
  isNearTrackEnd,
  recentWinnerAgreement,
  sanitizeScores,
  setAudioGenreMemory
};
