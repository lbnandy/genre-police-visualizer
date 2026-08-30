'use strict';

const { classifyGenre, normalize, canonicalArtist } = require('./genre-classifier');
const { matchCustomGenre } = require('./custom-genres');
const { matchGenreArtistRule } = require('./genre-artist-rules');
const { themeFor } = require('./themes');
const { canonicalizeGenreLabel, localizedGenreInfo } = require('./genre-localization');
const { cleanDisplayTitle, lookupTitle, playerTitleInfo } = require('./title-normalizer');

const GENERIC_GENRES = new Set([
  'dance', 'electronic', 'electronica', 'alternative', 'pop', 'rock', 'soundtrack'
]);

const BROAD_GENRE_IDS = new Set([
  'alternative', 'bass-music', 'breakbeat', 'dance-pop', 'drum-bass',
  'dubstep', 'garage', 'hard-dance', 'hardcore', 'hardstyle', 'hip-hop',
  'house', 'j-pop', 'metal', 'pop', 'rnb', 'rock', 'techno', 'trance',
  'trap-edm'
]);

// MusicBrainz is deliberately rate-limited and can traverse recording,
// release-group, then artist tags. Keep only that multi-hop source behind a
// resolver-level budget; the normally fast catalog sources use their own HTTP
// safety timeouts and should not lose valid results to an arbitrary 2 s cap.
const MUSICBRAINZ_LOOKUP_BUDGET_MS = 2000;
const BILIBILI_SOURCE_HINT_TTL_MS = 20 * 60 * 1000;

const NON_GENRE_TAG = /^(?:music|all|other|misc|unknown|favorites?|favourites?|seen live|live|awesome|love|best|spotify|male vocalists?|female vocalists?|instrumental|under \d+ listeners?|\d{2,4}s?)$/i;

function isGenericGenre(value) {
  return GENERIC_GENRES.has(normalize(canonicalizeGenreLabel(value)));
}

function sameGenreFamily(leftGenre, rightGenre) {
  if (!leftGenre?.id || !rightGenre?.id) return false;
  return themeFor(leftGenre.id).family === themeFor(rightGenre.id).family;
}

function shouldApplyGenreArtistRule(currentGenre, targetGenreId) {
  if (!targetGenreId || currentGenre?.id === targetGenreId) return false;
  if (!currentGenre?.id || ['unknown', 'electronic'].includes(currentGenre.id)) return true;
  if (!BROAD_GENRE_IDS.has(currentGenre.id)) return false;
  return sameGenreFamily(currentGenre, { id: targetGenreId });
}

function shouldAcceptAlbumGenre(curatedGenre, albumGenre) {
  const hasCuratedGenre = String(curatedGenre?.matched || '').startsWith('artist:');
  if (!hasCuratedGenre || !albumGenre) return true;
  if (['unknown', 'electronic', 'pop', 'rock', 'alternative'].includes(albumGenre.id)) return true;
  return sameGenreFamily(curatedGenre, albumGenre);
}

