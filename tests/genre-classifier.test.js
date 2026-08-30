'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyGenre, canonicalArtist, displayArtistName, ARTIST_HINTS, RULES } = require('../src/genre-classifier');
const { themeFor } = require('../src/themes');
const { GROUPS, hasJapaneseScript } = require('../src/genre-localization');
const {
  GenreResolver,
  cleanArtist,
  embeddedCollection,
  genreFromUserCorrection,
  similarity,
  scoreDiscogsRelease,
  scoreMusicBrainzRecording,
  scoreTrackCandidate,
  titleVersionCompatible,
  shouldAcceptAlbumGenre,
  rankedLastFmTags,
  rankedMusicBrainzTags,
  rawGenreLabel,
  rawGenreTheme
} = require('../src/genre-resolver');

test('classifies target EDM subgenres before their broad parents', () => {
  assert.equal(classifyGenre({ tags: ['Electronic', 'Happy Hardcore'] }).id, 'happy-hardcore');
  assert.equal(classifyGenre({ tags: ['Electronic', 'Puzzycore'] }).id, 'puzzycore');
  assert.equal(classifyGenre({ tags: ['Electronic', 'UK Hardcore'] }).id, 'uk-hardcore');
  assert.equal(classifyGenre({ tags: ['House', 'Tech House'] }).id, 'tech-house');
  assert.equal(classifyGenre({ tags: ['Dubstep', 'Melodic Dubstep'] }).id, 'melodic-dubstep');
  assert.equal(classifyGenre({ tags: ['Hardstyle', 'Rawstyle'] }).id, 'rawstyle');
  assert.equal(classifyGenre({ tags: ['Metal', 'Deathcore'] }).id, 'deathcore');
  assert.equal(classifyGenre({ tags: ['Moombahcore'] }).id, 'moombahcore');
});

test('marks Skrillex Bangarang as the track-specific Moombahcore case', () => {
  const bangarang = classifyGenre({
    artist: 'Skrillex',
    title: 'Bangarang (feat. Sirah)',
    tags: ['Dubstep']
  });
  assert.equal(bangarang.id, 'moombahcore');
  assert.equal(bangarang.mode, 'dubstep');
  assert.equal(bangarang.note, '(NOT DUBSTEP)');
  assert.equal(bangarang.matched, 'track:skrillex/bangarang');
  assert.equal(classifyGenre({ artist: 'スクリレックス', title: 'Bangarang', tags: ['Dance'] }).id, 'moombahcore');
  assert.notEqual(classifyGenre({ artist: 'Tribute Unit', title: 'Bangarang', tags: ['Dubstep'] }).id, 'moombahcore');
});

test('ASMR metadata overrides catalog music genres', () => {
  assert.equal(classifyGenre({ artist: 'Moonlit ASMR', title: 'Rain', tags: ['Electronic'] }).id, 'asmr');
  assert.equal(classifyGenre({ artist: '白噪音频道', title: '深夜助眠与采耳', tags: ['Spoken Word'] }).id, 'asmr');
  assert.equal(classifyGenre({ artist: '睡眠導入ASMR', title: '耳かき', tags: ['J-Pop'] }).id, 'asmr');
  assert.equal(classifyGenre({ artist: 'Ambient Artist', title: 'Binaural Sleep', tags: ['Ambient'] }).id, 'asmr');
});

test('preserves provider tag relevance while allowing same-branch refinement', () => {
  assert.equal(classifyGenre({ tags: ['industrial rock', 'industrial metal', 'drum and bass'] }).id, 'rock');
  assert.equal(classifyGenre({ tags: ['Electronic', 'Hard Dance', 'Hardstyle', 'Rawstyle'] }).id, 'rawstyle');
  assert.equal(classifyGenre({ tags: ['Bass Music', 'Dubstep', 'Melodic Dubstep'] }).id, 'melodic-dubstep');
});

test('rejects unrelated Deezer album genres when a curated artist family is known', () => {
  const manson = classifyGenre({ artist: 'Marilyn Manson', tags: [] });
  const nin = classifyGenre({ artist: 'Nine Inch Nails', tags: [] });
  const hyperPotions = classifyGenre({ artist: 'Hyper Potions', tags: [] });
  assert.equal(shouldAcceptAlbumGenre(manson, classifyGenre({ tags: ['Drum & Bass'] })), false);
  assert.equal(shouldAcceptAlbumGenre(nin, classifyGenre({ tags: ['Techno'] })), false);
  assert.equal(shouldAcceptAlbumGenre(hyperPotions, classifyGenre({ tags: ['Dubstep'] })), false);
  assert.equal(shouldAcceptAlbumGenre(hyperPotions, classifyGenre({ tags: ['Future Bass'] })), true);
});

test('drops zero-vote and weak-tail MusicBrainz artist tags', () => {
  assert.deepEqual(rankedMusicBrainzTags({ tags: [
    { name: 'industrial rock', count: 10 },
    { name: 'industrial metal', count: 9 },
    { name: 'alternative rock', count: 4 },
    { name: 'rock', count: 1 },
    { name: 'drum and bass', count: 0 },
    { name: 'american', count: -1 }
  ] }), ['industrial rock', 'industrial metal', 'alternative rock']);
});

