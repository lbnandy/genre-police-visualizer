import { AudioEngine } from './audio-engine.js';
import { VisualEngine } from './visual-engine.js';
import { VisualizationRecorder } from './recording-controller.mjs';
import { fallbackTheme, demoTracks } from './themes.js';
import { buildLyricSweepTimeline, buildLyricUnitTimeline, lyricLineInkWidth, lyricUnitMotion } from './lyric-motion.mjs';
import { resolveImpactFx } from './impact-fx.mjs';
import { isGenrePoliceTrack } from './easter-eggs.mjs';
import { KawaiiExpressionTracker } from './kawaii-expression.mjs';
import { smoothMotionEnvelope } from './motion-envelope.mjs';
import { softenMotionMetrics } from './motion-preference.mjs';
import {
  applyVisualResponse,
  normalizeVisualResponseMode
} from './audio-response.mjs';
import { synthwaveAudioResponse } from './synthwave-response.mjs';
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
const UI_SCALES = [0.6, 0.72, 0.84, 0.96, 1.08, 1.2, 1.32, 1.44, 1.56, 1.68, 1.8];
const DEFAULT_UI_SCALE = 1.2;

const canvas = document.querySelector('#visualizer');
const appShell = document.querySelector('#app');
const themedBackdrop = document.querySelector('#poster-backdrop');
const previousThemedBackdrop = document.querySelector('#themed-backdrop-previous');
const hud = document.querySelector('#hud');
const artwork = document.querySelector('#artwork');
const monogram = document.querySelector('#monogram');
const jurisdictionLabel = document.querySelector('.jurisdiction > span:nth-child(2)');
const parentGenre = document.querySelector('#parent-genre');
const genreLabel = document.querySelector('#genre');
const genreQuickPanel = document.querySelector('#genre-quick-panel');
const genreQuickTrack = document.querySelector('#genre-quick-track');
const genreQuickCandidates = document.querySelector('#genre-quick-candidates');
const genreQuickState = document.querySelector('#genre-quick-state');
const genreQuickClose = document.querySelector('#genre-quick-close');
const genreQuickMore = document.querySelector('#genre-quick-more');
const genreQuickUnlock = document.querySelector('#genre-quick-unlock');
const genreQuickUse = document.querySelector('#genre-quick-use');
const genreQuickRemember = document.querySelector('#genre-quick-remember');
const genreNote = document.querySelector('#genre-note');
const titleLabel = document.querySelector('#title');
const artistLabel = document.querySelector('#artist');
const caseId = document.querySelector('#case-id');
const playState = document.querySelector('#play-state');
const genreSource = document.querySelector('#genre-source');
const trackRule = document.querySelector('.track-rule');
const progress = document.querySelector('.track-rule-fill');
const settings = document.querySelector('#settings');
const settingsScroll = document.querySelector('.settings-scroll');
const settingsScrollbar = document.querySelector('#settings-scrollbar');
const settingsScrollbarThumb = document.querySelector('#settings-scrollbar-thumb');
const settingsTabs = [...document.querySelectorAll('.settings-tab')];
const settingsPanes = [...document.querySelectorAll('.settings-pane')];
const lastFmInput = document.querySelector('#lastfm-key');
const discogsTokenInput = document.querySelector('#discogs-token');
const appVersionLabel = document.querySelector('#app-version');
const updateCheckButton = document.querySelector('#update-check-button');
const updateViewButton = document.querySelector('#update-view-button');
const updateCheckState = document.querySelector('#update-check-state');
const updateToast = document.querySelector('#update-toast');
const updateToastMessage = document.querySelector('#update-toast-message');
const updateToastDismiss = document.querySelector('#update-toast-dismiss');
const updateToastView = document.querySelector('#update-toast-view');
const fpsCounter = document.querySelector('#fps-counter');
const fpsCounterValue = document.querySelector('#fps-counter-value');
const genreCorrectionInput = document.querySelector('#genre-correction-input');
const genreCorrectionSuggestions = document.querySelector('#genre-correction-suggestions');
const genreCorrectionTrack = document.querySelector('#genre-correction-track');
const genreCorrectionState = document.querySelector('#genre-correction-state');
const genreCorrectionSave = document.querySelector('#genre-correction-save');
const genreCorrectionClear = document.querySelector('#genre-correction-clear');
const genreArtistPanel = document.querySelector('#genre-artist-panel');
const genreArtistGenre = document.querySelector('#genre-artist-genre');
const genreArtistGenreValue = document.querySelector('#genre-artist-genre-value');
const genreArtistGenreMenu = document.querySelector('#genre-artist-genre-menu');
const genreArtistName = document.querySelector('#genre-artist-name');
const genreArtistAdd = document.querySelector('#genre-artist-add');
const genreArtistState = document.querySelector('#genre-artist-state');
const genreArtistList = document.querySelector('#genre-artist-list');
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
const idleFrameLimitToggle = document.querySelector('#idle-frame-limit-toggle');
const rhythmModelToggle = document.querySelector('#rhythm-model-toggle');
const captureAudioSourceButton = document.querySelector('#audio-source-button');
const captureAudioSourceValue = document.querySelector('#audio-source-value');
const captureAudioSourceMenu = document.querySelector('#audio-source-menu');
const visualResponseOptions = [...document.querySelectorAll('.visual-response-option')];
const visualResponseGroup = document.querySelector('#visual-response-group');
const mediaSourceButton = document.querySelector('#media-source-button');
const mediaSourceValue = document.querySelector('#media-source-value');
const mediaSourceMenu = document.querySelector('#media-source-menu');
const mediaSourceIgnoreList = document.querySelector('#media-source-ignore-list');
const neteaseSmtcHint = document.querySelector('#netease-smtc-hint');
const neteaseSmtcToast = document.querySelector('#netease-smtc-toast');
const neteaseSmtcToastClose = document.querySelector('#netease-smtc-toast-close');
const customGenreName = document.querySelector('#custom-genre-name');
const customGenreVisual = document.querySelector('#custom-genre-visual');
const customGenreVisualValue = document.querySelector('#custom-genre-visual-value');
const customGenreVisualMenu = document.querySelector('#custom-genre-visual-menu');
const customGenreColorsToggle = document.querySelector('#custom-genre-colors-toggle');
const customGenreColorPalette = document.querySelector('#custom-genre-color-palette');
const customGenreAccent = document.querySelector('#custom-genre-accent');
const customGenreAccentValue = document.querySelector('#custom-genre-accent-value');
const customGenreAccent2 = document.querySelector('#custom-genre-accent-2');
const customGenreAccent2Value = document.querySelector('#custom-genre-accent-2-value');
const customGenreHot = document.querySelector('#custom-genre-hot');
const customGenreHotValue = document.querySelector('#custom-genre-hot-value');
const customGenreColorEditor = document.querySelector('#custom-genre-color-editor');
const customGenreColorEditorTitle = document.querySelector('#custom-genre-color-editor-title');
const customGenreColorEditorClose = document.querySelector('#custom-genre-color-editor-close');
const customGenreColorField = document.querySelector('#custom-genre-color-field');
const customGenreColorFieldThumb = document.querySelector('#custom-genre-color-field-thumb');
const customGenreColorHue = document.querySelector('#custom-genre-color-hue');
const customGenreColorHex = document.querySelector('#custom-genre-color-hex');
const customGenreColorsReset = document.querySelector('#custom-genre-colors-reset');
const customGenreAliases = document.querySelector('#custom-genre-aliases');
const customGenreArtists = document.querySelector('#custom-genre-artists');
const customGenreSave = document.querySelector('#custom-genre-save');
const customGenreCancel = document.querySelector('#custom-genre-cancel');
const customGenreState = document.querySelector('#custom-genre-state');
const customGenreList = document.querySelector('#custom-genre-list');
const customGenrePanel = document.querySelector('#custom-genre-panel');
const settingsSourcesPanel = document.querySelector('#settings-sources-panel');
const genreDataExport = document.querySelector('#genre-data-export');
const genreDataImport = document.querySelector('#genre-data-import');
const genreDataState = document.querySelector('#genre-data-state');
const capsuleBackgroundSetting = document.querySelector('#capsule-background-setting');
const posterBackgroundSetting = document.querySelector('#poster-background-setting');
const layoutModeSetting = document.querySelector('#layout-mode-setting');
const capsuleEnglishFontSetting = document.querySelector('#capsule-english-font-setting');
const capsuleEnglishFontToggle = document.querySelector('#capsule-english-font-toggle');
const posterEnglishFontSetting = document.querySelector('#poster-english-font-setting');
const posterEnglishFontToggle = document.querySelector('#poster-english-font-toggle');
const fullscreenEnglishFontSetting = document.querySelector('#fullscreen-english-font-setting');
const fullscreenEnglishFontToggle = document.querySelector('#fullscreen-english-font-toggle');
const uiScaleSetting = document.querySelector('#ui-scale-setting');
const appearanceGeneralSection = document.querySelector('#appearance-general-section');
const appearanceLayoutSection = document.querySelector('#appearance-layout-section');
const capsuleThemedBackgroundToggle = document.querySelector('#capsule-themed-background-toggle');
const posterThemedBackgroundToggle = document.querySelector('#poster-themed-background-toggle');
const languageButton = document.querySelector('#language-button');
const languageValue = document.querySelector('#language-value');
const languageMenu = document.querySelector('#language-menu');
const languageOptions = [...document.querySelectorAll('.language-option')];
const controls = document.querySelector('#controls');
const transport = document.querySelector('#transport');
const snapshotQuickButton = document.querySelector('#snapshot-quick-button');
const snapshotQuickButtonToggle = document.querySelector('#snapshot-quick-button-toggle');
const snapshotSaveButton = document.querySelector('#snapshot-save-button');
const snapshotState = document.querySelector('#snapshot-state');
const fullscreenQuickButton = document.querySelector('#fullscreen-quick-button');
const fullscreenControls = document.querySelector('#fullscreen-controls');
const fullscreenTransport = document.querySelector('#fullscreen-transport');
const fullscreenPreviousTrackButton = document.querySelector('#fullscreen-previous-track');
const fullscreenPlayPauseButton = document.querySelector('#fullscreen-play-pause');
const fullscreenNextTrackButton = document.querySelector('#fullscreen-next-track');
const fullscreenSnapshotButton = document.querySelector('#fullscreen-snapshot-button');
const fullscreenRecordingButton = document.querySelector('#fullscreen-recording-button');
const fullscreenSettingsButton = document.querySelector('#fullscreen-settings-button');
const fullscreenLayoutButton = document.querySelector('#fullscreen-layout-button');
const fullscreenTextButton = document.querySelector('#fullscreen-text-button');
const fullscreenExitButton = document.querySelector('#fullscreen-exit-button');
const stageOutputEntrySetting = document.querySelector('#stage-output-entry-setting');
const stageOutputStartStop = document.querySelector('#stage-output-start-stop');
const stageOutputStateLabel = document.querySelector('#stage-output-state');
const stageOutputTextSetting = document.querySelector('#stage-output-text-setting');
const stageOutputTextToggle = document.querySelector('#stage-output-text-toggle');
const recordingQuickButton = document.querySelector('#recording-quick-button');
const recordingQuickButtonSetting = document.querySelector('#recording-quick-button-setting');
const recordingQuickButtonToggle = document.querySelector('#recording-quick-button-toggle');
const snapshotQuickButtonSetting = document.querySelector('#snapshot-quick-button-setting');
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
const artistGenreReferenceToggle = document.querySelector('#artist-genre-reference-toggle');
const localGenreModelSetting = document.querySelector('#local-genre-model-setting');
const localGenreModelToggle = document.querySelector('#local-genre-model-toggle');
const dynamicGenreDetectionSetting = document.querySelector('#dynamic-genre-detection-setting');
const dynamicGenreDetectionToggle = document.querySelector('#dynamic-genre-detection-toggle');
const alwaysOnTopToggle = document.querySelector('#always-on-top-toggle');
const desktopLayerToggle = document.querySelector('#desktop-layer-toggle');
const mousePassthroughToggle = document.querySelector('#mouse-passthrough-toggle');
const launchAtLoginToggle = document.querySelector('#launch-at-login-toggle');
const credentialsSave = document.querySelector('#credentials-save');
const credentialsState = document.querySelector('#credentials-state');
const diagnosticsPanel = document.querySelector('#diagnostics-panel');
const diagnosticsPlayer = document.querySelector('#diagnostics-player');
const diagnosticsAudio = document.querySelector('#diagnostics-audio');
const diagnosticsRhythm = document.querySelector('#diagnostics-rhythm');
const diagnosticsGenreModel = document.querySelector('#diagnostics-genre-model');
const diagnosticsGenre = document.querySelector('#diagnostics-genre');
const diagnosticsLyrics = document.querySelector('#diagnostics-lyrics');
const diagnosticsRecapture = document.querySelector('#diagnostics-recapture');
const diagnosticsExport = document.querySelector('#diagnostics-export');
const diagnosticsState = document.querySelector('#diagnostics-state');
const showFpsToggle = document.querySelector('#show-fps-toggle');
const recordingStartStop = document.querySelector('#recording-start-stop');
const recordingState = document.querySelector('#recording-state');
const recordingToast = document.querySelector('#recording-toast');
const recordingToastText = document.querySelector('#recording-toast-text');
const recordingToastClose = document.querySelector('#recording-toast-close');
const coreArt = document.querySelector('#core-art');
const riffStrings = document.querySelector('#riff-strings');
const riffStringsContext = riffStrings.getContext('2d');
const kawaiiFace = document.querySelector('#kawaii-face');
const tanocFace = document.querySelector('#tanoc-face');

function createSynthStars() {
  document.querySelectorAll('.synth-starfield').forEach((field) => {
    const near = field.classList.contains('synth-starfield--near');
    const count = near ? 18 : 56;
    let seed = near ? 0x51f15e : 0x83ac7d;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const stars = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const star = document.createElement('b');
      const toneRoll = random();
      star.className = `synth-star synth-star--${toneRoll > 0.78 ? 'pink' : toneRoll > 0.52 ? 'cyan' : 'white'}`;
      const size = near ? 1.3 + random() * 1.5 : 0.65 + random() * 0.9;
      const duration = 1.7 + random() * 4.5;
      star.style.setProperty('--star-x', `${(2 + random() * 96).toFixed(3)}%`);
      // Bias the field upward: only a few dim stars reach the last fifth of
      // the sky, so the sunset horizon remains open instead of forming a row.
      star.style.setProperty('--star-y', `${(3 + Math.pow(random(), 1.8) * 84).toFixed(3)}%`);
      star.style.setProperty('--star-size', `${size.toFixed(3)}px`);
      star.style.setProperty('--star-alpha', (0.5 + random() * 0.5).toFixed(3));
      star.style.setProperty('--star-duration', `${duration.toFixed(3)}s`);
      star.style.setProperty('--star-delay', `${(-random() * duration).toFixed(3)}s`);
      stars.append(star);
    }
    field.replaceChildren(stars);
  });
}

createSynthStars();

const i18n = window.GenrePoliceI18n;
const LANGUAGE_NAMES = Object.freeze({ 'zh-CN': '简体中文', en: 'English', ja: '日本語', ko: '한국어' });
let uiLanguage = i18n?.DEFAULT_LOCALE || 'zh-CN';
let layoutMode = 'side';
let capsuleCondensedEnglish = false;
let posterCondensedEnglish = true;
let fullscreenCondensedEnglish = false;
let capsuleThemedBackground = true;
let posterThemedBackground = true;
let motionMode = 'standard';
let idleBehavior = 'keep';
let idleFrameLimitEnabled = true;
let rhythmModelEnabled = true;
let captureAudioSourceId = 'system';
let captureAudioSources = [{ id: 'system', kind: 'system', label: '' }];
let visualResponseMode = 'standard';
let preferredMediaSource = '';
let ignoredMediaSources = [];
let availableMediaSources = [];
let currentMediaSource = '';
let detectedMediaPlayers = { neteaseRunning: false, neteaseSmtcAvailable: false };
let neteaseSmtcToastShown = false;
let customGenres = [];
let genreArtistRules = [];
let editingCustomGenreId = '';
let pendingCustomGenreDeleteId = '';
let activeCustomGenreColorControl = null;
let customGenreColorHsv = { h: 0, s: 0, v: 1 };
let latestRhythmModelState = { type: 'unavailable' };
let latestAudioGenreModelState = { type: 'unavailable', reason: 'not started' };
let latestAudioGenreAnalyzing = false;
let diagnosticsRefreshTimer = 0;
let recordingPresentationActive = false;
let recordingToastTimer = 0;
let recordingUiSnapshot = { state: 'idle' };
let restoreSettingsAfterRecording = false;
let recordingOverlayGeometry = null;
let recordingOverlayVisible = false;
let stageOutputActive = false;
let stageOutputBusy = false;
let stageOutputTextVisible = true;
let stageOutputRestoreLayoutMode = '';
let fullscreenLayoutMode = 'split';
let recordingQuickButtonVisible = false;
let snapshotQuickButtonVisible = false;
let snapshotSaving = false;
let genreQuickData = null;
let genreQuickSelectedId = '';
const tr = (key, variables) => i18n?.translate(uiLanguage, key, variables) || key;
const trMain = (key, variables) => i18n?.translate('en', key, variables) || key;

