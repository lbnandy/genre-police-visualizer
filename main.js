'use strict';

const { app, BrowserWindow, Menu, Tray, ipcMain, session, desktopCapturer, screen, nativeImage, globalShortcut, net, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { GenreResolver } = require('./src/genre-resolver');
const { LyricsResolver } = require('./src/lyrics-resolver');
const { THEMES, DEMO_THEME_IDS, themeFor } = require('./src/themes');
const { analyzeBackdropBitmap, deriveBackdropProfile, smoothBackdropSample } = require('./src/backdrop-analyzer');
const { analyzeArtworkBitmap, chooseArtworkFacePalette } = require('./src/artwork-face-palette');
const {
  normalizeAlwaysOnTop,
  normalizeClickThrough,
  normalizeIdleBehavior,
  normalizeIgnoredMediaSources,
  normalizeMediaSource,
  normalizeMotionMode,
  sanitizeStoredConfig
} = require('./src/config-sanitizer');
const { resolveWindowBounds } = require('./src/window-position');
const { isHardcoreTanocArtist } = require('./src/hardcore-tanoc');
const { displayArtistName } = require('./src/genre-classifier');
const { normalizeLocale, resolveInitialLocale, translate } = require('./src/i18n');
const { buildPreviewTree } = require('./src/preview-menu');
const { normalizeLayoutMode, layoutWindowSize } = require('./src/layout-mode');
const { UI_SCALES, normalizeUiScale, uiScaleLabel } = require('./src/ui-scale');
const { HOP_SIZE, LocalRhythmModel } = require('./src/rhythm-model-runtime');
const {
  customGenreCorrectionId,
  findCustomGenreByCorrectionId,
  normalizeCustomGenreRules
} = require('./src/custom-genres');
const { normalizeGenreArtistRules } = require('./src/genre-artist-rules');
const { createGenreDataExport, mergeGenreData } = require('./src/genre-data-transfer');
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
let clickThrough = false;
let alwaysOnTop = false;
let demoTheme = '';
let lastRawMetadata = null;
let lastResolvedMetadata = null;
let lastTrackKey = '';
let resolutionSerial = 0;
let lastLyricsKey = '';
let config = {};
let genreCorrections = createGenreCorrections();
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
let networkCountry = '';
let networkCountryTask = null;

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
  clickThrough = normalizeClickThrough(config.clickThrough);
  alwaysOnTop = normalizeAlwaysOnTop(config.alwaysOnTop);
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
  config.posterThemedBackground = config.posterThemedBackground !== false;
  config.capsuleThemedBackground = config.capsuleThemedBackground !== false;
  config.onlineGenreLookupEnabled = config.onlineGenreLookupEnabled !== false;
  config.launchAtLogin = config.launchAtLogin === true;
  config.motionMode = normalizeMotionMode(config.motionMode);
  config.idleBehavior = normalizeIdleBehavior(config.idleBehavior);
  config.idleFrameLimitEnabled = config.idleFrameLimitEnabled !== false;
  config.rhythmModelEnabled = config.rhythmModelEnabled !== false;
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
  if (sanitized.changed || customGenresSanitized || genreArtistRulesSanitized || uiScaleMigrated
    || languageInitialized || (storedLayoutMode && storedLayoutMode !== config.layoutMode)) saveConfig();
}

function saveConfig(patch = {}) {
  config = { ...config, ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
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

function rememberCurrentGenre(genreId) {
  const cleanId = String(genreId || '').trim();
  const theme = THEMES[cleanId];
  const customRule = findCustomGenreByCorrectionId(config.customGenres, cleanId);
  if (!lastRawMetadata?.title) return { ok: false, error: 'no-track' };
  if ((!theme || cleanId === 'unknown') && !customRule) return { ok: false, error: 'invalid-genre' };
  const correctionGenre = customRule
    ? {
      id: customGenreCorrectionId(customRule.id),
      label: customRule.name.toLocaleUpperCase(),
      customGenreId: customRule.id,
      baseGenreId: customRule.baseGenreId,
      colors: customRule.colors
    }
    : { id: cleanId, label: theme.label };
  const updated = setGenreCorrection(genreCorrections, lastRawMetadata, correctionGenre);
  if (!updated.changed) return { ok: false, error: 'invalid-track' };
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

function openGenreCorrection() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showMainWindow();
  setClickThrough(false);
  mainWindow.webContents.send('genre-correction:open');
}

function openSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  showMainWindow();
  setClickThrough(false);
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
  if (persist) saveConfig({ clickThrough });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
    mainWindow.webContents.send('interaction-state', { clickThrough });
  }
  rebuildTrayMenu();
}