test('drops weak-tail Last.fm tags before they can override a strong track genre', () => {
  assert.deepEqual(rankedLastFmTags([
    { name: 'drum and bass', count: 100 },
    { name: 'neurofunk', count: 58 },
    { name: 'electronic', count: 18 },
    { name: 'dubstep', count: 7 },
    { name: 'favorites', count: 0 }
  ]), ['drum and bass', 'neurofunk', 'electronic']);
});

test('every classification rule and artist hint has a concrete visual theme', () => {
  for (const [id] of RULES) assert.notEqual(themeFor(id).label, 'UNKNOWN', `missing rule theme: ${id}`);
  for (const id of new Set(ARTIST_HINTS.values())) {
    assert.notEqual(themeFor(id).label, 'UNKNOWN', `missing artist theme: ${id}`);
  }
});

test('shows a useful fetched genre label when the local taxonomy has no rule', () => {
  assert.equal(rawGenreLabel(['seen live', 'favorites', 'Hyperpop']), 'Hyperpop');
  assert.equal(rawGenreLabel(['Music', 'female vocalists', 'Unknown']), '');
  const hyperpop = rawGenreTheme('Hyperpop');
  assert.equal(hyperpop.label, 'HYPERPOP');
  assert.equal(hyperpop.mode, 'pop');
  assert.equal(hyperpop.inferredVisualBase, 'pop');
  const visualKei = rawGenreTheme('Visual Kei');
  assert.equal(visualKei.label, 'VISUAL KEI');
  assert.equal(visualKei.mode, 'rock');
});

test('broad rock text keeps a restrained non-white highlight', () => {
  const rock = themeFor('rock');
  assert.notEqual(rock.hot.toLowerCase(), '#ffffff');
  assert.ok(rock.textFx < 0.55);
  assert.ok(rock.textBaseGlow <= 9);
});

test('uses curated artist hints when Apple only returns generic Dance', () => {
  const result = classifyGenre({ artist: 'S3RL', title: 'Genre Police', tags: ['Dance'] });
  assert.equal(result.id, 'happy-hardcore');
  assert.equal(result.label, 'HAPPY HC');
});

test('prefers concrete queried genres and only falls back to artist mappings for generic buckets', () => {
  assert.equal(classifyGenre({ artist: 'Angerfist', tags: ['Electronic'] }).id, 'hardcore');
  assert.equal(classifyGenre({ artist: 'DJ Myosuke', tags: ['Electronic'] }).id, 'hardcore');
  assert.equal(classifyGenre({ artist: 'DJ Myosuke', tags: ['Frenchcore'] }).id, 'frenchcore');
  assert.equal(classifyGenre({ artist: 'Wolfgang Gartner', tags: ['Electro House'] }).id, 'electro-house');
  assert.equal(classifyGenre({ artist: 'Wolfgang Gartner', tags: ['Complextro'] }).id, 'complextro');
  assert.equal(classifyGenre({ artist: 'Linkin Park', tags: ['Metal'] }).id, 'metal');
});

test('covers additional common artists across major genre branches', () => {
  assert.equal(classifyGenre({ artist: 'Coone', tags: ['Electronic'] }).id, 'hardstyle');
  assert.equal(classifyGenre({ artist: 'Zedd', tags: ['Electronic'] }).id, 'house');
  assert.equal(classifyGenre({ artist: 'BTS', tags: ['Pop'] }).id, 'k-pop');
  assert.equal(classifyGenre({ artist: '르세라핌', tags: ['팝'] }).id, 'k-pop');
  assert.equal(classifyGenre({ artist: 'Black Sabbath', tags: ['Rock'] }).id, 'metal');
  assert.equal(classifyGenre({ artist: 'Hans Zimmer', tags: [] }).id, 'soundtrack');
});

test('covers representative artists for the reviewed visual families', () => {
  const cases = [
    ['YumemiChannel', 'asmr'],
    ['Oliver Heldens', 'future-house'],
    ['Sasha', 'progressive-house'],
    ['Cloonee', 'tech-house'],
    ['Pegboard Nerds', 'bass-music'],
    ['Droptek', 'drum-bass'],
    ['Zardonic', 'drumstep'],
    ['Tiësto', 'trance'],
    ['Gabriel & Dresden', 'progressive-trance'],
    ['Jeff Mills', 'techno'],
    ['Red Hot Chili Peppers', 'rock'],
    ['Dream Theater', 'progressive-metal'],
    ['Michael Jackson', 'pop'],
    ['supercell', 'j-pop']
  ];
  for (const [artist, id] of cases) {
    assert.equal(classifyGenre({ artist, tags: ['Electronic'] }).id, id, artist);
  }
  assert.equal(classifyGenre({ artist: 'ティエスト', tags: ['Electronic'] }).id, 'trance');
  assert.equal(classifyGenre({ artist: 'サシャ', tags: ['Electronic'] }).id, 'progressive-house');
  assert.equal(classifyGenre({ artist: 'ボットネック', tags: ['Electronic'] }).id, 'electro-house');
});

