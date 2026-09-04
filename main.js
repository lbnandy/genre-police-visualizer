'use strict';

const { app, BrowserWindow, Menu, Tray, ipcMain, session, desktopCapturer, screen, nativeImage, globalShortcut, net, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { GenreResolver } = require('./src/genre-resolver');
const { LyricsResolver } = require('./src/lyrics-resolver');
const { THEMES, DEMO_THEME_IDS, themeFor, themeWithId } = require('./src/themes');
const { analyzeBackdropBitmap, deriveBackdropProfile, smoothBackdropSample } = require('./src/backdrop-analyzer');
const { analyzeArtworkBitmap, chooseArtworkFacePalette } = require('./src/artwork-face-palette');
const {
  normalizeAlwaysOnTop,
  normalizeAudioSourceId,
  normalizeClickThrough,
  normalizeDesktopLayer,
  normalizeFrameRateLimit,
  normalizeIdleBehavior,
  normalizeIgnoredMediaSources,
  normalizeMediaSource,
  normalizeMotionMode,
  normalizeVisualResponseMode,
  sanitizeStoredConfig
} = require('./src/config-sanitizer');
const { resolveWindowBounds } = require('./src/window-position');
const { isHardcoreTanocArtist } = require('./src/hardcore-tanoc');
const { displayArtistName } = require('./src/genre-classifier');
const { normalizeLocale, resolveInitialLocale, translate } = require('./src/i18n');
const { buildPreviewTree } = require('./src/preview-menu');
const { normalizeLayoutMode, layoutWindowSize } = require('./src/layout-mode');
const { pointInWindowSurface } = require('./src/window-hit-region');
const { UI_SCALES, normalizeUiScale, uiScaleLabel } = require('./src/ui-scale');
const { HOP_SIZE, LocalRhythmModel } = require('./src/rhythm-model-runtime');
const { LocalAudioGenreModel } = require('./src/audio-genre-runtime');
const { ONNX_RUNTIME_LOAD_FAILURE_CODES } = require('./src/onnx-runtime-loader');
const {
  createAudioGenreMemories,
  createAudioGenreMemoryCandidate,
  getAudioGenreMemory,
  hasFullTrackAnalysisCoverage,
  isNearTrackBeginning,
  isNearTrackEnd,
  shouldCollectAudioGenreMemory,
  setAudioGenreMemory
} = require('./src/audio-genre-memory');
const {
  hasSignificantPlaybackSeek,
  hasAudioGenreCompatibilityProfile,
  isBroadAudioGenre,
  shouldAnalyzeAudioGenre,
  shouldKeepGenreIdentifying,
  shouldReplaceMetadataWithAudioGenre
} = require('./src/audio-genre-model');
const {
  customGenreCorrectionId,
  findCustomGenreByCorrectionId,
  normalizeCustomGenreRules
} = require('./src/custom-genres');
const { normalizeGenreArtistRules } = require('./src/genre-artist-rules');
const { withGenreReliability } = require('./src/genre-reliability');
const { createGenreDataExport, mergeGenreData } = require('./src/genre-data-transfer');
const { patchMp4DurationFile } = require('./src/recording-container');
const {
  UPDATE_RELEASES_URL,
  canonicalVersion,
  isAllowedReleaseUrl,
  isUpdateCheckDue,
  sameVersion,
  selectLatestUpdate
} = require('./src/update-checker');
const {
  clearGenreCorrection,
  createGenreCorrections,
  getGenreCorrection,
  setGenreCorrection
} = require('./src/genre-corrections');

let mainWindow = null;
let tray = null;
let mediaProcess = null;
let mediaWatchdogTimer = null;
let mediaRestartTimer = null;
let availableMediaSources = [];
let detectedMediaPlayers = { neteaseRunning: false, neteaseSmtcAvailable: false };
let idleHideTimer = null;
let idleAutoHidden = false;
let rhythmModel = null;
let rhythmModelStartTask = null;
let rhythmModelState = { type: 'unavailable', reason: 'not started' };
let audioGenreModel = null;
let audioGenreModelStartTask = null;
let audioGenreModelState = { type: 'unavailable', reason: 'not started' };
const VC_RUNTIME_DOWNLOAD_URL = 'https://aka.ms/vc14/vc_redist.x64.exe';
let clickThrough = false;
let mainSettingsOpen = false;
let pointerHitTestTimer = null;
let mainWindowMouseEventsIgnored = null;
let mainWindowBeingMoved = false;
let alwaysOnTop = false;
let desktopLayerEnabled = false;
let desktopLayerAttached = false;
let desktopLayerLastError = '';
let desktopLayerMonitor = null;
let desktopLayerTask = Promise.resolve();
let stageOutputActive = false;
let stageOutputRestoreBounds = null;
let demoTheme = '';
let lastRawMetadata = null;
let lastResolvedMetadata = null;
let lastBaseResolvedMetadata = null;
let currentAudioGenreDecision = null;
let temporaryGenreOverride = null;
let lastTrackKey = '';
let resolutionSerial = 0;
let lastLyricsKey = '';
let config = {};
let genreCorrections = createGenreCorrections();
let audioGenreMemories = createAudioGenreMemories();
let currentAudioGenreMemory = null;
let currentAudioGenreMemoryCollectionRequired = false;
let currentAudioGenreSnapshot = null;
let currentAudioGenreStartedNearBeginning = false;
let audioGenreMemoryVerificationLimit = 0;
let lastPersistedAudioGenreWindows = 0;
let backdropTimer = null;
let windowPositionSaveTimer = null;
let backdropSampling = false;
let backdropSampleState = null;
const artworkSampleCache = new Map();
const LYRIC_DELAY_MIN_MS = -2000;
const LYRIC_DELAY_MAX_MS = 2000;
const DEFAULT_LYRIC_DELAY_MS = 0;
const NETWORK_REGION_TIMEOUT_MS = 1200;
const MAX_GENRE_DATA_FILE_BYTES = 2_000_000;
const AUDIO_GENRE_MEMORY_CONFIRMATION_WINDOWS = 24;
const AUDIO_GENRE_MEMORY_WRITE_INTERVAL_WINDOWS = 10;
let networkCountry = '';
let networkCountryTask = null;
let recordingSession = null;
let quitAfterRecording = false;
let recordingControlsWindow = null;
let recordingTransportWindow = null;
let recordingControlsState = null;
let updateCheckTimer = null;
let updateCheckTask = null;
let latestUpdate = null;
let snapshotSession = null;

function recordingLocaleText(key, variables) {
  return translate(normalizeLocale(config.language), key, variables);
}

function recordingFileStem() {
  const title = String(lastRawMetadata?.title || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 96);
  if (title) return title;
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `genre-police-recording-${stamp}`;
}

function snapshotFileStem() {
  return recordingFileStem().replace('recording', 'snapshot');
}

function recordingSenderAllowed(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);
}

function setRecordingBackgroundPriority(active) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.setBackgroundThrottling(active !== true);
}

function closeRecordingFile({ keepPartial = false } = {}) {
  const active = recordingSession;
  recordingSession = null;
  setRecordingBackgroundPriority(false);
  if (!active) return;
  try {
    fs.closeSync(active.fd);
  } catch {}
  if (!keepPartial) {
    try {
      fs.rmSync(active.partialPath, { force: true });
    } catch {}
  }
  if (tray && !tray.isDestroyed()) tray.setToolTip('Genre Police Visualizer');
  rebuildTrayMenu();
}

function sendRecordingCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showMainWindow();
  mainWindow.webContents.send('recording-command', command);
}

function sanitizeRecordingControlsState(payload) {
  const rect = payload?.rect || {};
  const transportRect = payload?.transportRect || {};
  const appearance = payload?.appearance || {};
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safeRect = (value, fallback) => ({
    x: Math.max(0, finite(value.x, fallback.x)),
    y: Math.max(0, finite(value.y, fallback.y)),
    width: Math.max(24, Math.min(320, finite(value.width, fallback.width))),
    height: Math.max(24, Math.min(100, finite(value.height, fallback.height)))
  });
  return {
    active: payload?.active === true,
    visible: payload?.visible === true,
    showTransport: payload?.showTransport !== false,
    state: ['preparing', 'recording', 'stopping'].includes(payload?.state) ? payload.state : 'preparing',
    rect: safeRect(rect, { x: 0, y: 0, width: 30, height: 30 }),
    transportRect: safeRect(transportRect, { x: 0, y: 0, width: 102, height: 36 }),
    appearance: {
      accent: /^#[0-9a-f]{6}$/i.test(appearance.accent) ? appearance.accent : '#67f7ff',
      scale: Math.max(UI_SCALES[0], Math.min(UI_SCALES[UI_SCALES.length - 1], finite(appearance.scale, 1))),
      buttonSize: Math.max(20, Math.min(40, finite(appearance.buttonSize, 30))),
      iconSize: Math.max(10, Math.min(24, finite(appearance.iconSize, 16))),
      gap: Math.max(0, Math.min(16, finite(appearance.gap, 6))),
      transportButtonSize: Math.max(20, Math.min(40, finite(appearance.transportButtonSize, 30))),
      transportIconSize: Math.max(10, Math.min(24, finite(appearance.transportIconSize, 16))),
      transportGap: Math.max(0, Math.min(16, finite(appearance.transportGap, 6))),
      edgePadding: Math.max(8, Math.min(48, finite(appearance.edgePadding, 18)))
    },
    playing: payload?.playing === true,
    labels: Object.fromEntries(Object.entries(payload?.labels || {}).map(([key, value]) => [key, String(value).slice(0, 80)]))
  };
}

function positionRecordingControlsWindow() {
  if (!recordingControlsState || !mainWindow || mainWindow.isDestroyed()) return;
  const mainBounds = mainWindow.getBounds();
  const position = (overlay, rect) => {
    if (!overlay || overlay.isDestroyed()) return;
    const edgePadding = Math.ceil(recordingControlsState.appearance.edgePadding);
    overlay.setBounds({
      x: mainBounds.x + Math.round(rect.x) - edgePadding,
      y: mainBounds.y + Math.round(rect.y) - edgePadding,
      width: Math.max(1, Math.ceil(rect.width) + edgePadding * 2),
      height: Math.max(1, Math.ceil(rect.height) + edgePadding * 2)
    });
  };
  position(recordingControlsWindow, recordingControlsState.rect);
  position(recordingTransportWindow, recordingControlsState.transportRect);
}

function sendRecordingControlsState() {
  for (const overlay of [recordingControlsWindow, recordingTransportWindow]) {
    if (!overlay || overlay.isDestroyed() || overlay.webContents.isLoading()) continue;
    overlay.webContents.send('recording-controls:state', recordingControlsState);
  }
}