function rawGenreLabel(tags = [], { artist = '', title = '' } = {}) {
  const artistKey = normalize(artist);
  const titleKey = normalize(title);
  for (const value of tags) {
    const label = String(value || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    const key = normalize(label);
    if (!label || label.length > 38 || key.length < 2) continue;
    if (isGenericGenre(label) || NON_GENRE_TAG.test(label)) continue;
    if (key === artistKey || key === titleKey || /^https?:|www\./i.test(label)) continue;
    if (/^(?:artists? i |songs? i |albums? i |my )/i.test(label)) continue;
    return label;
  }
  return '';
}

function rawGenreTheme(label) {
  const localized = localizedGenreInfo(label);
  const displayLabel = localized?.canonical.toLocaleUpperCase() || String(label).toLocaleUpperCase();
  const key = normalize(displayLabel);
  let baseId = localized?.baseId || 'electronic';
  if (/(?:visual kei|shoegaze|emo|grunge|guitar|post punk|post rock|math rock)/i.test(key)) baseId = 'rock';
  else if (/(?:metal|grindcore|sludge|stoner doom)/i.test(key)) baseId = 'metal';
  else if (/(?:hyperpop|bubblegum|indie pop|art pop)/i.test(key)) baseId = 'pop';
  else if (/(?:japanese|doujin|denpa)/i.test(key)) baseId = 'j-pop';
  else if (/(?:ambient|idm|downtempo|experimental|chiptune|noise|breaks|club)/i.test(key)) baseId = 'electronic';
  const base = themeFor(baseId);
  const slug = key.replace(/[^a-z0-9\p{L}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 36) || 'genre';
  return {
    id: `raw-${slug}`,
    ...base,
    label: displayLabel,
    matched: `raw:${label}`,
    confidence: 0.48,
    rawGenre: label,
    inferredVisualBase: baseId
  };
}

function genreFromUserCorrection(correction, customGenres = []) {
  const genreId = String(correction?.genreId || '').trim();
  if (!genreId) return null;
  const customRule = correction?.customGenreId
    ? (Array.isArray(customGenres) ? customGenres : [])
      .find((rule) => rule.id === correction.customGenreId)
    : null;
  const baseGenreId = String(customRule?.baseGenreId || correction?.baseGenreId || genreId).trim();
  const theme = themeFor(baseGenreId);
  if (theme.label === 'UNKNOWN' && baseGenreId !== 'unknown') return null;
  const colors = customRule?.colors || correction?.colors || null;
  const customLabel = customRule?.name || (correction?.customGenreId ? correction?.label : '');
  return {
    ...theme,
    ...(colors || {}),
    ...(colors ? { genreInk: '', genreInk2: '', genreInkEdge: '' } : {}),
    id: baseGenreId,
    label: customLabel ? String(customLabel).toLocaleUpperCase() : theme.label,
    matched: `user:${genreId}`,
    confidence: 1
  };
}

function genreFromCustomRule(match) {
  if (!match?.rule?.baseGenreId || !match.rule.name) return null;
  const theme = themeFor(match.rule.baseGenreId);
  if (theme.label === 'UNKNOWN' && match.rule.baseGenreId !== 'unknown') return null;
  const colors = match.rule.colors || null;
  return {
    ...theme,
    ...(colors || {}),
    ...(colors ? { genreInk: '', genreInk2: '', genreInkEdge: '' } : {}),
    id: match.rule.baseGenreId,
    label: match.rule.name.toLocaleUpperCase(),
    matched: `custom:${match.rule.id}:${match.matchedBy}`,
    confidence: 0.99
  };
}

function cleanTitle(value) {
  return cleanDisplayTitle(value);
}

function splitArtistContext(value) {
  const artist = String(value || '').trim();
  const separators = /\s+[—–]\s+/;
  if (!separators.test(artist)) return { artist, context: '' };
  const [candidate, ...rest] = artist.split(separators);
  return { artist: candidate.trim(), context: rest.join(' ').trim() };
}

function cleanArtist(value, _title = '') {
  let artist = splitArtistContext(value).artist
    .replace(/\s+[—–-]\s+.+?\s+-\s+(single|album|ep)$/i, '')
    .replace(/^by\s+/i, '')
    .trim();
  // Chinese music clients commonly append a translated alias to the artist.
  // Keep the original Latin spelling when either side clearly represents the
  // same name in a different script; retain ordinary parenthetical stage names.
  for (let pass = 0; pass < 2; pass += 1) {
    const match = artist.match(/^(.*?)(?:\s*[（(【\[]([^）)】\]]{1,80})[）)】\]])\s*$/u);
    if (!match) break;
    const base = match[1].trim();
    const alias = match[2].trim();
    const baseHasLatin = /\p{Script=Latin}/u.test(base);
    const aliasHasLatin = /\p{Script=Latin}/u.test(alias);
    const baseHasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(base);
    const aliasHasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(alias);
    if (baseHasLatin && aliasHasCjk) artist = base;
    else if (baseHasCjk && aliasHasLatin) artist = alias;
    else break;
  }
  return artist;
}

function embeddedCollection(value) {
  return splitArtistContext(value).context
    .replace(/\s+-\s+(single|album|ep)$/i, '')
    .trim();
}