function setAlwaysOnTop(value, { persist = true } = {}) {
  alwaysOnTop = normalizeAlwaysOnTop(value);
  if (persist) saveConfig({ alwaysOnTop });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
  }
  return alwaysOnTop;
}

function setUiScale(value) {
  const uiScale = normalizeUiScale(value);
  saveConfig({ uiScale });
  if (mainWindow && !mainWindow.isDestroyed()) {
    resizeMainWindow(layoutWindowSize(config.layoutMode, uiScale));
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
    resizeMainWindow(
      layoutWindowSize(layoutMode, normalizeUiScale(config.uiScale)),
      { animate: false }
    );
    mainWindow.webContents.send('layout-mode', { mode: layoutMode });
  }
  if (usesAdaptiveBackdrop(layoutMode)) startBackdropSampler();
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
    { label: tr('tray.showHide'), click: toggleMainWindowVisibility },
    { label: tr('tray.settings'), click: openSettings },
    {
      label: tr('tray.clickThrough'), type: 'checkbox', checked: clickThrough,
      accelerator: 'CommandOrControl+Shift+G', registerAccelerator: false,
      click: (item) => setClickThrough(item.checked)
    },
    { type: 'separator' },
    {
      label: tr('tray.genre'),
      submenu: [
        { label: tr('tray.correctGenre'), enabled: hasCurrentTrack, click: openGenreCorrection },
        { label: tr('tray.clearCorrection'), enabled: hasCorrection, click: forgetCurrentGenre },
        { label: tr('tray.refreshGenre'), enabled: hasCurrentTrack, click: refreshCurrentGenre }
      ]
    },
    {
      label: tr('tray.scale'), submenu: UI_SCALES.map((scale) => ({
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
        ...previewTree.flatMap((group) => group.label === 'GENRE POLICE'
          ? group.children.map(previewNode)
          : [{ label: group.label, submenu: group.children.map(previewNode) }])
      ]
    },
    { label: tr('tray.recaptureAudio'), click: restartAllAudioCapture },
    { type: 'separator' },
    { label: tr('tray.quit'), click: () => app.quit() }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Genre Police Visualizer');
  tray.on('double-click', () => {
    showMainWindow();
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
  if (!mainWindow || mainWindow.isDestroyed() || process.env.GP_CAPTURE_PATH) return;
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
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
  mainWindow.on('move', scheduleWindowPositionSave);
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
    mainWindow.webContents.send('ui-scale', { scale: normalizeUiScale(config.uiScale) });
    mainWindow.webContents.send('layout-mode', { mode: normalizeLayoutMode(config.layoutMode) });
    mainWindow.webContents.send('rhythm-model', rhythmModelState);
    startBackdropSampler();
    if (process.env.GP_DEMO_THEME) {
      setDemoTheme(process.env.GP_DEMO_THEME);
      setTimeout(() => setDemoTheme(process.env.GP_DEMO_THEME), 320);
    }
    if (process.env.GP_CAPTURE_SETTINGS || process.env.GP_CAPTURE_SCALE_MENU
      || process.env.GP_CAPTURE_MEDIA_MENU || process.env.GP_CAPTURE_CUSTOM_GENRES
      || process.env.GP_CAPTURE_GENRE_ARTISTS
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
    if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
    windowPositionSaveTimer = null;
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function setupAudioCapture() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } });
      callback({ video: sources[0], audio: 'loopback' });
    } catch (error) {
      console.error('Audio capture failed:', error);
      callback({});
    }
  });
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