const audio = new AudioEngine();
const visual = new VisualEngine(canvas);
const kawaiiExpression = new KawaiiExpressionTracker();
const recorder = new VisualizationRecorder({
  bridge: window.genrePolice,
  audioTrackProvider: () => audio.createRecordingTrack(),
  presentationChanged: setRecordingPresentation,
  stateChanged: updateRecordingUi
});

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
let lastFullscreenBackdropStyleAt = 0;
let previousAnimationTime = 0;
let lastAnimationWorkAt = 0;
let renderPerformanceStartedAt = 0;
let renderPerformanceWarmupUntil = 0;
let renderPerformanceContext = '';
let renderFrameIntervals = [];
let renderDurations = [];
let renderWorkDurations = [];
let adaptiveResolutionScale = 1;
let adaptiveLowFpsWindows = 0;
let adaptiveHighFpsWindows = 0;
const adaptiveResolutionProfiles = new Map();
let showFps = false;
let fpsCounterStartedAt = 0;
let fpsCounterFrameCount = 0;
let idleSettleTimer = 0;
let mediaControlSerial = 0;
let optimisticPlaybackIcon = null;
let genreOptions = [];
let settingsScrollbarDrag = null;
let activeSettingsPane = 'appearance';
let riffPluckAt = -Infinity;
let riffPluckStrength = 0;
let riffPluckDirection = 1;
let lyricLines = [];
let lyricIndex = -2;
let lyricAnimatedUnits = [];
let lyricReflowAnimation = null;
let lyricRevealAnimation = null;
let activeLyricMotionUnit = null;
let titlePanAnimation = null;
let titlePanSignature = '';
let lyricTextWidth = 1;
let lyricTranslationWidth = 1;
let lyricFadeWidth = 14;
let lyricTranslationFadeWidth = 8;
let lyricsEnabled = true;
let lyricTranslationEnabled = true;
let lyricSweepEnabled = true;
let onlineGenreLookupEnabled = true;
let artistGenreReferenceEnabled = true;
let localGenreModelEnabled = true;
let localGenreModelAvailable = true;
let dynamicGenreDetectionEnabled = false;
let alwaysOnTopEnabled = false;
let desktopLayerEnabled = false;
let desktopLayerAvailable = true;
let mousePassthroughEnabled = false;
let launchAtLoginEnabled = false;
let latestUpdateResult = null;
let pendingUpdateResult = null;
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
  'gabber', 'frenchcore', 'uptempo-hardcore', 'puzzycore',
  'industrial-hardcore', 'rawstyle'
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
  const label = playing ? tr('controls.pause') : tr('controls.play');
  [playPauseButton, fullscreenPlayPauseButton].forEach((button) => {
    button.classList.toggle('is-playing', Boolean(playing));
    button.title = label;
    button.setAttribute('aria-label', label);
  });
  if (recordingPresentationActive) syncRecordingControlsOverlay(recordingOverlayVisible);
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
    refreshPresentationTypography();
  });
  renderFullscreenControls();
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
    refreshPresentationTypography();
  });
  renderFullscreenControls();
  if (persist) window.genrePolice.setConfig({ capsuleCondensedEnglish }).catch(() => {});
}

function setFullscreenCondensedEnglish(enabled, { persist = false } = {}) {
  fullscreenCondensedEnglish = enabled === true;
  document.body.dataset.fullscreenEnglish = fullscreenCondensedEnglish ? 'condensed' : 'regular';
  fullscreenEnglishFontToggle.setAttribute('aria-checked', String(fullscreenCondensedEnglish));
  fullscreenEnglishFontToggle.title = fullscreenCondensedEnglish
    ? tr('settings.fullscreenCondensedEnglishOn')
    : tr('settings.fullscreenCondensedEnglishOff');
  requestAnimationFrame(() => {
    updateTitleOverflow();
    const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
    if (visibleLyric || lyricCurrentBase.textContent) {
      setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
        translation: visibleLyric?.translation || lyricTranslation.dataset.text || '',
        animateLayout: false
      });
    }
    refreshPresentationTypography();
  });
  if (persist) window.genrePolice.setConfig({ fullscreenCondensedEnglish }).catch(() => {});
}

function updateBackgroundStyle() {
  const themed = stageOutputActive
    || recordingPresentationActive
    || (layoutMode === 'poster' ? posterThemedBackground : capsuleThemedBackground);
  const nextStyle = themed ? 'themed' : 'adaptive';
  if (document.body.dataset.backgroundStyle !== nextStyle) {
    document.body.dataset.backgroundStyle = nextStyle;
  }
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

function setArtistGenreReferenceEnabled(enabled, { persist = false } = {}) {
  artistGenreReferenceEnabled = enabled !== false;
  artistGenreReferenceToggle.setAttribute('aria-checked', String(artistGenreReferenceEnabled));
  artistGenreReferenceToggle.title = artistGenreReferenceEnabled
    ? tr('settings.artistGenreReferenceOn')
    : tr('settings.artistGenreReferenceOff');
  if (persist) {
    window.genrePolice.setConfig({ artistGenreReferenceEnabled }).then((result) => {
      if (typeof result?.artistGenreReferenceEnabled === 'boolean') {
        setArtistGenreReferenceEnabled(result.artistGenreReferenceEnabled);
      }
    }).catch(() => setArtistGenreReferenceEnabled(!artistGenreReferenceEnabled));
  }
}

function updateLocalGenreSettingState() {
  localGenreModelToggle.disabled = !localGenreModelAvailable;
  localGenreModelSetting.classList.toggle('is-unavailable', !localGenreModelAvailable);
  localGenreModelToggle.setAttribute('aria-checked', String(localGenreModelEnabled));
  localGenreModelToggle.title = !localGenreModelAvailable
    ? tr('settings.localGenreModelUnavailable')
    : localGenreModelEnabled
      ? tr('settings.localGenreModelOn')
      : tr('settings.localGenreModelOff');
  dynamicGenreDetectionSetting.hidden = !localGenreModelAvailable || !localGenreModelEnabled;
  dynamicGenreDetectionToggle.setAttribute('aria-checked', String(dynamicGenreDetectionEnabled));
  dynamicGenreDetectionToggle.title = dynamicGenreDetectionEnabled
    ? tr('settings.dynamicGenreDetectionOn')
    : tr('settings.dynamicGenreDetectionOff');
}

function setDynamicGenreDetectionEnabled(enabled, { persist = false } = {}) {
  dynamicGenreDetectionEnabled = localGenreModelAvailable
    && localGenreModelEnabled
    && enabled === true;
  updateLocalGenreSettingState();
  if (persist) {
    window.genrePolice.setConfig({ dynamicGenreDetectionEnabled }).then((result) => {
      if (typeof result?.dynamicGenreDetectionEnabled === 'boolean') {
        setDynamicGenreDetectionEnabled(result.dynamicGenreDetectionEnabled);
      }
    }).catch(() => setDynamicGenreDetectionEnabled(!dynamicGenreDetectionEnabled));
  }
}

function setLocalGenreModelEnabled(enabled, { persist = false, available = localGenreModelAvailable } = {}) {
  localGenreModelAvailable = available !== false;
  localGenreModelEnabled = enabled !== false;
  if (!localGenreModelEnabled || !localGenreModelAvailable) dynamicGenreDetectionEnabled = false;
  updateLocalGenreSettingState();
  audio.setLocalGenreModelEnabled(localGenreModelEnabled && localGenreModelAvailable);
  if (persist && localGenreModelAvailable) {
    const patch = { localGenreModelEnabled };
    if (!localGenreModelEnabled) patch.dynamicGenreDetectionEnabled = false;
    window.genrePolice.setConfig(patch).then((result) => {
      if (typeof result?.localGenreModelEnabled !== 'boolean') return;
      dynamicGenreDetectionEnabled = result.dynamicGenreDetectionEnabled === true;
      setLocalGenreModelEnabled(result.localGenreModelEnabled, {
        available: result.localGenreModelAvailable !== false
      });
    }).catch(() => setLocalGenreModelEnabled(!localGenreModelEnabled));
  }
}

function setAlwaysOnTopEnabled(enabled, { persist = false } = {}) {
  alwaysOnTopEnabled = enabled === true;
  alwaysOnTopToggle.setAttribute('aria-checked', String(alwaysOnTopEnabled));
  alwaysOnTopToggle.title = alwaysOnTopEnabled
    ? tr('settings.alwaysOnTopOn')
    : tr('settings.alwaysOnTopOff');
  if (persist) {
    window.genrePolice.setConfig({ alwaysOnTop: alwaysOnTopEnabled }).then((result) => {
      if (typeof result?.alwaysOnTop === 'boolean') setAlwaysOnTopEnabled(result.alwaysOnTop);
      if (typeof result?.desktopLayer === 'boolean') {
        setDesktopLayerEnabled(result.desktopLayer, { available: result.desktopLayerAvailable !== false });
      }
    }).catch(() => setAlwaysOnTopEnabled(!alwaysOnTopEnabled));
  }
}

function setDesktopLayerEnabled(enabled, { persist = false, available = desktopLayerAvailable } = {}) {
  desktopLayerAvailable = available === true;
  desktopLayerEnabled = enabled === true && desktopLayerAvailable;
  desktopLayerToggle.disabled = !desktopLayerAvailable;
  desktopLayerToggle.setAttribute('aria-checked', String(desktopLayerEnabled));
  desktopLayerToggle.title = desktopLayerEnabled
    ? tr('settings.desktopLayerOn')
    : tr('settings.desktopLayerOff');
  if (persist && desktopLayerAvailable) {
    window.genrePolice.setConfig({ desktopLayer: desktopLayerEnabled }).then((result) => {
      if (typeof result?.desktopLayer === 'boolean') {
        setDesktopLayerEnabled(result.desktopLayer, { available: result.desktopLayerAvailable !== false });
      }
      if (typeof result?.alwaysOnTop === 'boolean') setAlwaysOnTopEnabled(result.alwaysOnTop);
    }).catch(() => setDesktopLayerEnabled(!desktopLayerEnabled));
  }
}

function setRecordingQuickButtonVisible(enabled, { persist = false } = {}) {
  recordingQuickButtonVisible = enabled === true;
  recordingQuickButton.hidden = !recordingQuickButtonVisible;
  fullscreenRecordingButton.hidden = !recordingQuickButtonVisible;
  recordingQuickButtonToggle.setAttribute('aria-checked', String(recordingQuickButtonVisible));
  recordingQuickButtonToggle.title = recordingQuickButtonVisible
    ? tr('settings.recordingQuickButtonOn')
    : tr('settings.recordingQuickButtonOff');
  recordingOverlayGeometry = null;
  if (persist) {
    window.genrePolice.setConfig({ recordingQuickButtonVisible }).then((result) => {
      if (typeof result?.recordingQuickButtonVisible === 'boolean') {
        setRecordingQuickButtonVisible(result.recordingQuickButtonVisible);
      }
    }).catch(() => setRecordingQuickButtonVisible(!recordingQuickButtonVisible));
  }
}

function setSnapshotQuickButtonVisible(enabled, { persist = false } = {}) {
  snapshotQuickButtonVisible = enabled === true;
  snapshotQuickButton.hidden = !snapshotQuickButtonVisible;
  fullscreenSnapshotButton.hidden = !snapshotQuickButtonVisible;
  snapshotQuickButtonToggle.setAttribute('aria-checked', String(snapshotQuickButtonVisible));
  snapshotQuickButtonToggle.title = snapshotQuickButtonVisible
    ? tr('settings.snapshotQuickButtonOn')
    : tr('settings.snapshotQuickButtonOff');
  stageOutputTextToggle.title = stageOutputTextVisible
    ? tr('settings.stageOutputTextOn')
    : tr('settings.stageOutputTextOff');
  if (persist) {
    window.genrePolice.setConfig({ snapshotQuickButtonVisible }).then((result) => {
      if (typeof result?.snapshotQuickButtonVisible === 'boolean') {
        setSnapshotQuickButtonVisible(result.snapshotQuickButtonVisible);
      }
    }).catch(() => setSnapshotQuickButtonVisible(!snapshotQuickButtonVisible));
  }
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

function setIdleFrameLimitEnabled(enabled, { persist = false } = {}) {
  idleFrameLimitEnabled = enabled !== false;
  idleFrameLimitToggle.setAttribute('aria-checked', String(idleFrameLimitEnabled));
  lastAnimationWorkAt = 0;
  if (persist) window.genrePolice.setConfig({ idleFrameLimitEnabled }).catch(() => {});
}

function setShowFps(enabled, { persist = false } = {}) {
  showFps = enabled === true;
  showFpsToggle.setAttribute('aria-checked', String(showFps));
  showFpsToggle.title = showFps ? tr('settings.showFpsOn') : tr('settings.showFpsOff');
  fpsCounter.hidden = !showFps;
  fpsCounterValue.textContent = '--';
  fpsCounter.removeAttribute('data-status');
  fpsCounterStartedAt = 0;
  fpsCounterFrameCount = 0;
  if (persist) window.genrePolice.setConfig({ showFps }).catch(() => {});
}

function updateFpsCounter(time) {
  if (!showFps || document.hidden) {
    fpsCounterStartedAt = 0;
    fpsCounterFrameCount = 0;
    return;
  }
  if (!fpsCounterStartedAt) {
    fpsCounterStartedAt = time;
    fpsCounterFrameCount = 0;
    return;
  }
  fpsCounterFrameCount += 1;
  const elapsed = time - fpsCounterStartedAt;
  if (elapsed < 500) return;
  const fps = fpsCounterFrameCount * 1000 / Math.max(1, elapsed);
  fpsCounterValue.textContent = String(Math.round(fps));
  fpsCounter.dataset.status = fps < 45 ? 'low' : fps < 56 ? 'mid' : 'good';
  fpsCounterStartedAt = time;
  fpsCounterFrameCount = 0;
}

function setRhythmModelEnabled(enabled, { persist = false } = {}) {
  rhythmModelEnabled = enabled !== false;
  rhythmModelToggle.setAttribute('aria-checked', String(rhythmModelEnabled));
  rhythmModelToggle.title = rhythmModelEnabled
    ? tr('settings.rhythmModelOn')
    : tr('settings.rhythmModelOff');
  audio.setRhythmModelEnabled(rhythmModelEnabled);
  updateDiagnosticsUi();
  if (persist) {
    window.genrePolice.setConfig({ rhythmModelEnabled }).then((result) => {
      if (typeof result?.rhythmModelEnabled === 'boolean') {
        setRhythmModelEnabled(result.rhythmModelEnabled);
      }
    }).catch(() => setRhythmModelEnabled(!rhythmModelEnabled));
  }
}

function captureAudioSourceName(source) {
  if (!source || source.id === 'system') return tr('settings.audioSourceSystem');
  return String(source.label || '').trim()
    || tr('settings.audioInputNumber', { number: source.inputNumber || 1 });
}

function captureAudioSourceOptions() {
  return [...captureAudioSourceMenu.querySelectorAll('.audio-source-option')];
}

function renderCaptureAudioSources() {
  const selected = captureAudioSources.find((source) => source.id === captureAudioSourceId)
    || { id: captureAudioSourceId, kind: 'input', label: '', inputNumber: 1 };
  captureAudioSourceValue.textContent = captureAudioSourceName(selected);
  captureAudioSourceButton.title = captureAudioSourceName(selected);
  captureAudioSourceMenu.replaceChildren();
  for (const source of captureAudioSources) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'audio-source-option';
    option.dataset.audioSource = source.id;
    option.textContent = captureAudioSourceName(source);
    option.title = source.label || option.textContent;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(source.id === captureAudioSourceId));
    captureAudioSourceMenu.append(option);
  }
}

async function refreshCaptureAudioSources(sources = null) {
  captureAudioSources = Array.isArray(sources) && sources.length
    ? sources
    : await audio.audioSources();
  renderCaptureAudioSources();
}

function setCaptureAudioSourceMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    setCustomGenreVisualMenuOpen(false);
    setGenreArtistMenuOpen(false);
    void refreshCaptureAudioSources().then(() => {
      if (!focus || captureAudioSourceMenu.hidden) return;
      const options = captureAudioSourceOptions();
      const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0];
      selected?.focus();
    });
  }
  captureAudioSourceMenu.hidden = !nextOpen;
  captureAudioSourceButton.setAttribute('aria-expanded', String(nextOpen));
}

async function chooseCaptureAudioSource(sourceId) {
  setCaptureAudioSourceMenuOpen(false);
  captureAudioSourceButton.disabled = true;
  try {
    captureAudioSourceId = await audio.setAudioSource(sourceId);
    await window.genrePolice.setConfig({ audioSourceId: captureAudioSourceId });
  } catch {
    captureAudioSourceId = 'system';
    window.genrePolice.setConfig({ audioSourceId: captureAudioSourceId }).catch(() => {});
  } finally {
    captureAudioSourceButton.disabled = false;
    await refreshCaptureAudioSources();
    captureAudioSourceButton.focus();
    updateDiagnosticsUi();
  }
}

function setVisualResponseMode(value, { persist = false } = {}) {
  visualResponseMode = normalizeVisualResponseMode(value);
  visualResponseOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.visualResponse === visualResponseMode));
  });
  if (persist) window.genrePolice.setConfig({ visualResponseMode }).catch(() => {});
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
  const missingNeteaseSmtc = detectedMediaPlayers.neteaseRunning
    && !detectedMediaPlayers.neteaseSmtcAvailable;
  neteaseSmtcHint.hidden = !missingNeteaseSmtc;
  updateNeteaseSmtcToast(missingNeteaseSmtc);
  updateDiagnosticsUi();
}

function dismissNeteaseSmtcToast() {
  neteaseSmtcToast.hidden = true;
  showPendingUpdateToast();
}

function updateNeteaseSmtcToast(missingNeteaseSmtc) {
  if (!missingNeteaseSmtc) {
    dismissNeteaseSmtcToast();
    return;
  }
  if (neteaseSmtcToastShown) return;
  neteaseSmtcToastShown = true;
  if (!settings.hidden) return;
  if (!updateToast.hidden) {
    pendingUpdateResult = latestUpdateResult;
    updateToast.hidden = true;
  }
  neteaseSmtcToast.hidden = false;
}

function normalizedUpdateResult(value) {
  const status = ['available', 'current', 'checking', 'error', 'skipped'].includes(value?.status)
    ? value.status
    : 'error';
  return {
    status,
    currentVersion: String(value?.currentVersion || '').slice(0, 48),
    latestVersion: String(value?.latestVersion || '').slice(0, 48),
    releaseUrl: String(value?.releaseUrl || '').slice(0, 512)
  };
}

function renderUpdateUi() {
  const result = latestUpdateResult;
  updateViewButton.hidden = result?.status !== 'available';
  updateCheckState.textContent = result?.status === 'checking'
    ? tr('updates.checking')
    : result?.status === 'current'
      ? tr('updates.current')
      : result?.status === 'available'
        ? tr('updates.available', { version: result.latestVersion })
        : result?.status === 'error'
          ? tr('updates.failed')
          : '';
  if (result?.status === 'available') {
    updateToastMessage.textContent = tr('updates.availableMessage', {
      version: result.latestVersion
    });
  }
}

function updateToastBlocked() {
  return !settings.hidden || !recordingToast.hidden || !neteaseSmtcToast.hidden;
}

function showPendingUpdateToast() {
  if (!pendingUpdateResult || updateToastBlocked()) return;
  const result = pendingUpdateResult;
  pendingUpdateResult = null;
  showUpdateToast(result);
}

