import { AudioEngine } from './audio-engine.js';
import { VisualEngine } from './visual-engine.js';
import { fallbackTheme, demoTracks } from './themes.js';
import { buildLyricSweepTimeline, buildLyricUnitTimeline, lyricLineInkWidth, lyricUnitMotion } from './lyric-motion.mjs';
import { resolveImpactFx } from './impact-fx.mjs';
import { isGenrePoliceTrack } from './easter-eggs.mjs';
import { KawaiiExpressionTracker } from './kawaii-expression.mjs';
import { smoothMotionEnvelope } from './motion-envelope.mjs';
import { softenMotionMetrics } from './motion-preference.mjs';
import {
  applyLyricDelay,
  LYRIC_DELAY_MAX_MS,
  LYRIC_DELAY_MIN_MS,
  normalizeLyricDelayMs,
  reconcilePlaybackPosition
} from './playback-clock.mjs';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
};

const UI_SCALE_BASE = 1.2;
const UI_SCALES = [0.84, 0.96, 1.08, 1.2, 1.32, 1.44, 1.56, 1.68, 1.8];
const DEFAULT_UI_SCALE = 1.44;

const canvas = document.querySelector('#visualizer');
const appShell = document.querySelector('#app');
const themedBackdrop = document.querySelector('#poster-backdrop');
const previousThemedBackdrop = document.querySelector('#themed-backdrop-previous');
const hud = document.querySelector('#hud');
const artwork = document.querySelector('#artwork');
const parentGenre = document.querySelector('#parent-genre');
const genreLabel = document.querySelector('#genre');
const genreNote = document.querySelector('#genre-note');
const titleLabel = document.querySelector('#title');
const artistLabel = document.querySelector('#artist');
const caseId = document.querySelector('#case-id');
const playState = document.querySelector('#play-state');
const genreSource = document.querySelector('#genre-source');
const progress = document.querySelector('.track-rule-fill');
const settings = document.querySelector('#settings');
const settingsScroll = document.querySelector('.settings-scroll');
const settingsScrollbar = document.querySelector('#settings-scrollbar');
const settingsScrollbarThumb = document.querySelector('#settings-scrollbar-thumb');
const lastFmInput = document.querySelector('#lastfm-key');
const discogsTokenInput = document.querySelector('#discogs-token');
const appVersionLabel = document.querySelector('#app-version');
const genreCorrectionInput = document.querySelector('#genre-correction-input');
const genreCorrectionSuggestions = document.querySelector('#genre-correction-suggestions');
const genreCorrectionTrack = document.querySelector('#genre-correction-track');
const genreCorrectionState = document.querySelector('#genre-correction-state');
const genreCorrectionSave = document.querySelector('#genre-correction-save');
const genreCorrectionClear = document.querySelector('#genre-correction-clear');
const uiScaleButton = document.querySelector('#ui-scale-button');
const uiScaleValue = document.querySelector('#ui-scale-value');
const uiScaleMenu = document.querySelector('#ui-scale-menu');
const uiScaleOptions = [...document.querySelectorAll('.ui-scale-option')];
const layoutModeOptions = [...document.querySelectorAll('.layout-mode-option')];
const layoutModeGroup = document.querySelector('#layout-mode-group');
const motionModeOptions = [...document.querySelectorAll('.motion-mode-option')];
const motionModeGroup = document.querySelector('#motion-mode-group');
const idleBehaviorOptions = [...document.querySelectorAll('.idle-behavior-option')];
const idleBehaviorGroup = document.querySelector('#idle-behavior-group');
const mediaSourceButton = document.querySelector('#media-source-button');
const mediaSourceValue = document.querySelector('#media-source-value');
const mediaSourceMenu = document.querySelector('#media-source-menu');
const mediaSourceIgnoreList = document.querySelector('#media-source-ignore-list');
const capsuleBackgroundSetting = document.querySelector('#capsule-background-setting');
const posterBackgroundSetting = document.querySelector('#poster-background-setting');
const capsuleEnglishFontSetting = document.querySelector('#capsule-english-font-setting');
const capsuleEnglishFontToggle = document.querySelector('#capsule-english-font-toggle');
const posterEnglishFontSetting = document.querySelector('#poster-english-font-setting');
const posterEnglishFontToggle = document.querySelector('#poster-english-font-toggle');
const capsuleThemedBackgroundToggle = document.querySelector('#capsule-themed-background-toggle');
const posterThemedBackgroundToggle = document.querySelector('#poster-themed-background-toggle');
const languageButton = document.querySelector('#language-button');
const languageValue = document.querySelector('#language-value');
const languageMenu = document.querySelector('#language-menu');
const languageOptions = [...document.querySelectorAll('.language-option')];
const controls = document.querySelector('#controls');
const transport = document.querySelector('#transport');
const settingsButton = document.querySelector('#settings-button');
const layoutToggleButton = document.querySelector('#layout-toggle-button');
const previousTrackButton = document.querySelector('#previous-track');
const playPauseButton = document.querySelector('#play-pause');
const nextTrackButton = document.querySelector('#next-track');
const lyricsPanel = document.querySelector('#synced-lyrics');
const lyricCurrentBase = document.querySelector('#lyric-current-base');
const lyricCurrentFill = document.querySelector('#lyric-current-fill');
const lyricCurrentFillContent = document.querySelector('#lyric-current-fill-content');
const lyricTranslation = document.querySelector('#lyric-translation');
const lyricTranslationBase = document.querySelector('#lyric-translation-base');
const lyricTranslationFill = document.querySelector('#lyric-translation-fill');
const lyricTranslationFillContent = document.querySelector('#lyric-translation-fill-content');
const lyricsEnabledToggle = document.querySelector('#lyrics-enabled-toggle');
const lyricTranslationToggle = document.querySelector('#lyric-translation-toggle');
const lyricSweepToggle = document.querySelector('#lyric-sweep-toggle');
const lyricDelayInput = document.querySelector('#lyric-delay');
const lyricDelayValue = document.querySelector('#lyric-delay-value');
const lyricDelayReset = document.querySelector('#lyric-delay-reset');
const lyricSweepSetting = document.querySelector('#lyric-sweep-setting');
const lyricTranslationSetting = document.querySelector('#lyric-translation-setting');
const lyricDelaySetting = document.querySelector('#lyric-delay-setting');
const onlineLookupToggle = document.querySelector('#online-lookup-toggle');
const launchAtLoginToggle = document.querySelector('#launch-at-login-toggle');
const credentialsSave = document.querySelector('#credentials-save');
const credentialsState = document.querySelector('#credentials-state');
const diagnosticsPanel = document.querySelector('#diagnostics-panel');
const diagnosticsPlayer = document.querySelector('#diagnostics-player');
const diagnosticsAudio = document.querySelector('#diagnostics-audio');
const diagnosticsRhythm = document.querySelector('#diagnostics-rhythm');
const diagnosticsGenre = document.querySelector('#diagnostics-genre');
const diagnosticsLyrics = document.querySelector('#diagnostics-lyrics');
const diagnosticsRecapture = document.querySelector('#diagnostics-recapture');
const diagnosticsExport = document.querySelector('#diagnostics-export');
const diagnosticsState = document.querySelector('#diagnostics-state');
const specialAlert = document.querySelector('#special-alert');
const coreArt = document.querySelector('#core-art');
const riffStrings = document.querySelector('#riff-strings');
const riffStringsContext = riffStrings.getContext('2d');
const kawaiiFace = document.querySelector('#kawaii-face');
const tanocFace = document.querySelector('#tanoc-face');

const i18n = window.GenrePoliceI18n;
const LANGUAGE_NAMES = Object.freeze({ 'zh-CN': '简体中文', en: 'English', ja: '日本語', ko: '한국어' });
let uiLanguage = i18n?.DEFAULT_LOCALE || 'zh-CN';
let layoutMode = 'side';
let capsuleCondensedEnglish = false;
let posterCondensedEnglish = true;
let capsuleThemedBackground = true;
let posterThemedBackground = true;
let motionMode = 'standard';
let idleBehavior = 'keep';
let preferredMediaSource = '';
let ignoredMediaSources = [];
let availableMediaSources = [];
let currentMediaSource = '';
let latestRhythmModelState = { type: 'unavailable' };
const tr = (key, variables) => i18n?.translate(uiLanguage, key, variables) || key;
const trMain = (key, variables) => i18n?.translate('en', key, variables) || key;

const audio = new AudioEngine();
const visual = new VisualEngine(canvas);
const kawaiiExpression = new KawaiiExpressionTracker();

let currentMetadata = null;
let currentDisplayContent = null;
let currentTheme = { ...fallbackTheme };
let artworkPaletteSerial = 0;
let demoTheme = null;
let transitionToken = 0;
let backdropCrossfadeSerial = 0;
let backdropCrossfadeAnimations = [];
let lastDemoBeat = -1;
let controlsHideTimer = 0;
let coreScale = 1;
let coreVelocity = 0;
let kawaiiBeatAt = -Infinity;
let kawaiiBeatStrength = 0;
let tanocBeatAt = -Infinity;
let tanocBeatStrength = 0;
let currentTanocVariant = '';
let kawaiiTrackerActive = false;
let riffStringsActive = false;
let genreScale = 1;
let genreVelocity = 0;
let genreLiftValue = 0;
let tranceTextPulse = 0;
let posterEnergy = 0;
let posterImpact = 0;
let tranceArtworkClarity = 0;
let posterPhase = 0;
let posterOrbitPhase = 0;
let posterSoftPhase = 0;
let posterTravel = 0;
let previousAnimationTime = 0;
let lastAnimationWorkAt = 0;
let idleSettleTimer = 0;
let mediaControlSerial = 0;
let optimisticPlaybackIcon = null;
let genreOptions = [];
let settingsScrollbarDrag = null;
let riffPluckAt = -Infinity;
let riffPluckStrength = 0;
let riffPluckDirection = 1;
let lyricLines = [];
let lyricIndex = -2;
let lyricAnimatedUnits = [];
let lyricReflowAnimation = null;
let lyricRevealAnimation = null;
let activeLyricMotionUnit = null;
let activePoliceMotionUnit = null;
let lyricTextWidth = 1;
let lyricTranslationWidth = 1;
let lyricFadeWidth = 14;
let lyricTranslationFadeWidth = 8;
let lyricsEnabled = true;
let lyricTranslationEnabled = true;
let lyricSweepEnabled = true;
let onlineGenreLookupEnabled = true;
let launchAtLoginEnabled = false;
let lyricDelayMs = 0;
let playbackClock = {
  positionMs: 0,
  durationMs: 0,
  playing: false,
  playbackRate: 1,
  anchoredAt: performance.now()
};
// This is only enough anticipation to hide the line-change animation. Manual
// delay remains available as a separate user-controlled offset.
const LYRIC_LOOKAHEAD_MS = 360;

function metadataKey(metadata) {
  return `${metadata?.artist || metadata?.albumArtist || ''}::${metadata?.title || ''}`.toLowerCase();
}

const HARD_TANOC_GENRES = new Set([
  'hardcore', 'gabber', 'frenchcore', 'uptempo-hardcore', 'puzzycore',
  'industrial-hardcore', 'hardstyle', 'rawstyle'
]);

function resolveTanocFaceVariant(theme, member) {
  if (!member || !['hardcore', 'hardstyle'].includes(theme?.mode)) return '';
  return HARD_TANOC_GENRES.has(theme.id) ? 'hard' : 'normal';
}

