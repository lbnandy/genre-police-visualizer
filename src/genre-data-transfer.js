'use strict';

const { MAX_CUSTOM_GENRES, normalizeCustomGenreRules } = require('./custom-genres');
const {
  MAX_GENRE_ARTIST_RULES,
  artistRuleKey,
  normalizeGenreArtistRules
} = require('./genre-artist-rules');
const { createGenreCorrections, setGenreCorrection } = require('./genre-corrections');

const GENRE_DATA_FORMAT = 'genre-police-genre-data';
const GENRE_DATA_VERSION = 1;
const MAX_IMPORTED_CORRECTIONS = 5000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function transferError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function unpackGenreData(payload) {
  if (!isRecord(payload)) throw transferError('invalid-format');
  if (payload.format === GENRE_DATA_FORMAT) {
    if (payload.version !== GENRE_DATA_VERSION) throw transferError('unsupported-version');
    if (!isRecord(payload.corrections)
      || !isRecord(payload.corrections.tracks)
      || !Array.isArray(payload.customGenres)) throw transferError('invalid-format');
    return {
      corrections: payload.corrections,
      customGenres: payload.customGenres,
      genreArtistRules: Array.isArray(payload.genreArtistRules) ? payload.genreArtistRules : []
    };
  }
  // Accept the app's older raw correction file as a corrections-only import.
  if (payload.version === 1 && isRecord(payload.tracks)) {
    return { corrections: payload, customGenres: [], genreArtistRules: [] };
  }
  throw transferError('invalid-format');
}

function normalizedTimestamp(value, fallback) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeImportedCorrections(value, themes, now) {
  const validThemes = isRecord(themes) ? themes : {};
  const sourceTracks = isRecord(value?.tracks) ? Object.entries(value.tracks) : [];
  let state = createGenreCorrections();
  for (const [, entry] of sourceTracks.slice(0, MAX_IMPORTED_CORRECTIONS)) {
    if (!isRecord(entry)) continue;
    const genreId = cleanText(entry.genreId, 80);
    const theme = validThemes[genreId];
    if (!theme || genreId === 'unknown') continue;
    const metadata = {
      title: cleanText(entry.title, 512),
      artist: cleanText(entry.artist, 256),
      album: cleanText(entry.album, 256),
      source: cleanText(entry.source, 120),
      durationMs: Math.min(86_400_000, Math.max(0, Number(entry.durationMs) || 0))
    };
    if (!metadata.title) continue;
    const updated = setGenreCorrection(state, metadata, {
      id: genreId,
      label: cleanText(theme.label || genreId, 80)
    }, normalizedTimestamp(entry.updatedAt, now));
    if (!updated.changed) continue;
    state = updated.state;
  }
  return {
    state,
    skipped: Math.max(0, sourceTracks.length - Object.keys(state.tracks).length)
  };
}

function createGenreDataExport({
  corrections,
  customGenres,
  genreArtistRules,
  themes,
  appVersion = '',
  now = new Date().toISOString()
}) {
  return {
    format: GENRE_DATA_FORMAT,
    version: GENRE_DATA_VERSION,
    appVersion: cleanText(appVersion, 40),
    exportedAt: normalizedTimestamp(now, new Date().toISOString()),
    corrections: createGenreCorrections(corrections),
    customGenres: normalizeCustomGenreRules(customGenres, Object.keys(themes || {})),
    genreArtistRules: normalizeGenreArtistRules(genreArtistRules, Object.keys(themes || {}))
  };
}

function mergeGenreData({
  payload,
  corrections,
  customGenres,
  genreArtistRules,
  themes,
  now = new Date().toISOString()
}) {
  const imported = unpackGenreData(payload);
  const importTime = normalizedTimestamp(now, new Date().toISOString());
  const currentCorrections = createGenreCorrections(corrections);
  const normalizedCorrections = normalizeImportedCorrections(imported.corrections, themes, importTime);
  const mergedCorrections = createGenreCorrections(currentCorrections);
  const summary = {
    correctionsAdded: 0,
    correctionsUpdated: 0,
    customGenresAdded: 0,
    customGenresUpdated: 0,
    genreArtistRulesAdded: 0,
    genreArtistRulesUpdated: 0,
    skipped: normalizedCorrections.skipped
  };

  for (const [key, entry] of Object.entries(normalizedCorrections.state.tracks)) {
    const existing = mergedCorrections.tracks[key];
    if (existing && JSON.stringify(existing) === JSON.stringify(entry)) {
      summary.skipped += 1;
      continue;
    }
    if (existing) summary.correctionsUpdated += 1;
    else summary.correctionsAdded += 1;
    mergedCorrections.tracks[key] = entry;
  }
  if (summary.correctionsAdded || summary.correctionsUpdated) {
    mergedCorrections.updatedAt = importTime;
  }

  const themeIds = Object.keys(themes || {});
  const existingRules = normalizeCustomGenreRules(customGenres, themeIds);
  const importedRules = normalizeCustomGenreRules(imported.customGenres, themeIds);
  summary.skipped += Math.max(0, imported.customGenres.length - importedRules.length);
  const mergedRules = [...existingRules];
  const ruleIndexes = new Map(mergedRules.map((rule, index) => [rule.id, index]));
  for (const rule of importedRules) {
    const existingIndex = ruleIndexes.get(rule.id);
    if (existingIndex !== undefined) {
      if (JSON.stringify(mergedRules[existingIndex]) === JSON.stringify(rule)) {
        summary.skipped += 1;
        continue;
      }
      mergedRules[existingIndex] = rule;
      summary.customGenresUpdated += 1;
      continue;
    }
    if (mergedRules.length >= MAX_CUSTOM_GENRES) {
      summary.skipped += 1;
      continue;
    }
    ruleIndexes.set(rule.id, mergedRules.length);
    mergedRules.push(rule);
    summary.customGenresAdded += 1;
  }

  const existingArtistRules = normalizeGenreArtistRules(genreArtistRules, themeIds);
  const importedArtistRules = normalizeGenreArtistRules(imported.genreArtistRules, themeIds);
  summary.skipped += Math.max(0, imported.genreArtistRules.length - importedArtistRules.length);
  const mergedArtistRules = [...existingArtistRules];
  const artistRuleIndexes = new Map(mergedArtistRules.map((rule, index) => [artistRuleKey(rule.artist), index]));
  for (const rule of importedArtistRules) {
    const key = artistRuleKey(rule.artist);
    const existingIndex = artistRuleIndexes.get(key);
    if (existingIndex !== undefined) {
      if (JSON.stringify(mergedArtistRules[existingIndex]) === JSON.stringify(rule)) {
        summary.skipped += 1;
        continue;
      }
      mergedArtistRules[existingIndex] = rule;
      summary.genreArtistRulesUpdated += 1;
      continue;
    }
    if (mergedArtistRules.length >= MAX_GENRE_ARTIST_RULES) {
      summary.skipped += 1;
      continue;
    }
    artistRuleIndexes.set(key, mergedArtistRules.length);
    mergedArtistRules.push(rule);
    summary.genreArtistRulesAdded += 1;
  }

  return {
    corrections: mergedCorrections,
    customGenres: normalizeCustomGenreRules(mergedRules, themeIds),
    genreArtistRules: normalizeGenreArtistRules(mergedArtistRules, themeIds),
    summary
  };
}

module.exports = {
  GENRE_DATA_FORMAT,
  GENRE_DATA_VERSION,
  createGenreDataExport,
  mergeGenreData,
  unpackGenreData
};