function ensureRecordingControlsWindow() {
  if (recordingControlsWindow && !recordingControlsWindow.isDestroyed()) return recordingControlsWindow;
  recordingControlsWindow = new BrowserWindow({
    width: 66,
    height: 66,
    parent: mainWindow || undefined,
    transparent: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'none',
    frame: false,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'recording-controls-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });
  recordingControlsWindow.setAlwaysOnTop(true, 'floating');
  recordingControlsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  recordingControlsWindow.webContents.on('did-finish-load', () => {
    positionRecordingControlsWindow();
    sendRecordingControlsState();
    if (recordingControlsState?.visible) {
      recordingControlsWindow.showInactive();
      recordingControlsWindow.moveTop();
    }
  });
  recordingControlsWindow.on('closed', () => {
    recordingControlsWindow = null;
  });
  void recordingControlsWindow.loadFile(path.join(__dirname, 'renderer', 'recording-controls.html'));
  return recordingControlsWindow;
}

function ensureRecordingTransportWindow() {
  if (recordingTransportWindow && !recordingTransportWindow.isDestroyed()) return recordingTransportWindow;
  recordingTransportWindow = new BrowserWindow({
    width: 102,
    height: 36,
    parent: mainWindow || undefined,
    transparent: true,
    backgroundColor: '#00000000',
    backgroundMaterial: 'none',
    frame: false,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'recording-controls-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });
  recordingTransportWindow.setAlwaysOnTop(true, 'floating');
  recordingTransportWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  recordingTransportWindow.webContents.on('did-finish-load', () => {
    positionRecordingControlsWindow();
    sendRecordingControlsState();
    if (recordingControlsState?.visible) {
      recordingTransportWindow.showInactive();
      recordingTransportWindow.moveTop();
    }
  });
  recordingTransportWindow.on('closed', () => {
    recordingTransportWindow = null;
  });
  void recordingTransportWindow.loadFile(path.join(__dirname, 'renderer', 'recording-transport.html'));
  return recordingTransportWindow;
}

function updateRecordingControls(payload) {
  recordingControlsState = sanitizeRecordingControlsState(payload);
  if (!recordingControlsState.active) {
    if (recordingControlsWindow && !recordingControlsWindow.isDestroyed()) recordingControlsWindow.hide();
    if (recordingTransportWindow && !recordingTransportWindow.isDestroyed()) recordingTransportWindow.hide();
    return;
  }
  const overlays = [ensureRecordingControlsWindow()];
  if (recordingControlsState.showTransport) {
    overlays.push(ensureRecordingTransportWindow());
  } else if (recordingTransportWindow && !recordingTransportWindow.isDestroyed()) {
    recordingTransportWindow.hide();
  }
  positionRecordingControlsWindow();
  sendRecordingControlsState();
  for (const overlay of overlays) {
    if (!overlay.webContents.isLoading()) {
      overlay.setIgnoreMouseEvents(
        !recordingControlsState.visible,
        { forward: true }
      );
      overlay.showInactive();
      overlay.moveTop();
    }
  }
}

function hideRecordingControlsWindows() {
  for (const overlay of [recordingControlsWindow, recordingTransportWindow]) {
    if (overlay && !overlay.isDestroyed()) overlay.hide();
  }
}

function requestAppQuit() {
  if (!recordingSession) {
    app.quit();
    return;
  }
  quitAfterRecording = true;
  sendRecordingCommand('stop');
}

async function sampleArtwork(url) {
  const source = String(url || '');
  if (!source || source.length > 12_000_000) return null;
  if (artworkSampleCache.has(source)) return artworkSampleCache.get(source);
  let image = null;
  if (source.startsWith('data:image/')) {
    image = nativeImage.createFromDataURL(source);
  } else if (/^https?:\/\//i.test(source)) {
    const response = await net.fetch(source, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) return null;
    const declaredSize = Number(response.headers.get('content-length')) || 0;
    if (declaredSize > 8_000_000) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) return null;
    image = nativeImage.createFromBuffer(bytes);
  } else {
    const localPath = source.startsWith('file:') ? decodeURIComponent(new URL(source).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')) : source;
    image = nativeImage.createFromPath(localPath);
  }
  if (!image || image.isEmpty()) return null;
  const resized = image.resize({ width: 32, height: 32, quality: 'good' });
  const size = resized.getSize();
  const sample = analyzeArtworkBitmap(resized.toBitmap(), size.width, size.height);
  if (sample) {
    artworkSampleCache.set(source, sample);
    if (artworkSampleCache.size > 40) artworkSampleCache.delete(artworkSampleCache.keys().next().value);
  }
  return sample;
}

function normalizeLyricDelayMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LYRIC_DELAY_MS;
  return Math.max(LYRIC_DELAY_MIN_MS, Math.min(LYRIC_DELAY_MAX_MS, Math.round(numeric / 50) * 50));
}

async function detectNetworkCountry() {
  if (networkCountryTask) return networkCountryTask;
  networkCountryTask = (async () => {
    try {
      // Cloudflare's trace endpoint returns the connection country without
      // receiving track metadata. The short, cached probe only selects catalog
      // order; failure keeps the normal international strategy.
      const response = await net.fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        signal: AbortSignal.timeout(NETWORK_REGION_TIMEOUT_MS)
      });
      if (!response.ok) return '';
      const match = (await response.text()).match(/^loc=([A-Z]{2})$/m);
      return match?.[1] || '';
    } catch {
      return '';
    }
  })();
  return networkCountryTask;
}

function refreshNetworkCountry() {
  if (config.onlineGenreLookupEnabled === false) return;
  detectNetworkCountry().then((country) => {
    if (config.onlineGenreLookupEnabled === false || !country || country === networkCountry) return;
    networkCountry = country;
    resolver.clear();
    if (lastRawMetadata) {
      lastTrackKey = '';
      lastLyricsKey = '';
      handleMetadata(lastRawMetadata);
    }
  });
}

function launchAtLoginSupported() {
  return process.platform === 'win32' && app.isPackaged;
}

function launchAtLoginPath() {
  // electron-builder's portable launcher exposes its stable outer executable;
  // process.execPath points at a temporary extraction directory in that mode.
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

function applyLaunchAtLogin(enabled) {
  if (!launchAtLoginSupported()) return false;
  try {
    const target = launchAtLoginPath();
    app.setLoginItemSettings({ openAtLogin: enabled === true, path: target, args: [] });
    return app.getLoginItemSettings({ path: target, args: [] }).openAtLogin;
  } catch (error) {
    console.warn('Could not update launch-at-login:', error.message);
    return false;
  }
}

function configPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function genreCorrectionsPath() {
  return path.join(app.getPath('userData'), 'genre-corrections.json');
}

function audioGenreMemoriesPath() {
  return path.join(app.getPath('userData'), 'audio-genre-memory.json');
}

function removeLegacyUnmappedArtistLog() {
  const legacyPath = path.join(app.getPath('userData'), 'unmapped-artists.json');
  try {
    if (fs.existsSync(legacyPath)) fs.rmSync(legacyPath);
  } catch (error) {
    console.warn('Could not remove the retired unmapped artist log:', error.message);
  }
}

function saveGenreCorrections() {
  const correctionsPath = genreCorrectionsPath();
  fs.mkdirSync(path.dirname(correctionsPath), { recursive: true });
  fs.writeFileSync(correctionsPath, `${JSON.stringify(genreCorrections, null, 2)}\n`, 'utf8');
}

function loadGenreCorrections() {
  try {
    genreCorrections = createGenreCorrections(
      JSON.parse(fs.readFileSync(genreCorrectionsPath(), 'utf8'))
    );
  } catch {
    genreCorrections = createGenreCorrections();
  }
}

function saveAudioGenreMemories() {
  const memoriesPath = audioGenreMemoriesPath();
  fs.mkdirSync(path.dirname(memoriesPath), { recursive: true });
  fs.writeFileSync(memoriesPath, `${JSON.stringify(audioGenreMemories, null, 2)}\n`, 'utf8');
}

function loadAudioGenreMemories() {
  try {
    audioGenreMemories = createAudioGenreMemories(
      JSON.parse(fs.readFileSync(audioGenreMemoriesPath(), 'utf8'))
    );
  } catch {
    audioGenreMemories = createAudioGenreMemories();
  }
}

function clearAudioGenreMemories() {
  const previous = audioGenreMemories;
  const cleared = Object.keys(previous.entries || {}).length;
  audioGenreMemories = createAudioGenreMemories();
  try {
    saveAudioGenreMemories();
  } catch (error) {
    audioGenreMemories = previous;
    console.warn('Could not clear local AI genre memory:', error.message);
    return { ok: false, cleared: 0 };
  }
  resetAudioGenreForCurrentTrack();
  publishCurrentGenre({ force: true });
  return { ok: true, cleared };
}

function loadConfig() {
  try {
    config = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    config = {};
  }
  const sanitized = sanitizeStoredConfig(config);
  config = sanitized.config;
  const storedLayoutMode = config.layoutMode;
  const storedUiScale = config.uiScale;
  const storedLanguage = config.language;
  const storedLocalGenreModelEnabled = config.localGenreModelEnabled;
  const storedDynamicGenreDetectionEnabled = config.dynamicGenreDetectionEnabled;
  clickThrough = normalizeClickThrough(config.clickThrough);
  alwaysOnTop = normalizeAlwaysOnTop(config.alwaysOnTop);
  desktopLayerEnabled = process.platform === 'win32' && normalizeDesktopLayer(config.desktopLayer);
  if (desktopLayerEnabled) alwaysOnTop = false;
  config.alwaysOnTop = alwaysOnTop;
  config.desktopLayer = desktopLayerEnabled;
  config.uiScale = normalizeUiScale(process.env.GP_UI_SCALE || config.uiScale);
  config.layoutMode = normalizeLayoutMode(process.env.GP_LAYOUT_MODE || config.layoutMode);
  config.language = process.env.GP_CAPTURE_LANGUAGE
    ? normalizeLocale(process.env.GP_CAPTURE_LANGUAGE, 'en')
    : resolveInitialLocale(storedLanguage, app.getLocale());
  config.lyricDelayMs = normalizeLyricDelayMs(config.lyricDelayMs);
  config.lyricsEnabled = config.lyricsEnabled !== false;
  config.lyricTranslationEnabled = config.lyricTranslationEnabled !== false;
  config.capsuleCondensedEnglish = config.capsuleCondensedEnglish === true;
  config.posterCondensedEnglish = config.posterCondensedEnglish !== false;
  config.fullscreenCondensedEnglish = config.fullscreenCondensedEnglish === true;
  config.posterThemedBackground = config.posterThemedBackground !== false;
  config.capsuleThemedBackground = config.capsuleThemedBackground !== false;
  config.onlineGenreLookupEnabled = config.onlineGenreLookupEnabled !== false;
  config.artistGenreReferenceEnabled = config.artistGenreReferenceEnabled !== false;
  config.launchAtLogin = config.launchAtLogin === true;
  config.motionMode = normalizeMotionMode(config.motionMode);
  config.visualResponseMode = normalizeVisualResponseMode(config.visualResponseMode);
  config.audioSourceId = normalizeAudioSourceId(config.audioSourceId);
  config.idleBehavior = normalizeIdleBehavior(config.idleBehavior);
  config.frameRateLimit = normalizeFrameRateLimit(config.frameRateLimit);
  config.idleFrameLimitEnabled = config.idleFrameLimitEnabled !== false;
  config.showFps = config.showFps === true;
  config.rhythmModelEnabled = config.rhythmModelEnabled !== false;
  config.localGenreModelEnabled = config.localGenreModelEnabled !== false;
  config.audioGenreMemoryEnabled = config.audioGenreMemoryEnabled !== false;
  config.dynamicGenreDetectionEnabled = config.localGenreModelEnabled
    && config.dynamicGenreDetectionEnabled === true;
  config.recordingQuickButtonVisible = config.recordingQuickButtonVisible !== false;
  config.snapshotQuickButtonVisible = config.snapshotQuickButtonVisible !== false;
  config.stageOutputTextVisible = config.stageOutputTextVisible !== false;
  config.fullscreenLayoutMode = (process.env.GP_CAPTURE_FULLSCREEN_LAYOUT || config.fullscreenLayoutMode) === 'stacked'
    ? 'stacked'
    : 'split';
  config.preferredMediaSource = normalizeMediaSource(config.preferredMediaSource);
  config.ignoredMediaSources = normalizeIgnoredMediaSources(config.ignoredMediaSources);
  const storedCustomGenres = JSON.stringify(config.customGenres || []);
  config.customGenres = normalizeCustomGenreRules(config.customGenres, Object.keys(THEMES));
  const customGenresSanitized = storedCustomGenres !== JSON.stringify(config.customGenres);
  const storedGenreArtistRules = JSON.stringify(config.genreArtistRules || []);
  config.genreArtistRules = normalizeGenreArtistRules(config.genreArtistRules, Object.keys(THEMES));
  const genreArtistRulesSanitized = storedGenreArtistRules !== JSON.stringify(config.genreArtistRules);
  const uiScaleMigrated = process.env.GP_UI_SCALE === undefined
    && Number.isFinite(Number(storedUiScale))
    && Math.abs(Number(storedUiScale) - config.uiScale) > 0.000001;
  const languageInitialized = process.env.GP_CAPTURE_LANGUAGE === undefined
    && String(storedLanguage || '').trim() !== config.language;
  const dependentGenreSettingSanitized = storedLocalGenreModelEnabled === false
    && storedDynamicGenreDetectionEnabled === true;
  if (sanitized.changed || customGenresSanitized || genreArtistRulesSanitized || uiScaleMigrated
    || languageInitialized || dependentGenreSettingSanitized
    || (storedLayoutMode && storedLayoutMode !== config.layoutMode)) saveConfig();
}

function saveConfig(patch = {}) {
  config = { ...config, ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function updateStatus(status, release = null) {
  return {
    status,
    currentVersion: canonicalVersion(app.getVersion()) || `v${app.getVersion()}`,
    latestVersion: release?.version || '',
    releaseName: release?.name || '',
    releaseUrl: release?.url || ''
  };
}

async function requestLatestUpdate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await net.fetch(
      'https://api.github.com/repos/lbnandy/genre-police-visualizer/releases?per_page=10',
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Genre-Police-Visualizer/${app.getVersion()}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: controller.signal
      }
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('GitHub returned an invalid release list');
    const release = selectLatestUpdate(releases, app.getVersion());
    latestUpdate = release;
    return updateStatus(release ? 'available' : 'current', release);
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdates({ manual = false, notify = false } = {}) {
  if (!manual && !isUpdateCheckDue(config.lastUpdateCheckAt)) {
    return updateStatus('skipped', latestUpdate);
  }
  if (updateCheckTask) return updateCheckTask;
  saveConfig({ lastUpdateCheckAt: Date.now() });
  updateCheckTask = requestLatestUpdate()
    .catch(() => updateStatus('error'))
    .finally(() => {
      updateCheckTask = null;
    });
  const result = await updateCheckTask;
  const dismissed = sameVersion(config.dismissedUpdateVersion, result.latestVersion);
  if (notify && result.status === 'available' && !dismissed
      && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', result);
  }
  return result;
}

function scheduleAutomaticUpdateCheck() {
  if (process.env.GP_CAPTURE_PATH || updateCheckTimer) return;
  updateCheckTimer = setTimeout(() => {
    updateCheckTimer = null;
    void checkForUpdates({ notify: true });
  }, 10_000);
}

function dismissUpdate(version) {
  const normalized = canonicalVersion(version);
  if (!normalized || !latestUpdate || !sameVersion(normalized, latestUpdate.version)) {
    return { ok: false };
  }
  saveConfig({ dismissedUpdateVersion: normalized });
  return { ok: true, version: normalized };
}

async function openUpdatePage(value) {
  const url = isAllowedReleaseUrl(value)
    ? String(value)
    : latestUpdate?.url || UPDATE_RELEASES_URL;
  if (!isAllowedReleaseUrl(url)) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
}

const resolver = new GenreResolver({
  getConfig: () => config,
  getCorrection: (metadata) => getGenreCorrection(genreCorrections, metadata),
  getNetworkCountry: () => networkCountry
});
const lyricsResolver = new LyricsResolver();

function assetPath(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', name)
    : path.join(__dirname, 'assets', name);
}

function sendRhythmModel(payload) {
  rhythmModelState = payload;
  if (process.env.GP_DEBUG_RHYTHM && (payload.type !== 'rhythm' || payload.peak)) {
    console.info('Local rhythm model:', payload);
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('rhythm-model', payload);
}

function startRhythmModel() {
  if (config.rhythmModelEnabled === false) {
    sendRhythmModel({ type: 'disabled', reason: 'disabled in settings' });
    return null;
  }
  if (rhythmModel || rhythmModelStartTask || app.isQuitting) return rhythmModelStartTask;
  const modelPath = assetPath(path.join('models', 'beatnet-model-1.onnx'));
  if (!fs.existsSync(modelPath)) {
    sendRhythmModel({ type: 'unavailable', reason: 'bundled ONNX rhythm model is missing' });
    return null;
  }
  const model = new LocalRhythmModel({ modelPath, onEvent: sendRhythmModel });
  rhythmModel = model;
  rhythmModelStartTask = model.initialize().finally(() => {
    if (rhythmModel === model) rhythmModelStartTask = null;
  });
  return rhythmModelStartTask;
}

async function setRhythmModelEnabled(enabled) {
  if (enabled !== false) {
    startRhythmModel();
    return;
  }
  const model = rhythmModel;
  rhythmModel = null;
  rhythmModelStartTask = null;
  if (model) await model.close();
  sendRhythmModel({ type: 'disabled', reason: 'disabled in settings' });
}

function restartRhythmModelForOutputDevice() {
  rhythmModel?.reset();
}

const AUDIO_MODEL_FAMILIES = new Set([
  'hardcore', 'hardstyle', 'dubstep', 'future-bass', 'drum-bass', 'house', 'trance',
  'techno', 'uk-garage', 'breakbeat', 'synthwave', 'phonk', 'metal', 'rock', 'pop',
  'j-pop', 'k-pop', 'hip-hop', 'rnb', 'country', 'folk', 'jazz', 'classical',
  'soundtrack', 'latin', 'reggae', 'punk', 'ambient', 'downtempo', 'idm', 'glitch',
  'instrumental-hip-hop', 'blues', 'electronic'
]);

function audioGenreModelPaths() {
  return {
    modelPath: assetPath(path.join('models', 'discogs-effnet-bsdynamic-1.onnx')),
    metadataPath: assetPath(path.join('models', 'discogs-effnet-bsdynamic-1.json'))
  };
}

function localGenreModelFilesAvailable() {
  const paths = audioGenreModelPaths();
  return fs.existsSync(paths.modelPath) && fs.existsSync(paths.metadataPath);
}

function localGenreModelAvailable() {
  return localGenreModelFilesAvailable()
    && !ONNX_RUNTIME_LOAD_FAILURE_CODES.includes(audioGenreModelState?.code);
}

function audioGenreModelStatus() {
  return {
    enabled: config.localGenreModelEnabled !== false,
    available: localGenreModelAvailable(),
    state: audioGenreModelState
  };
}

function publishAudioGenreModelStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('local-genre-model-status', audioGenreModelStatus());
}

function audioFamilyForGenreId(value) {
  const id = String(value || 'unknown');
  if (AUDIO_MODEL_FAMILIES.has(id)) return id;
  const family = themeFor(id).family;
  return AUDIO_MODEL_FAMILIES.has(family) ? family : id;
}

function metadataGenreKind(metadata) {
  const genre = metadata?.genre || themeFor('unknown');
  const evidence = metadata?.genreEvidence || {};
  const matched = String(genre.matched || '');
  const sources = metadata?.genreSources || [];
  if (metadata?.userGenreCorrection
    || metadata?.customGenreRule
    || evidence.type === 'user-correction'
    || evidence.type === 'custom-genre'
    || ['asmr', 'bilibili'].includes(genre.id)) return 'authoritative';
  if (evidence.type === 'user-artist'
    || matched.startsWith('artist:')
    || sources.some((source) => /artist map|artist supplement/i.test(source))) return 'artist';
  if (!genre.id || ['unknown', 'electronic'].includes(genre.id)) return 'broad';
  return 'specific';
}

function rememberedAudioGenreDecision(memory = currentAudioGenreMemory) {
  if (memory?.fullPlaybackEvidence !== true || !memory?.genreId || !THEMES[memory.genreId]) return null;
  return {
    stage: 'memory',
    genreId: memory.genreId,
    confidence: memory.confidence,
    margin: memory.margin,
    acceptedWindows: memory.acceptedWindows,
    remembered: true
  };
}

function loadCurrentAudioGenreMemory(metadata = lastRawMetadata) {
  if (config.localGenreModelEnabled === false
    || config.audioGenreMemoryEnabled === false
    || !metadata?.title) return null;
  const memory = getAudioGenreMemory(audioGenreMemories, metadata);
  return memory?.genreId && THEMES[memory.genreId] ? memory : null;
}

function resetCurrentAudioGenreEvidence({ reloadMemory = true } = {}) {
  currentAudioGenreSnapshot = null;
  currentAudioGenreStartedNearBeginning = Boolean(
    lastRawMetadata?.title && isNearTrackBeginning(lastRawMetadata)
  );
  audioGenreMemoryVerificationLimit = 0;
  lastPersistedAudioGenreWindows = 0;
  currentAudioGenreMemory = reloadMemory ? loadCurrentAudioGenreMemory() : null;
  const hasFullPlaybackMemory = currentAudioGenreMemory?.fullPlaybackEvidence === true;
  currentAudioGenreMemoryCollectionRequired = config.audioGenreMemoryEnabled !== false
    && (!hasFullPlaybackMemory || currentAudioGenreStartedNearBeginning);
  currentAudioGenreDecision = rememberedAudioGenreDecision();
}

function persistCurrentAudioGenreMemory({ force = false } = {}) {
  if (config.localGenreModelEnabled === false
    || config.audioGenreMemoryEnabled === false
    || !lastRawMetadata?.title
    || !currentAudioGenreSnapshot?.track
    || currentAudioGenreSnapshot.trackKey !== lastTrackKey) return false;
  const acceptedWindows = Number(currentAudioGenreSnapshot.acceptedWindows) || 0;
  if (acceptedWindows <= lastPersistedAudioGenreWindows) return false;
  if (!force
    && lastPersistedAudioGenreWindows
    && acceptedWindows - lastPersistedAudioGenreWindows < AUDIO_GENRE_MEMORY_WRITE_INTERVAL_WINDOWS) return false;
  const candidate = createAudioGenreMemoryCandidate({
    metadata: lastRawMetadata,
    metadataKind: metadataGenreKind(lastBaseResolvedMetadata),
    trackResult: currentAudioGenreSnapshot.track,
    startedNearBeginning: currentAudioGenreStartedNearBeginning,
    acceptedWindows,
    winnerHistory: currentAudioGenreSnapshot.winnerHistory,
    nearComplete: isNearTrackEnd(lastRawMetadata) || hasFullTrackAnalysisCoverage({
      acceptedWindows,
      durationMs: lastRawMetadata.durationMs,
      startedNearBeginning: currentAudioGenreStartedNearBeginning
    }),
    validGenreIds: new Set(Object.keys(THEMES))
  });
  if (!candidate) return false;
  const updated = setAudioGenreMemory(audioGenreMemories, lastRawMetadata, candidate);
  lastPersistedAudioGenreWindows = acceptedWindows;
  if (!updated.changed) return false;
  audioGenreMemories = updated.state;
  currentAudioGenreMemory = updated.memory;
  try {
    saveAudioGenreMemories();
  } catch (error) {
    console.warn('Could not save local AI genre memory:', error.message);
    return false;
  }
  return true;
}

function audioGenreContext(metadata = lastBaseResolvedMetadata) {
  const kind = metadataGenreKind(metadata);
  const dynamicEnabled = config.localGenreModelEnabled !== false
    && config.dynamicGenreDetectionEnabled === true;
  const priorGenreIds = [];
  const guardGenreIds = [];
  if (kind === 'artist') {
    const artistGenreId = audioFamilyForGenreId(metadata?.genre?.id);
    priorGenreIds.push(artistGenreId);
    guardGenreIds.push(artistGenreId);
  }
  const memoryPrior = currentAudioGenreMemory?.fullPlaybackEvidence === true
    ? {
        genreId: currentAudioGenreMemory.genreId,
        confidence: currentAudioGenreMemory.confidence,
        margin: currentAudioGenreMemory.margin,
        scores: currentAudioGenreMemory.scores,
        coverageRatio: currentAudioGenreMemory.coverageRatio,
        fullPlaybackEvidence: true
      }
    : null;
  if (memoryPrior?.genreId) priorGenreIds.push(memoryPrior.genreId);
  const metadataAudioFamily = audioFamilyForGenreId(metadata?.genre?.id);
  const metadataBaseline = (dynamicEnabled && kind === 'specific')
    || (kind === 'artist' && hasAudioGenreCompatibilityProfile(metadataAudioFamily))
    ? metadataAudioFamily
    : '';
  return {
    dynamicEnabled,
    fullTrackLearning: isCurrentAudioGenreFullTrackLearning(),
    priorGenreIds: [...new Set(priorGenreIds.filter(Boolean))],
    guardGenreIds: [...new Set(guardGenreIds.filter(Boolean))],
    memoryPrior,
    baselineGenreId: metadataBaseline
  };
}

function shouldAnalyzeCurrentGenreAudio() {
  const staticMemoryWithoutFullReplay = config.dynamicGenreDetectionEnabled !== true
    && currentAudioGenreDecision?.stage === 'memory'
    && !isCurrentAudioGenreFullTrackLearning();
  if (staticMemoryWithoutFullReplay) return false;
  return shouldAnalyzeAudioGenre({
    enabled: config.localGenreModelEnabled !== false,
    playing: Boolean(lastRawMetadata?.playing),
    hasTrack: Boolean(lastRawMetadata?.title),
    dynamicEnabled: config.dynamicGenreDetectionEnabled === true,
    fullTrackLearning: isCurrentAudioGenreFullTrackLearning(),
    metadataKind: metadataGenreKind(lastBaseResolvedMetadata),
    decisionGenreId: currentAudioGenreDecision?.genreId || audioGenreModelState?.currentGenreId,
    acceptedWindows: audioGenreModelState?.acceptedWindows,
    correctionCount: audioGenreModelState?.correctionCount,
    finalCorrectionCount: audioGenreModelState?.finalCorrectionCount,
    settleWindowLimit: audioGenreMemoryVerificationLimit
      || audioGenreModelState?.analysisWindowLimit
  });
}

function shouldCollectCurrentAudioGenreMemory() {
  return shouldCollectAudioGenreMemory({
    enabled: config.localGenreModelEnabled !== false
      && config.audioGenreMemoryEnabled !== false,
    playing: Boolean(lastRawMetadata?.playing),
    hasTrack: Boolean(lastRawMetadata?.title),
    metadataKind: metadataGenreKind(lastBaseResolvedMetadata),
    startedNearBeginning: currentAudioGenreStartedNearBeginning,
    memorySatisfied: !currentAudioGenreMemoryCollectionRequired
  });
}

function isCurrentAudioGenreFullTrackLearning() {
  return currentAudioGenreMemoryCollectionRequired
    && currentAudioGenreStartedNearBeginning;
}

function fuseAudioGenreDecision(baseMetadata, decision) {
  if (!decision?.genreId || !THEMES[decision.genreId]) return baseMetadata;
  const base = baseMetadata || {};
  const baseGenre = base.genre || themeFor('unknown');
  const kind = metadataGenreKind({ ...base, genre: baseGenre });
  const sameFamily = audioFamilyForGenreId(baseGenre.id) === decision.genreId;
  const dynamicChange = decision.stage === 'dynamic';
  const mayReplace = shouldReplaceMetadataWithAudioGenre({
    metadataKind: kind,
    baseGenreId: baseGenre.id,
    decisionGenreId: decision.genreId,
    decisionStage: decision.stage,
    dynamicEnabled: config.dynamicGenreDetectionEnabled === true
  });
  const rememberedResult = decision.stage === 'memory';
  const audioEvidence = {
    type: rememberedResult ? 'audio-memory' : 'audio-model',
    stage: decision.stage,
    genreId: decision.genreId,
    currentGenreId: decision.currentGenreId,
    confidence: decision.confidence,
    margin: decision.margin,
    acceptedWindows: decision.acceptedWindows,
    confirmed: decision.confirmed === true,
    supportedByRelativeLead: decision.supportedByRelativeLead === true
  };

  if (sameFamily || !mayReplace) {
    return {
      ...base,
      resolving: false,
      audioGenreEvidence: audioEvidence,
      audioGenreAlternative: mayReplace ? null : decision.genreId
    };
  }

  const source = rememberedResult
    ? 'Remembered local AI'
    : dynamicChange ? 'Local AI genre change' : 'Local AI model';
  return {
    ...base,
    resolving: false,
    genre: themeWithId(decision.genreId),
    genreSource: source,
    genreSources: [...new Set([source, ...(base.genreSources || [])])],
    genreEvidence: audioEvidence,
    audioGenreEvidence: audioEvidence,
    metadataGenre: baseGenre
  };
}

function publishCurrentGenre({ force = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !lastRawMetadata?.title) return;
  const base = lastBaseResolvedMetadata || {
    ...lastRawMetadata,
    displayArtist: displayArtistName(lastRawMetadata.artist || lastRawMetadata.albumArtist),
    hardcoreTanoc: isHardcoreTanocArtist(lastRawMetadata.artist || lastRawMetadata.albumArtist),
    genre: themeWithId('unknown'),
    genreSource: '',
    genreSources: [],
    genreEvidence: { type: 'unknown' }
  };
  let next = currentAudioGenreDecision
    ? fuseAudioGenreDecision(base, currentAudioGenreDecision)
    : base;
  const staticMemoryRecheck = config.dynamicGenreDetectionEnabled !== true
    && currentAudioGenreDecision?.stage === 'memory';
  let genreAnalysisPending = localGenreModelAvailable()
    && shouldAnalyzeCurrentGenreAudio()
    && !staticMemoryRecheck;
  if (shouldKeepGenreIdentifying({
    enabled: config.localGenreModelEnabled !== false,
    available: localGenreModelAvailable(),
    playing: Boolean(lastRawMetadata?.playing),
    hasTrack: Boolean(lastRawMetadata?.title),
    displayedGenreId: next.genre?.id,
    decisionGenreId: currentAudioGenreDecision?.genreId,
    modelState: audioGenreModelState?.type
  })) {
    next = { ...next, resolving: true };
  }
  if (temporaryGenreOverride?.trackKey === lastTrackKey) {
    genreAnalysisPending = false;
    next = {
      ...next,
      resolving: false,
      genre: temporaryGenreOverride.genre,
      genreSource: 'Temporary visual lock',
      genreSources: [...new Set(['Temporary visual lock', ...(next.genreSources || [])])],
      genreEvidence: {
        type: 'temporary-genre',
        genreId: temporaryGenreOverride.genreId
      },
      temporaryGenreOverride: {
        genreId: temporaryGenreOverride.genreId,
        label: temporaryGenreOverride.label
      }
    };
  }
  next = { ...next, genreAnalysisPending };
  next = withGenreReliability(next);
  const previousGenreId = lastResolvedMetadata?.genre?.id;
  const previousGenreUncertain = Boolean(lastResolvedMetadata?.genreUncertain);
  const previousGenreAnalysisPending = Boolean(lastResolvedMetadata?.genreAnalysisPending);
  lastResolvedMetadata = next;
  if (process.env.GP_DEBUG_AUDIO_GENRE && currentAudioGenreDecision) {
    console.info('Local audio genre publish:', {
      stage: currentAudioGenreDecision.stage,
      baseGenreId: base.genre?.id,
      baseKind: metadataGenreKind(base),
      decisionGenreId: currentAudioGenreDecision.genreId,
      previousGenreId,
      nextGenreId: next.genre?.id,
      genreUncertain: next.genreUncertain,
      genreUncertainReason: next.genreUncertainReason,
      sent: Boolean(force
        || previousGenreId !== next.genre?.id
        || previousGenreUncertain !== next.genreUncertain
        || previousGenreAnalysisPending !== next.genreAnalysisPending)
    });
  }
  if (force
    || previousGenreId !== next.genre?.id
    || previousGenreUncertain !== next.genreUncertain
    || previousGenreAnalysisPending !== next.genreAnalysisPending) {
    mainWindow.webContents.send('now-playing', {
      ...next,
      displayArtist: displayArtistName(next.artist || next.albumArtist || lastRawMetadata.artist || lastRawMetadata.albumArtist),
      hardcoreTanoc: isHardcoreTanocArtist(next.artist || next.albumArtist || lastRawMetadata.artist || lastRawMetadata.albumArtist),
      audioGenreUpdate: !force
    });
  }
}

function handleAudioGenreModelEvent(payload) {
  if (payload?.type !== 'prediction') {
    audioGenreModelState = payload || audioGenreModelState;
    publishAudioGenreModelStatus();
    if (process.env.GP_DEBUG_AUDIO_GENRE && payload?.type !== 'reset') {
      console.info('Local audio genre model:', payload);
    }
    publishCurrentGenre();
    return;
  }
  if (payload.trackKey !== lastTrackKey) return;
  const decision = payload.decision || {};
  const previousWinnerHistory = currentAudioGenreSnapshot?.trackKey === payload.trackKey
    ? currentAudioGenreSnapshot.winnerHistory || []
    : [];
  currentAudioGenreSnapshot = {
    trackKey: payload.trackKey,
    acceptedWindows: decision.acceptedWindows,
    short: payload.short,
    track: payload.track,
    segment: payload.segment,
    winnerHistory: [...previousWinnerHistory, payload.track?.id]
      .filter(Boolean)
      .slice(-12)
  };
  if (process.env.GP_DEBUG_AUDIO_GENRE) {
    const summarize = (result = {}) => ({
      id: result.id,
      confidence: Number(result.confidence || 0).toFixed(3),
      margin: Number(result.margin || 0).toFixed(3)
    });
    console.info('Local audio genre prediction:', {
      stage: decision.stage,
      windows: decision.acceptedWindows,
      short: summarize(payload.short),
      track: summarize(payload.track),
      segment: summarize(payload.segment)
    });
  }
  audioGenreModelState = {
    type: 'prediction',
    genreId: decision.genreId,
    currentGenreId: decision.currentGenreId,
    stage: decision.stage,
    confidence: decision.confidence,
    margin: decision.margin,
    acceptedWindows: decision.acceptedWindows,
    analysisWindowLimit: decision.analysisWindowLimit,
    correctionCount: decision.correctionCount,
    finalCorrectionCount: decision.finalCorrectionCount,
    memoryPriorGenreId: decision.memoryPriorGenreId,
    memoryPriorWeight: decision.memoryPriorWeight,
    inferenceMs: payload.inferenceMs
  };
  const rememberedGenreId = currentAudioGenreMemory?.genreId;
  if (rememberedGenreId && decision.genreId && decision.genreId !== rememberedGenreId
    && ['first', 'refinement', 'correction', 'dynamic'].includes(decision.stage)) {
    currentAudioGenreMemoryCollectionRequired = true;
    audioGenreMemoryVerificationLimit = 0;
    audioGenreModel?.setContext(audioGenreContext());
  } else if (rememberedGenreId
    && decision.genreId === rememberedGenreId
    && decision.stage === 'confirmed'
    && config.dynamicGenreDetectionEnabled !== true) {
    audioGenreMemoryVerificationLimit = Math.max(
      AUDIO_GENRE_MEMORY_CONFIRMATION_WINDOWS,
      Number(decision.acceptedWindows || 0) + 6
    );
  }
  const keepStaticMemoryDecision = config.dynamicGenreDetectionEnabled !== true
    && currentAudioGenreDecision?.stage === 'memory';
  if (!keepStaticMemoryDecision
    && ['provisional', 'first', 'refinement', 'correction', 'dynamic'].includes(decision.stage)) {
    currentAudioGenreDecision = { ...decision };
  } else if (decision.stage === 'confirmed' && currentAudioGenreDecision?.genreId === decision.genreId) {
    currentAudioGenreDecision = { ...currentAudioGenreDecision, ...decision };
  }
  persistCurrentAudioGenreMemory();
  publishCurrentGenre();
}

function startAudioGenreModel() {
  if (config.localGenreModelEnabled === false) {
    audioGenreModelState = { type: 'disabled', reason: 'disabled in settings' };
    publishAudioGenreModelStatus();
    return null;
  }
  if (audioGenreModel || audioGenreModelStartTask || app.isQuitting) return audioGenreModelStartTask;
  const paths = audioGenreModelPaths();
  if (!localGenreModelFilesAvailable()) {
    audioGenreModelState = {
      type: 'unavailable',
      code: 'MODEL_FILES_MISSING',
      reason: 'bundled Discogs-EffNet model is missing'
    };
    publishAudioGenreModelStatus();
    return null;
  }
  const model = new LocalAudioGenreModel({ ...paths, onEvent: handleAudioGenreModelEvent });
  audioGenreModel = model;
  if (lastTrackKey) model.reset(lastTrackKey, audioGenreContext());
  audioGenreModelState = { type: 'starting' };
  publishAudioGenreModelStatus();
  audioGenreModelStartTask = model.initialize()
    .catch(async (error) => {
      if (audioGenreModel === model) audioGenreModel = null;
      audioGenreModelState = {
        type: 'unavailable',
        code: error?.code || 'MODEL_INITIALIZATION_FAILED',
        category: error?.category || 'model-initialization',
        causeCode: error?.causeCode || error?.cause?.code || '',
        reason: error?.message || String(error)
      };
      await model.close();
      publishAudioGenreModelStatus();
      publishCurrentGenre({ force: true });
    })
    .finally(() => {
      audioGenreModelStartTask = null;
    });
  return audioGenreModelStartTask;
}

async function setAudioGenreModelEnabled(enabled) {
  if (enabled !== false) {
    resetCurrentAudioGenreEvidence();
    startAudioGenreModel();
    publishCurrentGenre({ force: true });
    return;
  }
  const model = audioGenreModel;
  audioGenreModel = null;
  audioGenreModelStartTask = null;
  resetCurrentAudioGenreEvidence({ reloadMemory: false });
  if (model) await model.close();
  audioGenreModelState = { type: 'disabled', reason: 'disabled in settings' };
  publishAudioGenreModelStatus();
  publishCurrentGenre({ force: true });
}

function resetAudioGenreForCurrentTrack() {
  resetCurrentAudioGenreEvidence();
  if (audioGenreModel) audioGenreModel.reset(lastTrackKey, audioGenreContext());
}

function restartAllAudioCapture() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('restart-audio');
  restartRhythmModelForOutputDevice();
}

function clearIdleHideTimer() {
  if (idleHideTimer) clearTimeout(idleHideTimer);
  idleHideTimer = null;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearIdleHideTimer();
  idleAutoHidden = false;
  mainWindow.showInactive();
}

function updateIdleWindowPolicy(playing = Boolean(lastRawMetadata?.playing)) {
  clearIdleHideTimer();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (playing || config.idleBehavior !== 'hide') {
    if (idleAutoHidden) showMainWindow();
    return;
  }
  idleHideTimer = setTimeout(() => {
    idleHideTimer = null;
    if (!mainWindow || mainWindow.isDestroyed() || config.idleBehavior !== 'hide' || lastRawMetadata?.playing) return;
    if (mainWindow.isFocused()) {
      updateIdleWindowPolicy(false);
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      idleAutoHidden = true;
    }
  }, 30000);
}

function toggleMainWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearIdleHideTimer();
  idleAutoHidden = false;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.showInactive();
}

function refreshCurrentGenre() {
  resolver.clear();
  lastTrackKey = '';
  if (lastRawMetadata) handleMetadata(lastRawMetadata);
}

function currentGenreCorrection() {
  return getGenreCorrection(genreCorrections, lastRawMetadata || {});
}

function genreSelection(genreId) {
  const cleanId = String(genreId || '').trim();
  const theme = THEMES[cleanId];
  const customRule = findCustomGenreByCorrectionId(config.customGenres, cleanId);
  if ((!theme || cleanId === 'unknown') && !customRule) return null;
  if (customRule) {
    const base = themeWithId(customRule.baseGenreId);
    const colors = customRule.colors || null;
    return {
      genreId: customGenreCorrectionId(customRule.id),
      label: customRule.name,
      genre: {
        ...base,
        ...(colors || {}),
        ...(colors ? { genreInk: '', genreInk2: '', genreInkEdge: '' } : {}),
        label: customRule.name.toLocaleUpperCase(),
        matched: `temporary:${customRule.id}`,
        confidence: 1
      },
      correction: {
        id: customGenreCorrectionId(customRule.id),
        label: customRule.name.toLocaleUpperCase(),
        customGenreId: customRule.id,
        baseGenreId: customRule.baseGenreId,
        colors: customRule.colors
      }
    };
  }
  return {
    genreId: cleanId,
    label: theme.label,
    genre: { ...themeWithId(cleanId), matched: `temporary:${cleanId}`, confidence: 1 },
    correction: { id: cleanId, label: theme.label }
  };
}

function currentGenreCandidates() {
  const candidates = new Map();
  const add = (genreId, basis, label = '') => {
    const selection = genreSelection(genreId);
    if (!selection) return;
    const existing = candidates.get(selection.genreId);
    if (existing) {
      if (!existing.bases.includes(basis)) existing.bases.push(basis);
      return;
    }
    candidates.set(selection.genreId, {
      id: selection.genreId,
      label: label || selection.label,
      bases: [basis]
    });
  };
  const correction = currentGenreCorrection();
  const displayedId = temporaryGenreOverride?.trackKey === lastTrackKey
    ? temporaryGenreOverride.genreId
    : correction?.genreId || lastResolvedMetadata?.genre?.id;
  add(
    displayedId,
    temporaryGenreOverride?.trackKey === lastTrackKey ? 'locked' : 'current',
    temporaryGenreOverride?.label || correction?.label || lastResolvedMetadata?.genre?.label
  );
  add(lastBaseResolvedMetadata?.genre?.id, 'metadata', lastBaseResolvedMetadata?.genre?.label);

  const addRanked = (result, basis, limit) => {
    let added = 0;
    for (const entry of result?.ranked || []) {
      if (added >= limit) break;
      if (!entry?.id || ['unknown', 'electronic'].includes(entry.id)) continue;
      const before = candidates.size;
      add(entry.id, basis);
      if (candidates.size > before) added += 1;
    }
  };
  addRanked(currentAudioGenreSnapshot?.track, 'ai-track', 3);
  addRanked(currentAudioGenreSnapshot?.segment, 'ai-recent', 2);
  add(lastResolvedMetadata?.audioGenreAlternative, 'ai-track');

  return {
    trackKey: lastTrackKey,
    title: lastResolvedMetadata?.title || lastRawMetadata?.title || '',
    artist: displayArtistName(
      lastResolvedMetadata?.artist
      || lastRawMetadata?.artist
      || lastRawMetadata?.albumArtist
    ),
    selectedGenreId: displayedId || '',
    locked: temporaryGenreOverride?.trackKey === lastTrackKey
      ? { genreId: temporaryGenreOverride.genreId, label: temporaryGenreOverride.label }
      : null,
    candidates: [...candidates.values()].slice(0, 7)
  };
}

function setTemporaryGenre(genreId) {
  if (!lastRawMetadata?.title || !lastTrackKey) return { ok: false, error: 'no-track' };
  const selection = genreSelection(genreId);
  if (!selection) return { ok: false, error: 'invalid-genre' };
  temporaryGenreOverride = {
    trackKey: lastTrackKey,
    genreId: selection.genreId,
    label: selection.label,
    genre: selection.genre
  };
  publishCurrentGenre({ force: true });
  return { ok: true, override: { genreId: selection.genreId, label: selection.label } };
}

function clearTemporaryGenre() {
  const changed = Boolean(temporaryGenreOverride?.trackKey === lastTrackKey);
  temporaryGenreOverride = null;
  if (changed) publishCurrentGenre({ force: true });
  return { ok: true, changed };
}

function rememberCurrentGenre(genreId) {
  const selection = genreSelection(genreId);
  if (!lastRawMetadata?.title) return { ok: false, error: 'no-track' };
  if (!selection) return { ok: false, error: 'invalid-genre' };
  const updated = setGenreCorrection(genreCorrections, lastRawMetadata, selection.correction);
  if (!updated.changed) return { ok: false, error: 'invalid-track' };
  temporaryGenreOverride = null;
  genreCorrections = updated.state;
  saveGenreCorrections();
  rebuildTrayMenu();
  refreshCurrentGenre();
  return { ok: true, correction: updated.correction };
}

function forgetCurrentGenre() {
  if (!lastRawMetadata?.title) return { ok: false, error: 'no-track' };
  const updated = clearGenreCorrection(genreCorrections, lastRawMetadata);
  genreCorrections = updated.state;
  if (updated.changed) {
    saveGenreCorrections();
    rebuildTrayMenu();
    refreshCurrentGenre();
  }
  return { ok: true, changed: updated.changed };
}

function setMainWindowMouseEventsIgnored(ignored) {
  const nextIgnored = ignored === true;
  if (!mainWindow || mainWindow.isDestroyed() || mainWindowMouseEventsIgnored === nextIgnored) return;
  mainWindowMouseEventsIgnored = nextIgnored;
  mainWindow.setIgnoreMouseEvents(nextIgnored, { forward: true });
}

function updateMainWindowPointerHitTest() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  if (stageOutputActive) {
    setMainWindowMouseEventsIgnored(false);
    return;
  }
  const pointerInside = pointInWindowSurface(
    screen.getCursorScreenPoint(),
    mainWindow.getBounds(),
    normalizeLayoutMode(config.layoutMode),
    { settingsOpen: mainSettingsOpen }
  );
  setMainWindowMouseEventsIgnored(clickThrough || (!mainWindowBeingMoved && !pointerInside));
}

function startMainWindowPointerHitTest() {
  if (pointerHitTestTimer) {
    updateMainWindowPointerHitTest();
    return;
  }
  pointerHitTestTimer = setInterval(updateMainWindowPointerHitTest, 24);
  updateMainWindowPointerHitTest();
}

function stopMainWindowPointerHitTest() {
  if (pointerHitTestTimer) clearInterval(pointerHitTestTimer);
  pointerHitTestTimer = null;
  mainWindowMouseEventsIgnored = null;
  mainWindowBeingMoved = false;
}

function syncMainWindowBackgroundActivity() {
  const visible = Boolean(mainWindow && !mainWindow.isDestroyed()
    && mainWindow.isVisible() && !mainWindow.isMinimized());
  if (visible) {
    startMainWindowPointerHitTest();
    startBackdropSampler();
    return;
  }
  stopMainWindowPointerHitTest();
  stopBackdropSampler();
}

async function openGenreCorrection() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (stageOutputActive) await setStageOutput(false);
  showMainWindow();
  setClickThrough(false);
  mainSettingsOpen = true;
  updateMainWindowPointerHitTest();
  mainWindow.webContents.send('genre-correction:open');
}

function openSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showMainWindow();
  setClickThrough(false);
  mainSettingsOpen = true;
  updateMainWindowPointerHitTest();
  mainWindow.webContents.send('settings:open');
}

function trayImage() {
  const icon = nativeImage.createFromPath(assetPath('tray-icon.png'));
  if (icon.isEmpty()) console.error(`Tray icon could not be loaded: ${assetPath('tray-icon.png')}`);
  const resized = icon.resize({ width: 16, height: 16, quality: 'best' });
  resized.setTemplateImage(false);
  return resized;
}

function setClickThrough(value, { persist = true } = {}) {
  clickThrough = Boolean(value);
  if (clickThrough) mainSettingsOpen = false;
  if (persist) saveConfig({ clickThrough });
  if (mainWindow && !mainWindow.isDestroyed()) {
    updateMainWindowPointerHitTest();
    mainWindow.webContents.send('interaction-state', { clickThrough });
  }
  rebuildTrayMenu();
}

function desktopLayerHelperPath() {
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : __dirname;
  return path.join(root, 'scripts', 'windows-desktop-host.exe');
}

function desktopLayerAvailable() {
  return process.platform === 'win32' && fs.existsSync(desktopLayerHelperPath());
}

function mainWindowHandleString() {
  if (!mainWindow || mainWindow.isDestroyed()) return '';
  const handle = mainWindow.getNativeWindowHandle();
  if (!Buffer.isBuffer(handle) || handle.length < 4) return '';
  return handle.length >= 8
    ? handle.readBigUInt64LE(0).toString()
    : BigInt(handle.readUInt32LE(0)).toString();
}