test('recognizes hard-dance artists when storefront metadata is generic', () => {
  assert.equal(classifyGenre({ artist: 'Massive New Krew', title: 'Adrenaline', tags: ['Dance'] }).id, 'hard-dance');
  assert.equal(classifyGenre({ artist: 'Kobaryo', title: 'Galaxy Friends', tags: ['Electronic'] }).id, 'hardcore');
  assert.equal(classifyGenre({ artist: 'Kobaryo', title: 'Tool-Assisted Speedcore', tags: ['Electronic'] }).id, 'uptempo-hardcore');
  assert.equal(classifyGenre({ artist: 'Dimitri K', title: 'Fresh New Kicks', tags: ['Dance'] }).id, 'uptempo-hardcore');
  assert.equal(classifyGenre({ artist: 'GPF', title: 'Piep Caroline', tags: ['Hardcore'] }).id, 'puzzycore');
  assert.equal(classifyGenre({ artist: 'USAO', title: 'Big Daddy', tags: ['Dance'] }).id, 'frenchcore');
  assert.equal(classifyGenre({ artist: 'Gammer', title: 'The Drop', tags: ['Dance'] }).id, 'uk-hardcore');
  assert.equal(classifyGenre({ artist: 'Darren Styles', title: 'Us Against the World', tags: ['Dance'] }).id, 'uk-hardcore');
});

test('exposes an immediate-parent hard-dance hierarchy', () => {
  assert.equal(classifyGenre({ tags: ['Hardstyle'] }).parent, 'HARD DANCE');
  assert.equal(classifyGenre({ tags: ['Rawstyle'] }).parent, 'HARDSTYLE');
  assert.equal(classifyGenre({ tags: ['Hardcore Techno'] }).parent, 'HARD DANCE');
  assert.equal(classifyGenre({ tags: ['Frenchcore'] }).parent, 'HARDCORE');
  assert.equal(classifyGenre({ tags: ['Puzzycore'] }).parent, 'UPTEMPO');
  assert.notEqual(classifyGenre({ tags: ['J-Core'] }).id, 'happy-hardcore');
});

test('keeps broad electronic and rock branches hierarchical', () => {
  assert.equal(classifyGenre({ tags: ['House'] }).parent, 'ELECTRONIC DANCE');
  assert.equal(classifyGenre({ tags: ['Dubstep'] }).parent, 'BASS MUSIC');
  assert.equal(classifyGenre({ tags: ['Brostep'] }).parent, 'DUBSTEP');
  assert.equal(classifyGenre({ tags: ['Riddim'] }).parent, 'DUBSTEP');
  assert.equal(classifyGenre({ tags: ['Future Riddim'] }).parent, 'RIDDIM');
  assert.equal(classifyGenre({ tags: ['Drum & Bass'] }).parent, 'BASS MUSIC');
  assert.equal(classifyGenre({ tags: ['Punk'] }).parent, 'ROCK');
  assert.equal(classifyGenre({ tags: ['J-Pop'] }).parent, 'POP');
  assert.equal(classifyGenre({ tags: ['Pop', 'J-Pop'] }).id, 'j-pop');
});

test('models the electro house branch through its immediate parents', () => {
  assert.equal(classifyGenre({ tags: ['Electro House'] }).parent, 'HOUSE');
  assert.equal(classifyGenre({ tags: ['Complextro'] }).parent, 'ELECTRO HOUSE');
  assert.equal(classifyGenre({ tags: ['Big Room House'] }).parent, 'HOUSE');
  assert.equal(classifyGenre({ artist: 'Wolfgang Gartner', tags: ['Electronic'] }).id, 'complextro');
  assert.equal(classifyGenre({ artist: 'Hardwell', tags: ['Dance'] }).id, 'big-room-house');
  assert.equal(classifyGenre({ artist: 'Afrojack', tags: ['Electronic'] }).id, 'house');
});

test('separates EDM trap from hip-hop trap', () => {
  assert.equal(classifyGenre({ tags: ['EDM Trap'] }).id, 'trap-edm');
  assert.equal(classifyGenre({ tags: ['EDM Trap'] }).parent, 'BASS MUSIC');
  assert.equal(classifyGenre({ tags: ['Hybrid Trap'] }).parent, 'EDM TRAP');
  assert.equal(classifyGenre({ tags: ['Festival Trap'] }).parent, 'EDM TRAP');
  assert.equal(classifyGenre({ tags: ['Trap'] }).id, 'hip-hop');
  assert.equal(classifyGenre({ artist: 'Travis Scott', tags: ['Trap'] }).id, 'hip-hop');
  assert.equal(classifyGenre({ artist: 'RL Grime', tags: ['Electronic'] }).id, 'trap-edm');
  assert.equal(classifyGenre({ artist: 'NGHTMRE', tags: ['Dance'] }).id, 'bass-music');
});

test('keeps Phonk under Hip-Hop while separating its drift branch', () => {
  assert.equal(classifyGenre({ tags: ['Phonk'] }).id, 'phonk');
  assert.equal(classifyGenre({ tags: ['Phonk'] }).parent, 'HIP-HOP');
  assert.equal(classifyGenre({ tags: ['Drift Phonk'] }).id, 'drift-phonk');
  assert.equal(classifyGenre({ tags: ['Drift Phonk'] }).parent, 'PHONK');
  assert.equal(classifyGenre({ artist: 'DJ Smokey', tags: ['Hip-Hop'] }).id, 'phonk');
  assert.equal(classifyGenre({ artist: 'Kordhell', tags: ['Electronic'] }).id, 'drift-phonk');
});

