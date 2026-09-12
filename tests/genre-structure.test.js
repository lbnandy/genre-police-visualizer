const test = require('node:test');
const assert = require('node:assert/strict');
const { DEMO_THEME_IDS, themeWithId } = require('../src/themes');
const structureModule = import('../renderer/genre-structure.mjs');
const active = { bass: 0.8, mid: 0.6, high: 0.4, volume: 0.7, rhythmPulse: 0.9, flux: 0.5, bpm: 128 };

test('fragment motion is local, audio driven, bounded and continuous at slice boundaries', async () => {
  const { fragmentProfile, fragmentMotion } = await structureModule;
  for (const id of ['breakcore']) {
    const profile = fragmentProfile(id);
    assert.ok(profile.count <= 11);
    assert.ok(Object.isFrozen(profile));
    for (let time = 0; time < 2500; time += 31) {
      let moving = 0;
      for (let index = 0; index < profile.count; index += 1) {
        const point = fragmentMotion(id, index, active, time);
        if (point.activity > 0) moving += 1;
        assert.ok(Math.hypot(point.x, point.y) <= profile.displacement * 1.3);
        const silent = fragmentMotion(id, index, {}, time);
        assert.equal(silent.activity, 0);
        assert.ok(Math.hypot(silent.x, silent.y) === 0);
      }
      assert.ok(moving <= 1);
    }
    const boundary = 60000 / active.bpm / profile.subdivisions;
    const visited = new Set();
    for (let slot = 0; slot < profile.count; slot += 1) {
      for (let index = 0; index < profile.count; index += 1) {
        if (fragmentMotion(id, index, active, (slot + 0.5) * boundary).activity > 0) visited.add(index);
      }
    }
    assert.equal(visited.size, profile.count, id);
    for (let index = 0; index < profile.count; index += 1) {
      const left = fragmentMotion(id, index, active, boundary - 0.001);
      const right = fragmentMotion(id, index, active, boundary + 0.001);
      assert.ok(Math.hypot(left.x - right.x, left.y - right.y) < 0.001);
    }
  }
});

test('related subgenres differ in structure, not only palette', async () => {
  const { genreSpectrumVariation } = await structureModule;
  for (const pair of [
    ['festival-trap', 'hybrid-trap'], ['festival-trap', 'hard-trap'],
    ['fidget-house', 'melbourne-bounce'],
    ['progressive-house', 'melodic-house'], ['afro-house', 'amapiano'],
    ['industrial-metal', 'black-metal'], ['deathcore', 'progressive-metal']
  ]) {
    assert.notDeepEqual(...pair.map(id => genreSpectrumVariation(themeWithId(id), active, 1000)), pair.join(' / '));
  }
  for (const id of DEMO_THEME_IDS) {
    const options = genreSpectrumVariation(themeWithId(id), active, 1000);
    for (const value of Object.values(options)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), id);
    }
  }
  for (const id of ['happy-hardcore', 'uk-hardcore', 'synthwave', 'neurofunk', 'psytrance', 'big-room-house']) {
    assert.deepEqual(genreSpectrumVariation(themeWithId(id), active, 1000), {}, id);
  }
});

test('classical voices sample independent registers with tapered phrasing and bounded geometry', async () => {
  const { scoreVoicePoint, scoreVoiceCount } = await structureModule;
  for (const id of ['classical', 'baroque', 'romantic-classical', 'modern-classical', 'opera']) {
    assert.ok(scoreVoiceCount(id) >= 3 && scoreVoiceCount(id) <= 5);
    for (let voice = 0; voice < scoreVoiceCount(id); voice += 1) {
      for (let progress = 0; progress <= 1; progress += 0.1) {
        const point = scoreVoicePoint(id, voice, progress, 90, { ...active, frequency: new Uint8Array(128).fill(220) }, 4500);
        assert.ok(Math.hypot(point.x, point.y) < 165, id);
        assert.ok(point.width > 0 && point.width < 4);
        assert.ok(point.alpha > 0 && point.alpha < 0.4);
      }
      const silent = scoreVoicePoint(id, voice, 0.5, 90, {}, 4500);
      const full = scoreVoicePoint(id, voice, 0.5, 90, { ...active, frequency: new Uint8Array(128).fill(220) }, 4500);
      assert.notDeepEqual(full, silent);
      assert.ok(full.width > silent.width);
    }
  }
  const frequency = new Uint8Array(128);
  const quietLow = scoreVoicePoint('classical', 0, 0.5, 90, { frequency }, 0);
  const quietHigh = scoreVoicePoint('classical', 3, 0.5, 90, { frequency }, 0);
  frequency.fill(255, 0, 23);
  assert.notDeepEqual(scoreVoicePoint('classical', 0, 0.5, 90, { frequency }, 0), quietLow);
  assert.deepEqual(scoreVoicePoint('classical', 3, 0.5, 90, { frequency }, 0), quietHigh);
});

test('fragmented signatures do not replace the established House and Bass Music renderers', async () => {
  const { visualFinish } = await import('../renderer/visual-finish.mjs');
  const { fragmentProfile, genreSpectrumVariation } = await structureModule;
  for (const id of ['electro-house', 'complextro', 'glitch-hop', 'hybrid-trap', 'fidget-house']) {
    const finish = visualFinish(themeWithId(id));
    assert.equal(fragmentProfile(id), undefined);
    assert.deepEqual(genreSpectrumVariation(themeWithId(id), active, 1000), {});
    assert.notEqual(finish.spectrum.hidden, true);
    assert.equal(finish.impact, true);
  }
  assert.equal(visualFinish(themeWithId('complextro')), visualFinish(themeWithId('electro-house')));
  const broken = visualFinish(themeWithId('breakcore'));
  assert.ok(fragmentProfile('breakcore'));
  assert.notEqual(broken.spectrum.hidden, true);
  assert.equal(broken.impact, true);
});