function runDesktopLayerHelper(command) {
  const handle = mainWindowHandleString();
  if (!desktopLayerAvailable() || !handle) {
    return Promise.resolve({ ok: false, mode: 'detached', detail: 'desktop-layer-unavailable' });
  }
  const execute = () => new Promise((resolve) => {
    const child = spawn(desktopLayerHelperPath(), [command, handle], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish({ ok: false, mode: desktopLayerAttached ? 'attached' : 'detached', detail: 'desktop-layer-timeout' });
    }, 4000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      finish({ ok: false, mode: 'detached', detail: error.message });
    });
    child.on('close', () => {
      clearTimeout(timeout);
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
        finish(JSON.parse(line || ''));
      } catch {
        finish({ ok: false, mode: 'detached', detail: stderr.trim() || 'desktop-layer-invalid-response' });
      }
    });
  });
  desktopLayerTask = desktopLayerTask.then(execute, execute);
  return desktopLayerTask;
}

async function syncDesktopLayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const shouldAttach = desktopLayerEnabled && !stageOutputActive;
  const result = await runDesktopLayerHelper(shouldAttach ? 'attach' : 'detach');
  desktopLayerAttached = result.ok === true && result.mode === 'attached';
  desktopLayerLastError = result.ok === true ? '' : String(result.detail || 'desktop-layer-failed');
  return shouldAttach ? desktopLayerAttached : !desktopLayerAttached;
}

function startDesktopLayerMonitor() {
  if (desktopLayerMonitor) clearInterval(desktopLayerMonitor);
  desktopLayerMonitor = setInterval(async () => {
    if (!desktopLayerEnabled || stageOutputActive || !mainWindow || mainWindow.isDestroyed()) return;
    const status = await runDesktopLayerHelper('status');
    desktopLayerAttached = status.ok === true && status.mode === 'attached';
    if (!desktopLayerAttached) await syncDesktopLayer();
  }, 15000);
  desktopLayerMonitor.unref?.();
}

async function setDesktopLayer(value, { persist = true } = {}) {
  const requested = normalizeDesktopLayer(value);
  desktopLayerEnabled = requested && desktopLayerAvailable();
  if (desktopLayerEnabled) {
    alwaysOnTop = false;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false, 'floating');
  }
  await syncDesktopLayer();
  if (requested && !desktopLayerAttached && !stageOutputActive) desktopLayerEnabled = false;
  if (persist) saveConfig({ desktopLayer: desktopLayerEnabled, alwaysOnTop });
  rebuildTrayMenu();
  return {
    enabled: desktopLayerEnabled,
    attached: desktopLayerAttached,
    available: desktopLayerAvailable(),
    error: desktopLayerLastError,
    alwaysOnTop
  };
}

async function setAlwaysOnTop(value, { persist = true } = {}) {
  alwaysOnTop = normalizeAlwaysOnTop(value);
  if (alwaysOnTop && desktopLayerEnabled) {
    desktopLayerEnabled = false;
    await syncDesktopLayer();
  }
  if (persist) saveConfig({ alwaysOnTop, desktopLayer: desktopLayerEnabled });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(stageOutputActive || alwaysOnTop, stageOutputActive ? 'screen-saver' : 'floating');
  }
  rebuildTrayMenu();
  return alwaysOnTop;
}

function stageOutputState(extra = {}) {
  return { ok: true, active: stageOutputActive, ...extra };
}

async function setStageOutput(value) {
  const active = value === true;
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, active: false, error: 'window-unavailable' };
  if (active === stageOutputActive) return stageOutputState();
  if (active && recordingSession) return { ok: false, active: false, error: 'recording-active' };
  if (!active && recordingSession) return { ok: false, active: true, error: 'recording-active' };

  if (active) {
    if (desktopLayerAttached) {
      const result = await runDesktopLayerHelper('detach');
      desktopLayerAttached = !(result.ok === true && result.mode === 'detached');
      if (desktopLayerAttached) {
        desktopLayerLastError = String(result.detail || 'desktop-layer-detach-failed');
        return { ok: false, active: false, error: 'desktop-layer-detach-failed' };
      }
    }
    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    stageOutputRestoreBounds = currentBounds;
    stageOutputActive = true;
    mainSettingsOpen = false;
    if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
    windowPositionSaveTimer = null;
    stopBackdropSampler();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setBounds(display.bounds, false);
    mainWindow.show();
    mainWindow.focus();
    setMainWindowMouseEventsIgnored(false);
    globalShortcut.unregister('Escape');
    globalShortcut.register('Escape', () => setStageOutput(false));
    mainWindow.webContents.send('stage-output-state', stageOutputState({ displayId: display.id }));
  } else {
    globalShortcut.unregister('Escape');
    stageOutputActive = false;
    const restoreBounds = stageOutputRestoreBounds;
    stageOutputRestoreBounds = null;
    if (restoreBounds) mainWindow.setBounds(restoreBounds, false);
    mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
    mainWindow.webContents.send('stage-output-state', stageOutputState());
    updateMainWindowPointerHitTest();
    if (usesAdaptiveBackdrop()) startBackdropSampler();
    scheduleWindowPositionSave();
    if (desktopLayerEnabled) await syncDesktopLayer();
  }
  rebuildTrayMenu();
  return stageOutputState();
}

function setUiScale(value) {
  const uiScale = normalizeUiScale(value);
  saveConfig({ uiScale });
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!stageOutputActive) resizeMainWindow(layoutWindowSize(config.layoutMode, uiScale));
    mainWindow.webContents.send('ui-scale', { scale: uiScale });
  }
  rebuildTrayMenu();
  return { scale: uiScale };
}

function resizeMainWindow({ width, height }, { animate = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const centeredX = bounds.x + Math.round((bounds.width - width) / 2);
  const centeredY = bounds.y + Math.round((bounds.height - height) / 2);
  const x = Math.max(area.x, Math.min(area.x + area.width - width, centeredX));
  const y = Math.max(area.y, Math.min(area.y + area.height - height, centeredY));
  mainWindow.setBounds({ x, y, width, height }, animate);
}

function setLayoutMode(value) {
  const layoutMode = normalizeLayoutMode(value);
  saveConfig({ layoutMode });
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!stageOutputActive) {
      resizeMainWindow(
        layoutWindowSize(layoutMode, normalizeUiScale(config.uiScale)),
        { animate: false }
      );
    }
    mainWindow.webContents.send('layout-mode', { mode: layoutMode });
  }
  if (stageOutputActive) stopBackdropSampler();
  else if (usesAdaptiveBackdrop(layoutMode)) startBackdropSampler();
  else stopBackdropSampler();
  return { mode: layoutMode };
}

function usesAdaptiveBackdrop(layoutMode = config.layoutMode) {
  return normalizeLayoutMode(layoutMode) === 'poster'
    ? config.posterThemedBackground === false
    : config.capsuleThemedBackground === false;
}

