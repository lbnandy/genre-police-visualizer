'use strict';

// Current HARDCORE TANO*C CREW from the label's official artist page.
// Guest artists are intentionally excluded: appearing on a TANO*C release is
// not the same thing as being a member of the crew.
const HARDCORE_TANOC_MEMBERS = Object.freeze([
  'REDALiCE',
  't+pazolite',
  'USAO',
  'P*Light',
  'DJ Genki',
  'DJ Noriken',
  'DJ Myosuke',
  'RoughSketch',
  'Kobaryo',
  'aran',
  'Massive New Krew',
  '源屋(minamotoya)',
  'kenta-v.ez.',
  'Noizenecio',
  'Getty',
  'Srav3R',
  'Laur',
  'Yuta Imai'
]);

function normalizeArtistToken(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const MEMBER_ALIASES = new Set([
  ...HARDCORE_TANOC_MEMBERS,
  'TANO*C ALL STARS',
  'TANO*C Sound Team',
  'レッドアリス',
  'ティーパゾライト',
  'ティープラスパゾライト',
  'ウサオ',
  'ピーライト',
  'ジェッティー',
  'ユウタイマイ',
  '源屋',
  'minamotoya'
].map(normalizeArtistToken));

function artistSegments(value) {
  return String(value || '')
    .normalize('NFKC')
    .split(/\s+(?:feat(?:uring)?|ft|vs|with|and)\.?\s+|\s*[&,;/×]\s*/iu)
    .map(normalizeArtistToken)
    .filter(Boolean);
}

function isHardcoreTanocArtist(artist) {
  return artistSegments(artist).some((segment) => MEMBER_ALIASES.has(segment));
}

module.exports = {
  HARDCORE_TANOC_MEMBERS,
  normalizeArtistToken,
  isHardcoreTanocArtist
};
