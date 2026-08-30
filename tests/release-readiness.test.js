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

test('local rhythm enhancement is an opt-out Playback setting with a DSP fallback', () => {
  const html = read('renderer/index.html');
  const appSource = read('renderer/app.js');
  const audioSource = read('renderer/audio-engine.js');
  const mainSource = read('main.js');
  const playbackPane = html.slice(
    html.indexOf('id="settings-pane-playback"'),
    html.indexOf('id="settings-pane-genre"')
  );
  assert.match(playbackPane, /id="idle-frame-limit-toggle"[\s\S]*id="rhythm-model-toggle"[\s\S]*class="media-source-settings"/);
  assert.match(playbackPane, /id="rhythm-model-toggle"[\s\S]*role="switch"[\s\S]*aria-checked="true"/);
  assert.match(appSource, /let rhythmModelEnabled = true;/);
  assert.match(audioSource, /setRhythmModelEnabled\(enabled\)[\s\S]*this\.stopRhythmFeed\(\)/);
  assert.match(mainSource, /config\.rhythmModelEnabled = config\.rhythmModelEnabled !== false;/);
  assert.match(mainSource, /if \(typeof patch\?\.rhythmModelEnabled === 'boolean'\) safe\.rhythmModelEnabled = patch\.rhythmModelEnabled;/);
  assert.match(mainSource, /function startRhythmModel\(\) \{[\s\S]*config\.rhythmModelEnabled === false[\s\S]*type: 'disabled'/);
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

test('Windows x64 package excludes foreign ONNX Runtime binaries', () => {
  const pkg = JSON.parse(read('package.json'));
  const excluded = '!node_modules/onnxruntime-node/bin/**/*';
  const included = 'node_modules/onnxruntime-node/bin/napi-v6/win32/x64/**/*';

  assert.deepEqual(pkg.build.asarUnpack, [
    'scripts/**/*',
    'assets/**/*',
    included
  ]);
  assert.ok(pkg.build.files.indexOf(excluded) >= 0, 'foreign ONNX binaries must be excluded');
  assert.ok(
    pkg.build.files.indexOf(included) > pkg.build.files.indexOf(excluded),
    'the Windows x64 runtime must be re-included after the broad exclusion'
  );
  assert.ok(!pkg.build.files.includes('docs/**/*'), 'repository documentation must not inflate the executable');
  assert.ok(pkg.build.files.includes('!scripts/**/__pycache__/**'));
  assert.ok(pkg.build.files.includes('!scripts/**/*.pyc'));
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

  for (const pattern of ['artifacts/', 'backups/', 'qa/', 'creative-output/', 'work/', 'tmp-*.png', '__pycache__/', '*.py[cod]']) {
    assert.ok(ignored.has(pattern), `missing .gitignore entry: ${pattern}`);
  }
});

test('README screenshot set is present in the repository', () => {
  for (const name of [
    'trance-poster.png',
    'dubstep-poster.png',
    'electro-house-capsule.png',
    'neurofunk-capsule.png',
    'synthwave-capsule.png'
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
