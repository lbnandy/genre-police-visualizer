'use strict';

const {
  cleanTitle,
  lookupTitle,
  cleanArtist,
  embeddedCollection,
  scoreTrackCandidate,
  similarity
} = require('./genre-resolver');
const { canonicalArtist, normalize } = require('./genre-classifier');

const PROVIDER_TIMEOUT_MS = 3800;
const AGGREGATION_WINDOW_MS = 2800;
const MAX_DURATION_DIFFERENCE_SECONDS = 4;
const PROVIDER_PRIORITY = Object.freeze({
  lrclib: 0.012,
  netease: 0.006,
  tencent: 0
});

const CREDIT_LINE = /^(?:[词詞曲]|词曲|詞曲|填词|填詞|谱曲|譜曲|作[词詞]|作曲|编曲|編曲|制作人|製作人|监制|監製|演唱|原唱|(?:混音|母带|母帶|录音|錄音)(?:助理|工程|师|師)?|(?:和声|和聲|合声|合聲)(?:编写|編寫)?|和音|人声|人聲|吉他|贝斯|貝斯|键盘|鍵盤|弦乐|弦樂|鼓|发行|發行|出品|版权|版權|lyrics?\s+by|composed?\s+by|produced?\s+by|written\s+by|arranged\s+by|music\s+by)\s*[:：]/iu;

function isLikelyChineseText(value) {
  const text = String(value || '').trim();
  if (!text || !/\p{Script=Han}/u.test(text)) return false;
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text)) return false;
  const letters = text.match(/\p{L}/gu) || [];
  const han = text.match(/\p{Script=Han}/gu) || [];
  return han.length >= Math.max(1, Math.ceil(letters.length * 0.35));
}

function isLikelyChineseTranslation(candidate, original) {
  if (!isLikelyChineseText(candidate)) return false;
  // Chinese originals do not need a second Chinese display line. Japanese
  // and Korean originals remain eligible because their script-specific
  // characters make isLikelyChineseText(original) false.
  return !isLikelyChineseText(original)
    && String(candidate || '').trim() !== String(original || '').trim();
}

function parseSyncedLyrics(value) {
  const source = String(value || '');
  if (!source.trim()) return [];
  const offsetMatch = source.match(/^\[offset:([+-]?\d+)\]/im);
  const offsetMs = Number(offsetMatch?.[1]) || 0;
  const entries = [];

  source.split(/\r?\n/).forEach((line) => {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    if (!stamps.length) return;
    const text = line
      .replace(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g, '')
      .replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '')
      .trim();
    if (!text || CREDIT_LINE.test(text)) return;
    stamps.forEach((stamp) => {
      const minutes = Number(stamp[1]) || 0;
      const seconds = Number(stamp[2]) || 0;
      entries.push({ atMs: Math.max(0, Math.round((minutes * 60 + seconds) * 1000 + offsetMs)), text });
    });
  });

  entries.sort((left, right) => left.atMs - right.atMs);
  const merged = [];
  entries.forEach((entry) => {
    const previous = merged[merged.length - 1];
    if (previous?.atMs === entry.atMs) {
      if (!previous.translation && isLikelyChineseTranslation(entry.text, previous.text)) {
        previous.translation = entry.text;
      } else if (!previous.translation && isLikelyChineseTranslation(previous.text, entry.text)) {
        previous.translation = previous.text;
        previous.text = entry.text;
      } else if (!previous.text.includes(entry.text)) {
        previous.text += ` / ${entry.text}`;
      }
    } else if (previous?.text !== entry.text || entry.atMs - previous.atMs > 900) {
      merged.push(entry);
    }
  });
  return merged;
}

