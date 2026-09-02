'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('shared impact post-effects scale continuously and differ by genre family', async () => {
  const { resolveImpactFx } = await import('../renderer/impact-fx.mjs');
  const quiet = resolveImpactFx({ mode: 'hardcore' }, { rhythmPulse: 0.05 });
  const medium = resolveImpactFx({ mode: 'hardcore' }, { rhythmPulse: 0.55 });
  const strong = resolveImpactFx({ mode: 'hardcore' }, { rhythmPulse: 0.95 });
  assert.equal(quiet.amount, 0);
  assert.ok(medium.amount > quiet.amount && strong.amount > medium.amount);
  assert.ok(strong.slice > strong.blur);

  const bilibili = resolveImpactFx(
    { mode: 'bilibili' },
    { rhythmPulse: 1, rhythmNow: true, rhythmStrength: 1 }
  );
  assert.deepEqual(bilibili, {
    amount: 0, bloom: 0, blur: 0, echo: 0, chroma: 0, slice: 0, exposure: 1, saturation: 1
  });

  const futureBass = resolveImpactFx({ mode: 'future-bass' }, { rhythmPulse: 0.95 });
  assert.ok(futureBass.blur > strong.blur);
  assert.ok(futureBass.bloom > strong.bloom);
  assert.ok(futureBass.slice < strong.slice);

  const ukHardcore = resolveImpactFx({ id: 'uk-hardcore', mode: 'hardcore' }, { rhythmPulse: 0.95 });
  assert.ok(ukHardcore.slice < strong.slice);
  assert.ok(ukHardcore.chroma < strong.chroma);

  const hardstyle = resolveImpactFx({ id: 'hardstyle', mode: 'hardstyle' }, { rhythmPulse: 0.95 });
  const rawstyle = resolveImpactFx({ id: 'rawstyle', mode: 'hardstyle' }, { rhythmPulse: 0.95 });
  const euphoric = resolveImpactFx({ id: 'euphoric-hardstyle', mode: 'hardstyle' }, { rhythmPulse: 0.95 });
  const industrial = resolveImpactFx({ id: 'industrial-hardcore', mode: 'hardcore' }, { rhythmPulse: 0.95 });
  assert.ok(rawstyle.slice > hardstyle.slice);
  assert.ok(rawstyle.chroma > hardstyle.chroma);
  assert.ok(euphoric.bloom > hardstyle.bloom);
  assert.ok(euphoric.blur > hardstyle.blur);
  assert.ok(euphoric.slice < hardstyle.slice);
  assert.ok(industrial.saturation < strong.saturation);

  const dubstep = resolveImpactFx({ id: 'dubstep', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  const brostep = resolveImpactFx({ id: 'brostep', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  const deathstep = resolveImpactFx({ id: 'deathstep', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  const riddim = resolveImpactFx({ id: 'riddim', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  const colourBass = resolveImpactFx({ id: 'colour-bass', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  const melodicDubstep = resolveImpactFx({ id: 'melodic-dubstep', mode: 'dubstep' }, { rhythmPulse: 0.95 });
  assert.ok(brostep.chroma > dubstep.chroma);
  assert.ok(deathstep.slice > brostep.slice);
  assert.ok(riddim.blur < dubstep.blur);
  assert.ok(colourBass.blur > dubstep.blur);
  assert.ok(colourBass.saturation > dubstep.saturation);
  assert.ok(melodicDubstep.slice < colourBass.slice);

  const hipHop = resolveImpactFx({ id: 'hip-hop', mode: 'hip-hop' }, { rhythmPulse: 0.95 });
  const edmTrap = resolveImpactFx({ id: 'trap-edm', mode: 'trap' }, { rhythmPulse: 0.95 });
  assert.ok(hipHop.echo < edmTrap.echo);
  assert.ok(hipHop.chroma < edmTrap.chroma);
  assert.ok(hipHop.slice < edmTrap.slice);

  const ambient = resolveImpactFx({ id: 'ambient', mode: 'ambient' }, { rhythmPulse: 0.95 });
  const downtempo = resolveImpactFx({ id: 'downtempo', mode: 'ambient' }, { rhythmPulse: 0.95 });
  const lofi = resolveImpactFx({ id: 'lo-fi-hip-hop', mode: 'hip-hop' }, { rhythmPulse: 0.95 });
  const idm = resolveImpactFx({ id: 'idm', mode: 'experimental' }, { rhythmPulse: 0.95 });
  const glitch = resolveImpactFx({ id: 'glitch', mode: 'experimental' }, { rhythmPulse: 0.95 });
  assert.ok(ambient.blur > downtempo.blur);
  assert.ok(ambient.exposure < downtempo.exposure);
  assert.ok(lofi.bloom < hipHop.bloom);
  assert.ok(glitch.slice > idm.slice);
  assert.ok(glitch.chroma > idm.chroma);

  const genericPop = resolveImpactFx({ id: 'pop', mode: 'pop' }, { rhythmPulse: 0.95 });
  const kPop = resolveImpactFx({ id: 'k-pop', mode: 'pop' }, { rhythmPulse: 0.95 });
  assert.ok(kPop.echo > genericPop.echo);
  assert.ok(kPop.saturation > genericPop.saturation);
  assert.ok(kPop.slice > genericPop.slice && kPop.slice < edmTrap.slice);

  const genericJpop = resolveImpactFx({ id: 'j-pop', mode: 'j-pop' }, { rhythmPulse: 0.95 });
  const cityPop = resolveImpactFx({ id: 'city-pop', mode: 'j-pop' }, { rhythmPulse: 0.95 });
  const anime = resolveImpactFx({ id: 'anime', mode: 'j-pop' }, { rhythmPulse: 0.95 });
  const vocaloid = resolveImpactFx({ id: 'vocaloid', mode: 'j-pop' }, { rhythmPulse: 0.95 });
  assert.ok(cityPop.blur > genericJpop.blur);
  assert.ok(cityPop.slice < genericJpop.slice);
  assert.ok(anime.bloom > genericJpop.bloom);
  assert.ok(vocaloid.slice > anime.slice);
  assert.ok(vocaloid.chroma > genericJpop.chroma);

  const phonk = resolveImpactFx({ id: 'phonk', mode: 'phonk' }, { rhythmPulse: 0.95 });
  const driftPhonk = resolveImpactFx({ id: 'drift-phonk', mode: 'phonk' }, { rhythmPulse: 0.95 });
  assert.ok(phonk.chroma > hipHop.chroma);
  assert.ok(driftPhonk.slice > phonk.slice);

  const ukGarage = resolveImpactFx({ id: 'uk-garage', mode: 'garage' }, { rhythmPulse: 0.95 });
  const twoStepGarage = resolveImpactFx({ id: 'two-step-garage', mode: 'garage' }, { rhythmPulse: 0.95 });
  const speedGarage = resolveImpactFx({ id: 'speed-garage', mode: 'garage' }, { rhythmPulse: 0.95 });
  const futureGarage = resolveImpactFx({ id: 'future-garage', mode: 'garage' }, { rhythmPulse: 0.95 });
  const bassline = resolveImpactFx({ id: 'bassline', mode: 'garage' }, { rhythmPulse: 0.95 });
  assert.ok(twoStepGarage.echo > ukGarage.echo);
  assert.ok(speedGarage.slice > ukGarage.slice);
  assert.ok(speedGarage.slice > bassline.slice);
  assert.ok(bassline.saturation > ukGarage.saturation);
  assert.ok(futureGarage.blur > ukGarage.blur);
  assert.ok(ukGarage.slice < edmTrap.slice);

  const deepHouse = resolveImpactFx({ id: 'deep-house', mode: 'house' }, { rhythmPulse: 0.95 });
  const afroHouse = resolveImpactFx({ id: 'afro-house', mode: 'house' }, { rhythmPulse: 0.95 });
  const frenchHouse = resolveImpactFx({ id: 'french-house', mode: 'house' }, { rhythmPulse: 0.95 });
  const acidHouse = resolveImpactFx({ id: 'acid-house', mode: 'house' }, { rhythmPulse: 0.95 });
  const hardHouse = resolveImpactFx({ id: 'hard-house', mode: 'house' }, { rhythmPulse: 0.95 });
  assert.ok(deepHouse.blur > hardHouse.blur);
  assert.ok(deepHouse.slice < afroHouse.slice);
  assert.ok(frenchHouse.saturation > deepHouse.saturation);
  assert.ok(acidHouse.chroma > afroHouse.chroma);
  assert.ok(hardHouse.slice > acidHouse.slice);

  const genericDnb = resolveImpactFx({ id: 'drum-bass', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const liquidDnb = resolveImpactFx({ id: 'liquid-dnb', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const dancefloorDnb = resolveImpactFx({ id: 'dancefloor-dnb', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const jumpUpDnb = resolveImpactFx({ id: 'jump-up-dnb', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const neurofunk = resolveImpactFx({ id: 'neurofunk', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const jungle = resolveImpactFx({ id: 'jungle', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  const drumstep = resolveImpactFx({ id: 'drumstep', mode: 'drum-bass' }, { rhythmPulse: 0.95 });
  assert.ok(liquidDnb.blur > genericDnb.blur);
  assert.ok(dancefloorDnb.bloom > genericDnb.bloom);
  assert.ok(jumpUpDnb.slice > dancefloorDnb.slice);
  assert.ok(neurofunk.chroma > jumpUpDnb.chroma);
  assert.ok(jungle.slice > neurofunk.slice);
  assert.ok(drumstep.slice > genericDnb.slice);
});

test('kawaii bass impact keeps its pastel colors instead of washing out to white', async () => {
  const { resolveImpactFx } = await import('../renderer/impact-fx.mjs');
  const metrics = { rhythmPulse: 1, rhythmNow: true, rhythmStrength: 1 };
  const futureBass = resolveImpactFx({ mode: 'future-bass' }, metrics);
  const kawaiiBass = resolveImpactFx({ mode: 'kawaii-bass' }, metrics);
  assert.ok(kawaiiBass.bloom < futureBass.bloom);
  assert.ok(kawaiiBass.exposure < futureBass.exposure);
  assert.ok(kawaiiBass.blur < futureBass.blur);
  assert.ok(kawaiiBass.saturation > 1);
});

test('kawaii expression ignores isolated hits and opens only for sustained full-spectrum energy', async () => {
  const { KawaiiExpressionTracker } = await import('../renderer/kawaii-expression.mjs');
  const tracker = new KawaiiExpressionTracker();
  const calm = { bass: 0.18, lowMid: 0.14, mid: 0.16, high: 0.12, volume: 0.08, relativeEnergy: 0.9, drive: 0.15 };
  const hit = { bass: 0.92, lowMid: 0.62, mid: 0.55, high: 0.38, volume: 0.3, relativeEnergy: 1.6, drive: 0.9 };

  for (let frame = 0; frame < 90; frame += 1) tracker.update(calm, frame * 16.667, 1, true);
  tracker.update(hit, 1500, 1, true);
  let state = tracker.update(calm, 1517, 1, true);
  assert.equal(state.excited, false);
  assert.ok(state.expression < 0.05);

  for (let frame = 0; frame < 80; frame += 1) {
    state = tracker.update(hit, 2000 + frame * 16.667, 1, true);
  }
  assert.equal(state.excited, true);
  assert.ok(state.expression > 0.65);

  state = tracker.update(calm, 3350, 1, true);
  assert.equal(state.excited, true);
  for (let frame = 0; frame < 120; frame += 1) {
    state = tracker.update(calm, 4000 + frame * 16.667, 1, true);
  }
  assert.equal(state.excited, false);
  assert.ok(state.expression < 0.08);
});

test('kawaii expression responds to a sustained moderately energetic section', async () => {
  const { KawaiiExpressionTracker } = await import('../renderer/kawaii-expression.mjs');
  const tracker = new KawaiiExpressionTracker();
  const moderate = {
    bass: 0.58,
    lowMid: 0.45,
    mid: 0.42,
    high: 0.25,
    volume: 0.23,
    relativeEnergy: 1.3,
    drive: 0.58
  };
  let state;

  for (let frame = 0; frame < 90; frame += 1) {
    state = tracker.update(moderate, frame * 16.667, 1, true);
  }

  assert.equal(state.excited, true);
  assert.ok(state.expression > 0.6);
});

test('tempo tracker locks through missed and double onsets', async () => {
  const { TempoTracker } = await import('../renderer/tempo-tracker.mjs');
  const tracker = new TempoTracker('hardstyle');
  let now = 0;
  for (const interval of [400, 401, 399, 800, 200, 400, 402, 398, 400, 400]) {
    now += interval;
    tracker.addInterval(interval, 1, now);
  }
  const result = tracker.snapshot();
  assert.ok(result.bpm >= 149 && result.bpm <= 151);
  assert.ok(result.confidence > 0.55);
});

test('tempo tracker does not jump for isolated outliers', async () => {
  const { TempoTracker } = await import('../renderer/tempo-tracker.mjs');
  const tracker = new TempoTracker('house');
  let now = 0;
  for (let index = 0; index < 10; index += 1) {
    now += 500;
    tracker.addInterval(500 + (index % 2 ? 2 : -2), 1, now);
  }
  tracker.addInterval(365, 1.5, now + 365);
  assert.ok(tracker.snapshot().bpm >= 119 && tracker.snapshot().bpm <= 121);
});

test('tempo tracker unfolds a missed 180 BPM pulse instead of displaying 90', async () => {
  const { TempoTracker } = await import('../renderer/tempo-tracker.mjs');
  const tracker = new TempoTracker();
  let now = 0;
  for (let index = 0; index < 8; index += 1) {
    now += 667;
    tracker.addInterval(667, 1, now);
  }
  assert.ok(tracker.snapshot().bpm >= 179 && tracker.snapshot().bpm <= 181);
});

test('tempo tracker keeps an uptempo 210 BPM pulse at full rate', async () => {
  const { TempoTracker } = await import('../renderer/tempo-tracker.mjs');
  const tracker = new TempoTracker();
  let now = 0;
  for (let index = 0; index < 8; index += 1) {
    now += 286;
    tracker.addInterval(286, 1, now);
  }
  assert.ok(tracker.snapshot().bpm >= 209 && tracker.snapshot().bpm <= 210);
});

test('onset detector selects a local peak with one-frame look-ahead', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.01, 0.012, 0.011, 0.014, 0.018, 0.15, 0.022];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({ novelty: value, loudness: 0.2, body: 0.16, activity: 0.75 }, index * 16);
  });
  assert.equal(result.onsetNow, true);
  assert.equal(result.onsetAt, 80);
  assert.ok(result.strength > 0.5);
});

test('onset detector silence gate rejects a spectral spike', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.01, 0.012, 0.011, 0.014, 0.018, 0.15, 0.022];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({ novelty: value, loudness: 0.02, body: 0.03, activity: 0.05 }, index * 16);
  });
  assert.equal(result.onsetNow, false);
});

test('onset detector minimum interval suppresses doubled peaks', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector({ minimumIntervalMs: 65 });
  const frames = [0.01, 0.012, 0.011, 0.014, 0.02, 0.16, 0.02, 0.13, 0.018];
  const hits = [];
  frames.forEach((novelty, index) => {
    const result = detector.update({ novelty, loudness: 0.2, body: 0.15, activity: 0.7 }, index * 16);
    if (result.onsetNow) hits.push(result.onsetAt);
  });
  assert.deepEqual(hits, [80]);
});

test('kick detector accepts a strong low-body broadband attack', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.01, 0.012, 0.011, 0.014, 0.018, 0.15, 0.022];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({
      novelty: value,
      loudness: 0.24,
      body: 0.19,
      activity: 0.8,
      kickiness: index === 5 ? 0.72 : 0.08
    }, index * 16);
  });
  assert.equal(result.onsetNow, true);
  assert.equal(result.kickNow, true);
  assert.ok(result.kickStrength > 0.6);
});

test('kick detector keeps a non-kick onset away from genre text', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.01, 0.012, 0.011, 0.014, 0.018, 0.15, 0.022];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({
      novelty: value,
      loudness: 0.24,
      body: 0.14,
      activity: 0.8,
      kickiness: 0.12
    }, index * 16);
  });
  assert.equal(result.onsetNow, true);
  assert.equal(result.kickNow, false);
});

test('general onset detector accepts a low-body snare-like beat without calling it a kick', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.01, 0.012, 0.011, 0.014, 0.018, 0.16, 0.022];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({
      novelty: value,
      loudness: 0.24,
      body: 0.035,
      activity: 0.82,
      kickiness: 0.12
    }, index * 16);
  });
  assert.equal(result.onsetNow, true);
  assert.equal(result.kickNow, false);
});