function similarity(a, b) {
  const left = normalize(a).replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
  const right = normalize(b).replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.88;
  const aTokens = new Set(left.split(' '));
  const bTokens = new Set(right.split(' '));
  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function artistSimilarity(a, b) {
  return similarity(canonicalArtist(a), canonicalArtist(b));
}

const VERSION_FAMILIES = [
  /\b(?:live|concert)\b|ライブ/i,
  /\bremix(?:ed)?\b|リミックス/i,
  /\b(?:dj\s+)?mix(?:ed)?\b|ミックス/i,
  /\bkaraoke\b|カラオケ/i,
  /\b(?:instrumental|instrumentals)\b|インスト(?:ゥルメンタル)?/i,
  /\bacoustic\b|アコースティック/i,
  /\b(?:radio|extended|club|festival)\s+edit\b/i,
  /\b(?:sped\s*up|nightcore)\b/i,
  /\bslowed(?:\s+down)?\b/i,
  /\b(?:cover|tribute)\b|トリビュート/i,
  /\bremaster(?:ed)?\b|リマスター/i,
  /\b(?:demo|version|rework|re-edit|vip)\b/i
];

function titleVersionCompatible(candidateTitle, expectedTitle) {
  const candidate = String(candidateTitle || '');
  const expected = String(expectedTitle || '');
  return VERSION_FAMILIES.every((family) => !family.test(candidate) || family.test(expected));
}

function scoreTrackCandidate(
  candidateTitle,
  candidateArtist,
  expectedTitle,
  expectedArtist,
  candidateCollection = '',
  expectedCollection = ''
) {
  const titleScore = similarity(candidateTitle, expectedTitle);
  const hasExpectedArtist = Boolean(normalize(expectedArtist))
    && !/^unknown(?: artist)?$/i.test(String(expectedArtist).trim());
  const artistScore = hasExpectedArtist
    ? artistSimilarity(candidateArtist, expectedArtist)
    : 1;
  const hasExpectedCollection = Boolean(normalize(expectedCollection));
  const collectionScore = hasExpectedCollection
    ? similarity(candidateCollection, expectedCollection)
    : 0;
  const score = hasExpectedCollection
    ? titleScore * 0.54 + artistScore * 0.32 + collectionScore * 0.14
    : titleScore * 0.62 + artistScore * 0.38;
  const versionCompatible = titleVersionCompatible(candidateTitle, expectedTitle);
  return {
    score,
    titleScore,
    artistScore,
    collectionScore,
    versionCompatible,
    valid: titleScore >= (hasExpectedArtist ? 0.68 : 0.78)
      && (!hasExpectedArtist || artistScore >= 0.52)
      && (!hasExpectedCollection || collectionScore >= 0.35)
      && versionCompatible
      && score >= (hasExpectedCollection ? 0.65 : 0.67)
  };
}

async function fetchJson(url, options = {}, timeoutMs = 5500) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent': 'GenrePoliceVisualization/0.1',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function withinLookupBudget(promise, timeoutMs) {
  return new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      resolve(null);
    }, timeoutMs);
    Promise.resolve(promise).then((value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(value);
    }, () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function containsJapanese(value) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(value || ''));
}

function preferredAppleStorefront(_rawMetadata = {}, networkCountry = '') {
  // Player identity is not a reliable region signal: the same QQ/NetEase app
  // can be used abroad, while Amazon or a browser can be used in mainland
  // China. Only the cached network-country probe changes catalog order.
  return String(networkCountry || '').toUpperCase() === 'CN' ? 'CN' : '';
}

async function queryAppleMarket(title, artist, expectedCollection, country, lang) {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=12&country=${country}&lang=${lang}`;
  const payload = await fetchJson(url, {}, 5000);
  const scored = (payload.results || []).map((item) => ({
    item,
    ...scoreTrackCandidate(
      item.trackName,
      item.artistName,
      title,
      artist,
      item.collectionName,
      expectedCollection
    )
  })).filter((candidate) => candidate.valid).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  const item = best.item;
  return {
    genre: item.primaryGenreName || '',
    artwork: String(item.artworkUrl100 || '').replace(/\/100x100bb\./, '/600x600bb.'),
    appleArtist: item.artistName || artist,
    appleTitle: item.trackName || title,
    collection: item.collectionName || '',
    score: best.score,
    storefront: country
  };
}

async function queryApple(title, artist, expectedCollection = '', preferredCountry = '') {
  if (preferredCountry === 'CN') {
    const chinese = await queryAppleMarket(title, artist, expectedCollection, 'CN', 'en_us').catch(() => null);
    if (chinese) return chinese;
    const canonical = canonicalArtist(artist);
    return queryAppleMarket(title, canonical || artist, expectedCollection, 'US', 'en_us').catch(() => null);
  }
  const japaneseMetadata = containsJapanese(`${artist} ${title}`);
  const primary = japaneseMetadata ? ['JP', 'ja_jp'] : ['US', 'en_us'];
  const fallback = japaneseMetadata ? ['US', 'en_us'] : null;
  const first = await queryAppleMarket(title, artist, expectedCollection, ...primary).catch(() => null);
  if (first || !fallback) return first;
  const canonical = canonicalArtist(artist);
  return queryAppleMarket(title, canonical || artist, expectedCollection, ...fallback);
}

async function queryLastFm(title, artist, apiKey) {
  if (!apiKey) return null;
  const base = new URL('https://ws.audioscrobbler.com/2.0/');
  base.searchParams.set('method', 'track.getTopTags');
  base.searchParams.set('api_key', apiKey);
  base.searchParams.set('artist', artist);
  base.searchParams.set('track', title);
  base.searchParams.set('autocorrect', '1');
  base.searchParams.set('format', 'json');
  const data = await fetchJson(base, {}, 5000);
  const tags = rankedLastFmTags(data?.toptags?.tag || []);
  return tags.length ? { tags } : null;
}

function rankedLastFmTags(entries = []) {
  const ranked = entries
    .filter((entry) => entry?.name)
    .map((entry) => ({ name: entry.name, count: Math.max(0, Number(entry.count) || 0) }))
    .sort((left, right) => right.count - left.count);
  const maximumCount = Math.max(0, ...ranked.map((entry) => entry.count));
  return ranked
    .filter((entry) => maximumCount <= 0 || (entry.count > 0 && entry.count >= maximumCount * 0.12))
    .map((entry) => entry.name)
    .slice(0, 8);
}

async function queryDeezer(title, artist, expectedCollection = '') {
  const term = encodeURIComponent(`${artist} ${title}`);
  const data = await fetchJson(`https://api.deezer.com/search/track?q=${term}&limit=10`, {}, 5000);
  const scored = (data.data || []).map((item) => ({
    item,
    ...scoreTrackCandidate(
      item.title,
      item.artist?.name,
      title,
      artist,
      item.album?.title,
      expectedCollection
    )
  })).filter((candidate) => candidate.valid).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  const item = best.item;
  let album = null;
  if (item.album?.id) {
    album = await fetchJson(`https://api.deezer.com/album/${item.album.id}`, {}, 4200).catch(() => null);
  }
  return {
    genres: (album?.genres?.data || []).map((entry) => entry.name).filter(Boolean),
    label: album?.label || '',
    isrc: item.isrc || '',
    artwork: album?.cover_xl || album?.cover_big || item.album?.cover_big || '',
    collection: album?.title || item.album?.title || '',
    score: best.score
  };
}