function drawForegroundRiffStrings(metrics, time) {
  const metal = currentTheme.mode === 'metal';
  // This canvas only exists for the guitar-family string layer. Returning
  // before resize/clear avoids repainting a hidden 920×400 surface for every
  // Trance frame.
  if (!metal && currentTheme.mode !== 'rock') {
    if (riffStringsActive && riffStrings.width && riffStrings.height) {
      riffStringsContext.clearRect(0, 0, riffStrings.width, riffStrings.height);
    }
    riffStringsActive = false;
    return;
  }
  riffStringsActive = true;
  const width = riffStrings.clientWidth;
  const height = riffStrings.clientHeight;
  if (!width || !height) return;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (riffStrings.width !== pixelWidth || riffStrings.height !== pixelHeight) {
    riffStrings.width = pixelWidth;
    riffStrings.height = pixelHeight;
  }
  const ctx = riffStringsContext;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const spectrum = visual.lastSpectrum?.outer || [];
  if (spectrum.length < 3) return;
  const center = visual.center();
  const spectrumRadii = spectrum.map((point) => Math.hypot(
    point.x - center.x,
    point.y - center.y
  ));
  const lineSpan = Math.max(...spectrumRadii) + 14;

  const count = 6;
  const spacing = metal ? 8.7 : 9.2;
  const rotation = currentTheme.id === 'country' ? -0.18 : -0.38;
  const tangent = { x: Math.cos(rotation), y: Math.sin(rotation) };
  const normal = { x: -tangent.y, y: tangent.x };
  const pulse = clamp(metrics.rhythmPulse || 0);
  const drive = metal
    ? clamp(metrics.mid * 0.4 + metrics.high * 0.38 + pulse * 0.38)
    : clamp(metrics.mid * 0.54 + metrics.high * 0.24 + pulse * 0.28);
  if (metrics.rhythmNow && time - riffPluckAt > 64) {
    riffPluckAt = time;
    riffPluckStrength = clamp(metrics.rhythmStrength ?? metrics.impact ?? pulse);
    riffPluckDirection *= -1;
  }

  ctx.save();
  // The strings are intentionally longer than the visual body. Clipping them
  // with the exact current spectrum polygon makes every visible endpoint the
  // live waveform edge, including during sharp peaks and concave notches.
  ctx.beginPath();
  spectrum.forEach((point, index) => {
    if (!index) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineJoin = metal ? 'miter' : 'round';
  for (let stringIndex = 0; stringIndex < count; stringIndex += 1) {
    const offset = (stringIndex - (count - 1) * 0.5) * spacing;
    const left = {
      x: center.x - tangent.x * lineSpan + normal.x * offset,
      y: center.y - tangent.y * lineSpan + normal.y * offset
    };
    const right = {
      x: center.x + tangent.x * lineSpan + normal.x * offset,
      y: center.y + tangent.y * lineSpan + normal.y * offset
    };
    const sequenceIndex = riffPluckDirection > 0 ? stringIndex : count - 1 - stringIndex;
    const localPluckAge = time - riffPluckAt - sequenceIndex * (metal ? 6 : 9);
    const pluckEnvelope = localPluckAge >= 0
      ? Math.exp(-localPluckAge / (metal ? 92 : 138))
      : 0;
    const pluckOscillation = localPluckAge >= 0
      ? Math.sin(localPluckAge * (metal ? 0.135 : 0.094))
      : 0;
    const vibration = pluckOscillation * pluckEnvelope
      * (0.7 + riffPluckStrength * (metal ? 3.1 : 2.55));
    const points = [];
    const samples = metal ? 26 : 22;
    for (let sample = 0; sample <= samples; sample += 1) {
      const amount = sample / samples;
      const envelope = Math.sin(amount * Math.PI);
      const baseX = left.x + (right.x - left.x) * amount;
      const baseY = left.y + (right.y - left.y) * amount;
      const grit = metal
        ? Math.sin(amount * Math.PI * 8 + time * 0.008 + stringIndex * 0.78)
          * envelope * (0.08 + metrics.high * 0.22 + pulse * 0.14)
        : 0;
      const displacement = envelope * vibration + grit;
      points.push({
        x: baseX + normal.x * displacement,
        y: baseY + normal.y * displacement
      });
    }
    const trace = (normalShift = 0) => {
      ctx.beginPath();
      points.forEach((point, index) => {
        const px = point.x + normal.x * normalShift;
        const py = point.y + normal.y * normalShift;
        if (!index) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    if (metal) {
      ctx.strokeStyle = currentTheme.accent2;
      ctx.globalAlpha = 0.18 + drive * 0.12 + pluckEnvelope * 0.16;
      ctx.lineWidth = 1.15 + drive * 0.32;
      ctx.shadowColor = currentTheme.accent2;
      ctx.shadowBlur = 6 + drive * 5;
      trace(1.45);
    }
    ctx.strokeStyle = stringIndex % 2 ? currentTheme.accent2 : currentTheme.accent;
    ctx.globalAlpha = (metal ? 0.47 : 0.4) + drive * (metal ? 0.17 : 0.14) + pluckEnvelope * 0.2;
    ctx.lineWidth = (metal ? 1.05 : 0.9) + drive * 0.24 + pluckEnvelope * 0.24;
    ctx.shadowColor = stringIndex % 2 ? currentTheme.accent2 : currentTheme.accent;
    ctx.shadowBlur = 6 + drive * 7 + pluckEnvelope * 4;
    trace();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function setPlayPauseIcon(playing) {
  playPauseButton.classList.toggle('is-playing', Boolean(playing));
  playPauseButton.title = playing ? tr('controls.pause') : tr('controls.play');
  playPauseButton.setAttribute('aria-label', playing ? tr('controls.pause') : tr('controls.play'));
}

function reconcilePlayPauseIcon(playing, time = performance.now()) {
  if (optimisticPlaybackIcon) {
    const confirmed = Boolean(playing) === optimisticPlaybackIcon.playing;
    if (!confirmed && time < optimisticPlaybackIcon.expiresAt) return;
    optimisticPlaybackIcon = null;
  }
  setPlayPauseIcon(playing);
}

function syncPlaybackClock(metadata = {}, time = performance.now(), options = {}) {
  const incomingPlaying = Boolean(metadata.playing);
  const incomingRate = Math.max(0.01, Number(metadata.playbackRate) || 1);
  const sampledAtMs = Number(metadata.sampledAtMs) || 0;
  // SMTC position is sampled in another process. Compensate only the small IPC
  // transit time; old asynchronous genre results are explicitly non-reconciled.
  const transitMs = incomingPlaying && sampledAtMs > 0
    ? clamp(Date.now() - sampledAtMs, 0, 2000)
    : 0;
  const incomingPosition = Math.max(0, (Number(metadata.positionMs) || 0) + transitMs * incomingRate);
  const incomingDuration = Math.max(0, Number(metadata.durationMs) || 0);
  const predictedPosition = playbackPositionAt(time);
  const hasClock = playbackClock.positionMs > 0 || playbackClock.durationMs > 0;
  const playbackStateChanged = playbackClock.playing !== incomingPlaying;
  const reconciled = reconcilePlaybackPosition({
    predictedPosition,
    incomingPosition,
    playing: incomingPlaying,
    force: Boolean(options.force || !hasClock),
    stateChanged: playbackStateChanged,
    reconcile: options.reconcile !== false
  });
  const durationMs = incomingDuration || playbackClock.durationMs;
  const positionMs = durationMs
    ? Math.min(durationMs, reconciled.positionMs)
    : reconciled.positionMs;

  playbackClock = {
    positionMs,
    durationMs,
    playing: incomingPlaying,
    playbackRate: options.reconcile === false && !options.force
      ? playbackClock.playbackRate || incomingRate
      : incomingRate * (reconciled.rateScale || 1),
    anchoredAt: time
  };
  reconcilePlayPauseIcon(playbackClock.playing, time);
}

function playbackPositionAt(time = performance.now()) {
  const elapsed = playbackClock.playing ? Math.max(0, time - playbackClock.anchoredAt) : 0;
  const position = playbackClock.positionMs + elapsed * (playbackClock.playbackRate || 1);
  return playbackClock.durationMs ? Math.min(playbackClock.durationMs, position) : position;
}

function animateLyricLayoutChange(layoutStartTop, { reveal = false } = {}) {
  const startTop = Number.isFinite(layoutStartTop)
    ? layoutStartTop
    : hud.getBoundingClientRect().top;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cancel the previous visual offset before measuring the new layout's true
  // resting position. The individual translate property composes with HUD's
  // existing transform, so genre motion and vertical centering stay intact.
  lyricReflowAnimation?.cancel();
  lyricReflowAnimation = null;
  const endTop = hud.getBoundingClientRect().top;
  const deltaY = startTop - endTop;

  if (!prefersReducedMotion && Math.abs(deltaY) > 0.5) {
    const animation = hud.animate(
      [
        { translate: `0 ${deltaY.toFixed(2)}px` },
        { translate: '0 0' }
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'both'
      }
    );
    lyricReflowAnimation = animation;
    animation.onfinish = () => {
      if (lyricReflowAnimation !== animation) return;
      animation.cancel();
      lyricReflowAnimation = null;
    };
  }

  if (!reveal) return;
  lyricRevealAnimation?.cancel();
  lyricRevealAnimation = null;
  if (prefersReducedMotion) return;
  const animation = lyricsPanel.animate(
    [
      { opacity: 0, translate: '0 9px' },
      { opacity: 1, translate: '0 0' }
    ],
    {
      duration: 430,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both'
    }
  );
  lyricRevealAnimation = animation;
  animation.onfinish = () => {
    if (lyricRevealAnimation !== animation) return;
    animation.cancel();
    lyricRevealAnimation = null;
  };
}

function setSyncedLyrics(lyrics) {
  const layoutStartTop = hud.getBoundingClientRect().top;
  const wasVisible = !lyricsPanel.hidden;
  lyricLines = lyricsEnabled && lyrics?.synced && Array.isArray(lyrics.lines)
    ? buildLyricSweepTimeline(lyrics.lines, playbackClock.durationMs)
    : [];
  lyricIndex = -2;
  const willShow = lyricLines.length >= 2;
  setLyricSweepProgress(0);
  lyricsPanel.style.setProperty('--lyric-text-width', '1px');
  const firstText = lyricLines[0]?.text || '';
  const firstTranslation = lyricLines[0]?.translation || '';
  if (willShow) {
    lyricsPanel.hidden = false;
    setLyricText(firstText, {
      layoutStartTop,
      reveal: !wasVisible,
      translation: firstTranslation
    });
  } else {
    lyricsPanel.hidden = true;
    hud.classList.remove('has-multiline-lyrics');
    setLyricText(firstText, { translation: '', animateLayout: false });
    animateLyricLayoutChange(layoutStartTop);
  }
  lyricsPanel.dataset.turn = 'even';
}

function setLyricsEnabled(enabled, { persist = false } = {}) {
  lyricsEnabled = enabled !== false;
  lyricsEnabledToggle.setAttribute('aria-checked', String(lyricsEnabled));
  lyricsEnabledToggle.title = lyricsEnabled ? tr('lyrics.enabledOn') : tr('lyrics.enabledOff');
  lyricSweepToggle.disabled = !lyricsEnabled;
  lyricTranslationToggle.disabled = !lyricsEnabled;
  lyricDelayInput.disabled = !lyricsEnabled;
  lyricDelayReset.disabled = !lyricsEnabled || lyricDelayMs === 0;
  lyricSweepSetting.classList.toggle('is-disabled', !lyricsEnabled);
  lyricTranslationSetting.classList.toggle('is-disabled', !lyricsEnabled);
  lyricDelaySetting.classList.toggle('is-disabled', !lyricsEnabled);
  if (!lyricsEnabled) setSyncedLyrics(null);
  else if (currentMetadata?.lyrics) setSyncedLyrics(currentMetadata.lyrics);
  if (persist) window.genrePolice.setConfig({ lyricsEnabled }).catch(() => {});
}

function setLyricTranslationEnabled(enabled, { persist = false } = {}) {
  const layoutStartTop = hud.getBoundingClientRect().top;
  lyricTranslationEnabled = enabled !== false;
  lyricTranslationToggle.setAttribute('aria-checked', String(lyricTranslationEnabled));
  lyricTranslationToggle.title = lyricTranslationEnabled
    ? tr('lyrics.translationOn')
    : tr('lyrics.translationOff');
  const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
  if (visibleLyric || lyricCurrentBase.textContent) {
    setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
      translation: visibleLyric?.translation || lyricTranslation.dataset.text || '',
      layoutStartTop
    });
  }
  if (persist) window.genrePolice.setConfig({ lyricTranslationEnabled }).catch(() => {});
}

function setPosterCondensedEnglish(enabled, { persist = false } = {}) {
  posterCondensedEnglish = enabled !== false;
  document.body.dataset.posterEnglish = posterCondensedEnglish ? 'condensed' : 'regular';
  posterEnglishFontToggle.setAttribute('aria-checked', String(posterCondensedEnglish));
  posterEnglishFontToggle.title = posterCondensedEnglish
    ? tr('settings.posterCondensedEnglishOn')
    : tr('settings.posterCondensedEnglishOff');
  requestAnimationFrame(() => {
    updateTitleOverflow();
    const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
    if (visibleLyric || lyricCurrentBase.textContent) {
      setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
        translation: visibleLyric?.translation || lyricTranslation.dataset.text || '',
        animateLayout: false
      });
    }
  });
  if (persist) window.genrePolice.setConfig({ posterCondensedEnglish }).catch(() => {});
}

function setCapsuleCondensedEnglish(enabled, { persist = false } = {}) {
  capsuleCondensedEnglish = enabled === true;
  document.body.dataset.capsuleEnglish = capsuleCondensedEnglish ? 'condensed' : 'regular';
  capsuleEnglishFontToggle.setAttribute('aria-checked', String(capsuleCondensedEnglish));
  capsuleEnglishFontToggle.title = capsuleCondensedEnglish
    ? tr('settings.capsuleCondensedEnglishOn')
    : tr('settings.capsuleCondensedEnglishOff');
  requestAnimationFrame(() => {
    updateTitleOverflow();
    const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
    if (visibleLyric || lyricCurrentBase.textContent) {
      setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
        translation: visibleLyric?.translation || lyricTranslation.dataset.text || '',
        animateLayout: false
      });
    }
  });
  if (persist) window.genrePolice.setConfig({ capsuleCondensedEnglish }).catch(() => {});
}

function updateBackgroundStyle() {
  const themed = layoutMode === 'poster' ? posterThemedBackground : capsuleThemedBackground;
  document.body.dataset.backgroundStyle = themed ? 'themed' : 'adaptive';
  if (!themed) cancelBackdropCrossfade();
  capsuleThemedBackgroundToggle.setAttribute('aria-checked', String(capsuleThemedBackground));
  posterThemedBackgroundToggle.setAttribute('aria-checked', String(posterThemedBackground));
  capsuleThemedBackgroundToggle.title = capsuleThemedBackground
    ? tr('settings.capsuleThemedBackgroundOn')
    : tr('settings.capsuleThemedBackgroundOff');
  posterThemedBackgroundToggle.title = posterThemedBackground
    ? tr('settings.posterThemedBackgroundOn')
    : tr('settings.posterThemedBackgroundOff');
}

function setCapsuleThemedBackground(enabled, { persist = false } = {}) {
  capsuleThemedBackground = enabled === true;
  updateBackgroundStyle();
  if (persist) window.genrePolice.setConfig({ capsuleThemedBackground }).catch(() => {});
}

function setPosterThemedBackground(enabled, { persist = false } = {}) {
  posterThemedBackground = enabled !== false;
  updateBackgroundStyle();
  if (persist) window.genrePolice.setConfig({ posterThemedBackground }).catch(() => {});
}

function setOnlineGenreLookupEnabled(enabled, { persist = false } = {}) {
  onlineGenreLookupEnabled = enabled !== false;
  onlineLookupToggle.setAttribute('aria-checked', String(onlineGenreLookupEnabled));
  onlineLookupToggle.title = onlineGenreLookupEnabled ? tr('settings.onlineLookupOn') : tr('settings.onlineLookupOff');
  if (persist) window.genrePolice.setConfig({ onlineGenreLookupEnabled }).catch(() => {});
}

function setLaunchAtLoginEnabled(enabled, { persist = false, supported = true } = {}) {
  launchAtLoginEnabled = enabled === true;
  launchAtLoginToggle.setAttribute('aria-checked', String(launchAtLoginEnabled));
  launchAtLoginToggle.disabled = !supported;
  launchAtLoginToggle.title = supported
    ? (launchAtLoginEnabled ? tr('settings.launchAtLoginOn') : tr('settings.launchAtLoginOff'))
    : tr('settings.launchAtLoginUnsupported');
  if (persist && supported) {
    window.genrePolice.setConfig({ launchAtLogin: launchAtLoginEnabled }).then((result) => {
      if (typeof result?.launchAtLogin !== 'boolean') return;
      setLaunchAtLoginEnabled(result.launchAtLogin, {
        supported: result.launchAtLoginSupported !== false
      });
    }).catch(() => {
      setLaunchAtLoginEnabled(!launchAtLoginEnabled, { supported: true });
    });
  }
}

function setMotionMode(value, { persist = false } = {}) {
  motionMode = value === 'gentle' ? 'gentle' : 'standard';
  document.body.dataset.motionMode = motionMode;
  motionModeOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.motionMode === motionMode));
  });
  if (persist) window.genrePolice.setConfig({ motionMode }).catch(() => {});
}

function scheduleIdleDim() {
  window.clearTimeout(idleSettleTimer);
  idleSettleTimer = 0;
  document.body.classList.remove('idle-settled');
  if (idleBehavior !== 'dim' || document.body.dataset.playback !== 'idle' || document.body.classList.contains('settings-open')) return;
  idleSettleTimer = window.setTimeout(() => {
    idleSettleTimer = 0;
    if (idleBehavior === 'dim' && document.body.dataset.playback === 'idle' && !document.body.classList.contains('settings-open')) {
      document.body.classList.add('idle-settled');
    }
  }, 8000);
}

function wakeIdleVisual() {
  if (!document.body.classList.contains('idle-settled')) return;
  document.body.classList.remove('idle-settled');
  scheduleIdleDim();
}

function setIdleBehavior(value, { persist = false } = {}) {
  idleBehavior = ['keep', 'dim', 'hide'].includes(value) ? value : 'keep';
  document.body.dataset.idleBehavior = idleBehavior;
  idleBehaviorOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.idleBehavior === idleBehavior));
  });
  scheduleIdleDim();
  if (persist) window.genrePolice.setConfig({ idleBehavior }).catch(() => {});
}