function mediaPreferenceArguments() {
  const args = [];
  if (config.preferredMediaSource) args.push('-PreferredSource', config.preferredMediaSource);
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
      '-File', scriptPath, '-Action', action, ...mediaPreferenceArguments()
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
  const artworkChanged = Boolean(raw.artwork && raw.artwork !== previousRawMetadata?.artwork);
  if (rawKey === previousKey && !raw.artwork && previousRawMetadata?.artwork) {
    raw = { ...raw, artwork: previousRawMetadata.artwork };
  }
  lastRawMetadata = raw;
  updateIdleWindowPolicy(Boolean(raw.playing));
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
    mainWindow.webContents.send('now-playing', {
      ...raw,
      displayArtist: displayArtistName(raw.artist || raw.albumArtist),
      hardcoreTanoc: isHardcoreTanocArtist(raw.artist || raw.albumArtist),
      resolving: true,
      genre: themeFor(hasBilibiliFallbackHint ? 'bilibili' : 'unknown')
    });
  }
  const [resolved, lyrics] = await Promise.all([
    resolver.resolve(raw),
    resolveLyricsFor(raw, key)
  ]);
  if (serial !== resolutionSerial || !mainWindow || mainWindow.isDestroyed()) return;
  lastResolvedMetadata = { ...resolved, lyrics };
  mainWindow.webContents.send('now-playing', {
    ...resolved,
    displayArtist: displayArtistName(resolved.artist || resolved.albumArtist || raw.artist || raw.albumArtist),
    hardcoreTanoc: isHardcoreTanocArtist(resolved.artist || resolved.albumArtist || raw.artist || raw.albumArtist),
    lyrics
  });
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
      arch: process.arch
    },
    settings: {
      language: normalizeLocale(config.language),
      layoutMode: normalizeLayoutMode(config.layoutMode),
      uiScale: normalizeUiScale(config.uiScale),
      motionMode: normalizeMotionMode(config.motionMode),
      idleBehavior: normalizeIdleBehavior(config.idleBehavior),
      idleFrameLimitEnabled: config.idleFrameLimitEnabled !== false,
      rhythmModelEnabled: config.rhythmModelEnabled !== false,
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
      onlineGenreLookupEnabled: config.onlineGenreLookupEnabled !== false
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
        model: diagnosticText(rhythmModelState?.model),
        reason: diagnosticText(rhythmModelState?.reason)
      },
      audioCapture: diagnosticText(rendererState.audioStatus),
      genreSource: diagnosticText(rendererState.genreSource || lastResolvedMetadata?.genreSource),
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