function discogsCreditName(entries = []) {
  return entries
    .map((entry) => String(entry?.name || '').replace(/\s*\(\d+\)$/, '').trim())
    .filter(Boolean)
    .join(' & ');
}

function scoreDiscogsRelease(release = {}, expected = {}) {
  const releaseArtist = discogsCreditName(release.artists);
  const releaseTitle = String(release.title || '');
  const candidates = (release.tracklist || [])
    .filter((track) => track?.type_ !== 'heading' && track?.title)
    .map((track) => {
      const trackArtist = discogsCreditName(track.artists) || releaseArtist;
      const base = scoreTrackCandidate(track.title, trackArtist, expected.title, expected.artist);
      const collectionScore = expected.album ? similarity(releaseTitle, expected.album) : 0;
      return {
        track,
        titleScore: base.titleScore,
        artistScore: base.artistScore,
        collectionScore,
        versionCompatible: base.versionCompatible,
        score: base.score * 0.94 + collectionScore * 0.06,
        valid: base.valid && (!expected.album || collectionScore >= 0.3 || base.score >= 0.92)
      };
    })
    .filter((candidate) => candidate.valid)
    .sort((left, right) => right.score - left.score);
  return candidates[0] || null;
}

async function queryDiscogs(title, artist, expectedCollection = '', token = '') {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  const search = new URL('https://api.discogs.com/database/search');
  search.searchParams.set('type', 'release');
  search.searchParams.set('artist', artist);
  search.searchParams.set('track', title);
  search.searchParams.set('per_page', '8');
  const options = { headers: { Authorization: `Discogs token=${cleanToken}` } };
  const payload = await fetchJson(search, options, 5200);
  const ids = (payload.results || [])
    .filter((entry) => entry?.type === 'release' && Number(entry.id))
    .slice(0, 4)
    .map((entry) => Number(entry.id));
  if (!ids.length) return null;
  const releases = await Promise.all(ids.map((id) => (
    fetchJson(`https://api.discogs.com/releases/${id}`, options, 4800).catch(() => null)
  )));
  const ranked = releases
    .filter(Boolean)
    .map((release) => ({ release, match: scoreDiscogsRelease(release, {
      title,
      artist,
      album: expectedCollection
    }) }))
    .filter((candidate) => candidate.match)
    .sort((left, right) => right.match.score - left.match.score);
  const best = ranked[0];
  if (!best) return null;
  return {
    styles: [...new Set((best.release.styles || []).filter(Boolean))],
    genres: [...new Set((best.release.genres || []).filter(Boolean))],
    releaseId: best.release.id,
    collection: best.release.title || '',
    score: best.match.score
  };
}

function rankedMusicBrainzTags(entity = {}) {
  const rankedTags = [...(entity.tags || []), ...(entity.genres || [])]
    .filter((tag) => tag?.name)
    .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
  const maximumCount = Math.max(0, ...rankedTags.map((tag) => Number(tag.count) || 0));
  return rankedTags
    .filter((tag) => maximumCount <= 0 || ((Number(tag.count) || 0) > 0 && (Number(tag.count) || 0) >= maximumCount * 0.15))
    .map((tag) => tag.name)
    .filter(Boolean)
    .slice(0, 8);
}

let musicBrainzNextRequestAt = 0;

