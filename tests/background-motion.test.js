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

test('Capsule lyrics truncate on one row instead of reflowing', () => {
  assert.match(appSource, /const singleLineLyrics = \['side', 'poster'\]\.includes\(document\.body\.dataset\.layout\)/);
  assert.match(css, /body\[data-layout="side"\] #lyric-current-base[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/);
  assert.match(css, /body\[data-layout="side"\] #synced-lyrics\[data-overflowing="true"\] #lyric-current-fill-content[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /body\[data-layout="side"\] #synced-lyrics[\s\S]*padding:\s*1px 14px 1px 0/);
});

test('Capsule genre background defaults on while preserving an explicit opt-out', () => {
  assert.match(mainSource, /config\.capsuleThemedBackground\s*=\s*config\.capsuleThemedBackground\s*!==\s*false/);
  assert.match(mainSource, /capsuleThemedBackground:\s*config\.capsuleThemedBackground\s*!==\s*false/);
  assert.match(appSource, /let capsuleThemedBackground\s*=\s*true/);
  assert.match(appSource, /setCapsuleThemedBackground\(config\.capsuleThemedBackground\s*!==\s*false\)/);
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
  assert.match(road, /ctx\.shadowBlur = 36 \+ lineEnergy \* 18 \+ impact \* 12/);
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
  assert.match(visualSource, /if \(!synthwaveMode\) this\.updateParticles/);
  assert.match(visualSource, /if \(!integratedTranceFx && !synthwaveMode\) this\.applyImpactPostFx/);
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
