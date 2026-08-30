'use strict';

const DECORATIVE_SUFFIX_KEYWORDS = /(?:中文|简中|繁中|日文|英文|翻译|译名|来自|出自|收录|主题曲|片头|片尾|插曲|原声|电影|电视剧|动漫|动画|游戏|广播剧|完整版|高清|无损|歌词|伴奏|纯音乐|现场版|翻唱|试听|剪辑|official\s*(?:video|audio)|music\s*video|from\s+the\s+(?:film|series|game)|(?:anime|movie|game)\s*(?:theme|ost)|\b(?:op|ed|ost)\b)/iu;
const HAN_SCRIPT = /\p{Script=Han}/u;
const FOREIGN_TITLE_SCRIPT = /[\p{Script=Latin}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WEB_PLAYER_SUFFIX = /(?:\s*[-|•—–]\s*|_)(youtube(?:\s+music)?|哔哩哔哩(?:_bilibili)?|bilibili|网易云音乐|qq\s*音乐|酷狗音乐|酷我音乐|spotify|soundcloud|bandcamp|vimeo|twitch|抖音|优酷|腾讯视频|爱奇艺)\s*$/iu;

function playerTitleInfo(value) {
  let title = String(value || '')
    .replace(/\s*[|•]\s*(official|apple music).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const removedSources = [];
  for (let pass = 0; pass < 2; pass += 1) {
    const match = title.match(WEB_PLAYER_SUFFIX);
    if (!match) break;
    const cleaned = title.slice(0, match.index).trim();
    if (!cleaned || cleaned === title) break;
    if (/^(?:哔哩哔哩(?:_bilibili)?|bilibili)$/iu.test(match[1])) removedSources.push('bilibili');
    else removedSources.push(String(match[1] || '').toLocaleLowerCase());
    title = cleaned;
  }
  return { title, removedSources };
}

function cleanDisplayTitle(value) {
  return playerTitleInfo(value).title;
}

function cleanedBilibiliPlayerSuffix(value) {
  return playerTitleInfo(value).removedSources.includes('bilibili');
}

function isDecorativeSuffix(base, suffix) {
  const detail = String(suffix || '').trim();
  if (!detail) return false;
  if (DECORATIVE_SUFFIX_KEYWORDS.test(detail) || /[《》]/u.test(detail)) return true;
  // QQ Music and NetEase commonly append a Chinese translation to a Latin
  // catalog title. Keep it on screen, but omit it from external lookup keys.
  return FOREIGN_TITLE_SCRIPT.test(base) && HAN_SCRIPT.test(detail);
}

function lookupTitle(value) {
  let result = cleanDisplayTitle(value);
  // Official version markers such as "(Live)" and "(Remix)" are retained:
  // they distinguish recordings and protect both lyrics and genre matching.
  for (let pass = 0; pass < 3; pass += 1) {
    const match = result.match(/^(.*?)(?:\s*[\(（\[【]([^\)）\]】]{1,96})[\)）\]】])\s*$/u);
    if (!match || !isDecorativeSuffix(match[1], match[2])) break;
    result = match[1].trim();
  }
  return result || cleanDisplayTitle(value);
}

module.exports = {
  cleanDisplayTitle,
  cleanedBilibiliPlayerSuffix,
  isDecorativeSuffix,
  lookupTitle,
  playerTitleInfo
};