function setDemoTheme(id = '') {
  demoTheme = id;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('demo-theme', id ? {
    id,
    ...themeFor(id),
    synthetic: Boolean(process.env.GP_CAPTURE_PATH),
    captureLyrics: Boolean(process.env.GP_CAPTURE_LYRICS),
    captureKawaiiExcited: Boolean(process.env.GP_CAPTURE_KAWAII_EXCITED),
    captureTanoc: Boolean(process.env.GP_CAPTURE_TANOC),
    captureArtwork: process.env.GP_CAPTURE_ARTWORK || '',
    easterEgg: process.env.GP_CAPTURE_EASTER_EGG === 'genre-police'
  } : null);
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const locale = normalizeLocale(config.language);
  const tr = (key, variables) => translate(locale, key, variables);
  const currentTitle = String(lastRawMetadata?.title || '').trim();
  const hasCurrentTrack = Boolean(currentTitle);
  const hasCorrection = Boolean(currentGenreCorrection());
  const recordingActive = Boolean(recordingSession);
  const previewRadio = (id, label) => ({
    label,
    type: 'radio',
    checked: demoTheme === id,
    click: () => setDemoTheme(id)
  });
  const previewNode = (node) => {
    if (!node.children.length) return previewRadio(node.id, node.label);
    const submenu = [];
    if (node.selectable) {
      submenu.push(previewRadio(node.id, tr('tray.previewGenre', { genre: node.label })));
      submenu.push({ type: 'separator' });
    }
    submenu.push(...node.children.map(previewNode));
    return { label: node.label, submenu };
  };
  const previewTree = buildPreviewTree(THEMES, DEMO_THEME_IDS);
  const template = [
    { label: 'Genre Police Visualizer', enabled: false },
    {
      label: hasCurrentTrack
        ? tr('tray.currentTrack', { title: currentTitle.length > 42 ? `${currentTitle.slice(0, 39)}…` : currentTitle })
        : tr('tray.noCurrentTrack'),
      enabled: false
    },
    { type: 'separator' },
    { label: tr('tray.showHide'), enabled: !recordingActive, click: toggleMainWindowVisibility },
    { label: tr('tray.settings'), enabled: !recordingActive, click: openSettings },
    {
      label: tr(stageOutputActive ? 'tray.stopStageOutput' : 'tray.startStageOutput'),
      enabled: !recordingActive,
      accelerator: 'CommandOrControl+Shift+O', registerAccelerator: false,
      click: () => setStageOutput(!stageOutputActive)
    },
    {
      label: recordingSession ? tr('tray.stopRecording') : tr('tray.startRecording'),
      enabled: true,
      accelerator: 'CommandOrControl+Shift+R',
      registerAccelerator: false,
      click: () => sendRecordingCommand(recordingSession ? 'stop' : 'start')
    },
    {
      label: tr('tray.clickThrough'), type: 'checkbox', checked: clickThrough,
      enabled: !recordingActive && !stageOutputActive,
      accelerator: 'CommandOrControl+Shift+G', registerAccelerator: false,
      click: (item) => setClickThrough(item.checked)
    },
    { type: 'separator' },
    {
      label: tr('tray.genre'),
      enabled: !recordingActive,
      submenu: [
        { label: tr('tray.correctGenre'), enabled: hasCurrentTrack, click: openGenreCorrection },
        { label: tr('tray.clearCorrection'), enabled: hasCorrection, click: forgetCurrentGenre },
        { label: tr('tray.refreshGenre'), enabled: hasCurrentTrack, click: refreshCurrentGenre }
      ]
    },
    {
      label: tr('tray.scale'), enabled: !recordingActive, submenu: UI_SCALES.map((scale) => ({
        label: uiScaleLabel(scale),
        type: 'radio',
        checked: normalizeUiScale(config.uiScale) === scale,
        click: () => setUiScale(scale)
      }))
    },
    {
      label: tr('tray.preview'), submenu: [
        { label: tr('tray.followTrack'), type: 'radio', checked: !demoTheme, click: () => setDemoTheme('') },
        { type: 'separator' },
        ...previewTree.flatMap((group) => {
          const onlyChild = group.children.length === 1 ? group.children[0] : null;
          const duplicatesOnlyChild = onlyChild
            && String(onlyChild.label).trim().toLocaleUpperCase()
              === String(group.label).trim().toLocaleUpperCase();
          return group.label === 'GENRE POLICE' || duplicatesOnlyChild
            ? group.children.map(previewNode)
            : [{ label: group.label, submenu: group.children.map(previewNode) }];
        })
      ]
    },
    { label: tr('tray.recaptureAudio'), enabled: !recordingActive, click: restartAllAudioCapture },
    { type: 'separator' },
    { label: tr('tray.quit'), click: requestAppQuit }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Genre Police Visualizer');
  tray.on('double-click', () => {
    showMainWindow();
    if (recordingSession) return;
    setClickThrough(!clickThrough);
  });
  rebuildTrayMenu();
}

function defaultWindowPosition() {
  const scale = normalizeUiScale(config.uiScale);
  const { width, height } = layoutWindowSize(config.layoutMode, scale);
  return resolveWindowBounds({
    savedPosition: config.windowPosition,
    width,
    height,
    workAreas: screen.getAllDisplays().map((display) => display.workArea),
    primaryWorkArea: screen.getPrimaryDisplay().workArea,
    rightMargin: 28,
    bottomMargin: 24
  });
}

function saveWindowPositionNow() {
  if (!mainWindow || mainWindow.isDestroyed() || process.env.GP_CAPTURE_PATH || stageOutputActive) return;
  const bounds = mainWindow.getBounds();
  saveConfig({ windowPosition: { x: bounds.x, y: bounds.y } });
}

function scheduleWindowPositionSave() {
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = setTimeout(() => {
    windowPositionSaveTimer = null;
    saveWindowPositionNow();
  }, 360);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...defaultWindowPosition(),
    title: 'Genre Police Visualizer',
    icon: assetPath('icon.png'),
    minWidth: 300,
    minHeight: 240,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });

  mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindowMouseEventsIgnored = null;
  setMainWindowMouseEventsIgnored(true);
  mainWindow.on('will-move', () => {
    mainWindowBeingMoved = true;
    updateMainWindowPointerHitTest();
  });
  mainWindow.on('moved', () => {
    mainWindowBeingMoved = false;
    updateMainWindowPointerHitTest();
  });
  mainWindow.on('move', () => {
    scheduleWindowPositionSave();
    positionRecordingControlsWindow();
    updateMainWindowPointerHitTest();
  });
  mainWindow.on('resize', () => {
    positionRecordingControlsWindow();
    updateMainWindowPointerHitTest();
  });
  mainWindow.on('show', syncMainWindowBackgroundActivity);
  mainWindow.on('hide', syncMainWindowBackgroundActivity);
  mainWindow.on('minimize', syncMainWindowBackgroundActivity);
  mainWindow.on('restore', syncMainWindowBackgroundActivity);
  mainWindow.webContents.on('console-message', (event) => {
    if (event.level === 'error') {
      console.error(`[renderer] ${event.message} (${event.sourceId || 'unknown'}:${event.lineNumber || 0})`);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer-gone]', details);
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();
    if (desktopLayerEnabled) void syncDesktopLayer();
    startDesktopLayerMonitor();
    startMainWindowPointerHitTest();
    mainWindow.webContents.send('ui-scale', { scale: normalizeUiScale(config.uiScale) });
    mainWindow.webContents.send('layout-mode', { mode: normalizeLayoutMode(config.layoutMode) });
    mainWindow.webContents.send('stage-output-state', stageOutputState());
    mainWindow.webContents.send('rhythm-model', rhythmModelState);
    mainWindow.webContents.send('local-genre-model-status', audioGenreModelStatus());
    syncMainWindowBackgroundActivity();
    scheduleAutomaticUpdateCheck();
    if (process.env.GP_DEMO_THEME) {
      setDemoTheme(process.env.GP_DEMO_THEME);
      setTimeout(() => setDemoTheme(process.env.GP_DEMO_THEME), 320);
    }
    if (process.env.GP_CAPTURE_SETTINGS || process.env.GP_CAPTURE_SCALE_MENU
      || process.env.GP_CAPTURE_MEDIA_MENU || process.env.GP_CAPTURE_CUSTOM_GENRES
      || process.env.GP_CAPTURE_GENRE_ARTISTS
      || process.env.GP_CAPTURE_DIAGNOSTICS
      || process.env.GP_CAPTURE_NETEASE_HINT || process.env.GP_CAPTURE_SETTINGS_PANE
      || (process.env.GP_CAPTURE_LANGUAGE && !process.env.GP_CAPTURE_NETEASE_TOAST)
      || process.env.GP_CAPTURE_CORRECTION_QUERY
      || process.env.GP_CAPTURE_CUSTOM_GENRE_DELETE) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript("document.querySelector('#settings-button')?.click()").catch(() => {});
      }, 480);
    }
    if (process.env.GP_CAPTURE_SETTINGS_PANE) {
      setTimeout(() => {
        const pane = JSON.stringify(String(process.env.GP_CAPTURE_SETTINGS_PANE));
        mainWindow?.webContents.executeJavaScript(
          `document.querySelector('.settings-tab[data-settings-pane=' + ${pane} + ']')?.click()`
        ).catch(() => {});
      }, 780);
    }
    if (process.env.GP_CAPTURE_CORRECTION) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="genre"]')?.click();
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('.genre-correction-settings');
          if (settings && panel) settings.scrollTo({ top: Math.max(0, panel.offsetTop - 58) });
          document.querySelector('#genre-correction-input')?.focus();
        })()`).catch(() => {});
      }, 850);
    }
    if (process.env.GP_CAPTURE_CORRECTION_QUERY) {
      setTimeout(() => {
        const query = JSON.stringify(String(process.env.GP_CAPTURE_CORRECTION_QUERY));
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="genre"]')?.click();
          const input = document.querySelector('#genre-correction-input');
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('.genre-correction-settings');
          if (!input) return;
          input.disabled = false;
          input.value = ${query};
          input.dataset.genreId = '';
          input.focus();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          if (settings && panel) settings.scrollTo({ top: Math.max(0, panel.offsetTop - 58) });
        })()`).catch(() => {});
      }, 900);
    }
    if (process.env.GP_CAPTURE_CONTROLS) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript("document.body.classList.add('interactive', 'pointer-active')").catch(() => {});
      }, 480);
    }
    if (process.env.GP_CAPTURE_STAGE_OUTPUT) {
      setTimeout(() => setStageOutput(true), 720);
    }
    if (process.env.GP_CAPTURE_STAGE_SETTINGS) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(
          "document.querySelector('#fullscreen-settings-button')?.click()"
        ).catch(() => {});
      }, 980);
    }
    if (process.env.GP_CAPTURE_GENRE_QUICK) {
      setTimeout(() => {
        setDemoTheme('');
        const raw = {
          title: 'Midnight Circuit',
          artist: 'Genre Police Unit',
          album: 'Visual Evidence',
          playing: true,
          status: 'Playing',
          positionMs: 8200,
          durationMs: 240000,
          source: 'Capture'
        };
        lastRawMetadata = raw;
        lastTrackKey = 'genre police unit::midnight circuit::visual evidence';
        lastBaseResolvedMetadata = {
          ...raw,
          displayArtist: raw.artist,
          genre: themeWithId('synthwave'),
          genreSource: 'Capture metadata',
          genreSources: ['Capture metadata'],
          genreEvidence: { type: 'classifier', matched: 'Synthwave' }
        };
        lastResolvedMetadata = withGenreReliability(lastBaseResolvedMetadata);
        currentAudioGenreSnapshot = {
          trackKey: lastTrackKey,
          acceptedWindows: 12,
          track: { ranked: [{ id: 'synthwave' }, { id: 'electro-house' }, { id: 'progressive-house' }] },
          segment: { ranked: [{ id: 'trance' }, { id: 'electro-house' }] },
          winnerHistory: ['synthwave']
        };
        mainWindow?.webContents.send('now-playing', lastResolvedMetadata);
        setTimeout(() => {
          mainWindow?.webContents.executeJavaScript(
            "document.querySelector('#genre')?.click()"
          ).catch(() => {});
        }, 700);
      }, 620);
    }
    if (process.env.GP_CAPTURE_SCALE_MENU) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript("document.querySelector('#ui-scale-button')?.click()").catch(() => {});
      }, 760);
    }
    if (process.env.GP_CAPTURE_MEDIA_MENU) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="playback"]')?.click();
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('.media-source-settings');
          if (settings && panel) settings.scrollTo({ top: Math.max(0, panel.offsetTop - 68) });
          document.querySelector('#media-source-button')?.click();
        })()`).catch(() => {});
      }, 820);
    }
    if (process.env.GP_CAPTURE_CUSTOM_GENRES) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="genre"]')?.click();
          document.querySelector('#custom-genre-panel')?.setAttribute('open', '');
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('.custom-genre-settings');
          if (settings && panel) {
            const top = settings.scrollTop + panel.parentElement.getBoundingClientRect().top
              - settings.getBoundingClientRect().top - 28;
            settings.scrollTo({ top: Math.max(0, top) });
          }
        })()`).catch(() => {});
      }, 820);
    }
    if (process.env.GP_CAPTURE_GENRE_ARTISTS) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="genre"]')?.click();
          document.querySelector('#genre-artist-panel')?.setAttribute('open', '');
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('#genre-artist-panel');
          if (settings && panel) {
            const top = settings.scrollTop + panel.getBoundingClientRect().top
              - settings.getBoundingClientRect().top - 178;
            settings.scrollTo({ top: Math.max(0, top) });
          }
          setTimeout(() => document.querySelector('#genre-artist-genre')?.click(), 160);
        })()`).catch(() => {});
      }, 820);
    }
    if (process.env.GP_CAPTURE_DIAGNOSTICS) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="app"]')?.click();
          const panel = document.querySelector('#diagnostics-panel');
          const settings = document.querySelector('.settings-scroll');
          if (!panel || !settings) return;
          panel.open = true;
          panel.dispatchEvent(new Event('toggle'));
          const top = settings.scrollTop + panel.getBoundingClientRect().top
            - settings.getBoundingClientRect().top - 150;
          settings.scrollTo({ top: Math.max(0, top) });
        })()`).catch(() => {});
      }, 860);
    }
    if (process.env.GP_CAPTURE_CUSTOM_GENRE_DELETE) {
      setTimeout(() => {
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="genre"]')?.click();
          document.querySelector('#custom-genre-panel')?.setAttribute('open', '');
          const timer = setInterval(() => {
            const remove = document.querySelector('.custom-genre-item [data-action="delete"]');
            if (!remove) return;
            clearInterval(timer);
            remove.click();
            setTimeout(() => {
              document.querySelector('.custom-genre-item [data-action="confirm-delete"]')
                ?.closest('.custom-genre-item')?.scrollIntoView({ block: 'center' });
            }, 80);
          }, 100);
        })()`).catch(() => {});
      }, 900);
    }
    if (process.env.GP_CAPTURE_NETEASE_HINT) {
      setTimeout(() => {
        mainWindow?.webContents.send('media-sources', {
          sources: [],
          currentSource: '',
          preferredSource: '',
          ignoredSources: [],
          detectedPlayers: { neteaseRunning: true, neteaseSmtcAvailable: false }
        });
        mainWindow?.webContents.executeJavaScript(`(() => {
          document.querySelector('.settings-tab[data-settings-pane="playback"]')?.click();
          const settings = document.querySelector('.settings-scroll');
          const panel = document.querySelector('.media-source-settings');
          if (settings && panel) settings.scrollTo({ top: Math.max(0, panel.offsetTop - 56) });
        })()`).catch(() => {});
      }, 820);
    }
    if (process.env.GP_CAPTURE_NETEASE_TOAST) {
      setTimeout(() => {
        mainWindow?.webContents.send('media-sources', {
          sources: [],
          currentSource: '',
          preferredSource: '',
          ignoredSources: [],
          detectedPlayers: { neteaseRunning: true, neteaseSmtcAvailable: false }
        });
      }, 820);
    }
    if (process.env.GP_CAPTURE_UPDATE_TOAST) {
      setTimeout(() => {
        mainWindow?.webContents.send('update-status', {
          ...updateStatus('available'),
          latestVersion: 'v0.3.1',
          releaseName: 'v0.3.1',
          releaseUrl: `${UPDATE_RELEASES_URL}/tag/v0.3.1`
        });
      }, 820);
    }
    if (process.env.GP_CAPTURE_PATH && process.env.GP_CAPTURE_BACKDROP === 'bright') {
      setTimeout(() => {
        const profile = deriveBackdropProfile({ r: 250, g: 250, b: 250, luminance: 0.98, saturation: 0 });
        mainWindow.webContents.send('backdrop-profile', profile);
      }, 520);
    }
    if (process.env.GP_CAPTURE_PATH) {
      const captureDelay = Math.max(500, Number(process.env.GP_CAPTURE_DELAY) || 5500);
      setTimeout(async () => {
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(process.env.GP_CAPTURE_PATH, image.toPNG());
        app.quit();
      }, captureDelay);
    }
  });
  mainWindow.on('closed', () => {
    stopMainWindowPointerHitTest();
    mainSettingsOpen = false;
    if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
    windowPositionSaveTimer = null;
    if (recordingControlsWindow && !recordingControlsWindow.isDestroyed()) recordingControlsWindow.destroy();
    if (recordingTransportWindow && !recordingTransportWindow.isDestroyed()) recordingTransportWindow.destroy();
    recordingControlsWindow = null;
    recordingTransportWindow = null;
    recordingControlsState = null;
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function setupAudioCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      if (request.videoRequested && !request.audioRequested && request.frame) {
        callback({ video: request.frame });
        return;
      }
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      callback({ video: sources[0], audio: 'loopback' });
    } catch (error) {
      console.error('Audio capture failed:', error);
      callback({});
    }
  });
}

async function prepareRecording(event, payload) {
  if (!recordingSenderAllowed(event)) return { ok: false, error: 'not-allowed' };
  if (recordingSession) return { ok: false, error: 'already-recording' };
  const extension = payload?.extension === 'mp4' ? 'mp4' : 'webm';
  const formatLabel = extension === 'mp4'
    ? recordingLocaleText('recording.mp4Video')
    : recordingLocaleText('recording.webmVideo');
  const options = {
    title: recordingLocaleText('recording.saveDialogTitle'),
    defaultPath: path.join(app.getPath('videos'), `${recordingFileStem()}.${extension}`),
    filters: [{ name: formatLabel, extensions: [extension] }],
    properties: ['showOverwriteConfirmation', 'createDirectory']
  };
  hideRecordingControlsWindows();
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const finalPath = result.filePath.toLowerCase().endsWith(`.${extension}`)
    ? result.filePath
    : `${result.filePath}.${extension}`;
  const partialPath = `${finalPath}.part`;
  try {
    fs.rmSync(partialPath, { force: true });
    const fd = fs.openSync(partialPath, 'w');
    recordingSession = {
      id: randomUUID(),
      fd,
      finalPath,
      partialPath,
      extension,
      bytes: 0,
      startedAt: Date.now()
    };
    setRecordingBackgroundPriority(true);
    if (tray && !tray.isDestroyed()) {
      tray.setToolTip(recordingLocaleText('recording.trayActive'));
    }
    rebuildTrayMenu();
    return { ok: true, id: recordingSession.id, filePath: finalPath };
  } catch (error) {
    console.error('Could not prepare recording file:', error);
    closeRecordingFile();
    return { ok: false, error: 'open-failed' };
  }
}

function appendRecordingChunk(event, payload) {
  if (!recordingSenderAllowed(event)) return { ok: false, error: 'not-allowed' };
  const active = recordingSession;
  if (!active || payload?.id !== active.id) return { ok: false, error: 'invalid-session' };
  const chunk = payload?.chunk;
  const bytes = chunk instanceof ArrayBuffer
    ? Buffer.from(chunk)
    : ArrayBuffer.isView(chunk)
      ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      : null;
  if (!bytes || bytes.length === 0 || bytes.length > 32 * 1024 * 1024) {
    return { ok: false, error: 'invalid-chunk' };
  }
  try {
    fs.writeSync(active.fd, bytes);
    active.bytes += bytes.length;
    return { ok: true, bytes: active.bytes };
  } catch (error) {
    console.error('Could not write recording chunk:', error);
    closeRecordingFile();
    return { ok: false, error: 'write-failed' };
  }
}

function finishRecording(event, payload) {
  if (!recordingSenderAllowed(event)) return { ok: false, error: 'not-allowed' };
  const active = recordingSession;
  if (!active || payload?.id !== active.id) return { ok: false, error: 'invalid-session' };
  recordingSession = null;
  setRecordingBackgroundPriority(false);
  try {
    const reportedDuration = Number(payload?.durationMs);
    const durationMs = Number.isFinite(reportedDuration) && reportedDuration > 0
      ? reportedDuration
      : Date.now() - active.startedAt;
    fs.fsyncSync(active.fd);
    fs.closeSync(active.fd);
    if (active.bytes <= 0) throw new Error('Recording contained no media data');
    if (active.extension === 'mp4') {
      try {
        const patchResult = patchMp4DurationFile(active.partialPath, durationMs);
        if (!patchResult.patched) console.warn('MP4 duration metadata could not be updated');
      } catch (error) {
        console.warn('Could not update MP4 duration metadata:', error.message);
      }
    }
    fs.rmSync(active.finalPath, { force: true });
    fs.renameSync(active.partialPath, active.finalPath);
    if (tray && !tray.isDestroyed()) tray.setToolTip('Genre Police Visualizer');
    rebuildTrayMenu();
    const response = {
      ok: true,
      filePath: active.finalPath,
      bytes: active.bytes,
      durationMs
    };
    if (quitAfterRecording) {
      quitAfterRecording = false;
      setImmediate(() => app.quit());
    }
    return response;
  } catch (error) {
    console.error('Could not finalize recording:', error);
    try {
      fs.closeSync(active.fd);
    } catch {}
    try {
      fs.rmSync(active.partialPath, { force: true });
    } catch {}
    if (tray && !tray.isDestroyed()) tray.setToolTip('Genre Police Visualizer');
    rebuildTrayMenu();
    if (quitAfterRecording) {
      quitAfterRecording = false;
      setImmediate(() => app.quit());
    }
    return { ok: false, error: 'finalize-failed' };
  }
}

function cancelRecording(event, payload) {
  if (!recordingSenderAllowed(event)) return { ok: false, error: 'not-allowed' };
  if (recordingSession && payload?.id && payload.id !== recordingSession.id) {
    return { ok: false, error: 'invalid-session' };
  }
  closeRecordingFile();
  if (quitAfterRecording) {
    quitAfterRecording = false;
    setImmediate(() => app.quit());
  }
  return { ok: true };
}

async function sampleWindowBackdrop() {
  if (!usesAdaptiveBackdrop()) return;
  if (backdropSampling || !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) return;
  if (process.env.GP_CAPTURE_PATH && process.env.GP_CAPTURE_BACKDROP === 'bright') {
    const profile = deriveBackdropProfile({ r: 250, g: 250, b: 250, luminance: 0.98, saturation: 0 });
    mainWindow.webContents.send('backdrop-profile', profile);
    return;
  }
  backdropSampling = true;
  try {
    const windowBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(windowBounds);
    const thumbnailWidth = 240;
    const thumbnailHeight = Math.max(90, Math.round(thumbnailWidth * display.bounds.height / Math.max(1, display.bounds.width)));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbnailWidth, height: thumbnailHeight },
      fetchWindowIcons: false
    });
    const source = sources.find((candidate) => String(candidate.display_id) === String(display.id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) return;
    const size = source.thumbnail.getSize();
    const sample = analyzeBackdropBitmap(
      source.thumbnail.toBitmap(),
      size.width,
      size.height,
      display.bounds,
      windowBounds
    );
    backdropSampleState = smoothBackdropSample(backdropSampleState, sample);
    const profile = deriveBackdropProfile(backdropSampleState);
    if (profile) mainWindow.webContents.send('backdrop-profile', profile);
  } catch (error) {
    console.warn('Adaptive backdrop sample failed:', error.message);
  } finally {
    backdropSampling = false;
  }
}

function startBackdropSampler() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) {
    stopBackdropSampler();
    return;
  }
  if (!usesAdaptiveBackdrop()) {
    stopBackdropSampler();
    return;
  }
  if (backdropTimer) clearInterval(backdropTimer);
  sampleWindowBackdrop();
  backdropTimer = setInterval(sampleWindowBackdrop, 1700);
}

function stopBackdropSampler() {
  if (!backdropTimer) return;
  clearInterval(backdropTimer);
  backdropTimer = null;
}

function mediaPreferenceArguments(preferredSource = config.preferredMediaSource) {
  const args = [];
  const normalizedPreferredSource = normalizeMediaSource(preferredSource);
  if (normalizedPreferredSource) args.push('-PreferredSource', normalizedPreferredSource);
  const ignored = normalizeIgnoredMediaSources(config.ignoredMediaSources);
  if (ignored.length) {
    args.push('-IgnoredSourcesBase64', Buffer.from(JSON.stringify(ignored), 'utf8').toString('base64'));
  }
  return args;
}

function publishMediaSources(sources = [], currentSource = lastRawMetadata?.source || '', playerState = null) {
  const rawSources = [...new Set(sources.map(normalizeMediaSource).filter(Boolean))];
  let nextDetectedPlayers = {
    neteaseRunning: typeof playerState?.neteaseRunning === 'boolean'
      ? playerState.neteaseRunning
      : detectedMediaPlayers.neteaseRunning,
    neteaseSmtcAvailable: rawSources.some((source) => /cloudmusic|netease/i.test(source))
  };
  if (process.env.GP_CAPTURE_NETEASE_HINT || process.env.GP_CAPTURE_NETEASE_TOAST) {
    nextDetectedPlayers = { neteaseRunning: true, neteaseSmtcAvailable: false };
  }
  const normalized = [...new Set([
    ...rawSources,
    config.preferredMediaSource,
    ...normalizeIgnoredMediaSources(config.ignoredMediaSources)
  ].map(normalizeMediaSource).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const changed = JSON.stringify(normalized) !== JSON.stringify(availableMediaSources);
  const detectedPlayersChanged = JSON.stringify(nextDetectedPlayers) !== JSON.stringify(detectedMediaPlayers);
  availableMediaSources = normalized;
  detectedMediaPlayers = nextDetectedPlayers;
  if ((changed || detectedPlayersChanged || currentSource) && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('media-sources', {
      sources: availableMediaSources,
      currentSource: normalizeMediaSource(currentSource),
      preferredSource: config.preferredMediaSource,
      ignoredSources: normalizeIgnoredMediaSources(config.ignoredMediaSources),
      detectedPlayers: detectedMediaPlayers
    });
  }
}

function restartMediaMonitor() {
  if (mediaRestartTimer) clearTimeout(mediaRestartTimer);
  mediaRestartTimer = null;
  if (mediaProcess) {
    const child = mediaProcess;
    mediaProcess = null;
    child.kill();
  }
  mediaRestartTimer = setTimeout(() => {
    mediaRestartTimer = null;
    startMediaMonitor();
  }, 180);
}

function startMediaMonitor() {
  if (mediaProcess || app.isQuitting) return;
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'now-playing.ps1')
    : path.join(__dirname, 'scripts', 'now-playing.ps1');
  const child = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-MTA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
    ...mediaPreferenceArguments()
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  mediaProcess = child;

  const armWatchdog = () => {
    if (mediaWatchdogTimer) clearTimeout(mediaWatchdogTimer);
    mediaWatchdogTimer = setTimeout(() => {
      if (mediaProcess !== child || app.isQuitting) return;
      console.warn('Media monitor stopped producing samples; restarting it.');
      child.kill();
    }, 9000);
  };
  armWatchdog();

  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    armWatchdog();
    try {
      const payload = JSON.parse(line);
      publishMediaSources(Array.isArray(payload.sources) ? payload.sources : [], payload.source, payload);
      handleMetadata(payload);
    } catch (error) { console.warn('Bad metadata line:', error.message); }
  });
  child.stderr.on('data', (chunk) => console.warn(String(chunk).trim()));
  child.on('exit', () => {
    if (mediaWatchdogTimer) clearTimeout(mediaWatchdogTimer);
    mediaWatchdogTimer = null;
    if (mediaProcess === child) mediaProcess = null;
    if (!app.isQuitting) mediaRestartTimer = setTimeout(startMediaMonitor, 1200);
  });
}

function mediaControl(action) {
  if (!['previous', 'toggle', 'next'].includes(action)) return Promise.resolve({ ok: false });
  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'media-control.ps1')
    : path.join(__dirname, 'scripts', 'media-control.ps1');
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-MTA', '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath, '-Action', action,
      ...mediaPreferenceArguments(config.preferredMediaSource || lastRawMetadata?.source)
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errorOutput = '';
    const timeout = setTimeout(() => child.kill(), 5000);
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { errorOutput += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: error.message });
    });
    child.on('exit', () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(output.trim()));
      } catch {
        resolve({ ok: false, reason: errorOutput.trim() || 'Media control failed' });
      }
    });
  });
}

async function resolveLyricsFor(raw, key) {
  if (config.lyricsEnabled === false || !raw.durationMs || lastLyricsKey === key) return null;
  lastLyricsKey = key;
  return lyricsResolver.resolve(raw);
}

async function handleMetadata(raw) {
  if (process.env.GP_DEMO_THEME) return;
  const previousRawMetadata = lastRawMetadata;
  const rawKey = `${raw.artist || raw.albumArtist || ''}::${raw.title || ''}::${raw.album || ''}`.toLowerCase();
  const previousKey = previousRawMetadata
    ? `${previousRawMetadata.artist || previousRawMetadata.albumArtist || ''}::${previousRawMetadata.title || ''}::${previousRawMetadata.album || ''}`.toLowerCase()
    : '';
  const changedTrack = Boolean(rawKey && rawKey !== previousKey);
  const seekedWithinTrack = Boolean(
    rawKey
    && rawKey === previousKey
    && hasSignificantPlaybackSeek(previousRawMetadata, raw)
  );
  const artworkChanged = Boolean(raw.artwork && raw.artwork !== previousRawMetadata?.artwork);
  if (rawKey === previousKey && !raw.artwork && previousRawMetadata?.artwork) {
    raw = { ...raw, artwork: previousRawMetadata.artwork };
  }
  const leavingPreviousTrack = Boolean(
    previousRawMetadata?.title
    && (!raw.title || rawKey !== previousKey)
  );
  // A looping player keeps the same track key and reports the position jumping
  // from the end back to zero. Preserve the completed pass before resetting its
  // cumulative evidence for the next play.
  if (leavingPreviousTrack || seekedWithinTrack) {
    persistCurrentAudioGenreMemory({ force: true });
  }
  lastRawMetadata = raw;
  if (changedTrack) {
    temporaryGenreOverride = null;
    lastBaseResolvedMetadata = null;
    lastResolvedMetadata = null;
    resetCurrentAudioGenreEvidence();
    if (audioGenreModel) audioGenreModel.reset(rawKey, audioGenreContext(null));
  } else if (seekedWithinTrack) {
    resetCurrentAudioGenreEvidence();
    if (audioGenreModel) audioGenreModel.reset(rawKey, audioGenreContext(lastBaseResolvedMetadata));
    publishCurrentGenre({ force: true });
  }
  updateIdleWindowPolicy(Boolean(raw.playing));
  persistCurrentAudioGenreMemory();
  if (changedTrack || (!raw.title && previousRawMetadata?.title)) rebuildTrayMenu();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!raw.title) {
    // The Windows media monitor emits the same empty session roughly once per
    // second. Only the first transition out of a real track should rebuild the
    // HUD; subsequent empty samples are ordinary playback ticks so the waiting
    // copy does not replay its entrance animation forever.
    if (!previousRawMetadata?.title) {
      mainWindow.webContents.send('playback-tick', {
        playing: false,
        status: raw.status,
        positionMs: 0,
        durationMs: 0
      });
      return;
    }
    lastTrackKey = '';
    lastLyricsKey = '';
    lastResolvedMetadata = null;
    lastBaseResolvedMetadata = null;
    temporaryGenreOverride = null;
    resetCurrentAudioGenreEvidence({ reloadMemory: false });
    if (audioGenreModel) audioGenreModel.reset('');
    resolutionSerial += 1;
    mainWindow.webContents.send('now-playing', raw);
    return;
  }
  const key = rawKey;
  if (key === lastTrackKey && !artworkChanged) {
      mainWindow.webContents.send('playback-tick', {
        playing: raw.playing,
        status: raw.status,
        positionMs: raw.positionMs,
        durationMs: raw.durationMs,
        playbackRate: raw.playbackRate,
        timelineAgeMs: raw.timelineAgeMs,
        sampledAtMs: raw.sampledAtMs
      });
    if (config.lyricsEnabled !== false && raw.durationMs && lastLyricsKey !== key) {
      resolveLyricsFor(raw, key).then((lyrics) => {
        if (key === lastTrackKey && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('lyrics-update', lyrics);
        }
      });
    }
    return;
  }
  lastTrackKey = key;
  const serial = ++resolutionSerial;
  // Remembered genres resolve locally and synchronously. Keep the current HUD
  // visible while applying them instead of flashing IDENTIFYING between the
  // detected genre and the user's authoritative correction.
  const hasRememberedCorrection = Boolean(getGenreCorrection(genreCorrections, raw));
  const hasBilibiliFallbackHint = resolver.isBilibiliFallbackCandidate(raw);
  if (!hasRememberedCorrection) {
    if (currentAudioGenreMemory) {
      publishCurrentGenre({ force: true });
    } else {
      mainWindow.webContents.send('now-playing', {
        ...raw,
        displayArtist: displayArtistName(raw.artist || raw.albumArtist),
        hardcoreTanoc: isHardcoreTanocArtist(raw.artist || raw.albumArtist),
        resolving: true,
        genre: themeWithId(hasBilibiliFallbackHint ? 'bilibili' : 'unknown')
      });
    }
  }
  const [resolved, lyrics] = await Promise.all([
    resolver.resolve(raw),
    resolveLyricsFor(raw, key)
  ]);
  if (serial !== resolutionSerial || !mainWindow || mainWindow.isDestroyed()) return;
  lastBaseResolvedMetadata = { ...resolved, lyrics };
  audioGenreModel?.setContext(audioGenreContext(lastBaseResolvedMetadata));
  publishCurrentGenre({ force: true });
}

function diagnosticText(value, maxLength = 240) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

function diagnosticSnapshot(rendererState = {}) {
  return {
    generatedAt: new Date().toISOString(),
    app: {
      version: app.getVersion(),
      packaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    system: {
      platform: process.platform,
      release: os.release(),
      version: os.version(),
      arch: process.arch
    },
    settings: {
      language: normalizeLocale(config.language),
      layoutMode: normalizeLayoutMode(config.layoutMode),
      uiScale: normalizeUiScale(config.uiScale),
      motionMode: normalizeMotionMode(config.motionMode),
      idleBehavior: normalizeIdleBehavior(config.idleBehavior),
      frameRateLimit: normalizeFrameRateLimit(config.frameRateLimit),
      idleFrameLimitEnabled: config.idleFrameLimitEnabled !== false,
      showFps: config.showFps === true,
      rhythmModelEnabled: config.rhythmModelEnabled !== false,
      localGenreModelEnabled: config.localGenreModelEnabled !== false,
      audioGenreMemoryEnabled: config.audioGenreMemoryEnabled !== false,
      dynamicGenreDetectionEnabled: config.dynamicGenreDetectionEnabled === true,
      preferredMediaSource: normalizeMediaSource(config.preferredMediaSource),
      ignoredMediaSourceCount: normalizeIgnoredMediaSources(config.ignoredMediaSources).length,
      supplementalArtistRuleCount: normalizeGenreArtistRules(
        config.genreArtistRules,
        Object.keys(THEMES)
      ).length,
      themedBackground: normalizeLayoutMode(config.layoutMode) === 'poster'
        ? config.posterThemedBackground !== false
        : config.capsuleThemedBackground !== false,
      lyricsEnabled: config.lyricsEnabled !== false,
      onlineGenreLookupEnabled: config.onlineGenreLookupEnabled !== false,
      artistGenreReferenceEnabled: config.artistGenreReferenceEnabled !== false
    },
    runtime: {
      windowVisible: Boolean(mainWindow?.isVisible()),
      mediaMonitorRunning: Boolean(mediaProcess),
      availableMediaSources: availableMediaSources.map((source) => diagnosticText(source)),
      currentMediaSource: diagnosticText(lastRawMetadata?.source),
      playbackStatus: diagnosticText(lastRawMetadata?.status),
      hasCurrentTrack: Boolean(lastRawMetadata?.title),
      rhythmModel: {
        type: diagnosticText(rhythmModelState?.type),
        code: diagnosticText(rhythmModelState?.code),
        category: diagnosticText(rhythmModelState?.category),
        causeCode: diagnosticText(rhythmModelState?.causeCode),
        model: diagnosticText(rhythmModelState?.model),
        reason: diagnosticText(rhythmModelState?.reason)
      },
      audioGenreModel: {
        type: diagnosticText(audioGenreModelState?.type),
        code: diagnosticText(audioGenreModelState?.code),
        category: diagnosticText(audioGenreModelState?.category),
        causeCode: diagnosticText(audioGenreModelState?.causeCode),
        genreId: diagnosticText(audioGenreModelState?.genreId),
        currentGenreId: diagnosticText(audioGenreModelState?.currentGenreId),
        stage: diagnosticText(audioGenreModelState?.stage),
        confidence: diagnosticText(audioGenreModelState?.confidence),
        margin: diagnosticText(audioGenreModelState?.margin),
        acceptedWindows: diagnosticText(audioGenreModelState?.acceptedWindows),
        analysisWindowLimit: diagnosticText(audioGenreModelState?.analysisWindowLimit),
        correctionCount: diagnosticText(audioGenreModelState?.correctionCount),
        finalCorrectionCount: diagnosticText(audioGenreModelState?.finalCorrectionCount),
        memoryPriorGenreId: diagnosticText(audioGenreModelState?.memoryPriorGenreId),
        memoryPriorWeight: diagnosticText(audioGenreModelState?.memoryPriorWeight),
        inferenceMs: diagnosticText(audioGenreModelState?.inferenceMs),
        analyzing: shouldAnalyzeCurrentGenreAudio(),
        collectingMemory: shouldCollectCurrentAudioGenreMemory(),
        metadataKind: metadataGenreKind(lastBaseResolvedMetadata),
        reason: diagnosticText(audioGenreModelState?.reason)
      },
      audioCapture: diagnosticText(rendererState.audioStatus),
      genreSource: diagnosticText(rendererState.genreSource || lastResolvedMetadata?.genreSource),
      genreUncertain: Boolean(rendererState.genreUncertain ?? lastResolvedMetadata?.genreUncertain),
      genreUncertainReason: diagnosticText(
        rendererState.genreUncertainReason || lastResolvedMetadata?.genreUncertainReason
      ),
      genreSources: (Array.isArray(rendererState.genreSources)
        ? rendererState.genreSources
        : lastResolvedMetadata?.genreSources || []).map((source) => diagnosticText(source)),
      genreEvidence: (() => {
        const evidence = rendererState.genreEvidence || lastResolvedMetadata?.genreEvidence;
        if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null;
        return Object.fromEntries(Object.entries(evidence)
          .slice(0, 8)
          .map(([key, value]) => [diagnosticText(key, 48), diagnosticText(value, 160)]));
      })(),
      lyricSource: diagnosticText(rendererState.lyricSource || lastResolvedMetadata?.lyrics?.source)
    }
  };
}

async function exportDiagnostics(rendererState = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const options = {
    title: 'Export Genre Police diagnostics',
    defaultPath: `genre-police-diagnostics-${date}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, `${JSON.stringify(diagnosticSnapshot(rendererState), null, 2)}\n`, 'utf8');
  return { ok: true, filePath: result.filePath };
}