function mediaSourceName(source) {
  const value = String(source || '').trim();
  if (!value) return tr('settings.mediaSourceAuto');
  const known = [
    [/spotify/i, 'Spotify'], [/applemusic|apple\.music/i, 'Apple Music'],
    [/cloudmusic|netease/i, 'NetEase Cloud Music'], [/qqmusic/i, 'QQ Music'],
    [/kugou/i, 'KuGou'], [/youtube/i, 'YouTube Music'],
    [/msedge/i, 'Microsoft Edge'], [/chrome/i, 'Google Chrome'], [/firefox/i, 'Firefox']
  ].find(([pattern]) => pattern.test(value));
  if (known) return known[1];
  const tail = value.split(/[!\\/]/).pop() || value;
  return tail.replace(/\.(exe|app)$/i, '').replace(/[._-]+/g, ' ').trim() || value;
}

function renderMediaSourceSettings() {
  const sources = [...new Set([
    ...availableMediaSources,
    preferredMediaSource,
    ...ignoredMediaSources
  ].filter(Boolean))].sort((left, right) => mediaSourceName(left).localeCompare(mediaSourceName(right)));
  const selectedSource = ignoredMediaSources.includes(preferredMediaSource) ? '' : preferredMediaSource;
  mediaSourceValue.textContent = mediaSourceName(selectedSource);
  mediaSourceButton.title = selectedSource || tr('settings.mediaSourceAuto');
  mediaSourceMenu.replaceChildren();
  for (const source of ['', ...sources]) {
    const option = document.createElement('button');
    const ignored = Boolean(source) && ignoredMediaSources.includes(source);
    option.type = 'button';
    option.className = 'media-source-option';
    option.dataset.source = source;
    option.textContent = mediaSourceName(source);
    option.title = source || tr('settings.mediaSourceAuto');
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(source === selectedSource));
    option.setAttribute('aria-disabled', String(ignored));
    option.disabled = ignored;
    mediaSourceMenu.append(option);
  }
  mediaSourceIgnoreList.replaceChildren();
  if (!sources.length) {
    const empty = document.createElement('small');
    empty.textContent = tr('settings.noDetectedPlayers');
    mediaSourceIgnoreList.append(empty);
  } else {
    for (const source of sources) {
      const row = document.createElement('div');
      row.className = 'media-source-ignore-item';
      const label = document.createElement('span');
      label.textContent = mediaSourceName(source);
      label.title = source;
      const button = document.createElement('button');
      const ignored = ignoredMediaSources.includes(source);
      button.type = 'button';
      button.className = 'media-source-ignore-toggle';
      button.dataset.source = source;
      button.setAttribute('aria-pressed', String(ignored));
      button.textContent = ignored ? tr('actions.restore') : tr('actions.ignore');
      row.append(label, button);
      mediaSourceIgnoreList.append(row);
    }
  }
  updateDiagnosticsUi();
}

function setMediaSources(payload = {}) {
  availableMediaSources = Array.isArray(payload.sources) ? payload.sources.filter(Boolean) : availableMediaSources;
  if (typeof payload.currentSource === 'string') currentMediaSource = payload.currentSource;
  if (typeof payload.preferredSource === 'string') preferredMediaSource = payload.preferredSource;
  if (Array.isArray(payload.ignoredSources)) ignoredMediaSources = payload.ignoredSources.filter(Boolean);
  renderMediaSourceSettings();
}

function mediaSourceOptions() {
  return [...mediaSourceMenu.querySelectorAll('.media-source-option:not(:disabled)')];
}

function setMediaSourceMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
  }
  mediaSourceMenu.hidden = !nextOpen;
  mediaSourceButton.setAttribute('aria-expanded', String(nextOpen));
  if (!nextOpen || !focus) return;
  const options = mediaSourceOptions();
  const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0];
  selected?.focus();
}

function chooseMediaSource(source) {
  preferredMediaSource = String(source || '');
  setMediaSourceMenuOpen(false);
  window.genrePolice.setConfig({ preferredMediaSource }).catch(() => {});
  renderMediaSourceSettings();
  mediaSourceButton.focus();
}

function audioDiagnosticLabel() {
  if (audio.status === 'live') return tr('diagnostics.audioLive');
  if (audio.status === 'metadata-only') return tr('diagnostics.audioFallback');
  if (audio.status === 'starting') return tr('diagnostics.starting');
  return tr('diagnostics.unavailable');
}

function rhythmDiagnosticLabel() {
  return ['ready', 'rhythm'].includes(latestRhythmModelState?.type)
    ? tr('diagnostics.rhythmReady')
    : tr('diagnostics.rhythmFallback');
}

function updateDiagnosticsUi() {
  diagnosticsPlayer.textContent = currentMediaSource ? mediaSourceName(currentMediaSource) : tr('diagnostics.none');
  diagnosticsPlayer.title = currentMediaSource;
  diagnosticsAudio.textContent = audioDiagnosticLabel();
  diagnosticsRhythm.textContent = rhythmDiagnosticLabel();
  diagnosticsGenre.textContent = currentMetadata?.genreSource || tr('diagnostics.none');
  diagnosticsLyrics.textContent = currentMetadata?.lyrics?.source || tr('diagnostics.none');
}

function setLyricSweepEnabled(enabled, { persist = false } = {}) {
  lyricSweepEnabled = enabled !== false;
  lyricsPanel.dataset.sweep = lyricSweepEnabled ? 'on' : 'off';
  lyricSweepToggle.setAttribute('aria-checked', String(lyricSweepEnabled));
  lyricSweepToggle.title = lyricSweepEnabled ? tr('lyrics.sweepOn') : tr('lyrics.sweepOff');
  if (!lyricSweepEnabled) {
    setLyricSweepProgress(1);
    updateLyricUnitMotion(-1, -1);
  }
  if (persist) window.genrePolice.setConfig({ lyricSweepEnabled }).catch(() => {});
}

function formatLyricDelay(value) {
  const normalized = normalizeLyricDelayMs(value);
  if (normalized === 0) return '0 ms';
  return `${normalized > 0 ? '+' : '\u2212'}${Math.abs(normalized)} ms`;
}

function setLyricDelay(value, { persist = false } = {}) {
  lyricDelayMs = normalizeLyricDelayMs(value);
  lyricDelayInput.value = String(lyricDelayMs);
  lyricDelayValue.value = formatLyricDelay(lyricDelayMs);
  lyricDelayValue.textContent = lyricDelayValue.value;
  lyricDelayInput.setAttribute('aria-valuetext', lyricDelayValue.value);
  const percentage = ((lyricDelayMs - LYRIC_DELAY_MIN_MS) / (LYRIC_DELAY_MAX_MS - LYRIC_DELAY_MIN_MS)) * 100;
  lyricDelayInput.style.setProperty('--delay-start', `${Math.min(50, percentage).toFixed(2)}%`);
  lyricDelayInput.style.setProperty('--delay-end', `${Math.max(50, percentage).toFixed(2)}%`);
  lyricDelayReset.disabled = !lyricsEnabled || lyricDelayMs === 0;
  if (persist) window.genrePolice.setConfig({ lyricDelayMs }).catch(() => {});
}

function setLyricText(text, {
  layoutStartTop = null,
  reveal = false,
  translation = '',
  animateLayout = true
} = {}) {
  const reflowStartTop = animateLayout
    ? (Number.isFinite(layoutStartTop) ? layoutStartTop : hud.getBoundingClientRect().top)
    : null;
  const trackContext = `${currentDisplayContent?.title || ''} ${currentDisplayContent?.artist || ''}`;
  lyricCurrentBase.parentElement.lang = readingLanguageFor(text, trackContext);
  lyricCurrentBase.parentElement.dataset.text = text;
  lyricCurrentBase.replaceChildren();
  lyricCurrentFillContent.replaceChildren();
  lyricTranslationBase.replaceChildren();
  lyricTranslationFillContent.replaceChildren();
  lyricAnimatedUnits = [];
  activeLyricMotionUnit = null;
  activePoliceMotionUnit = null;
  const baseFragment = document.createDocumentFragment();
  const fillFragment = document.createDocumentFragment();
  for (const unit of buildLyricUnitTimeline(text)) {
    const span = document.createElement('span');
    const baseSpan = document.createElement('span');
    span.textContent = unit.text;
    baseSpan.textContent = unit.text;
    if (unit.space) {
      span.className = 'lyric-space';
      baseSpan.className = 'lyric-space';
    } else {
      span.className = 'lyric-unit';
      baseSpan.className = 'lyric-base-unit';
      const normalizedUnit = unit.text.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
      const isPoliceWord = document.body.dataset.easterEgg === 'genre-police'
        && (normalizedUnit === 'genre' || normalizedUnit === 'police');
      if (isPoliceWord) {
        span.classList.add('is-police-word');
        baseSpan.classList.add('is-police-word');
      }
      lyricAnimatedUnits.push({ element: span, baseElement: baseSpan, isPoliceWord, ...unit });
    }
    baseFragment.append(baseSpan);
    fillFragment.append(span);
  }
  lyricCurrentBase.append(baseFragment);
  lyricCurrentFillContent.append(fillFragment);
  const rawTranslation = String(translation || '').trim();
  const showTranslation = lyricTranslationEnabled
    && uiLanguage === 'zh-CN'
    && Boolean(rawTranslation);
  const translationText = showTranslation ? rawTranslation : '';
  lyricTranslation.dataset.text = rawTranslation;
  if (showTranslation) {
    lyricTranslationBase.textContent = translationText;
    // A translation is a subordinate reading aid, not a second vocal track.
    // It follows the original line's measured glyph progression instead of a
    // separately estimated word/character timeline.
    lyricTranslationFillContent.textContent = translationText;
  }
  lyricTranslation.hidden = !showTranslation;
  lyricsPanel.dataset.translation = String(showTranslation);
  hud.dataset.copyLayout = lyricsPanel.hidden
    ? 'none'
    : showTranslation ? 'translated' : 'original';
  lyricsPanel.dataset.fit = 'normal';
  lyricsPanel.dataset.multiline = 'false';
  // Measure the unwrapped sentence first. Up to roughly 8% overflow is
  // absorbed by a subtle optical-size reduction; both shipped layouts keep
  // longer lyrics to one stable row and truncate at the real right boundary.
  lyricCurrentBase.style.whiteSpace = 'nowrap';
  const naturalWidth = lyricCurrentBase.scrollWidth;
  lyricCurrentBase.style.removeProperty('white-space');
  const availableWidth = Math.max(1, lyricCurrentBase.clientWidth);
  const compactFit = naturalWidth > availableWidth && naturalWidth <= availableWidth * 1.08;
  if (compactFit) {
    lyricsPanel.dataset.fit = 'compact';
  }
  const singleLineLyrics = ['side', 'poster'].includes(document.body.dataset.layout);
  const overflowing = Boolean(text) && naturalWidth > availableWidth * 1.08;
  lyricsPanel.dataset.overflowing = String(singleLineLyrics && overflowing);
  const multiline = !singleLineLyrics && Boolean(text) && lyricCurrentBase.scrollHeight > 32;
  lyricsPanel.dataset.multiline = String(multiline);
  hud.classList.toggle('has-multiline-lyrics', multiline);
  // The base layer is a block, so its scrollWidth is the full 448 px column
  // even when the rendered lyric is only 120 px wide. Driving the mask from
  // that value made the original finish far earlier than its translation.
  // The final rendered unit gives us the real right edge of a single line.
  // Measure on the unmasked base copy. The fill copy is constrained by the
  // previous frame's CSS width while this function is rebuilding the line,
  // which can temporarily wrap every glyph and report only one character.
  const finalRenderedUnit = lyricAnimatedUnits.at(-1)?.baseElement;
  const firstRenderedUnit = lyricAnimatedUnits.at(0)?.baseElement;
  const lyricInkStart = firstRenderedUnit?.offsetLeft || 0;
  lyricTextWidth = lyricLineInkWidth({
    firstLeft: lyricInkStart,
    lastLeft: finalRenderedUnit?.offsetLeft,
    lastWidth: finalRenderedUnit?.offsetWidth || lyricCurrentBase.scrollWidth,
    containerWidth: lyricCurrentBase.clientWidth,
    multiline
  });
  lyricsPanel.style.setProperty('--lyric-text-width', `${Math.ceil(lyricTextWidth)}px`);
  // The luminous frontier should occupy the same fraction of each rendered
  // line. A fixed 14 px feather consumed twice as much time on a short Chinese
  // translation and made it look late even on the same clock percentage.
  lyricFadeWidth = clamp(lyricTextWidth * 0.036, 7, 14);
  lyricsPanel.style.setProperty('--lyric-fade-px', `${lyricFadeWidth.toFixed(2)}px`);
  // Align motion to the rendered glyph positions rather than estimating from
  // character counts. The lift now begins exactly as the reveal edge reaches
  // a word or CJK character.
  for (const unit of lyricAnimatedUnits) {
    if (!multiline) {
      const relativeLeft = Math.max(0, unit.baseElement.offsetLeft - lyricInkStart);
      unit.start = Math.max(0, Math.min(1, relativeLeft / lyricTextWidth));
      unit.end = Math.max(unit.start + 0.001, Math.min(1, (relativeLeft + unit.baseElement.offsetWidth) / lyricTextWidth));
    }
  }
  lyricTranslationWidth = Math.max(
    1,
    Math.min(lyricTranslationBase.scrollWidth, lyricTranslation.clientWidth)
  );
  lyricsPanel.style.setProperty('--lyric-translation-width', `${Math.ceil(lyricTranslationWidth)}px`);
  lyricTranslationFadeWidth = clamp(lyricTranslationWidth * 0.036, 7, 14);
  lyricsPanel.style.setProperty('--lyric-translation-fade-px', `${lyricTranslationFadeWidth.toFixed(2)}px`);
  if (animateLayout) animateLyricLayoutChange(reflowStartTop, { reveal });
}

function setLyricSweepProgress(value) {
  const normalized = clamp(Number(value) || 0);
  lyricsPanel.classList.toggle('sweep-complete', normalized >= 0.998);
  const revealDistance = (width, fadeWidth, progress = normalized) => progress >= 0.999
    ? width + fadeWidth
    : width * progress;
  lyricsPanel.style.setProperty('--lyric-progress', `${(normalized * 100).toFixed(2)}%`);
  // Both lines use their actual rendered ink widths and the same normalized
  // provider-clock progress, so their left-to-right wipes finish together.
  lyricsPanel.style.setProperty('--lyric-reveal-px', `${revealDistance(lyricTextWidth, lyricFadeWidth).toFixed(2)}px`);
  lyricsPanel.style.setProperty('--lyric-translation-reveal-px', `${revealDistance(lyricTranslationWidth, lyricTranslationFadeWidth).toFixed(2)}px`);
}

function updateTitleOverflow() {
  const text = titleLabel.querySelector('.title-scroll-text');
  if (!text) return;
  const distance = Math.max(0, text.scrollWidth - titleLabel.clientWidth);
  titleLabel.classList.toggle('is-overflowing', distance > 3);
  titleLabel.style.setProperty('--title-pan-distance', `${Math.ceil(distance)}px`);
  titleLabel.style.setProperty('--title-pan-duration', `${Math.max(6.5, Math.min(16, 6.5 + distance / 24)).toFixed(2)}s`);
}

