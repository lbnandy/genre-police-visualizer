'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
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
  const atmosphereEnd = visualSource.indexOf('drawSpectrumVolume(', defaultAtmosphereStart);
  assert.notEqual(atmosphereStart, -1);
  assert.notEqual(defaultAtmosphereStart, -1);
  assert.notEqual(atmosphereEnd, -1);
  const defaultAtmosphere = visualSource.slice(defaultAtmosphereStart, atmosphereEnd);
  assert.doesNotMatch(defaultAtmosphere, /ctx\.arc|strokeGlow/);
});
