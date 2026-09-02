'use strict';

const BROAD_GENRE_IDS = new Set(['unknown', 'electronic']);
const AUTHOR_FALLBACK_SOURCE = /^(?:curated artist map|user artist supplement|musicbrainz artist tags)$/i;
const COLLECTION_FALLBACK_SOURCE = /^(?:deezer album genres|deezer label|discogs release styles|musicbrainz release genres)$/i;

function genreUncertaintyReason(metadata = {}) {
  const genre = metadata.genre || {};
  const evidence = metadata.genreEvidence || {};
  const genreId = String(genre.id || 'unknown');
  const matched = String(genre.matched || evidence.matched || '');
  const primarySource = String(metadata.genreSource || '');

  if (metadata.userGenreCorrection
    || metadata.customGenreRule
    || evidence.type === 'user-correction'
    || evidence.type === 'custom-genre'
    || evidence.type === 'temporary-genre'
    || ['asmr', 'bilibili'].includes(genreId)) return '';

  if (BROAD_GENRE_IDS.has(genreId)) return 'broad-genre';

  if (evidence.type === 'audio-memory') return 'audio-memory';
  if (evidence.type === 'audio-model') {
    if (evidence.supportedByRelativeLead === true) return 'audio-relative-lead';
    if (evidence.confirmed !== true) return 'audio-unconfirmed';
    return '';
  }

  if (evidence.type === 'user-artist'
    || /^(?:artist|user-artist):/i.test(matched)
    || AUTHOR_FALLBACK_SOURCE.test(primarySource)) return 'artist-fallback';

  if (COLLECTION_FALLBACK_SOURCE.test(primarySource)) return 'collection-fallback';
  if (/^title:/i.test(matched)) return 'title-inference';
  if (/^raw:/i.test(matched) || genreId.startsWith('raw-')) return 'raw-genre';

  const confidence = Number(genre.confidence);
  if (Number.isFinite(confidence) && confidence > 0 && confidence < 0.6) return 'low-confidence';
  return '';
}

function withGenreReliability(metadata = {}) {
  const genreUncertainReason = genreUncertaintyReason(metadata);
  return {
    ...metadata,
    genreUncertain: Boolean(genreUncertainReason),
    genreUncertainReason
  };
}

module.exports = {
  genreUncertaintyReason,
  withGenreReliability
};