test('onset detector exposes a weaker local peak for model confirmation', async () => {
  const { OnsetDetector } = await import('../renderer/onset-detector.mjs');
  const detector = new OnsetDetector();
  const novelty = [0.04, 0.042, 0.041, 0.043, 0.045, 0.058, 0.044];
  let result;
  novelty.forEach((value, index) => {
    result = detector.update({
      novelty: value,
      loudness: 0.2,
      body: 0.13,
      activity: 0.72,
      kickiness: 0.48
    }, index * 16);
  });
  assert.equal(result.onsetNow, false);
  assert.equal(result.candidateNow, true);
  assert.equal(result.candidateAt, 80);
  assert.ok(result.candidateStrength > 0.3);
});

test('AI beat confirms a weak hard-dance kick candidate without creating an empty hit', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  let result = fusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: true, peakSerial: 0 },
    candidateNow: true,
    candidateAt: 970,
    candidateImpact: 0.43,
    rhythmEvidence: 0.29,
    kickEvidence: 0.38,
    bodyEvidence: 0.35,
    presenceEvidence: 0.25,
    airEvidence: 0.1
  });
  assert.equal(result.rhythmNow, false);
  result = fusion.update({
    now: 1025,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1025,
      peakActivation: 0.62,
      groove: 0.58,
      regularity: 0.5
    }
  });
  assert.equal(result.rhythmNow, true);
  assert.equal(result.source, 'ai-beat');
  assert.equal(result.kickConfirmed, true);

  result = fusion.update({
    now: 1400,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 2,
      peakAt: 1400,
      peakActivation: 0.7,
      groove: 0.65,
      regularity: 0.6
    }
  });
  assert.equal(result.rhythmNow, false);
});