async function fetchMusicBrainzJson(url, timeoutMs = 4800) {
  const delay = Math.max(0, musicBrainzNextRequestAt - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  try {
    return await fetchJson(url, {
      headers: { 'User-Agent': 'GenrePoliceVisualization/0.1 (desktop visualizer)' }
    }, timeoutMs);
  } finally {
    musicBrainzNextRequestAt = Date.now() + 1050;
  }
}

function musicBrainzCreditName(entry = {}) {
  return (entry['artist-credit'] || [])
    .map((credit) => credit?.name || credit?.artist?.name)
    .filter(Boolean)
    .join(' ');
}

function scoreMusicBrainzRecording(entry = {}, expected = {}) {
  const artist = musicBrainzCreditName(entry);
  const releases = entry.releases || [];
  const releaseScore = expected.album
    ? Math.max(0, ...releases.map((release) => similarity(release.title, expected.album)))
    : 0;
  const candidateTitle = entry.disambiguation
    ? `${entry.title} (${entry.disambiguation})`
    : entry.title;
  const base = scoreTrackCandidate(candidateTitle, artist, expected.title, expected.artist);
  return {
    score: base.score * 0.94 + releaseScore * 0.06 + (Number(entry.score || 0) / 100) * 0.04,
    titleScore: base.titleScore,
    artistScore: base.artistScore,
    collectionScore: releaseScore,
    versionCompatible: base.versionCompatible,
    valid: base.valid && (!expected.album || releaseScore >= 0.3 || base.score >= 0.92)
  };
}

async function queryMusicBrainzArtist(artist) {
  const query = encodeURIComponent(`"${artist.replace(/"/g, '')}"`);
  const url = `https://musicbrainz.org/ws/2/artist?query=${query}&fmt=json&limit=3`;
  const data = await fetchMusicBrainzJson(url, 4500);
  const candidates = (data.artists || []).map((entry) => {
    const names = [entry.name, entry['sort-name'], ...(entry.aliases || []).map((alias) => alias.name)].filter(Boolean);
    const nameScore = Math.max(...names.map((name) => similarity(name, artist)));
    return {
      entry,
      nameScore,
      score: nameScore + (Number(entry.score || 0) / 100) * 0.2
    };
  }).sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];
  const best = bestCandidate?.entry;
  if (!best || bestCandidate.nameScore < 0.65) return null;
  const tags = rankedMusicBrainzTags(best);
  return tags.length ? { tags, source: 'MusicBrainz artist tags' } : null;
}

async function queryMusicBrainzTrack(title, artist, expectedCollection = '') {
  const expression = `recording:"${String(title).replace(/"/g, '')}" AND artist:"${String(artist).replace(/"/g, '')}"`;
  const url = new URL('https://musicbrainz.org/ws/2/recording');
  url.searchParams.set('query', expression);
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '8');
  const search = await fetchMusicBrainzJson(url, 5200);
  const ranked = (search.recordings || [])
    .map((entry) => ({ entry, ...scoreMusicBrainzRecording(entry, {
      title,
      artist,
      album: expectedCollection
    }) }))
    .filter((candidate) => candidate.valid)
    .sort((left, right) => right.score - left.score);
  const best = ranked[0]?.entry;
  if (!best?.id) return queryMusicBrainzArtist(artist);

  const recording = await fetchMusicBrainzJson(
    `https://musicbrainz.org/ws/2/recording/${best.id}?inc=genres+tags+releases+release-groups&fmt=json`,
    5200
  ).catch(() => null);
  let tags = rankedMusicBrainzTags(recording || {});
  if (tags.length) {
    return { tags, source: 'MusicBrainz recording genres', recordingId: best.id };
  }

  const releases = recording?.releases || best.releases || [];
  const releaseGroups = releases
    .map((release) => release['release-group'])
    .filter((group) => group?.id)
    .sort((left, right) => (
      similarity(right.title, expectedCollection) - similarity(left.title, expectedCollection)
    ));
  const releaseGroup = releaseGroups[0];
  if (releaseGroup?.id) {
    const group = await fetchMusicBrainzJson(
      `https://musicbrainz.org/ws/2/release-group/${releaseGroup.id}?inc=genres+tags&fmt=json`,
      5200
    ).catch(() => null);
    tags = rankedMusicBrainzTags(group || {});
    if (tags.length) {
      return {
        tags,
        source: 'MusicBrainz release genres',
        recordingId: best.id,
        releaseGroupId: releaseGroup.id
      };
    }
  }
  return queryMusicBrainzArtist(artist);
}