test('models Experimental Hip-Hop under Hip-Hop and lets its artist mapping refine broad tags', () => {
  assert.equal(classifyGenre({ tags: ['Experimental Hip-Hop'] }).id, 'experimental-hip-hop');
  assert.equal(classifyGenre({ tags: ['实验说唱'] }).parent, 'HIP-HOP');
  assert.equal(classifyGenre({ tags: ['Abstract Hip-Hop'] }).id, 'experimental-hip-hop');
  assert.equal(classifyGenre({ artist: 'MC赵小六', tags: ['Hip-Hop/Rap'] }).id, 'experimental-hip-hop');
  assert.equal(classifyGenre({ artist: 'MC 赵小六', tags: ['Electronic'] }).id, 'experimental-hip-hop');
});

test('covers the common bass, garage, breaks, trance and techno branches', () => {
  assert.equal(classifyGenre({ tags: ['Colour Bass'] }).parent, 'DUBSTEP');
  assert.equal(classifyGenre({ tags: ['Jump Up DnB'] }).parent, 'DRUM & BASS');
  assert.equal(classifyGenre({ tags: ['Jungle'] }).parent, 'DRUM & BASS');
  assert.equal(classifyGenre({ tags: ['UK Garage'] }).parent, 'ELECTRONIC DANCE');
  assert.equal(classifyGenre({ tags: ['Future Garage'] }).parent, 'UK GARAGE');
  assert.equal(classifyGenre({ tags: ['2-Step Garage'] }).parent, 'UK GARAGE');
  assert.equal(classifyGenre({ tags: ['Big Beat'] }).parent, 'BREAKBEAT');
  assert.equal(classifyGenre({ tags: ['Breakcore'] }).parent, 'BREAKBEAT');
  assert.equal(classifyGenre({ tags: ['Psytrance'] }).parent, 'TRANCE');
  assert.equal(classifyGenre({ tags: ['Melodic Techno'] }).parent, 'TECHNO');
  assert.equal(classifyGenre({ artist: 'Burial', tags: ['Electronic'] }).id, 'future-garage');
  assert.equal(classifyGenre({ artist: 'Double 99', tags: ['Electronic'] }).id, 'speed-garage');
  assert.equal(classifyGenre({ artist: 'Dem 2', tags: ['Electronic'] }).id, 'two-step-garage');
  assert.equal(classifyGenre({ artist: 'Zed Bias', tags: ['Electronic'] }).id, 'uk-garage');
  assert.equal(classifyGenre({ artist: 'TS7', tags: ['Electronic'] }).id, 'bassline');
  assert.equal(classifyGenre({ artist: 'The Chemical Brothers', tags: ['Electronic'] }).id, 'big-beat');
});

test('uses pop artist hints when catalog tags are too broad', () => {
  assert.equal(classifyGenre({ artist: 'Lady Gaga', title: 'Bad Romance', tags: ['Pop'] }).id, 'dance-pop');
  assert.equal(classifyGenre({ artist: 'AJR', title: 'Bang!', tags: ['Alternative'] }).id, 'pop');
  assert.equal(classifyGenre({ artist: 'Billie Eilish', title: 'bad guy', tags: ['Pop'] }).id, 'indie-pop');
});

test('keeps representative artist styles when Electronic would be too broad', () => {
  assert.equal(classifyGenre({ artist: 'Gryffin', title: 'Feel Good', tags: ['Electronic'] }).id, 'future-bass');
  assert.equal(classifyGenre({ artist: "Snail's House", title: 'Pixel Galaxy', tags: ['Dance'] }).id, 'kawaii-bass');
  assert.equal(classifyGenre({ artist: 'PSYQUI', title: 'Hype', tags: ['Electronic'] }).id, 'future-bass');
});

test('artist fallbacks use the nearest honest parent for multi-style catalogs', () => {
  const expected = new Map([
    ['t+pazolite', 'hardcore'],
    ['Kobaryo', 'hardcore'],
    ['Stonebank', 'uk-hardcore'],
    ['Showtek', 'hardstyle'],
    ['Hardwell', 'big-room-house'],
    ['W&W', 'big-room-house'],
    ['DVBBS', 'big-room-house'],
    ['VINAI', 'big-room-house'],
    ['R3HAB', 'big-room-house'],
    ['KSHMR', 'big-room-house'],
    ['Martin Garrix', 'house'],
    ['Savant', 'complextro'],
    ['Lazy Rich', 'complextro'],
    ['Far Too Loud', 'complextro'],
    ['Tut Tut Child', 'complextro'],
    ['Dyro', 'electro-house'],
    ['Bingo Players', 'electro-house'],
    ['Habstrakt', 'bass-house'],
    ['AC Slater', 'bass-house'],
    ['Wax Motif', 'bass-house'],
    ['Knock2', 'bass-house'],
    ['C-Show', 'bass-music'],
    ['Seven Lions', 'bass-music'],
    ['Skrillex', 'dubstep'],
    ['Doctor P', 'dubstep'],
    ['FuntCase', 'dubstep'],
    ['12th Planet', 'dubstep'],
    ['G Jones', 'bass-music'],
    ['EPROM', 'bass-music'],
    ['CloZee', 'bass-music'],
    ['Of The Trees', 'bass-music'],
    ['PinkPantheress', 'pop'],
    ['Bring Me The Horizon', 'metal'],
    ['Nine Inch Nails', 'industrial-metal']
  ]);
  for (const [artist, id] of expected) {
    assert.equal(classifyGenre({ artist, tags: ['Electronic'] }).id, id, artist);
  }
  assert.equal([...ARTIST_HINTS.values()].includes('electronic'), false);
  assert.equal(classifyGenre({ artist: 'S3RL', tags: ['Electronic'] }).id, 'happy-hardcore');
  assert.equal(classifyGenre({ artist: 'USAO', tags: ['Electronic'] }).id, 'frenchcore');
  assert.equal(classifyGenre({ artist: "Snail's House", tags: ['Electronic'] }).id, 'kawaii-bass');
  assert.equal(classifyGenre({ artist: 'Yunomi', tags: ['Electronic'] }).id, 'kawaii-bass');
  assert.equal(classifyGenre({ artist: 'Moe Shop', tags: ['Dance'] }).id, 'kawaii-bass');
});