function setTrackTitle(value) {
  const text = String(value || '');
  const span = document.createElement('span');
  span.className = 'title-scroll-text';
  span.textContent = text;
  titleLabel.replaceChildren(span);
  titleLabel.classList.remove('is-overflowing');
  requestAnimationFrame(updateTitleOverflow);
  document.fonts?.ready.then(() => requestAnimationFrame(updateTitleOverflow));
  return text;
}

function updateLyricUnitMotion(progress, policeProgress = progress) {
  const mode = currentTheme.mode || 'electronic';
  const lead = 2.5 / lyricTextWidth;
  const current = lyricAnimatedUnits.find((unit) => progress >= unit.start - lead && progress <= unit.end) || null;
  if (activeLyricMotionUnit !== current) {
    if (activeLyricMotionUnit) {
      activeLyricMotionUnit.element.classList.remove('is-vocal-active');
      activeLyricMotionUnit.element.removeAttribute('style');
    }
    activeLyricMotionUnit = current;
  }

  // The lyric fill has a small transition lead, but the police-word pop
  // follows the unshifted playback clock. Keeping separate cursors prevents
  // the short first word, "Genre", from being skipped by the look-ahead.
  const policeCurrent = policeProgress < 0
    ? null
    : lyricAnimatedUnits.find((unit) => unit.isPoliceWord && policeProgress >= unit.start - lead && policeProgress <= unit.end) || null;
  if (activePoliceMotionUnit !== policeCurrent) {
    if (activePoliceMotionUnit) {
      activePoliceMotionUnit.baseElement.classList.remove('is-police-hit');
      activePoliceMotionUnit.baseElement.classList.add('is-police-passed');
    }
    activePoliceMotionUnit = policeCurrent;
    if (policeCurrent) {
      policeCurrent.baseElement.classList.remove('is-police-passed', 'is-police-hit');
      void policeCurrent.baseElement.offsetWidth;
      policeCurrent.baseElement.classList.add('is-police-hit');
    }
  }
  for (const unit of lyricAnimatedUnits) {
    if (!unit.isPoliceWord || policeProgress <= unit.end || unit === policeCurrent) continue;
    unit.baseElement.classList.remove('is-police-hit');
    unit.baseElement.classList.add('is-police-passed');
  }
  const applyUnitMotion = (unit) => {
    if (!unit) return;
    const motion = lyricUnitMotion(progress, { start: unit.start - lead, end: unit.end }, mode);
    unit.element.style.setProperty('--unit-y', `${motion.y.toFixed(3)}px`);
    unit.element.style.setProperty('--unit-scale-x', motion.scaleX.toFixed(4));
    unit.element.style.setProperty('--unit-scale-y', motion.scaleY.toFixed(4));
    unit.element.style.setProperty('--unit-brightness', motion.brightness.toFixed(3));
    unit.element.style.setProperty('--unit-glow', `${motion.glow.toFixed(2)}px`);
    unit.element.classList.add('is-vocal-active');
  };
  applyUnitMotion(current);
}

function renderSyncedLyrics(time) {
  if (lyricsPanel.hidden || !lyricLines.length) return;
  const playbackPosition = applyLyricDelay(playbackPositionAt(time), lyricDelayMs);
  let low = 0;
  let high = lyricLines.length - 1;
  let active = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const precedingLead = middle > 0
      ? Number(lyricLines[middle - 1].visualLeadMs) || LYRIC_LOOKAHEAD_MS
      : LYRIC_LOOKAHEAD_MS;
    const transitionAt = lyricLines[middle].atMs - precedingLead;
    if (transitionAt <= playbackPosition) {
      active = middle;
      low = middle + 1;
    } else high = middle - 1;
  }

  if (active !== lyricIndex) {
    lyricIndex = active;
    const currentLine = active >= 0 ? lyricLines[active] : lyricLines[0] || null;
    setLyricText(currentLine?.text || '', { translation: currentLine?.translation || '' });
    lyricsPanel.dataset.turn = active % 2 ? 'odd' : 'even';
    lyricsPanel.classList.remove('line-change');
    void lyricsPanel.offsetWidth;
    if (active >= 0) lyricsPanel.classList.add('line-change');
  }

  if (active < 0) {
    setLyricSweepProgress(lyricSweepEnabled ? 0 : 1);
    // The first line is preloaded before its timestamp. Keep every special
    // word dormant until playback actually enters that line.
    updateLyricUnitMotion(-1);
    return;
  }
  const start = lyricLines[active].atMs;
  const sweepDuration = lyricLines[active].sweepDurationMs
    || Math.max(800, (lyricLines[active + 1]?.atMs || start + 3200) - start);
  const visualLead = Number(lyricLines[active].visualLeadMs) || LYRIC_LOOKAHEAD_MS;
  const lineProgress = Math.max(0, Math.min(1, (playbackPosition + visualLead - start) / Math.max(800, sweepDuration)));
  setLyricSweepProgress(lyricSweepEnabled ? lineProgress : 1);
  // The line itself may preload for a smooth entrance, but word effects must
  // stay dormant until the line's real timestamp. This is especially visible
  // when the first words are the Genre Police easter egg.
  const policeProgress = playbackPosition < start
    ? -1
    : Math.max(0, Math.min(1, (playbackPosition - start) / Math.max(800, sweepDuration)));
  updateLyricUnitMotion(lyricSweepEnabled ? lineProgress : -1, policeProgress);
}

function applyTheme(theme) {
  currentTheme = { ...fallbackTheme, ...theme, id: theme?.id || 'unknown' };
  audio.setGenreTheme(currentTheme);
  const root = document.documentElement;
  const mode = currentTheme.mode || 'electronic';
  const inkTint = ['hardcore', 'hardstyle', 'metal', 'dubstep', 'trap', 'phonk'].includes(mode) ? 19 : 14;
  const defaultInk = `color-mix(in srgb, ${currentTheme.hot} ${100 - inkTint}%, ${currentTheme.accent2} ${inkTint}%)`;
  const defaultInk2 = `color-mix(in srgb, ${currentTheme.hot} 91%, ${currentTheme.accent} 9%)`;
  const defaultInkEdge = `color-mix(in srgb, ${currentTheme.accent2} 62%, ${currentTheme.accent} 38%)`;
  root.style.setProperty('--accent', currentTheme.accent);
  root.style.setProperty('--accent-2', currentTheme.accent2);
  root.style.setProperty('--hot', currentTheme.hot);
  root.style.setProperty('--genre-ink', currentTheme.genreInk || defaultInk);
  root.style.setProperty('--genre-ink-2', currentTheme.genreInk2 || defaultInk2);
  root.style.setProperty('--genre-ink-edge', currentTheme.genreInkEdge || defaultInkEdge);
  root.style.setProperty('--genre-font', currentTheme.font);
  root.style.setProperty('--genre-weight', String(currentTheme.fontWeight || 700));
  root.style.setProperty('--genre-letter-spacing', currentTheme.letterSpacing || '-0.5px');
  const textFx = clamp(currentTheme.textFx ?? 1, 0.45, 1.15);
  root.style.setProperty('--genre-ink-alpha', `${Math.min(100, 70 + textFx * 30).toFixed(1)}%`);
  root.style.setProperty('--genre-hot-alpha', `${Math.min(68, textFx * 55).toFixed(1)}%`);
  root.style.setProperty('--genre-accent-alpha', `${Math.min(86, textFx * 74).toFixed(1)}%`);
  document.body.dataset.family = currentTheme.family;
  document.body.dataset.mode = currentTheme.mode || 'electronic';
  document.body.dataset.genre = currentTheme.id;
  setBackdropIdentity(themedBackdrop, currentTheme);
  visual.setTheme(currentTheme);
}

function setBackdropIdentity(element, theme, { freezeColors = false } = {}) {
  if (!element) return;
  element.dataset.family = theme?.family || 'unknown';
  element.dataset.mode = theme?.mode || 'electronic';
  element.dataset.genre = theme?.id || 'unknown';
  for (const property of ['--accent', '--accent-2', '--hot']) element.style.removeProperty(property);
  if (!freezeColors) return;
  element.style.setProperty('--accent', theme?.accent || fallbackTheme.accent);
  element.style.setProperty('--accent-2', theme?.accent2 || fallbackTheme.accent2);
  element.style.setProperty('--hot', theme?.hot || fallbackTheme.hot);
}

function cancelBackdropCrossfade() {
  backdropCrossfadeSerial += 1;
  for (const animation of backdropCrossfadeAnimations) animation.cancel();
  backdropCrossfadeAnimations = [];
  themedBackdrop?.style.removeProperty('opacity');
  themedBackdrop?.style.removeProperty('visibility');
  if (previousThemedBackdrop) {
    previousThemedBackdrop.style.opacity = '0';
    previousThemedBackdrop.style.visibility = 'hidden';
    for (const property of ['--accent', '--accent-2', '--hot']) {
      previousThemedBackdrop.style.removeProperty(property);
    }
  }
}

async function applyThemeWithBackdropTransition(theme) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldCrossfade = document.body.dataset.backgroundStyle === 'themed'
    && !reducedMotion
    && currentTheme?.id !== (theme?.id || 'unknown');
  if (!shouldCrossfade) {
    applyTheme(theme);
    return;
  }

  const outgoingTheme = currentTheme;
  cancelBackdropCrossfade();
  const serial = ++backdropCrossfadeSerial;
  setBackdropIdentity(previousThemedBackdrop, outgoingTheme, { freezeColors: true });
  previousThemedBackdrop.style.opacity = '1';
  previousThemedBackdrop.style.visibility = 'visible';
  applyTheme(theme);
  themedBackdrop.style.visibility = 'visible';

  // Both stocks stay below the canvas and HUD. A browser View Transition puts
  // named snapshots in the top layer, which can temporarily cover foreground
  // content on an opaque capsule; explicit backdrop layers avoid that.
  const timing = { duration: 760, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' };
  const outgoing = previousThemedBackdrop.animate([{ opacity: 1 }, { opacity: 0 }], timing);
  const incoming = themedBackdrop.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  backdropCrossfadeAnimations = [outgoing, incoming];
  Promise.allSettled(backdropCrossfadeAnimations.map((animation) => animation.finished)).then(() => {
    if (serial !== backdropCrossfadeSerial) return;
    backdropCrossfadeAnimations = [];
    themedBackdrop.style.removeProperty('opacity');
    themedBackdrop.style.removeProperty('visibility');
    previousThemedBackdrop.style.opacity = '0';
    previousThemedBackdrop.style.visibility = 'hidden';
    for (const property of ['--accent', '--accent-2', '--hot']) {
      previousThemedBackdrop.style.removeProperty(property);
    }
  });
}

let genreFitFrame = 0;

function fitGenreLabel() {
  // Start from the genre family's intended type size, then shrink only when
  // the rendered font would overflow. Measuring scrollWidth keeps this exact
  // for wide display faces instead of guessing from the character count.
  genreLabel.style.removeProperty('font-size');
  const availableWidth = genreLabel.clientWidth;
  const renderedWidth = genreLabel.scrollWidth;
  if (!availableWidth || !renderedWidth) return;

  const naturalSize = Number.parseFloat(getComputedStyle(genreLabel).fontSize) || 58;
  // Leave room for the live scale/glow so a fitted label does not appear to
  // leave the capsule on an impact frame.
  const safeWidth = availableWidth * 0.94;
  if (renderedWidth > safeWidth) {
    const fittedSize = Math.max(25, naturalSize * safeWidth / renderedWidth);
    genreLabel.style.fontSize = `${fittedSize.toFixed(2)}px`;
  }
}

function scheduleGenreFit() {
  cancelAnimationFrame(genreFitFrame);
  genreFitFrame = requestAnimationFrame(() => {
    fitGenreLabel();
    // Local webfonts normally resolve before this frame, but repeat once when
    // the face is ready so a fallback-font measurement can never clip a title.
    document.fonts?.ready.then(() => {
      if (genreLabel.isConnected) fitGenreLabel();
    });
  });
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = tr(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = tr(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    element.setAttribute('aria-label', tr(element.dataset.i18nAria));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = tr(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-main]').forEach((element) => {
    element.textContent = trMain(element.dataset.i18nMain);
  });
}

function localizedPlaybackStatus(playing, status = audio.status) {
  if (!playing) return trMain('status.paused');
  if (status === 'live') return trMain('status.liveAudio');
  if (status === 'metadata-only') return trMain('status.metadataOnly');
  if (status === 'scan') return trMain('status.audioScan');
  return trMain('status.metadata');
}

function sourceTextFor(content) {
  if (content.genrePoliceEasterEgg) return trMain('hud.easterEggActive');
  if (content.sourceKind === 'querying') return trMain('status.queryingSources');
  if (content.sourceKind === 'local') return trMain('status.local');
  return String(content.source || '');
}

function readingLanguageFor(text, context = '') {
  const value = String(text || '');
  const surroundingText = String(context || '');
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(value)) return 'ko';
  if (/[\u3040-\u30ff\u31f0-\u31ff]/u.test(value)) return 'ja';
  if (/\p{Script=Han}/u.test(value)) {
    const japaneseTheme = ['j-pop', 'anime', 'vocaloid'].includes(currentTheme.id);
    const japaneseContext = /[\u3040-\u30ff\u31f0-\u31ff]/u.test(surroundingText);
    return uiLanguage === 'ja' || japaneseTheme || japaneseContext ? 'ja' : 'zh-CN';
  }
  return 'en';
}

function renderLocalizedHud(content = currentDisplayContent) {
  if (!content) return;
  parentGenre.textContent = content.genrePoliceEasterEgg
    ? trMain('hud.specialUnit')
    : content.placeholder
      ? trMain('hud.analysing')
      : content.theme.parent || trMain('hud.genrePolice');
  const nextGenreText = content.resolving
    ? trMain('hud.identifying')
    : content.placeholder
      ? trMain('hud.unknownSignal')
      : content.theme.label;
  const genreFace = genreLabel.querySelector('#genre-face');
  if (genreFace) genreFace.textContent = nextGenreText;
  else genreLabel.textContent = nextGenreText;
  genreLabel.dataset.state = content.resolving
    ? 'identifying'
    : content.placeholder
      ? 'unknown'
      : 'genre';
  genreLabel.dataset.text = nextGenreText;
  scheduleGenreFit();
  const titleText = setTrackTitle(content.placeholderTitle ? trMain('hud.waitingTitle') : content.title);
  artistLabel.textContent = content.placeholderArtist ? trMain('hud.waitingArtist') : content.artist;
  const readingContext = `${content.title || ''} ${content.artist || ''}`;
  titleLabel.lang = readingLanguageFor(titleText, readingContext);
  artistLabel.lang = readingLanguageFor(artistLabel.textContent, readingContext);
  genreSource.textContent = sourceTextFor(content).toUpperCase();
  genreSource.removeAttribute('title');
  genreSource.tabIndex = -1;
  genreSource.setAttribute('role', 'status');
  caseId.textContent = content.genrePoliceEasterEgg
    ? trMain('hud.specialCase')
    : content.resolving ? trMain('hud.checkingDatabases') : trMain('hud.classified');
  playState.textContent = localizedPlaybackStatus(content.playing);
}