function mergeLyricTranslations(lines, translationLines, toleranceMs = 480) {
  const merged = (Array.isArray(lines) ? lines : []).map((line) => ({ ...line }));
  const translations = (Array.isArray(translationLines) ? translationLines : [])
    .filter((line) => line?.text && isLikelyChineseText(line.text));
  const used = new Set();

  merged.forEach((line) => {
    if (line.translation || !line?.text || isLikelyChineseText(line.text)) return;
    let bestIndex = -1;
    let bestDistance = Infinity;
    translations.forEach((translation, index) => {
      if (used.has(index) || !isLikelyChineseTranslation(translation.text, line.text)) return;
      const distance = Math.abs((Number(translation.atMs) || 0) - (Number(line.atMs) || 0));
      if (distance <= toleranceMs && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) return;
    line.translation = translations[bestIndex].text;
    used.add(bestIndex);
  });
  return merged;
}

function lyricLookupContext(rawMetadata = {}) {
  const title = cleanTitle(rawMetadata.title);
  const catalogTitle = lookupTitle(title);
  const rawArtist = rawMetadata.artist || rawMetadata.albumArtist;
  const artist = cleanArtist(rawArtist, title);
  const lookupArtist = canonicalArtist(artist) || artist;
  const album = rawMetadata.album || embeddedCollection(rawArtist);
  const durationSeconds = Math.round((Number(rawMetadata.durationMs) || 0) / 1000);
  return {
    title,
    catalogTitle,
    artist,
    lookupArtist,
    album,
    durationSeconds,
    searchTerm: `${catalogTitle} ${lookupArtist}`.trim()
  };
}

function stripSearchMarkup(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function sanitizeLyricLines(lines, context) {
  return (Array.isArray(lines) ? lines : []).filter((line, index) => {
    if (!line?.text || CREDIT_LINE.test(line.text)) return false;
    if (index > 4 || line.atMs > 2500) return true;
    const titleScore = similarity(line.text, context.catalogTitle);
    const headingScore = similarity(line.text, `${context.catalogTitle} ${context.artist}`);
    return titleScore < 0.96 && headingScore < 0.88;
  });
}

function evaluateCandidate({
  provider,
  providerLabel,
  trackId,
  title,
  artist,
  album,
  durationSeconds,
  lines
}, context) {
  const normalizedLines = sanitizeLyricLines(lines, context);
  if (normalizedLines.length < 2) return null;

  let identity = scoreTrackCandidate(
    title,
    artist,
    context.catalogTitle,
    context.artist,
    album,
    context.album
  );
  const hasDuration = context.durationSeconds > 0 && Number(durationSeconds) > 0;
  const durationDifference = hasDuration
    ? Math.abs(context.durationSeconds - Number(durationSeconds))
    : 0;

  // Some catalog rows omit the album even though title, artist and duration
  // identify the exact recording. Permit that narrow case without weakening
  // version matching for ordinary candidates.
  if (!identity.valid && context.album && !album && hasDuration && durationDifference <= 2) {
    const withoutAlbum = scoreTrackCandidate(
      title,
      artist,
      context.catalogTitle,
      context.artist
    );
    if (withoutAlbum.titleScore >= 0.88 && withoutAlbum.artistScore >= 0.82) identity = withoutAlbum;
  }

  if (!identity.valid || durationDifference > MAX_DURATION_DIFFERENCE_SECONDS) return null;
  const durationScore = hasDuration ? Math.max(0, 1 - durationDifference / 5) : 0.45;
  const rank = identity.score * 0.82
    + durationScore * 0.18
    + (PROVIDER_PRIORITY[provider] || 0);
  return {
    synced: true,
    lines: normalizedLines,
    source: `${providerLabel} synced lyrics`,
    provider,
    trackId,
    rank,
    identityScore: identity.score,
    durationDifference
  };
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GenrePoliceVisualization/0.1',
      ...headers
    }
  });
  if (!response.ok) throw new Error(`Lyrics HTTP ${response.status}`);
  return response.json();
}

async function fetchLrclibCandidate(context) {
  const url = new URL('https://lrclib.net/api/search');
  url.searchParams.set('track_name', context.catalogTitle);
  url.searchParams.set('artist_name', context.lookupArtist);
  const payload = await fetchJson(url, {
    'Lrclib-Client': 'GenrePoliceVisualization v0.1 (transparent desktop visualizer)'
  });
  const rows = Array.isArray(payload) ? payload : [payload];
  return rows
    .filter((row) => row?.syncedLyrics && !row.instrumental)
    .map((row) => evaluateCandidate({
      provider: 'lrclib',
      providerLabel: 'LRCLIB',
      trackId: row.id || 0,
      title: row.trackName || row.name,
      artist: row.artistName,
      album: row.albumName,
      durationSeconds: Number(row.duration) || 0,
      lines: parseSyncedLyrics(row.syncedLyrics)
    }, context))
    .filter(Boolean);
}

