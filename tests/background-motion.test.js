'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'app.js'), 'utf8');
const visualSource = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'visual-engine.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const backgroundRulesStart = css.indexOf('/* Poster families share the same stock');

function ruleContaining(marker) {
  const start = css.indexOf(marker, backgroundRulesStart);
  assert.notEqual(start, -1, `missing background rule for ${marker}`);
  const end = css.indexOf('\n}', start);
  assert.notEqual(end, -1, `unterminated background rule for ${marker}`);
  return css.slice(start, end);
}

test('background families keep a real alpha envelope when full-card filters are disabled', () => {
  const modes = [
    'hardcore', 'hardstyle', 'house', 'techno', 'dubstep', 'trap',
    'breakbeat', 'garage', 'trance', 'future-bass', 'pop', 'j-pop',
    'rock', 'metal', 'hip-hop', 'phonk', 'rnb', 'latin'
  ];
  for (const mode of modes) {
    const rule = ruleContaining(`[data-mode="${mode}"]`);
    assert.match(rule, /opacity:\s*(?:calc\([^;]*--poster-energy|var\(--poster-depth-opacity)/s, `${mode} needs section contrast outside filter`);
    assert.match(rule, /--poster-impact/, `${mode} needs a restrained impact response`);
  }

  for (const genre of ['synthwave', 'classical']) {
    const rule = ruleContaining(`[data-genre="${genre}"]`);
    assert.match(rule, /opacity:\s*calc\([^;]*--poster-energy/s, `${genre} needs section contrast outside filter`);
    assert.match(rule, /--poster-impact/, `${genre} needs a restrained impact response`);
  }

  const asmr = ruleContaining('[data-mode="asmr"]');
  assert.match(asmr, /opacity:\s*calc\([^;]*--poster-energy/s);
  assert.doesNotMatch(asmr, /opacity:[^;]*--poster-impact/s, 'ASMR should not flash on individual onsets');
});

test('every reviewed background family has an ambient motion source', () => {
  const markers = [
    '[data-mode="hardcore"]', '[data-mode="hardstyle"]', '[data-mode="house"]',
    '[data-mode="techno"]', '[data-mode="dubstep"]', '[data-mode="trap"]',
    '[data-mode="drum-bass"]', '[data-mode="breakbeat"]', '[data-mode="garage"]',
    '[data-mode="trance"]', '[data-genre="synthwave"]', '[data-genre="classical"]',
    '[data-mode="future-bass"]', '[data-mode="pop"]', '[data-mode="j-pop"]',
    '[data-mode="rock"]', '[data-mode="metal"]', '[data-mode="hip-hop"]',
    '[data-mode="phonk"]', '[data-mode="rnb"]', '[data-mode="latin"]',
    '[data-mode="asmr"]'
  ];
  for (const marker of markers) {
    const rule = ruleContaining(marker);
    assert.match(
      rule,
      /--poster-(?:phase|flow|wobble|float|wave|depth|swing|line-phase)/,
      `${marker} needs an independent background motion source`
    );
  }
});

test('Psytrance keeps the Trance vortex direction and curvature', () => {
  assert.doesNotMatch(appSource, /psytrance['"]?\s*\?\s*-1/);
  assert.doesNotMatch(visualSource, /psy(?:chedelic|trance)['"]?\s*\?\s*-1/);
  assert.doesNotMatch(visualSource, /psy(?:chedelic|trance)[^\n]*\?\s*4\.15/);
  assert.match(visualSource, /const armCurl = progressive \? 3\.25 : 3\.65;/);
});

test('Trance far-field arms feather away before the capsule mask boundary', () => {
  const farField = fs.readFileSync(path.join(__dirname, '..', 'assets', 'trance-far-field.svg'), 'utf8');

  assert.match(farField, /id="armFade"[\s\S]*offset="\.78"[\s\S]*offset="\.9"[^>]*stop-opacity="\.28"[\s\S]*offset="1"[^>]*stop-opacity="0"/);
  assert.match(farField, /id="particleFade"[\s\S]*offset="1"[^>]*stop-opacity="0"/);
  assert.match(farField, /<g fill="url\(#particleFade\)" opacity="\.34">/);
});

test('Trance artwork clarity follows section energy and kick impact without scaling', () => {
  assert.match(appSource, /tranceSectionClarity[\s\S]*visual\.tranceEnergy/);
  assert.match(appSource, /tranceKickClarity[\s\S]*metrics\.kickPulse/);
  assert.match(appSource, /--trance-artwork-blur/);
  assert.match(appSource, /2\.65 - tranceArtworkClarity \* 2\.2/);
  assert.match(css, /filter:\s*blur\(var\(--trance-artwork-blur\)\)/);
});

test('Trance kick impact relights particles without flashing or scaling the vortex arms', () => {
  const start = visualSource.indexOf('drawTranceAccretionVortex(');
  const end = visualSource.indexOf('drawTranceBackdropExtensions(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const tranceVortex = visualSource.slice(start, end);

  assert.match(tranceVortex, /const particleImpactLift = Math\.pow\(impactDrive, 0\.68\);/);
  assert.match(tranceVortex, /brightness\(\$\{1\.16 \+ particleImpactLift \* 0\.94\}\)/);
  assert.match(tranceVortex, /ctx\.globalAlpha = particleImpactLift \* 0\.9 \* armBrightnessScale;/);
  assert.match(tranceVortex, /ctx\.filter = `brightness\(\$\{1 \+ particleImpactLift \* 0\.42\}\)`;/);
  assert.match(tranceVortex, /ctx\.globalAlpha = 0\.78 \* armBrightnessScale;/);
  assert.doesNotMatch(tranceVortex, /this\.tranceArmCache[\s\S]{0,180}particleImpactLift/);
});

test('Capsule lyrics truncate on one row while sweep overlays clip cleanly', () => {
  assert.match(appSource, /const singleLineLyrics = \['side', 'poster'\]\.includes\(document\.body\.dataset\.layout\)/);
  assert.match(css, /body\[data-layout="side"\] #lyric-current-base[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/);
  assert.match(css, /body\[data-layout="side"\] #synced-lyrics\[data-overflowing="true"\] #lyric-current-fill-content,[\s\S]*#lyric-translation-fill-content[\s\S]*text-overflow:\s*clip/);
  assert.match(css, /body\[data-layout="side"\] #synced-lyrics[\s\S]*padding:\s*1px 14px 1px 0/);
});

test('Capsule genre background defaults on while preserving an explicit opt-out', () => {
  assert.match(mainSource, /config\.capsuleThemedBackground\s*=\s*config\.capsuleThemedBackground\s*!==\s*false/);
  assert.match(mainSource, /capsuleThemedBackground:\s*config\.capsuleThemedBackground\s*!==\s*false/);
  assert.match(appSource, /let capsuleThemedBackground\s*=\s*true/);
  assert.match(appSource, /setCapsuleThemedBackground\(config\.capsuleThemedBackground\s*!==\s*false\)/);
});

test('overflowing track titles pan to both complete endpoints without measurement restarts', () => {
  assert.match(appSource, /let titlePanAnimation = null;[\s\S]*?let titlePanSignature = '';/);
  assert.match(appSource, /const horizontalPadding = \(parseFloat\(titleStyle\.paddingLeft\) \|\| 0\)[\s\S]*?parseFloat\(titleStyle\.paddingRight\)/);
  assert.match(appSource, /const viewportWidth = Math\.max\(0, titleLabel\.clientWidth - horizontalPadding\)/);
  assert.match(appSource, /const signature = `\$\{text\.textContent\}::\$\{Math\.round\(viewportWidth\)\}::\$\{roundedDistance\}`/);
  assert.match(appSource, /if \(signature === titlePanSignature && Boolean\(titlePanAnimation\) === overflowing\) return;/);
  assert.match(appSource, /if \(current\?\.textContent === text\) \{[\s\S]*?requestAnimationFrame\(updateTitleOverflow\);[\s\S]*?return text;/);
  assert.match(appSource, /const holdMs = 2000;/);
  assert.match(appSource, /titlePanAnimation = text\.animate\(\[[\s\S]*?translateX\(-\$\{roundedDistance\}px\)[\s\S]*?translateX\(0\)[\s\S]*?iterations: Infinity/);
  assert.match(appSource, /titlePanAnimation = text\.animate\([\s\S]*?easing: 'linear'/);
  assert.match(css, /body\[data-layout="side"\] #title\s*\{[\s\S]*?padding-right:\s*24px;[\s\S]*?box-sizing:\s*border-box;/);
  assert.doesNotMatch(css, /body\[data-layout="side"\] #title\s*\{[\s\S]*?margin-left:\s*-10px;/);
  assert.match(css, /body\[data-layout="side"\] #title\.is-overflowing\s*\{[\s\S]*?mask-image:\s*linear-gradient\(to right, rgba\(0,0,0,\.68\) 0, #000 7px, #000 calc\(100% - 24px\), transparent calc\(100% - 8px\), transparent 100%\)/);
  assert.doesNotMatch(css, /#title\.is-overflowing \.title-scroll-text\s*\{[\s\S]*?animation:\s*title-pan/);
});

test('Bilibili capsule keeps a hard light stock and speech-safe one-way motion', () => {
  assert.match(
    css,
    /body\[data-background-style="themed"\] \.themed-backdrop\[data-mode="bilibili"\]\s*\{[\s\S]*?visibility:\s*hidden;[\s\S]*?opacity:\s*0\s*!important;/
  );
  assert.doesNotMatch(css, /data-mode="bilibili"\] #app::before\s*\{/);
  assert.match(
    css,
    /body\[data-layout="poster"\]\[data-mode="bilibili"\] #app\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?mask-image:\s*none;/
  );
  assert.match(
    css,
    /body\[data-idle-behavior="dim"\]\[data-playback="idle"\]\.idle-settled\[data-mode="bilibili"\]\[data-background-style="themed"\] #app\s*\{\s*opacity:\s*\.82;/
  );

  const headlineStart = css.indexOf('body[data-mode="bilibili"] #genre {');
  const headlineEnd = css.indexOf('\n}', headlineStart);
  const headline = css.slice(headlineStart, headlineEnd);
  assert.match(headline, /font-family:\s*"Righteous"/);
  assert.match(headline, /text-transform:\s*lowercase/);
  assert.match(headline, /letter-spacing:\s*-\.015em/);
  assert.match(headline, /filter:\s*none/);
  assert.doesNotMatch(headline, /drop-shadow|--genre-depth|rgba\(0,0,0/);
  assert.match(css, /body\[data-mode="bilibili"\] #hud,[\s\S]*?text-shadow:\s*none\s*!important;/);
  assert.match(css, /body\[data-layout="poster"\]\[data-mode="bilibili"\] #hud\s*\{\s*filter:\s*none;/);
  assert.match(css, /body\[data-mode="bilibili"\] \.unit-mark\s*\{[\s\S]*?box-shadow:\s*none;[\s\S]*?filter:\s*none;/);
  assert.match(visualSource, /this\.ctx = canvas\.getContext\('2d', \{ alpha: true \}\);/);
  assert.match(visualSource, /drawBilibiliStock\(metrics, time\)[\s\S]*document\.body\.dataset\.backgroundStyle !== 'themed'/);
  const stockStart = visualSource.indexOf('drawBilibiliStock(metrics, time)');
  const stockEnd = visualSource.indexOf('\n  drawAtmosphere', stockStart);
  const stock = visualSource.slice(stockStart, stockEnd);
  assert.doesNotMatch(stock, /ctx\.filter|metrics\.(?:volume|mid|high)/);
  assert.match(stock, /const bandAmplitude = 1\.6[\s\S]*?bilibiliSectionDrive \* 4\.2[\s\S]*?bilibiliTransientDrive \* 4\.8/);
  assert.match(stock, /const bandDrift = Math\.sin\(time \* 0\.00034\) \* bandAmplitude/);
  assert.match(stock, /const pinkBandOffset = width \* 0\.06;/);
  assert.match(stock, /width \* 0\.13 \+ pinkBandOffset \+ bandDrift[\s\S]*?width \* 0\.03 \+ pinkBandOffset \+ bandDrift/);
  assert.doesNotMatch(stock, /rgba\(255, 255, 255, 0\.28\)|for \(let line = -2/);
  assert.match(visualSource, /if \(bilibiliMode\) \{\s*this\.updateBilibiliResponse\(energyMetrics, time\);\s*this\.drawBilibiliStock\(energyMetrics, time\);/);
  assert.match(visualSource, /if \(!synthwaveMode && !bilibiliMode\) this\.featherCanvasEdges\(x, y\);/);
  assert.match(visualSource, /const bilibiliDanmakuCount = 22;[\s\S]*?const bilibiliDanmakuLanes = 9;/);
  assert.match(visualSource, /this\.bilibiliDanmaku = Array\.from\(\{ length: bilibiliDanmakuCount \}/);
  assert.match(visualSource, /const lane = index % bilibiliDanmakuLanes;[\s\S]*?const laneSlots = Math\.ceil/);
  assert.match(visualSource, /progress:\s*\(laneSlot \/ laneSlots \+ sample\(4\) \* 0\.06\) % 1/);
  assert.match(visualSource, /alpha:\s*0\.078 \+ sample\(6\) \* 0\.07/);
  assert.match(visualSource, /spawnAt:\s*0\.2 \+ sample\(7\) \* 0\.72/);
  assert.match(visualSource, /this\.bilibiliVoiceActivity = follow\([\s\S]*?260, 920\)/);
  assert.match(visualSource, /this\.bilibiliSectionDrive = follow\([\s\S]*?780, 1450\)/);
  assert.match(visualSource, /this\.bilibiliTransientDrive = follow\([\s\S]*?90, 480\)/);
  assert.match(visualSource, /item\.progress = \(item\.progress \+ deltaMs \* speed \/ cycleWidth\) % 1;/);
  assert.match(visualSource, /const cycleWidth = width \+ 92 \+ 36;[\s\S]*?const entryX = bounds\.right \+ 18;/);
  assert.match(visualSource, /const itemX = entryX - distance;/);
  assert.match(visualSource, /const population = clamp\([\s\S]*?bilibiliSectionDrive \* 0\.58[\s\S]*?bilibiliTransientDrive \* 0\.5/);
  assert.match(visualSource, /const speed = item\.speed \+ \(motionDrive \*\* 1\.35\) \* 0\.07/);
  assert.match(visualSource, /item\.active = item\.spawnAt <= population/);
  const atmosphereStart = visualSource.indexOf("if (theme.mode === 'bilibili')", visualSource.indexOf('drawAtmosphere'));
  const atmosphereEnd = visualSource.indexOf("if (theme.mode === 'trance'", atmosphereStart);
  const atmosphere = visualSource.slice(atmosphereStart, atmosphereEnd);
  assert.doesNotMatch(atmosphere, /Math\.sin|itemX\s*\+=|itemY\s*\+=/);
  assert.match(atmosphere, /ctx\.fillStyle = rgba\(color, item\.alpha\)/);
  assert.doesNotMatch(atmosphere, /const alpha\s*=|item\.alpha\s*\+/);
  assert.match(visualSource, /!integratedTranceFx && !synthwaveMode && !bilibiliMode && motionElapsed/);
  assert.match(visualSource, /if \(!synthwaveMode && !bilibiliMode\) this\.updateParticles/);
  assert.match(visualSource, /if \(!integratedTranceFx && !synthwaveMode && !bilibiliMode\) \{/);
  assert.match(appSource, /if \(tranceMode \|\| synthwaveMode \|\| bilibiliMode\) \{[\s\S]*?coreScale = 1;/);
  assert.match(appSource, /else if \(bilibiliMode\) \{\s*coreArt\.style\.transform = `scale\(\$\{visual\.bilibiliTvScaleX/);
  assert.match(appSource, /const bilibiliGenreTarget = playbackActive[\s\S]*?bilibiliSectionDrive \* 0\.028[\s\S]*?bilibiliTransientDrive \* 0\.05/);
  const bilibiliSignatureStart = visualSource.indexOf("} else if (mode === 'bilibili')", visualSource.indexOf('drawGenreSignature'));
  const bilibiliSignatureEnd = visualSource.indexOf("} else if (mode === 'hardcore')", bilibiliSignatureStart);
  const bilibiliSignature = visualSource.slice(bilibiliSignatureStart, bilibiliSignatureEnd);
  assert.match(bilibiliSignature, /ctx\.scale\(this\.bilibiliTvScaleX, this\.bilibiliTvScaleY\)/);
  assert.match(bilibiliSignature, /const frameWidth = 174/);
  assert.match(bilibiliSignature, /const progressY = frameTop \+ frameHeight - 14/);
  assert.match(bilibiliSignature, /const progressWidth = 112/);
  assert.match(bilibiliSignature, /const playhead = clamp\(0\.1 \+ activity \* 0\.06 \+ section \* 0\.62 \+ transient \* 0\.26\)/);
  assert.doesNotMatch(bilibiliSignature, /const playhead = \(time|addColorStop\(0\.5, '#ffffff'\)|ctx\.arc\(-38, antennaTop|ctx\.arc\(40, antennaTop/);
  assert.doesNotMatch(bilibiliSignature, /for \(let dot = 0; dot < 2; dot \+= 1\)/);
  assert.match(bilibiliSignature, /ctx\.fillStyle = theme\.accent;[\s\S]*?ctx\.arc\(-65, progressY/);

  const faceStart = css.indexOf('body[data-mode="bilibili"] #genre-face {');
  const faceEnd = css.indexOf('\n}', faceStart);
  const face = css.slice(faceStart, faceEnd);
  assert.match(face, /background:\s*none/);
  assert.match(face, /-webkit-text-fill-color:\s*#fb7299/);
  assert.match(face, /-webkit-text-stroke:\s*0/);
  assert.doesNotMatch(face, /gradient/);

  const artworkStart = css.indexOf('body[data-mode="bilibili"] #core-art {');
  const artworkEnd = css.indexOf('\n}', artworkStart);
  const artwork = css.slice(artworkStart, artworkEnd);
  assert.match(artwork, /border:\s*0/);
  assert.match(artwork, /box-shadow:\s*none/);
});

test('bright and organic genres use tailored full-card backdrop stock', () => {
  assert.match(
    css,
    /\.themed-backdrop:is\([\s\S]*?\[data-mode="future-bass"\][\s\S]*?\[data-mode="kawaii-bass"\][\s\S]*?\[data-mode="pop"\][\s\S]*?\[data-mode="j-pop"\][\s\S]*?#09121c/
  );
  assert.match(
    css,
    /\[data-genre="happy-hardcore"\][\s\S]*?\[data-genre="euphoric-hardstyle"\][\s\S]*?\[data-genre="colour-bass"\]/
  );
  assert.match(
    css,
    /\.themed-backdrop:is\([\s\S]*?\[data-genre="rock"\][\s\S]*?\[data-genre="pop-rock"\][\s\S]*?\[data-genre="punk"\][\s\S]*?#140c0e/
  );
  assert.match(
    css,
    /\.themed-backdrop:is\([\s\S]*?\[data-genre="tropical-house"\][\s\S]*?\[data-genre="city-pop"\][\s\S]*?\[data-genre="folk"\][\s\S]*?\[data-genre="country"\][\s\S]*?\[data-genre="reggae"\][\s\S]*?\[data-genre="electro-swing"\][\s\S]*?\[data-mode="latin"\][\s\S]*?#170e0f/
  );
  assert.match(
    css,
    /\.themed-backdrop:is\([\s\S]*?\[data-genre="rnb"\][\s\S]*?\[data-genre="jazz"\][\s\S]*?#140b15/
  );
  assert.match(
    css,
    /body\[data-background-style="themed"\] \.themed-backdrop\s*\{[\s\S]*?--tonal-well-shape:\s*circle 124px;/
  );
  assert.match(
    css,
    /body\[data-layout="side"\]\[data-background-style="themed"\] \.themed-backdrop\s*\{[\s\S]*?--tonal-well-shape:\s*circle 106px;/
  );
  const tonalStockStart = css.indexOf('/* Brighter genres need coloured stock');
  const tonalStockEnd = css.indexOf('body[data-background-style="themed"] #poster-backdrop', tonalStockStart);
  const tonalStock = css.slice(tonalStockStart, tonalStockEnd);
  assert.equal((tonalStock.match(/radial-gradient\(var\(--tonal-well-shape\)/g) || []).length, 3);
  assert.match(
    tonalStock,
    /\[data-genre="rock"\][\s\S]*?radial-gradient\(ellipse 84% 56%[^\n]+rgba\(2,4,9,\.6\)/
  );
  assert.equal((tonalStock.match(/radial-gradient\(ellipse[^\n]+rgba\(/g) || []).length, 1);
});

test('Missing artwork uses a flat badge and Phonk background has no concentric membrane', () => {
  const flatBadgeStart = css.indexOf('/* Missing artwork uses a flat badge');
  const flatBadgeEnd = css.indexOf('#artwork.loaded + #monogram', flatBadgeStart);
  assert.notEqual(flatBadgeStart, -1);
  assert.notEqual(flatBadgeEnd, -1);
  const flatBadge = css.slice(flatBadgeStart, flatBadgeEnd);
  assert.doesNotMatch(flatBadge, /radial-gradient|inset\s/);
  assert.match(flatBadge, /text-shadow:\s*none/);
  assert.match(visualSource, /else if \(mode === 'phonk'\)[\s\S]*ridgeDepths:\s*\[\],\s*hideInnerEdge:\s*true,\s*hideBandFill:\s*true/);
  assert.match(visualSource, /if \(!options\.hideBandFill\) \{[\s\S]*const shadowFill/);
  assert.match(visualSource, /if \(!options\.hideBandFill\) \{[\s\S]*const fill = ctx\.createRadialGradient/);
  const phonkBackgroundStart = css.indexOf('body[data-background-style="themed"] .themed-backdrop[data-mode="phonk"]::before');
  const phonkBackgroundEnd = css.indexOf('\n}', phonkBackgroundStart);
  assert.notEqual(phonkBackgroundStart, -1);
  assert.notEqual(phonkBackgroundEnd, -1);
  const phonkBackground = css.slice(phonkBackgroundStart, phonkBackgroundEnd);
  assert.doesNotMatch(phonkBackground, /radial-gradient\(ellipse 72% 37%/);
  assert.doesNotMatch(phonkBackground, /radial-gradient\(ellipse 70% 35%/);
  assert.match(phonkBackground, /repeating-linear-gradient\(0deg/);
  assert.match(phonkBackground, /radial-gradient\(ellipse 68% 17%/);
  const phonkStart = visualSource.indexOf("} else if (mode === 'phonk')", visualSource.indexOf('drawGenreSignature'));
  const phonkEnd = visualSource.indexOf("} else if (mode === 'hip-hop')", phonkStart);
  assert.notEqual(phonkStart, -1);
  assert.notEqual(phonkEnd, -1);
  const phonkSignature = visualSource.slice(phonkStart, phonkEnd);
  assert.doesNotMatch(phonkSignature, /loopOuter|trackingCount|strokeContourSegment|ctx\.arc/);
  assert.match(phonkSignature, /const sampleSlices = driftPhonk/);
  assert.match(phonkSignature, /const activeSlice = Math\.floor/);
  assert.match(phonkSignature, /const grainCount = driftPhonk \? 12 : 9/);
  assert.doesNotMatch(phonkSignature, /subHaze|ctx\.ellipse/);
  assert.match(visualSource, /else if \(mode === 'phonk'\)[\s\S]*gravitySag:\s*driftPhonk \? 5\.5 : 9/);
  assert.match(visualSource, /else if \(mode === 'phonk'\)[\s\S]*outerBodyWidth:\s*driftPhonk \? 14 : 18/);
  assert.doesNotMatch(visualSource, /fillToCenter|centerFill/);
  assert.match(phonkSignature, /const sampleBed = spectrumShell[\s\S]*const slicePath = \(dx = 0, dy = 0\)/);
  assert.match(visualSource, /if \(\(options\.outerBodyWidth \|\| 0\) > 0\)[\s\S]*const bodyInk = ctx\.createConicGradient/);
  assert.doesNotMatch(visualSource, /phonk: theme\.id === 'drift-phonk'[\s\S]{0,500}broken:/);
});

test('the shared atmosphere has no rotating C-shaped bezel', () => {
  const atmosphereStart = visualSource.indexOf('drawAtmosphere(x, y, theme, metrics, time)');
  const defaultAtmosphereStart = visualSource.indexOf('this.glowCircle(x, y, 154 + metrics.bass * 20', atmosphereStart);
  const atmosphereEnd = visualSource.indexOf('drawSynthwaveHorizonScene(', defaultAtmosphereStart);
  assert.notEqual(atmosphereStart, -1);
  assert.notEqual(defaultAtmosphereStart, -1);
  assert.notEqual(atmosphereEnd, -1);
  const defaultAtmosphere = visualSource.slice(defaultAtmosphereStart, atmosphereEnd);
  assert.doesNotMatch(defaultAtmosphere, /ctx\.arc|strokeGlow/);
});

test('Genre Police keeps two patrol lights without the extra scanner or lyric overlay', () => {
  const overlayStart = visualSource.indexOf('drawGenrePoliceOverlay(');
  const overlayEnd = visualSource.indexOf('drawTranceAccretionVortex(', overlayStart);
  assert.notEqual(overlayStart, -1);
  assert.notEqual(overlayEnd, -1);
  const overlay = visualSource.slice(overlayStart, overlayEnd);

  assert.match(overlay, /for \(const \[index, color\] of \[red, blue\]\.entries\(\)\)/);
  assert.doesNotMatch(overlay, /Radar sector|const radar|radius \+ 3, 0/);
  assert.doesNotMatch(html, /special-alert|GENRE VIOLATION/);
  assert.doesNotMatch(appSource, /is-police-word|activePoliceMotionUnit/);
  assert.doesNotMatch(css, /special-beacon|police-word/);
});

test('Synthwave uses one audio-reactive sunset plane without a foreground visualizer', () => {
  const sunMarker = 'body[data-background-style="themed"] .themed-backdrop[data-genre="synthwave"]::before';
  const sceneMarker = 'body[data-background-style="themed"] .themed-backdrop[data-genre="synthwave"] {';
  const gridMarker = 'body[data-background-style="themed"] .themed-backdrop[data-genre="synthwave"]::after';
  const sunStart = css.indexOf(sunMarker);
  const sceneStart = css.indexOf(sceneMarker);
  const gridStart = css.indexOf(gridMarker);
  assert.notEqual(sunStart, -1);
  assert.notEqual(sceneStart, -1);
  assert.notEqual(gridStart, -1);
  const sunRule = css.slice(sunStart, css.indexOf('\n}', sunStart));
  const sceneRule = css.slice(sceneStart, css.indexOf('\n}', sceneStart));
  const gridRule = css.slice(gridStart, css.indexOf('\n}', gridStart));
  assert.match(sunRule, /content:\s*none/);
  assert.match(sceneRule, /--synth-horizon-y/);
  assert.match(sceneRule, /#780066 var\(--synth-horizon-y\)/);
  assert.match(sceneRule, /#3b075e calc\(var\(--synth-horizon-y\) \+ 12%\)/);
  assert.match(sceneRule, /#10204b calc\(var\(--synth-horizon-y\) \+ 30%\)/);
  assert.match(sceneRule, /#02091f 100%/);
  assert.doesNotMatch(sceneRule, /rgba\(255,255,255|background-size:[^;]*(?:47px|79px)/);
  assert.match(css, /body\[data-layout="side"\][^{]+data-genre="synthwave"[^}]+--synth-horizon-y:\s*var\(--synth-capsule-horizon-y, 53%\)/);
  assert.equal((html.match(/synth-starfield--far/g) || []).length, 2);
  assert.equal((html.match(/synth-starfield--near/g) || []).length, 2);
  assert.doesNotMatch(html, /synth-sun-lines/);
  const starStart = css.indexOf('.themed-backdrop[data-genre="synthwave"] .synth-starfield {');
  const starEnd = css.indexOf('\n}', starStart);
  assert.notEqual(starStart, -1);
  const starRule = css.slice(starStart, starEnd);
  assert.match(starRule, /height:\s*var\(--synth-horizon-y\)/);
  assert.match(starRule, /--poster-energy/);
  assert.match(starRule, /--poster-impact/);
  assert.match(starRule, /opacity:\s*clamp\(\.58, calc\(\.64 \+ var\(--poster-energy\) \* \.34 \+ var\(--poster-impact\) \* \.16\), 1\)/);
  assert.match(starRule, /filter:\s*brightness\(calc\(\.9 \+ var\(--poster-energy\) \* \.88 \+ var\(--poster-impact\) \* \.76\)\)/);
  assert.match(appSource, /function createSynthStars\(\)/);
  assert.match(appSource, /const count = near \? 18 : 56/);
  assert.match(appSource, /Math\.pow\(random\(\), 1\.8\) \* 84/);
  assert.match(appSource, /near \? 1\.3 \+ random\(\) \* 1\.5 : 0\.65 \+ random\(\) \* 0\.9/);
  assert.match(appSource, /--star-alpha', \(0\.5 \+ random\(\) \* 0\.5\)/);
  assert.match(appSource, /--star-duration/);
  assert.match(css, /@keyframes synth-star-twinkle/);
  assert.match(css, /opacity:\s*calc\(var\(--star-alpha\) \* \.38\)/);
  assert.doesNotMatch(appSource, /is-flare/);
  assert.doesNotMatch(css, /synth-star\.is-flare/);
  assert.doesNotMatch(appSource, /createSynthSunLines|synth-sun-line-rise|createElementNS/);
  assert.match(gridRule, /content:\s*none/);
  assert.doesNotMatch(gridRule, /background-position\s*:|animation\s*:|transform\s*:|repeating-linear-gradient\(/);
  assert.doesNotMatch(css, /@keyframes synth-grid-forward/);
  const roadStart = visualSource.indexOf('drawSynthwaveHorizonScene(');
  const roadEnd = visualSource.indexOf('\n  drawSpectrumVolume(', roadStart);
  assert.notEqual(roadStart, -1);
  assert.notEqual(roadEnd, -1);
  const road = visualSource.slice(roadStart, roadEnd);
  assert.match(visualSource, /resolveSynthwaveHorizonY\(bounds, posterLayout, time\)/);
  assert.match(visualSource, /document\.querySelector\('\.track-rule'\)/);
  assert.match(visualSource, /progressBounds\.top \+ progressBounds\.height \* 0\.5 - canvasBounds\.top/);
  assert.match(visualSource, /document\.body\.style\.setProperty\(\s*'--synth-capsule-horizon-y'/);
  assert.match(road, /const horizonY = this\.resolveSynthwaveHorizonY\(bounds, posterLayout, time\)/);
  assert.match(road, /this\.synthGridPhase[\s\S]*0\.00015 \+ gridMotion \* 0\.00074 \+ impact \* 0\.00035/);
  assert.match(road, /this\.synthSunScanPhase[\s\S]*0\.000052 \+ sunMotion \* 0\.00012 \+ impact \* 0\.00006/);
  assert.match(road, /const rowCount = posterLayout \? 14 : 11/);
  assert.match(road, /const horizonLaneSpacing = posterLayout \? 32 : 38/);
  assert.match(road, /const perspective = depth \*\* 2\.28/);
  assert.match(road, /const horizonSpread = 0\.29/);
  assert.match(road, /endX:\s*x \+ \(laneHorizonX - x\) \/ horizonSpread/);
  assert.match(road, /ctx\.moveTo\(lane\.horizonX, horizonY\)/);
  assert.match(road, /ctx\.moveTo\(bounds\.left, row\.y\);\s*ctx\.lineTo\(bounds\.right, row\.y\)/);
  assert.match(road, /roadCore\.addColorStop\(0, rgba\(theme\.accent, 0\.7/);
  assert.match(road, /roadCore\.addColorStop\(0\.52, rgba\('#b22bd8', 0\.46/);
  assert.match(road, /roadGlow\.addColorStop\(0\.68, rgba\('#5c49e4', 0\.15/);
  assert.match(road, /roadGlow\.addColorStop\(1, rgba\('#4f7cff', 0\.22/);
  assert.match(road, /roadCore\.addColorStop\(0\.68, rgba\('#5c49e4', 0\.42/);
  assert.match(road, /roadCore\.addColorStop\(1, rgba\('#4f7cff', 0\.52/);
  assert.match(road, /groundReflection\.addColorStop\(0, rgba\('#ffd5a6', 0\.16/);
  assert.match(road, /longitudinalReflection\.addColorStop\(0, rgba\('#ffe0a8', 0\.86/);
  assert.match(road, /crossReflection\.addColorStop\(0\.5, rgba\('#ffd7a0', 0\.84/);
  assert.doesNotMatch(road, /#fff0c8/);
  assert.doesNotMatch(road, /roadCore\.addColorStop[^\n]*#ffe0ee/);
  assert.doesNotMatch(road, /road(?:Glow|Core)\.addColorStop[^\n]*theme\.hot/);
  assert.match(road, /ctx\.lineWidth = 0\.82/);
  assert.match(road, /const foreground = this\.synthForegroundCtx/);
  assert.match(road, /foreground\.globalCompositeOperation = 'destination-out'/);
  assert.match(road, /foreground\.fillRect\(\s*x - sunRadius - 1/);
  assert.match(road, /ctx\.rect\(bounds\.left, bounds\.top, bounds\.right - bounds\.left, horizonY - bounds\.top\)/);
  assert.match(road, /ctx\.drawImage\(this\.synthForegroundCanvas, 0, 0, this\.width, this\.height\)/);
  assert.match(road, /const scanLineCount = 5/);
  assert.match(road, /const exitFade = 1 - smoothstep\(0\.68, 1, progress\)/);
  assert.match(road, /const gapHeight = \(1\.2 \+ \(1 - travel\) \* 5\.4\) \* entryFade \* exitFade/);
  assert.match(road, /const mountainGap = sunRadius \* 0\.58;/);
  assert.match(road, /const farMountainHeight = posterLayout \? 40 : 30;/);
  assert.match(road, /const nearMountainHeight = posterLayout \? 58 : 42;/);
  assert.match(road, /const drawMountainRange = \(\{ startX, endX, height, profile, near, facetDirection \}\) =>/);
  assert.match(road, /farLeft:[\s\S]*farRight:[\s\S]*nearLeft:[\s\S]*nearRight:/);
  assert.equal((road.match(/drawMountainRange\(\{/g) || []).length, 4);
  assert.match(road, /const peakFacets = \[\];[\s\S]*const lightFace = facetDirection > 0[\s\S]*const shadowFace = facetDirection > 0/);
  assert.match(road, /ctx\.shadowColor = 'rgba\(2, 1, 14, 0\.48\)'[\s\S]*ctx\.shadowOffsetY = near \? 2 : 1/);
  assert.match(road, /const footing = ctx\.createLinearGradient\(0, horizonY - 2, 0, horizonY \+ \(near \? 8 : 5\)\)/);
  assert.match(road, /endX: x - mountainGap \* 0\.72/);
  assert.match(road, /startX: x \+ mountainGap \* 0\.72/);
  assert.match(road, /endX: x - mountainGap \* 0\.96/);
  assert.match(road, /startX: x \+ mountainGap \* 0\.96/);
  assert.match(road, /farLeft:[^\n]*\[0\.92, 0\.17\], \[1, 0\.025\]/);
  assert.match(road, /nearRight:[^\n]*\[0, 0\.025\], \[0\.06, 0\.13\]/);
  const mountainScene = road.slice(
    road.indexOf('// Low polygon ridges'),
    road.indexOf('// The road keeps its fixed geometry')
  );
  assert.match(mountainScene, /#10143b/);
  assert.match(mountainScene, /#181a4b/);
  assert.doesNotMatch(mountainScene, /theme\.hot/);
  assert.match(road, /const mountainHaze = ctx\.createLinearGradient\(0, horizonY - 34, 0, horizonY \+ 10\)/);
  assert.match(road, /mountainHaze\.addColorStop\(0\.78, rgba\('#ff65bd', 0\.2/);
  assert.match(road, /ctx\.filter = 'blur\(4px\)'/);
  assert.match(road, /horizonGlow\.addColorStop\(0\.5, rgba\('#ffe1ef', 0\.52/);
  assert.match(road, /ctx\.strokeStyle = rgba\('#ff63ca', 0\.18[\s\S]*ctx\.lineWidth = 6;/);
  assert.match(road, /ctx\.shadowBlur = 46 \+ lineEnergy \* 20 \+ impact \* 12;/);
  assert.match(road, /const artworkLayer = this\.synthArtworkCtx/);
  assert.match(road, /const artworkRadius = sunRadius/);
  assert.match(road, /artworkLayer\.arc\(x, y, artworkRadius, 0, TAU\);\s*artworkLayer\.clip\(\)/);
  assert.match(road, /artworkLayer\.globalAlpha = 0\.15/);
  assert.doesNotMatch(road, /artworkFeather/);
  assert.match(road, /foreground\.drawImage\(this\.synthArtworkCanvas/);
  assert.match(road, /const horizonGlow = ctx\.createLinearGradient/);
  assert.match(road, /ctx\.moveTo\(bounds\.left, horizonY\);\s*ctx\.lineTo\(bounds\.right, horizonY\)/);
  assert.match(road, /const longitudinalReflection = ctx\.createLinearGradient/);
  assert.match(road, /const reflectionFloorHalfWidth = roadWidth \* 0\.4/);
  assert.match(road, /const reflectionDepthRatio = 0\.72/);
  assert.match(road, /const reflectionEndY = horizonY \+ reflectionDepth/);
  assert.match(road, /const reflectionNeckProgress = 0\.84/);
  assert.match(road, /const reflectionTailHalfWidth = roadWidth \* 0\.045/);
  assert.match(road, /const reflectionHalfWidthAt = \(progress\) =>/);
  assert.match(road, /const bodyTaper = Math\.pow\(smoothstep\(0, 1, bodyProgress\), 1\.35\)/);
  assert.match(road, /const capProgress = \(normalized - reflectionNeckProgress\)/);
  assert.match(road, /Math\.sqrt\(Math\.max\(0, 1 - capProgress \* capProgress\)\)/);
  assert.match(road, /const reflectionEnvelopeSteps = 32/);
  assert.match(road, /const traceReflectionEnvelope = \(\) =>/);
  assert.match(road, /const groundReflection = ctx\.createLinearGradient/);
  assert.match(road, /blur\(\$\{\(16 \+ lineEnergy \* 6 \+ impact \* 3\)/);
  assert.match(road, /const longitudinalSegments = 16/);
  assert.match(road, /ctx\.lineCap = 'butt'/);
  assert.match(road, /const edgeFade = 1 - smoothstep\(0\.68, 1\.08, distance\)/);
  assert.doesNotMatch(road, /traceReflectionEnvelope\(\);\s*ctx\.clip\(\)/);
  assert.match(road, /const crossReflection = ctx\.createLinearGradient/);
  assert.match(road, /const reflectionProgress = row\.perspective \/ reflectionDepthRatio/);
  assert.match(road, /const halfWidth = reflectionHalfWidthAt\(reflectionProgress\)/);
  assert.match(road, /ctx\.globalAlpha = edgeFade \* reflection\s*\* \(0\.58 \+ lineEnergy \* 0\.28 \+ impact \* 0\.12\)/);
  assert.match(road, /ctx\.globalAlpha = \(0\.58 \+ lineEnergy \* 0\.28 \+ impact \* 0\.12\)/);
  assert.match(road, /1 - smoothstep\(0\.78, 1, reflectionProgress\)/);
  assert.match(road, /ctx\.shadowBlur = 46 \+ lineEnergy \* 20 \+ impact \* 12/);
  assert.doesNotMatch(road, /const profile|spectrumSpan|metrics\.frequency|traceProfile/);

  const signatureStart = visualSource.indexOf('if (synthwave) {', visualSource.indexOf('drawGenreSignature'));
  const signatureEnd = visualSource.indexOf('} else if (orchestral)', signatureStart);
  assert.notEqual(signatureStart, -1);
  assert.notEqual(signatureEnd, -1);
  const signature = visualSource.slice(signatureStart, signatureEnd);
  assert.match(signature, /full-width horizon background/);
  assert.doesNotMatch(signature, /scanPhase|sweepAngle|ctx\.arc|arpSteps|reflectionColumns|horizonReach/);
  assert.match(visualSource, /if \(theme\.id === 'synthwave'\) \{\s*this\.lastSpectrum = null;\s*return;/);
  assert.match(visualSource, /if \(mode === 'asmr' \|\| theme\.id === 'synthwave'\) return;/);
  assert.match(visualSource, /if \(!synthwaveMode\) this\.drawAtmosphere/);
  assert.match(visualSource, /if \(!synthwaveMode && !bilibiliMode\) this\.updateParticles/);
  assert.match(visualSource, /if \(!integratedTranceFx && !synthwaveMode && !bilibiliMode\) \{/);
  assert.match(css, /data-background-style="themed"[^\n]+data-genre="synthwave"[^\n]+#core-art[\s\S]*opacity:\s*0;[\s\S]*visibility:\s*hidden/);
  assert.match(appSource, /else if \(synthwaveMode\) \{\s*coreArt\.style\.transform = 'scale\(1\)'/);
  assert.match(appSource, /artwork: theme\.captureArtwork \|\| currentMetadata\?\.artwork \|\| ''/);
  const applyLayoutStart = appSource.indexOf('function applyLayoutMode(value)');
  const layoutFrameStart = appSource.indexOf('requestAnimationFrame(() => {', applyLayoutStart);
  const synchronousResize = appSource.indexOf('visual.resize();', applyLayoutStart);
  assert.notEqual(applyLayoutStart, -1);
  assert.notEqual(layoutFrameStart, -1);
  assert.ok(synchronousResize > applyLayoutStart && synchronousResize < layoutFrameStart);
  assert.match(css, /body\.layout-switching #hud \{\s*transition: none;/);
  const chooseLayoutStart = appSource.indexOf('async function chooseLayoutMode(value)');
  const chooseLayoutEnd = appSource.indexOf('\n}', chooseLayoutStart);
  const chooseLayout = appSource.slice(chooseLayoutStart, chooseLayoutEnd);
  assert.ok(chooseLayout.indexOf('window.genrePolice.setLayoutMode(requested)')
    < chooseLayout.indexOf('applyLayoutMode(result?.mode)'));
  assert.doesNotMatch(chooseLayout, /applyLayoutMode\(requested\)/);
  assert.match(mainSource, /resizeMainWindow\([\s\S]*\{ animate: false \}[\s\S]*webContents\.send\('layout-mode'/);
});