test('covers prominent artists in the curated fallback map', () => {
  const expected = new Map([
    ['Audiofreq', 'hard-dance'],
    ['3R2', 'hard-dance'],
    ['Tatsunoshin', 'happy-hardcore'],
    ['Hixxy', 'uk-hardcore'],
    ['Technikore', 'uk-hardcore'],
    ['Demi Kanon', 'euphoric-hardstyle'],
    ['Galactixx', 'hardstyle'],
    ['Odium', 'hardcore'],
    ['Remzcore', 'frenchcore'],
    ['GPF', 'puzzycore'],
    ['DRS', 'uptempo-hardcore'],
    ['UNSYN', 'uptempo-hardcore'],
    ['Djipe', 'industrial-hardcore'],
    ['TOKYO MACHINE', 'electro-house'],
    ['Nitro Fun', 'electro-house'],
    ['Synthion', 'future-bass'],
    ['PIKASONIC', 'future-bass'],
    ['TAIGA', 'future-house'],
    ['AIKA', 'future-bass'],
    ['EmoCosine', 'kawaii-bass'],
    ['UMEK', 'techno'],
    ['lapix', 'psytrance'],
    ['4s4ki', 'alternative'],
    ['Mick Gordon', 'industrial-metal'],
    ['Neko Hacker', 'j-pop'],
    ['Jaroslav Beck', 'soundtrack'],
    ['Polyphia', 'progressive-metal']
  ]);
  for (const [artist, id] of expected) {
    assert.equal(classifyGenre({ artist, tags: ['Electronic'] }).id, id, artist);
  }
});

test('recognizes newly observed Japanese storefront artist aliases', () => {
  const expected = new Map([
    ['かめりあ', 'hardcore'],
    ['エミネム', 'hip-hop'],
    ['クイーン', 'rock'],
    ['フラックス・バヴィリオン', 'dubstep'],
    ['バーチャル・ライオット', 'dubstep'],
    ['アヴィーチー', 'house'],
    ['スコット・ブラウン', 'uk-hardcore'],
    ['トニー・ベネット', 'jazz'],
    ['ジョン・バティステ', 'jazz'],
    ['ホイットニー・ヒューストン', 'pop'],
    ['ナナヲアカリ', 'j-pop'],
    ['ポリフィア', 'progressive-metal'],
    ['エモコサイン', 'kawaii-bass'],
    ['逃跑计划', 'rock']
  ]);
  for (const [artist, id] of expected) {
    assert.equal(classifyGenre({ artist, tags: ['Electronic'] }).id, id, artist);
  }
});

test('recognizes Japanese music tags and curated artists', () => {
  assert.equal(classifyGenre({ artist: 'YOASOBI', title: 'アイドル', tags: ['Pop'] }).id, 'j-pop');
  assert.equal(classifyGenre({ artist: 'Aimer', title: '残響散歌', tags: ['Anime'] }).id, 'anime');
  assert.equal(classifyGenre({ artist: 'Unknown Artist', title: 'New Song', tags: ['J-Pop'] }).id, 'j-pop');
  assert.equal(classifyGenre({ artist: 'Unknown Artist', title: 'New Song', tags: ['アニメ'] }).id, 'anime');
  assert.equal(classifyGenre({ artist: 'ずっと真夜中でいいのに。', title: '秒針を噛む', tags: [] }).id, 'j-pop');
  assert.equal(classifyGenre({ artist: 'LiSA', title: '紅蓮華', tags: ['Pop'] }).id, 'j-pop');
  assert.equal(classifyGenre({ tags: ['映画／ゲーム'] }).id, 'soundtrack');
  assert.equal(classifyGenre({ tags: ['サウンドトラック'] }).id, 'soundtrack');
  assert.equal(classifyGenre({ tags: ['ジャズ'] }).id, 'jazz');
  assert.equal(classifyGenre({ tags: ['クラシック'] }).id, 'classical');
  assert.equal(classifyGenre({ tags: ['カントリー'] }).id, 'country');
  assert.equal(classifyGenre({ tags: ['メタル'] }).id, 'metal');
  assert.equal(classifyGenre({ tags: ['エレクトロ'] }).id, 'electronic');
  assert.equal(classifyGenre({ tags: ['エレクトロニック'] }).id, 'electronic');
});

