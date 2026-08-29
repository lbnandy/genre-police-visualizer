'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSyncedLyrics, mergeLyricTranslations, fetchLyrics } = require('../src/lyrics-resolver');

test('parses timestamped LRC and ignores metadata or untimed text', () => {
  const lines = parseSyncedLyrics([
    '[ar:Artist]',
    '[offset:100]',
    '[00:00.10]词：Someone',
    '[00:00.20]Lyrics by: Someone',
    '[00:01.20]First line',
    '[00:03.500]Second <00:03.50>line',
    'untimed text'
  ].join('\n'));
  assert.deepEqual(lines, [
    { atMs: 1300, text: 'First line' },
    { atMs: 3600, text: 'Second line' }
  ]);
});

test('expands repeated timestamps and merges translations at the same time', () => {
  const lines = parseSyncedLyrics('[00:01.00][00:05.00]Hello\n[00:01.00]你好');
  assert.deepEqual(lines, [
    { atMs: 1000, text: 'Hello', translation: '你好' },
    { atMs: 5000, text: 'Hello' }
  ]);
});

test('aligns a provider Chinese translation track without replacing the original lyric', () => {
  const original = parseSyncedLyrics('[00:01.00]Hello again\n[00:04.00]夜を越えて');
  const translated = parseSyncedLyrics('[00:01.08]再次相见\n[00:04.12]越过黑夜');
  assert.deepEqual(mergeLyricTranslations(original, translated), [
    { atMs: 1000, text: 'Hello again', translation: '再次相见' },
    { atMs: 4000, text: '夜を越えて', translation: '越过黑夜' }
  ]);
});

test('does not add a redundant Chinese translation below a Chinese original', () => {
  const original = parseSyncedLyrics('[00:01.00]穿过黑夜');
  const translated = parseSyncedLyrics('[00:01.00]越过黑夜');
  assert.deepEqual(mergeLyricTranslations(original, translated), [
    { atMs: 1000, text: '穿过黑夜' }
  ]);
});

test('builds word and CJK-character lyric motion timelines', async () => {
  const { buildLyricUnitTimeline } = await import('../renderer/lyric-motion.mjs');
  const english = buildLyricUnitTimeline('We feel alive');
  assert.deepEqual(english.filter((unit) => !unit.space).map((unit) => unit.text), ['We', 'feel', 'alive']);
  assert.equal(english[0].start, 0);
  assert.equal(english.at(-1).end, 1);

  const japanese = buildLyricUnitTimeline('音楽だ');
  assert.deepEqual(japanese.map((unit) => unit.text), ['音', '楽', 'だ']);
  assert.equal(japanese.at(-1).end, 1);
});

test('lyric sweep measures the rendered ink instead of the full text column', async () => {
  const { lyricLineInkWidth } = await import('../renderer/lyric-motion.mjs');
  assert.equal(lyricLineInkWidth({ lastLeft: 106, lastWidth: 18, containerWidth: 448 }), 124);
  assert.equal(lyricLineInkWidth({ firstLeft: 72, lastLeft: 178, lastWidth: 18, containerWidth: 448 }), 124);
  assert.equal(lyricLineInkWidth({ lastLeft: 520, lastWidth: 22, containerWidth: 448 }), 448);
  assert.equal(lyricLineInkWidth({ lastLeft: 106, lastWidth: 18, containerWidth: 448, multiline: true }), 448);
});

test('lyric unit motion rises only while the sweep crosses that unit', async () => {
  const { lyricUnitMotion } = await import('../renderer/lyric-motion.mjs');
  const unit = { start: 0.25, end: 0.5 };
  assert.equal(lyricUnitMotion(0.1, unit, 'future-bass').y, 0);
  assert.ok(lyricUnitMotion(0.375, unit, 'future-bass').y < -3);
  assert.equal(lyricUnitMotion(0.7, unit, 'future-bass').y, 0);
});

test('lyric sweep finishes before an instrumental gap without advancing the next line', async () => {
  const { buildLyricSweepTimeline } = await import('../renderer/lyric-motion.mjs');
  const timeline = buildLyricSweepTimeline([
    { atMs: 1000, text: 'We are running through the night' },
    { atMs: 4000, text: 'Hold on to the final light' },
    { atMs: 16000, text: 'Here we go again' },
    { atMs: 20000, text: 'Back into the sound' }
  ], 24000);
  assert.equal(timeline[0].sweepDurationMs, 3000);
  assert.equal(timeline[1].interludeAfterLine, true);
  assert.ok(timeline[1].sweepDurationMs < 6500);
  assert.equal(timeline[2].sweepDurationMs, 4000);
});

test('lyric sweep keeps genuinely long lyric lines instead of treating them as breaks', async () => {
  const { buildLyricSweepTimeline } = await import('../renderer/lyric-motion.mjs');
  const longText = 'Every single word keeps moving with the melody across the whole horizon';
  const timeline = buildLyricSweepTimeline([
    { atMs: 1000, text: longText },
    { atMs: 9000, text: 'Next line' },
    { atMs: 12500, text: 'Last line' }
  ], 15000);
  assert.equal(timeline[0].interludeAfterLine, false);
  assert.equal(timeline[0].sweepDurationMs, 8000);
});

test('lyric sweep does not mistake a sustained short rock line for an interlude', async () => {
  const { buildLyricSweepTimeline } = await import('../renderer/lyric-motion.mjs');
  const timeline = buildLyricSweepTimeline([
    { atMs: 1000, text: 'God is dead' },
    { atMs: 9250, text: 'And no one cares' },
    { atMs: 13200, text: 'If there is a hell' }
  ], 17000);
  assert.equal(timeline[0].interludeAfterLine, false);
  assert.equal(timeline[0].sweepDurationMs, 8250);
  assert.ok(timeline[0].visualLeadMs <= 220);
  assert.equal(timeline[1].visualLeadMs, 360);
});