class GenreResolver {
  constructor({ getConfig = () => ({}), getCorrection = () => null, getNetworkCountry = () => '' } = {}) {
    this.getConfig = getConfig;
    this.getCorrection = getCorrection;
    this.getNetworkCountry = getNetworkCountry;
    this.cache = new Map();
    this.bilibiliSourceHints = new Map();
    this.bilibiliTitleHints = new Map();
  }

  isBilibiliFallbackCandidate(rawMetadata = {}) {
    const titleInfo = playerTitleInfo(rawMetadata.title);
    const sourceKey = normalize(rawMetadata.source);
    const titleKey = `${sourceKey}::${normalize(titleInfo.title)}`;
    const sampledAtMs = Number(rawMetadata.sampledAtMs) || Date.now();
    const currentTitleHasBilibiliSuffix = titleInfo.removedSources.includes('bilibili');
    const currentTitleHasOtherPlayerSuffix = titleInfo.removedSources.some((source) => source !== 'bilibili');

    if (currentTitleHasOtherPlayerSuffix) {
      if (sourceKey) this.bilibiliSourceHints.delete(sourceKey);
      for (const rememberedTitleKey of this.bilibiliTitleHints.keys()) {
        if (rememberedTitleKey.startsWith(`${sourceKey}::`)) {
          this.bilibiliTitleHints.delete(rememberedTitleKey);
        }
      }
      return false;
    }

    if (currentTitleHasBilibiliSuffix && normalize(titleInfo.title)) {
      const expiresAt = sampledAtMs + BILIBILI_SOURCE_HINT_TTL_MS;
      this.bilibiliTitleHints.set(titleKey, expiresAt);
      if (sourceKey) this.bilibiliSourceHints.set(sourceKey, expiresAt);
    }

    const rememberedTitleUntil = this.bilibiliTitleHints.get(titleKey) || 0;
    const rememberedSourceUntil = sourceKey ? this.bilibiliSourceHints.get(sourceKey) || 0 : 0;
    if (rememberedTitleUntil && rememberedTitleUntil < sampledAtMs) {
      this.bilibiliTitleHints.delete(titleKey);
    }
    if (rememberedSourceUntil && rememberedSourceUntil < sampledAtMs) {
      this.bilibiliSourceHints.delete(sourceKey);
    }
    return currentTitleHasBilibiliSuffix
      || rememberedTitleUntil >= sampledAtMs
      || rememberedSourceUntil >= sampledAtMs;
  }

  async resolve(rawMetadata) {
    const title = cleanTitle(rawMetadata.title);
    const bilibiliFallbackEligible = this.isBilibiliFallbackCandidate(rawMetadata);
    const catalogTitle = lookupTitle(title);
    const rawArtist = rawMetadata.artist || rawMetadata.albumArtist;
    let artist = cleanArtist(rawArtist, title);
    const lookupArtist = canonicalArtist(artist) || artist;
    const appleStorefront = preferredAppleStorefront(rawMetadata, this.getNetworkCountry());
    const curatedGenre = classifyGenre({ artist, tags: [], title: '' });
    const hasCuratedGenre = String(curatedGenre.matched || '').startsWith('artist:');
    const playerCollection = rawMetadata.album || embeddedCollection(rawArtist);
    const correction = this.getCorrection({
      title,
      artist,
      album: playerCollection,
      source: rawMetadata.source,
      durationMs: rawMetadata.durationMs
    });
    const correctedGenre = genreFromUserCorrection(correction, this.getConfig().customGenres);
    const key = `${normalize(artist)}::${normalize(title)}::${normalize(playerCollection)}`
      + (bilibiliFallbackEligible ? '::bilibili-suffix' : '');
    const directTags = Array.isArray(rawMetadata.genres) ? rawMetadata.genres.filter(Boolean) : [];
    // A user correction is authoritative and must be checked before the
    // resolver cache. Otherwise a result cached before the user pressed
    // "Remember" can immediately replace the newly saved genre.
    if (correctedGenre) {
      const result = {
        title,
        artist: artist || 'Unknown artist',
        album: playerCollection,
        artwork: rawMetadata.artwork || '',
        isrc: '',
        rawGenres: directTags,
        genre: correctedGenre,
        genreSource: 'user correction',
        genreSources: ['user correction'],
        genreEvidence: { type: 'user-correction', genreId: correctedGenre.id },
        userGenreCorrection: {
          genreId: correction.genreId || correctedGenre.id,
          label: correctedGenre.label
        }
      };
      this.cache.set(key, result);
      return { ...result, ...rawMetadata, title: result.title, artist: result.artist, album: result.album, artwork: result.artwork };
    }

    const customGenreMatch = matchCustomGenre(this.getConfig().customGenres, {
      tags: directTags,
      artist
    });
    const directCustomGenre = genreFromCustomRule(customGenreMatch);
    if (directCustomGenre) {
      const result = {
        title,
        artist: artist || 'Unknown artist',
        album: playerCollection,
        artwork: rawMetadata.artwork || '',
        isrc: '',
        rawGenres: directTags,
        genre: directCustomGenre,
        genreSource: 'custom genre rule',
        genreSources: ['custom genre rule'],
        genreEvidence: {
          type: 'custom-genre',
          ruleName: customGenreMatch.rule.name,
          matchedBy: customGenreMatch.matchedBy
        },
        customGenreRule: { id: customGenreMatch.rule.id, name: customGenreMatch.rule.name },
        userGenreCorrection: null
      };
      this.cache.set(key, result);
      return { ...result, ...rawMetadata, title: result.title, artist: result.artist, album: result.album, artwork: result.artwork };
    }

    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      return {
        ...cached,
        ...rawMetadata,
        title,
        artist,
        album: cached.album,
        artwork: rawMetadata.artwork || cached.artwork
      };
    }