test('a low-confidence model peak cannot bypass hard-dance local salience', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  fusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: true, peakSerial: 0 },
    candidateNow: true,
    candidateAt: 970,
    candidateImpact: 0.43,
    rhythmEvidence: 0.29,
    kickEvidence: 0.38,
    bodyEvidence: 0.35,
    presenceEvidence: 0.25,
    airEvidence: 0.1
  });
  const result = fusion.update({
    now: 1025,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1025,
      peakActivation: 0.2,
      groove: 0.58,
      regularity: 0.5
    }
  });
  assert.equal(result.rhythmNow, false);
});

test('a low-confidence model peak does not suppress a locally strong transient', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  const result = fusion.update({
    now: 1038,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1038,
      peakActivation: 0.2,
      groove: 0.2,
      regularity: 0.1
    },
    candidateNow: true,
    candidateAt: 1000,
    candidateImpact: 0.72,
    rhythmEvidence: 0.66,
    kickEvidence: 0.68,
    bodyEvidence: 0.7,
    presenceEvidence: 0.42,
    airEvidence: 0.08
  });
  assert.equal(result.rhythmNow, true);
  assert.equal(result.source, 'dsp-soft');
});

test('a model peak outside the adaptive latency window does not claim an older transient', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  fusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: true, peakSerial: 0 },
    candidateNow: true,
    candidateAt: 970,
    candidateImpact: 0.5,
    rhythmEvidence: 0.32,
    kickEvidence: 0.42,
    bodyEvidence: 0.4,
    presenceEvidence: 0.28,
    airEvidence: 0.08
  });
  const result = fusion.update({
    now: 1135,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1135,
      peakActivation: 0.72,
      groove: 0.68,
      regularity: 0.72
    }
  });
  assert.equal(result.rhythmNow, false);
});

