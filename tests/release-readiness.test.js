'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('release runtime uses a supported pinned Electron line', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.devDependencies.electron, '43.4.1');
});

test('App settings display the current package version', () => {
  const pkg = JSON.parse(read('package.json'));
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const escapedVersion = pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  assert.match(html, new RegExp(`id="app-version">${escapedVersion}<`));
  assert.match(renderer, new RegExp(`config\\.appVersion \\|\\| '${escapedVersion}'`));
  assert.match(read('main.js'), /appVersion: app\.getVersion\(\)/);
});

test('custom genre visuals use the app-drawn listbox', () => {
  const html = read('renderer/index.html');
  assert.match(html, /id="custom-genre-visual"[^>]+aria-haspopup="listbox"/);
  assert.match(html, /id="custom-genre-visual-menu" role="listbox"/);
  assert.doesNotMatch(html, /<select[^>]+id="custom-genre-visual"/);
});

test('custom genres expose optional three-color theme controls', () => {
  const html = read('renderer/index.html');
  const styles = read('renderer/styles.css');
  assert.match(html, /id="custom-genre-colors-toggle"[^>]+role="switch"/);
  for (const id of ['custom-genre-accent', 'custom-genre-accent-2', 'custom-genre-hot']) {
    assert.match(html, new RegExp(`id="${id}"[^>]+class="custom-genre-color-value"`));
  }
  assert.match(html, /id="custom-genre-color-editor"[^>]+role="dialog"/);
  assert.match(html, /id="custom-genre-color-field"[^>]+role="slider"/);
  assert.match(html, /id="custom-genre-color-hue" type="range"/);
  assert.doesNotMatch(html, /type="color"/);
  assert.equal((html.match(/class="custom-genre-field-label"/g) || []).length, 5);
  assert.match(styles, /#settings \.custom-genre-field-label,[\s\S]+#settings \.genre-artist-field-label \{[\s\S]+font-size: 10\.5px;[\s\S]+font-weight: 600;/);
});

test('custom genre deletion stays inside the settings UI', () => {
  const renderer = read('renderer/app.js');
  const styles = read('renderer/styles.css');
  assert.doesNotMatch(renderer, /window\.confirm\(/);
  assert.match(renderer, /dataset\.action = 'confirm-delete'/);
  assert.match(renderer, /dataset\.action = 'cancel-delete'/);
  assert.match(styles, /\.custom-genre-form > label,[\s\S]+row-gap: 7px/);
});

test('settings text buttons are optically centered and active tabs keep a content-led indicator', () => {
  const styles = read('renderer/styles.css');
  const actionRule = styles.match(/#settings-save,[\s\S]*?\.settings-action-button \{([\s\S]*?)\n\}/)?.[1] || '';
  const tabRule = styles.match(/#settings \.settings-tab \{([\s\S]*?)\n\}/)?.[1] || '';
  const activeTabRule = styles.match(/#settings \.settings-tab\[aria-selected="true"\]::after \{([\s\S]*?)\n\}/)?.[1] || '';
  const copyRule = styles.match(/\.settings-toggle-copy \{([\s\S]*?)\n\}/)?.[1] || '';
  const scaleLabelRule = styles.match(/\.settings-scale-row > \.settings-label \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(actionRule, /display: inline-flex;/);
  assert.match(actionRule, /align-items: center;/);
  assert.match(actionRule, /justify-content: center;/);
  assert.match(actionRule, /padding: 2px 12px 0;/);
  assert.match(tabRule, /display: flex;/);
  assert.match(tabRule, /align-items: center;/);
  assert.match(tabRule, /justify-content: center;/);
  assert.match(activeTabRule, /left: 50%;/);
  assert.match(activeTabRule, /width: 64%;/);
  assert.match(activeTabRule, /transform: translateX\(-50%\);/);
  assert.match(copyRule, /position: relative;/);
  assert.match(copyRule, /top: 1px;/);
  assert.match(scaleLabelRule, /position: relative;/);
  assert.match(scaleLabelRule, /top: 1px;/);
});

test('diagnostic action labels stay on one compositor layer while hover-lifting', () => {
  const styles = read('renderer/styles.css');
  assert.match(styles, /\.diagnostics-actions \.settings-action-button\s*\{[^}]*transform:\s*translate3d\(0, 0, 0\);[^}]*backface-visibility:\s*hidden;[^}]*will-change:\s*transform;/s);
  assert.match(styles, /\.diagnostics-actions \.settings-action-button:hover\s*\{[^}]*transform:\s*translate3d\(0, -1px, 0\);/s);
});

test('diagnostics expose live local genre model state and result reliability', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const main = read('main.js');
  const preload = read('preload.js');
  assert.match(html, /id="diagnostics-genre-model"/);
  assert.match(preload, /getDiagnosticsStatus:[^\n]+diagnostics:status/);
  assert.match(main, /ipcMain\.handle\('diagnostics:status'/);
  assert.match(main, /analysisWindowLimit: diagnosticText\(audioGenreModelState\?\.analysisWindowLimit\)/);
  assert.match(renderer, /setInterval\(refreshDiagnosticsStatus, 1000\)/);
  assert.match(renderer, /GENRE_UNCERTAINTY_LABELS/);
});

test('settings keeps one stable panel title while tabs label their own content', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const translations = read('src/i18n.js');

  assert.match(html, /class="settings-title" data-i18n="settings\.title">GENRE POLICE SETTINGS/);
  assert.doesNotMatch(html, /data-title-key=/);
  assert.equal((translations.match(/'settings\.title': 'GENRE POLICE SETTINGS'/g) || []).length, 4);
  assert.doesNotMatch(renderer, /settingsSectionName|updateSettingsPaneHeader/);
  assert.doesNotMatch(renderer, /activeTab\.dataset\.titleKey/);
});

test('Chinese-only lyric translation controls stay out of other interface languages', () => {
  const renderer = read('renderer/app.js');

  assert.match(renderer, /function supportsLyricTranslationForUiLanguage\(\) \{\s*return uiLanguage === 'zh-CN';\s*\}/);
  assert.match(renderer, /lyricTranslationSetting\.hidden = !supportsLyricTranslationForUiLanguage\(\);/);
  assert.match(renderer, /const showTranslation = lyricTranslationEnabled\s*&& supportsLyricTranslationForUiLanguage\(\)/);
});

test('a missing NetEase SMTC session raises one direct, dismissible notice', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const styles = read('renderer/styles.css');
  const translations = read('src/i18n.js');

  assert.match(html, /id="netease-smtc-toast" role="status" aria-live="polite" hidden/);
  assert.match(html, /id="netease-smtc-toast-close"[^>]+data-i18n-aria="actions\.close"/);
  assert.match(renderer, /let neteaseSmtcToastShown = false;/);
  assert.match(renderer, /if \(neteaseSmtcToastShown\) return;\s*neteaseSmtcToastShown = true;/);
  assert.match(renderer, /neteaseSmtcToastClose\.addEventListener\('click', dismissNeteaseSmtcToast\);/);
  assert.match(styles, /body\[data-layout="poster"\] #netease-smtc-toast \{[\s\S]*?left: 36px;[\s\S]*?right: 36px;[\s\S]*?bottom: 32px;/);
  assert.match(translations, /'hud\.neteaseSmtcHint': '请打开网易云音乐「设置 → 系统」，勾选「开启SMTC」。'/);
  assert.match(translations, /'settings\.neteaseSmtcHint': '检测到网易云音乐，但尚未开启系统媒体控制。请前往网易云音乐「设置 → 系统」，勾选「开启SMTC」。'/);
  assert.doesNotMatch(translations, /查看方法/);
});

test('playback controls retain the paused current media session for resume', () => {
  const mainSource = read('main.js');
  const controlSource = read('scripts/media-control.ps1');
  const playingSessionScan = controlSource.indexOf("PlaybackStatus.ToString() -eq 'Playing'");
  const pausedSessionFallback = controlSource.indexOf('A paused current session is still the correct target');

  assert.match(mainSource, /mediaPreferenceArguments\(config\.preferredMediaSource \|\| lastRawMetadata\?\.source\)/);
  assert.match(controlSource, /\$preferredUpdated = \[DateTimeOffset\]::MinValue[\s\S]*GetTimelineProperties\(\)\.LastUpdatedTime/);
  assert.ok(playingSessionScan >= 0 && pausedSessionFallback > playingSessionScan);
  assert.match(controlSource.slice(pausedSessionFallback), /\$session = \$current/);
});

test('capsule floating notices share the visible surface center and inset', () => {
  const html = read('renderer/index.html');
  const styles = read('renderer/styles.css');
  const floatingToasts = [...html.matchAll(/id="([^"]+-toast)" role="status"/g)].map((match) => match[1]);
  const sideRule = styles.match(/body\[data-layout="side"\] :is\(#netease-smtc-toast, #recording-toast, #update-toast\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.deepEqual(floatingToasts, ['netease-smtc-toast', 'recording-toast', 'update-toast']);
  assert.match(sideRule, /left: calc\(50% - 27px\);/);
  assert.match(sideRule, /right: auto;/);
  assert.match(sideRule, /bottom: 64px;/);
  assert.match(sideRule, /width: 560px;/);
  assert.match(sideRule, /translate: -50% 0;/);
  assert.match(sideRule, /box-shadow: inset/);
});

test('portable builds check GitHub releases quietly and expose a manual update action', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const preload = read('preload.js');
  const mainSource = read('main.js');
  const styles = read('renderer/styles.css');

  assert.match(html, /id="update-toast" role="status" aria-live="polite" hidden/);
  assert.match(html, /id="update-toast-dismiss"[^>]+data-i18n="actions\.notNow"/);
  assert.match(html, /id="update-toast-view"[^>]+data-i18n="actions\.viewUpdate"/);
  assert.match(html, /id="update-check-button"[^>]+data-i18n="actions\.checkForUpdates"/);
  assert.match(html, /id="update-view-button"[^>]+hidden/);
  assert.match(preload, /checkForUpdates: \(\) => ipcRenderer\.invoke\('update:check'\)/);
  assert.match(preload, /onUpdateStatus: \(callback\) => ipcRenderer\.on\('update-status'/);
  assert.match(mainSource, /releases\?per_page=10/);
  assert.match(mainSource, /isUpdateCheckDue\(config\.lastUpdateCheckAt\)/);
  assert.match(mainSource, /sameVersion\(config\.dismissedUpdateVersion, result\.latestVersion\)/);
  assert.match(mainSource, /if \(process\.env\.GP_CAPTURE_PATH \|\| updateCheckTimer\) return;/);
  assert.match(renderer, /window\.genrePolice\.onUpdateStatus\(\(result\) => showUpdateToast\(result\)\)/);
  assert.match(styles, /body\[data-layout="side"\] :is\([^}]*#update-toast\)\s*\{[^}]*box-shadow:\s*inset/s);
  assert.match(styles, /#settings \.settings-update-actions \.settings-action-button,\s*#settings #recording-start-stop\s*\{[^}]*min-width:\s*72px;[^}]*height:\s*32px;[^}]*padding:\s*2px 10px 0;/s);
});

test('a fresh configuration follows the Windows locale with an English fallback', () => {
  const mainSource = read('main.js');

  assert.match(mainSource, /resolveInitialLocale\(storedLanguage, app\.getLocale\(\)\)/);
  assert.match(mainSource, /const languageInitialized = process\.env\.GP_CAPTURE_LANGUAGE === undefined/);
});

test('idle frame limiting is an opt-out playback setting backed by the existing render throttle', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const mainSource = read('main.js');
  const playbackPane = html.slice(
    html.indexOf('id="settings-pane-playback"'),
    html.indexOf('id="settings-pane-genre"')
  );
  assert.match(playbackPane, /id="idle-frame-limit-toggle"[\s\S]*?role="switch"[\s\S]*?aria-checked="true"/);
  assert.match(appSource, /let idleFrameLimitEnabled = true;/);
  assert.match(appSource, /function setIdleFrameLimitEnabled\(enabled,[\s\S]*?idleFrameLimitEnabled = enabled !== false;/);
  assert.match(appSource, /animationActive \|\| !idleFrameLimitEnabled[\s\S]*?1000 \/ 30/);
  assert.match(mainSource, /config\.idleFrameLimitEnabled = config\.idleFrameLimitEnabled !== false;/);
  assert.match(mainSource, /if \(typeof patch\?\.idleFrameLimitEnabled === 'boolean'\) safe\.idleFrameLimitEnabled = patch\.idleFrameLimitEnabled;/);
});

test('the diagnostics panel exposes an opt-in actual-render FPS counter', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const mainSource = read('main.js');
  const styles = read('renderer/styles.css');
  const diagnostics = html.slice(
    html.indexOf('id="diagnostics-panel"'),
    html.indexOf('class="settings-save-row"')
  );

  assert.match(diagnostics, /id="show-fps-toggle"[\s\S]*role="switch"[\s\S]*aria-checked="false"/);
  assert.match(html, /id="fps-counter"[\s\S]*hidden/);
  assert.match(appSource, /function setShowFps\(enabled,[\s\S]*setConfig\(\{ showFps \}\)/);
  assert.match(appSource, /lastAnimationWorkAt = time;\s*updateFpsCounter\(time\);/);
  assert.match(mainSource, /config\.showFps = config\.showFps === true;/);
  assert.match(mainSource, /if \(typeof patch\?\.showFps === 'boolean'\) safe\.showFps = patch\.showFps;/);
  assert.match(styles, /#fps-counter \{[\s\S]*pointer-events: none;/);
});

test('mouse passthrough is discoverable in App settings and defaults off', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const mainSource = read('main.js');
  const appPane = html.slice(
    html.indexOf('id="settings-pane-app"'),
    html.indexOf('id="diagnostics-panel"')
  );
  assert.match(appPane, /id="always-on-top-toggle"[\s\S]*id="mouse-passthrough-toggle"[\s\S]*id="launch-at-login-toggle"/);
  assert.match(appPane, /id="mouse-passthrough-toggle"[\s\S]*role="switch"[\s\S]*aria-checked="false"/);
  assert.match(appSource, /let mousePassthroughEnabled = false;/);
  assert.match(appSource, /function setMousePassthroughEnabled\(enabled,[\s\S]*setConfig\(\{ clickThrough: mousePassthroughEnabled \}\)/);
  assert.match(mainSource, /if \(typeof patch\?\.clickThrough === 'boolean'\) safe\.clickThrough = normalizeClickThrough\(patch\.clickThrough\);/);
});

test('settings use stable top-level tabs and task-focused groups', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const tabs = html.slice(html.indexOf('class="settings-tabs"'), html.indexOf('class="settings-body"'));
  const appearancePane = html.slice(html.indexOf('id="settings-pane-appearance"'), html.indexOf('id="settings-pane-lyrics"'));
  const playbackPane = html.slice(html.indexOf('id="settings-pane-playback"'), html.indexOf('id="settings-pane-genre"'));
  const genrePane = html.slice(html.indexOf('id="settings-pane-genre"'), html.indexOf('id="settings-pane-app"'));
  const appPane = html.slice(html.indexOf('id="settings-pane-app"'), html.indexOf('id="settings-scrollbar"'));

  assert.match(tabs, /settings-tab-appearance[\s\S]*settings-tab-playback[\s\S]*settings-tab-lyrics[\s\S]*settings-tab-genre[\s\S]*settings-tab-app/);
  assert.match(appearancePane, /settings\.sectionGeneral[\s\S]*settings\.sectionLayout[\s\S]*settings\.sectionMotion[\s\S]*settings\.sectionQuickControls[\s\S]*settings\.sectionFullscreen/);
  assert.match(playbackPane, /settings\.sectionAudio[\s\S]*settings\.sectionIdle[\s\S]*settings\.sectionTrackInfo/);
  assert.doesNotMatch(playbackPane, /BeatNet/);
  assert.match(genrePane, /settings\.sectionRecognition[\s\S]*settings\.sectionCorrections[\s\S]*settings\.sectionData/);
  assert.match(appPane, /settings\.sectionWindow[\s\S]*settings\.sectionCapture[\s\S]*settings\.sectionMaintenance/);
  assert.match(appSource, /appearanceGeneralSection\.hidden = stageOutputActive;[\s\S]*appearanceLayoutSection\.hidden = stageOutputActive;/);
});

test('the main window always keeps a taskbar recovery path', () => {
  const mainSource = read('main.js');
  const createWindowIndex = mainSource.indexOf('function createWindow()');
  const mainWindowSource = mainSource.slice(createWindowIndex, createWindowIndex + 6000);
  assert.match(mainWindowSource, /new BrowserWindow\(\{[\s\S]*skipTaskbar: false/);
  assert.doesNotMatch(mainWindowSource, /setSkipTaskbar\(/);
});

test('desktop layer mode survives Show Desktop and stays mutually exclusive with always on top', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const mainSource = read('main.js');
  const helperSource = read('scripts/windows-desktop-host.cs');
  assert.match(html, /id="always-on-top-toggle"[\s\S]*id="desktop-layer-toggle"/);
  assert.match(appSource, /setConfig\(\{ desktopLayer: desktopLayerEnabled \}\)/);
  assert.match(mainSource, /if \(safe\.desktopLayer === true\) safe\.alwaysOnTop = false;/);
  assert.match(mainSource, /else if \(safe\.alwaysOnTop === true\) safe\.desktopLayer = false;/);
  assert.match(mainSource, /desktopLayerMonitor = setInterval[\s\S]*runDesktopLayerHelper\('status'\)/);
  assert.match(helperSource, /WsExNoRedirectionBitmap/);
  assert.match(helperSource, /SetParent\(IntPtr child, IntPtr newParent\)/);
  assert.match(helperSource, /layer\.Raised[\s\S]*layer\.Progman/);
  assert.match(helperSource, /layer\.ShellView[\s\S]*SetWindowPos/);
});

test('video recording captures the app frame with loopback audio and streams chunks to disk', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const audioSource = read('renderer/audio-engine.js');
  const controller = read('renderer/recording-controller.mjs');
  const preload = read('preload.js');
  const overlayPreload = read('recording-controls-preload.js');
  const overlayHtml = read('renderer/recording-controls.html');
  const overlaySource = read('renderer/recording-controls.js');
  const overlayStyles = read('renderer/recording-controls.css');
  const transportHtml = read('renderer/recording-transport.html');
  const transportSource = read('renderer/recording-transport.js');
  const mainSource = read('main.js');
  const styles = read('renderer/styles.css');
  const privacy = read('docs/PRIVACY.md');
  const appPane = html.slice(
    html.indexOf('id="settings-pane-app"'),
    html.indexOf('id="diagnostics-panel"')
  );
  const appearancePane = html.slice(
    html.indexOf('id="settings-pane-appearance"'),
    html.indexOf('id="settings-pane-lyrics"')
  );

  assert.match(appPane, /id="always-on-top-toggle"[\s\S]*id="recording-start-stop"[\s\S]*id="snapshot-save-button"/);
  assert.doesNotMatch(appPane, /id="(?:recording|snapshot)-quick-button-toggle"/);
  assert.match(appearancePane, /id="snapshot-quick-button-setting"[\s\S]*id="snapshot-quick-button-toggle"[\s\S]*id="recording-quick-button-setting"[\s\S]*id="recording-quick-button-toggle"/);
  assert.match(html, /id="recording-quick-button"[^>]+hidden[\s\S]*id="settings-button"[\s\S]*id="layout-toggle-button"[\s\S]*id="close-button"/);
  assert.match(appSource, /recordingQuickButton\.addEventListener\('click', toggleRecording\)/);
  assert.match(appSource, /recordingQuickButton\.hidden = !recordingQuickButtonVisible/);
  assert.match(appSource, /iconSize: Number\.parseFloat\(iconStyle\?\.width\) \|\| 16/);
  assert.match(appSource, /onRecordingControlsActivity[\s\S]*phase === 'enter'[\s\S]*showControls\(\)[\s\S]*phase === 'leave'\) hideControls\(260\)/);
  assert.match(appSource, /rect\.width > 0 && rect\.height > 0[\s\S]*stageOutputActive \|\| \(transportRect\.width > 0 && transportRect\.height > 0\)[\s\S]*recordingOverlayGeometry =/);
  assert.match(appSource, /const geometry = recordingOverlayGeometry \|\|/);
  assert.match(audioSource, /createRecordingTrack\(\)[\s\S]*track\.clone\(\)/);
  assert.match(controller, /getDisplayMedia\(\{[\s\S]*audio: false[\s\S]*frameRate: 60/);
  assert.match(controller, /const prepared = await this\.bridge\.prepareRecording[\s\S]*if \(!prepared\?\.ok\)[\s\S]*return prepared[\s\S]*this\.presentationChanged\?\.\(true\)/);
  assert.match(controller, /recorder\.start\(1000\)/);
  assert.match(preload, /appendRecordingChunk:[^\n]+recording:append/);
  assert.match(preload, /updateRecordingControls:[^\n]+recording-controls:update/);
  assert.match(preload, /onRecordingControlsActivity:[^\n]+recording-controls:activity/);
  assert.match(overlayPreload, /recording-controls:command/);
  assert.match(overlayPreload, /recording-controls:activity/);
  assert.match(overlayHtml, /id="recording-stop"/);
  assert.doesNotMatch(overlayHtml, /id="recording-(?:settings|layout|close)"/);
  assert.match(overlaySource, /recordingControls\.command\('stop'\)/);
  assert.match(overlaySource, /--icon-size/);
  assert.doesNotMatch(overlayStyles, /window-controls-overlay:not\(\.controls-visible\) \.control-button:not\(\.recording-button\)/);
  assert.match(transportHtml, /id="recording-previous"[\s\S]*id="recording-play-pause"[\s\S]*id="recording-next"/);
  assert.match(transportSource, /command\('previous'\)[\s\S]*command\('toggle'\)[\s\S]*command\('next'\)/);
  assert.match(mainSource, /request\.videoRequested && !request\.audioRequested && request\.frame/);
  assert.match(mainSource, /callback\(\{ video: request\.frame \}\)/);
  assert.match(mainSource, /fs\.writeSync\(active\.fd, bytes\)/);
  assert.match(mainSource, /fs\.renameSync\(active\.partialPath, active\.finalPath\)/);
  assert.match(mainSource, /new BrowserWindow\(\{[\s\S]*recording-controls-preload\.js[\s\S]*recording-controls\.html/);
  assert.match(mainSource, /event\.sender === overlay\.webContents/);
  assert.match(mainSource, /recording-transport\.html/);
  assert.match(mainSource, /hideRecordingControlsWindows\(\);\s*const result = mainWindow/);
  assert.match(mainSource, /overlay\.setIgnoreMouseEvents\(\s*!recordingControlsState\.visible/);
  assert.match(mainSource, /config\.recordingQuickButtonVisible = config\.recordingQuickButtonVisible !== false/);
  assert.match(mainSource, /config\.snapshotQuickButtonVisible = config\.snapshotQuickButtonVisible !== false/);
  assert.match(mainSource, /safe\.recordingQuickButtonVisible = patch\.recordingQuickButtonVisible/);
  assert.match(appSource, /\[controls, transport, fullscreenControls, fullscreenTransport, settings, neteaseSmtcToast, recordingToast\][\s\S]*classList\.toggle\('recording-suppressed', recordingPresentationActive\)/);
  assert.match(appSource, /showTransport: true/);
  assert.match(styles, /\.recording-suppressed \{[\s\S]*visibility: hidden !important;[\s\S]*pointer-events: none !important;/);
  assert.doesNotMatch(styles, /\.recording-suppressed \{[^}]*display: none/);
  assert.doesNotMatch(appSource, /document\.(?:body|documentElement)\.dataset\.recording/);
  assert.doesNotMatch(styles, /#controls \.recording-control-icon \{/);
  assert.doesNotMatch(styles, /body\[data-layout="poster"\] #controls \.recording-control-icon \{/);
  assert.match(overlayStyles, /\.recording-button \.control-icon \{\s*width: calc\(var\(--icon-size\) \+ 3px\);\s*height: calc\(var\(--icon-size\) \+ 3px\);/);
  assert.match(appSource, /if \(document\.body\.dataset\.backgroundStyle !== nextStyle\) \{\s*document\.body\.dataset\.backgroundStyle = nextStyle;/);
  assert.match(appSource, /if \(recordingPresentationActive\) \{\s*setRecordingOverlayVisibility\(true\);\s*\} else \{\s*document\.body\.classList\.add\('pointer-active'\)/);
  assert.doesNotMatch(appSource, /function setRecordingPresentation[\s\S]{0,1200}document\.body\.classList\.remove\('pointer-active'\)/);
  assert.match(appSource, /if \(recordingPresentationActive\) \{\s*setRecordingOverlayVisibility\(false\);\s*\} else \{\s*document\.body\.classList\.remove\('pointer-active'\)/);
  assert.match(appSource, /onRecordingControlsActivity\(\(phase\) =>/);
  assert.match(appSource, /const animationActive = Boolean\(recordingPresentationActive \|\| demoTheme/);
  assert.match(privacy, /user explicitly starts a video recording and chooses a destination/);
});

test('stage output fills the current display and restores the desktop window', () => {
  const html = read('renderer/index.html');
  const preloadSource = read('preload.js');
  const mainSource = read('main.js');
  const appSource = read('renderer/app.js');
  const visualSource = read('renderer/visual-engine.js');
  const styles = read('renderer/styles.css');
  const appearancePane = html.slice(
    html.indexOf('id="settings-pane-appearance"'),
    html.indexOf('id="settings-pane-lyrics"')
  );
  const appPane = html.slice(html.indexOf('id="settings-pane-app"'));
  assert.match(html, /id="stage-output-start-stop"/);
  assert.match(appearancePane, /id="stage-output-text-setting"[\s\S]*id="fullscreen-english-font-setting"[\s\S]*id="stage-output-entry-setting"/);
  assert.doesNotMatch(appPane, /id="stage-output-(?:text-setting|entry-setting|start-stop)"/);
  assert.match(html, /id="fullscreen-quick-button"[\s\S]*id="settings-button"/);
  assert.match(html, /id="fullscreen-controls"[\s\S]*id="fullscreen-snapshot-button"[\s\S]*id="fullscreen-recording-button"[\s\S]*id="fullscreen-settings-button"[\s\S]*id="fullscreen-layout-button"[\s\S]*id="fullscreen-text-button"[\s\S]*id="fullscreen-exit-button"/);
  assert.match(html, /id="snapshot-quick-button"[\s\S]{0,400}viewBox="0 -960 960 960"[\s\S]{0,200}d="M600-320h160/);
  assert.match(html, /id="fullscreen-snapshot-button"[\s\S]{0,400}viewBox="0 -960 960 960"[\s\S]{0,200}d="M600-320h160/);
  assert.match(html, /id="recording-quick-button"[\s\S]{0,400}viewBox="0 -960 960 960"[\s\S]{0,200}d="M158-242/);
  assert.match(html, /id="fullscreen-recording-button"[\s\S]{0,400}viewBox="0 -960 960 960"[\s\S]{0,200}d="M158-242/);
  assert.match(html, /id="fullscreen-layout-button"[\s\S]{0,400}class="fullscreen-layout-symbol"[\s\S]{0,200}d="M200-520/);
  assert.match(html, /id="layout-toggle-button"[\s\S]{0,400}d="M720-80H240[\s\S]{0,500}d="M320-200/);
  assert.match(html, /id="fullscreen-quick-button"[\s\S]{0,300}d="M120-120v-200/);
  assert.match(html, /id="fullscreen-exit-button"[\s\S]{0,500}d="M240-120v-120/);
  assert.match(html, /id="fullscreen-text-button"[\s\S]{0,700}id="fullscreen-text-off-mask"[\s\S]{0,700}d="M420-160v-520/);
  assert.doesNotMatch(html, /id="fullscreen-font-button"/);
  assert.match(html, /id="fullscreen-transport"[\s\S]*id="fullscreen-previous-track"[\s\S]*id="fullscreen-play-pause"[\s\S]*id="fullscreen-next-track"/);
  assert.match(html, /id="fullscreen-english-font-setting"[\s\S]*settings\.fullscreenCondensedEnglish[\s\S]*id="fullscreen-english-font-toggle"/);
  assert.match(preloadSource, /setStageOutput: \(value\) => ipcRenderer\.invoke\('window:set-stage-output', value\)/);
  assert.match(preloadSource, /reportRenderPerformance: \(payload\) => ipcRenderer\.send\('diagnostics:render-performance', payload\)/);
  assert.match(mainSource, /ipcMain\.on\('diagnostics:render-performance'[\s\S]*process\.argv\.includes\('--dev'\)[\s\S]*\[render-perf\]/);
  assert.match(preloadSource, /onStageOutputState: \(callback\) => ipcRenderer\.on\('stage-output-state'/);
  assert.match(mainSource, /stageOutputRestoreBounds = currentBounds[\s\S]*mainWindow\.setBounds\(display\.bounds, false\)/);
  assert.match(mainSource, /if \(restoreBounds\) mainWindow\.setBounds\(restoreBounds, false\)/);
  assert.match(mainSource, /globalShortcut\.register\('Escape', \(\) => setStageOutput\(false\)\)/);
  assert.match(mainSource, /setMainWindowMouseEventsIgnored\(false\)[\s\S]*globalShortcut\.register\('Escape'/);
  assert.match(mainSource, /fullscreenLayoutMode: config\.fullscreenLayoutMode === 'stacked' \? 'stacked' : 'split'/);
  assert.match(mainSource, /config\.fullscreenCondensedEnglish = config\.fullscreenCondensedEnglish === true/);
  assert.match(mainSource, /if \(typeof patch\?\.fullscreenCondensedEnglish === 'boolean'\) safe\.fullscreenCondensedEnglish = patch\.fullscreenCondensedEnglish/);
  assert.match(appSource, /const scale = Math\.min\([\s\S]*window\.innerWidth - 96[\s\S]*\/ 920,[\s\S]*window\.innerHeight - 96[\s\S]*\/ 400/);
  assert.match(appSource, /const guard = 24 \/ safeScale;[\s\S]*visualOverscanX[\s\S]*visualOverscanY/);
  assert.match(appSource, /--stage-visual-width[\s\S]*920 \+ visualOverscanX \* 2[\s\S]*--stage-visual-height[\s\S]*400 \+ visualOverscanY \* 2/);
  assert.match(appSource, /function updateStageOutputScale\(\)[\s\S]*--fullscreen-heading-top[\s\S]*visual\.resize\(\);/);
  assert.match(visualSource, /const outputScale = document\.body\.dataset\.stageOutput === 'true'[\s\S]*renderedWidth \/ this\.width[\s\S]*const nativeDpr = Math\.min\(3, \(window\.devicePixelRatio \|\| 1\) \* outputScale\)[\s\S]*this\.dpr = Math\.max\(1, nativeDpr \* this\.outputResolutionScale\)/);
  assert.match(appSource, /stageOutputRestoreLayoutMode = layoutMode/);
  assert.match(appSource, /document\.body\.dataset\.fullscreenLayout = fullscreenLayoutMode/);
  assert.match(appSource, /const posterPresentation = layoutMode === 'poster'[\s\S]*capsuleBackgroundSetting\.hidden = stageOutputActive \|\| posterPresentation[\s\S]*posterBackgroundSetting\.hidden = stageOutputActive \|\| !posterPresentation[\s\S]*fullscreenEnglishFontSetting\.hidden = !stageOutputActive[\s\S]*stageOutputTextSetting\.hidden = !stageOutputActive[\s\S]*stageOutputEntrySetting\.hidden = stageOutputActive[\s\S]*layoutModeSetting\.hidden = stageOutputActive/);
  assert.doesNotMatch(appSource, /(?:snapshot|recording)QuickButtonSetting\.hidden = stageOutputActive/);
  assert.match(appSource, /recordingQuickButton\.hidden = !recordingQuickButtonVisible;[\s\S]*fullscreenRecordingButton\.hidden = !recordingQuickButtonVisible/);
  assert.match(appSource, /snapshotQuickButton\.hidden = !snapshotQuickButtonVisible;[\s\S]*fullscreenSnapshotButton\.hidden = !snapshotQuickButtonVisible/);
  assert.match(appSource, /uiScaleSetting\.hidden = stageOutputActive/);
  assert.match(appSource, /function setFullscreenCondensedEnglish[\s\S]*dataset\.fullscreenEnglish[\s\S]*setConfig\(\{ fullscreenCondensedEnglish \}\)/);
  assert.match(appSource, /if \(!stageOutputActive\) \{\s*setFullscreenLayoutMode\(layoutMode === 'poster' \? 'stacked' : 'split'\);\s*\}/);
  assert.match(appSource, /fullscreenPreviousTrackButton\.addEventListener\('click',[\s\S]*fullscreenPlayPauseButton\.addEventListener\('click',[\s\S]*fullscreenNextTrackButton\.addEventListener\('click'/);
  assert.match(appSource, /fullscreenSnapshotButton\.addEventListener\('click',[\s\S]*fullscreenRecordingButton\.addEventListener\('click',[\s\S]*fullscreenSettingsButton\.addEventListener\('click',[\s\S]*fullscreenLayoutButton\.addEventListener\('click',[\s\S]*fullscreenTextButton\.addEventListener\('click',[\s\S]*fullscreenExitButton\.addEventListener\('click'/);
  assert.match(styles, /body\[data-stage-output="true"\] #app[\s\S]*translate\(-50%, -50%\) scale\(var\(--stage-output-scale, 1\)\)/);
  assert.match(styles, /body\[data-stage-output="true"\] \.themed-backdrop[\s\S]*inset: -96px !important[\s\S]*mask-image: none !important/);
  assert.match(styles, /--backdrop-focus-x: calc\(var\(--visual-center-x\) \+ 96px\)[\s\S]*--backdrop-focus-y: calc\(var\(--visual-center-y\) \+ 96px\)/);
  assert.match(styles, /body\[data-stage-output="true"\] :is\(#visualizer, #riff-strings\)[\s\S]*left: var\(--stage-visual-left, -128px\)[\s\S]*width: var\(--stage-visual-width, 1176px\)[\s\S]*height: var\(--stage-visual-height, 656px\)/);
  assert.match(styles, /body\[data-stage-output="true"\] #visualizer[\s\S]*--visual-center-x: var\(--stage-split-visual-center-x, 334px\)[\s\S]*--visual-center-y: var\(--stage-split-visual-center-y, 328px\)/);
  assert.match(styles, /body\[data-stage-output="true"\]\[data-fullscreen-layout="stacked"\] #hud[\s\S]*text-align: center/);
  assert.match(styles, /body\[data-stage-output="true"\]\[data-fullscreen-layout="stacked"\] :is\(#lyric-current-fill, #lyric-translation-fill\)[\s\S]*left: 50%;[\s\S]*translateX\(-50%\)/);
  assert.match(styles, /body\[data-stage-output="true"\]\[data-fullscreen-layout="stacked"\] \.jurisdiction[\s\S]*left: var\(--fullscreen-heading-left, -140px\)[\s\S]*top: var\(--fullscreen-heading-top, -165px\)[\s\S]*justify-content: flex-start/);
  assert.match(appSource, /--fullscreen-heading-left[\s\S]*\(40 - appLeft\) \/ safeScale - 180[\s\S]*--fullscreen-heading-top[\s\S]*\(32 - appTop\) \/ safeScale - 200/);
  assert.match(styles, /body\[data-stage-output="true"\] #fullscreen-controls[\s\S]*position: fixed[\s\S]*top: 24px[\s\S]*right: 24px/);
  assert.match(styles, /body\[data-stage-output="true"\] #fullscreen-transport[\s\S]*position: fixed[\s\S]*bottom: 24px/);
  assert.match(styles, /body\[data-fullscreen-layout="stacked"\] \.fullscreen-layout-symbol \{[\s\S]*transform: rotate\(90deg\)/);
  assert.doesNotMatch(styles, /#fullscreen-controls \.recording-control-icon \{/);
  assert.match(styles, /\.fullscreen-text-off-mark \{[\s\S]*stroke-width: 80;[\s\S]*stroke-linecap: butt/);
  assert.match(styles, /body\[data-stage-output="true"\]\[data-fullscreen-english="regular"\] #app[\s\S]*DM Sans Variable[\s\S]*body\[data-stage-output="true"\]\[data-fullscreen-english="condensed"\] #app[\s\S]*Barlow Condensed/);
  assert.match(styles, /body\[data-stage-output="true"\]\[data-stage-output-text="false"\] #hud[\s\S]*opacity: 0 !important;[\s\S]*visibility: hidden !important/);
  assert.match(appSource, /function setStageOutputTextVisible[\s\S]*visual\.resize\(\);[\s\S]*fitGenreLabel\(\);[\s\S]*updateTitleOverflow\(\);/);
  assert.match(styles, /body\[data-stage-output="true"\] #settings[\s\S]*width: 540px[\s\S]*height: 560px[\s\S]*--stage-output-settings-scale/);
  const fullscreenHiddenUiStart = styles.indexOf('body[data-stage-output="true"] :is(\n  #controls,');
  const fullscreenHiddenUi = styles.slice(
    fullscreenHiddenUiStart,
    styles.indexOf('body[data-stage-output="true"] #genre-quick-panel', fullscreenHiddenUiStart)
  );
  assert.doesNotMatch(fullscreenHiddenUi, /#genre-quick-panel/);
  assert.match(styles, /body\[data-stage-output="true"\] #genre-quick-panel\s*\{[^}]*left:\s*50%;[^}]*top:\s*50%;[^}]*width:\s*500px;[^}]*--stage-output-settings-scale/s);
  assert.match(styles, /body\[data-stage-output="true"\]:is\(\.settings-open, \.genre-quick-open\) :is\(#fullscreen-controls, #fullscreen-transport\)/);
  assert.match(appSource, /if \(event\.key === 'Escape' && !genreQuickPanel\.hidden\)[\s\S]{0,220}closeGenreQuickPanel\(\);[\s\S]{0,220}if \(event\.key === 'Escape' && stageOutputActive\)/);
  assert.doesNotMatch(appSource, /function openSettingsFromFullscreen\(\) \{[\s\S]{0,300}setStageOutput\(false\)/);
  assert.doesNotMatch(mainSource, /function openSettings\(\) \{[\s\S]{0,180}setStageOutput\(false\)/);
});

test('local rhythm enhancement is an opt-out Playback setting with a DSP fallback', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const audioSource = read('renderer/audio-engine.js');
  const mainSource = read('main.js');
  const playbackPane = html.slice(
    html.indexOf('id="settings-pane-playback"'),
    html.indexOf('id="settings-pane-genre"')
  );
  assert.match(playbackPane, /id="rhythm-model-toggle"[\s\S]*id="idle-frame-limit-toggle"[\s\S]*class="media-source-settings"/);
  assert.match(playbackPane, /id="rhythm-model-toggle"[\s\S]*role="switch"[\s\S]*aria-checked="true"/);
  assert.match(appSource, /let rhythmModelEnabled = true;/);
  assert.match(audioSource, /setRhythmModelEnabled\(enabled\)[\s\S]*this\.stopRhythmFeed\(\)/);
  assert.match(mainSource, /config\.rhythmModelEnabled = config\.rhythmModelEnabled !== false;/);
  assert.match(mainSource, /if \(typeof patch\?\.rhythmModelEnabled === 'boolean'\) safe\.rhythmModelEnabled = patch\.rhythmModelEnabled;/);
  assert.match(mainSource, /function startRhythmModel\(\) \{[\s\S]*config\.rhythmModelEnabled === false[\s\S]*type: 'disabled'/);
});

test('audio response setup stays glanceable instead of exposing mixer controls', () => {
  const html = read('renderer/index.html');
  const playbackPane = html.slice(
    html.indexOf('id="settings-pane-playback"'),
    html.indexOf('id="settings-pane-genre"')
  );
  const responseSetup = playbackPane.slice(0, playbackPane.indexOf('class="settings-layout-row settings-idle-row"'));
  assert.match(responseSetup, /id="audio-source-button"[^>]+aria-haspopup="listbox"/);
  assert.equal((responseSetup.match(/class="visual-response-option"/g) || []).length, 3);
  assert.doesNotMatch(responseSetup, /id="audio-calibrate-button"/);
  assert.doesNotMatch(responseSetup, /type="range"/);
});

test('genre corrections, supplemental artists, and custom genres can be exported and imported together', () => {
  const html = read('renderer/index.html');
  const preload = read('preload.js');
  const main = read('main.js');
  assert.match(html, /id="genre-data-export"/);
  assert.match(html, /id="genre-data-import"/);
  assert.match(preload, /exportGenreData:[^\n]+genre-data:export/);
  assert.match(preload, /importGenreData:[^\n]+genre-data:import/);
  assert.match(main, /ipcMain\.handle\('genre-data:export'/);
  assert.match(main, /ipcMain\.handle\('genre-data:import'/);
  assert.match(main, /genreArtistRules: normalizeGenreArtistRules/);
});

test('supplemental artists are a secondary Genre setting before custom genres', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const genrePane = html.slice(
    html.indexOf('id="settings-pane-genre"'),
    html.indexOf('id="settings-pane-app"')
  );
  const correctionIndex = genrePane.indexOf('class="genre-correction-settings"');
  const artistIndex = genrePane.indexOf('id="genre-artist-panel"');
  const customIndex = genrePane.indexOf('id="custom-genre-panel"');

  assert.ok(correctionIndex >= 0 && correctionIndex < artistIndex && artistIndex < customIndex);
  assert.match(genrePane, /id="genre-artist-genre"[^>]+aria-haspopup="listbox"/);
  assert.match(genrePane, /id="genre-artist-genre-menu" role="listbox"/);
  assert.match(renderer, /setConfig\(\{ genreArtistRules: nextRules \}\)/);
  assert.match(renderer, /diagnostics\.genreUserArtist/);
});

test('local AI genre recognition is a Genre setting with an opt-in dependent change detector', () => {
  const html = read('renderer/index.html');
  const renderer = read('renderer/app.js');
  const main = read('main.js');
  const preload = read('preload.js');
  const genrePane = html.slice(
    html.indexOf('id="settings-pane-genre"'),
    html.indexOf('id="settings-pane-app"')
  );
  const onlineIndex = genrePane.indexOf('id="online-lookup-toggle"');
  const artistReferenceIndex = genrePane.indexOf('id="artist-genre-reference-toggle"');
  const localModelIndex = genrePane.indexOf('id="local-genre-model-toggle"');
  const dynamicIndex = genrePane.indexOf('id="dynamic-genre-detection-setting"');
  const correctionIndex = genrePane.indexOf('class="genre-correction-settings"');
  assert.ok(onlineIndex >= 0 && localModelIndex > onlineIndex);
  assert.ok(artistReferenceIndex > localModelIndex);
  assert.ok(dynamicIndex > artistReferenceIndex && correctionIndex > dynamicIndex);
  assert.match(genrePane, /id="dynamic-genre-detection-setting"[^>]+settings-dependent-row[^>]+hidden/);
  assert.match(genrePane, /id="dynamic-genre-detection-toggle"[^>]+aria-checked="false"/);
  assert.match(genrePane, /id="artist-genre-reference-toggle"[^>]+aria-checked="true"/);
  assert.match(renderer, /setArtistGenreReferenceEnabled\(config\.artistGenreReferenceEnabled !== false\)/);
  assert.match(main, /config\.artistGenreReferenceEnabled = config\.artistGenreReferenceEnabled !== false/);
  assert.match(renderer, /if \(!localGenreModelEnabled \|\| !localGenreModelAvailable\) dynamicGenreDetectionEnabled = false/);
  assert.match(main, /if \(!nextLocalGenreModelEnabled\) safe\.dynamicGenreDetectionEnabled = false/);
  assert.match(main, /baseGenreKind === 'specific' && Boolean\(currentAudioGenreDecision\?\.genreId\)/);
  assert.match(main, /audio-genre-memory\.json/);
  assert.match(main, /createAudioGenreMemoryCandidate/);
  assert.match(main, /AUDIO_GENRE_MEMORY_CONFIRMATION_WINDOWS/);
  assert.match(main, /kind === 'artist'[\s\S]*guardGenreIds\.push\(artistGenreId\)/);
  assert.match(read('src/audio-genre-model.js'), /function authorPriorEvidenceGate[\s\S]*distance <= 3[\s\S]*plausibility hint/);
  assert.match(preload, /submitGenreAudio:[^\n]+audio-genre-model:audio/);
});

test('the packaged local genre model includes its taxonomy and upstream license', () => {
  const modelPath = path.join(root, 'assets', 'models', 'discogs-effnet-bsdynamic-1.onnx');
  const metadata = JSON.parse(read('assets/models/discogs-effnet-bsdynamic-1.json'));
  const license = read('assets/models/ESSENTIA-MODELS-LICENSE.txt');
  const notices = read('THIRD_PARTY_NOTICES.md');
  assert.equal(fs.statSync(modelPath).size, 18027718);
  assert.equal(metadata.classes.length, 400);
  assert.match(license, /Creative Commons Attribution-NonCommercial-NoDerivatives 4\.0/);
  assert.match(notices, /discogs-effnet-bsdynamic-1\.onnx/);
});

test('Windows x64 package excludes foreign ONNX Runtime binaries', () => {
  const pkg = JSON.parse(read('package.json'));
  const excluded = '!node_modules/onnxruntime-node/bin/**/*';
  const included = 'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/**/*';

  const runtimeScripts = [
    'scripts/GenrePolice.ThumbnailReader.dll',
    'scripts/media-control.ps1',
    'scripts/now-playing.ps1',
    'scripts/windows-desktop-host.exe'
  ];

  assert.deepEqual(pkg.build.asarUnpack, [...runtimeScripts, 'assets/**/*', included]);
  for (const runtimeScript of runtimeScripts) assert.ok(pkg.build.files.includes(runtimeScript));
  assert.ok(!pkg.build.files.includes('scripts/**/*'), 'developer scripts must not enter the executable');
  assert.ok(pkg.build.files.indexOf(excluded) >= 0, 'foreign ONNX binaries must be excluded');
  assert.ok(
    pkg.build.files.indexOf(included) > pkg.build.files.indexOf(excluded),
    'the Windows x64 runtime must be re-included after the broad exclusion'
  );
  assert.ok(!pkg.build.files.includes('docs/**/*'), 'repository documentation must not inflate the executable');
  assert.ok(pkg.build.files.includes('recording-controls-preload.js'), 'recording overlays need their preload bridge');
  assert.ok(pkg.build.files.includes('!assets/icon.svg'));
  assert.ok(pkg.build.files.includes('!assets/tray-icon.svg'));
});

test('public documentation describes the portable release rather than developer setup', () => {
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const englishReadme = read('README.en.md');
  const japaneseReadme = read('README.ja.md');
  const knownIssues = read('docs/KNOWN_ISSUES.md');
  const releaseNotes = read(`docs/RELEASE_NOTES_${pkg.version}.md`);
  const executableName = `Genre-Police-Visualizer-${pkg.version}-portable.exe`;
  const escapedExecutableName = executableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  assert.match(readme, /## 下载/);
  assert.match(readme, /不需要另外安装 Node\.js、Python/);
  assert.match(readme, /50%–150%/);
  assert.match(readme, new RegExp(escapedExecutableName));
  assert.doesNotMatch(readme, /在 70%–130% 间切换/);
  assert.match(englishReadme, /## Download/);
  assert.match(englishReadme, /README\.ja\.md/);
  assert.match(englishReadme, /50%–150%/);
  assert.match(englishReadme, new RegExp(escapedExecutableName));
  assert.match(japaneseReadme, /## ダウンロード/);
  assert.match(japaneseReadme, /README\.en\.md/);
  assert.match(japaneseReadme, /50%–150%/);
  assert.match(japaneseReadme, new RegExp(escapedExecutableName));
  assert.match(releaseNotes, new RegExp(escapedExecutableName));
  assert.match(knownIssues, /Windows 10 或 Windows 11 的 64 位版本/);
});

test('release checksum manifest targets the current portable executable', () => {
  const pkg = JSON.parse(read('package.json'));
  const manifest = read('SHA256SUMS.txt').trim();
  const executableName = `Genre-Police-Visualizer-${pkg.version}-portable.exe`;
  const match = manifest.match(/^([A-F0-9]{64}) \*(.+)$/);

  assert.ok(match, 'checksum manifest must contain one uppercase SHA-256 entry');
  assert.equal(match[2], executableName);
});

test('all localized landing pages keep valid repository-local links and screenshots', () => {
  for (const relativePath of ['README.md', 'README.en.md', 'README.ja.md', 'docs/ARCHITECTURE.md']) {
    const markdown = read(relativePath);
    const sourceDir = path.dirname(path.join(root, relativePath));
    const references = [
      ...markdown.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g),
      ...markdown.matchAll(/(?:src|href)="([^"#]+)(?:#[^"]+)?"/g)
    ].map((match) => match[1]);

    for (const reference of references) {
      if (/^(?:https?:|mailto:|\.\.\/\.\.\/)/i.test(reference)) continue;
      assert.ok(
        fs.existsSync(path.resolve(sourceDir, reference)),
        `${relativePath} contains a missing local reference: ${reference}`
      );
    }
  }
});

test('public repository ignores development-only capture directories', () => {
  const ignored = new Set(
    read('.gitignore')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const pattern of ['artifacts/', 'backups/', 'qa/', 'creative-output/', 'output/', 'work/', 'tmp-*.png', '__pycache__/', '*.py[cod]']) {
    assert.ok(ignored.has(pattern), `missing .gitignore entry: ${pattern}`);
  }
});

test('README screenshot set is present in the repository', () => {
  for (const name of [
    'dubstep-poster.png',
    'electro-house-capsule.png',
    'neurofunk-poster.png',
    'synthwave-fullscreen.png',
    'techno-capsule.png',
    'trance-fullscreen-split.png'
  ]) {
    assert.ok(fs.existsSync(path.join(root, 'docs', 'screenshots', name)), `missing screenshot: ${name}`);
  }
});

test('GitHub CI reproduces the Windows release checks', () => {
  assert.ok(fs.existsSync(path.join(root, '.github', 'workflows', 'windows-release-check.yml')));
  const workflow = read('.github/workflows/windows-release-check.yml');

  for (const command of ['npm ci', 'npm test', 'npm audit --audit-level=high', 'npm run dist']) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.ok(fs.existsSync(path.join(root, 'SECURITY.md')));
});