    const contentGenre = classifyGenre({ tags: directTags, artist, title });
    if (contentGenre.id === 'asmr') {
      const result = {
        title,
        artist: artist || 'Unknown artist',
        album: playerCollection,
        artwork: rawMetadata.artwork || '',
        isrc: '',
        rawGenres: directTags,
        genre: contentGenre,
        genreSource: 'title/artist ASMR signal',
        genreSources: ['title/artist ASMR signal'],
        genreEvidence: { type: 'classifier', matched: contentGenre.matched },
        userGenreCorrection: null
      };
      this.cache.set(key, result);
      return { ...result, ...rawMetadata, title: result.title, artist: result.artist, album: result.album, artwork: result.artwork };
    }
    const tags = [...directTags];
    const sources = directTags.length ? ['Windows media metadata'] : [];
    let artwork = rawMetadata.artwork || '';
    let collection = playerCollection;

    // Start the optional MusicBrainz fallback alongside the regular catalog
    // lookups. We only consume it below when the faster sources remain broad,
    // but it must not add a second serial network wait to track changes.
    const onlineGenreLookupEnabled = this.getConfig().onlineGenreLookupEnabled !== false;
    const musicBrainzTask = onlineGenreLookupEnabled && artist && !hasCuratedGenre
      ? withinLookupBudget(
        queryMusicBrainzTrack(catalogTitle, lookupArtist, collection),
        MUSICBRAINZ_LOOKUP_BUDGET_MS
      )
      : Promise.resolve(null);
    const tasks = onlineGenreLookupEnabled
      ? [
        queryApple(catalogTitle, artist, collection, appleStorefront).catch(() => null),
        queryLastFm(catalogTitle, lookupArtist, this.getConfig().lastFmApiKey || process.env.LASTFM_API_KEY).catch(() => null),
        // Deezer's public endpoint is frequently unreachable from mainland
        // China. A QQ Music / NetEase session already receives Apple CN plus
        // MusicBrainz, so do not make the entire track change wait on a known
        // poor regional route.
        appleStorefront === 'CN'
          ? Promise.resolve(null)
          : queryDeezer(catalogTitle, lookupArtist, collection).catch(() => null),
        queryDiscogs(
          catalogTitle,
          lookupArtist,
          collection,
          this.getConfig().discogsToken || process.env.DISCOGS_TOKEN
        ).catch(() => null),
        musicBrainzTask
      ]
      : [null, null, null, null, null].map((value) => Promise.resolve(value));
    const [apple, lastFm, deezer, discogs, musicBrainzCandidate] = await Promise.all(tasks);

    if (apple) {
      if (apple.genre) {
        tags.push(apple.genre);
        sources.push('Apple catalog');
      }
      artwork = artwork || apple.artwork;
      collection = collection || apple.collection;
    }
    if (lastFm?.tags?.length) {
      tags.unshift(...lastFm.tags);
      sources.unshift('Last.fm track tags');
    }
    const discogsTags = [...(discogs?.styles || []), ...(discogs?.genres || [])];
    const discogsGenre = discogsTags.length
      ? classifyGenre({ tags: discogsTags, artist: '', title: '' })
      : null;
    if (discogsTags.length && shouldAcceptAlbumGenre(curatedGenre, discogsGenre)) {
      const insertAt = lastFm?.tags?.length || 0;
      tags.splice(insertAt, 0, ...discogsTags);
      sources.splice(lastFm?.tags?.length ? 1 : 0, 0, 'Discogs release styles');
    }
    const deezerGenre = deezer?.genres?.length
      ? classifyGenre({ tags: deezer.genres, artist: '', title: '' })
      : null;
    const acceptDeezerGenre = shouldAcceptAlbumGenre(curatedGenre, deezerGenre);
    if (deezer) {
      if (deezer.genres.length && acceptDeezerGenre) {
        // Album-wide genres are useful corroboration, but must never outrank
        // track-specific Last.fm tags or direct player metadata. Otherwise a
        // compilation album can classify a rock track as DnB/techno/etc.
        tags.push(...deezer.genres);
        sources.push('Deezer album genres');
      }
      artwork = artwork || deezer.artwork;
      collection = collection || deezer.collection;
    }