function applyLanguage(value, { persist = false } = {}) {
  const lyricLayoutStartTop = hud.getBoundingClientRect().top;
  uiLanguage = i18n?.normalizeLocale(value) || 'zh-CN';
  document.documentElement.lang = uiLanguage;
  languageValue.textContent = LANGUAGE_NAMES[uiLanguage] || LANGUAGE_NAMES['zh-CN'];
  languageOptions.forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.language === uiLanguage));
  });
  applyStaticTranslations();
  renderMediaSourceSettings();
  updateDiagnosticsUi();
  updateLayoutToggleButton();
  setPlayPauseIcon(playPauseButton.classList.contains('is-playing'));
  lyricSweepToggle.title = lyricSweepEnabled ? tr('lyrics.sweepOn') : tr('lyrics.sweepOff');
  lyricsEnabledToggle.title = lyricsEnabled ? tr('lyrics.enabledOn') : tr('lyrics.enabledOff');
  lyricTranslationToggle.title = lyricTranslationEnabled
    ? tr('lyrics.translationOn')
    : tr('lyrics.translationOff');
  posterEnglishFontToggle.title = posterCondensedEnglish
    ? tr('settings.posterCondensedEnglishOn')
    : tr('settings.posterCondensedEnglishOff');
  capsuleEnglishFontToggle.title = capsuleCondensedEnglish
    ? tr('settings.capsuleCondensedEnglishOn')
    : tr('settings.capsuleCondensedEnglishOff');
  updateBackgroundStyle();
  onlineLookupToggle.title = onlineGenreLookupEnabled ? tr('settings.onlineLookupOn') : tr('settings.onlineLookupOff');
  launchAtLoginToggle.title = launchAtLoginToggle.disabled
    ? tr('settings.launchAtLoginUnsupported')
    : launchAtLoginEnabled ? tr('settings.launchAtLoginOn') : tr('settings.launchAtLoginOff');
  renderLocalizedHud();
  const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
  setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
    translation: visibleLyric?.translation || '',
    animateLayout: false
  });
  animateLyricLayoutChange(lyricLayoutStartTop);
  updateGenreCorrectionUi();
  if (persist) window.genrePolice.setConfig({ language: uiLanguage }).catch(() => {});
}

function applyUiScale(value) {
  const requested = Number(value);
  const scale = UI_SCALES.includes(requested) ? requested : DEFAULT_UI_SCALE;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  uiScaleValue.textContent = `${Math.round(scale / UI_SCALE_BASE * 100)}%`;
  uiScaleOptions.forEach((option) => {
    option.setAttribute('aria-selected', String(Number(option.dataset.scale) === scale));
  });
  requestAnimationFrame(updateSettingsScrollbar);
}

function applyLayoutMode(value) {
  layoutMode = value === 'poster' || value === 'stage' ? 'poster' : 'side';
  document.body.dataset.layout = layoutMode;
  updateBackgroundStyle();
  const posterLayout = layoutMode === 'poster';
  capsuleBackgroundSetting.hidden = posterLayout;
  capsuleEnglishFontSetting.hidden = posterLayout;
  posterBackgroundSetting.hidden = !posterLayout;
  posterEnglishFontSetting.hidden = !posterLayout;
  updateLayoutToggleButton();
  layoutModeOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.layoutMode === layoutMode));
  });
  requestAnimationFrame(() => {
    visual.resize();
    scheduleGenreFit();
    updateTitleOverflow();
    const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
    if (visibleLyric || lyricCurrentBase.textContent) {
      setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
        translation: visibleLyric?.translation || lyricTranslationBase.textContent || '',
        animateLayout: false
      });
    }
    updateSettingsScrollbar();
  });
}

function updateLayoutToggleButton() {
  const key = layoutMode === 'poster' ? 'controls.switchToCapsule' : 'controls.switchToPoster';
  const label = tr(key);
  layoutToggleButton.title = label;
  layoutToggleButton.setAttribute('aria-label', label);
}

async function chooseLayoutMode(value) {
  const requested = value === 'poster' ? 'poster' : 'side';
  applyLayoutMode(requested);
  const result = await window.genrePolice.setLayoutMode(requested);
  applyLayoutMode(result?.mode);
}

function setScaleMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
  }
  uiScaleMenu.hidden = !nextOpen;
  uiScaleButton.setAttribute('aria-expanded', String(nextOpen));
  if (!nextOpen) return;
  const selected = uiScaleOptions.find((option) => option.getAttribute('aria-selected') === 'true') || uiScaleOptions[0];
  if (focus) selected?.focus();
}

function setLanguageMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setMediaSourceMenuOpen(false);
  }
  languageMenu.hidden = !nextOpen;
  languageButton.setAttribute('aria-expanded', String(nextOpen));
  if (!nextOpen) return;
  const selected = languageOptions.find((option) => option.getAttribute('aria-selected') === 'true') || languageOptions[0];
  if (focus) selected?.focus();
}

function chooseLanguage(value) {
  setLanguageMenuOpen(false);
  applyLanguage(value, { persist: true });
  languageButton.focus();
}

async function chooseUiScale(value) {
  setScaleMenuOpen(false);
  const result = await window.genrePolice.setUiScale(Number(value));
  applyUiScale(result?.scale);
  uiScaleButton.focus();
}

function setPlaybackVisualState(playing) {
  const active = Boolean(playing || demoTheme);
  document.body.dataset.playback = active ? 'active' : 'idle';
  scheduleIdleDim();
  if (!optimisticPlaybackIcon) setPlayPauseIcon(active);
  if (!active) {
    genreVelocity = 0;
    genreScale = 1;
    genreLiftValue = 0;
  }
}

function clearControlsTimer() {
  window.clearTimeout(controlsHideTimer);
  controlsHideTimer = 0;
}

function hideControls(delay = 0) {
  clearControlsTimer();
  controlsHideTimer = window.setTimeout(() => {
    if (!document.body.classList.contains('settings-open')) document.body.classList.remove('pointer-active');
  }, delay);
}

function showControls() {
  if (!document.body.classList.contains('interactive')) return;
  wakeIdleVisual();
  document.body.classList.add('pointer-active');
  if (!document.body.classList.contains('settings-open')) hideControls(1650);
}

function closeSettings() {
  setScaleMenuOpen(false);
  setLanguageMenuOpen(false);
  setMediaSourceMenuOpen(false);
  closeGenreCorrectionSuggestions();
  settings.hidden = true;
  document.body.classList.remove('settings-open');
  settingsButton.setAttribute('aria-expanded', 'false');
  showControls();
  scheduleIdleDim();
}

function currentCorrectionOption() {
  const selectedId = String(genreCorrectionInput.dataset.genreId || '');
  if (selectedId) return genreOptions.find((option) => option.id === selectedId) || null;
  const value = genreCorrectionInput.value.trim().toLocaleLowerCase();
  return genreOptions.find((option) => option.id.toLocaleLowerCase() === value
    || option.label.toLocaleLowerCase() === value) || null;
}

function closeGenreCorrectionSuggestions() {
  genreCorrectionSuggestions.hidden = true;
  genreCorrectionInput.setAttribute('aria-expanded', 'false');
}

function chooseGenreCorrectionOption(option) {
  genreCorrectionInput.value = option.label;
  genreCorrectionInput.dataset.genreId = option.id;
  closeGenreCorrectionSuggestions();
  genreCorrectionSave.focus();
}

function renderGenreCorrectionSuggestions(query = '') {
  const needle = String(query || '').trim().toLocaleLowerCase();
  const ranked = genreOptions
    .filter((option) => !needle
      || option.label.toLocaleLowerCase().includes(needle)
      || option.id.toLocaleLowerCase().includes(needle))
    .sort((left, right) => {
      const leftStarts = left.label.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
      const rightStarts = right.label.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
      return leftStarts - rightStarts || left.label.localeCompare(right.label);
    });
  genreCorrectionSuggestions.replaceChildren();
  for (const option of ranked) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    const label = document.createElement('span');
    label.textContent = option.label;
    const parent = document.createElement('small');
    parent.textContent = option.parent || '';
    button.append(label, parent);
    button.addEventListener('click', () => chooseGenreCorrectionOption(option));
    genreCorrectionSuggestions.append(button);
  }
  genreCorrectionSuggestions.hidden = !ranked.length;
  genreCorrectionInput.setAttribute('aria-expanded', String(Boolean(ranked.length)));
}

function updateGenreCorrectionUi({ preserveInput = false } = {}) {
  const hasTrack = Boolean(currentMetadata?.title && !demoTheme);
  const artist = currentMetadata?.displayArtist || currentMetadata?.artist || '';
  const detected = currentMetadata?.genre?.label || '';
  const correction = currentMetadata?.userGenreCorrection || null;
  genreCorrectionTrack.textContent = hasTrack
    ? `${currentMetadata.title}${artist ? ` — ${artist}` : ''}`
    : tr('settings.noCurrentTrack');
  genreCorrectionState.textContent = correction
    ? tr('settings.genreCorrectionActive', { genre: correction.label })
    : hasTrack && detected
      ? tr('settings.genreCorrectionDetected', { genre: detected })
      : '';
  genreCorrectionInput.disabled = !hasTrack;
  genreCorrectionSave.disabled = !hasTrack;
  genreCorrectionClear.disabled = !hasTrack || !correction;
  if (!preserveInput && document.activeElement !== genreCorrectionInput) {
    genreCorrectionInput.value = correction?.label || '';
    genreCorrectionInput.dataset.genreId = correction?.genreId || '';
  }
}

function updateSettingsScrollbar() {
  if (!settingsScroll || !settingsScrollbar || !settingsScrollbarThumb || settings.hidden) return;
  const viewport = settingsScroll.clientHeight;
  const content = settingsScroll.scrollHeight;
  const overflow = content - viewport;
  settingsScrollbar.hidden = overflow <= 1;
  if (overflow <= 1) return;
  const trackHeight = settingsScrollbar.clientHeight;
  const thumbHeight = Math.max(28, trackHeight * viewport / content);
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbTop = thumbTravel * settingsScroll.scrollTop / overflow;
  settingsScrollbarThumb.style.height = `${thumbHeight.toFixed(2)}px`;
  settingsScrollbarThumb.style.transform = `translateY(${thumbTop.toFixed(2)}px)`;
}

function finishSettingsScrollbarDrag(event) {
  if (!settingsScrollbarDrag) return;
  if (event?.pointerId != null && settingsScrollbar.hasPointerCapture(event.pointerId)) {
    settingsScrollbar.releasePointerCapture(event.pointerId);
  }
  settingsScrollbarDrag = null;
  settingsScrollbar.classList.remove('is-dragging');
}

function openSettings({ focusCorrection = false } = {}) {
  window.clearTimeout(idleSettleTimer);
  document.body.classList.remove('idle-settled');
  settings.hidden = false;
  document.body.classList.add('settings-open', 'pointer-active');
  settingsButton.setAttribute('aria-expanded', 'true');
  clearControlsTimer();
  updateGenreCorrectionUi();
  updateDiagnosticsUi();
  requestAnimationFrame(updateSettingsScrollbar);
  if (focusCorrection) {
    const panel = genreCorrectionInput.closest('.genre-correction-settings');
    settingsScroll?.scrollTo({ top: Math.max(0, (panel?.offsetTop || 0) - 58), behavior: 'smooth' });
    window.setTimeout(() => {
      genreCorrectionInput.focus();
      renderGenreCorrectionSuggestions(genreCorrectionInput.value);
      updateSettingsScrollbar();
    }, 180);
  }
}

function setInteractionState(clickThrough) {
  document.body.classList.toggle('interactive', !clickThrough);
  if (clickThrough) {
    clearControlsTimer();
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    document.body.classList.remove('pointer-active', 'settings-open');
    settings.hidden = true;
  } else {
    showControls();
  }
}

function setArtwork(url) {
  const paletteSerial = ++artworkPaletteSerial;
  artwork.classList.remove('loaded');
  kawaiiFace.style.removeProperty('--kawaii-ink');
  kawaiiFace.style.removeProperty('--kawaii-mouth');
  tanocFace.style.removeProperty('--tanoc-ink');
  if (!url) {
    artwork.removeAttribute('src');
    return;
  }
  const expected = url;
  artwork.onload = () => {
    if (artwork.src !== expected && artwork.src !== new URL(expected).href) return;
    artwork.classList.add('loaded');
    const kawaiiActive = currentTheme.id === 'kawaii-bass';
    const tanocActive = Boolean(currentTanocVariant);
    if (!kawaiiActive && !tanocActive) return;
    window.genrePolice.artworkFacePalette({
      url: expected,
      theme: { accent: currentTheme.accent, accent2: currentTheme.accent2, hot: currentTheme.hot }
    }).then((palette) => {
      if (!palette || paletteSerial !== artworkPaletteSerial) return;
      if (currentTheme.id === 'kawaii-bass') {
        kawaiiFace.style.setProperty('--kawaii-ink', palette.ink);
        kawaiiFace.style.setProperty('--kawaii-mouth', palette.mouth);
        kawaiiFace.dataset.paletteContrast = String(palette.contrast || '');
      }
      if (currentTanocVariant) {
        tanocFace.style.setProperty('--tanoc-ink', palette.ink);
        tanocFace.dataset.paletteContrast = String(palette.contrast || '');
      }
    }).catch(() => {});
  };
  artwork.onerror = () => artwork.classList.remove('loaded');
  artwork.src = url;
}

function contentFor(metadata) {
  const theme = metadata?.genre ? { ...metadata.genre, id: metadata.genre.id || 'unknown' } : fallbackTheme;
  const placeholderTitle = !metadata?.title;
  const placeholderArtist = !(metadata?.displayArtist || metadata?.artist);
  const sourceKind = metadata?.genreSource ? '' : metadata?.resolving ? 'querying' : 'local';
  return {
    theme,
    placeholder: !metadata,
    placeholderTitle,
    placeholderArtist,
    title: metadata?.title || '',
    artist: metadata?.displayArtist || metadata?.artist || '',
    source: metadata?.genreSource || '',
    sourceKind,
    artwork: metadata?.artwork || '',
    lyrics: metadata?.lyrics || null,
    playing: Boolean(metadata?.playing),
    resolving: Boolean(metadata?.resolving),
    hardcoreTanoc: Boolean(metadata?.hardcoreTanoc),
    genrePoliceEasterEgg: isGenrePoliceTrack(metadata)
  };
}

