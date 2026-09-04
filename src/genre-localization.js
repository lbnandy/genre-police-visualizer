'use strict';

function normalizeGenreKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[・･·]/g, ' ')
    .replace(/[／/＆&＋+_-]/g, ' ')
    .replace(/[（）()［\][\]：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GROUPS = [
  ['Puzzycore', 'puzzycore', ['パジーコア', 'プッジーコア']],
  ['Uptempo Hardcore', 'uptempo-hardcore', ['アップテンポハードコア', 'アップテンポ・ハードコア', 'テラーコア', 'スピードコア']],
  ['UK Hardcore', 'uk-hardcore', ['UKハードコア', 'UK ハードコア', 'フリーフォームハードコア', 'フリーフォーム・ハードコア']],
  ['Happy Hardcore', 'happy-hardcore', ['ハッピーハードコア', 'ハッピー・ハードコア']],
  ['Industrial Hardcore', 'industrial-hardcore', ['インダストリアルハードコア', 'インダストリアル・ハードコア', 'ダークコア', 'ドゥームコア']],
  ['Frenchcore', 'frenchcore', ['フレンチコア']],
  ['Gabber', 'gabber', ['ガバ', 'ガバー', 'ガバテクノ']],
  ['Hardcore', 'hardcore', ['ハードコア', 'ハードコアテクノ', 'ハードコア・テクノ', 'Jコア', 'J-コア']],
  ['Hard Dance', 'hard-dance', ['ハードダンス', 'ハード・ダンス']],
  ['Rawstyle', 'rawstyle', ['ロースタイル', 'ロウスタイル', 'ローハードスタイル', 'ロウ・ハードスタイル']],
  ['Euphoric Hardstyle', 'euphoric-hardstyle', ['ユーフォリックハードスタイル', 'ユーフォリック・ハードスタイル']],
  ['Hardstyle', 'hardstyle', ['ハードスタイル']],

  ['Future Riddim', 'future-riddim', ['フューチャーリディム', 'フューチャー・リディム']],
  ['Colour Bass', 'colour-bass', ['カラーベース', 'カラー・ベース']],
  ['Deathstep', 'deathstep', ['デスステップ']],
  ['Melodic Dubstep', 'melodic-dubstep', ['メロディックダブステップ', 'メロディック・ダブステップ']],
  ['Chillstep', 'melodic-dubstep', ['チルステップ']],
  ['Riddim', 'riddim', ['リディム']],
  ['Brostep', 'brostep', ['ブロステップ']],
  ['Dubstep', 'dubstep', ['ダブステップ']],
  ['Kawaii Future Bass', 'kawaii-bass', ['カワイイフューチャーベース', 'かわいいフューチャーベース', 'カワイイ・フューチャーベース', 'カワイイベース', 'かわいいベース']],
  ['Future Bass', 'future-bass', ['フューチャーベース', 'フューチャー・ベース']],
  ['Bass Music', 'bass-music', ['ベースミュージック', 'ベース・ミュージック']],
  ['Hard Trap', 'hard-trap', ['ハードトラップ', 'ハード・トラップ']],
  ['Hybrid Trap', 'hybrid-trap', ['ハイブリッドトラップ', 'ハイブリッド・トラップ']],
  ['Festival Trap', 'festival-trap', ['フェスティバルトラップ', 'フェスティバル・トラップ']],
  ['EDM Trap', 'trap-edm', ['EDMトラップ', 'EDM トラップ']],
  ['Midtempo Bass', 'midtempo-bass', ['ミッドテンポベース', 'ミッドテンポ・ベース']],
  ['Glitch Hop', 'glitch-hop', ['グリッチホップ', 'グリッチ・ホップ']],
  ['Moombahcore', 'moombahcore', ['ムーンバコア', 'ムーンバ・コア']],
  ['Moombahton', 'moombahton', ['ムーンバートン', 'ムーンバートン']],

  ['Neurofunk', 'neurofunk', ['ニューロファンク']],
  ['Liquid Drum & Bass', 'liquid-dnb', ['リキッドドラムンベース', 'リキッド・ドラムンベース', 'リキッドDnB']],
  ['Dancefloor Drum & Bass', 'dancefloor-dnb', ['ダンスフロアドラムンベース', 'ダンスフロア・ドラムンベース']],
  ['Jump Up Drum & Bass', 'jump-up-dnb', ['ジャンプアップドラムンベース', 'ジャンプアップ・ドラムンベース', 'ジャンプアップDnB']],
  ['Drumstep', 'drumstep', ['ドラムステップ']],
  ['Jungle', 'jungle', ['ジャングル', 'ラガジャングル']],
  ['Drum & Bass', 'drum-bass', ['ドラムンベース', 'ドラム・アンド・ベース', 'ドラムアンドベース', 'DnB']],
  ['Breakcore', 'breakcore', ['ブレイクコア', 'ロリコア']],

  ['Complextro', 'complextro', ['コンプレクストロ']],
  ['Big Room House', 'big-room-house', ['ビッグルームハウス', 'ビッグルーム・ハウス']],
  ['Dutch House', 'dutch-house', ['ダッチハウス', 'ダーティ・ダッチ']],
  ['Fidget House', 'fidget-house', ['フィジェットハウス']],
  ['Melbourne Bounce', 'melbourne-bounce', ['メルボルンバウンス', 'メルボルン・バウンス']],
  ['Future Bounce', 'future-house', ['フューチャーバウンス', 'フューチャー・バウンス']],
  ['Electro House', 'electro-house', ['エレクトロハウス', 'エレクトロ・ハウス']],
  ['Acid House', 'acid-house', ['アシッドハウス', 'アシッド・ハウス']],
  ['Tropical House', 'tropical-house', ['トロピカルハウス', 'トロピカル・ハウス']],
  ['French House', 'french-house', ['フレンチハウス', 'フレンチ・ハウス', 'フィルターハウス', 'フレンチタッチ']],
  ['Disco House', 'disco-house', ['ディスコハウス', 'ファンキーハウス']],
  ['Hard House', 'hard-house', ['ハードハウス']],
  ['Bass House', 'bass-house', ['ベースハウス', 'Gハウス']],
  ['Future House', 'future-house', ['フューチャーハウス', 'スラップハウス']],
  ['Tech House', 'tech-house', ['テックハウス']],
  ['Deep House', 'deep-house', ['ディープハウス', 'ローファイハウス']],
  ['Progressive House', 'progressive-house', ['プログレッシブハウス']],
  ['Amapiano', 'amapiano', ['アマピアノ']],
  ['Afro House', 'afro-house', ['アフロハウス']],
  ['Melodic House', 'melodic-house', ['メロディックハウス', 'オーガニックハウス']],
  ['House', 'house', ['ハウス', 'ハウスミュージック']],

  ['Psytrance', 'psytrance', ['サイケデリックトランス', 'サイケトランス', 'ゴアトランス']],
  ['Uplifting Trance', 'uplifting-trance', ['アップリフティングトランス']],
  ['Progressive Trance', 'progressive-trance', ['プログレッシブトランス']],
  ['Tech Trance', 'tech-trance', ['テックトランス']],
  ['Hard Trance', 'hard-trance', ['ハードトランス', 'アシッドトランス']],
  ['Trance', 'trance', ['トランス']],

  ['Hard Techno', 'hard-techno', ['ハードテクノ', 'シュランツ', 'ハードグルーヴ']],
  ['Acid Techno', 'acid-techno', ['アシッドテクノ']],
  ['Melodic Techno', 'melodic-techno', ['メロディックテクノ']],
  ['Industrial Techno', 'industrial-techno', ['インダストリアルテクノ']],
  ['Minimal Techno', 'minimal-techno', ['ミニマルテクノ', 'ディープテクノ', 'デトロイトテクノ']],
  ['Techno', 'techno', ['テクノ']],

  ['Future Garage', 'future-garage', ['フューチャーガレージ', 'フューチャーガラージ']],
  ['Speed Garage', 'speed-garage', ['スピードガレージ', 'スピードガラージ']],
  ['2-Step Garage', 'two-step-garage', ['2ステップガレージ', 'ツーステップガレージ']],
  ['Bassline', 'bassline', ['ベースライン']],
  ['UK Garage', 'uk-garage', ['UKガレージ', 'UKガラージ']],
  ['Big Beat', 'big-beat', ['ビッグビート']],
  ['Breakbeat', 'breakbeat', ['ブレイクビート', 'ブレイクビーツ', 'ブレイクス']],
  ['Nu Disco', 'nu-disco', ['ニューディスコ']],
  ['Future Funk', 'nu-disco', ['フューチャーファンク']],
  ['Electro Swing', 'electro-swing', ['エレクトロスウィング']],
  ['Synthwave', 'synthwave', ['シンセウェイヴ', 'シンセウェーブ', 'ダークシンセ', 'レトロウェイヴ', 'ヴェイパーウェイヴ']],

  ['Deathcore', 'deathcore', ['デスコア']],
  ['Metalcore', 'metalcore', ['メタルコア', 'ポストハードコア']],
  ['Industrial Metal', 'industrial-metal', ['インダストリアルメタル']],
  ['Progressive Metal', 'progressive-metal', ['プログレッシブメタル', 'ジェント']],
  ['Death Metal', 'death-metal', ['デスメタル', 'メロディックデスメタル', 'テクニカルデスメタル']],
  ['Black Metal', 'black-metal', ['ブラックメタル']],
  ['Nu Metal', 'nu-metal', ['ニューメタル', 'ラップメタル']],
  ['Metal', 'metal', ['メタル', 'ヘヴィメタル', 'ヘビーメタル', 'スラッシュメタル', 'パワーメタル', 'ドゥームメタル']],

  ['Disco', 'disco-funk', ['ディスコ']],
  ['Funk', 'funk', ['ファンク']],
  ['Singer/Songwriter', 'singer-songwriter', ['シンガーソングライター', 'シンガー・ソングライター']],
  ['Country', 'country', ['カントリー', 'アメリカーナ', 'ブルーグラス']],
  ['Folk', 'folk', ['フォーク', 'インディーフォーク', 'フォークロック', 'アコースティック']],
  ['Blues', 'blues', ['Delta Blues', 'Chicago Blues', 'Electric Blues', 'ブルース']],
  ['Jazz Fusion', 'jazz-fusion', ['ジャズフュージョン', 'ジャズ・フュージョン', 'ジャズファンク', 'ジャズロック']],
  ['Bossa Nova', 'bossa-nova', ['ボサノバ', 'ボサノヴァ']],
  ['Bebop', 'bebop', ['ビバップ', 'ハードバップ', 'ポストバップ']],
  ['Swing Jazz', 'swing-jazz', ['スウィング', 'スウィングジャズ', 'ビッグバンド']],
  ['Jazz', 'jazz', ['ジャズ']],
  ['Baroque', 'baroque', ['バロック', 'バロック音楽']],
  ['Romantic Classical', 'romantic-classical', ['ロマン派', 'ロマン派音楽']],
  ['Opera', 'opera', ['オペラ', '歌劇']],
  ['Modern Classical', 'modern-classical', ['現代音楽', '近現代クラシック', 'ネオクラシカル']],
  ['Classical', 'classical', ['クラシック', 'オーケストラ', '室内楽', 'ピアノ']],
  ['Soundtrack', 'soundtrack', ['サウンドトラック', '映画音楽', 'ゲーム音楽', '映画／ゲーム', '映画/ゲーム']],
  ['Latin', 'latin', ['ラテン', 'レゲトン', 'サルサ', 'バチャータ', 'メレンゲ', 'クンビア', 'マンボ']],
  ['Reggae', 'reggae', ['レゲエ', 'ダンスホール']],
  ['Punk', 'punk', ['パンク', 'ポップパンク', 'パンクロック']],
  ['City Pop', 'city-pop', ['シティポップ', 'シティ・ポップ']],
  ['Vocaloid', 'vocaloid', ['ボーカロイド']],
  ['Anime', 'anime', ['アニメ', 'アニソン']],
  ['J-Pop', 'j-pop', ['Jポップ', 'J-Pop', '歌謡曲', 'カヨウキョク']],
  ['J-Rock', 'rock', ['Jロック', 'J-Rock']],
  ['K-Pop', 'k-pop', ['Kポップ', 'K-Pop', '케이팝', '케이 팝', '한국 팝', '한국 대중음악']],
  ['C-Pop', 'pop', ['Cポップ', 'C-Pop']],
  ['Dance Pop', 'dance-pop', ['ダンスポップ', '댄스 팝', '댄스팝']],
  ['Electropop', 'dance-pop', ['エレクトロポップ']],
  ['Synthpop', 'dance-pop', ['シンセポップ']],
  ['Europop', 'dance-pop', ['ユーロポップ']],
  ['Indie Pop', 'indie-pop', ['インディーポップ', 'ベッドルームポップ', 'ドリームポップ']],
  ['Pop Rock', 'pop-rock', ['ポップロック', 'ピアノロック', 'パワーポップ']],
  ['Experimental Hip-Hop', 'experimental-hip-hop', ['Experimental Rap', 'Abstract Hip-Hop', 'Industrial Hip-Hop', '実験的ヒップホップ', 'エクスペリメンタル・ヒップホップ', '实验说唱', '實驗說唱', '实验嘻哈', '實驗嘻哈']],
  ['Lo-Fi Hip-Hop', 'lo-fi-hip-hop', ['Lofi Hip-Hop', 'Lo-Fi Beats', 'Lofi Beats', 'Chillhop', 'ローファイ・ヒップホップ', 'ローファイヒップホップ', 'チルホップ']],
  ['Instrumental Hip-Hop', 'instrumental-hip-hop', ['Instrumental Hip Hop', 'インストゥルメンタル・ヒップホップ']],
  ['Hip-Hop/Rap', 'hip-hop', ['ヒップホップ', 'ヒップホップ／ラップ', 'ヒップホップ/ラップ', 'ラップ', 'グライム']],
  ['Drift Phonk', 'drift-phonk', ['ドリフトフォンク', 'ドリフト・フォンク', '漂移Phonk']],
  ['Phonk', 'phonk', ['フォンク', 'ファンク・ラップ']],
  ['Contemporary R&B', 'contemporary-rnb', ['コンテンポラリーR&B', '現代R&B']],
  ['Alternative R&B', 'alternative-rnb', ['オルタナティブR&B', 'オルタナR&B']],
  ['Neo Soul', 'neo-soul', ['ネオソウル', 'ネオ・ソウル']],
  ['New Jack Swing', 'new-jack-swing', ['ニュージャックスウィング', 'ニュー・ジャック・スウィング']],
  ['Soul', 'soul', ['ソウル']],
  ['Gospel', 'gospel', ['ゴスペル', 'クリスチャン／ゴスペル', 'クリスチャン/ゴスペル']],
  ['R&B', 'rnb', ['Rhythm & Blues', 'Rhythm and Blues', 'R&B／ソウル', 'R&B/ソウル', 'R＆B']],
  ['Pop', 'pop', ['ポップ', '팝']],
  ['Alternative', 'alternative', ['オルタナティブ', 'オルタナティブロック', 'インディーロック', 'ガレージロック', 'インディー']],
  ['Rock', 'rock', ['ロック', 'ハードロック', 'クラシックロック']],
  ['Electronic', 'electronic', ['エレクトロニック', 'エレクトロ', 'クラブ']],
  ['Dance', 'electronic', ['ダンス']],

  ['Chillout', 'chillout', ['Chill Out', 'Chill-Out', 'チルアウト']],
  ['Downtempo', 'downtempo', ['Down Tempo', 'Down-Tempo', 'Downbeat', 'Trip Hop', 'Trip-Hop', 'ダウンテンポ', 'トリップホップ']],
  ['Ambient', 'ambient', ['Ambient Music', 'Dark Ambient', 'Space Ambient', 'Drone Ambient', 'アンビエント', '環境音楽']],
  ['IDM', 'idm', ['Intelligent Dance Music', 'Braindance', 'Drill and Bass', 'インテリジェントダンスミュージック', 'インテリジェント・ダンス・ミュージック']],
  ['Glitch', 'glitch', ['Microsound', 'Lowercase', 'Clicks and Cuts', 'グリッチ', 'マイクロサウンド']],
  ['Experimental', 'electronic', ['エクスペリメンタル', '実験音楽']],
  ['Chiptune', 'electronic', ['チップチューン', 'チップサウンド']],
  ['Noise', 'electronic', ['ノイズ', 'ノイズミュージック']],
  ['New Age', 'trance', ['ニューエイジ']],
  ['World Music', 'rnb', ['ワールド', 'ワールドミュージック']],
  ['Enka', 'j-pop', ['演歌']],
  ['Visual Kei', 'rock', ['ヴィジュアル系', 'ビジュアル系']],
  ['African', 'rnb', ['アフリカン']],
  ['Arabic', 'rnb', ['アラビック', 'アラブ音楽']],
  ['Indian', 'rnb', ['インド', 'インド音楽']],
  ['Fitness', 'electronic', ['エクササイズ', 'フィットネス', 'フィットネス／エクササイズ']],
  ["Children's Music", 'pop', ['キッズ', 'キッズ／ファミリー', 'キッズ/ファミリー', 'チルドレン・ミュージック']],
  ['Comedy', 'pop', ['コメディ']],
  ['French Pop', 'pop', ['フランス語ポップ']],
  ['German Pop', 'pop', ['ドイツ語ポップ']],
  ['German Folk', 'folk', ['ドイツ民謡', 'ドイツフォーク']],
  ['Holiday', 'pop', ['ホリデー']],
  ['Vocal', 'pop', ['ボーカル']]
];

const LOCALIZED_GENRES = new Map();
for (const [canonical, baseId, aliases] of GROUPS) {
  for (const alias of aliases) {
    LOCALIZED_GENRES.set(normalizeGenreKey(alias), { canonical, baseId });
  }
}

const JAPANESE_FALLBACKS = [
  [/ハードコア/, { canonical: 'Hardcore', baseId: 'hardcore' }],
  [/ハードスタイル|ロースタイル|ロウスタイル/, { canonical: 'Hardstyle', baseId: 'hardstyle' }],
  [/ダブステップ|リディム/, { canonical: 'Dubstep', baseId: 'dubstep' }],
  [/ドラムンベース|ジャングル/, { canonical: 'Drum & Bass', baseId: 'drum-bass' }],
  [/トラップ/, { canonical: 'Trap', baseId: 'hip-hop' }],
  [/ハウス/, { canonical: 'House', baseId: 'house' }],
  [/テクノ/, { canonical: 'Techno', baseId: 'techno' }],
  [/トランス/, { canonical: 'Trance', baseId: 'trance' }],
  [/ベース/, { canonical: 'Bass Music', baseId: 'bass-music' }],
  [/メタル|グラインドコア|スラッジ/, { canonical: 'Metal', baseId: 'metal' }],
  [/パンク|ロック/, { canonical: 'Rock', baseId: 'rock' }],
  [/ポップ/, { canonical: 'Pop', baseId: 'pop' }],
  [/ヒップホップ|ラップ/, { canonical: 'Hip-Hop/Rap', baseId: 'hip-hop' }],
  [/ジャズ/, { canonical: 'Jazz', baseId: 'jazz' }],
  [/クラシック|交響曲/, { canonical: 'Classical', baseId: 'classical' }],
  [/アニメ|ゲーム|映画/, { canonical: 'Soundtrack', baseId: 'soundtrack' }],
  [/レゲエ|ダブ/, { canonical: 'Reggae', baseId: 'reggae' }],
  [/フォーク|民謡/, { canonical: 'Folk', baseId: 'folk' }],
  [/エレクトロ|ダンス|クラブ|アンビエント|ノイズ/, { canonical: 'Electronic', baseId: 'electronic' }]
];

function hasJapaneseScript(value) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(value || ''));
}

function localizedGenreInfo(value) {
  const exact = LOCALIZED_GENRES.get(normalizeGenreKey(value));
  if (exact) return exact;
  if (!hasJapaneseScript(value)) return null;
  for (const [pattern, info] of JAPANESE_FALLBACKS) {
    if (pattern.test(String(value))) return info;
  }
  // Never leak an untranslated storefront/tag value into the main genre HUD.
  return { canonical: 'Japanese Music', baseId: 'j-pop' };
}

function canonicalizeGenreLabel(value) {
  return localizedGenreInfo(value)?.canonical || String(value || '');
}

module.exports = {
  GROUPS,
  LOCALIZED_GENRES,
  normalizeGenreKey,
  hasJapaneseScript,
  localizedGenreInfo,
  canonicalizeGenreLabel
};