test('lyric visual lead is calibrated without restoring the old 600 ms clock workaround', async () => {
  const { lyricVisualLeadMs } = await import('../renderer/lyric-motion.mjs');
  assert.equal(lyricVisualLeadMs(3200, false), 360);
  assert.equal(lyricVisualLeadMs(12000, true), 220);
});

test('lyrics lookup ranks LRCLIB search candidates instead of trusting a wrong first result', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /\/api\/search\?/);
    return {
      ok: true,
      status: 200,
      async json() {
        return [
          {
            id: 1,
            trackName: 'Signal',
            artistName: 'Artist',
            albumName: 'Unrelated Collection',
            duration: 201,
            syncedLyrics: '[00:01.00]Wrong version\n[00:04.00]Wrong again'
          },
          {
            id: 2,
            trackName: 'Signal',
            artistName: 'Artist',
            albumName: 'Target Album',
            duration: 200,
            syncedLyrics: '[00:01.00]Correct version\n[00:04.00]Correct again'
          }
        ];
      }
    };
  };
  try {
    const lyrics = await fetchLyrics({
      title: 'Signal',
      artist: 'Artist',
      album: 'Target Album',
      durationMs: 200000
    });
    assert.equal(lyrics.trackId, 2);
    assert.equal(lyrics.lines[0].text, 'Correct version');
  } finally {
    global.fetch = previousFetch;
  }
});

test('aggregated lyrics use a strictly matched QQ Music fallback without player cookies', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    const address = String(url);
    assert.equal(options.headers?.Cookie, undefined);
    if (address.includes('lrclib.net')) return jsonResponse([]);
    if (address.includes('music.163.com/api/cloudsearch')) {
      return jsonResponse({ result: { songs: [] } });
    }
    if (address.includes('search_for_qq_cp')) {
      return jsonResponse({
        data: {
          song: {
            list: [{
              songmid: 'qq-exact',
              songname: 'Signal',
              singer: [{ name: 'Artist' }],
              albumname: 'Target Album',
              interval: 200
            }]
          }
        }
      });
    }
    if (address.includes('fcg_query_lyric_new')) {
      const lyric = [
        '[00:00.10]Lyrics by: Someone',
        '[00:01.00]Fallback line one',
        '[00:04.00]Fallback line two'
      ].join('\n');
      const translation = '[00:01.08]后备歌词第一行\n[00:04.04]后备歌词第二行';
      return jsonResponse({
        lyric: Buffer.from(lyric).toString('base64'),
        trans: Buffer.from(translation).toString('base64')
      });
    }
    throw new Error(`Unexpected URL: ${address}`);
  };
  try {
    const lyrics = await fetchLyrics({
      title: 'Signal',
      artist: 'Artist',
      album: 'Target Album',
      durationMs: 200000
    });
    assert.equal(lyrics.provider, 'tencent');
    assert.equal(lyrics.trackId, 'qq-exact');
    assert.equal(lyrics.lines[0].text, 'Fallback line one');
    assert.equal(lyrics.lines[0].translation, '后备歌词第一行');
  } finally {
    global.fetch = previousFetch;
  }
});

test('aggregated lyrics reject a wrong-duration NetEase recording', async () => {
  const previousFetch = global.fetch;
  let lyricRequested = false;
  global.fetch = async (url) => {
    const address = String(url);
    if (address.includes('lrclib.net')) return jsonResponse([]);
    if (address.includes('music.163.com/api/cloudsearch')) {
      return jsonResponse({
        result: {
          songs: [{
            id: 99,
            name: 'Signal',
            ar: [{ name: 'Artist' }],
            al: { name: 'Target Album' },
            dt: 225000
          }]
        }
      });
    }
    if (address.includes('music.163.com/api/song/lyric')) {
      lyricRequested = true;
      return jsonResponse({ lrc: { lyric: '[00:01.00]Wrong\n[00:04.00]Version' } });
    }
    if (address.includes('search_for_qq_cp')) {
      return jsonResponse({ data: { song: { list: [] } } });
    }
    throw new Error(`Unexpected URL: ${address}`);
  };
  try {
    const lyrics = await fetchLyrics({
      title: 'Signal',
      artist: 'Artist',
      album: 'Target Album',
      durationMs: 200000
    });
    assert.equal(lyrics, null);
    assert.equal(lyricRequested, false);
  } finally {
    global.fetch = previousFetch;
  }
});

test('aggregated lyrics accept a matched NetEase recording and strip credits', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url) => {
    const address = String(url);
    if (address.includes('lrclib.net')) return jsonResponse([]);
    if (address.includes('music.163.com/api/cloudsearch')) {
      return jsonResponse({
        result: {
          songs: [{
            id: 101,
            name: '晴天',
            ar: [{ name: '周杰伦' }],
            al: { name: '叶惠美' },
            dt: 269000
          }]
        }
      });
    }
    if (address.includes('music.163.com/api/song/lyric')) {
      return jsonResponse({
        lrc: {
          lyric: '[00:01.00]合声：Someone\n[00:03.00]故事的小黄花\n[00:07.00]从出生那年就飘着'
        }
      });
    }
    if (address.includes('search_for_qq_cp')) {
      return jsonResponse({ data: { song: { list: [] } } });
    }
    throw new Error(`Unexpected URL: ${address}`);
  };
  try {
    const lyrics = await fetchLyrics({
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      durationMs: 269000
    });
    assert.equal(lyrics.provider, 'netease');
    assert.equal(lyrics.trackId, 101);
    assert.equal(lyrics.lines[0].text, '故事的小黄花');
  } finally {
    global.fetch = previousFetch;
  }
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