async function transitionTo(metadata, immediate = false) {
  const token = ++transitionToken;
  const content = contentFor(metadata);
  currentDisplayContent = content;
  if (!immediate) {
    hud.classList.remove('entering');
    hud.classList.add('leaving');
    await new Promise((resolve) => setTimeout(resolve, 170));
    if (token !== transitionToken) return;
  }

  await applyThemeWithBackdropTransition(content.theme);
  if (token !== transitionToken) return;
  currentTanocVariant = resolveTanocFaceVariant(content.theme, content.hardcoreTanoc);
  document.body.dataset.tanocFace = currentTanocVariant;
  if (content.genrePoliceEasterEgg) {
    const root = document.documentElement;
    root.style.setProperty('--accent', '#ff2d55');
    root.style.setProperty('--accent-2', '#34c8ff');
    root.style.setProperty('--hot', '#a9eaff');
    root.style.setProperty('--genre-ink', '#ff4769');
    root.style.setProperty('--genre-ink-2', '#79dcff');
    root.style.setProperty('--genre-ink-edge', '#34c8ff');
  }
  visual.setTrackContext({ genrePolice: content.genrePoliceEasterEgg });
  document.body.dataset.easterEgg = content.genrePoliceEasterEgg ? 'genre-police' : '';
  specialAlert.hidden = !content.genrePoliceEasterEgg;
  renderLocalizedHud(content);
  const genreNoteText = content.resolving ? '' : String(content.theme.note || '');
  genreNote.textContent = genreNoteText;
  genreNote.hidden = !genreNoteText;
  setPlaybackVisualState(content.playing);
  setArtwork(content.artwork);
  setSyncedLyrics(content.lyrics);

  hud.classList.remove('leaving');
  void hud.offsetWidth;
  hud.classList.add('entering');
  setTimeout(() => hud.classList.remove('entering'), 1000);
}

function updatePlayback(payload) {
  if (!currentMetadata) return;
  currentMetadata = { ...currentMetadata, ...payload };
  syncPlaybackClock(currentMetadata);
  playState.textContent = localizedPlaybackStatus(payload.playing);
  if (currentDisplayContent) currentDisplayContent.playing = Boolean(payload.playing);
  setPlaybackVisualState(payload.playing);
  const ratio = payload.durationMs > 0 ? Math.max(0, Math.min(1, payload.positionMs / payload.durationMs)) : 0;
  progress.style.width = `${ratio * 100}%`;
}

function syntheticDemoMetrics(metrics, time) {
  if (!demoTheme || (metrics.volume > 0.09 && !demoTheme.synthetic)) return metrics;
  const asmrDemo = demoTheme.mode === 'asmr';
  const interval = ['hardcore', 'hardstyle'].includes(demoTheme.mode) ? 340 : demoTheme.mode === 'drum-bass' ? 350 : 500;
  const beatIndex = Math.floor(time / interval);
  const phase = (time % interval) / interval;
  const beatNow = beatIndex !== lastDemoBeat;
  if (beatNow) lastDemoBeat = beatIndex;
  const pulse = Math.exp(-phase * 8);
  let frequency = metrics.frequency;
  let waveform = metrics.waveform;
  if (demoTheme.synthetic) {
    frequency = new Uint8Array(1024);
    for (let index = 0; index < 470; index += 1) {
      const ratio = index / 469;
      const lowBody = Math.exp(-Math.pow((ratio - 0.12) / 0.13, 2)) * (0.48 + pulse * 0.35);
      const presencePeak = Math.exp(-Math.pow((ratio - 0.58) / 0.075, 2)) * (0.54 + Math.sin(time * 0.003) * 0.12);
      const upperPeak = Math.exp(-Math.pow((ratio - 0.76) / 0.052, 2)) * (0.42 + Math.sin(time * 0.0042 + 1) * 0.1);
      const texture = 0.1 + Math.sin(index * 0.19 + time * 0.004) * 0.055;
      frequency[index] = Math.round(clamp((lowBody + presencePeak + upperPeak + texture) * (asmrDemo ? 24 : 210), 0, 255));
    }
    waveform = new Uint8Array(2048);
    for (let index = 0; index < waveform.length; index += 1) {
      const ratio = index / waveform.length;
      const sample = Math.sin(ratio * Math.PI * 18 + time * 0.004) * 0.52
        + Math.sin(ratio * Math.PI * 43 - time * 0.002) * 0.24;
      waveform[index] = Math.round(128 + sample * (asmrDemo ? 3.2 + pulse * 1.1 : 18 + pulse * 14));
    }
  }
  const forceKawaiiExcited = demoTheme.id === 'kawaii-bass' && demoTheme.captureKawaiiExcited;
  return {
    ...metrics,
    bass: asmrDemo ? 0.022 + pulse * 0.006 : forceKawaiiExcited ? 0.86 : 0.18 + pulse * 0.7,
    lowMid: asmrDemo ? 0.025 + Math.sin(time * .0011) * .006 : forceKawaiiExcited ? 0.62 : 0.15 + Math.sin(time * .004) * .08 + pulse * .25,
    mid: asmrDemo ? 0.019 + Math.sin(time * .0015 + 1) * .005 : forceKawaiiExcited ? 0.56 : 0.2 + Math.sin(time * .0021 + 1) * .09,
    high: asmrDemo ? 0.013 + Math.sin(time * .002) * .004 : forceKawaiiExcited ? 0.42 : 0.16 + Math.sin(time * .006) * .08,
    volume: asmrDemo ? 0.026 + pulse * 0.004 : forceKawaiiExcited ? 0.31 : 0.24 + pulse * .25,
    flux: asmrDemo ? 0.012 + pulse * 0.01 : forceKawaiiExcited ? 0.48 : pulse * .55,
    beat: Math.max(metrics.beat || 0, pulse),
    beatNow: asmrDemo ? false : beatNow,
    rhythmNow: asmrDemo ? false : beatNow,
    onsetNow: asmrDemo ? false : beatNow,
    kickNow: asmrDemo ? false : beatNow,
    impact: Math.max(metrics.impact || 0, pulse * .72),
    accent: Math.max(metrics.accent || 0, pulse * .42),
    rhythmStrength: asmrDemo ? 0 : beatNow ? .72 : 0,
    rhythmPulse: asmrDemo ? 0 : Math.max(metrics.rhythmPulse || 0, pulse * .72),
    frequency,
    waveform,
    kickPulse: asmrDemo ? 0 : Math.max(metrics.kickPulse || 0, pulse * .72),
    bpm: Math.round(60000 / interval),
    regularity: .92,
    kickDensity: 1000 / interval,
    brightness: forceKawaiiExcited ? 0.36 : .24,
    relativeEnergy: forceKawaiiExcited ? 1.62 : metrics.relativeEnergy,
    drive: forceKawaiiExcited ? 0.92 : metrics.drive,
    profileConfidence: .95
  };
}