async function fetchNeteaseCandidate(context) {
  const searchUrl = new URL('https://music.163.com/api/cloudsearch/pc');
  searchUrl.searchParams.set('s', context.searchTerm);
  searchUrl.searchParams.set('type', '1');
  searchUrl.searchParams.set('limit', '20');
  searchUrl.searchParams.set('offset', '0');
  const headers = { Referer: 'https://music.163.com/' };
  const payload = await fetchJson(searchUrl, headers);
  const rows = payload?.result?.songs || [];
  const metadataCandidates = rows.map((row) => ({
    row,
    identity: scoreTrackCandidate(
      row.name,
      (row.ar || row.artists || []).map((entry) => entry.name).join(', '),
      context.catalogTitle,
      context.artist,
      row.al?.name || row.album?.name || '',
      context.album
    ),
    durationDifference: context.durationSeconds > 0
      ? Math.abs(context.durationSeconds - Number(row.dt || row.duration || 0) / 1000)
      : 0
  }))
    .filter((candidate) => candidate.identity.valid
      && candidate.durationDifference <= MAX_DURATION_DIFFERENCE_SECONDS)
    .sort((left, right) => right.identity.score - left.identity.score
      || left.durationDifference - right.durationDifference)
    .slice(0, 2);

  const results = [];
  for (const candidate of metadataCandidates) {
    const row = candidate.row;
    const lyricUrl = new URL('https://music.163.com/api/song/lyric');
    lyricUrl.searchParams.set('id', String(row.id));
    lyricUrl.searchParams.set('lv', '-1');
    lyricUrl.searchParams.set('tv', '-1');
    lyricUrl.searchParams.set('rv', '-1');
    lyricUrl.searchParams.set('kv', '-1');
    lyricUrl.searchParams.set('yv', '-1');
    const lyrics = await fetchJson(lyricUrl, headers).catch(() => null);
    if (!lyrics?.lrc?.lyric) continue;
    const originalLines = parseSyncedLyrics(lyrics.lrc.lyric);
    const translationLines = parseSyncedLyrics(lyrics.tlyric?.lyric);
    results.push(evaluateCandidate({
      provider: 'netease',
      providerLabel: 'NETEASE',
      trackId: row.id,
      title: row.name,
      artist: (row.ar || row.artists || []).map((entry) => entry.name).join(', '),
      album: row.al?.name || row.album?.name || '',
      durationSeconds: Number(row.dt || row.duration || 0) / 1000,
      lines: mergeLyricTranslations(originalLines, translationLines)
    }, context));
  }
  return results.filter(Boolean);
}