test('translates localized Japanese storefront genres before displaying raw labels', () => {
  assert.equal(rawGenreTheme('ニューエイジ').label, 'NEW AGE');
  assert.equal(rawGenreTheme('ブルース').label, 'BLUES');
  assert.equal(rawGenreTheme('ワールド').label, 'WORLD MUSIC');
  assert.equal(rawGenreTheme('演歌').label, 'ENKA');
  assert.equal(rawGenreTheme('ヴィジュアル系').label, 'VISUAL KEI');
  assert.equal(rawGenreTheme('ヴィジュアル系').mode, 'rock');
  assert.equal(classifyGenre({ tags: ['ダブステップ'] }).id, 'dubstep');
  assert.equal(classifyGenre({ tags: ['フューチャーベース'] }).id, 'future-bass');
  assert.equal(classifyGenre({ tags: ['カワイイフューチャーベース'] }).id, 'kawaii-bass');
  assert.equal(classifyGenre({ tags: ['ハードスタイル'] }).id, 'hardstyle');
  assert.equal(classifyGenre({ tags: ['ドラムンベース'] }).id, 'drum-bass');
  assert.equal(rawGenreTheme('ダブステップ').label, 'DUBSTEP');
});

test('recognizes Korean K-Pop metadata without leaking a localized genre label', () => {
  assert.equal(classifyGenre({ tags: ['케이팝'] }).id, 'k-pop');
  assert.equal(classifyGenre({ tags: ['한국 대중음악'] }).id, 'k-pop');
  assert.equal(rawGenreTheme('케이 팝').label, 'K-POP');
});

test('places Kawaii Bass under Future Bass without treating Future Bass as Bass Music', () => {
  const kawaii = classifyGenre({ tags: ['Kawaii Future Bass'] });
  const future = classifyGenre({ tags: ['Future Bass'] });
  assert.equal(kawaii.id, 'kawaii-bass');
  assert.equal(kawaii.parent, 'FUTURE BASS');
  assert.equal(future.id, 'future-bass');
  assert.equal(future.parent, 'ELECTRONIC DANCE');
});

test('never displays Japanese script for any localized genre alias or fallback', () => {
  for (const [, , aliases] of GROUPS) {
    for (const alias of aliases) {
      assert.equal(hasJapaneseScript(rawGenreTheme(alias).label), false, alias);
    }
  }
  assert.equal(rawGenreTheme('未知の実験ロック').label, 'ROCK');
  assert.equal(hasJapaneseScript(rawGenreTheme('未登録ジャンル').label), false);
});

test('covers common non-EDM catalog genres instead of falling back to unknown', () => {
  assert.equal(classifyGenre({ tags: ['Singer/Songwriter'] }).id, 'singer-songwriter');
  assert.equal(classifyGenre({ tags: ['Jazz'] }).id, 'jazz');
  assert.equal(classifyGenre({ tags: ['Classical'] }).id, 'classical');
  assert.equal(classifyGenre({ tags: ['Soundtrack'] }).id, 'soundtrack');
  assert.equal(classifyGenre({ tags: ['Latin Urban'] }).id, 'latin');
  assert.equal(classifyGenre({ tags: ['Cumbia'] }).id, 'latin');
  assert.equal(classifyGenre({ tags: ['Merengue'] }).id, 'latin');
  assert.equal(classifyGenre({ artist: 'Bad Bunny', tags: [] }).id, 'latin');
  assert.equal(classifyGenre({ artist: 'Marc Anthony', tags: [] }).id, 'latin');
  assert.equal(classifyGenre({ tags: ['Punk Rock'] }).id, 'punk');
  assert.equal(classifyGenre({ tags: ['Amapiano'] }).id, 'amapiano');
  assert.equal(classifyGenre({ artist: 'Kabza De Small', tags: ['Dance'] }).id, 'amapiano');
  assert.equal(classifyGenre({ artist: 'Venetian Snares', tags: ['Electronic'] }).id, 'breakcore');
});

test('uses broad rock for artists whose catalogs cross industrial subgenres', () => {
  assert.equal(classifyGenre({ artist: 'Marilyn Manson', title: 'The Beautiful People', tags: ['Rock'] }).id, 'rock');
  assert.equal(classifyGenre({ artist: 'Marilyn Manson', title: 'Rock Is Dead', tags: [] }).matched, 'artist:marilyn manson');
});

test('uses the industrial-metal visual family for Nine Inch Nails', () => {
  assert.equal(classifyGenre({ artist: 'Nine Inch Nails', title: 'Heresy', tags: ['Alternative'] }).id, 'industrial-metal');
  assert.equal(classifyGenre({ artist: 'Nine Inch Nails', title: 'Heresy', tags: [] }).matched, 'artist:nine inch nails');
});

test('canonicalizes Japanese storefront spellings of Western artists', () => {
  assert.equal(canonicalArtist('ゾムボーイ'), 'zomboy');
  assert.equal(canonicalArtist('ウルフギャング・ガルトナー'), 'wolfgang gartner');
  assert.equal(classifyGenre({ artist: 'ゾムボーイ', tags: ['Electronic'] }).id, 'dubstep');
  assert.equal(classifyGenre({ artist: 'ウルフギャング・ガルトナー', tags: ['Electronic'] }).id, 'complextro');
  assert.equal(classifyGenre({ artist: 'ナイフ・パーティー', tags: ['Electronic'] }).id, 'electro-house');
  assert.equal(classifyGenre({ artist: 'マリリン・マンソン', tags: ['Rock'] }).id, 'rock');
  assert.equal(classifyGenre({ artist: 'ナイン・インチ・ネイルズ', tags: ['Alternative'] }).id, 'industrial-metal');
  assert.equal(classifyGenre({ artist: 'アダム・ランバート', tags: [] }).id, 'pop');
  assert.equal(classifyGenre({ artist: 'アフロジャック', tags: ['Dance'] }).id, 'house');
  assert.equal(classifyGenre({ artist: 'ザ・ケミカル・ブラザーズ', tags: ['Electronic'] }).id, 'big-beat');
  assert.equal(classifyGenre({ artist: 'バッド・バニー', tags: ['Latin'] }).id, 'latin');
  assert.equal(classifyGenre({ artist: 'ブラック・コーヒー', tags: ['Dance'] }).id, 'afro-house');
});

