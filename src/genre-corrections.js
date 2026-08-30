'use strict';

const { canonicalArtist, normalize } = require('./genre-classifier');
const { normalizeThemeColors } = require('./custom-genres');
const { cleanDisplayTitle } = require('./title-normalizer');

function createGenreCorrections(value) {
  const source = value && typeof value === 'object' ? value : {};
  const tracks = {};
  for (const [storedKey, entry] of Object.entries(source.tracks && typeof source.tracks === 'object' ? source.tracks : {})) {
    if (!entry || typeof entry !== 'object') continue;
    // Older builds saved the raw Windows SMTC artist field. Apple Music can
    // append album context to that field ("Artist — Album - Single"), while
    // the resolver looks genres up with the cleaned artist. Re-key legacy
    // entries on load so an already remembered correction remains usable.
    const normalizedKey = correctionKey(entry) || storedKey;
    const existing = tracks[normalizedKey];
    if (!existing || String(entry.updatedAt || '') >= String(existing.updatedAt || '')) {
      tracks[normalizedKey] = entry;
    }
  }
  return {
    version: 1,
    updatedAt: String(source.updatedAt || ''),
    tracks
  };
}

function cleanCorrectionArtist(value) {
  const source = String(value || '').trim();
  const artist = source.split(/\s+[—–]\s+/)[0] || source;
  return artist
    .replace(/\s+[—–-]\s+.+?\s+-\s+(single|album|ep)$/i, '')
    .replace(/^by\s+/i, '')
    .trim();
}

function correctionIdentity(metadata = {}) {
  const artist = canonicalArtist(cleanCorrectionArtist(metadata.artist || metadata.albumArtist || ''));
  const title = normalize(cleanDisplayTitle(metadata.title || '')).replace(/\s+/g, ' ').trim();
  if (!title) return { key: '', fallback: false };
  if (artist) return { key: `${artist}::${title}`, fallback: false };
  const source = normalize(metadata.source || '').replace(/\s+/g, ' ').trim();
  const durationSeconds = Math.max(0, Math.round((Number(metadata.durationMs) || 0) / 1000));
  const sourceKey = source || 'unknown-source';
  const durationKey = durationSeconds ? String(durationSeconds) : 'unknown-duration';
  return {
    key: `fallback::${sourceKey}::${title}::${durationKey}`,
    fallback: true
  };
}

function correctionKey(metadata = {}) {
  return correctionIdentity(metadata).key;
}

function getGenreCorrection(existing, metadata = {}) {
  const key = correctionKey(metadata);
  if (!key) return null;
  const entry = createGenreCorrections(existing).tracks[key];
  if (!entry?.genreId) return null;
  return { ...entry, key };
}

function setGenreCorrection(existing, metadata = {}, genre = {}, now = new Date().toISOString()) {
  const state = createGenreCorrections(existing);
  const key = correctionKey(metadata);
  const genreId = String(genre.id || '').trim();
  const label = String(genre.label || genreId).trim();
  if (!key || !genreId || !label) return { state, changed: false, correction: null };
  const customGenreId = String(genre.customGenreId || '').trim();
  const baseGenreId = String(genre.baseGenreId || '').trim();
  const colors = normalizeThemeColors(genre.colors);
  const correction = {
    genreId,
    label,
    ...(customGenreId ? { customGenreId } : {}),
    ...(baseGenreId ? { baseGenreId } : {}),
    ...(colors ? { colors } : {}),
    title: String(metadata.title || '').trim(),
    artist: String(metadata.artist || metadata.albumArtist || '').trim(),
    album: String(metadata.album || '').trim(),
    source: String(metadata.source || '').trim(),
    durationMs: Math.max(0, Number(metadata.durationMs) || 0),
    fallbackIdentity: correctionIdentity(metadata).fallback,
    updatedAt: now
  };
  state.tracks[key] = correction;
  state.updatedAt = now;
  return { state, changed: true, correction: { ...correction, key } };
}

function clearGenreCorrection(existing, metadata = {}, now = new Date().toISOString()) {
  const state = createGenreCorrections(existing);
  const key = correctionKey(metadata);
  if (!key || !state.tracks[key]) return { state, changed: false };
  delete state.tracks[key];
  state.updatedAt = now;
  return { state, changed: true };
}

module.exports = {
  clearGenreCorrection,
  correctionIdentity,
  correctionKey,
  createGenreCorrections,
  getGenreCorrection,
  setGenreCorrection
};