function decodeTencentLyric(value) {
  if (!value) return '';
  try {
    return Buffer.from(decodeURIComponent(String(value)), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

async function fetchTencentCandidate(context) {
  const searchUrl = new URL('https://shc6.y.qq.com/soso/fcgi-bin/search_for_qq_cp');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('n', '20');
  searchUrl.searchParams.set('p', '1');
  searchUrl.searchParams.set('w', context.searchTerm);
  searchUrl.searchParams.set('cr', '1');
  searchUrl.searchParams.set('g_tk', '5381');
  searchUrl.searchParams.set('t', '0');
  const headers = { Referer: 'https://y.qq.com/' };
  const payload = await fetchJson(searchUrl, headers);
  const rows = payload?.data?.song?.list || [];
  const metadataCandidates = rows.map((row) => {
    const artist = (row.singer || []).map((entry) => entry.name).join(', ');
    const title = stripSearchMarkup(row.songname || row.songorig);
    const album = stripSearchMarkup(row.albumname);
    return {
      row,
      title,
      artist,
      album,
      identity: scoreTrackCandidate(
        title,
        artist,
        context.catalogTitle,
        context.artist,
        album,
        context.album
      ),
      durationDifference: context.durationSeconds > 0
        ? Math.abs(context.durationSeconds - Number(row.interval || 0))
        : 0
    };
  })
    .filter((candidate) => candidate.identity.valid
      && candidate.durationDifference <= MAX_DURATION_DIFFERENCE_SECONDS)
    .sort((left, right) => right.identity.score - left.identity.score
      || left.durationDifference - right.durationDifference)
    .slice(0, 2);

  const results = [];
  for (const candidate of metadataCandidates) {
    const row = candidate.row;
    const lyricUrl = new URL('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg');
    lyricUrl.searchParams.set('songmid', row.songmid);
    lyricUrl.searchParams.set('g_tk', '5381');
    lyricUrl.searchParams.set('loginUin', '0');
    lyricUrl.searchParams.set('hostUin', '0');
    lyricUrl.searchParams.set('inCharset', 'utf8');
    lyricUrl.searchParams.set('outCharset', 'utf-8');
    lyricUrl.searchParams.set('notice', '0');
    lyricUrl.searchParams.set('platform', 'yqq');
    lyricUrl.searchParams.set('needNewCode', '0');
    lyricUrl.searchParams.set('format', 'json');
    const lyrics = await fetchJson(lyricUrl, headers).catch(() => null);
    const decoded = decodeTencentLyric(lyrics?.lyric);
    if (!decoded) continue;
    const originalLines = parseSyncedLyrics(decoded);
    const translated = decodeTencentLyric(lyrics?.trans);
    const translationLines = parseSyncedLyrics(translated);
    results.push(evaluateCandidate({
      provider: 'tencent',
      providerLabel: 'QQ MUSIC',
      trackId: row.songmid,
      title: candidate.title,
      artist: candidate.artist,
      album: candidate.album,
      durationSeconds: Number(row.interval || 0),
      lines: mergeLyricTranslations(originalLines, translationLines)
    }, context));
  }
  return results.filter(Boolean);
}

function collectProviderResults(tasks, timeoutMs = AGGREGATION_WINDOW_MS) {
  return new Promise((resolve) => {
    const results = [];
    let remaining = tasks.length;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(results);
    };
    const timer = setTimeout(finish, timeoutMs);
    timer.unref?.();
    tasks.forEach((task) => {
      Promise.resolve(task).then((result) => {
        if (!finished) results.push(Array.isArray(result) ? result : []);
      }, () => {
        // A provider failure is an ordinary empty result. Other providers and
        // the visualization must keep running.
      }).finally(() => {
        remaining -= 1;
        if (remaining === 0) finish();
      });
    });
  });
}

async function fetchLyrics(rawMetadata) {
  const context = lyricLookupContext(rawMetadata);
  if (!context.title || !context.artist) return null;

  // Aggregators work best when providers are queried together and candidates
  // are ranked as recordings, rather than blindly accepting the first lyric
  // response. Provider timeouts bound the whole lookup to a single short wait.
  const providerResults = await collectProviderResults([
    fetchLrclibCandidate(context),
    fetchNeteaseCandidate(context),
    fetchTencentCandidate(context)
  ]);
  const candidates = providerResults
    .flat()
    .filter(Boolean)
    .sort((left, right) => right.rank - left.rank
      || left.durationDifference - right.durationDifference
      || (PROVIDER_PRIORITY[right.provider] || 0) - (PROVIDER_PRIORITY[left.provider] || 0));
  const best = candidates[0];
  if (!best) return null;
  const { rank, identityScore, durationDifference, ...lyrics } = best;
  return lyrics;
}

class LyricsResolver {
  constructor() {
    this.cache = new Map();
  }

  async resolve(rawMetadata = {}) {
    const rawArtist = rawMetadata.artist || rawMetadata.albumArtist;
    const key = [
      normalize(cleanArtist(rawArtist, rawMetadata.title)),
      normalize(cleanTitle(rawMetadata.title)),
      Math.round((Number(rawMetadata.durationMs) || 0) / 2000)
    ].join('::');
    if (!key.replace(/:/g, '')) return null;
    if (this.cache.has(key)) return this.cache.get(key);
    const result = await fetchLyrics(rawMetadata).catch(() => null);
    this.cache.set(key, result);
    return result;
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = {
  LyricsResolver,
  parseSyncedLyrics,
  mergeLyricTranslations,
  fetchLyrics,
  fetchLrclibCandidate,
  fetchNeteaseCandidate,
  fetchTencentCandidate,
  decodeTencentLyric
};