test('maps Oryon and Oryon collaborations to broad hardstyle', () => {
  assert.equal(classifyGenre({ artist: 'Oryon', title: 'Dreaming', tags: ['Electronic'] }).id, 'hardstyle');
  assert.equal(classifyGenre({ artist: 'Oryon & Navion', title: 'The Dream', tags: [] }).id, 'hardstyle');
});

test('displays localized Western artist names in their original Latin spelling', () => {
  assert.equal(displayArtistName('ウルフギャング・ガルトナー'), 'Wolfgang Gartner');
  assert.equal(displayArtistName('マリリン・マンソン、ナイン・インチ・ネイルズ'), 'Marilyn Manson、Nine Inch Nails');
  assert.equal(displayArtistName('レディー・ガガ & アダム・ランバート'), 'Lady Gaga & Adam Lambert');
  assert.equal(displayArtistName('ティエスト'), 'Tiësto');
  assert.equal(displayArtistName('バッド・バニー'), 'Bad Bunny');
  assert.equal(displayArtistName('アース・ウインド&ファイアー'), 'Earth, Wind & Fire');
  assert.equal(displayArtistName('かめりあ'), 'かめりあ');
  assert.equal(displayArtistName('ナナヲアカリ'), 'ナナヲアカリ');
});

test('rejects a title-only catalog match with the wrong artist', () => {
  const wrong = scoreTrackCandidate('The Big Goodbye', 'Someone Else', 'The Big Goodbye', 'AJR');
  const correct = scoreTrackCandidate('The Big Goodbye', 'AJR', 'The Big Goodbye', 'AJR');
  const localized = scoreTrackCandidate('The Beautiful People', 'Marilyn Manson', 'The Beautiful People', 'マリリン・マンソン');
  assert.equal(wrong.valid, false);
  assert.equal(correct.valid, true);
  assert.equal(localized.valid, true);
});

test('validates Discogs releases against their track list and credited artist', () => {
  const release = {
    title: 'The Downward Spiral',
    artists: [{ name: 'Nine Inch Nails' }],
    tracklist: [
      { title: 'Heresy', type_: 'track' },
      { title: 'Closer', type_: 'track' }
    ]
  };
  assert.ok(scoreDiscogsRelease(release, {
    title: 'Heresy', artist: 'Nine Inch Nails', album: 'The Downward Spiral'
  }));
  assert.equal(scoreDiscogsRelease(release, {
    title: 'Heresy', artist: 'Someone Else', album: 'The Downward Spiral'
  }), null);
});

test('MusicBrainz recording matching rejects an unrequested live version', () => {
  const expected = { title: 'Heresy', artist: 'Nine Inch Nails', album: 'The Downward Spiral' };
  const studio = scoreMusicBrainzRecording({
    title: 'Heresy',
    score: 100,
    'artist-credit': [{ name: 'Nine Inch Nails' }],
    releases: [{ title: 'The Downward Spiral' }]
  }, expected);
  const live = scoreMusicBrainzRecording({
    title: 'Heresy',
    disambiguation: 'live, 2007',
    score: 100,
    'artist-credit': [{ name: 'Nine Inch Nails' }],
    releases: [{ title: 'Live Archive' }]
  }, expected);
  assert.equal(studio.valid, true);
  assert.equal(live.valid, false);
});

test('a valid user correction becomes a maximum-confidence genre', () => {
  const genre = genreFromUserCorrection({ genreId: 'frenchcore' });
  assert.equal(genre.id, 'frenchcore');
  assert.equal(genre.confidence, 1);
  assert.equal(genre.matched, 'user:frenchcore');
});