test('AI accepts a presence-heavy hard-dance kick but rejects an air-only hi-hat', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const kickFusion = new RhythmFusion();
  const earlyHighKick = kickFusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: true, peakSerial: 0 },
    candidateNow: true,
    candidateAt: 970,
    candidateImpact: 0.44,
    rhythmEvidence: 0.3,
    kickEvidence: 0.22,
    bodyEvidence: 0.16,
    presenceEvidence: 0.82,
    airEvidence: 0.3
  });
  const highKick = kickFusion.update({
    now: 1025,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1025,
      peakActivation: 0.7,
      groove: 0.64,
      regularity: 0.7
    }
  });
  const acceptedHighKick = earlyHighKick.rhythmNow ? earlyHighKick : highKick;
  assert.equal(acceptedHighKick.rhythmNow, true);
  assert.ok(['dsp-soft', 'ai-beat'].includes(acceptedHighKick.source));
  assert.ok(acceptedHighKick.rhythmStrength > 0.4);

  const hatFusion = new RhythmFusion();
  hatFusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: true, peakSerial: 0 },
    candidateNow: true,
    candidateAt: 970,
    candidateImpact: 0.38,
    rhythmEvidence: 0.12,
    kickEvidence: 0.08,
    bodyEvidence: 0.03,
    presenceEvidence: 0.28,
    airEvidence: 0.9
  });
  const hiHat = hatFusion.update({
    now: 1025,
    profileId: 'hard-dance',
    model: {
      available: true,
      peakSerial: 1,
      peakAt: 1025,
      peakActivation: 0.7,
      groove: 0.64,
      regularity: 0.7
    }
  });
  assert.equal(hiHat.rhythmNow, false);
  assert.equal(hiHat.rhythmStrength, 0);
});