function animate(time) {
  const animationActive = Boolean(demoTheme || currentMetadata?.playing);
  const minimumFrameInterval = document.hidden ? 250 : animationActive ? 0 : 1000 / 15;
  if (lastAnimationWorkAt && time - lastAnimationWorkAt < minimumFrameInterval) {
    requestAnimationFrame(animate);
    return;
  }
  lastAnimationWorkAt = time;
  const elapsedMs = previousAnimationTime ? Math.min(80, Math.max(4, time - previousAnimationTime)) : 16.667;
  const frameScale = Math.min(2, elapsedMs / 16.667);
  previousAnimationTime = time;
  let metrics = audio.update(time);
  metrics = syntheticDemoMetrics(metrics, time);
  metrics = softenMotionMetrics(metrics, motionMode);
  visual.render(metrics, time);
  const playbackActive = Boolean(demoTheme || currentMetadata?.playing);
  const asmrMode = currentTheme.mode === 'asmr';
  const tranceMode = currentTheme.mode === 'trance'
    && !['classical', 'soundtrack', 'synthwave'].includes(currentTheme.id);
  const asmrBreath = 0.5 + 0.5 * Math.sin(time * 0.00062);
  const posterEnergyTarget = playbackActive
    ? clamp(
      clamp(((metrics.relativeEnergy || 1) - 0.72) / 1.06) * 0.52
        + clamp(metrics.volume || 0) * 0.2
        + clamp(metrics.drive || 0) * 0.28
    )
    : 0;
  posterEnergy = smoothMotionEnvelope(posterEnergy, posterEnergyTarget, elapsedMs, {
    attackMs: 260,
    releaseMs: 920
  });
  posterImpact = smoothMotionEnvelope(
    posterImpact,
    playbackActive ? clamp(metrics.rhythmPulse || 0) : 0,
    elapsedMs,
    { attackMs: 32, releaseMs: 190 }
  );
  const tranceSectionClarity = tranceMode
    ? smoothstep(0.24, 0.78, clamp(visual.tranceEnergy || 0))
    : 0;
  const tranceKickClarity = tranceMode
    ? Math.pow(clamp(metrics.kickPulse || 0), 0.72)
    : 0;
  const tranceArtworkClarityTarget = tranceMode
    ? clamp(tranceSectionClarity * 0.42 + tranceKickClarity * 0.72)
    : 0;
  tranceArtworkClarity = smoothMotionEnvelope(
    tranceArtworkClarity,
    tranceArtworkClarityTarget,
    elapsedMs,
    { attackMs: 22, releaseMs: 240 }
  );
  // Quiet sections retain the soft black-hole aperture. A sustained climax
  // resolves it slightly, while a kick produces a short, clearer exposure;
  // geometry and scale remain completely fixed.
  appShell.style.setProperty(
    '--trance-artwork-blur',
    `${(2.65 - tranceArtworkClarity * 2.2).toFixed(3)}px`
  );
  posterPhase = (posterPhase + elapsedMs * (0.0028 + posterEnergy * 0.0062)) % 360;
  // Independent clocks must each complete a full 360-degree loop. Deriving a
  // slow clock by multiplying a wrapped angle made House jump whenever the
  // parent clock wrapped from 360 back to zero.
  posterOrbitPhase = (posterOrbitPhase + elapsedMs * (0.0022 + posterEnergy * 0.0055)) % 360;
  posterSoftPhase = (posterSoftPhase + elapsedMs * (0.00042 + posterEnergy * 0.00105)) % 360;
  posterTravel += elapsedMs * (0.012 + posterEnergy * 0.032);
  if (document.body.dataset.backgroundStyle === 'themed') {
    const posterDriftX = Math.sin(time * 0.00019) * (1.2 + posterEnergy * 2.2);
    const posterDriftY = Math.cos(time * 0.00016) * (0.8 + posterEnergy * 1.5);
    const posterSwingX = Math.sin(time * 0.0022) * (1.1 + posterEnergy * 2.7);
    const posterSwingY = Math.cos(time * 0.0017) * (0.8 + posterEnergy * 2.1);
    // Broad ink needs a little more travel than fine background details to read
    // as motion, while remaining much slower than the foreground visualizer.
    const posterFloatX = Math.sin(time * 0.00019) * (4.2 + posterEnergy * 7.2);
    const posterFloatY = Math.cos(time * 0.00016) * (3.1 + posterEnergy * 5.4);
    const posterWaveX = Math.sin(time * 0.00078) * (12 + posterEnergy * 14);
    const posterWaveY = Math.cos(time * 0.00061) * (8 + posterEnergy * 10);
    const linePhaseA = ((posterTravel % 67) + 67) % 67;
    const linePhaseB = (((-posterTravel * 0.72) % 79) + 79) % 79;
    const linePhaseC = (((-posterTravel * 0.72) % 63) + 63) % 63;
    const posterVortexPhase = tranceMode ? (visual.tranceArmPhase || 0) : 0;
    // Two softly cross-faded depth planes keep the DnB tunnel moving through
    // its vanishing point without a visible reset.  Energy controls travel
    // speed; an onset only gives the perspective a short forward nudge.
    const posterDepthA = (posterTravel * 0.014) % 1;
    const posterDepthB = (posterDepthA + 0.5) % 1;
    const depthOpacity = (phase) => (
      Math.pow(Math.sin(Math.PI * phase), 1.35)
      * (0.15 + posterEnergy * 0.16 + posterImpact * 0.055)
    );
    appShell.style.setProperty('--poster-energy', posterEnergy.toFixed(4));
    appShell.style.setProperty('--poster-impact', posterImpact.toFixed(4));
    appShell.style.setProperty('--poster-bass', clamp(metrics.bass || 0).toFixed(4));
    appShell.style.setProperty('--poster-phase', `${posterPhase.toFixed(4)}deg`);
    appShell.style.setProperty('--poster-phase-quarter', `${posterOrbitPhase.toFixed(4)}deg`);
    appShell.style.setProperty('--poster-phase-soft', `${posterSoftPhase.toFixed(4)}deg`);
    appShell.style.setProperty('--poster-wobble-x', `${(Math.sin(time * 0.0034) * (1.4 + clamp(metrics.lowMid || 0) * 4.8)).toFixed(3)}px`);
    appShell.style.setProperty('--poster-wobble-y', `${(Math.sin(time * 0.00225 + 1.15) * (0.9 + clamp(metrics.bass || 0) * 3.2)).toFixed(3)}px`);
    appShell.style.setProperty('--poster-skew', `${(-2 - posterImpact * 1.5).toFixed(3)}deg`);
    appShell.style.setProperty('--poster-drift-x', `${posterDriftX.toFixed(3)}px`);
    appShell.style.setProperty('--poster-drift-y', `${posterDriftY.toFixed(3)}px`);
    appShell.style.setProperty('--poster-swing-x', `${posterSwingX.toFixed(3)}px`);
    appShell.style.setProperty('--poster-swing-y', `${posterSwingY.toFixed(3)}px`);
    appShell.style.setProperty('--poster-float-x', `${posterFloatX.toFixed(3)}px`);
    appShell.style.setProperty('--poster-float-y', `${posterFloatY.toFixed(3)}px`);
    appShell.style.setProperty('--poster-wave-x', `${posterWaveX.toFixed(3)}px`);
    appShell.style.setProperty('--poster-wave-y', `${posterWaveY.toFixed(3)}px`);
    appShell.style.setProperty('--poster-line-phase-a', `${linePhaseA.toFixed(3)}px`);
    appShell.style.setProperty('--poster-line-phase-b', `${linePhaseB.toFixed(3)}px`);
    appShell.style.setProperty('--poster-line-phase-c', `${linePhaseC.toFixed(3)}px`);
    appShell.style.setProperty('--poster-vortex-phase', `${posterVortexPhase.toFixed(5)}rad`);
    appShell.style.setProperty('--poster-kick-y', `${(posterDriftY - posterImpact * 5.5).toFixed(3)}px`);
    appShell.style.setProperty('--poster-drop-y', `${(posterDriftY + posterImpact * 4.2).toFixed(3)}px`);
    appShell.style.setProperty('--poster-impact-angle', `${(posterImpact * 1.8).toFixed(3)}deg`);
    appShell.style.setProperty('--poster-sway-angle', `${(Math.sin(time * 0.0008) * (0.8 + posterEnergy * 1.5)).toFixed(3)}deg`);
    appShell.style.setProperty('--poster-flow-slow', `${posterTravel.toFixed(3)}px`);
    appShell.style.setProperty('--poster-flow-reverse', `${(-posterTravel * 0.72).toFixed(3)}px`);
    appShell.style.setProperty('--poster-flow-fast', `${(posterTravel * 2.35).toFixed(3)}px`);
    appShell.style.setProperty('--poster-depth-scale-a', (0.72 + posterDepthA * 0.64 + posterImpact * 0.018).toFixed(4));
    appShell.style.setProperty('--poster-depth-scale-b', (0.72 + posterDepthB * 0.64 + posterImpact * 0.018).toFixed(4));
    appShell.style.setProperty('--poster-depth-opacity-a', depthOpacity(posterDepthA).toFixed(4));
    appShell.style.setProperty('--poster-depth-opacity-b', depthOpacity(posterDepthB).toFixed(4));
  }
  if (tranceMode) {
    // The artwork is the vortex aperture. Letting the generic impact spring
    // scale it made the black-hole centre visibly pump out of sync with the
    // stable spiral geometry.
    coreVelocity = 0;
    coreScale = 1;
  } else {
    if (metrics.rhythmNow && !asmrMode) coreVelocity -= .006 + metrics.rhythmPulse * .011;
    const coreTarget = asmrMode
      ? 0.998 + asmrBreath * 0.009 + metrics.volume * 0.003
      : 1 + metrics.beat * .008 + metrics.rhythmPulse * .069;
    coreVelocity += (coreTarget - coreScale) * 0.24 * frameScale;
    coreVelocity *= 0.7 ** frameScale;
    coreScale += coreVelocity * frameScale;
    coreScale = Math.max(.94, Math.min(1.14, coreScale));
  }
  if (tranceMode) {
    const artworkRotation = visual.tranceArmPhase || 0;
    coreArt.style.transform = `scale(1) rotate(${artworkRotation.toFixed(5)}rad)`;
  } else {
    coreArt.style.transform = `scale(${coreScale})`;
  }
  drawForegroundRiffStrings(metrics, time);
  const rawTextPulse = playbackActive ? clamp(metrics.rhythmPulse || 0) : 0;
  // The Trance canvas deliberately has continuous flow, so the title should
  // follow a continuous envelope as well. This also absorbs the brief audio
  // discontinuity produced when the player seeks to a new position.
  tranceTextPulse = tranceMode
    ? smoothMotionEnvelope(tranceTextPulse, rawTextPulse, elapsedMs, { attackMs: 38, releaseMs: 155 })
    : rawTextPulse;
  const textPulse = tranceMode ? tranceTextPulse : rawTextPulse;
  const genreFlare = playbackActive
    ? asmrMode
      ? 0.025 + asmrBreath * 0.055
      : Math.min(1, textPulse * (tranceMode ? 1.42 : 1.15))
    : 0;
  const impactFx = playbackActive
    ? resolveImpactFx(currentTheme, tranceMode ? { ...metrics, rhythmPulse: textPulse } : metrics)
    : { amount: 0, bloom: 0, blur: 0, echo: 0, chroma: 0, slice: 0, exposure: 1, saturation: 1 };
  const textFx = clamp(currentTheme.textFx ?? 1, 0.45, 1.15);
  const lineHot = clamp(impactFx.amount * .42 + genreFlare * .08);
  const kawaiiActive = currentTheme.id === 'kawaii-bass';
  const kawaiiState = kawaiiActive
    ? kawaiiExpression.update(metrics, time, frameScale, true)
    : { expression: 0, energy: 0 };
  if (!kawaiiActive && kawaiiTrackerActive) kawaiiExpression.reset();
  kawaiiTrackerActive = kawaiiActive;
  // Hidden face layers used to receive a dozen style mutations every frame.
  // Updating only the active face keeps the Trance title on the compositor.
  if (kawaiiActive) {
    kawaiiFace.style.setProperty('--kawaii-open', kawaiiState.expression.toFixed(4));
    kawaiiFace.style.setProperty('--kawaii-energy', kawaiiState.energy.toFixed(4));
    kawaiiFace.style.setProperty('--kawaii-pulse', clamp(metrics.rhythmPulse || 0).toFixed(4));
    kawaiiFace.style.setProperty('--kawaii-wave-scale', coreScale.toFixed(4));
    kawaiiFace.style.setProperty('--kawaii-line-hot', `${(lineHot * 100).toFixed(2)}%`);
    kawaiiFace.style.setProperty('--kawaii-mouth-hot', `${(lineHot * 100).toFixed(2)}%`);
    if (metrics.rhythmNow) {
      kawaiiBeatAt = time;
      kawaiiBeatStrength = clamp(metrics.rhythmStrength ?? metrics.rhythmPulse ?? 0.5);
    }
    const kawaiiBeatPeriod = clamp(60000 / (metrics.bpm || 140), 260, 760);
    const kawaiiBeatAge = time - kawaiiBeatAt;
    let kawaiiBob = 0;
    let kawaiiBrowLift = 0;
    if (kawaiiBeatAge >= 0 && kawaiiBeatAge < kawaiiBeatPeriod) {
      const phase = kawaiiBeatAge / kawaiiBeatPeriod;
      const envelope = Math.sin(Math.PI * phase);
      const amplitude = 1.05 + kawaiiBeatStrength * 1.78;
      kawaiiBob = -Math.sin(Math.PI * 2 * phase) * envelope * amplitude;
      const browAmplitude = 0.25 + kawaiiBeatStrength * (0.55 + kawaiiState.expression * 0.45);
      kawaiiBrowLift = -(envelope ** 1.2) * browAmplitude;
    }
    kawaiiFace.style.setProperty('--kawaii-bob', `${kawaiiBob.toFixed(3)}px`);
    kawaiiFace.style.setProperty('--kawaii-brow-lift', `${kawaiiBrowLift.toFixed(3)}px`);
  }

  if (currentTanocVariant) {
    tanocFace.style.setProperty('--tanoc-core-scale', coreScale.toFixed(4));
    tanocFace.style.setProperty('--tanoc-line-hot', `${(lineHot * 100).toFixed(2)}%`);
    if (metrics.rhythmNow) {
      tanocBeatAt = time;
      tanocBeatStrength = clamp(metrics.rhythmStrength ?? metrics.rhythmPulse ?? 0.5);
    }
    const tanocBeatPeriod = clamp(60000 / (metrics.bpm || 170), 250, 760);
    const tanocBeatAge = time - tanocBeatAt;
    let tanocBob = 0;
    let tanocEyeShift = 0;
    if (tanocBeatAge >= 0 && tanocBeatAge < tanocBeatPeriod) {
      const phase = tanocBeatAge / tanocBeatPeriod;
      const envelope = Math.sin(Math.PI * phase);
      const amplitude = 1.08 + tanocBeatStrength * 1.92;
      tanocBob = -Math.sin(Math.PI * 2 * phase) * envelope * amplitude;
      tanocEyeShift = -(envelope ** 1.25) * (0.28 + tanocBeatStrength * 0.72);
    }
    tanocFace.style.setProperty('--tanoc-bob', `${tanocBob.toFixed(3)}px`);
    tanocFace.style.setProperty('--tanoc-eye-shift', `${tanocEyeShift.toFixed(3)}px`);
  }
  if (playbackActive && metrics.rhythmNow && !asmrMode) {
    genreVelocity -= tranceMode
      ? .003 + metrics.rhythmPulse * .009
      : .006 + metrics.rhythmPulse * .018;
  }
  const genreTarget = playbackActive
    ? asmrMode
      ? 0.998 + asmrBreath * 0.01
      : 1 + textPulse * (tranceMode ? .052 : .048)
    : 1;
  genreVelocity += (genreTarget - genreScale) * 0.22 * frameScale;
  genreVelocity *= 0.69 ** frameScale;
  genreScale += genreVelocity * frameScale;
  genreScale = Math.max(.93, Math.min(1.145, genreScale));
  genreLabel.style.setProperty('--genre-scale', genreScale.toFixed(4));
  const genreLiftTarget = playbackActive
    ? asmrMode
      ? -0.35 - asmrBreath * 0.55
      : -textPulse * (tranceMode ? 4.4 : 4.2)
    : 0;
  if (tranceMode) {
    const liftResponse = 1 - Math.exp(-frameScale * 0.18);
    genreLiftValue += (genreLiftTarget - genreLiftValue) * liftResponse;
  } else {
    genreLiftValue = genreLiftTarget;
  }
  genreLabel.style.setProperty('--genre-lift', `${genreLiftValue.toFixed(2)}px`);
  const textBaseGlow = Number(currentTheme.textBaseGlow) || 18;
  const textSliceFx = clamp(currentTheme.textSliceFx ?? textFx, 0.05, 1.15);
  const textEchoFx = clamp(currentTheme.textEchoFx ?? textFx, 0.05, 1.15);
  const textMotionGate = playbackActive ? 1 : 0;
  genreLabel.style.setProperty('--genre-flare', genreFlare.toFixed(3));
  genreLabel.style.setProperty('--genre-glow', `${(textBaseGlow + (genreFlare * 11 + impactFx.bloom * 18) * textFx).toFixed(2)}px`);
  genreLabel.style.setProperty('--genre-brightness', (1 + (genreFlare * .2 + impactFx.exposure - 1) * textFx).toFixed(3));
  genreLabel.style.setProperty('--genre-saturation', (1 + (genreFlare * .12 + impactFx.saturation - 1) * textFx).toFixed(3));
  genreLabel.style.setProperty('--impact-text-blur', `${(impactFx.blur * .72 * textFx).toFixed(3)}px`);
  genreLabel.style.setProperty('--impact-echo-left', `${(-impactFx.echo * 8 * textEchoFx * textMotionGate).toFixed(2)}px`);
  genreLabel.style.setProperty('--impact-echo-right', `${(impactFx.echo * 8 * textEchoFx * textMotionGate).toFixed(2)}px`);
  genreLabel.style.setProperty('--impact-echo-blur', `${(impactFx.bloom * 12 * textEchoFx * textMotionGate).toFixed(2)}px`);
  genreLabel.style.setProperty('--impact-echo-alpha', `${Math.min(42, impactFx.echo * 72 * textEchoFx * textMotionGate).toFixed(1)}%`);
  genreLabel.style.setProperty('--impact-slice-left', `${((-impactFx.slice * 9 - impactFx.chroma * 3) * textSliceFx * textMotionGate).toFixed(2)}px`);
  genreLabel.style.setProperty('--impact-slice-right', `${((impactFx.slice * 9 + impactFx.chroma * 3) * textSliceFx * textMotionGate).toFixed(2)}px`);
  genreLabel.style.setProperty('--impact-slice-opacity', Math.min(.68, (impactFx.slice * .72 + impactFx.chroma * .28) * textSliceFx * textMotionGate).toFixed(3));
  genreLabel.style.setProperty('--impact-ghost-blur', `${(impactFx.blur * 2.2 * textSliceFx * textMotionGate).toFixed(2)}px`);
  const gentleHardcore = currentTheme.mode === 'hardcore'
    && ['happy-hardcore', 'uk-hardcore'].includes(currentTheme.id);
  const distortedGenre = (['hardcore', 'hardstyle'].includes(currentTheme.mode) && !gentleHardcore)
    || currentTheme.mode === 'phonk'
    || currentTheme.id === 'industrial-metal';
  document.documentElement.style.setProperty('--distortion', (playbackActive && distortedGenre ? metrics.rhythmPulse : 0).toFixed(3));
  renderSyncedLyrics(time);
  requestAnimationFrame(animate);
}

audio.addEventListener('status', ({ detail }) => {
  updateDiagnosticsUi();
  if (!currentMetadata?.playing) return;
  playState.textContent = localizedPlaybackStatus(true, detail);
});

audio.addEventListener('outputdevicechange', ({ detail }) => {
  window.genrePolice.notifyAudioOutputDeviceChanged(detail);
});

window.genrePolice.onNowPlaying((metadata) => {
  const nextKey = metadataKey(metadata);
  const currentKey = metadataKey(currentMetadata);
  const changedTrack = Boolean(nextKey && nextKey !== currentKey);
  // A completed metadata/genre request can carry the old position captured
  // when that request began. Keep the continuous clock for the same track.
  syncPlaybackClock(metadata, performance.now(), { force: changedTrack, reconcile: false });
  currentMetadata = metadata;
  if (metadata?.source) currentMediaSource = metadata.source;
  updateGenreCorrectionUi();
  updateDiagnosticsUi();
  if (!demoTheme) transitionTo(metadata);
});
window.genrePolice.onPlaybackTick(updatePlayback);
window.genrePolice.onLyrics((lyrics) => {
  if (!currentMetadata) return;
  currentMetadata = { ...currentMetadata, lyrics };
  setSyncedLyrics(lyrics);
  updateDiagnosticsUi();
});
window.genrePolice.onInteractionState(({ clickThrough }) => {
  setInteractionState(clickThrough);
});
window.genrePolice.onUiScale(({ scale }) => applyUiScale(scale));
window.genrePolice.onMediaSources(setMediaSources);
window.genrePolice.onDemoTheme((theme) => {
  demoTheme = theme;
  if (!theme) {
    if (currentMetadata) transitionTo(currentMetadata);
    return;
  }
  const [genre, demoTitle, demoArtist] = demoTracks[theme.id] || [theme.label, 'Visual Evidence', 'Genre Police Unit'];
  const title = theme.easterEgg ? 'Genre Police (feat. D-NiAL)' : demoTitle;
  const artist = theme.easterEgg ? 'S3RL' : demoArtist;
  const demoMetadata = {
    playing: true,
    title,
    artist,
    hardcoreTanoc: Boolean(theme.captureTanoc),
    genre: {
      ...theme,
      label: genre,
      note: theme.id === 'moombahcore' ? '(NOT DUBSTEP)' : ''
    },
    genreSource: 'VISUAL DEMO',
    artwork: theme.captureArtwork || '',
    positionMs: 8200,
    durationMs: 24000,
    lyrics: theme.captureLyrics ? {
      synced: true,
      lines: [
        { atMs: 1000, text: 'Signal found in the rhythm', translation: '在节奏中发现信号' },
        { atMs: 7000, text: 'Every color moves with sound', translation: '每种色彩都随声音流动' },
        { atMs: 13000, text: 'Genre police on the frequency', translation: '曲风警察已锁定频率' }
      ]
    } : null
  };
  syncPlaybackClock(demoMetadata, performance.now(), { force: true });
  transitionTo(demoMetadata);
});
window.genrePolice.onRestartAudio(() => audio.start());
window.genrePolice.onRhythmModel((payload) => {
  if (payload?.type !== 'rhythm') latestRhythmModelState = payload || latestRhythmModelState;
  audio.setModelAssist(payload);
  updateDiagnosticsUi();
});
window.genrePolice.onBackdropProfile((profile) => {
  if (!profile) return;
  appShell.style.setProperty('--adaptive-strong', profile.strong);
  appShell.style.setProperty('--adaptive-soft', profile.soft);
  appShell.style.setProperty('--adaptive-faint', profile.faint);
  appShell.style.setProperty('--adaptive-tint', profile.tint);
  appShell.style.setProperty('--adaptive-opacity', String(profile.opacity));
  appShell.style.setProperty('--adaptive-hud-shadow', profile.hudShadow);
  document.body.dataset.backdrop = profile.mode || 'balanced';
});

layoutToggleButton.addEventListener('click', () => {
  chooseLayoutMode(layoutMode === 'poster' ? 'side' : 'poster');
});
document.querySelector('#close-button').addEventListener('click', () => window.genrePolice.close());
settingsButton.addEventListener('click', () => {
  if (!settings.hidden) {
    closeSettings();
    return;
  }
  openSettings();
});