function showUpdateToast(value) {
  const result = normalizedUpdateResult(value);
  latestUpdateResult = result;
  renderUpdateUi();
  if (result.status !== 'available') return;
  if (updateToastBlocked()) {
    pendingUpdateResult = result;
    return;
  }
  pendingUpdateResult = null;
  updateToast.hidden = false;
}

function hideUpdateToast({ clearPending = false } = {}) {
  updateToast.hidden = true;
  if (clearPending) pendingUpdateResult = null;
}

async function openAvailableUpdate({ acknowledge = false } = {}) {
  const result = latestUpdateResult;
  if (result?.status !== 'available') return;
  if (acknowledge) {
    hideUpdateToast({ clearPending: true });
    await window.genrePolice.dismissUpdate(result.latestVersion).catch(() => {});
  }
  await window.genrePolice.openUpdatePage(result.releaseUrl).catch(() => {});
}

async function checkForUpdatesManually() {
  updateCheckButton.disabled = true;
  updateCheckButton.setAttribute('aria-busy', 'true');
  latestUpdateResult = normalizedUpdateResult({ status: 'checking' });
  renderUpdateUi();
  try {
    latestUpdateResult = normalizedUpdateResult(await window.genrePolice.checkForUpdates());
  } catch {
    latestUpdateResult = normalizedUpdateResult({ status: 'error' });
  } finally {
    updateCheckButton.disabled = false;
    updateCheckButton.removeAttribute('aria-busy');
    renderUpdateUi();
    requestAnimationFrame(updateSettingsScrollbar);
  }
}

function setMediaSources(payload = {}) {
  availableMediaSources = Array.isArray(payload.sources) ? payload.sources.filter(Boolean) : availableMediaSources;
  if (typeof payload.currentSource === 'string') currentMediaSource = payload.currentSource;
  if (typeof payload.preferredSource === 'string') preferredMediaSource = payload.preferredSource;
  if (Array.isArray(payload.ignoredSources)) ignoredMediaSources = payload.ignoredSources.filter(Boolean);
  if (payload.detectedPlayers && typeof payload.detectedPlayers === 'object') {
    detectedMediaPlayers = {
      neteaseRunning: payload.detectedPlayers.neteaseRunning === true,
      neteaseSmtcAvailable: payload.detectedPlayers.neteaseSmtcAvailable === true
    };
  }
  renderMediaSourceSettings();
  renderLocalizedHud();
}

function splitCustomGenreTerms(value) {
  const seen = new Set();
  return String(value || '')
    .split(/[,，、;；\n]+/u)
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function customGenreOptionLabel(option) {
  return option?.parent ? `${option.label} · ${option.parent}` : option?.label || '';
}

function genreArtistKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, ' ')
    .trim();
}

function genreArtistOptions() {
  return [...genreArtistGenreMenu.querySelectorAll('.genre-artist-genre-option')];
}

function renderGenreArtistOptions(selectedId = genreArtistGenre.value) {
  const selected = genreOptions.find((genre) => genre.id === selectedId && genre.id !== 'unknown') || null;
  genreArtistGenreMenu.replaceChildren();
  for (const genre of genreOptions.filter((option) => option.id !== 'unknown')) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'genre-artist-genre-option';
    option.dataset.genreId = genre.id;
    option.textContent = customGenreOptionLabel(genre);
    option.title = option.textContent;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(genre.id === selected?.id));
    genreArtistGenreMenu.append(option);
  }
  genreArtistGenre.value = selected?.id || '';
  genreArtistGenreValue.textContent = selected
    ? customGenreOptionLabel(selected)
    : tr('settings.genreArtistChooseGenre');
}

function renderGenreArtistRules() {
  renderGenreArtistOptions(genreArtistGenre.value);
  genreArtistList.replaceChildren();
  if (!genreArtistRules.length) {
    const empty = document.createElement('small');
    empty.className = 'custom-genre-empty';
    empty.textContent = tr('settings.genreArtistEmpty');
    genreArtistList.append(empty);
  }
  genreArtistRules.forEach((rule, index) => {
    const row = document.createElement('div');
    row.className = 'custom-genre-item genre-artist-item';
    row.dataset.ruleIndex = String(index);
    const copy = document.createElement('div');
    const artist = document.createElement('strong');
    artist.textContent = rule.artist;
    const genre = genreOptions.find((option) => option.id === rule.genreId);
    const summary = document.createElement('small');
    summary.textContent = genre?.label || rule.genreId;
    copy.append(artist, summary);
    const actions = document.createElement('div');
    actions.className = 'custom-genre-item-actions';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.action = 'delete';
    remove.title = tr('actions.delete');
    remove.setAttribute('aria-label', `${tr('actions.delete')} ${rule.artist}`);
    remove.innerHTML = customGenreIcon('M4.5 5.5h11M8 5.5V3.8h4v1.7M6 5.5l.7 10h6.6l.7-10M8.5 8v5M11.5 8v5');
    actions.append(remove);
    row.append(copy, actions);
    genreArtistList.append(row);
  });
  requestAnimationFrame(updateSettingsScrollbar);
}

async function persistGenreArtistRules(nextRules) {
  const result = await window.genrePolice.setConfig({ genreArtistRules: nextRules });
  if (!result?.ok) throw new Error('genre artist rule save failed');
  genreArtistRules = Array.isArray(result.genreArtistRules) ? result.genreArtistRules : nextRules;
  renderGenreArtistRules();
}

function customGenreColorsEnabled() {
  return customGenreColorsToggle.getAttribute('aria-checked') === 'true';
}

function selectedCustomGenreThemeColors() {
  const selected = genreOptions.find((genre) => genre.id === customGenreVisual.value);
  return {
    accent: selected?.accent || '#67f7ff',
    accent2: selected?.accent2 || '#8d76ff',
    hot: selected?.hot || '#ffffff'
  };
}

function normalizeCustomColorHex(value) {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return '';
  const hex = match[1].length === 3
    ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
    : match[1];
  return `#${hex.toLowerCase()}`;
}

function hexToHsv(value) {
  const hex = normalizeCustomColorHex(value) || '#000000';
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return {
    h: (hue + 360) % 360,
    s: max ? delta / max : 0,
    v: max
  };
}

function hsvToHex({ h, s, v }) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clamp(Number(s));
  const value = clamp(Number(v));
  const chroma = value * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = value - chroma;
  const channels = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  return `#${channels.map((channel) => Math.round((channel + offset) * 255)
    .toString(16).padStart(2, '0')).join('')}`;
}

function customGenreColorOutput(control) {
  if (control === customGenreAccent) return customGenreAccentValue;
  if (control === customGenreAccent2) return customGenreAccent2Value;
  return customGenreHotValue;
}

function setCustomGenreColorValue(control, output, value, { syncEditor = true } = {}) {
  const color = normalizeCustomColorHex(value);
  if (!color) return false;
  control.value = color;
  control.querySelector('.custom-genre-color-swatch')?.style.setProperty('--swatch-color', color);
  control.setAttribute('aria-label', `${tr(control.dataset.labelKey)} ${color}`);
  output.value = color;
  output.textContent = color;
  if (syncEditor && activeCustomGenreColorControl === control) {
    customGenreColorHsv = hexToHsv(color);
    syncCustomGenreColorEditor();
  }
  return true;
}

function setCustomGenreColorInputs(colors = selectedCustomGenreThemeColors()) {
  const values = [
    [customGenreAccent, customGenreAccentValue, colors.accent],
    [customGenreAccent2, customGenreAccent2Value, colors.accent2],
    [customGenreHot, customGenreHotValue, colors.hot]
  ];
  for (const [input, output, value] of values) setCustomGenreColorValue(input, output, value);
}

function updateCustomGenreColorLabels() {
  for (const control of [customGenreAccent, customGenreAccent2, customGenreHot]) {
    control.setAttribute('aria-label', `${tr(control.dataset.labelKey)} ${control.value}`);
  }
  if (activeCustomGenreColorControl) {
    customGenreColorEditorTitle.textContent = tr(activeCustomGenreColorControl.dataset.labelKey);
  }
}

function syncCustomGenreColorEditor() {
  if (!activeCustomGenreColorControl) return;
  const { h, s, v } = customGenreColorHsv;
  customGenreColorEditor.style.setProperty('--picker-hue-color', `hsl(${h.toFixed(2)} 100% 50%)`);
  customGenreColorFieldThumb.style.left = `clamp(4px, ${(s * 100).toFixed(2)}%, calc(100% - 4px))`;
  customGenreColorFieldThumb.style.top = `clamp(4px, ${((1 - v) * 100).toFixed(2)}%, calc(100% - 4px))`;
  customGenreColorField.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  customGenreColorField.setAttribute('aria-valuetext', `${Math.round(s * 100)}%, ${Math.round(v * 100)}%`);
  customGenreColorHue.value = String(Math.round(h));
  customGenreColorHex.value = activeCustomGenreColorControl.value;
}

function updateActiveCustomGenreColor() {
  if (!activeCustomGenreColorControl) return;
  setCustomGenreColorValue(
    activeCustomGenreColorControl,
    customGenreColorOutput(activeCustomGenreColorControl),
    hsvToHex(customGenreColorHsv),
    { syncEditor: false }
  );
  syncCustomGenreColorEditor();
}

function closeCustomGenreColorEditor({ focus = false } = {}) {
  const previous = activeCustomGenreColorControl;
  activeCustomGenreColorControl = null;
  customGenreColorEditor.hidden = true;
  for (const control of [customGenreAccent, customGenreAccent2, customGenreHot]) {
    control.setAttribute('aria-expanded', 'false');
  }
  requestAnimationFrame(updateSettingsScrollbar);
  if (focus) previous?.focus();
}

function openCustomGenreColorEditor(control) {
  if (activeCustomGenreColorControl === control && !customGenreColorEditor.hidden) {
    closeCustomGenreColorEditor({ focus: true });
    return;
  }
  activeCustomGenreColorControl = control;
  customGenreColorHsv = hexToHsv(control.value);
  for (const item of [customGenreAccent, customGenreAccent2, customGenreHot]) {
    item.setAttribute('aria-expanded', String(item === control));
  }
  customGenreColorEditorTitle.textContent = tr(control.dataset.labelKey);
  customGenreColorEditor.hidden = false;
  syncCustomGenreColorEditor();
  requestAnimationFrame(() => {
    updateSettingsScrollbar();
    customGenreColorEditor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function setCustomGenreColorsEnabled(enabled, { restoreDefaults = false } = {}) {
  const active = Boolean(enabled);
  if (!active) closeCustomGenreColorEditor();
  if (restoreDefaults) setCustomGenreColorInputs();
  customGenreColorsToggle.setAttribute('aria-checked', String(active));
  customGenreColorPalette.hidden = !active;
  requestAnimationFrame(updateSettingsScrollbar);
}

function customGenreColorOverrides() {
  if (!customGenreColorsEnabled()) return null;
  return {
    accent: customGenreAccent.value,
    accent2: customGenreAccent2.value,
    hot: customGenreHot.value
  };
}

function renderCustomGenreVisualOptions(selectedId = customGenreVisual.value) {
  customGenreVisualMenu.replaceChildren();
  const preferred = genreOptions.some((genre) => genre.id === selectedId)
    ? selectedId
    : genreOptions.some((genre) => genre.id === 'electronic')
      ? 'electronic'
      : genreOptions[0]?.id || '';
  for (const genre of genreOptions) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'custom-genre-visual-option';
    option.dataset.genreId = genre.id;
    option.textContent = customGenreOptionLabel(genre);
    option.title = option.textContent;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(genre.id === preferred));
    customGenreVisualMenu.append(option);
  }
  customGenreVisual.value = preferred;
  customGenreVisualValue.textContent = customGenreOptionLabel(
    genreOptions.find((genre) => genre.id === preferred)
  );
  if (!customGenreColorsEnabled()) setCustomGenreColorInputs();
}

function customGenreIcon(path) {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${path}" /></svg>`;
}

function renderCustomGenres() {
  updateCustomGenreColorLabels();
  renderCustomGenreVisualOptions(customGenreVisual.value);
  customGenreList.replaceChildren();
  if (!customGenres.length) {
    const empty = document.createElement('small');
    empty.className = 'custom-genre-empty';
    empty.textContent = tr('settings.customGenreEmpty');
    customGenreList.append(empty);
  }
  for (const rule of customGenres) {
    const row = document.createElement('div');
    row.className = 'custom-genre-item';
    row.dataset.ruleId = rule.id;
    const copy = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = rule.name;
    const base = genreOptions.find((genre) => genre.id === rule.baseGenreId);
    const summary = document.createElement('small');
    summary.textContent = tr('settings.customGenreRuleSummary', {
      visual: base?.label || rule.baseGenreId,
      aliases: rule.aliases.length,
      artists: rule.artists.length
    });
    const detail = document.createElement('div');
    detail.className = 'custom-genre-item-detail';
    detail.append(summary);
    if (rule.colors) {
      const palette = document.createElement('span');
      palette.className = 'custom-genre-item-palette';
      palette.setAttribute('aria-label', tr('settings.customGenreColors'));
      for (const color of [rule.colors.accent, rule.colors.accent2, rule.colors.hot]) {
        const swatch = document.createElement('i');
        swatch.style.background = color;
        palette.append(swatch);
      }
      detail.append(palette);
    }
    copy.append(name, detail);
    const actions = document.createElement('div');
    actions.className = 'custom-genre-item-actions';
    if (pendingCustomGenreDeleteId === rule.id) {
      actions.classList.add('is-confirming');
      const confirmDelete = document.createElement('button');
      confirmDelete.type = 'button';
      confirmDelete.dataset.action = 'confirm-delete';
      confirmDelete.textContent = tr('actions.delete');
      confirmDelete.setAttribute('aria-label', `${tr('actions.delete')} ${rule.name}`);
      const cancelDelete = document.createElement('button');
      cancelDelete.type = 'button';
      cancelDelete.dataset.action = 'cancel-delete';
      cancelDelete.textContent = tr('actions.cancel');
      actions.append(confirmDelete, cancelDelete);
    } else {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.dataset.action = 'edit';
      edit.title = tr('actions.edit');
      edit.setAttribute('aria-label', `${tr('actions.edit')} ${rule.name}`);
      edit.innerHTML = customGenreIcon('M4 14.8 4.7 11 12.9 2.8a1.4 1.4 0 0 1 2 0l2.3 2.3a1.4 1.4 0 0 1 0 2L9 15.3 5.2 16zM11.7 4l4.3 4.3');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.action = 'delete';
      remove.title = tr('actions.delete');
      remove.setAttribute('aria-label', `${tr('actions.delete')} ${rule.name}`);
      remove.innerHTML = customGenreIcon('M4.5 5.5h11M8 5.5V3.8h4v1.7M6 5.5l.7 10h6.6l.7-10M8.5 8v5M11.5 8v5');
      actions.append(edit, remove);
    }
    row.append(copy, actions);
    customGenreList.append(row);
  }
  requestAnimationFrame(updateSettingsScrollbar);
}

function resetCustomGenreEditor({ clearState = false } = {}) {
  editingCustomGenreId = '';
  customGenreName.value = '';
  customGenreAliases.value = '';
  customGenreArtists.value = '';
  renderCustomGenreVisualOptions('electronic');
  setCustomGenreColorsEnabled(false, { restoreDefaults: true });
  customGenreSave.textContent = tr('actions.addCustomGenre');
  customGenreCancel.hidden = true;
  if (clearState) customGenreState.textContent = '';
}

function editCustomGenre(rule) {
  customGenrePanel.open = true;
  editingCustomGenreId = rule.id;
  customGenreName.value = rule.name;
  customGenreAliases.value = rule.aliases.join(', ');
  customGenreArtists.value = rule.artists.join(', ');
  renderCustomGenreVisualOptions(rule.baseGenreId);
  if (rule.colors) {
    setCustomGenreColorInputs(rule.colors);
    setCustomGenreColorsEnabled(true);
  } else {
    setCustomGenreColorsEnabled(false, { restoreDefaults: true });
  }
  customGenreSave.textContent = tr('actions.updateCustomGenre');
  customGenreCancel.hidden = false;
  customGenreState.textContent = '';
  requestAnimationFrame(() => {
    if (settingsScroll) {
      const top = settingsScroll.scrollTop
        + customGenrePanel.getBoundingClientRect().top
        - settingsScroll.getBoundingClientRect().top
        - 28;
      settingsScroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    customGenreName.focus({ preventScroll: true });
    updateSettingsScrollbar();
  });
}

async function persistCustomGenres(nextRules) {
  const result = await window.genrePolice.setConfig({ customGenres: nextRules });
  if (!result?.ok) throw new Error('custom genre save failed');
  customGenres = Array.isArray(result.customGenres) ? result.customGenres : nextRules;
  renderCustomGenres();
  if (document.activeElement === genreCorrectionInput) {
    renderGenreCorrectionSuggestions(genreCorrectionInput.value);
  }
}

function mediaSourceOptions() {
  return [...mediaSourceMenu.querySelectorAll('.media-source-option:not(:disabled)')];
}

function setMediaSourceMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setCaptureAudioSourceMenuOpen(false);
    setCustomGenreVisualMenuOpen(false);
    setGenreArtistMenuOpen(false);
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

function customGenreVisualOptions() {
  return [...customGenreVisualMenu.querySelectorAll('.custom-genre-visual-option')];
}

function setGenreArtistMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    setCustomGenreVisualMenuOpen(false);
  }
  genreArtistGenreMenu.hidden = !nextOpen;
  genreArtistGenre.setAttribute('aria-expanded', String(nextOpen));
  if (!nextOpen || !focus) return;
  const options = genreArtistOptions();
  const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0];
  selected?.focus();
  selected?.scrollIntoView({ block: 'nearest' });
}

function chooseGenreArtistGenre(genreId) {
  const selected = genreOptions.find((genre) => genre.id === genreId && genre.id !== 'unknown');
  if (!selected) return;
  genreArtistGenre.value = selected.id;
  genreArtistGenreValue.textContent = customGenreOptionLabel(selected);
  genreArtistOptions().forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.genreId === selected.id));
  });
  setGenreArtistMenuOpen(false);
  genreArtistGenre.focus();
}

function setCustomGenreVisualMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    setGenreArtistMenuOpen(false);
  }
  customGenreVisualMenu.hidden = !nextOpen;
  customGenreVisual.setAttribute('aria-expanded', String(nextOpen));
  if (!nextOpen || !focus) return;
  const options = customGenreVisualOptions();
  const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0];
  selected?.focus();
  selected?.scrollIntoView({ block: 'nearest' });
}