test('confirmed rhythm impulses retain continuous strength instead of one fixed hit size', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const hit = (candidateImpact) => {
    const fusion = new RhythmFusion();
    return fusion.update({
      now: 1000,
      profileId: 'hard-dance',
      model: { available: false },
      dspNow: true,
      dspImpact: candidateImpact,
      candidateNow: true,
      candidateAt: 984,
      candidateImpact,
      rhythmEvidence: candidateImpact,
      kickEvidence: candidateImpact,
      bodyEvidence: candidateImpact,
      presenceEvidence: candidateImpact * 0.7,
      airEvidence: 0.08
    });
  };
  const softer = hit(0.48);
  const harder = hit(0.82);
  assert.equal(softer.rhythmNow, true);
  assert.equal(harder.rhythmNow, true);
  assert.ok(softer.rhythmStrength >= 0.3);
  assert.ok(harder.rhythmStrength > softer.rhythmStrength + 0.2);
});

test('hard-dance drop keeps varied kicks while ignoring interleaved air-only hats', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  const impacts = [0.34, 0.46, 0.38, 0.63, 0.36, 0.52, 0.41, 0.7];
  let kickHits = 0;
  let hatHits = 0;
  impacts.forEach((candidateImpact, index) => {
    const peakAt = 1000 + index * 250;
    const highClickKick = index % 2 === 0;
    const earlyKick = fusion.update({
      now: peakAt - 35,
      profileId: 'hard-dance',
      model: {
        available: true,
        peakSerial: index,
        peakAt: peakAt - 250,
        peakActivation: 0.66,
        groove: 0.72,
        regularity: 0.88
      },
      candidateNow: true,
      candidateAt: peakAt - 42,
      candidateImpact,
      rhythmEvidence: 0.3,
      kickEvidence: highClickKick ? 0.22 : 0.54,
      bodyEvidence: highClickKick ? 0.14 : 0.72,
      presenceEvidence: highClickKick ? 0.78 : 0.3,
      airEvidence: highClickKick ? 0.28 : 0.12
    });
    const kick = fusion.update({
      now: peakAt,
      profileId: 'hard-dance',
      model: {
        available: true,
        peakSerial: index + 1,
        peakAt,
        peakActivation: 0.66,
        groove: 0.72,
        regularity: 0.88
      }
    });
    if (earlyKick.rhythmNow || kick.rhythmNow) kickHits += 1;

    const hat = fusion.update({
      now: peakAt + 125,
      profileId: 'hard-dance',
      model: {
        available: true,
        peakSerial: index + 1,
        peakAt,
        peakActivation: 0.66,
        groove: 0.72,
        regularity: 0.88
      },
      candidateNow: true,
      candidateAt: peakAt + 118,
      candidateImpact: 0.39,
      rhythmEvidence: 0.12,
      kickEvidence: 0.06,
      bodyEvidence: 0.02,
      presenceEvidence: 0.24,
      airEvidence: 0.94
    });
    if (hat.rhythmNow) hatHits += 1;
  });
  assert.equal(kickHits, impacts.length);
  assert.equal(hatHits, 0);
});

