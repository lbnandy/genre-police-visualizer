const test = require('node:test');
const assert = require('node:assert/strict');
const { DEMO_THEME_IDS, themeWithId } = require('../src/themes');
const finishModule = import('../renderer/visual-finish.mjs');

test('all visual finishes have bounded light gains and immutable shared profiles', async () => {
  const { visualFinish } = await finishModule;
  for (const id of DEMO_THEME_IDS) {
    const finish = visualFinish(themeWithId(id));
    assert.ok(Object.isFrozen(finish), id);
    assert.ok(Object.isFrozen(finish.spectrum), id);
    assert.ok(finish.textGlow >= 0 && finish.textGlow <= 1, id);
    assert.ok(finish.textMotion > 0 && finish.textMotion <= 1.1, id);
    assert.ok(finish.signatureBlur >= 0 && finish.signatureBlur <= 1, id);
    assert.ok(finish.maxBrightness >= 1, id);
  }
});

test('score and acoustic genres replace the membrane and generic impact with live voices', async () => {
  const { visualFinish } = await finishModule;
  for (const id of ['classical', 'baroque', 'opera', 'romantic-classical', 'modern-classical', 'folk', 'country', 'singer-songwriter', 'electro-swing']) {
    const finish = visualFinish(themeWithId(id));
    assert.equal(finish.spectrum.hidden, true, id);
    assert.equal(finish.impact, false, id);
    assert.equal(finish.atmosphere, false, id);
    assert.ok(finish.signatureAlpha > 1, id);
    assert.ok(finish.textGlow <= 0.25, id);
  }
});

test('family resemblance preserves established shape differences', async () => {
  const { visualFinish } = await finishModule;
  const house = visualFinish(themeWithId('house'));
  assert.equal(visualFinish(themeWithId('future-house')), house);
  assert.equal(visualFinish(themeWithId('tech-house')), house);
  assert.equal(house.spectrum.radius, undefined);
  assert.equal(house.spectrum.lobes, undefined);
  assert.equal(visualFinish(themeWithId('anime')).spectrum.lightBlurScale, 0);
  assert.equal(visualFinish(themeWithId('jazz-fusion')), house);
});

test('heavy titles retain motion with bounded exposure while mature scenes keep their finish', async () => {
  const { visualFinish } = await finishModule;
  for (const id of ['hardcore', 'uptempo-hardcore', 'gabber', 'rawstyle']) {
    const finish = visualFinish(themeWithId(id));
    assert.equal(finish.textMotion, 1, id);
    assert.ok(finish.maxBrightness <= 1.32, id);
    assert.equal(finish.impact, true, id);
  }
  for (const id of ['synthwave', 'trance', 'psytrance', 'neurofunk', 'liquid-dnb', 'bilibili', 'ambient']) {
    const finish = visualFinish(themeWithId(id));
    assert.deepEqual(finish.spectrum, {}, id);
    assert.equal(finish.textGlow, 1, id);
  }
});

test('localized materials reduce haze without hiding the spectrum or changing its size', async () => {
  const { visualFinish } = await finishModule;
  for (const id of ['midtempo-bass', 'moombahton', 'colour-bass', 'future-riddim', 'nu-disco', 'disco-house', 'disco-funk', 'vocaloid', 'kawaii-bass']) {
    const finish = visualFinish(themeWithId(id));
    assert.notEqual(finish.spectrum.hidden, true, id);
    assert.ok(finish.spectrum.lightBlurScale <= 0.75, id);
    assert.equal(finish.spectrum.radius, undefined, id);
    assert.equal(finish.bezel, false, id);
    assert.ok(finish.textGlow <= 0.65, id);
  }
});

test('Bass and Disco finishes retain a visible body rather than only a thin outline', async () => {
  const { visualFinish } = await finishModule;
  for (const id of ['midtempo-bass', 'moombahton', 'colour-bass', 'future-riddim', 'nu-disco', 'disco-house', 'disco-funk']) {
    const finish = visualFinish(themeWithId(id));
    assert.ok(finish.spectrum.fillAlphaScale >= 0.7, id);
    assert.ok(finish.spectrum.lightBlurScale >= 0.6, id);
    assert.equal(finish.impact, true, id);
  }
  for (const id of ['nu-disco', 'disco-house', 'disco-funk']) {
    assert.equal(visualFinish(themeWithId(id)).atmosphere, true, id);
  }
});

test('secondary bass and disco styles have distinct movement without increasing particle counts', async () => {
  const { genreMotionProfile } = await import('../renderer/genre-motion.mjs');
  const midtempo = genreMotionProfile(themeWithId('midtempo-bass'));
  const moombahton = genreMotionProfile(themeWithId('moombahton'));
  assert.equal(midtempo.kind, 'block');
  assert.equal(midtempo.flow, 'radial');
  assert.equal(moombahton.flow, 'lateral');
  assert.ok(midtempo.speed < moombahton.speed);
  assert.equal(midtempo.gravity, 0);
  assert.equal(moombahton.gravity, 0);
  for (const id of ['midtempo-bass', 'moombahton', 'nu-disco', 'disco-house', 'disco-funk', 'vocaloid']) {
    assert.ok(genreMotionProfile(themeWithId(id)).count <= 3, id);
  }
  assert.notDeepEqual(genreMotionProfile(themeWithId('nu-disco')), genreMotionProfile(themeWithId('disco-funk')));
  assert.notDeepEqual(genreMotionProfile(themeWithId('colour-bass')), genreMotionProfile(themeWithId('future-riddim')));
});

test('crystal facets and mirror highlights replace their generic decoration', async () => {
  const { visualFinish } = await finishModule;
  for (const id of ['colour-bass', 'future-riddim']) {
    assert.equal(visualFinish(themeWithId(id)).spectrum.ribs, false, id);
  }
  for (const id of ['nu-disco', 'disco-house', 'disco-funk']) {
    assert.equal(visualFinish(themeWithId(id)).spectrum.nodes, false, id);
    assert.equal(visualFinish(themeWithId(id)).spectrum.echoes, 1, id);
  }
});