    const deezerLabelGenre = deezer?.label
      ? classifyGenre({ tags: [deezer.label], artist: '', title: '' })
      : null;
    const specificBeforeMb = tags.some((tag) => !isGenericGenre(tag))
      || (deezerLabelGenre && !['electronic', 'unknown'].includes(deezerLabelGenre.id));
    if (!specificBeforeMb && musicBrainzCandidate?.tags?.length) {
      tags.unshift(...musicBrainzCandidate.tags);
      sources.unshift(musicBrainzCandidate.source || 'MusicBrainz recording genres');
    }

    const catalogCustomMatch = matchCustomGenre(this.getConfig().customGenres, { tags, artist });
    let genre = genreFromCustomRule(catalogCustomMatch) || classifyGenre({ tags, artist, title });
    if (catalogCustomMatch) sources.unshift('custom genre rule');
    if (!catalogCustomMatch && ['electronic', 'unknown'].includes(genre.id) && deezer?.label) {
      const labelCompatible = !hasCuratedGenre || sameGenreFamily(curatedGenre, deezerLabelGenre);
      if (labelCompatible && deezerLabelGenre && !['electronic', 'unknown'].includes(deezerLabelGenre.id)) {
        genre = { ...deezerLabelGenre, confidence: 0.56, matched: `label:${deezer.label}` };
        sources.unshift('Deezer label');
      }
    }
    if (genre.matched.startsWith('artist:')) sources.unshift('curated artist map');
    const rawGenres = [...new Set(tags)];
    if (genre.id === 'unknown') {
      const rawLabel = rawGenreLabel(rawGenres, { artist, title });
      if (rawLabel) {
        genre = rawGenreTheme(rawLabel);
      }
    }
    const genreArtistRule = matchGenreArtistRule(this.getConfig().genreArtistRules, artist);
    let genreEvidence = null;
    if (!catalogCustomMatch && genreArtistRule && shouldApplyGenreArtistRule(genre, genreArtistRule.genreId)) {
      genre = {
        id: genreArtistRule.genreId,
        ...themeFor(genreArtistRule.genreId),
        matched: `user-artist:${genreArtistRule.artist}`,
        confidence: 0.74
      };
      genreEvidence = {
        type: 'user-artist',
        artist: genreArtistRule.artist,
        genreId: genreArtistRule.genreId
      };
      sources.unshift('user artist supplement');
    }
    if (genre.id === 'unknown' && bilibiliFallbackEligible) {
      genre = {
        id: 'bilibili',
        ...themeFor('bilibili'),
        matched: 'source:bilibili-suffix',
        confidence: 0.52
      };
      sources.unshift('Bilibili player suffix fallback');
    }
    const result = {
      title,
      artist: artist || 'Unknown artist',
      album: collection,
      artwork,
      isrc: deezer?.isrc || '',
      rawGenres,
      genre,
      genreSource: sources[0] || 'local classifier',
      genreSources: [...new Set(sources)],
      genreEvidence: genreEvidence || {
        type: catalogCustomMatch ? 'custom-genre' : 'classifier',
        ...(catalogCustomMatch
          ? { ruleName: catalogCustomMatch.rule.name, matchedBy: catalogCustomMatch.matchedBy }
          : { matched: genre.matched || '' })
      },
      customGenreRule: catalogCustomMatch
        ? { id: catalogCustomMatch.rule.id, name: catalogCustomMatch.rule.name }
        : null,
      userGenreCorrection: null
    };
    this.cache.set(key, result);
    return {
      ...result,
      ...rawMetadata,
      title: result.title,
      artist: result.artist,
      album: result.album,
      artwork: result.artwork
    };
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = {
  GenreResolver,
  genreFromCustomRule,
  cleanArtist,
  embeddedCollection,
  splitArtistContext,
  cleanTitle,
  lookupTitle,
  similarity,
  artistSimilarity,
  titleVersionCompatible,
  scoreTrackCandidate,
  scoreDiscogsRelease,
  scoreMusicBrainzRecording,
  sameGenreFamily,
  shouldApplyGenreArtistRule,
  shouldAcceptAlbumGenre,
  rankedLastFmTags,
  rankedMusicBrainzTags,
  rawGenreLabel,
  rawGenreTheme,
  genreFromUserCorrection,
  preferredAppleStorefront,
  queryApple,
  queryDeezer,
  queryDiscogs,
  queryMusicBrainzTrack
};