async function prepareSnapshot(event) {
  if (!recordingSenderAllowed(event)) return { ok: false, error: 'invalid-sender' };
  const options = {
    title: translate(normalizeLocale(config.language), 'snapshot.saveDialogTitle'),
    defaultPath: `${snapshotFileStem()}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }]
  };
  const result = await dialog.showSaveDialog(mainWindow, options);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const token = randomUUID();
  snapshotSession = { token, filePath: result.filePath };
  return { ok: true, token, filePath: result.filePath };
}

async function captureSnapshot(event, token) {
  if (!recordingSenderAllowed(event)
    || !snapshotSession
    || String(token || '') !== snapshotSession.token) {
    return { ok: false, error: 'invalid-session' };
  }
  const active = snapshotSession;
  snapshotSession = null;
  try {
    const image = await mainWindow.webContents.capturePage();
    if (!image || image.isEmpty()) return { ok: false, error: 'capture-failed' };
    fs.writeFileSync(active.filePath, image.toPNG());
    return { ok: true, filePath: active.filePath };
  } catch (error) {
    console.warn('Could not save visualization snapshot:', error.message);
    return { ok: false, error: 'write-failed' };
  }
}

function genreDataDialogTitle(key) {
  return translate(normalizeLocale(config.language), key);
}

async function exportGenreData() {
  const date = new Date().toISOString().slice(0, 10);
  const options = {
    title: genreDataDialogTitle('genreData.exportDialogTitle'),
    defaultPath: `genre-police-data-${date}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    const payload = createGenreDataExport({
      corrections: genreCorrections,
      customGenres: config.customGenres,
      genreArtistRules: config.genreArtistRules,
      themes: THEMES,
      appVersion: app.getVersion()
    });
    fs.writeFileSync(result.filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return {
      ok: true,
      filePath: result.filePath,
      correctionCount: Object.keys(payload.corrections.tracks).length,
      customGenreCount: payload.customGenres.length,
      genreArtistRuleCount: payload.genreArtistRules.length
    };
  } catch (error) {
    console.warn('Could not export genre data:', error.message);
    return { ok: false, error: 'write-failed' };
  }
}

async function importGenreData() {
  const options = {
    title: genreDataDialogTitle('genreData.importDialogTitle'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  const filePath = result.filePaths?.[0];
  if (result.canceled || !filePath) return { ok: false, canceled: true };

  let payload;
  try {
    if (fs.statSync(filePath).size > MAX_GENRE_DATA_FILE_BYTES) {
      return { ok: false, error: 'too-large' };
    }
    const source = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
    payload = JSON.parse(source);
  } catch (error) {
    console.warn('Could not read genre data:', error.message);
    return { ok: false, error: error instanceof SyntaxError ? 'invalid-json' : 'read-failed' };
  }

  let merged;
  try {
    merged = mergeGenreData({
      payload,
      corrections: genreCorrections,
      customGenres: config.customGenres,
      genreArtistRules: config.genreArtistRules,
      themes: THEMES
    });
  } catch (error) {
    return { ok: false, error: error.code || 'invalid-format' };
  }

  const previousCorrections = genreCorrections;
  const previousCustomGenres = config.customGenres;
  const previousGenreArtistRules = config.genreArtistRules;
  try {
    genreCorrections = merged.corrections;
    config.customGenres = merged.customGenres;
    config.genreArtistRules = merged.genreArtistRules;
    saveGenreCorrections();
    saveConfig({
      customGenres: merged.customGenres,
      genreArtistRules: merged.genreArtistRules
    });
  } catch (error) {
    genreCorrections = previousCorrections;
    config.customGenres = previousCustomGenres;
    config.genreArtistRules = previousGenreArtistRules;
    console.warn('Could not save imported genre data:', error.message);
    return { ok: false, error: 'write-failed' };
  }

  rebuildTrayMenu();
  refreshCurrentGenre();
  return {
    ok: true,
    summary: merged.summary,
    customGenres: merged.customGenres,
    genreArtistRules: merged.genreArtistRules
  };
}

ipcMain.handle('window:close', () => {
  requestAppQuit();
  return { ok: true, recording: Boolean(recordingSession) };
});
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:set-ui-scale', (_event, value) => setUiScale(value));
ipcMain.handle('window:set-layout-mode', (_event, value) => setLayoutMode(value));
ipcMain.handle('window:set-stage-output', (event, value) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false, active: false, error: 'not-allowed' };
  }
  return setStageOutput(value);
});
ipcMain.on('window:settings-visibility', (event, visible) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
  mainSettingsOpen = visible === true;
  updateMainWindowPointerHitTest();
});
ipcMain.handle('media:control', (_event, action) => mediaControl(action));
ipcMain.handle('media:recapture', () => {
  restartAllAudioCapture();
  return { ok: true };
});
ipcMain.handle('recording:prepare', prepareRecording);
ipcMain.handle('recording:append', appendRecordingChunk);
ipcMain.handle('recording:finish', finishRecording);
ipcMain.handle('recording:cancel', cancelRecording);
ipcMain.handle('snapshot:prepare', prepareSnapshot);
ipcMain.handle('snapshot:capture', captureSnapshot);
ipcMain.on('recording-controls:update', (event, payload) => {
  if (!recordingSenderAllowed(event)) return;
  updateRecordingControls(payload);
});
ipcMain.on('recording-controls:command', (event, command) => {
  const allowed = [recordingControlsWindow, recordingTransportWindow]
    .some((overlay) => overlay && !overlay.isDestroyed() && event.sender === overlay.webContents);
  if (!allowed) return;
  if (command === 'stop') sendRecordingCommand('stop');
  if (command === 'close') requestAppQuit();
  if (['previous', 'toggle', 'next'].includes(command)) void mediaControl(command);
});
ipcMain.on('recording-controls:activity', (event, phase) => {
  const allowed = [recordingControlsWindow, recordingTransportWindow]
    .some((overlay) => overlay && !overlay.isDestroyed() && event.sender === overlay.webContents);
  if (!allowed || !['enter', 'leave'].includes(phase)) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('recording-controls:activity', phase);
  }
});
ipcMain.handle('diagnostics:status', () => ({
  audioGenreModelState,
  audioGenreAnalyzing: shouldAnalyzeCurrentGenreAudio()
}));
ipcMain.on('diagnostics:render-performance', (event, payload) => {
  if (!process.argv.includes('--dev')
    || !mainWindow
    || mainWindow.isDestroyed()
    || event.sender !== mainWindow.webContents) return;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : 'n/a';
  const theme = String(payload?.theme || 'unknown').replace(/[^a-z0-9-]/gi, '').slice(0, 48);
  console.log(
    `[render-perf] theme=${theme} fps=${number(payload?.fps)}`
      + ` mode=${payload?.fullscreen === true ? 'fullscreen' : 'desktop'}`
      + ` scale=${number(payload?.resolutionScale)}`
      + ` frame-p95=${number(payload?.frameP95)}ms`
      + ` render-avg=${number(payload?.renderAverage)}ms`
      + ` render-p95=${number(payload?.renderP95)}ms`
      + ` work-p95=${number(payload?.workP95)}ms`
      + ` canvas=${Math.round(Number(payload?.pixelWidth) || 0)}x${Math.round(Number(payload?.pixelHeight) || 0)}`
  );
});
ipcMain.handle('diagnostics:export', (_event, rendererState) => exportDiagnostics(rendererState));
ipcMain.handle('genre-data:export', () => exportGenreData());
ipcMain.handle('genre-data:import', () => importGenreData());
ipcMain.handle('update:check', (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return updateStatus('error');
  }
  return checkForUpdates({ manual: true });
});
ipcMain.handle('update:dismiss', (event, version) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false };
  }
  return dismissUpdate(version);
});
ipcMain.handle('update:open-release', (event, url) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false };
  }
  return openUpdatePage(url);
});
ipcMain.handle('support:open-vc-runtime', async (event) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return { ok: false };
  }
  await shell.openExternal(VC_RUNTIME_DOWNLOAD_URL);
  return { ok: true };
});
ipcMain.handle('artwork:face-palette', async (_event, payload) => {
  try {
    const sample = await sampleArtwork(payload?.url);
    return chooseArtworkFacePalette(sample, payload?.theme || {});
  } catch (error) {
    console.warn('Artwork face palette failed:', error.message);
    return null;
  }
});
ipcMain.handle('config:get', () => ({
  appVersion: app.getVersion(),
  lastFmApiKey: config.lastFmApiKey || '',
  discogsToken: config.discogsToken || '',
  lyricsEnabled: config.lyricsEnabled !== false,
  lyricTranslationEnabled: config.lyricTranslationEnabled !== false,
  capsuleCondensedEnglish: config.capsuleCondensedEnglish === true,
  posterCondensedEnglish: config.posterCondensedEnglish !== false,
  fullscreenCondensedEnglish: config.fullscreenCondensedEnglish === true,
  posterThemedBackground: config.posterThemedBackground !== false,
  capsuleThemedBackground: config.capsuleThemedBackground !== false,
  lyricSweepEnabled: config.lyricSweepEnabled !== false,
  lyricDelayMs: normalizeLyricDelayMs(config.lyricDelayMs),
  onlineGenreLookupEnabled: config.onlineGenreLookupEnabled !== false,
  artistGenreReferenceEnabled: config.artistGenreReferenceEnabled !== false,
  launchAtLogin: config.launchAtLogin === true,
  launchAtLoginSupported: launchAtLoginSupported(),
  motionMode: normalizeMotionMode(config.motionMode),
  visualResponseMode: normalizeVisualResponseMode(config.visualResponseMode),
  audioSourceId: normalizeAudioSourceId(config.audioSourceId),
  idleBehavior: normalizeIdleBehavior(config.idleBehavior),
  frameRateLimit: normalizeFrameRateLimit(config.frameRateLimit),
  idleFrameLimitEnabled: config.idleFrameLimitEnabled !== false,
  showFps: config.showFps === true,
  rhythmModelEnabled: config.rhythmModelEnabled !== false,
  localGenreModelEnabled: config.localGenreModelEnabled !== false,
  audioGenreMemoryEnabled: config.audioGenreMemoryEnabled !== false,
  audioGenreMemoryCount: Object.keys(audioGenreMemories.entries || {}).length,
  dynamicGenreDetectionEnabled: config.dynamicGenreDetectionEnabled === true,
  localGenreModelAvailable: localGenreModelAvailable(),
  recordingQuickButtonVisible: config.recordingQuickButtonVisible === true,
  snapshotQuickButtonVisible: config.snapshotQuickButtonVisible === true,
  stageOutputTextVisible: config.stageOutputTextVisible !== false,
  fullscreenLayoutMode: config.fullscreenLayoutMode === 'stacked' ? 'stacked' : 'split',
  preferredMediaSource: normalizeMediaSource(config.preferredMediaSource),
  ignoredMediaSources: normalizeIgnoredMediaSources(config.ignoredMediaSources),
  availableMediaSources,
  detectedPlayers: detectedMediaPlayers,
  customGenres: normalizeCustomGenreRules(config.customGenres, Object.keys(THEMES)),
  genreArtistRules: normalizeGenreArtistRules(config.genreArtistRules, Object.keys(THEMES)),
  currentMediaSource: normalizeMediaSource(lastRawMetadata?.source),
  rhythmModelState,
  audioGenreModelState,
  language: normalizeLocale(config.language),
  uiScale: normalizeUiScale(config.uiScale),
  layoutMode: normalizeLayoutMode(config.layoutMode),
  stageOutputActive,
  clickThrough,
  alwaysOnTop,
  desktopLayer: desktopLayerEnabled,
  desktopLayerAttached,
  desktopLayerAvailable: desktopLayerAvailable(),
  desktopLayerError: desktopLayerLastError,
  genreOptions: Object.entries(THEMES)
    .filter(([id]) => !['edm', 'unknown'].includes(id))
    .map(([id, theme]) => ({
      id,
      label: theme.label,
      parent: theme.parent,
      accent: theme.accent,
      accent2: theme.accent2,
      hot: theme.hot
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}));
ipcMain.handle('config:set', async (_event, patch) => {
  const safe = {};
  if (typeof patch?.lastFmApiKey === 'string') safe.lastFmApiKey = patch.lastFmApiKey.trim();
  if (typeof patch?.discogsToken === 'string') safe.discogsToken = patch.discogsToken.trim();
  if (typeof patch?.lyricsEnabled === 'boolean') safe.lyricsEnabled = patch.lyricsEnabled;
  if (typeof patch?.lyricTranslationEnabled === 'boolean') safe.lyricTranslationEnabled = patch.lyricTranslationEnabled;
  if (typeof patch?.capsuleCondensedEnglish === 'boolean') safe.capsuleCondensedEnglish = patch.capsuleCondensedEnglish;
  if (typeof patch?.posterCondensedEnglish === 'boolean') safe.posterCondensedEnglish = patch.posterCondensedEnglish;
  if (typeof patch?.fullscreenCondensedEnglish === 'boolean') safe.fullscreenCondensedEnglish = patch.fullscreenCondensedEnglish;
  if (typeof patch?.posterThemedBackground === 'boolean') safe.posterThemedBackground = patch.posterThemedBackground;
  if (typeof patch?.capsuleThemedBackground === 'boolean') safe.capsuleThemedBackground = patch.capsuleThemedBackground;
  if (typeof patch?.lyricSweepEnabled === 'boolean') safe.lyricSweepEnabled = patch.lyricSweepEnabled;
  if (typeof patch?.onlineGenreLookupEnabled === 'boolean') safe.onlineGenreLookupEnabled = patch.onlineGenreLookupEnabled;
  if (typeof patch?.artistGenreReferenceEnabled === 'boolean') {
    safe.artistGenreReferenceEnabled = patch.artistGenreReferenceEnabled;
  }
  if (typeof patch?.launchAtLogin === 'boolean') safe.launchAtLogin = patch.launchAtLogin;
  if (typeof patch?.alwaysOnTop === 'boolean') safe.alwaysOnTop = normalizeAlwaysOnTop(patch.alwaysOnTop);
  if (typeof patch?.desktopLayer === 'boolean') safe.desktopLayer = normalizeDesktopLayer(patch.desktopLayer);
  if (typeof patch?.clickThrough === 'boolean') safe.clickThrough = normalizeClickThrough(patch.clickThrough);
  if (typeof patch?.motionMode === 'string') safe.motionMode = normalizeMotionMode(patch.motionMode);
  if (typeof patch?.visualResponseMode === 'string') {
    safe.visualResponseMode = normalizeVisualResponseMode(patch.visualResponseMode);
  }
  if (typeof patch?.audioSourceId === 'string') safe.audioSourceId = normalizeAudioSourceId(patch.audioSourceId);
  if (typeof patch?.idleBehavior === 'string') safe.idleBehavior = normalizeIdleBehavior(patch.idleBehavior);
  if (typeof patch?.frameRateLimit === 'string' || typeof patch?.frameRateLimit === 'number') {
    safe.frameRateLimit = normalizeFrameRateLimit(patch.frameRateLimit);
  }
  if (typeof patch?.idleFrameLimitEnabled === 'boolean') safe.idleFrameLimitEnabled = patch.idleFrameLimitEnabled;
  if (typeof patch?.showFps === 'boolean') safe.showFps = patch.showFps;
  if (typeof patch?.rhythmModelEnabled === 'boolean') safe.rhythmModelEnabled = patch.rhythmModelEnabled;
  if (typeof patch?.localGenreModelEnabled === 'boolean') safe.localGenreModelEnabled = patch.localGenreModelEnabled;
  if (typeof patch?.audioGenreMemoryEnabled === 'boolean') {
    safe.audioGenreMemoryEnabled = patch.audioGenreMemoryEnabled;
  }
  if (typeof patch?.dynamicGenreDetectionEnabled === 'boolean') {
    safe.dynamicGenreDetectionEnabled = patch.dynamicGenreDetectionEnabled;
  }
  const nextLocalGenreModelEnabled = Object.hasOwn(safe, 'localGenreModelEnabled')
    ? safe.localGenreModelEnabled
    : config.localGenreModelEnabled !== false;
  if (!nextLocalGenreModelEnabled) safe.dynamicGenreDetectionEnabled = false;
  if (typeof patch?.recordingQuickButtonVisible === 'boolean') safe.recordingQuickButtonVisible = patch.recordingQuickButtonVisible;
  if (typeof patch?.snapshotQuickButtonVisible === 'boolean') safe.snapshotQuickButtonVisible = patch.snapshotQuickButtonVisible;
  if (typeof patch?.stageOutputTextVisible === 'boolean') safe.stageOutputTextVisible = patch.stageOutputTextVisible;
  if (typeof patch?.fullscreenLayoutMode === 'string') {
    safe.fullscreenLayoutMode = patch.fullscreenLayoutMode === 'stacked' ? 'stacked' : 'split';
  }
  if (typeof patch?.preferredMediaSource === 'string') safe.preferredMediaSource = normalizeMediaSource(patch.preferredMediaSource);
  if (Array.isArray(patch?.ignoredMediaSources)) safe.ignoredMediaSources = normalizeIgnoredMediaSources(patch.ignoredMediaSources);
  if (Object.hasOwn(patch || {}, 'lyricDelayMs')) safe.lyricDelayMs = normalizeLyricDelayMs(patch.lyricDelayMs);
  if (typeof patch?.language === 'string') safe.language = normalizeLocale(patch.language);
  if (Array.isArray(patch?.customGenres)) {
    safe.customGenres = normalizeCustomGenreRules(patch.customGenres, Object.keys(THEMES));
  }
  if (Array.isArray(patch?.genreArtistRules)) {
    safe.genreArtistRules = normalizeGenreArtistRules(patch.genreArtistRules, Object.keys(THEMES));
  }
  if (safe.desktopLayer === true) safe.alwaysOnTop = false;
  else if (safe.alwaysOnTop === true) safe.desktopLayer = false;
  const genreSourcesChanged = (Object.hasOwn(safe, 'lastFmApiKey')
      && safe.lastFmApiKey !== (config.lastFmApiKey || ''))
    || (Object.hasOwn(safe, 'discogsToken')
      && safe.discogsToken !== (config.discogsToken || ''))
    || (Object.hasOwn(safe, 'onlineGenreLookupEnabled')
      && safe.onlineGenreLookupEnabled !== (config.onlineGenreLookupEnabled !== false))
    || (Object.hasOwn(safe, 'artistGenreReferenceEnabled')
      && safe.artistGenreReferenceEnabled !== (config.artistGenreReferenceEnabled !== false))
    || (Object.hasOwn(safe, 'customGenres')
      && JSON.stringify(safe.customGenres) !== JSON.stringify(config.customGenres || []))
    || (Object.hasOwn(safe, 'genreArtistRules')
      && JSON.stringify(safe.genreArtistRules) !== JSON.stringify(config.genreArtistRules || []));
  const lyricsSettingChanged = Object.hasOwn(safe, 'lyricsEnabled')
    && safe.lyricsEnabled !== (config.lyricsEnabled !== false);
  const backgroundSettingChanged = Object.hasOwn(safe, 'posterThemedBackground')
    || Object.hasOwn(safe, 'capsuleThemedBackground');
  const mediaPreferenceChanged = Object.hasOwn(safe, 'preferredMediaSource')
    || Object.hasOwn(safe, 'ignoredMediaSources');
  const dynamicGenreSettingChanged = Object.hasOwn(safe, 'dynamicGenreDetectionEnabled')
    && safe.dynamicGenreDetectionEnabled !== (config.dynamicGenreDetectionEnabled === true);
  const audioGenreMemorySettingChanged = Object.hasOwn(safe, 'audioGenreMemoryEnabled')
    && safe.audioGenreMemoryEnabled !== (config.audioGenreMemoryEnabled !== false);
  saveConfig(safe);
  if (Object.hasOwn(safe, 'desktopLayer')) await setDesktopLayer(safe.desktopLayer, { persist: false });
  if (Object.hasOwn(safe, 'alwaysOnTop')) await setAlwaysOnTop(safe.alwaysOnTop, { persist: false });
  if (Object.hasOwn(safe, 'desktopLayer') || Object.hasOwn(safe, 'alwaysOnTop')) {
    saveConfig({ desktopLayer: desktopLayerEnabled, alwaysOnTop });
  }
  if (Object.hasOwn(safe, 'clickThrough')) setClickThrough(safe.clickThrough, { persist: false });
  if (Object.hasOwn(safe, 'rhythmModelEnabled')) await setRhythmModelEnabled(safe.rhythmModelEnabled);
  if (Object.hasOwn(safe, 'localGenreModelEnabled')) {
    await setAudioGenreModelEnabled(safe.localGenreModelEnabled);
  }
  if (audioGenreMemorySettingChanged) {
    resetAudioGenreForCurrentTrack();
    publishCurrentGenre({ force: true });
  }
  if (dynamicGenreSettingChanged && audioGenreModel) {
    audioGenreModel.setContext(audioGenreContext());
    const baseGenreKind = metadataGenreKind(lastBaseResolvedMetadata);
    const decisionRequiresDynamicMode = currentAudioGenreDecision?.stage === 'dynamic'
      || (baseGenreKind === 'specific' && Boolean(currentAudioGenreDecision?.genreId))
      || Boolean(currentAudioGenreMemory && currentAudioGenreDecision?.genreId);
    if (!safe.dynamicGenreDetectionEnabled && decisionRequiresDynamicMode) {
      resetAudioGenreForCurrentTrack();
      publishCurrentGenre({ force: true });
    }
  }
  if (Object.hasOwn(safe, 'launchAtLogin')) {
    safe.launchAtLogin = applyLaunchAtLogin(safe.launchAtLogin);
    saveConfig({ launchAtLogin: safe.launchAtLogin });
  }
  if (Object.hasOwn(safe, 'language')) rebuildTrayMenu();
  if (Object.hasOwn(safe, 'idleBehavior')) updateIdleWindowPolicy(Boolean(lastRawMetadata?.playing));
  if (mediaPreferenceChanged) {
    publishMediaSources(availableMediaSources);
    restartMediaMonitor();
  }
  if (backgroundSettingChanged) {
    if (usesAdaptiveBackdrop()) startBackdropSampler();
    else stopBackdropSampler();
  }
  if (genreSourcesChanged) {
    if (safe.onlineGenreLookupEnabled !== false) refreshNetworkCountry();
    resolver.clear();
    lastTrackKey = '';
    if (lastRawMetadata) handleMetadata(lastRawMetadata);
  }
  if (lyricsSettingChanged) {
    lyricsResolver.clear();
    lastLyricsKey = '';
    if (safe.lyricsEnabled && lastRawMetadata?.title && lastRawMetadata.durationMs) {
      const key = `${lastRawMetadata.artist || lastRawMetadata.albumArtist || ''}::${lastRawMetadata.title || ''}::${lastRawMetadata.album || ''}`.toLowerCase();
      resolveLyricsFor(lastRawMetadata, key).then((lyrics) => {
        if (key === lastTrackKey && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('lyrics-update', lyrics);
        }
      });
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lyrics-update', null);
    }
  }
  return {
    ok: true,
    launchAtLogin: config.launchAtLogin === true,
    launchAtLoginSupported: launchAtLoginSupported(),
    alwaysOnTop,
    desktopLayer: desktopLayerEnabled,
    desktopLayerAttached,
    desktopLayerAvailable: desktopLayerAvailable(),
    desktopLayerError: desktopLayerLastError,
    clickThrough,
    rhythmModelEnabled: config.rhythmModelEnabled !== false,
    localGenreModelEnabled: config.localGenreModelEnabled !== false,
    audioGenreMemoryEnabled: config.audioGenreMemoryEnabled !== false,
    audioGenreMemoryCount: Object.keys(audioGenreMemories.entries || {}).length,
    dynamicGenreDetectionEnabled: config.dynamicGenreDetectionEnabled === true,
    artistGenreReferenceEnabled: config.artistGenreReferenceEnabled !== false,
    localGenreModelAvailable: localGenreModelAvailable(),
    audioGenreModelState,
    recordingQuickButtonVisible: config.recordingQuickButtonVisible === true,
    snapshotQuickButtonVisible: config.snapshotQuickButtonVisible === true,
    stageOutputTextVisible: config.stageOutputTextVisible !== false,
    fullscreenLayoutMode: config.fullscreenLayoutMode === 'stacked' ? 'stacked' : 'split',
    customGenres: normalizeCustomGenreRules(config.customGenres, Object.keys(THEMES)),
    genreArtistRules: normalizeGenreArtistRules(config.genreArtistRules, Object.keys(THEMES))
  };
});
ipcMain.handle('genre-correction:set', (_event, genreId) => rememberCurrentGenre(genreId));
ipcMain.handle('genre-correction:clear', () => forgetCurrentGenre());
ipcMain.handle('audio-genre-memory:clear', () => clearAudioGenreMemories());
ipcMain.handle('genre-candidates:get', () => currentGenreCandidates());
ipcMain.handle('genre-temporary:set', (_event, genreId) => setTemporaryGenre(genreId));
ipcMain.handle('genre-temporary:clear', () => clearTemporaryGenre());
ipcMain.handle('demo:set', (_event, id) => setDemoTheme(id));
ipcMain.on('audio:output-device-changed', () => {
  restartRhythmModelForOutputDevice();
});
ipcMain.on('rhythm-model:audio', (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || !rhythmModel) return;
  const samples = payload instanceof Float32Array
    ? payload
    : ArrayBuffer.isView(payload)
      ? new Float32Array(payload.buffer, payload.byteOffset, payload.byteLength / Float32Array.BYTES_PER_ELEMENT)
      : null;
  if (samples?.length === HOP_SIZE) rhythmModel.ingest(samples);
});
ipcMain.on('audio-genre-model:audio', (event, payload) => {
  if (!mainWindow
    || event.sender !== mainWindow.webContents
    || !audioGenreModel
    || (!shouldAnalyzeCurrentGenreAudio() && !shouldCollectCurrentAudioGenreMemory())) return;
  const samples = payload instanceof Float32Array
    ? payload
    : ArrayBuffer.isView(payload)
      ? new Float32Array(payload.buffer, payload.byteOffset, payload.byteLength / Float32Array.BYTES_PER_ELEMENT)
      : null;
  if (samples?.length === 1600) audioGenreModel.ingest(samples);
});

app.whenReady().then(() => {
  loadConfig();
  refreshNetworkCountry();
  if (config.launchAtLogin) config.launchAtLogin = applyLaunchAtLogin(true);
  loadGenreCorrections();
  loadAudioGenreMemories();
  removeLegacyUnmappedArtistLog();
  setupAudioCapture();
  createWindow();
  createTray();
  startMediaMonitor();
  startRhythmModel();
  startAudioGenreModel();
  globalShortcut.register('CommandOrControl+Shift+G', () => setClickThrough(!clickThrough));
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    sendRecordingCommand(recordingSession ? 'stop' : 'start');
  });
  globalShortcut.register('CommandOrControl+Shift+O', () => setStageOutput(!stageOutputActive));
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopMainWindowPointerHitTest();
  persistCurrentAudioGenreMemory({ force: true });
  closeRecordingFile();
  clearIdleHideTimer();
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = null;
  if (updateCheckTimer) clearTimeout(updateCheckTimer);
  updateCheckTimer = null;
  if (desktopLayerMonitor) clearInterval(desktopLayerMonitor);
  desktopLayerMonitor = null;
  saveWindowPositionNow();
  globalShortcut.unregisterAll();
  if (mediaWatchdogTimer) clearTimeout(mediaWatchdogTimer);
  if (mediaRestartTimer) clearTimeout(mediaRestartTimer);
  if (mediaProcess) mediaProcess.kill();
  if (rhythmModel) void rhythmModel.close();
  if (audioGenreModel) void audioGenreModel.close();
  if (backdropTimer) clearInterval(backdropTimer);
});

app.on('window-all-closed', (event) => event.preventDefault());