test('a remembered user correction bypasses network lookup and wins immediately', async () => {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network lookup should not run');
  };
  try {
    const resolver = new GenreResolver({
      getCorrection: () => ({ genreId: 'drumstep', label: 'DRUMSTEP' })
    });
    const result = await resolver.resolve({
      title: 'Example Track',
      artist: 'Example Artist',
      album: 'Example Album'
    });
    assert.equal(result.genre.id, 'drumstep');
    assert.equal(result.genreSource, 'user correction');
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('disabling online genre lookup performs no catalog requests and keeps local classification', async () => {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network lookup should be disabled');
  };
  try {
    const resolver = new GenreResolver({
      getConfig: () => ({ onlineGenreLookupEnabled: false })
    });
    const result = await resolver.resolve({
      title: 'MTC',
      artist: 'S3RL',
      album: ''
    });
    assert.equal(result.genre.id, 'happy-hardcore');
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('uses Bilibili only as the final unknown fallback after its player suffix was cleaned', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({ onlineGenreLookupEnabled: false })
  });
  const result = await resolver.resolve({
    title: 'A Video With No Music Metadata - 哔哩哔哩_bilibili',
    artist: '',
    album: ''
  });
  assert.equal(result.title, 'A Video With No Music Metadata');
  assert.equal(result.genre.id, 'bilibili');
  assert.equal(result.genre.parent, 'NON-MUSIC');
  assert.equal(result.genreSource, 'Bilibili player suffix fallback');
});

test('keeps Bilibili fallback for later suffix-free titles from the same browser session', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({ onlineGenreLookupEnabled: false })
  });
  const initial = await resolver.resolve({
    title: 'Creator Video - 哔哩哔哩_bilibili',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 1000
  });
  const updated = await resolver.resolve({
    title: 'Creator Video',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 5000
  });
  const nextVideo = await resolver.resolve({
    title: 'A Different Creator Video',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 9000
  });
  const explicitOtherSite = await resolver.resolve({
    title: 'A YouTube Video - YouTube',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 12000
  });
  const afterOtherSite = await resolver.resolve({
    title: 'Another Unlabelled Video',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 15000
  });
  const previousTitleAfterOtherSite = await resolver.resolve({
    title: 'Creator Video',
    artist: '',
    source: 'MSEdge',
    sampledAtMs: 18000
  });
  const unrelated = await resolver.resolve({
    title: 'Creator Video',
    artist: '',
    source: 'Chrome',
    sampledAtMs: 5000
  });
  assert.equal(initial.genre.id, 'bilibili');
  assert.equal(updated.genre.id, 'bilibili');
  assert.equal(nextVideo.genre.id, 'bilibili');
  assert.equal(explicitOtherSite.genre.id, 'unknown');
  assert.equal(afterOtherSite.genre.id, 'unknown');
  assert.equal(previousTitleAfterOtherSite.genre.id, 'unknown');
  assert.equal(unrelated.genre.id, 'unknown');
});

test('Bilibili fallback never overrides a known genre, another site, or uncleaned title text', async () => {
  const resolver = new GenreResolver({
    getConfig: () => ({ onlineGenreLookupEnabled: false })
  });
  const known = await resolver.resolve({
    title: 'House Session - 哔哩哔哩_bilibili',
    artist: '',
    genres: ['House']
  });
  const youtube = await resolver.resolve({ title: 'Unknown Video - YouTube', artist: '' });
  const incidental = await resolver.resolve({ title: 'Bilibili Creator Interview', artist: '' });
  assert.equal(known.genre.id, 'house');
  assert.equal(youtube.genre.id, 'unknown');
  assert.equal(incidental.genre.id, 'unknown');
});

test('a remembered user correction overrides a genre cached before it was saved', async () => {
  let correction = null;
  const resolver = new GenreResolver({ getCorrection: () => correction });
  resolver.cache.set('example artist::example track::example album', {
    title: 'Example Track',
    artist: 'Example Artist',
    album: 'Example Album',
    artwork: '',
    genre: { id: 'house', label: 'HOUSE' },
    genreSource: 'cached catalog result',
    genreSources: ['cached catalog result'],
    userGenreCorrection: null
  });
  correction = { genreId: 'neurofunk', label: 'NEUROFUNK' };

  const result = await resolver.resolve({
    title: 'Example Track',
    artist: 'Example Artist',
    album: 'Example Album'
  });

  assert.equal(result.genre.id, 'neurofunk');
  assert.equal(result.genreSource, 'user correction');
  assert.equal(result.userGenreCorrection.genreId, 'neurofunk');
});

test('rejects an unrequested live, remix, mixed, or tribute recording', () => {
  assert.equal(titleVersionCompatible('Closer (Mixed)', 'Closer'), false);
  assert.equal(titleVersionCompatible('Closer (Live)', 'Closer'), false);
  assert.equal(titleVersionCompatible('Closer (Remix)', 'Closer'), false);
  assert.equal(titleVersionCompatible('Closer (Tribute)', 'Closer'), false);
  assert.equal(titleVersionCompatible('Heresy (Nine Inch Noize Version)', 'Heresy'), false);
  assert.equal(titleVersionCompatible('Heresy (Demo)', 'Heresy'), false);
  assert.equal(titleVersionCompatible('Closer (Live)', 'Closer (Live)'), true);
  assert.equal(scoreTrackCandidate(
    'The Big Goodbye',
    'AJR',
    'The Big Goodbye',
    'AJR',
    "What No One's Thinking",
    "What No One's Thinking"
  ).valid, true);
});

test('cleans Apple Music Windows artist field', () => {
  const raw = 'S3RL — Genre Police (feat. Lexi) - Single';
  assert.equal(cleanArtist(raw, 'Genre Police (feat. Lexi)'), 'S3RL');
  assert.equal(cleanArtist('レディー・ガガ — ARTPOP', 'Donatella'), 'レディー・ガガ');
  assert.equal(cleanArtist('Marilyn Manson（玛丽莲·曼森）'), 'Marilyn Manson');
  assert.equal(cleanArtist('ウルフギャング・ガートナー (Wolfgang Gartner)'), 'Wolfgang Gartner');
  assert.equal(cleanArtist('周杰伦（Jay Chou）'), 'Jay Chou');
  assert.equal(embeddedCollection('レディー・ガガ — ARTPOP'), 'ARTPOP');
  assert.equal(embeddedCollection('米津玄師 — KICK BACK - Single'), 'KICK BACK');
});

test('track matching tolerates remix suffixes', () => {
  assert.ok(similarity('Genre Police (feat. Lexi)', 'Genre Police (feat. Lexi) [DJ Edit]') > 0.6);
});
