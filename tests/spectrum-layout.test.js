'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('top reserved zone maps no frequency band', async () => {
  const { mapFrequencyOutsideTopGap } = await import('../renderer/spectrum-layout.mjs');
  const top = mapFrequencyOutsideTopGap(0);
  const inside = mapFrequencyOutsideTopGap(14 / 180);
  assert.deepEqual(top, { frequencyRatio: 0, response: 0 });
  assert.equal(inside.frequencyRatio, 0);
  assert.equal(inside.response, 0);
});

test('both gap edges restart from bass and reach treble at the bottom', async () => {
  const { mapFrequencyOutsideTopGap } = await import('../renderer/spectrum-layout.mjs');
  const edge = mapFrequencyOutsideTopGap(15 / 180);
  const afterFeather = mapFrequencyOutsideTopGap(20 / 180);
  const bottom = mapFrequencyOutsideTopGap(1);
  assert.equal(edge.frequencyRatio, 0);
  assert.equal(afterFeather.response, 1);
  assert.ok(afterFeather.frequencyRatio < 0.032);
  assert.deepEqual(bottom, { frequencyRatio: 1, response: 1 });
});

test('a disabled reserved zone keeps the spectrum continuous at twelve o’clock', async () => {
  const { mapFrequencyOutsideTopGap } = await import('../renderer/spectrum-layout.mjs');
  assert.deepEqual(
    mapFrequencyOutsideTopGap(0, { halfGapRatio: 0, featherRatio: 0 }),
    { frequencyRatio: 0, response: 1 }
  );
});

test('only the selected EDM styles receive a top reserved zone', async () => {
  const { genreTopFrequencyGap } = await import('../renderer/spectrum-layout.mjs');
  const kawaii = genreTopFrequencyGap({ mode: 'kawaii-bass', id: 'kawaii-bass' });
  const future = genreTopFrequencyGap({ mode: 'future-bass', id: 'future-bass' });
  const futureHouse = genreTopFrequencyGap({ mode: 'house', id: 'future-house' });
  const electroHouse = genreTopFrequencyGap({ mode: 'house', id: 'electro-house' });
  const complextro = genreTopFrequencyGap({ mode: 'house', id: 'complextro' });
  const dubstep = genreTopFrequencyGap({ mode: 'dubstep', id: 'dubstep' });
  const hardDance = genreTopFrequencyGap({ mode: 'hardcore', id: 'frenchcore' });
  const trance = genreTopFrequencyGap({ mode: 'trance', id: 'trance' });

  for (const profile of [kawaii, future, electroHouse]) {
    assert.equal(profile.topFrequencyGapRatio, 15 / 180);
    assert.equal(profile.topFrequencyGapMatchLowerAverage, true);
  }
  assert.equal(complextro.topFrequencyGapRatio, 12.5 / 180);
  assert.equal(complextro.topFrequencyGapMatchLowerAverage, true);
  assert.equal(electroHouse.topFrequencyGapShoulderSmoothing, 0);
  assert.equal(electroHouse.topFrequencyGapValleyGuard, 0);
  assert.equal(electroHouse.topFrequencyGapValleyCurve, 0);
  assert.equal(electroHouse.topFrequencyGapPreserveInteriorArc, false);
  assert.equal(electroHouse.topFrequencyGapWaveAmplitude, 2.2);
  assert.equal(complextro.topFrequencyGapWaveAmplitude, 2.5);
  assert.equal(electroHouse.topFrequencyGapNotchGuard, 0.88);
  assert.equal(electroHouse.topFrequencyGapSeamDip, 0.09);
  for (const profile of [futureHouse, dubstep, hardDance, trance]) {
    assert.equal(profile.topFrequencyGapRatio, 0);
    assert.equal(profile.topFrequencyGapLift, 0);
    assert.equal(profile.topFrequencyGapMatchLowerAverage, false);
  }
});

test('electro riff groups align their upper edges with the reserved-zone boundaries', async () => {
  const { distributeGroupsOutsideTopGap } = await import('../renderer/spectrum-layout.mjs');
  const halfGapRatio = 15 / 180;
  const groupHalfSpan = Math.PI * 2 / 6 * 0.32;
  const centers = distributeGroupsOutsideTopGap(6, halfGapRatio, groupHalfSpan);
  const rightBoundary = -Math.PI / 2 + halfGapRatio * Math.PI;
  const leftBoundary = -Math.PI / 2 - halfGapRatio * Math.PI + Math.PI * 2;

  assert.ok(Math.abs((centers[0] - groupHalfSpan) - rightBoundary) < 1e-10);
  assert.ok(Math.abs((centers.at(-1) + groupHalfSpan) - leftBoundary) < 1e-10);
  const steps = centers.slice(1).map((center, index) => center - centers[index]);
  assert.ok(steps.every((step) => Math.abs(step - steps[0]) < 1e-10));
});