async function requestMediaControl(action, button) {
  if (button.getAttribute('aria-busy') === 'true') return;
  const requestSerial = ++mediaControlSerial;
  const previousPlaying = playPauseButton.classList.contains('is-playing');
  if (action === 'toggle') {
    optimisticPlaybackIcon = {
      token: requestSerial,
      previousPlaying,
      playing: !previousPlaying,
      expiresAt: performance.now() + 1200
    };
    setPlayPauseIcon(!previousPlaying);
  }
  button.setAttribute('aria-busy', 'true');
  try {
    const result = await window.genrePolice.mediaControl(action);
    if (action === 'toggle'
      && result?.ok === false
      && optimisticPlaybackIcon?.token === requestSerial) {
      optimisticPlaybackIcon = null;
      setPlayPauseIcon(previousPlaying);
    }
  } catch {
    if (action === 'toggle' && optimisticPlaybackIcon?.token === requestSerial) {
      optimisticPlaybackIcon = null;
      setPlayPauseIcon(previousPlaying);
    }
  } finally {
    button.removeAttribute('aria-busy');
  }
}

previousTrackButton.addEventListener('click', () => requestMediaControl('previous', previousTrackButton));
playPauseButton.addEventListener('click', () => requestMediaControl('toggle', playPauseButton));
nextTrackButton.addEventListener('click', () => requestMediaControl('next', nextTrackButton));
lyricSweepToggle.addEventListener('click', () => {
  setLyricSweepEnabled(!lyricSweepEnabled, { persist: true });
});
lyricsEnabledToggle.addEventListener('click', () => {
  setLyricsEnabled(!lyricsEnabled, { persist: true });
});
lyricTranslationToggle.addEventListener('click', () => {
  setLyricTranslationEnabled(!lyricTranslationEnabled, { persist: true });
});
posterEnglishFontToggle.addEventListener('click', () => {
  setPosterCondensedEnglish(!posterCondensedEnglish, { persist: true });
});
capsuleEnglishFontToggle.addEventListener('click', () => {
  setCapsuleCondensedEnglish(!capsuleCondensedEnglish, { persist: true });
});
capsuleThemedBackgroundToggle.addEventListener('click', () => {
  setCapsuleThemedBackground(!capsuleThemedBackground, { persist: true });
});
posterThemedBackgroundToggle.addEventListener('click', () => {
  setPosterThemedBackground(!posterThemedBackground, { persist: true });
});
onlineLookupToggle.addEventListener('click', () => {
  setOnlineGenreLookupEnabled(!onlineGenreLookupEnabled, { persist: true });
});
launchAtLoginToggle.addEventListener('click', () => {
  setLaunchAtLoginEnabled(!launchAtLoginEnabled, {
    persist: true,
    supported: !launchAtLoginToggle.disabled
  });
});
lyricDelayInput.addEventListener('input', () => setLyricDelay(lyricDelayInput.value));
lyricDelayInput.addEventListener('change', () => setLyricDelay(lyricDelayInput.value, { persist: true }));
lyricDelayReset.addEventListener('click', () => setLyricDelay(0, { persist: true }));
uiScaleButton.addEventListener('click', () => {
  const opening = uiScaleMenu.hidden;
  setScaleMenuOpen(opening, { focus: opening });
});
uiScaleButton.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setScaleMenuOpen(true, { focus: true });
});
languageButton.addEventListener('click', () => {
  const opening = languageMenu.hidden;
  setLanguageMenuOpen(opening, { focus: opening });
});
languageButton.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setLanguageMenuOpen(true, { focus: true });
});
languageOptions.forEach((option) => {
  option.addEventListener('click', () => chooseLanguage(option.dataset.language));
});
languageMenu.addEventListener('keydown', (event) => {
  const currentIndex = Math.max(0, languageOptions.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setLanguageMenuOpen(false);
    languageButton.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    chooseLanguage(languageOptions[currentIndex].dataset.language);
    return;
  }
  const movement = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
  if (!movement && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? languageOptions.length - 1
      : (currentIndex + movement + languageOptions.length) % languageOptions.length;
  languageOptions[nextIndex].focus();
});
uiScaleOptions.forEach((option) => {
  option.addEventListener('click', () => chooseUiScale(option.dataset.scale));
});
layoutModeOptions.forEach((option) => {
  option.addEventListener('click', () => chooseLayoutMode(option.dataset.layoutMode));
});
motionModeOptions.forEach((option) => {
  option.addEventListener('click', () => setMotionMode(option.dataset.motionMode, { persist: true }));
});
idleBehaviorOptions.forEach((option) => {
  option.addEventListener('click', () => setIdleBehavior(option.dataset.idleBehavior, { persist: true }));
});
function handleRadioSegmentKey(event, options, activate) {
  const movement = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      ? -1
      : 0;
  if (!movement) return;
  event.preventDefault();
  const activeIndex = Math.max(0, options.findIndex((option) => option.getAttribute('aria-checked') === 'true'));
  const next = options[(activeIndex + movement + options.length) % options.length];
  next.focus();
  activate(next);
}
layoutModeGroup.addEventListener('keydown', (event) => {
  handleRadioSegmentKey(event, layoutModeOptions, (next) => chooseLayoutMode(next.dataset.layoutMode));
});
motionModeGroup.addEventListener('keydown', (event) => {
  handleRadioSegmentKey(event, motionModeOptions, (next) => setMotionMode(next.dataset.motionMode, { persist: true }));
});
idleBehaviorGroup.addEventListener('keydown', (event) => {
  handleRadioSegmentKey(event, idleBehaviorOptions, (next) => setIdleBehavior(next.dataset.idleBehavior, { persist: true }));
});
mediaSourceButton.addEventListener('click', () => {
  const opening = mediaSourceMenu.hidden;
  setMediaSourceMenuOpen(opening, { focus: opening });
});
mediaSourceButton.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setMediaSourceMenuOpen(true, { focus: true });
});
mediaSourceMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.media-source-option:not(:disabled)');
  if (option) chooseMediaSource(option.dataset.source);
});
mediaSourceMenu.addEventListener('keydown', (event) => {
  const options = mediaSourceOptions();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setMediaSourceMenuOpen(false);
    mediaSourceButton.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    chooseMediaSource(options[currentIndex]?.dataset.source);
    return;
  }
  const movement = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
  if (!movement && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? options.length - 1
      : (currentIndex + movement + options.length) % options.length;
  options[nextIndex]?.focus();
});
mediaSourceIgnoreList.addEventListener('click', (event) => {
  const button = event.target.closest('.media-source-ignore-toggle');
  if (!button) return;
  const source = button.dataset.source;
  const ignored = ignoredMediaSources.includes(source);
  ignoredMediaSources = ignored
    ? ignoredMediaSources.filter((item) => item !== source)
    : [...ignoredMediaSources, source];
  if (!ignored && preferredMediaSource === source) preferredMediaSource = '';
  window.genrePolice.setConfig({ ignoredMediaSources, preferredMediaSource }).catch(() => {});
  renderMediaSourceSettings();
});
uiScaleMenu.addEventListener('keydown', (event) => {
  const currentIndex = Math.max(0, uiScaleOptions.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setScaleMenuOpen(false);
    uiScaleButton.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    chooseUiScale(uiScaleOptions[currentIndex].dataset.scale);
    return;
  }
  const movement = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
  if (!movement && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? uiScaleOptions.length - 1
      : (currentIndex + movement + uiScaleOptions.length) % uiScaleOptions.length;
  uiScaleOptions[nextIndex].focus();
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.ui-scale-picker')) setScaleMenuOpen(false);
  if (!event.target.closest('.language-picker')) setLanguageMenuOpen(false);
  if (!event.target.closest('.media-source-picker')) setMediaSourceMenuOpen(false);
  if (!event.target.closest('.genre-correction-picker')) closeGenreCorrectionSuggestions();
});
genreCorrectionInput.addEventListener('focus', () => renderGenreCorrectionSuggestions(genreCorrectionInput.value));
genreCorrectionInput.addEventListener('input', () => {
  const option = currentCorrectionOption();
  genreCorrectionInput.dataset.genreId = option?.id || '';
  renderGenreCorrectionSuggestions(genreCorrectionInput.value);
});
genreCorrectionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeGenreCorrectionSuggestions();
  }
});
genreCorrectionSave.addEventListener('click', async () => {
  const option = currentCorrectionOption();
  if (!option) {
    genreCorrectionState.textContent = tr('settings.genreCorrectionInvalid');
    renderGenreCorrectionSuggestions(genreCorrectionInput.value);
    return;
  }
  const result = await window.genrePolice.setGenreCorrection(option.id);
  genreCorrectionState.textContent = result?.ok
    ? tr('settings.genreCorrectionSaved', { genre: option.label })
    : tr('settings.genreCorrectionFailed');
});
genreCorrectionClear.addEventListener('click', async () => {
  const result = await window.genrePolice.clearGenreCorrection();
  if (result?.ok) {
    genreCorrectionInput.value = '';
    genreCorrectionInput.dataset.genreId = '';
    genreCorrectionState.textContent = tr('settings.genreCorrectionCleared');
  }
});
document.querySelector('#settings-close').addEventListener('click', closeSettings);
credentialsSave.addEventListener('click', async () => {
  credentialsSave.disabled = true;
  try {
    await window.genrePolice.setConfig({
      lastFmApiKey: lastFmInput.value,
      discogsToken: discogsTokenInput.value
    });
    credentialsState.textContent = tr('settings.keysApplied');
  } finally {
    credentialsSave.disabled = false;
  }
});
diagnosticsPanel.addEventListener('toggle', () => {
  if (diagnosticsPanel.open) updateDiagnosticsUi();
  requestAnimationFrame(updateSettingsScrollbar);
});
diagnosticsRecapture.addEventListener('click', async () => {
  diagnosticsState.textContent = tr('diagnostics.recapturing');
  await window.genrePolice.recaptureAudio();
  window.setTimeout(() => {
    updateDiagnosticsUi();
    diagnosticsState.textContent = tr('diagnostics.recaptureRequested');
  }, 450);
});
diagnosticsExport.addEventListener('click', async () => {
  diagnosticsExport.disabled = true;
  try {
    const result = await window.genrePolice.exportDiagnostics({
      audioStatus: audio.status,
      genreSource: currentMetadata?.genreSource || '',
      lyricSource: currentMetadata?.lyrics?.source || ''
    });
    diagnosticsState.textContent = result?.ok
      ? tr('diagnostics.exported')
      : result?.canceled ? '' : tr('diagnostics.exportFailed');
  } catch {
    diagnosticsState.textContent = tr('diagnostics.exportFailed');
  } finally {
    diagnosticsExport.disabled = false;
  }
});
document.querySelector('#settings-save').addEventListener('click', closeSettings);

settingsScroll.addEventListener('scroll', updateSettingsScrollbar, { passive: true });
settingsScrollbar.addEventListener('pointerdown', (event) => {
  if (settingsScrollbar.hidden) return;
  const trackRect = settingsScrollbar.getBoundingClientRect();
  const viewport = settingsScroll.clientHeight;
  const content = settingsScroll.scrollHeight;
  const overflow = Math.max(0, content - viewport);
  const thumbRect = settingsScrollbarThumb.getBoundingClientRect();
  if (event.target === settingsScrollbarThumb) {
    settingsScrollbarDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: settingsScroll.scrollTop,
      scrollPerPixel: overflow / Math.max(1, trackRect.height - thumbRect.height)
    };
    settingsScrollbar.classList.add('is-dragging');
    settingsScrollbar.setPointerCapture(event.pointerId);
  } else {
    const ratio = clamp((event.clientY - trackRect.top) / Math.max(1, trackRect.height));
    settingsScroll.scrollTo({ top: overflow * ratio, behavior: 'smooth' });
  }
  event.preventDefault();
});
settingsScrollbar.addEventListener('pointermove', (event) => {
  if (!settingsScrollbarDrag || settingsScrollbarDrag.pointerId !== event.pointerId) return;
  settingsScroll.scrollTop = settingsScrollbarDrag.startScroll
    + (event.clientY - settingsScrollbarDrag.startY) * settingsScrollbarDrag.scrollPerPixel;
  event.preventDefault();
});
settingsScrollbar.addEventListener('pointerup', finishSettingsScrollbarDrag);
settingsScrollbar.addEventListener('pointercancel', finishSettingsScrollbarDrag);
new ResizeObserver(updateSettingsScrollbar).observe(settingsScroll);
new ResizeObserver(updateTitleOverflow).observe(titleLabel);

window.addEventListener('pointermove', showControls, { passive: true });
window.addEventListener('resize', updateSettingsScrollbar, { passive: true });
window.addEventListener('pointerleave', () => hideControls(260));
window.addEventListener('blur', () => hideControls(120));
controls.addEventListener('pointerenter', clearControlsTimer);
controls.addEventListener('pointerleave', showControls);
transport.addEventListener('pointerenter', clearControlsTimer);
transport.addEventListener('pointerleave', showControls);

window.genrePolice.getConfig().then((config) => {
  preferredMediaSource = config.preferredMediaSource || '';
  ignoredMediaSources = Array.isArray(config.ignoredMediaSources) ? config.ignoredMediaSources : [];
  availableMediaSources = Array.isArray(config.availableMediaSources) ? config.availableMediaSources : [];
  currentMediaSource = config.currentMediaSource || '';
  latestRhythmModelState = config.rhythmModelState || latestRhythmModelState;
  applyLanguage(config.language);
  lastFmInput.value = config.lastFmApiKey || '';
  discogsTokenInput.value = config.discogsToken || '';
  appVersionLabel.textContent = config.appVersion || '0.1.0';
  genreOptions = Array.isArray(config.genreOptions) ? config.genreOptions : [];
  setLyricsEnabled(config.lyricsEnabled !== false);
  setLyricTranslationEnabled(config.lyricTranslationEnabled !== false);
  setCapsuleCondensedEnglish(config.capsuleCondensedEnglish === true);
  setPosterCondensedEnglish(config.posterCondensedEnglish !== false);
  setCapsuleThemedBackground(config.capsuleThemedBackground !== false);
  setPosterThemedBackground(config.posterThemedBackground !== false);
  setLyricSweepEnabled(config.lyricSweepEnabled !== false);
  setOnlineGenreLookupEnabled(config.onlineGenreLookupEnabled !== false);
  setLaunchAtLoginEnabled(config.launchAtLogin === true, {
    supported: config.launchAtLoginSupported !== false
  });
  setMotionMode(config.motionMode);
  setIdleBehavior(config.idleBehavior);
  renderMediaSourceSettings();
  setLyricDelay(config.lyricDelayMs);
  applyLayoutMode(config.layoutMode);
  applyUiScale(config.uiScale);
  setInteractionState(config.clickThrough);
  updateGenreCorrectionUi();
});
window.genrePolice.onLayoutMode((payload) => applyLayoutMode(payload?.mode));
window.genrePolice.onOpenSettings(() => openSettings());
window.genrePolice.onOpenGenreCorrection(() => openSettings({ focusCorrection: true }));

applyTheme(fallbackTheme);
genreLabel.dataset.text = genreLabel.textContent;
transitionTo(null, true);
audio.start();
requestAnimationFrame(animate);