test('hard-dance AI grid preserves a fast drumroll pulse instead of folding it in half', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  const model = { available: true, peakActivation: 0.68, groove: 0.7, regularity: 0.85 };
  for (let index = 0; index < 5; index += 1) {
    const peakAt = 1000 + index * 200;
    fusion.update({
      now: peakAt - 30,
      profileId: 'hard-dance',
      model: { ...model, peakSerial: index, peakAt: peakAt - 200 },
      candidateNow: true,
      candidateAt: peakAt - 38,
      candidateImpact: 0.44,
      rhythmEvidence: 0.31,
      kickEvidence: 0.4,
      bodyEvidence: 0.36,
      presenceEvidence: 0.3,
      airEvidence: 0.08
    });
    fusion.update({
      now: peakAt,
      profileId: 'hard-dance',
      model: { ...model, peakSerial: index + 1, peakAt }
    });
  }
  const recovered = fusion.update({
    now: 2170,
    profileId: 'hard-dance',
    model: { ...model, peakSerial: 5, peakAt: 1800 },
    candidateNow: true,
    candidateAt: 2162,
    candidateImpact: 0.45,
    rhythmEvidence: 0.32,
    kickEvidence: 0.42,
    bodyEvidence: 0.38,
    presenceEvidence: 0.32,
    airEvidence: 0.08
  });
  assert.ok(recovered.modelPulsePeriodMs >= 195 && recovered.modelPulsePeriodMs <= 205);
  assert.ok(recovered.modelPulseConfidence >= 0.48);
  assert.equal(recovered.rhythmNow, true);
  assert.equal(recovered.source, 'ai-grid');
});