ipcMain.handle('window:close', () => app.quit());
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:set-ui-scale', (_event, value) => setUiScale(value));
ipcMain.handle('window:set-layout-mode', (_event, value) => setLayoutMode(value));
ipcMain.handle('media:control', (_event, action) => mediaControl(action));
ipcMain.handle('media:recapture', () => {
  restartAllAudioCapture();
  return { ok: true };
});
ipcMain.handle('diagnostics:export', (_event, rendererState) => exportDiagnostics(rendererState));
ipcMain.handle('genre-data:export', () => exportGenreData());
ipcMain.handle('genre-data:import', () => importGenreData());
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
  posterThemedBackground: config.posterThemedBackground !== false,
  capsuleThemedBackground: config.capsuleThemedBackground !== false,
  lyricSweepEnabled: config.lyricSweepEnabled !== false,
  lyricDelayMs: normalizeLyricDelayMs(config.lyricDelayMs),
  onlineGenreLookupEnabled: config.onlineGenreLookupEnabled !== false,
  launchAtLogin: config.launchAtLogin === true,
  launchAtLoginSupported: launchAtLoginSupported(),
  motionMode: normalizeMotionMode(config.motionMode),
  idleBehavior: normalizeIdleBehavior(config.idleBehavior),
  idleFrameLimitEnabled: config.idleFrameLimitEnabled !== false,
  rhythmModelEnabled: config.rhythmModelEnabled !== false,
  preferredMediaSource: normalizeMediaSource(config.preferredMediaSource),
  ignoredMediaSources: normalizeIgnoredMediaSources(config.ignoredMediaSources),
  availableMediaSources,
  detectedPlayers: detectedMediaPlayers,
  customGenres: normalizeCustomGenreRules(config.customGenres, Object.keys(THEMES)),
  genreArtistRules: normalizeGenreArtistRules(config.genreArtistRules, Object.keys(THEMES)),
  currentMediaSource: normalizeMediaSource(lastRawMetadata?.source),
  rhythmModelState,
  language: normalizeLocale(config.language),
  uiScale: normalizeUiScale(config.uiScale),
  layoutMode: normalizeLayoutMode(config.layoutMode),
  clickThrough,
  alwaysOnTop,
  genreOptions: Object.entries(THEMES)
    .filter(([id]) => id !== 'unknown')
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
  if (typeof patch?.posterThemedBackground === 'boolean') safe.posterThemedBackground = patch.posterThemedBackground;
  if (typeof patch?.capsuleThemedBackground === 'boolean') safe.capsuleThemedBackground = patch.capsuleThemedBackground;
  if (typeof patch?.lyricSweepEnabled === 'boolean') safe.lyricSweepEnabled = patch.lyricSweepEnabled;
  if (typeof patch?.onlineGenreLookupEnabled === 'boolean') safe.onlineGenreLookupEnabled = patch.onlineGenreLookupEnabled;
  if (typeof patch?.launchAtLogin === 'boolean') safe.launchAtLogin = patch.launchAtLogin;
  if (typeof patch?.alwaysOnTop === 'boolean') safe.alwaysOnTop = normalizeAlwaysOnTop(patch.alwaysOnTop);
  if (typeof patch?.clickThrough === 'boolean') safe.clickThrough = normalizeClickThrough(patch.clickThrough);
  if (typeof patch?.motionMode === 'string') safe.motionMode = normalizeMotionMode(patch.motionMode);
  if (typeof patch?.idleBehavior === 'string') safe.idleBehavior = normalizeIdleBehavior(patch.idleBehavior);
  if (typeof patch?.idleFrameLimitEnabled === 'boolean') safe.idleFrameLimitEnabled = patch.idleFrameLimitEnabled;
  if (typeof patch?.rhythmModelEnabled === 'boolean') safe.rhythmModelEnabled = patch.rhythmModelEnabled;
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
  const genreSourcesChanged = (Object.hasOwn(safe, 'lastFmApiKey')
      && safe.lastFmApiKey !== (config.lastFmApiKey || ''))
    || (Object.hasOwn(safe, 'discogsToken')
      && safe.discogsToken !== (config.discogsToken || ''))
    || (Object.hasOwn(safe, 'onlineGenreLookupEnabled')
      && safe.onlineGenreLookupEnabled !== (config.onlineGenreLookupEnabled !== false))
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
  saveConfig(safe);
  if (Object.hasOwn(safe, 'alwaysOnTop')) setAlwaysOnTop(safe.alwaysOnTop, { persist: false });
  if (Object.hasOwn(safe, 'clickThrough')) setClickThrough(safe.clickThrough, { persist: false });
  if (Object.hasOwn(safe, 'rhythmModelEnabled')) await setRhythmModelEnabled(safe.rhythmModelEnabled);
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
    clickThrough,
    rhythmModelEnabled: config.rhythmModelEnabled !== false,
    customGenres: normalizeCustomGenreRules(config.customGenres, Object.keys(THEMES)),
    genreArtistRules: normalizeGenreArtistRules(config.genreArtistRules, Object.keys(THEMES))
  };
});
ipcMain.handle('genre-correction:set', (_event, genreId) => rememberCurrentGenre(genreId));
ipcMain.handle('genre-correction:clear', () => forgetCurrentGenre());
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

app.whenReady().then(() => {
  loadConfig();
  refreshNetworkCountry();
  if (config.launchAtLogin) config.launchAtLogin = applyLaunchAtLogin(true);
  loadGenreCorrections();
  removeLegacyUnmappedArtistLog();
  setupAudioCapture();
  createWindow();
  createTray();
  startMediaMonitor();
  startRhythmModel();
  globalShortcut.register('CommandOrControl+Shift+G', () => setClickThrough(!clickThrough));
});

app.on('before-quit', () => {
  app.isQuitting = true;
  clearIdleHideTimer();
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = null;
  saveWindowPositionNow();
  globalShortcut.unregisterAll();
  if (mediaWatchdogTimer) clearTimeout(mediaWatchdogTimer);
  if (mediaRestartTimer) clearTimeout(mediaRestartTimer);
  if (mediaProcess) mediaProcess.kill();
  if (rhythmModel) void rhythmModel.close();
  if (backdropTimer) clearInterval(backdropTimer);
});

app.on('window-all-closed', (event) => event.preventDefault());