function chooseCustomGenreVisual(genreId) {
  const selected = genreOptions.find((genre) => genre.id === genreId);
  if (!selected) return;
  customGenreVisual.value = selected.id;
  customGenreVisualValue.textContent = customGenreOptionLabel(selected);
  customGenreVisualOptions().forEach((option) => {
    option.setAttribute('aria-selected', String(option.dataset.genreId === selected.id));
  });
  if (!customGenreColorsEnabled()) setCustomGenreColorInputs();
  setCustomGenreVisualMenuOpen(false);
  customGenreVisual.focus();
}

function audioDiagnosticLabel() {
  const status = audio.status === 'live'
    ? tr('diagnostics.audioLive')
    : audio.status === 'metadata-only'
      ? tr('diagnostics.audioFallback')
      : audio.status === 'starting'
        ? tr('diagnostics.starting')
        : tr('diagnostics.unavailable');
  const source = captureAudioSources.find((item) => item.id === captureAudioSourceId);
  return `${status} · ${captureAudioSourceName(source)}`;
}

function rhythmDiagnosticLabel() {
  if (!rhythmModelEnabled || latestRhythmModelState?.type === 'disabled') {
    return tr('diagnostics.rhythmDisabled');
  }
  return ['ready', 'rhythm'].includes(latestRhythmModelState?.type)
    ? tr('diagnostics.rhythmReady')
    : tr('diagnostics.rhythmFallback');
}

function diagnosticGenreName(genreId) {
  const id = String(genreId || '');
  if (!id) return tr('diagnostics.none');
  if (currentMetadata?.genre?.id === id && currentMetadata.genre.label) {
    return currentMetadata.genre.label;
  }
  return genreOptions.find((genre) => genre.id === id)?.label
    || id.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function audioGenreModelDiagnostic() {
  const state = latestAudioGenreModelState || {};
  if (!localGenreModelEnabled || state.type === 'disabled') {
    return { label: tr('diagnostics.genreModelDisabled'), title: state.reason || '' };
  }
  if (!localGenreModelAvailable || state.type === 'unavailable') {
    return { label: tr('diagnostics.genreModelUnavailable'), title: state.reason || '' };
  }
  if (state.type === 'starting') {
    return { label: tr('diagnostics.genreModelStarting'), title: state.reason || '' };
  }
  if (state.type === 'error') {
    return { label: tr('diagnostics.genreModelError'), title: state.reason || '' };
  }
  if (state.type === 'silence') {
    return { label: tr('diagnostics.genreModelSilence'), title: state.reason || '' };
  }
  if (state.type === 'prediction') {
    const genre = diagnosticGenreName(state.genreId);
    const windows = Number(state.acceptedWindows) || 0;
    const label = tr(
      latestAudioGenreAnalyzing ? 'diagnostics.genreModelAnalyzing' : 'diagnostics.genreModelResult',
      { genre, windows }
    );
    const details = [
      state.stage && `stage ${state.stage}`,
      Number.isFinite(Number(state.confidence)) && `score ${Number(state.confidence).toFixed(3)}`,
      Number.isFinite(Number(state.margin)) && `margin ${Number(state.margin).toFixed(3)}`
    ].filter(Boolean).join(' · ');
    return { label, title: details || label };
  }
  if (latestAudioGenreAnalyzing) {
    return { label: tr('diagnostics.genreModelAwaitingResult'), title: state.reason || '' };
  }
  return { label: tr('diagnostics.genreModelReady'), title: state.reason || '' };
}

const GENRE_UNCERTAINTY_LABELS = {
  'broad-genre': 'diagnostics.uncertainBroadGenre',
  'audio-memory': 'diagnostics.uncertainAudioMemory',
  'audio-relative-lead': 'diagnostics.uncertainAudioRelativeLead',
  'audio-unconfirmed': 'diagnostics.uncertainAudioUnconfirmed',
  'artist-fallback': 'diagnostics.uncertainArtistFallback',
  'collection-fallback': 'diagnostics.uncertainCollectionFallback',
  'title-inference': 'diagnostics.uncertainTitleInference',
  'raw-genre': 'diagnostics.uncertainRawGenre',
  'low-confidence': 'diagnostics.uncertainLowConfidence'
};

function genreUncertaintyLabel(reason) {
  const key = GENRE_UNCERTAINTY_LABELS[String(reason || '')];
  return key ? tr(key) : tr('diagnostics.uncertainResult');
}

async function refreshDiagnosticsStatus() {
  try {
    const status = await window.genrePolice.getDiagnosticsStatus();
    latestAudioGenreModelState = status?.audioGenreModelState || latestAudioGenreModelState;
    latestAudioGenreAnalyzing = status?.audioGenreAnalyzing === true;
    if (diagnosticsPanel.open) updateDiagnosticsUi();
  } catch {
    // The current on-screen state remains useful if the main process is briefly busy.
  }
}

function setDiagnosticsRefreshing(enabled) {
  window.clearInterval(diagnosticsRefreshTimer);
  diagnosticsRefreshTimer = 0;
  if (!enabled) return;
  void refreshDiagnosticsStatus();
  diagnosticsRefreshTimer = window.setInterval(refreshDiagnosticsStatus, 1000);
}

function updateDiagnosticsUi() {
  diagnosticsPlayer.textContent = currentMediaSource ? mediaSourceName(currentMediaSource) : tr('diagnostics.none');
  diagnosticsPlayer.title = currentMediaSource;
  diagnosticsAudio.textContent = audioDiagnosticLabel();
  diagnosticsRhythm.textContent = rhythmDiagnosticLabel();
  const genreModel = audioGenreModelDiagnostic();
  diagnosticsGenreModel.textContent = genreModel.label;
  diagnosticsGenreModel.title = genreModel.title;
  const evidence = currentMetadata?.genreEvidence || null;
  let genreEvidenceLabel = currentMetadata?.genreSource || '';
  if (evidence?.type === 'user-artist') {
    genreEvidenceLabel = tr('diagnostics.genreUserArtist', { artist: evidence.artist });
  } else if (evidence?.type === 'user-correction') {
    genreEvidenceLabel = tr('diagnostics.genreUserCorrection');
  } else if (evidence?.type === 'custom-genre') {
    genreEvidenceLabel = tr('diagnostics.genreCustomRule', { rule: evidence.ruleName || '' });
  } else {
    const matched = String(evidence?.matched || currentMetadata?.genre?.matched || '')
      .replace(/^[^:]+:/, '')
      .trim();
    if (matched && !genreEvidenceLabel.toLocaleLowerCase().includes(matched.toLocaleLowerCase())) {
      genreEvidenceLabel = [genreEvidenceLabel, matched].filter(Boolean).join(' · ');
    }
  }
  if (currentMetadata?.genreUncertain) {
    const uncertainty = genreUncertaintyLabel(currentMetadata.genreUncertainReason);
    genreEvidenceLabel = [genreEvidenceLabel, uncertainty].filter(Boolean).join(' · ');
  }
  diagnosticsGenre.textContent = genreEvidenceLabel || tr('diagnostics.none');
  diagnosticsGenre.title = genreEvidenceLabel;
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

function supportsLyricTranslationForUiLanguage() {
  return uiLanguage === 'zh-CN';
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
      lyricAnimatedUnits.push({ element: span, baseElement: baseSpan, ...unit });
    }
    baseFragment.append(baseSpan);
    fillFragment.append(span);
  }
  lyricCurrentBase.append(baseFragment);
  lyricCurrentFillContent.append(fillFragment);
  const rawTranslation = String(translation || '').trim();
  const showTranslation = lyricTranslationEnabled
    && supportsLyricTranslationForUiLanguage()
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
  if (!text) {
    titlePanAnimation?.cancel();
    titlePanAnimation = null;
    titlePanSignature = '';
    return;
  }
  const titleStyle = getComputedStyle(titleLabel);
  const horizontalPadding = (parseFloat(titleStyle.paddingLeft) || 0)
    + (parseFloat(titleStyle.paddingRight) || 0);
  const viewportWidth = Math.max(0, titleLabel.clientWidth - horizontalPadding);
  const distance = Math.max(0, text.scrollWidth - viewportWidth);
  const overflowing = distance > 3;
  const roundedDistance = Math.ceil(distance);
  const signature = `${text.textContent}::${Math.round(viewportWidth)}::${roundedDistance}`;
  titleLabel.classList.toggle('is-overflowing', overflowing);
  if (signature === titlePanSignature && Boolean(titlePanAnimation) === overflowing) return;

  titlePanAnimation?.cancel();
  titlePanAnimation = null;
  titlePanSignature = signature;
  text.style.transform = 'translateX(0)';
  if (!overflowing) return;

  const holdMs = 2000;
  const travelMs = Math.max(2200, Math.min(9000, roundedDistance / 32 * 1000));
  const duration = holdMs * 2 + travelMs * 2;
  const leftHold = holdMs / duration;
  const rightArrival = (holdMs + travelMs) / duration;
  const rightHold = (holdMs * 2 + travelMs) / duration;
  titlePanAnimation = text.animate([
    { transform: 'translateX(0)', offset: 0 },
    { transform: 'translateX(0)', offset: leftHold },
    { transform: `translateX(-${roundedDistance}px)`, offset: rightArrival },
    { transform: `translateX(-${roundedDistance}px)`, offset: rightHold },
    { transform: 'translateX(0)', offset: 1 }
  ], {
    duration,
    iterations: Infinity,
    fill: 'both',
    easing: 'linear'
  });
}

function setTrackTitle(value) {
  const text = String(value || '');
  const current = titleLabel.querySelector('.title-scroll-text');
  if (current?.textContent === text) {
    titleLabel.title = text;
    requestAnimationFrame(updateTitleOverflow);
    return text;
  }
  titlePanAnimation?.cancel();
  titlePanAnimation = null;
  titlePanSignature = '';
  const span = document.createElement('span');
  span.className = 'title-scroll-text';
  span.textContent = text;
  titleLabel.replaceChildren(span);
  titleLabel.title = text;
  titleLabel.classList.remove('is-overflowing');
  requestAnimationFrame(updateTitleOverflow);
  document.fonts?.ready.then(() => requestAnimationFrame(updateTitleOverflow));
  return text;
}

function updateLyricUnitMotion(progress) {
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
    updateLyricUnitMotion(-1);
    return;
  }
  const start = lyricLines[active].atMs;
  const sweepDuration = lyricLines[active].sweepDurationMs
    || Math.max(800, (lyricLines[active + 1]?.atMs || start + 3200) - start);
  const visualLead = Number(lyricLines[active].visualLeadMs) || LYRIC_LOOKAHEAD_MS;
  const lineProgress = Math.max(0, Math.min(1, (playbackPosition + visualLead - start) / Math.max(800, sweepDuration)));
  setLyricSweepProgress(lyricSweepEnabled ? lineProgress : 1);
  updateLyricUnitMotion(lyricSweepEnabled ? lineProgress : -1);
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
  monogram.textContent = mode === 'bilibili' ? 'VIDEO' : 'GP';
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
let typographyRefreshFrame = 0;
let typographyRefreshFollowupFrame = 0;
const genreMetricsCanvas = document.createElement('canvas');
const genreMetricsContext = genreMetricsCanvas.getContext('2d');

function textInkBounds(element, text, uiScale) {
  if (!genreMetricsContext || !element || !String(text || '').trim()) return null;
  const style = getComputedStyle(element);
  const renderedText = style.textTransform === 'uppercase'
    ? String(text).toLocaleUpperCase()
    : style.textTransform === 'lowercase'
      ? String(text).toLocaleLowerCase()
      : String(text);
  genreMetricsContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  genreMetricsContext.fontKerning = style.fontKerning;
  const metrics = genreMetricsContext.measureText(renderedText);
  const actualAscent = Number(metrics.actualBoundingBoxAscent) || 0;
  const actualDescent = Number(metrics.actualBoundingBoxDescent) || 0;
  const fontAscent = Number(metrics.fontBoundingBoxAscent) || actualAscent;
  const fontDescent = Number(metrics.fontBoundingBoxDescent) || actualDescent;
  if (!(actualAscent + actualDescent > 0) || !(fontAscent + fontDescent > 0)) return null;

  const rect = element.getBoundingClientRect();
  const fontBoxHeight = (fontAscent + fontDescent) * uiScale;
  const baseline = rect.top + (rect.height - fontBoxHeight) / 2 + fontAscent * uiScale;
  return {
    top: baseline - actualAscent * uiScale,
    bottom: baseline + actualDescent * uiScale
  };
}

function balanceCapsuleGenreStack() {
  const genreFace = genreLabel.querySelector('#genre-face');
  const capsuleLayout = document.body.dataset.layout !== 'poster';
  if (!capsuleLayout || !jurisdictionLabel || !genreFace || !trackRule
      || !parentGenre.textContent.trim() || !genreFace.textContent.trim()) {
    parentGenre.style.removeProperty('--parent-balance-y');
    return false;
  }

  const savedScale = genreLabel.style.getPropertyValue('--genre-scale');
  const savedLift = genreLabel.style.getPropertyValue('--genre-lift');
  parentGenre.style.setProperty('--parent-balance-y', '0px');
  genreLabel.style.setProperty('--genre-scale', '1');
  genreLabel.style.setProperty('--genre-lift', '0px');
  genreLabel.style.setProperty('--genre-balance-y', '0px');

  const appRect = appShell.getBoundingClientRect();
  const uiScale = appShell.offsetHeight > 0 ? appRect.height / appShell.offsetHeight : 1;
  const jurisdictionInk = textInkBounds(jurisdictionLabel, jurisdictionLabel.textContent, uiScale);
  const parentInk = textInkBounds(parentGenre, parentGenre.textContent, uiScale);
  const genreInk = textInkBounds(genreFace, genreFace.textContent, uiScale);
  const ruleTop = trackRule.getBoundingClientRect().top;

  if (savedScale) genreLabel.style.setProperty('--genre-scale', savedScale);
  else genreLabel.style.removeProperty('--genre-scale');
  if (savedLift) genreLabel.style.setProperty('--genre-lift', savedLift);
  else genreLabel.style.removeProperty('--genre-lift');

  if (!jurisdictionInk || !parentInk || !genreInk || !(uiScale > 0)) {
    parentGenre.style.removeProperty('--parent-balance-y');
    genreLabel.style.removeProperty('--genre-balance-y');
    return true;
  }

  const parentHeight = parentInk.bottom - parentInk.top;
  const genreHeight = genreInk.bottom - genreInk.top;
  const freeSpace = ruleTop - jurisdictionInk.bottom - parentHeight - genreHeight;
  const targetGap = Math.max(0, freeSpace / 3);
  const parentOffset = clamp(
    (jurisdictionInk.bottom + targetGap - parentInk.top) / uiScale,
    -16,
    16
  );
  const genreOffset = clamp(
    (ruleTop - targetGap - genreInk.bottom) / uiScale,
    -16,
    16
  );
  parentGenre.style.setProperty('--parent-balance-y', `${parentOffset.toFixed(2)}px`);
  genreLabel.style.setProperty('--genre-balance-y', `${genreOffset.toFixed(2)}px`);
  return true;
}

function balanceGenreLabel() {
  if (balanceCapsuleGenreStack()) return;

  const genreFace = genreLabel.querySelector('#genre-face');
  if (!genreFace || !parentGenre.textContent.trim() || !genreFace.textContent.trim() || !trackRule) {
    genreLabel.style.removeProperty('--genre-balance-y');
    return;
  }

  const savedScale = genreLabel.style.getPropertyValue('--genre-scale');
  const savedLift = genreLabel.style.getPropertyValue('--genre-lift');
  genreLabel.style.setProperty('--genre-scale', '1');
  genreLabel.style.setProperty('--genre-lift', '0px');
  genreLabel.style.setProperty('--genre-balance-y', '0px');

  const appRect = appShell.getBoundingClientRect();
  const uiScale = appShell.offsetHeight > 0 ? appRect.height / appShell.offsetHeight : 1;
  const parentInk = textInkBounds(parentGenre, parentGenre.textContent, uiScale);
  const genreInk = textInkBounds(genreFace, genreFace.textContent, uiScale);
  const ruleTop = trackRule.getBoundingClientRect().top;

  if (savedScale) genreLabel.style.setProperty('--genre-scale', savedScale);
  else genreLabel.style.removeProperty('--genre-scale');
  if (savedLift) genreLabel.style.setProperty('--genre-lift', savedLift);
  else genreLabel.style.removeProperty('--genre-lift');

  if (!parentInk || !genreInk || !(uiScale > 0)) {
    genreLabel.style.removeProperty('--genre-balance-y');
    return;
  }

  const targetCenter = (parentInk.bottom + ruleTop) / 2;
  const currentCenter = (genreInk.top + genreInk.bottom) / 2;
  const offset = clamp((targetCenter - currentCenter) / uiScale, -12, 12);
  genreLabel.style.setProperty('--genre-balance-y', `${offset.toFixed(2)}px`);
}

