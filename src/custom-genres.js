'use strict';

const { canonicalArtist, normalize } = require('./genre-classifier');

const MAX_CUSTOM_GENRES = 64;
const MAX_TERMS = 32;
const CUSTOM_GENRE_CORRECTION_PREFIX = 'custom:';

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeTerms(value, maxLength = 64) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(/[,，、;；\n]+/u);
  const seen = new Set();
  const terms = [];
  for (const value of values) {
    const term = cleanText(value, maxLength);
    const key = normalize(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

function normalizeHexColor(value) {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return '';
  const hex = match[1].length === 3
    ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function normalizeThemeColors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const colors = {
    accent: normalizeHexColor(value.accent),
    accent2: normalizeHexColor(value.accent2),
    hot: normalizeHexColor(value.hot)
  };
  return Object.values(colors).every(Boolean) ? colors : null;
}

function normalizeCustomGenreRules(value, validThemeIds = []) {
  if (!Array.isArray(value)) return [];
  const validThemes = new Set(validThemeIds.map((id) => String(id)));
  const usedIds = new Set();
  const rules = [];
  for (let index = 0; index < value.length && rules.length < MAX_CUSTOM_GENRES; index += 1) {
    const source = value[index];
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const name = cleanText(source.name, 38);
    const aliases = normalizeTerms(source.aliases, 64);
    const artists = normalizeTerms(source.artists, 80);
    const baseGenreId = cleanText(source.baseGenreId, 80);
    const colors = normalizeThemeColors(source.colors);
    if (!name || (!aliases.length && !artists.length) || !validThemes.has(baseGenreId)) continue;
    let id = cleanText(source.id, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || usedIds.has(id)) id = `custom-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-1`;
    usedIds.add(id);
    rules.push({ id, name, aliases, artists, baseGenreId, ...(colors ? { colors } : {}) });
  }
  return rules;
}

function artistKeys(value) {
  const artist = String(value || '').trim();
  if (!artist) return [];
  const parts = artist.split(/\s+(?:feat\.?|ft\.?|featuring|with|vs\.?)\s+|\s*[,&/、，]\s*/iu);
  return [...new Set([artist, ...parts]
    .flatMap((item) => [normalize(item), canonicalArtist(item)])
    .filter(Boolean))];
}

function matchCustomGenre(rules, { tags = [], artist = '' } = {}) {
  const tagKeys = new Set((Array.isArray(tags) ? tags : [tags]).map(normalize).filter(Boolean));
  const currentArtistKeys = new Set(artistKeys(artist));
  for (const rule of Array.isArray(rules) ? rules : []) {
    const artistMatch = normalizeTerms(rule.artists, 80)
      .find((candidate) => artistKeys(candidate).some((key) => currentArtistKeys.has(key)));
    if (artistMatch) return { rule, matchedBy: 'artist', value: artistMatch };
    const aliasMatch = normalizeTerms([rule.name, ...(rule.aliases || [])], 64)
      .find((candidate) => tagKeys.has(normalize(candidate)));
    if (aliasMatch) return { rule, matchedBy: 'tag', value: aliasMatch };
  }
  return null;
}

function customGenreCorrectionId(ruleId) {
  const cleanId = cleanText(ruleId, 80).replace(/[^a-zA-Z0-9_-]/g, '');
  return cleanId ? `${CUSTOM_GENRE_CORRECTION_PREFIX}${cleanId}` : '';
}

function findCustomGenreByCorrectionId(rules, correctionId) {
  const value = String(correctionId || '').trim();
  if (!value.startsWith(CUSTOM_GENRE_CORRECTION_PREFIX)) return null;
  const ruleId = value.slice(CUSTOM_GENRE_CORRECTION_PREFIX.length);
  return (Array.isArray(rules) ? rules : []).find((rule) => rule.id === ruleId) || null;
}

module.exports = {
  CUSTOM_GENRE_CORRECTION_PREFIX,
  MAX_CUSTOM_GENRES,
  customGenreCorrectionId,
  findCustomGenreByCorrectionId,
  matchCustomGenre,
  normalizeHexColor,
  normalizeCustomGenreRules,
  normalizeThemeColors,
  normalizeTerms
};