test('hard-dance visual vetoes a strong mid transient without kick-band support', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  const result = fusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: false },
    dspNow: true,
    dspImpact: 0.78,
    candidateNow: true,
    candidateAt: 992,
    candidateImpact: 0.78,
    rhythmEvidence: 0.52,
    kickEvidence: 0.2,
    bodyEvidence: 0.08,
    presenceEvidence: 0.26,
    airEvidence: 0.34
  });
  assert.equal(result.rhythmNow, false);
  assert.equal(result.kickConfirmed, false);
});

test('hard-dance accepts a zaag-like presence wall without requiring conventional sub body', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const fusion = new RhythmFusion();
  const result = fusion.update({
    now: 1000,
    profileId: 'hard-dance',
    model: { available: false },
    candidateNow: true,
    candidateAt: 992,
    candidateImpact: 0.48,
    rhythmEvidence: 0.37,
    kickEvidence: 0.31,
    bodyEvidence: 0.08,
    presenceEvidence: 0.68,
    airEvidence: 0.72
  });
  assert.equal(result.rhythmNow, true);
  assert.equal(result.kickConfirmed, true);
});

test('compressed hardcore recovers a broadband hit that hardstyle keeps behind its firmer punch gate', async () => {
  const { RhythmFusion } = await import('../renderer/rhythm-fusion.mjs');
  const candidate = {
    now: 1000,
    model: { available: false },
    candidateNow: true,
    candidateAt: 992,
    candidateImpact: 0.43,
    rhythmEvidence: 0.27,
    kickEvidence: 0.3,
    bodyEvidence: 0.21,
    presenceEvidence: 0.34,
    airEvidence: 0.25
  };
  const hardcore = new RhythmFusion().update({ ...candidate, profileId: 'hardcore' });
  const hardstyle = new RhythmFusion().update({ ...candidate, profileId: 'hardstyle' });
  assert.equal(hardcore.rhythmNow, true);
  assert.equal(hardcore.kickConfirmed, true);
  assert.equal(hardstyle.rhythmNow, false);
});

