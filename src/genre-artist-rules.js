'use strict';

const { canonicalArtist, normalize } = require('./genre-classifier');

const MAX_GENRE_ARTIST_RULES = 256;

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function artistKeys(value) {
  const artist = cleanText(value, 120);
  if (!artist) return [];
  // Split explicit collaboration markers only. Punctuation is common inside
  // real artist names (for example AC/DC), so treating it as a credit boundary
  // would make a supplemental rule unexpectedly match unrelated artists.
  const parts = artist.split(/\s+(?:feat\.?|ft\.?|featuring|with|vs\.?)\s+/iu);
  return [...new Set([artist, ...parts]
    .flatMap((item) => [normalize(item), canonicalArtist(item)])
    .filter(Boolean))];
}

function artistRuleKey(value) {
  return canonicalArtist(value) || normalize(value);
}

function normalizeGenreArtistRules(value, validThemeIds = []) {
  if (!Array.isArray(value)) return [];
  const validThemes = new Set(validThemeIds.map(String).filter((id) => id && id !== 'unknown'));
  const rules = [];
  const indexes = new Map();
  for (const source of value) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const artist = cleanText(source.artist, 120);
    const genreId = cleanText(source.genreId, 80);
    const key = artistRuleKey(artist);
    if (!key || !validThemes.has(genreId)) continue;
    const nextRule = { artist, genreId };
    const existingIndex = indexes.get(key);
    if (existingIndex !== undefined) {
      rules[existingIndex] = nextRule;
      continue;
    }
    if (rules.length >= MAX_GENRE_ARTIST_RULES) break;
    indexes.set(key, rules.length);
    rules.push(nextRule);
  }
  return rules;
}

function matchGenreArtistRule(rules, artist) {
  const currentKeys = new Set(artistKeys(artist));
  if (!currentKeys.size) return null;
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (artistKeys(rule.artist).some((key) => currentKeys.has(key))) return rule;
  }
  return null;
}

module.exports = {
  MAX_GENRE_ARTIST_RULES,
  artistRuleKey,
  matchGenreArtistRule,
  normalizeGenreArtistRules
};