function fitGenreLabel() {
  // Start from the genre family's intended type size, then shrink only when
  // the rendered font would overflow. Measure the static face rather than the
  // effect container: animated glitch copies can extend its scrollWidth and
  // otherwise make long labels refit by fractions of a pixel during playback.
  genreLabel.style.removeProperty('font-size');
  const availableWidth = genreLabel.clientWidth;
  const genreFace = genreLabel.querySelector('#genre-face');
  const renderedWidth = genreFace?.scrollWidth || genreLabel.scrollWidth;
  if (!availableWidth || !renderedWidth) {
    balanceGenreLabel();
    return;
  }

  const naturalSize = Number.parseFloat(getComputedStyle(genreLabel).fontSize) || 58;
  // Leave room for the live scale/glow so a fitted label does not appear to
  // leave the capsule on an impact frame.
  const safeWidth = availableWidth * 0.94;
  if (renderedWidth > safeWidth) {
    const fittedSize = Math.max(25, naturalSize * safeWidth / renderedWidth);
    genreLabel.style.fontSize = `${fittedSize.toFixed(2)}px`;
  }
  balanceGenreLabel();
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

function refreshPresentationTypography() {
  cancelAnimationFrame(typographyRefreshFrame);
  cancelAnimationFrame(typographyRefreshFollowupFrame);
  typographyRefreshFrame = requestAnimationFrame(() => {
    typographyRefreshFollowupFrame = requestAnimationFrame(() => {
      typographyRefreshFrame = 0;
      typographyRefreshFollowupFrame = 0;
      if (!hud.isConnected) return;

      // Chromium can retain the HUD's old text texture when the fixed design
      // canvas changes CSS scale. Rebuilding its render subtree in one frame
      // invalidates that texture without exposing a hidden intermediate state.
      const previousDisplay = hud.style.display;
      hud.style.display = 'none';
      void hud.offsetWidth;
      if (previousDisplay) hud.style.display = previousDisplay;
      else hud.style.removeProperty('display');
      void hud.offsetWidth;
      fitGenreLabel();
      updateTitleOverflow();
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
    : content.placeholder || content.resolving
      ? ''
      : content.theme.parent || trMain('hud.genrePolice');
  const nextGenreText = content.resolving
    ? trMain('hud.identifying')
    : content.placeholder
      ? trMain('hud.awaitingSignal')
      : content.theme.hudLabel || content.theme.label;
  const genreSelectable = Boolean(currentMetadata?.title && !demoTheme && !content.placeholder);
  genreLabel.tabIndex = genreSelectable ? 0 : -1;
  genreLabel.setAttribute('aria-disabled', String(!genreSelectable));
  genreLabel.setAttribute('aria-label', genreSelectable
    ? tr('genreQuick.open', { genre: nextGenreText })
    : nextGenreText);
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
  artistLabel.textContent = content.placeholderArtist
    ? detectedMediaPlayers.neteaseRunning && !detectedMediaPlayers.neteaseSmtcAvailable
      ? tr('hud.neteaseSmtcHint')
      : trMain('hud.waitingArtist')
    : content.artist;
  const readingContext = `${content.title || ''} ${content.artist || ''}`;
  titleLabel.lang = readingLanguageFor(titleText, readingContext);
  artistLabel.lang = readingLanguageFor(artistLabel.textContent, readingContext);
  genreSource.textContent = sourceTextFor(content).toUpperCase();
  genreSource.removeAttribute('title');
  genreSource.tabIndex = -1;
  genreSource.setAttribute('role', 'status');
  caseId.textContent = content.genrePoliceEasterEgg
    ? trMain('hud.specialCase')
    : content.placeholder
      ? trMain('hud.standby')
      : content.resolving
        ? trMain('hud.caseOpen')
        : `${trMain('hud.classified')}${content.genreUncertain ? '?' : ''}`;
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
  renderUpdateUi();
  lyricTranslationSetting.hidden = !supportsLyricTranslationForUiLanguage();
  renderCaptureAudioSources();
  renderMediaSourceSettings();
  renderGenreArtistRules();
  renderCustomGenres();
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
  fullscreenEnglishFontToggle.title = fullscreenCondensedEnglish
    ? tr('settings.fullscreenCondensedEnglishOn')
    : tr('settings.fullscreenCondensedEnglishOff');
  updateBackgroundStyle();
  onlineLookupToggle.title = onlineGenreLookupEnabled ? tr('settings.onlineLookupOn') : tr('settings.onlineLookupOff');
  artistGenreReferenceToggle.title = artistGenreReferenceEnabled
    ? tr('settings.artistGenreReferenceOn')
    : tr('settings.artistGenreReferenceOff');
  updateLocalGenreSettingState();
  alwaysOnTopToggle.title = alwaysOnTopEnabled
    ? tr('settings.alwaysOnTopOn')
    : tr('settings.alwaysOnTopOff');
  desktopLayerToggle.title = desktopLayerEnabled
    ? tr('settings.desktopLayerOn')
    : tr('settings.desktopLayerOff');
  recordingQuickButtonToggle.title = recordingQuickButtonVisible
    ? tr('settings.recordingQuickButtonOn')
    : tr('settings.recordingQuickButtonOff');
  snapshotQuickButtonToggle.title = snapshotQuickButtonVisible
    ? tr('settings.snapshotQuickButtonOn')
    : tr('settings.snapshotQuickButtonOff');
  if (!genreQuickPanel.hidden) renderGenreQuickPanel();
  mousePassthroughToggle.title = mousePassthroughEnabled
    ? tr('settings.mousePassthroughOn')
    : tr('settings.mousePassthroughOff');
  showFpsToggle.title = showFps ? tr('settings.showFpsOn') : tr('settings.showFpsOff');
  rhythmModelToggle.title = rhythmModelEnabled
    ? tr('settings.rhythmModelOn')
    : tr('settings.rhythmModelOff');
  launchAtLoginToggle.title = launchAtLoginToggle.disabled
    ? tr('settings.launchAtLoginUnsupported')
    : launchAtLoginEnabled ? tr('settings.launchAtLoginOn') : tr('settings.launchAtLoginOff');
  renderRecordingUi();
  renderLocalizedHud();
  const visibleLyric = lyricLines[Math.max(0, lyricIndex)] || null;
  setLyricText(visibleLyric?.text || lyricCurrentBase.textContent || '', {
    translation: visibleLyric?.translation || '',
    animateLayout: false
  });
  animateLyricLayoutChange(lyricLayoutStartTop);
  updateGenreCorrectionUi();
  requestAnimationFrame(updateSettingsScrollbar);
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
  refreshPresentationTypography();
}

function updateStageOutputScale() {
  if (!stageOutputActive) return;
  const scale = Math.min(
    Math.max(1, window.innerWidth - 96) / 920,
    Math.max(1, window.innerHeight - 96) / 400
  );
  const safeScale = Math.max(0.1, scale);
  const appLeft = (window.innerWidth - 920 * safeScale) / 2;
  const appTop = (window.innerHeight - 400 * safeScale) / 2;
  // Cover exactly the visible display plus a small screen-space glow guard.
  // A fixed 128px design-space overscan rendered a large invisible region at
  // fullscreen pixel density, multiplying the cost of effect-heavy genres.
  const guard = 24 / safeScale;
  const visualOverscanX = Math.ceil(Math.max(0, appLeft / safeScale) + guard);
  const visualOverscanY = Math.ceil(Math.max(0, appTop / safeScale) + guard);
  const settingsScreenScale = Math.min(
    1.25,
    Math.max(0.72, (window.innerWidth - 64) / 540),
    Math.max(0.72, (window.innerHeight - 64) / 560)
  );
  document.documentElement.style.setProperty('--stage-output-scale', String(safeScale));
  document.documentElement.style.setProperty('--stage-visual-left', `${-visualOverscanX}px`);
  document.documentElement.style.setProperty('--stage-visual-top', `${-visualOverscanY}px`);
  document.documentElement.style.setProperty('--stage-visual-width', `${920 + visualOverscanX * 2}px`);
  document.documentElement.style.setProperty('--stage-visual-height', `${400 + visualOverscanY * 2}px`);
  document.documentElement.style.setProperty('--stage-split-visual-center-x', `${206 + visualOverscanX}px`);
  document.documentElement.style.setProperty('--stage-split-visual-center-y', `${200 + visualOverscanY}px`);
  document.documentElement.style.setProperty('--stage-stacked-visual-center-x', `${460 + visualOverscanX}px`);
  document.documentElement.style.setProperty('--stage-stacked-visual-center-y', `${100 + visualOverscanY}px`);
  document.documentElement.style.setProperty('--stage-hidden-visual-center-y', `${200 + visualOverscanY}px`);
  document.documentElement.style.setProperty(
    '--stage-output-settings-scale',
    String(settingsScreenScale / safeScale)
  );
  document.documentElement.style.setProperty(
    '--fullscreen-heading-left',
    `${(40 - appLeft) / safeScale - 180}px`
  );
  document.documentElement.style.setProperty(
    '--fullscreen-heading-top',
    `${(32 - appTop) / safeScale - 200}px`
  );
  visual.resize();
}

function renderFullscreenControls() {
  const { state } = recordingUiSnapshot;
  const recordingBusy = state === 'preparing' || state === 'stopping';
  const recordingActive = state === 'recording' || state === 'stopping';
  const recordingLocked = state !== 'idle';
  const recordingAction = tr(recordingActive ? 'actions.stopRecording' : 'actions.startRecording');

  fullscreenQuickButton.disabled = stageOutputBusy || recordingLocked;
  fullscreenQuickButton.title = tr('controls.enterFullscreen');
  fullscreenQuickButton.setAttribute('aria-label', fullscreenQuickButton.title);

  fullscreenSnapshotButton.disabled = snapshotSaving || recordingLocked;
  fullscreenRecordingButton.disabled = recordingBusy;
  fullscreenRecordingButton.classList.toggle('is-recording', recordingActive);
  fullscreenRecordingButton.title = recordingAction;
  fullscreenRecordingButton.setAttribute('aria-label', recordingAction);
  fullscreenRecordingButton.setAttribute('aria-busy', String(recordingBusy));

  [fullscreenSettingsButton, fullscreenLayoutButton, fullscreenTextButton, fullscreenExitButton]
    .forEach((button) => { button.disabled = recordingLocked; });

  const nextLayoutKey = fullscreenLayoutMode === 'stacked'
    ? 'controls.fullscreenLayoutSplit'
    : 'controls.fullscreenLayoutStacked';
  fullscreenLayoutButton.title = tr(nextLayoutKey);
  fullscreenLayoutButton.setAttribute('aria-label', fullscreenLayoutButton.title);
  fullscreenTextButton.title = tr(stageOutputTextVisible
    ? 'controls.fullscreenHideText'
    : 'controls.fullscreenShowText');
  fullscreenTextButton.setAttribute('aria-label', fullscreenTextButton.title);
  fullscreenTextButton.setAttribute('aria-pressed', String(stageOutputTextVisible));
}

function renderStageOutputUi(message = '') {
  const recordingBusy = recordingUiSnapshot.state !== 'idle';
  stageOutputStartStop.disabled = stageOutputBusy || recordingBusy;
  stageOutputStartStop.textContent = tr(stageOutputActive
    ? 'actions.stopStageOutput'
    : 'actions.startStageOutput');
  stageOutputStartStop.setAttribute('aria-busy', String(stageOutputBusy));
  stageOutputStateLabel.textContent = message;
  renderFullscreenControls();
}

function setFullscreenLayoutMode(value, { persist = false } = {}) {
  const previousMode = fullscreenLayoutMode;
  fullscreenLayoutMode = value === 'stacked' ? 'stacked' : 'split';
  const switchingLayout = stageOutputActive && stageOutputTextVisible
    && previousMode !== fullscreenLayoutMode;
  if (switchingLayout) document.body.classList.add('layout-switching');
  document.body.dataset.fullscreenLayout = fullscreenLayoutMode;
  updatePresentationSettingsVisibility();
  renderFullscreenControls();
  if (stageOutputActive && stageOutputTextVisible) {
    // Resolve the new text flow before measuring the progress-rule horizon.
    // The temporary class disables the HUD's normal transform transition, so
    // the measured anchor is already the final one for this composition.
    fitGenreLabel();
    updateTitleOverflow();
    visual.resize();
    requestAnimationFrame(() => {
      scheduleGenreFit();
      updateTitleOverflow();
      refreshPresentationTypography();
      if (switchingLayout) {
        requestAnimationFrame(() => document.body.classList.remove('layout-switching'));
      }
    });
  }
  if (persist) {
    window.genrePolice.setConfig({ fullscreenLayoutMode }).then((result) => {
      if (typeof result?.fullscreenLayoutMode === 'string') {
        setFullscreenLayoutMode(result.fullscreenLayoutMode);
      }
    }).catch(() => setFullscreenLayoutMode(previousMode));
  }
}

function setStageOutputTextVisible(enabled, { persist = false } = {}) {
  stageOutputTextVisible = enabled !== false;
  document.body.dataset.stageOutputText = String(stageOutputTextVisible);
  stageOutputTextToggle.setAttribute('aria-checked', String(stageOutputTextVisible));
  stageOutputTextToggle.title = stageOutputTextVisible
    ? tr('settings.stageOutputTextOn')
    : tr('settings.stageOutputTextOff');
  if (persist) {
    window.genrePolice.setConfig({ stageOutputTextVisible }).then((result) => {
      if (typeof result?.stageOutputTextVisible === 'boolean') {
        setStageOutputTextVisible(result.stageOutputTextVisible);
      }
    }).catch(() => setStageOutputTextVisible(!stageOutputTextVisible));
  }
  if (stageOutputActive) {
    // Keep the hidden HUD measurable, then finish all text fitting before this
    // event yields so restoring text cannot paint a zero-width intermediate layout.
    visual.resize();
    fitGenreLabel();
    updateTitleOverflow();
    requestAnimationFrame(() => {
      visual.resize();
      fitGenreLabel();
      updateTitleOverflow();
      refreshPresentationTypography();
    });
  }
  renderFullscreenControls();
}

function applyStageOutputState(payload = {}) {
  const nextActive = payload.active === true;
  const entering = nextActive && !stageOutputActive;
  const leaving = !nextActive && stageOutputActive;

  if (entering) {
    stageOutputRestoreLayoutMode = layoutMode;
    recordingOverlayGeometry = null;
  }

  stageOutputActive = nextActive;
  if (entering || leaving) {
    adaptiveResolutionScale = 1;
    adaptiveLowFpsWindows = 0;
    adaptiveHighFpsWindows = 0;
    renderPerformanceContext = '';
    visual.setOutputResolutionScale(1);
  }
  document.body.dataset.stageOutput = String(stageOutputActive);
  updatePresentationSettingsVisibility();
  if (stageOutputActive) {
    clearControlsTimer();
    closeGenreQuickPanel({ restoreHitTest: false });
    if (!settings.hidden) closeSettings();
    // Fullscreen output has its own landscape composition. Keep the user's
    // desktop layout untouched and restore it when the output closes.
    if (layoutMode !== 'side') applyLayoutMode('side');
    updateBackgroundStyle();
    updateStageOutputScale();
    showControls();
  } else {
    document.documentElement.style.removeProperty('--stage-output-scale');
    document.documentElement.style.removeProperty('--stage-output-settings-scale');
    document.documentElement.style.removeProperty('--fullscreen-heading-left');
    document.documentElement.style.removeProperty('--fullscreen-heading-top');
    [
      '--stage-visual-left',
      '--stage-visual-top',
      '--stage-visual-width',
      '--stage-visual-height',
      '--stage-split-visual-center-x',
      '--stage-split-visual-center-y',
      '--stage-stacked-visual-center-x',
      '--stage-stacked-visual-center-y',
      '--stage-hidden-visual-center-y'
    ].forEach((property) => document.documentElement.style.removeProperty(property));
    lastFullscreenBackdropStyleAt = 0;
    if (leaving && stageOutputRestoreLayoutMode && layoutMode !== stageOutputRestoreLayoutMode) {
      const restoreLayoutMode = stageOutputRestoreLayoutMode;
      stageOutputRestoreLayoutMode = '';
      applyLayoutMode(restoreLayoutMode);
    } else {
      stageOutputRestoreLayoutMode = '';
      updateBackgroundStyle();
    }
    showControls();
  }
  renderStageOutputUi();
  requestAnimationFrame(() => {
    visual.resize();
    scheduleGenreFit();
    updateTitleOverflow();
    refreshPresentationTypography();
  });
}

async function toggleStageOutput() {
  if (stageOutputBusy) return;
  if (!stageOutputActive) {
    setFullscreenLayoutMode(layoutMode === 'poster' ? 'stacked' : 'split');
  }
  stageOutputBusy = true;
  renderStageOutputUi();
  try {
    const result = await window.genrePolice.setStageOutput(!stageOutputActive);
    if (!result?.ok) {
      renderStageOutputUi(result?.error === 'recording-active'
        ? tr('stageOutput.recordingBlocked')
        : tr('stageOutput.failed'));
      return;
    }
    applyStageOutputState(result);
  } catch {
    renderStageOutputUi(tr('stageOutput.failed'));
  } finally {
    stageOutputBusy = false;
    renderStageOutputUi(stageOutputStateLabel.textContent);
  }
}

function openSettingsFromFullscreen() {
  if (recordingUiSnapshot.state !== 'idle') return;
  openSettings();
}

function updatePresentationSettingsVisibility() {
  const posterPresentation = layoutMode === 'poster';
  appearanceGeneralSection.hidden = stageOutputActive;
  appearanceLayoutSection.hidden = stageOutputActive;
  capsuleBackgroundSetting.hidden = stageOutputActive || posterPresentation;
  capsuleEnglishFontSetting.hidden = stageOutputActive || posterPresentation;
  posterBackgroundSetting.hidden = stageOutputActive || !posterPresentation;
  posterEnglishFontSetting.hidden = stageOutputActive || !posterPresentation;
  fullscreenEnglishFontSetting.hidden = !stageOutputActive;
  stageOutputTextSetting.hidden = !stageOutputActive;
  stageOutputEntrySetting.hidden = stageOutputActive;
  uiScaleSetting.hidden = stageOutputActive;
  layoutModeSetting.hidden = stageOutputActive;
}

function applyLayoutMode(value) {
  document.body.classList.add('layout-switching');
  layoutMode = value === 'poster' || value === 'stage' ? 'poster' : 'side';
  document.body.dataset.layout = layoutMode;
  updateStageOutputScale();
  updateBackgroundStyle();
  // CSS swaps the fixed design canvas immediately. Resize in the same task so
  // no animation frame can draw the new layout with the previous dimensions.
  visual.resize();
  updatePresentationSettingsVisibility();
  updateLayoutToggleButton();
  layoutModeOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.layoutMode === layoutMode));
  });
  requestAnimationFrame(() => {
    // Recheck after the native window has adopted its new bounds.
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
    refreshPresentationTypography();
    requestAnimationFrame(() => document.body.classList.remove('layout-switching'));
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
  const result = await window.genrePolice.setLayoutMode(requested);
  const resolved = result?.mode === 'poster' || result?.mode === 'stage' ? 'poster' : 'side';
  if (resolved !== layoutMode) applyLayoutMode(resolved);
}

function setScaleMenuOpen(open, { focus = false } = {}) {
  const nextOpen = Boolean(open);
  if (nextOpen) {
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    setCustomGenreVisualMenuOpen(false);
    setGenreArtistMenuOpen(false);
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
    setCustomGenreVisualMenuOpen(false);
    setGenreArtistMenuOpen(false);
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
    if (!document.body.classList.contains('settings-open')) {
      if (recordingPresentationActive) {
        setRecordingOverlayVisibility(false);
      } else {
        document.body.classList.remove('pointer-active');
      }
    }
  }, delay);
}

function showControls() {
  if (!document.body.classList.contains('interactive') && !stageOutputActive) return;
  wakeIdleVisual();
  if (recordingPresentationActive) {
    setRecordingOverlayVisibility(true);
  } else {
    document.body.classList.add('pointer-active');
  }
  if (!document.body.classList.contains('settings-open')) hideControls(1650);
}

function closeSettings() {
  setScaleMenuOpen(false);
  setLanguageMenuOpen(false);
  setMediaSourceMenuOpen(false);
  setCustomGenreVisualMenuOpen(false);
  setGenreArtistMenuOpen(false);
  closeCustomGenreColorEditor();
  closeGenreCorrectionSuggestions();
  settings.hidden = true;
  window.genrePolice.setSettingsOpen(false);
  document.body.classList.remove('settings-open');
  settingsButton.setAttribute('aria-expanded', 'false');
  showControls();
  scheduleIdleDim();
  showPendingUpdateToast();
}

function genreCandidateBasis(candidate) {
  return (candidate?.bases || [])
    .map((basis) => tr(`genreQuick.basis.${basis}`))
    .filter(Boolean)
    .join(' · ');
}

function renderGenreQuickPanel() {
  if (!genreQuickData) return;
  genreQuickTrack.textContent = [genreQuickData.title, genreQuickData.artist]
    .filter(Boolean)
    .join(' — ');
  genreQuickCandidates.replaceChildren();
  for (const candidate of genreQuickData.candidates || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.dataset.genreId = candidate.id;
    button.setAttribute('aria-selected', String(candidate.id === genreQuickSelectedId));
    const label = document.createElement('strong');
    label.textContent = candidate.label;
    const basis = document.createElement('small');
    basis.textContent = genreCandidateBasis(candidate);
    button.append(label, basis);
    button.addEventListener('click', () => {
      genreQuickSelectedId = candidate.id;
      renderGenreQuickPanel();
    });
    genreQuickCandidates.append(button);
  }
  genreQuickUnlock.hidden = !genreQuickData.locked;
  const canApply = Boolean(genreQuickSelectedId);
  genreQuickUse.disabled = !canApply;
  genreQuickRemember.disabled = !canApply;
}

async function refreshGenreQuickPanel() {
  genreQuickState.textContent = tr('genreQuick.loading');
  try {
    const data = await window.genrePolice.getGenreCandidates();
    if (genreQuickPanel.hidden) return;
    genreQuickData = data || { candidates: [] };
    const availableIds = new Set((genreQuickData.candidates || []).map((candidate) => candidate.id));
    genreQuickSelectedId = availableIds.has(genreQuickData.selectedGenreId)
      ? genreQuickData.selectedGenreId
      : genreQuickData.candidates?.[0]?.id || '';
    genreQuickState.textContent = '';
    renderGenreQuickPanel();
  } catch {
    genreQuickState.textContent = tr('genreQuick.failed');
  }
}

function closeGenreQuickPanel({ restoreHitTest = true } = {}) {
  if (genreQuickPanel.hidden) return;
  genreQuickPanel.hidden = true;
  document.body.classList.remove('genre-quick-open');
  genreLabel.setAttribute('aria-expanded', 'false');
  genreQuickData = null;
  genreQuickSelectedId = '';
  if (restoreHitTest && settings.hidden) window.genrePolice.setSettingsOpen(false);
  showControls();
}

function openGenreQuickPanel() {
  if (!currentMetadata?.title || demoTheme || genreLabel.getAttribute('aria-disabled') === 'true') return;
  if (!settings.hidden) closeSettings();
  genreQuickPanel.hidden = false;
  document.body.classList.add('genre-quick-open', 'pointer-active');
  genreLabel.setAttribute('aria-expanded', 'true');
  window.genrePolice.setSettingsOpen(true);
  clearControlsTimer();
  genreQuickData = null;
  genreQuickCandidates.replaceChildren();
  void refreshGenreQuickPanel();
}

async function saveSnapshot() {
  if (snapshotSaving || recordingPresentationActive) return;
  snapshotSaving = true;
  snapshotSaveButton.disabled = true;
  snapshotQuickButton.disabled = true;
  renderFullscreenControls();
  snapshotState.textContent = tr('snapshot.preparing');
  try {
    const prepared = await window.genrePolice.prepareSnapshot();
    if (!prepared?.ok) {
      snapshotState.textContent = prepared?.canceled ? '' : tr('snapshot.failed');
      return;
    }
    document.body.classList.add('snapshot-capture');
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = await window.genrePolice.captureSnapshot(prepared.token);
    if (!result?.ok) throw new Error(result?.error || 'capture-failed');
    const message = tr('snapshot.saved', { file: recordingFileName(result.filePath) });
    snapshotState.textContent = message;
    showRecordingToast(message);
  } catch {
    snapshotState.textContent = tr('snapshot.failed');
    showRecordingToast(tr('snapshot.failed'), { error: true });
  } finally {
    document.body.classList.remove('snapshot-capture');
    snapshotSaving = false;
    snapshotSaveButton.disabled = false;
    snapshotQuickButton.disabled = false;
    renderFullscreenControls();
  }
}

function recordingErrorMessage(error) {
  if (error === 'audio-unavailable') return tr('recording.audioUnavailable');
  if (error === 'unsupported') return tr('recording.unsupported');
  if (error === 'open-failed') return tr('recording.openFailed');
  if (error === 'write-failed') return tr('recording.writeFailed');
  if (error === 'finalize-failed') return tr('recording.finalizeFailed');
  return tr('recording.failed');
}

function recordingFileName(filePath) {
  return String(filePath || '').split(/[\\/]/).pop() || tr('recording.videoFile');
}

function hideRecordingToast() {
  window.clearTimeout(recordingToastTimer);
  recordingToastTimer = 0;
  recordingToast.hidden = true;
  recordingToast.classList.remove('is-error');
  showPendingUpdateToast();
}

function showRecordingToast(message, { error = false } = {}) {
  window.clearTimeout(recordingToastTimer);
  if (!updateToast.hidden) {
    pendingUpdateResult = latestUpdateResult;
    updateToast.hidden = true;
  }
  recordingToastText.textContent = message;
  recordingToast.classList.toggle('is-error', error);
  recordingToast.hidden = false;
  recordingToastTimer = window.setTimeout(hideRecordingToast, error ? 6500 : 5000);
}

function renderRecordingUi() {
  const { state, error } = recordingUiSnapshot;
  const busy = state === 'preparing' || state === 'stopping';
  const active = state === 'recording' || state === 'stopping';
  const actionKey = active ? 'actions.stopRecording' : 'actions.startRecording';
  const actionLabel = tr(actionKey);
  recordingStartStop.disabled = busy;
  recordingStartStop.classList.toggle('is-recording', active);
  recordingStartStop.textContent = actionLabel;
  recordingStartStop.setAttribute('aria-busy', String(busy));
  recordingQuickButton.disabled = busy;
  recordingQuickButton.classList.toggle('is-recording', active);
  recordingQuickButton.title = actionLabel;
  recordingQuickButton.setAttribute('aria-label', actionLabel);
  recordingQuickButton.setAttribute('aria-busy', String(busy));
  recordingState.textContent = state === 'preparing'
    ? tr('recording.preparing')
    : state === 'recording'
      ? tr('recording.active')
      : state === 'stopping'
        ? tr('recording.finalizing')
        : error
          ? recordingErrorMessage(error)
          : '';
  renderStageOutputUi();
  if (recordingPresentationActive) syncRecordingControlsOverlay(recordingOverlayVisible);
}

function recordingControlsOverlayPayload(visible) {
  const controlsElement = stageOutputActive ? fullscreenControls : controls;
  const rect = controlsElement.getBoundingClientRect();
  const transportElement = stageOutputActive ? fullscreenTransport : transport;
  const transportRect = transportElement.getBoundingClientRect();
  const rootStyle = getComputedStyle(document.documentElement);
  const button = stageOutputActive ? fullscreenSettingsButton : settingsButton;
  const buttonStyle = button ? getComputedStyle(button) : null;
  const iconStyle = button ? getComputedStyle(button.querySelector('.control-icon')) : null;
  const transportButton = transportElement.querySelector('button');
  const transportButtonStyle = transportButton ? getComputedStyle(transportButton) : null;
  const transportIconStyle = transportButton
    ? getComputedStyle(transportButton.querySelector('.control-icon'))
    : null;
  if (rect.width > 0 && rect.height > 0
      && (stageOutputActive || (transportRect.width > 0 && transportRect.height > 0))) {
    const scale = stageOutputActive ? 1 : (Number.parseFloat(rootStyle.getPropertyValue('--ui-scale')) || 1);
    const buttonSize = Number.parseFloat(buttonStyle?.width) || 30;
    const gap = Number.parseFloat(getComputedStyle(controlsElement).gap) || 6;
    const overlayWidth = buttonSize * scale;
    recordingOverlayGeometry = {
      rect: {
        x: rect.right - overlayWidth,
        y: rect.y,
        width: overlayWidth,
        height: buttonSize * scale
      },
      transportRect: {
        x: transportRect.x,
        y: transportRect.y,
        width: transportRect.width,
        height: transportRect.height
      },
      appearance: {
        scale,
        buttonSize,
        iconSize: Number.parseFloat(iconStyle?.width) || 16,
        gap,
        transportButtonSize: Number.parseFloat(transportButtonStyle?.width) || 30,
        transportIconSize: Number.parseFloat(transportIconStyle?.width) || 16,
        transportGap: Number.parseFloat(getComputedStyle(transportElement).gap) || 6
      }
    };
  }
  const geometry = recordingOverlayGeometry || {
    rect: { x: 0, y: 0, width: 30, height: 30 },
    transportRect: { x: 0, y: 0, width: 102, height: 36 },
    appearance: {
      scale: 1,
      buttonSize: 30,
      iconSize: 16,
      gap: 6,
      transportButtonSize: 30,
      transportIconSize: 16,
      transportGap: 6
    }
  };
  return {
    active: recordingPresentationActive,
    visible,
    showTransport: true,
    state: recordingUiSnapshot.state || 'idle',
    rect: geometry.rect,
    transportRect: geometry.transportRect,
    appearance: {
      accent: rootStyle.getPropertyValue('--accent').trim() || '#67f7ff',
      ...geometry.appearance,
      edgePadding: Math.ceil(18 * geometry.appearance.scale)
    },
    playing: playPauseButton.classList.contains('is-playing'),
    labels: {
      stop: tr('actions.stopRecording'),
      previous: tr('controls.previous'),
      play: tr('controls.play'),
      pause: tr('controls.pause'),
      next: tr('controls.next'),
      finalizing: tr('recording.finalizing')
    }
  };
}

function syncRecordingControlsOverlay(visible) {
  window.genrePolice.updateRecordingControls(recordingControlsOverlayPayload(visible));
}

function setRecordingOverlayVisibility(visible, { force = false } = {}) {
  const recordingStateVisible = recordingUiSnapshot.state === 'recording'
    || recordingUiSnapshot.state === 'stopping';
  const nextVisible = Boolean(visible && recordingPresentationActive && recordingStateVisible);
  if (!force && recordingOverlayVisible === nextVisible) return;
  recordingOverlayVisible = nextVisible;
  syncRecordingControlsOverlay(recordingOverlayVisible);
}

function updateRecordingUi(snapshot) {
  const previousState = recordingUiSnapshot.state;
  recordingUiSnapshot = snapshot || { state: 'idle' };
  renderRecordingUi();
  if (recordingUiSnapshot.state === 'recording' && previousState !== 'recording') showControls();
  if (snapshot?.state !== 'idle' || snapshot.canceled) return;
  if (snapshot.result?.ok) {
    showRecordingToast(tr('recording.saved', {
      file: recordingFileName(snapshot.result.filePath || snapshot.filePath)
    }));
  } else if (snapshot.error) {
    showRecordingToast(recordingErrorMessage(snapshot.error), { error: true });
  }
}

function setRecordingPresentation(active) {
  const nextActive = active === true;
  if (nextActive) recordingControlsOverlayPayload(false);
  recordingPresentationActive = nextActive;
  recordingOverlayVisible = false;
  syncRecordingControlsOverlay(false);
  [controls, transport, fullscreenControls, fullscreenTransport, settings, neteaseSmtcToast, recordingToast].forEach((element) => {
    element.classList.toggle('recording-suppressed', recordingPresentationActive);
  });
  genreQuickPanel.classList.toggle('recording-suppressed', recordingPresentationActive);
  if (recordingPresentationActive) {
    closeGenreQuickPanel({ restoreHitTest: false });
    restoreSettingsAfterRecording = !settings.hidden;
    if (!settings.hidden) closeSettings();
    dismissNeteaseSmtcToast();
    hideRecordingToast();
    clearControlsTimer();
  }
  updateBackgroundStyle();
  if (!recordingPresentationActive && restoreSettingsAfterRecording) {
    restoreSettingsAfterRecording = false;
    requestAnimationFrame(openSettings);
  } else if (!recordingPresentationActive) {
    requestAnimationFrame(showControls);
  }
}

function toggleRecording() {
  if (recorder.state === 'recording') {
    void recorder.stop();
  } else if (recorder.state === 'idle') {
    void recorder.start();
  }
}

function selectSettingsPane(value, { focusTab = false, resetScroll = true } = {}) {
  const nextPane = settingsTabs.some((tab) => tab.dataset.settingsPane === value)
    ? value
    : 'appearance';
  activeSettingsPane = nextPane;
  settingsTabs.forEach((tab) => {
    const active = tab.dataset.settingsPane === nextPane;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focusTab) tab.focus();
  });
  settingsPanes.forEach((pane) => {
    pane.hidden = pane.dataset.settingsPane !== nextPane;
  });
  setScaleMenuOpen(false);
  setLanguageMenuOpen(false);
  setMediaSourceMenuOpen(false);
  setCustomGenreVisualMenuOpen(false);
  setGenreArtistMenuOpen(false);
  closeCustomGenreColorEditor();
  closeGenreCorrectionSuggestions();
  if (resetScroll && settingsScroll) settingsScroll.scrollTop = 0;
  requestAnimationFrame(updateSettingsScrollbar);
}

function correctionGenreOptions() {
  const builtIn = genreOptions.map((option) => ({ ...option, searchTerms: [] }));
  const custom = customGenres.map((rule) => {
    const base = genreOptions.find((option) => option.id === rule.baseGenreId);
    return {
      id: `custom:${rule.id}`,
      label: rule.name,
      parent: [tr('settings.customGenres'), base?.label].filter(Boolean).join(' · '),
      searchTerms: rule.aliases || []
    };
  });
  return [...custom, ...builtIn];
}

function currentCorrectionOption() {
  const options = correctionGenreOptions();
  const selectedId = String(genreCorrectionInput.dataset.genreId || '');
  if (selectedId) return options.find((option) => option.id === selectedId) || null;
  const value = genreCorrectionInput.value.trim().toLocaleLowerCase();
  return options.find((option) => option.id.toLocaleLowerCase() === value
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
  const ranked = correctionGenreOptions()
    .filter((option) => !needle
      || option.label.toLocaleLowerCase().includes(needle)
      || option.id.toLocaleLowerCase().includes(needle)
      || option.searchTerms.some((term) => term.toLocaleLowerCase().includes(needle)))
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
  closeGenreQuickPanel({ restoreHitTest: false });
  dismissNeteaseSmtcToast();
  if (!updateToast.hidden) {
    pendingUpdateResult = latestUpdateResult;
    updateToast.hidden = true;
  }
  settings.hidden = false;
  window.genrePolice.setSettingsOpen(true);
  document.body.classList.add('settings-open', 'pointer-active');
  settingsButton.setAttribute('aria-expanded', 'true');
  clearControlsTimer();
  selectSettingsPane(focusCorrection ? 'genre' : activeSettingsPane, { resetScroll: focusCorrection });
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
  mousePassthroughEnabled = clickThrough === true;
  mousePassthroughToggle.setAttribute('aria-checked', String(mousePassthroughEnabled));
  mousePassthroughToggle.title = mousePassthroughEnabled
    ? tr('settings.mousePassthroughOn')
    : tr('settings.mousePassthroughOff');
  document.body.classList.toggle('interactive', !mousePassthroughEnabled);
  if (mousePassthroughEnabled) {
    clearControlsTimer();
    closeGenreQuickPanel({ restoreHitTest: false });
    setScaleMenuOpen(false);
    setLanguageMenuOpen(false);
    setMediaSourceMenuOpen(false);
    document.body.classList.remove('pointer-active', 'settings-open');
    settings.hidden = true;
    window.genrePolice.setSettingsOpen(false);
  } else {
    showControls();
  }
}

function setMousePassthroughEnabled(enabled, { persist = false } = {}) {
  const previous = mousePassthroughEnabled;
  setInteractionState(enabled === true);
  if (!persist) return;
  window.genrePolice.setConfig({ clickThrough: mousePassthroughEnabled }).then((result) => {
    if (typeof result?.clickThrough === 'boolean') setInteractionState(result.clickThrough);
  }).catch(() => setInteractionState(previous));
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
    genreUncertain: Boolean(metadata?.genreUncertain),
    hardcoreTanoc: Boolean(metadata?.hardcoreTanoc),
    genrePoliceEasterEgg: isGenrePoliceTrack(metadata)
  };
}

async function transitionTo(metadata, immediate = false, subtle = false) {
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
  renderLocalizedHud(content);
  const genreNoteText = content.resolving ? '' : String(content.theme.note || '');
  genreNote.textContent = genreNoteText;
  genreNote.hidden = !genreNoteText;
  setPlaybackVisualState(content.playing);
  setArtwork(content.artwork);
  setSyncedLyrics(content.lyrics);

  hud.classList.remove('leaving');
  if (subtle) return;
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
  const animationActive = Boolean(recordingPresentationActive || demoTheme || currentMetadata?.playing);
  const minimumFrameInterval = document.hidden
    ? 250
    : animationActive || !idleFrameLimitEnabled
      ? 0
      : 1000 / 30;
  if (lastAnimationWorkAt && time - lastAnimationWorkAt < minimumFrameInterval) {
    requestAnimationFrame(animate);
    return;
  }
  lastAnimationWorkAt = time;
  updateFpsCounter(time);
  const rawFrameIntervalMs = previousAnimationTime ? time - previousAnimationTime : 16.667;
  const elapsedMs = Math.min(80, Math.max(4, rawFrameIntervalMs));
  const frameScale = Math.min(2, elapsedMs / 16.667);
  previousAnimationTime = time;
  const frameWorkStartedAt = performance.now();
  let metrics = audio.update(time);
  metrics = syntheticDemoMetrics(metrics, time);
  metrics = applyVisualResponse(metrics, visualResponseMode);
  metrics = softenMotionMetrics(metrics, motionMode);
  const synthwaveMode = currentTheme.id === 'synthwave';
  const synthwaveResponse = synthwaveMode ? synthwaveAudioResponse(metrics) : null;
  const visualRenderStartedAt = performance.now();
  visual.render(synthwaveResponse ? { ...metrics, synthwaveResponse } : metrics, time);
  const visualRenderDuration = performance.now() - visualRenderStartedAt;
  const playbackActive = Boolean(demoTheme || currentMetadata?.playing);
  const asmrMode = currentTheme.mode === 'asmr';
  const bilibiliMode = currentTheme.mode === 'bilibili';
  const tranceMode = currentTheme.mode === 'trance'
    && currentTheme.family !== 'classical'
    && !['soundtrack', 'synthwave'].includes(currentTheme.id);
  const asmrBreath = 0.5 + 0.5 * Math.sin(time * 0.00062);
  const posterEnergyTarget = playbackActive && !bilibiliMode
    ? synthwaveResponse?.starEnergy ?? clamp(
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
    playbackActive && !bilibiliMode ? synthwaveResponse?.starImpact ?? clamp(metrics.rhythmPulse || 0) : 0,
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
  const backdropStyleDue = !stageOutputActive
    || !lastFullscreenBackdropStyleAt
    || time - lastFullscreenBackdropStyleAt >= 1000 / 20;
  if (document.body.dataset.backgroundStyle === 'themed' && backdropStyleDue) {
    if (stageOutputActive) lastFullscreenBackdropStyleAt = time;
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
  if (tranceMode || synthwaveMode || bilibiliMode) {
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
  } else if (bilibiliMode) {
    coreArt.style.transform = `scale(${visual.bilibiliTvScaleX.toFixed(4)}, ${visual.bilibiliTvScaleY.toFixed(4)})`;
  } else if (synthwaveMode) {
    coreArt.style.transform = 'scale(1)';
  } else {
    coreArt.style.transform = `scale(${coreScale})`;
  }
  drawForegroundRiffStrings(metrics, time);
  const rawTextPulse = playbackActive && !bilibiliMode ? clamp(metrics.rhythmPulse || 0) : 0;
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
  if (bilibiliMode) {
    const bilibiliGenreTarget = playbackActive
      ? 0.99
        + visual.bilibiliVoiceActivity * 0.008
        + visual.bilibiliSectionDrive * 0.028
        + visual.bilibiliTransientDrive * 0.05
      : 1;
    genreVelocity += (bilibiliGenreTarget - genreScale) * 0.18 * frameScale;
    genreVelocity *= 0.76 ** frameScale;
    genreScale += genreVelocity * frameScale;
    genreScale = Math.max(0.982, Math.min(1.078, genreScale));
  } else {
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
  }
  genreLabel.style.setProperty('--genre-scale', genreScale.toFixed(4));
  const genreLiftTarget = playbackActive
    ? bilibiliMode
      ? 0
      : asmrMode
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
  const textBaseGlow = bilibiliMode ? 0 : Number(currentTheme.textBaseGlow) || 18;
  const textSliceFx = clamp(currentTheme.textSliceFx ?? textFx, 0.05, 1.15);
  const textEchoFx = clamp(currentTheme.textEchoFx ?? textFx, 0.05, 1.15);
  const textMotionGate = playbackActive && !bilibiliMode ? 1 : 0;
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
  const nextRenderPerformanceContext = stageOutputActive
    ? `fullscreen:${stageOutputTextVisible ? fullscreenLayoutMode : 'textless'}:${currentTheme.id}`
    : `desktop:${layoutMode}:${currentTheme.id}`;
  if (animationActive && !document.hidden
    && nextRenderPerformanceContext !== renderPerformanceContext) {
    renderPerformanceContext = nextRenderPerformanceContext;
    renderPerformanceStartedAt = 0;
    renderPerformanceWarmupUntil = time + 1200;
    renderFrameIntervals = [];
    renderDurations = [];
    renderWorkDurations = [];
    adaptiveLowFpsWindows = 0;
    adaptiveHighFpsWindows = 0;
    adaptiveResolutionScale = adaptiveResolutionProfiles.get(renderPerformanceContext) || 1;
    visual.setOutputResolutionScale(adaptiveResolutionScale);
  }
  if (animationActive && !document.hidden) {
    if (time >= renderPerformanceWarmupUntil) {
      if (!renderPerformanceStartedAt) renderPerformanceStartedAt = time;
      renderFrameIntervals.push(rawFrameIntervalMs);
      renderDurations.push(visualRenderDuration);
      renderWorkDurations.push(performance.now() - frameWorkStartedAt);
      if (time - renderPerformanceStartedAt >= 2000) {
      const percentile = (values, ratio) => {
        const sorted = [...values].sort((left, right) => left - right);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
      };
      const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      const fps = 1000 / Math.max(0.01, average(renderFrameIntervals));
      const frameP95 = percentile(renderFrameIntervals, 0.95);
      const renderAverage = average(renderDurations);
      const renderP95 = percentile(renderDurations, 0.95);
      const workP95 = percentile(renderWorkDurations, 0.95);
      const resolutionLevels = stageOutputActive
        ? [1, 0.9, 0.82, 0.76]
        : [1, 0.9, 0.82];
      const gpuLimitedDrop = fps < 57.5 && frameP95 >= 25 && workP95 < 14;
      const comfortablyStable = fps > 58 && frameP95 < 20.5;

      adaptiveLowFpsWindows = gpuLimitedDrop ? adaptiveLowFpsWindows + 1 : 0;
      adaptiveHighFpsWindows = comfortablyStable ? adaptiveHighFpsWindows + 1 : 0;

      if (adaptiveLowFpsWindows >= 2) {
        const nextScale = resolutionLevels.find((level) => level < adaptiveResolutionScale - 0.005);
        if (nextScale != null) {
          adaptiveResolutionScale = nextScale;
          visual.setOutputResolutionScale(nextScale);
          adaptiveResolutionProfiles.set(renderPerformanceContext, nextScale);
        }
        adaptiveLowFpsWindows = 0;
        adaptiveHighFpsWindows = 0;
      } else if (adaptiveHighFpsWindows >= 20 && adaptiveResolutionScale < 0.995) {
        const nextScale = [...resolutionLevels]
          .reverse()
          .find((level) => level > adaptiveResolutionScale + 0.005);
        if (nextScale != null) {
          adaptiveResolutionScale = nextScale;
          visual.setOutputResolutionScale(nextScale);
          adaptiveResolutionProfiles.set(renderPerformanceContext, nextScale);
        }
        adaptiveLowFpsWindows = 0;
        adaptiveHighFpsWindows = 0;
      }

      window.genrePolice.reportRenderPerformance({
        theme: currentTheme.id,
        fullscreen: stageOutputActive,
        fps,
        frameP95,
        renderAverage,
        renderP95,
        workP95,
        resolutionScale: visual.effectiveResolutionScale,
        pixelWidth: canvas.width,
        pixelHeight: canvas.height
      });
        renderPerformanceStartedAt = time;
        renderFrameIntervals = [];
        renderDurations = [];
        renderWorkDurations = [];
      }
    }
  } else if (renderPerformanceStartedAt || renderPerformanceContext) {
    renderPerformanceStartedAt = 0;
    renderPerformanceWarmupUntil = 0;
    renderPerformanceContext = '';
    renderFrameIntervals = [];
    renderDurations = [];
    renderWorkDurations = [];
  }
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

audio.addEventListener('audiosourceschange', ({ detail }) => {
  if (detail?.sourceId) captureAudioSourceId = detail.sourceId;
  void refreshCaptureAudioSources(detail?.sources);
  updateDiagnosticsUi();
});

audio.addEventListener('audiosourcefallback', () => {
  captureAudioSourceId = 'system';
  window.genrePolice.setConfig({ audioSourceId: captureAudioSourceId }).catch(() => {});
  void refreshCaptureAudioSources();
});

window.genrePolice.onNowPlaying((metadata) => {
  const nextKey = metadataKey(metadata);
  const currentKey = metadataKey(currentMetadata);
  const changedTrack = Boolean(nextKey && nextKey !== currentKey);
  if (changedTrack) closeGenreQuickPanel();
  // A completed metadata/genre request can carry the old position captured
  // when that request began. Keep the continuous clock for the same track.
  syncPlaybackClock(metadata, performance.now(), { force: changedTrack, reconcile: false });
  currentMetadata = metadata;
  if (metadata?.source) currentMediaSource = metadata.source;
  updateGenreCorrectionUi();
  updateDiagnosticsUi();
  if (!demoTheme) {
    const subtleGenreUpdate = Boolean(metadata?.audioGenreUpdate && !changedTrack);
    transitionTo(metadata, subtleGenreUpdate, subtleGenreUpdate);
  }
  else if (metadata?.artwork && currentDisplayContent?.artwork !== metadata.artwork) {
    currentDisplayContent.artwork = metadata.artwork;
    setArtwork(metadata.artwork);
  }
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
      label: genre
    },
    genreSource: 'VISUAL DEMO',
    artwork: theme.captureArtwork || currentMetadata?.artwork || '',
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
settingsTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectSettingsPane(tab.dataset.settingsPane));
  tab.addEventListener('keydown', (event) => {
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + settingsTabs.length) % settingsTabs.length;
    else if (event.key === 'ArrowRight') nextIndex = (index + 1) % settingsTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = settingsTabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = settingsTabs[nextIndex];
    selectSettingsPane(nextTab.dataset.settingsPane, { focusTab: true });
  });
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
fullscreenPreviousTrackButton.addEventListener('click', () => requestMediaControl('previous', fullscreenPreviousTrackButton));
fullscreenPlayPauseButton.addEventListener('click', () => requestMediaControl('toggle', fullscreenPlayPauseButton));
fullscreenNextTrackButton.addEventListener('click', () => requestMediaControl('next', fullscreenNextTrackButton));
neteaseSmtcToastClose.addEventListener('click', dismissNeteaseSmtcToast);
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
fullscreenEnglishFontToggle.addEventListener('click', () => {
  setFullscreenCondensedEnglish(!fullscreenCondensedEnglish, { persist: true });
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
artistGenreReferenceToggle.addEventListener('click', () => {
  setArtistGenreReferenceEnabled(!artistGenreReferenceEnabled, { persist: true });
});
localGenreModelToggle.addEventListener('click', () => {
  if (!localGenreModelToggle.disabled) {
    setLocalGenreModelEnabled(!localGenreModelEnabled, { persist: true });
  }
});
dynamicGenreDetectionToggle.addEventListener('click', () => {
  setDynamicGenreDetectionEnabled(!dynamicGenreDetectionEnabled, { persist: true });
});
alwaysOnTopToggle.addEventListener('click', () => {
  setAlwaysOnTopEnabled(!alwaysOnTopEnabled, { persist: true });
});
desktopLayerToggle.addEventListener('click', () => {
  if (!desktopLayerToggle.disabled) {
    setDesktopLayerEnabled(!desktopLayerEnabled, { persist: true });
  }
});
recordingQuickButtonToggle.addEventListener('click', () => {
  setRecordingQuickButtonVisible(!recordingQuickButtonVisible, { persist: true });
});
snapshotQuickButtonToggle.addEventListener('click', () => {
  setSnapshotQuickButtonVisible(!snapshotQuickButtonVisible, { persist: true });
});
mousePassthroughToggle.addEventListener('click', () => {
  setMousePassthroughEnabled(!mousePassthroughEnabled, { persist: true });
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
visualResponseOptions.forEach((option) => {
  option.addEventListener('click', () => {
    setVisualResponseMode(option.dataset.visualResponse, { persist: true });
  });
});
idleBehaviorOptions.forEach((option) => {
  option.addEventListener('click', () => setIdleBehavior(option.dataset.idleBehavior, { persist: true }));
});
idleFrameLimitToggle.addEventListener('click', () => {
  setIdleFrameLimitEnabled(!idleFrameLimitEnabled, { persist: true });
});
showFpsToggle.addEventListener('click', () => {
  setShowFps(!showFps, { persist: true });
});
rhythmModelToggle.addEventListener('click', () => {
  setRhythmModelEnabled(!rhythmModelEnabled, { persist: true });
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
visualResponseGroup.addEventListener('keydown', (event) => {
  handleRadioSegmentKey(event, visualResponseOptions, (next) => {
    setVisualResponseMode(next.dataset.visualResponse, { persist: true });
  });
});
idleBehaviorGroup.addEventListener('keydown', (event) => {
  handleRadioSegmentKey(event, idleBehaviorOptions, (next) => setIdleBehavior(next.dataset.idleBehavior, { persist: true }));
});
captureAudioSourceButton.addEventListener('click', () => {
  const opening = captureAudioSourceMenu.hidden;
  setCaptureAudioSourceMenuOpen(opening, { focus: opening });
});
captureAudioSourceButton.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setCaptureAudioSourceMenuOpen(true, { focus: true });
});
captureAudioSourceMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.audio-source-option');
  if (option) void chooseCaptureAudioSource(option.dataset.audioSource);
});
captureAudioSourceMenu.addEventListener('keydown', (event) => {
  const options = captureAudioSourceOptions();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setCaptureAudioSourceMenuOpen(false);
    captureAudioSourceButton.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    void chooseCaptureAudioSource(options[currentIndex]?.dataset.audioSource);
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
customGenreVisual.addEventListener('click', () => {
  const opening = customGenreVisualMenu.hidden;
  setCustomGenreVisualMenuOpen(opening, { focus: opening });
});
customGenreVisual.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setCustomGenreVisualMenuOpen(true, { focus: true });
});
customGenreVisualMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.custom-genre-visual-option');
  if (option) chooseCustomGenreVisual(option.dataset.genreId);
});
customGenreVisualMenu.addEventListener('keydown', (event) => {
  const options = customGenreVisualOptions();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setCustomGenreVisualMenuOpen(false);
    customGenreVisual.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    chooseCustomGenreVisual(options[currentIndex]?.dataset.genreId);
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
  options[nextIndex]?.scrollIntoView({ block: 'nearest' });
});
genreArtistGenre.addEventListener('click', () => {
  const opening = genreArtistGenreMenu.hidden;
  setGenreArtistMenuOpen(opening, { focus: opening });
});
genreArtistGenre.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setGenreArtistMenuOpen(true, { focus: true });
});
genreArtistGenreMenu.addEventListener('click', (event) => {
  const option = event.target.closest('.genre-artist-genre-option');
  if (option) chooseGenreArtistGenre(option.dataset.genreId);
});
genreArtistGenreMenu.addEventListener('keydown', (event) => {
  const options = genreArtistOptions();
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  if (event.key === 'Escape') {
    event.preventDefault();
    setGenreArtistMenuOpen(false);
    genreArtistGenre.focus();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    chooseGenreArtistGenre(options[currentIndex]?.dataset.genreId);
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
  options[nextIndex]?.scrollIntoView({ block: 'nearest' });
});
customGenreColorsToggle.addEventListener('click', () => {
  const enabling = !customGenreColorsEnabled();
  setCustomGenreColorsEnabled(enabling);
});
for (const control of [customGenreAccent, customGenreAccent2, customGenreHot]) {
  control.addEventListener('click', () => openCustomGenreColorEditor(control));
}
customGenreColorEditorClose.addEventListener('click', () => closeCustomGenreColorEditor({ focus: true }));

function updateCustomGenreSvFromPointer(event) {
  const bounds = customGenreColorField.getBoundingClientRect();
  customGenreColorHsv.s = clamp((event.clientX - bounds.left) / bounds.width);
  customGenreColorHsv.v = 1 - clamp((event.clientY - bounds.top) / bounds.height);
  updateActiveCustomGenreColor();
}

customGenreColorField.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  customGenreColorField.setPointerCapture(event.pointerId);
  updateCustomGenreSvFromPointer(event);
});
customGenreColorField.addEventListener('pointermove', (event) => {
  if (customGenreColorField.hasPointerCapture(event.pointerId)) updateCustomGenreSvFromPointer(event);
});
customGenreColorField.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 0.05 : 0.01;
  if (event.key === 'ArrowLeft') customGenreColorHsv.s = clamp(customGenreColorHsv.s - step);
  else if (event.key === 'ArrowRight') customGenreColorHsv.s = clamp(customGenreColorHsv.s + step);
  else if (event.key === 'ArrowUp') customGenreColorHsv.v = clamp(customGenreColorHsv.v + step);
  else if (event.key === 'ArrowDown') customGenreColorHsv.v = clamp(customGenreColorHsv.v - step);
  else return;
  event.preventDefault();
  updateActiveCustomGenreColor();
});
customGenreColorHue.addEventListener('input', () => {
  customGenreColorHsv.h = Number(customGenreColorHue.value);
  updateActiveCustomGenreColor();
});
customGenreColorHex.addEventListener('input', () => {
  if (!/^#[0-9a-f]{6}$/i.test(customGenreColorHex.value.trim())) return;
  setCustomGenreColorValue(
    activeCustomGenreColorControl,
    customGenreColorOutput(activeCustomGenreColorControl),
    customGenreColorHex.value
  );
});
customGenreColorHex.addEventListener('blur', () => {
  if (!activeCustomGenreColorControl) return;
  const color = normalizeCustomColorHex(customGenreColorHex.value);
  if (color) setCustomGenreColorValue(
    activeCustomGenreColorControl,
    customGenreColorOutput(activeCustomGenreColorControl),
    color
  );
  else customGenreColorHex.value = activeCustomGenreColorControl.value;
});
customGenreColorHex.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    customGenreColorHex.value = activeCustomGenreColorControl?.value || '';
    closeCustomGenreColorEditor({ focus: true });
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const color = normalizeCustomColorHex(customGenreColorHex.value);
  if (color) {
    setCustomGenreColorValue(
      activeCustomGenreColorControl,
      customGenreColorOutput(activeCustomGenreColorControl),
      color
    );
    customGenreColorHex.select();
  }
});
customGenreColorsReset.addEventListener('click', () => {
  setCustomGenreColorsEnabled(false, { restoreDefaults: true });
  customGenreColorsToggle.focus();
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
  if (!event.target.closest('.audio-source-picker')) setCaptureAudioSourceMenuOpen(false);
  if (!event.target.closest('.media-source-picker')) setMediaSourceMenuOpen(false);
  if (!event.target.closest('.custom-genre-visual-picker')) setCustomGenreVisualMenuOpen(false);
  if (!event.target.closest('.genre-artist-genre-picker')) setGenreArtistMenuOpen(false);
  if (!event.target.closest('.custom-genre-color-editor')
    && !event.target.closest('.custom-genre-color-value')) closeCustomGenreColorEditor();
  if (!event.target.closest('.genre-correction-picker')) closeGenreCorrectionSuggestions();
  if (!genreQuickPanel.hidden
    && !event.target.closest('#genre-quick-panel')
    && !event.target.closest('#genre')) closeGenreQuickPanel();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !settings.hidden) {
    event.preventDefault();
    closeSettings();
    return;
  }
  if (event.key === 'Escape' && !genreQuickPanel.hidden) {
    event.preventDefault();
    closeGenreQuickPanel();
    genreLabel.focus();
    return;
  }
  if (event.key === 'Escape' && stageOutputActive) {
    event.preventDefault();
    void window.genrePolice.setStageOutput(false);
  }
});
genreLabel.addEventListener('click', openGenreQuickPanel);
genreLabel.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openGenreQuickPanel();
});
genreQuickClose.addEventListener('click', () => closeGenreQuickPanel());
genreQuickUse.addEventListener('click', async () => {
  if (!genreQuickSelectedId) return;
  const selected = genreQuickData?.candidates?.find((candidate) => candidate.id === genreQuickSelectedId);
  const result = await window.genrePolice.setTemporaryGenre(genreQuickSelectedId);
  if (!result?.ok) {
    genreQuickState.textContent = tr('genreQuick.failed');
    return;
  }
  await refreshGenreQuickPanel();
  genreQuickState.textContent = tr('genreQuick.locked', { genre: selected?.label || result.override?.label || '' });
});
genreQuickRemember.addEventListener('click', async () => {
  if (!genreQuickSelectedId) return;
  const selected = genreQuickData?.candidates?.find((candidate) => candidate.id === genreQuickSelectedId);
  const result = await window.genrePolice.setGenreCorrection(genreQuickSelectedId);
  if (!result?.ok) {
    genreQuickState.textContent = tr('genreQuick.failed');
    return;
  }
  await refreshGenreQuickPanel();
  genreQuickState.textContent = tr('genreQuick.remembered', { genre: selected?.label || result.correction?.label || '' });
});
genreQuickUnlock.addEventListener('click', async () => {
  const result = await window.genrePolice.clearTemporaryGenre();
  if (!result?.ok) {
    genreQuickState.textContent = tr('genreQuick.failed');
    return;
  }
  await refreshGenreQuickPanel();
  genreQuickState.textContent = tr('genreQuick.unlocked');
});
genreQuickMore.addEventListener('click', () => {
  const option = correctionGenreOptions().find((item) => item.id === genreQuickSelectedId) || null;
  closeGenreQuickPanel({ restoreHitTest: false });
  openSettings({ focusCorrection: true });
  if (option) {
    genreCorrectionInput.value = option.label;
    genreCorrectionInput.dataset.genreId = option.id;
  }
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
  try {
    const result = await window.genrePolice.setGenreCorrection(option.id);
    genreCorrectionState.textContent = result?.ok
      ? result.correction?.fallbackIdentity
        ? tr('settings.genreCorrectionSavedByTitle', { genre: option.label })
        : tr('settings.genreCorrectionSaved', { genre: option.label })
      : tr('settings.genreCorrectionFailed');
  } catch {
    genreCorrectionState.textContent = tr('settings.genreCorrectionFailed');
  }
});
genreCorrectionClear.addEventListener('click', async () => {
  const result = await window.genrePolice.clearGenreCorrection();
  if (result?.ok) {
    genreCorrectionInput.value = '';
    genreCorrectionInput.dataset.genreId = '';
    genreCorrectionState.textContent = tr('settings.genreCorrectionCleared');
  }
});
genreArtistAdd.addEventListener('click', async () => {
  const artist = genreArtistName.value.trim().replace(/\s+/g, ' ');
  const genreId = genreArtistGenre.value;
  if (!artist || !genreOptions.some((option) => option.id === genreId && option.id !== 'unknown')) {
    genreArtistState.textContent = tr('settings.genreArtistInvalid');
    return;
  }
  const key = genreArtistKey(artist);
  const nextRules = [
    ...genreArtistRules.filter((rule) => genreArtistKey(rule.artist) !== key),
    { artist, genreId }
  ];
  genreArtistAdd.disabled = true;
  try {
    await persistGenreArtistRules(nextRules);
    genreArtistName.value = '';
    genreArtistState.textContent = tr('settings.genreArtistSaved');
    genreArtistName.focus();
  } catch {
    genreArtistState.textContent = tr('settings.genreCorrectionFailed');
  } finally {
    genreArtistAdd.disabled = false;
  }
});
genreArtistName.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  genreArtistAdd.click();
});
genreArtistList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  const row = event.target.closest('.genre-artist-item');
  if (!button || !row) return;
  const index = Number(row.dataset.ruleIndex);
  if (!Number.isInteger(index) || !genreArtistRules[index]) return;
  button.disabled = true;
  try {
    await persistGenreArtistRules(genreArtistRules.filter((_, ruleIndex) => ruleIndex !== index));
    genreArtistState.textContent = tr('settings.genreArtistDeleted');
  } catch {
    genreArtistState.textContent = tr('settings.genreCorrectionFailed');
    button.disabled = false;
  }
});
customGenreSave.addEventListener('click', async () => {
  const name = customGenreName.value.trim().replace(/\s+/g, ' ');
  const aliases = splitCustomGenreTerms(customGenreAliases.value);
  const artists = splitCustomGenreTerms(customGenreArtists.value);
  const baseGenreId = customGenreVisual.value;
  const colors = customGenreColorOverrides();
  if (!name || (!aliases.length && !artists.length) || !baseGenreId) {
    customGenreState.textContent = tr('settings.customGenreInvalid');
    return;
  }
  const id = editingCustomGenreId
    || globalThis.crypto?.randomUUID?.()
    || `custom-${Date.now().toString(36)}`;
  const nextRule = { id, name, aliases, artists, baseGenreId, ...(colors ? { colors } : {}) };
  const nextRules = editingCustomGenreId
    ? customGenres.map((rule) => rule.id === editingCustomGenreId ? nextRule : rule)
    : [...customGenres, nextRule];
  customGenreSave.disabled = true;
  try {
    await persistCustomGenres(nextRules);
    resetCustomGenreEditor();
    customGenreState.textContent = tr('settings.customGenreSaved');
  } catch {
    customGenreState.textContent = tr('settings.genreCorrectionFailed');
  } finally {
    customGenreSave.disabled = false;
  }
});
customGenreCancel.addEventListener('click', () => resetCustomGenreEditor({ clearState: true }));
customGenreList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.custom-genre-item');
  if (!button || !row) return;
  const rule = customGenres.find((item) => item.id === row.dataset.ruleId);
  if (!rule) return;
  if (button.dataset.action === 'edit') {
    pendingCustomGenreDeleteId = '';
    editCustomGenre(rule);
    return;
  }
  if (button.dataset.action === 'delete') {
    pendingCustomGenreDeleteId = rule.id;
    renderCustomGenres();
    customGenreList.querySelector('[data-action="confirm-delete"]')?.focus();
    return;
  }
  if (button.dataset.action === 'cancel-delete') {
    pendingCustomGenreDeleteId = '';
    renderCustomGenres();
    return;
  }
  if (button.dataset.action !== 'confirm-delete') return;
  button.disabled = true;
  pendingCustomGenreDeleteId = '';
  try {
    await persistCustomGenres(customGenres.filter((item) => item.id !== rule.id));
    if (editingCustomGenreId === rule.id) resetCustomGenreEditor();
    customGenreState.textContent = tr('settings.customGenreDeleted');
  } catch {
    pendingCustomGenreDeleteId = rule.id;
    renderCustomGenres();
    customGenreState.textContent = tr('settings.genreCorrectionFailed');
  }
});
genreDataExport.addEventListener('click', async () => {
  genreDataExport.disabled = true;
  genreDataImport.disabled = true;
  genreDataState.textContent = tr('genreData.exporting');
  try {
    const result = await window.genrePolice.exportGenreData();
    genreDataState.textContent = result?.canceled
      ? ''
      : result?.ok
        ? tr('genreData.exported', {
          corrections: result.correctionCount,
          customGenres: result.customGenreCount,
          genreArtistRules: result.genreArtistRuleCount
        })
        : tr('genreData.exportFailed');
  } catch {
    genreDataState.textContent = tr('genreData.exportFailed');
  } finally {
    genreDataExport.disabled = false;
    genreDataImport.disabled = false;
    requestAnimationFrame(updateSettingsScrollbar);
  }
});
genreDataImport.addEventListener('click', async () => {
  genreDataExport.disabled = true;
  genreDataImport.disabled = true;
  genreDataState.textContent = tr('genreData.importing');
  try {
    const result = await window.genrePolice.importGenreData();
    if (result?.canceled) {
      genreDataState.textContent = '';
    } else if (result?.ok) {
      customGenres = Array.isArray(result.customGenres) ? result.customGenres : customGenres;
      genreArtistRules = Array.isArray(result.genreArtistRules) ? result.genreArtistRules : genreArtistRules;
      resetCustomGenreEditor({ clearState: true });
      renderGenreArtistRules();
      renderCustomGenres();
      genreDataState.textContent = tr('genreData.imported', result.summary || {});
    } else {
      const invalid = ['invalid-json', 'invalid-format', 'unsupported-version', 'too-large']
        .includes(result?.error);
      genreDataState.textContent = tr(invalid ? 'genreData.invalid' : 'genreData.importFailed');
    }
  } catch {
    genreDataState.textContent = tr('genreData.importFailed');
  } finally {
    genreDataExport.disabled = false;
    genreDataImport.disabled = false;
    requestAnimationFrame(updateSettingsScrollbar);
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
  setDiagnosticsRefreshing(diagnosticsPanel.open);
  if (diagnosticsPanel.open) updateDiagnosticsUi();
  requestAnimationFrame(updateSettingsScrollbar);
});
customGenrePanel.addEventListener('toggle', () => requestAnimationFrame(updateSettingsScrollbar));
genreArtistPanel.addEventListener('toggle', () => requestAnimationFrame(updateSettingsScrollbar));
settingsSourcesPanel.addEventListener('toggle', () => requestAnimationFrame(updateSettingsScrollbar));
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
      genreUncertain: Boolean(currentMetadata?.genreUncertain),
      genreUncertainReason: currentMetadata?.genreUncertainReason || '',
      genreEvidence: currentMetadata?.genreEvidence || null,
      genreSources: currentMetadata?.genreSources || [],
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
updateCheckButton.addEventListener('click', checkForUpdatesManually);
updateViewButton.addEventListener('click', () => openAvailableUpdate());
updateToastDismiss.addEventListener('click', () => {
  const version = latestUpdateResult?.latestVersion || '';
  hideUpdateToast({ clearPending: true });
  if (version) window.genrePolice.dismissUpdate(version).catch(() => {});
});
updateToastView.addEventListener('click', () => openAvailableUpdate({ acknowledge: true }));
stageOutputStartStop.addEventListener('click', () => void toggleStageOutput());
stageOutputTextToggle.addEventListener('click', () => {
  setStageOutputTextVisible(!stageOutputTextVisible, { persist: true });
});
fullscreenQuickButton.addEventListener('click', () => void toggleStageOutput());
fullscreenSnapshotButton.addEventListener('click', () => void saveSnapshot());
fullscreenRecordingButton.addEventListener('click', toggleRecording);
fullscreenSettingsButton.addEventListener('click', () => void openSettingsFromFullscreen());
fullscreenLayoutButton.addEventListener('click', () => {
  setFullscreenLayoutMode(fullscreenLayoutMode === 'stacked' ? 'split' : 'stacked', { persist: true });
});
fullscreenTextButton.addEventListener('click', () => {
  setStageOutputTextVisible(!stageOutputTextVisible, { persist: true });
});
fullscreenExitButton.addEventListener('click', () => void window.genrePolice.setStageOutput(false));
recordingStartStop.addEventListener('click', toggleRecording);
recordingQuickButton.addEventListener('click', toggleRecording);
snapshotSaveButton.addEventListener('click', () => void saveSnapshot());
snapshotQuickButton.addEventListener('click', () => void saveSnapshot());
recordingToastClose.addEventListener('click', hideRecordingToast);
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
window.addEventListener('resize', () => {
  updateSettingsScrollbar();
  updateStageOutputScale();
  refreshPresentationTypography();
}, { passive: true });
window.addEventListener('pointerleave', () => hideControls(260));
window.addEventListener('blur', () => hideControls(120));
controls.addEventListener('pointerenter', clearControlsTimer);
controls.addEventListener('pointerleave', showControls);
transport.addEventListener('pointerenter', clearControlsTimer);
transport.addEventListener('pointerleave', showControls);
fullscreenControls.addEventListener('pointerenter', clearControlsTimer);
fullscreenControls.addEventListener('pointerleave', showControls);
fullscreenTransport.addEventListener('pointerenter', clearControlsTimer);
fullscreenTransport.addEventListener('pointerleave', showControls);

window.genrePolice.getConfig().then((config) => {
  captureAudioSourceId = String(config.audioSourceId || 'system');
  preferredMediaSource = config.preferredMediaSource || '';
  ignoredMediaSources = Array.isArray(config.ignoredMediaSources) ? config.ignoredMediaSources : [];
  availableMediaSources = Array.isArray(config.availableMediaSources) ? config.availableMediaSources : [];
  currentMediaSource = config.currentMediaSource || '';
  detectedMediaPlayers = config.detectedPlayers || detectedMediaPlayers;
  customGenres = Array.isArray(config.customGenres) ? config.customGenres : [];
  genreArtistRules = Array.isArray(config.genreArtistRules) ? config.genreArtistRules : [];
  latestRhythmModelState = config.rhythmModelState || latestRhythmModelState;
  latestAudioGenreModelState = config.audioGenreModelState || latestAudioGenreModelState;
  lastFmInput.value = config.lastFmApiKey || '';
  discogsTokenInput.value = config.discogsToken || '';
  appVersionLabel.textContent = config.appVersion || '0.3.0';
  genreOptions = Array.isArray(config.genreOptions) ? config.genreOptions : [];
  applyLanguage(config.language);
  setLyricsEnabled(config.lyricsEnabled !== false);
  setLyricTranslationEnabled(config.lyricTranslationEnabled !== false);
  setCapsuleCondensedEnglish(config.capsuleCondensedEnglish === true);
  setPosterCondensedEnglish(config.posterCondensedEnglish !== false);
  setFullscreenCondensedEnglish(config.fullscreenCondensedEnglish === true);
  setCapsuleThemedBackground(config.capsuleThemedBackground !== false);
  setPosterThemedBackground(config.posterThemedBackground !== false);
  setLyricSweepEnabled(config.lyricSweepEnabled !== false);
  setOnlineGenreLookupEnabled(config.onlineGenreLookupEnabled !== false);
  setArtistGenreReferenceEnabled(config.artistGenreReferenceEnabled !== false);
  dynamicGenreDetectionEnabled = config.dynamicGenreDetectionEnabled === true;
  setLocalGenreModelEnabled(config.localGenreModelEnabled !== false, {
    available: config.localGenreModelAvailable !== false
  });
  setDynamicGenreDetectionEnabled(config.dynamicGenreDetectionEnabled === true);
  setAlwaysOnTopEnabled(config.alwaysOnTop === true);
  setDesktopLayerEnabled(config.desktopLayer === true, {
    available: config.desktopLayerAvailable !== false
  });
  setRecordingQuickButtonVisible(config.recordingQuickButtonVisible === true);
  setSnapshotQuickButtonVisible(config.snapshotQuickButtonVisible === true);
  setFullscreenLayoutMode(config.fullscreenLayoutMode);
  setStageOutputTextVisible(config.stageOutputTextVisible !== false);
  setLaunchAtLoginEnabled(config.launchAtLogin === true, {
    supported: config.launchAtLoginSupported !== false
  });
  setMotionMode(config.motionMode);
  setVisualResponseMode(config.visualResponseMode);
  setIdleBehavior(config.idleBehavior);
  setIdleFrameLimitEnabled(config.idleFrameLimitEnabled !== false);
  setShowFps(config.showFps === true);
  setRhythmModelEnabled(config.rhythmModelEnabled !== false);
  renderMediaSourceSettings();
  resetCustomGenreEditor();
  renderGenreArtistRules();
  renderCustomGenres();
  setLyricDelay(config.lyricDelayMs);
  applyLayoutMode(config.layoutMode);
  applyUiScale(config.uiScale);
  setInteractionState(config.clickThrough);
  applyStageOutputState({ active: config.stageOutputActive === true });
  updateGenreCorrectionUi();
  if (captureAudioSourceId === 'system') {
    void refreshCaptureAudioSources();
  } else {
    void audio.setAudioSource(captureAudioSourceId).then((activeSourceId) => {
      captureAudioSourceId = activeSourceId;
      return refreshCaptureAudioSources();
    }).catch(() => {
      captureAudioSourceId = 'system';
      return refreshCaptureAudioSources();
    });
  }
});
window.genrePolice.onLayoutMode((payload) => {
  const requestedLayoutMode = payload?.mode === 'poster' || payload?.mode === 'stage' ? 'poster' : 'side';
  if (stageOutputActive) {
    stageOutputRestoreLayoutMode = requestedLayoutMode;
    return;
  }
  if (requestedLayoutMode !== layoutMode) applyLayoutMode(requestedLayoutMode);
});
window.genrePolice.onStageOutputState(applyStageOutputState);
window.genrePolice.onOpenSettings(() => openSettings());
window.genrePolice.onOpenGenreCorrection(() => openSettings({ focusCorrection: true }));
window.genrePolice.onRecordingCommand((command) => {
  if (command === 'stop') {
    if (recorder.state === 'recording') void recorder.stop();
    return;
  }
  if (command === 'start' && recorder.state === 'idle') void recorder.start();
});
window.genrePolice.onRecordingControlsActivity((phase) => {
  if (!recordingPresentationActive) return;
  if (phase === 'enter') {
    showControls();
    return;
  }
  if (phase === 'leave') hideControls(260);
});
window.genrePolice.onUpdateStatus((result) => showUpdateToast(result));

applyTheme(fallbackTheme);
renderRecordingUi();
genreLabel.dataset.text = genreLabel.textContent;
transitionTo(null, true);
audio.start();
requestAnimationFrame(animate);