test('kick profiles separate hardcore and hardstyle without branching per subtype', async () => {
  const { resolveKickProfile } = await import('../renderer/kick-profiles.mjs');
  assert.equal(resolveKickProfile({ mode: 'hardcore', family: 'hardcore' }).id, 'hardcore');
  assert.equal(resolveKickProfile({ id: 'uptempo-hardcore', mode: 'hardcore', family: 'hardcore' }).id, 'hardcore');
  assert.equal(resolveKickProfile({ mode: 'hardstyle', family: 'hardstyle' }).id, 'hardstyle');
  assert.equal(resolveKickProfile({ id: 'rawstyle', mode: 'hardstyle', family: 'hardstyle' }).id, 'hardstyle');
  assert.equal(resolveKickProfile({ id: 'hard-dance', mode: 'hardcore', family: 'hardcore' }).id, 'hard-dance');
  assert.equal(resolveKickProfile({ mode: 'house', family: 'house' }).id, 'four-floor');
  assert.equal(resolveKickProfile({ id: 'trance', mode: 'trance', family: 'trance' }).id, 'trance');
  assert.equal(resolveKickProfile({ mode: 'future-bass', family: 'future-bass' }).id, 'melodic-bass');
  assert.equal(resolveKickProfile({ mode: 'kawaii-bass', family: 'future-bass' }).id, 'melodic-bass');
  assert.equal(resolveKickProfile({ mode: 'drum-bass', family: 'drum-bass' }).id, 'breakbeat');
  assert.equal(resolveKickProfile({ mode: 'breakbeat', family: 'breakbeat' }).id, 'breakbeat');
  assert.equal(resolveKickProfile({ id: 'hip-hop', mode: 'hip-hop', family: 'hip-hop' }).id, 'hip-hop');
  assert.equal(resolveKickProfile({ id: 'phonk', mode: 'phonk', family: 'hip-hop' }).id, 'hip-hop');
  assert.equal(resolveKickProfile({ id: 'drift-phonk', mode: 'phonk', family: 'phonk' }).id, 'hip-hop');
  assert.equal(resolveKickProfile({ id: 'trap-edm', mode: 'trap', family: 'trap' }).id, 'trap');
  assert.equal(resolveKickProfile({ id: 'festival-trap', mode: 'trap', family: 'trap' }).id, 'trap');
  assert.equal(resolveKickProfile({ id: 'glitch-hop', mode: 'trap', family: 'trap' }).id, 'bass-music');
  assert.equal(resolveKickProfile({ id: 'uk-garage', mode: 'garage', family: 'garage' }).id, 'garage');
  assert.equal(resolveKickProfile({ id: 'two-step-garage', mode: 'garage', family: 'garage' }).id, 'garage');
  assert.equal(resolveKickProfile({ id: 'speed-garage', mode: 'garage', family: 'garage' }).id, 'four-floor');
  assert.equal(resolveKickProfile({ id: 'bassline', mode: 'garage', family: 'garage' }).id, 'four-floor');
  assert.equal(resolveKickProfile({ id: 'latin', mode: 'latin', family: 'latin' }).id, 'latin');
  assert.equal(resolveKickProfile({ id: 'synthwave', mode: 'trance', family: 'synthwave' }).id, 'synthwave');
  assert.equal(resolveKickProfile({ id: 'classical', mode: 'trance', family: 'classical' }).id, 'general');
  assert.equal(resolveKickProfile({ mode: 'metal', family: 'metal' }).id, 'rock-metal');
  assert.equal(resolveKickProfile({ mode: 'pop', family: 'pop' }).id, 'general');
  assert.ok(resolveKickProfile({ mode: 'metal', family: 'metal' }).rhythm.midFlux > 6);
  assert.ok(resolveKickProfile({ mode: 'house', family: 'house' }).rhythm.lowFlux > 12);
  assert.ok(resolveKickProfile({ mode: 'hardcore', family: 'hardcore' }).rhythm.presenceFlux > 5);
  assert.ok(resolveKickProfile({ mode: 'hardcore', family: 'hardcore' }).rhythm.airPenalty > 1);
  assert.ok(resolveKickProfile({ mode: 'hardstyle', family: 'hardstyle' }).evidence.attack > 2.5);
  assert.ok(resolveKickProfile({ mode: 'hardstyle', family: 'hardstyle' }).bodyFloor
    > resolveKickProfile({ mode: 'hardcore', family: 'hardcore' }).bodyFloor);
  assert.ok(resolveKickProfile({ mode: 'drum-bass', family: 'drum-bass' }).rhythm.midFlux > 8);
  assert.ok(resolveKickProfile({ mode: 'future-bass', family: 'future-bass' }).releaseMs > 140);
  assert.ok(resolveKickProfile({ mode: 'trance', family: 'trance' }).rhythm.airPenalty > 1);
  assert.ok(resolveKickProfile({ id: 'hip-hop', mode: 'hip-hop', family: 'hip-hop' }).rhythm.midFlux > 6);
  assert.ok(resolveKickProfile({ id: 'trap-edm', mode: 'trap', family: 'trap' }).rhythm.airPenalty > 1);
  assert.ok(resolveKickProfile({ id: 'uk-garage', mode: 'garage', family: 'garage' }).rhythm.bodyFlux > 4);
  assert.ok(resolveKickProfile({ id: 'uk-garage', mode: 'garage', family: 'garage' }).rhythm.airPenalty > 1);
  assert.ok(resolveKickProfile({ id: 'latin', mode: 'latin', family: 'latin' }).rhythm.bodyFlux > 4);
  assert.ok(resolveKickProfile({ id: 'latin', mode: 'latin', family: 'latin' }).rhythm.airPenalty > 1);
});
