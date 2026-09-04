'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const modelMetadata = require('../assets/models/discogs-effnet-bsdynamic-1.json');
const { THEMES } = require('../src/themes');
const {
  GenreScoreSmoother,
  GenreDecisionTracker,
  MEL_BANDS,
  MusiCnnMelExtractor,
  SAMPLE_RATE,
  aggregateGenreScores,
  applyAudioGenreMemoryPrior,
  audioGenreFamilyResult,
  audioGenreFamilyScores,
  audioGenreModelOutputIds,
  audioGenreSupportScore,
  audioGenreTreeDistance,
  buildPatchTensor,
  discogsClassToMajor,
  fuseGenreEvidence,
  hasSignificantPlaybackSeek,
  hasAudioGenreCompatibilityProfile,
  isBroadAudioGenre,
  resampleWindowedSinc,
  shouldAnalyzeAudioGenre,
  shouldKeepGenreIdentifying,
  shouldReplaceMetadataWithAudioGenre,
  selectPatchStarts
} = require('../src/audio-genre-model');

test('MusiCNN preprocessing returns zero log-mel values for silence', () => {
  const signal = new Float32Array(SAMPLE_RATE * 3);
  const result = new MusiCnnMelExtractor().transform(signal);
  assert.equal(result.bands, MEL_BANDS);
  assert.ok(result.frames >= 128);
  assert.ok(result.data.every((value) => value === 0));
});

test('MusiCNN preprocessing produces finite energy for a sine wave', () => {
  const signal = Float32Array.from(
    { length: SAMPLE_RATE * 3 },
    (_value, index) => 0.25 * Math.sin(2 * Math.PI * 1000 * index / SAMPLE_RATE)
  );
  const result = new MusiCnnMelExtractor().transform(signal);
  assert.ok(result.data.every(Number.isFinite));
  assert.ok(Math.max(...result.data) > 1);
  const starts = selectPatchStarts(result.frames, 4);
  const tensor = buildPatchTensor(result, starts);
  assert.equal(tensor.length, starts.length * 128 * MEL_BANDS);
});

test('windowed-sinc resampling preserves duration and audible signal energy', () => {
  const sourceRate = 44100;
  const signal = Float32Array.from(
    { length: sourceRate },
    (_value, index) => 0.5 * Math.sin(2 * Math.PI * 440 * index / sourceRate)
  );
  const output = resampleWindowedSinc(signal, sourceRate, SAMPLE_RATE, { radius: 6, phases: 64 });
  assert.equal(output.length, SAMPLE_RATE);
  const rms = Math.sqrt(output.reduce((total, value) => total + value * value, 0) / output.length);
  assert.ok(rms > 0.34 && rms < 0.36, `unexpected RMS ${rms}`);
});

test('Discogs labels preserve exact reviewed styles and otherwise collapse safely', () => {
  assert.equal(discogsClassToMajor('Electronic---Hardcore'), 'hardcore');
  assert.equal(discogsClassToMajor('Electronic---Hardstyle'), 'hardstyle');
  assert.equal(discogsClassToMajor('Electronic---Synthwave'), 'synthwave');
  assert.equal(discogsClassToMajor('Electronic---Ambient'), 'ambient');
  assert.equal(discogsClassToMajor('Electronic---Downtempo'), 'downtempo');
  assert.equal(discogsClassToMajor('Electronic---IDM'), 'idm');
  assert.equal(discogsClassToMajor('Electronic---Glitch'), 'glitch');
  assert.equal(discogsClassToMajor('Hip Hop---Instrumental'), 'instrumental-hip-hop');
  assert.equal(discogsClassToMajor('Electronic---Bassline'), 'bassline');
  assert.equal(discogsClassToMajor('Electronic---Speed Garage'), 'speed-garage');
  assert.equal(discogsClassToMajor('Electronic---Trip Hop'), 'downtempo');
  assert.equal(discogsClassToMajor('Funk / Soul---Neo Soul'), 'neo-soul');
  assert.equal(discogsClassToMajor('Jazz---Hard Bop'), 'bebop');
  assert.equal(discogsClassToMajor('Classical---Baroque'), 'baroque');
  assert.equal(discogsClassToMajor('Rock---Progressive Metal'), 'progressive-metal');
  assert.equal(discogsClassToMajor('Blues---Delta Blues'), 'blues');
  assert.equal(discogsClassToMajor('Rock---Hardcore'), 'punk');
  assert.equal(discogsClassToMajor('Rock---Heavy Metal'), 'metal');
  assert.equal(discogsClassToMajor('Pop---J-pop'), 'j-pop');
  assert.equal(discogsClassToMajor("Children's---Nursery Rhymes"), 'unknown');
  assert.equal(discogsClassToMajor('Brass & Military---Military'), 'unknown');
  assert.equal(discogsClassToMajor('Non-Music---Dialogue'), 'unknown');
});

test('every bundled Discogs class resolves to an existing visual or Unknown', () => {
  for (const label of modelMetadata.classes) {
    const id = discogsClassToMajor(label);
    assert.ok(THEMES[id], `${label} resolved to missing theme ${id}`);
  }
});

test('unsupported visual families are represented by compatibility evidence, not fake model outputs', () => {
  const outputIds = audioGenreModelOutputIds(modelMetadata.classes);
  assert.equal(outputIds.has('future-bass'), false);
  assert.equal(outputIds.has('phonk'), false);
  assert.equal(hasAudioGenreCompatibilityProfile('future-bass'), true);
  assert.equal(hasAudioGenreCompatibilityProfile('kawaii-bass'), true);
  assert.equal(hasAudioGenreCompatibilityProfile('phonk'), true);
  assert.equal(hasAudioGenreCompatibilityProfile('drift-phonk'), true);
  assert.equal(hasAudioGenreCompatibilityProfile('dubstep'), false);

  const activations = new Float32Array(modelMetadata.classes.length);
  activations[modelMetadata.classes.indexOf('Electronic---Dubstep')] = 0.48;
  activations[modelMetadata.classes.indexOf('Hip Hop---Trap')] = 0.4;
  activations[modelMetadata.classes.indexOf('Hip Hop---Cloud Rap')] = 0.32;
  const result = aggregateGenreScores(activations, modelMetadata.classes);
  assert.equal(result.scores['future-bass'], undefined);
  assert.equal(result.scores.phonk, undefined);
  assert.ok(audioGenreSupportScore(result, 'future-bass') >= 0.48);
  assert.ok(audioGenreSupportScore(result, 'phonk') >= 0.4);
});

test('raw-label aggregation does not let a weak alias overwhelm a stronger visual', () => {
  const classes = ['Electronic---Hardcore', 'Electronic---Gabber', 'Electronic---House'];
  const result = aggregateGenreScores(Float32Array.from([0.8, 0.1, 0.7]), classes);
  assert.equal(result.id, 'hardcore');
  assert.ok(result.scores.hardcore > result.scores.house);
});

test('related exact style aliases reinforce the same reviewed visual', () => {
  const classes = ['Electronic---Hard Techno', 'Electronic---Schranz', 'Electronic---Techno'];
  const result = aggregateGenreScores(Float32Array.from([0.42, 0.4, 0.5]), classes);
  assert.equal(result.id, 'hard-techno');
  assert.ok(result.scores['hard-techno'] > result.scores.techno);
});

test('decision-time family scores do not reward a wider visual tree', () => {
  const leafScores = {
    synthwave: 0.3,
    house: 0.28,
    'tech-house': 0.25,
    'progressive-house': 0.22
  };
  const familyScores = audioGenreFamilyScores(leafScores);
  assert.equal(familyScores.synthwave, 0.3);
  assert.equal(familyScores.house, 0.28);
  assert.equal(audioGenreFamilyResult({ id: 'synthwave', scores: leafScores, ranked: [] }).id, 'synthwave');
});

test('the strongest of two sibling results still identifies their shared family', () => {
  const leafResult = decisionResultFromScores({
    'hard-techno': 0.31,
    'minimal-techno': 0.3,
    trance: 0.29
  });
  assert.equal(leafResult.ranked[0].id, 'hard-techno');
  assert.equal(leafResult.ranked[1].id, 'minimal-techno');
  assert.equal(leafResult.ranked[2].id, 'trance');
  assert.equal(audioGenreFamilyResult(leafResult).id, 'techno');
});

test('median smoothing and hold count prevent repeated genre switching', () => {
  const smoother = new GenreScoreSmoother({ windowSize: 3, holdCount: 3 });
  const push = (hardcore, trance) => smoother.push({ scores: { hardcore, trance } });
  assert.equal(push(0.7, 0.2).stable, false);
  assert.equal(push(0.68, 0.22).stable, false);
  assert.equal(push(0.25, 0.72).id, 'hardcore');
  const fourth = push(0.66, 0.24);
  assert.equal(fourth.id, 'hardcore');
  assert.equal(fourth.stable, true);
});

test('audio evidence replaces broad fallbacks but not specific catalog tags', () => {
  const audio = { id: 'trance', confidence: 0.62, margin: 0.2, stable: true };
  const fallback = fuseGenreEvidence({
    metadata: { id: 'hardcore', confidence: 0.78, source: 'artist-fallback' },
    audio
  });
  assert.equal(fallback.id, 'trance');
  assert.equal(fallback.chosenBy, 'audio');

  const specific = fuseGenreEvidence({
    metadata: { id: 'colour-bass', confidence: 0.9, source: 'discogs-track' },
    audio
  });
  assert.equal(specific.id, 'colour-bass');
  assert.equal(specific.chosenBy, 'metadata');

  const pop = fuseGenreEvidence({
    metadata: { id: 'pop', confidence: 0.8, source: 'discogs-track' },
    audio
  });
  assert.equal(pop.id, 'pop');
  assert.equal(pop.chosenBy, 'metadata');
});

function decisionResult(id, confidence, runnerUpId, runnerUpScore, compatibilityScores = {}) {
  const scores = { [id]: confidence, [runnerUpId]: runnerUpScore };
  return {
    id,
    confidence,
    margin: confidence - runnerUpScore,
    scores,
    compatibilityScores,
    ranked: Object.entries(scores)
      .map(([genreId, score]) => ({ id: genreId, score }))
      .sort((left, right) => right.score - left.score)
  };
}

function decisionResultFromScores(scores, compatibilityScores = {}) {
  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score);
  return {
    id: ranked[0]?.id || 'unknown',
    confidence: ranked[0]?.score || 0,
    margin: (ranked[0]?.score || 0) - (ranked[1]?.score || 0),
    scores,
    compatibilityScores,
    ranked
  };
}

test('a full-play memory is a strong but rapidly decaying prior on the next play', () => {
  const liveHouse = decisionResult('house', 0.5, 'hardcore', 0.2);
  const memory = {
    genreId: 'hardcore',
    confidence: 0.46,
    margin: 0.13,
    scores: { hardcore: 0.46, house: 0.1 },
    fullPlaybackEvidence: true
  };
  const early = applyAudioGenreMemoryPrior(liveHouse, memory, 1);
  const middle = applyAudioGenreMemoryPrior(liveHouse, memory, 6);
  const expired = applyAudioGenreMemoryPrior(liveHouse, memory, 25);
  assert.equal(early.id, 'hardcore');
  assert.equal(middle.id, 'house');
  assert.ok(early.memoryPriorWeight > middle.memoryPriorWeight);
  assert.equal(expired, liveHouse);
  assert.equal(applyAudioGenreMemoryPrior(liveHouse, {
    ...memory,
    fullPlaybackEvidence: false
  }, 1), liveHouse);
});

test('static detection keeps a full-play memory as the result until another play completes', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({
    dynamicEnabled: false,
    fullTrackLearning: true,
    memoryPrior: {
      genreId: 'dubstep',
      confidence: 0.46,
      margin: 0.13,
      scores: { dubstep: 0.46, ambient: 0.08, house: 0.06 },
      fullPlaybackEvidence: true
    }
  });
  assert.equal(tracker.currentId, 'dubstep');
  assert.equal(tracker.memoryBaseline, true);

  const ambientIntro = decisionResult('ambient', 0.62, 'dubstep', 0.16);
  const houseBody = decisionResult('house', 0.58, 'dubstep', 0.18);
  for (let index = 0; index < 20; index += 1) {
    const event = tracker.push({
      shortResult: ambientIntro,
      trackResult: ambientIntro,
      segmentResult: ambientIntro
    });
    assert.notEqual(event.stage, 'first');
    assert.notEqual(event.stage, 'refinement');
    assert.notEqual(event.stage, 'correction');
  }
  for (let index = 0; index < 80; index += 1) {
    const event = tracker.push({
      shortResult: houseBody,
      trackResult: houseBody,
      segmentResult: houseBody
    });
    assert.notEqual(event.stage, 'refinement');
    assert.notEqual(event.stage, 'correction');
  }
  assert.equal(tracker.currentId, 'dubstep');
  assert.equal(tracker.memoryBaseline, true);
});

test('dynamic detection may leave a full-play memory after a sustained new section', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({
    dynamicEnabled: true,
    memoryPrior: {
      genreId: 'dubstep',
      confidence: 0.46,
      margin: 0.13,
      scores: { dubstep: 0.46, house: 0.08 },
      fullPlaybackEvidence: true
    }
  });
  assert.equal(tracker.currentId, 'dubstep');
  assert.equal(tracker.memoryBaseline, true);

  const house = decisionResult('house', 0.52, 'dubstep', 0.18);
  let event;
  for (let index = 0; index < 10; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'dynamic');
  assert.equal(event.genreId, 'house');
  assert.equal(tracker.memoryBaseline, false);
});

test('dynamic Ambient cannot immediately replace a remembered full-play result', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({
    dynamicEnabled: true,
    memoryPrior: {
      genreId: 'house',
      confidence: 0.46,
      margin: 0.13,
      scores: { house: 0.46, ambient: 0.08 },
      fullPlaybackEvidence: true
    }
  });
  const ambient = decisionResult('ambient', 0.58, 'house', 0.2);
  let event;
  for (let index = 0; index < 11; index += 1) {
    event = tracker.push({ shortResult: ambient, trackResult: ambient, segmentResult: ambient });
    assert.notEqual(event.stage, 'dynamic');
  }
  event = tracker.push({ shortResult: ambient, trackResult: ambient, segmentResult: ambient });
  assert.equal(event.stage, 'dynamic');
  assert.equal(event.genreId, 'ambient');
});

test('author agreement keeps a four-window fast path while audio-only evidence waits for eight', () => {
  const unsupported = new GenreDecisionTracker();
  const supported = new GenreDecisionTracker();
  supported.setContext({ priorGenreIds: ['hardcore'] });
  const result = decisionResult('hardcore', 0.38, 'house', 0.31);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(unsupported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
    assert.equal(supported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
  }
  assert.equal(supported.push({ shortResult: result, trackResult: result }).stage, 'first');
  for (let index = 0; index < 4; index += 1) {
    assert.equal(unsupported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
  }
  assert.equal(unsupported.push({ shortResult: result, trackResult: result }).stage, 'first');
});

test('author-reference distance follows reviewed genre branches', () => {
  assert.equal(audioGenreTreeDistance('dubstep', 'colour-bass'), 0);
  assert.equal(audioGenreTreeDistance('dubstep', 'house'), 3);
  assert.equal(audioGenreTreeDistance('dubstep', 'ambient'), 4);
  assert.equal(audioGenreTreeDistance('dubstep', 'folk'), Infinity);
});

test('an artist prior allows nearby genres but asks distant first results for more evidence', () => {
  const nearby = new GenreDecisionTracker();
  nearby.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const house = decisionResult('house', 0.52, 'techno', 0.26);
  for (let index = 0; index < 7; index += 1) {
    assert.equal(nearby.push({ shortResult: house, trackResult: house }).stage, 'waiting');
  }
  assert.equal(nearby.push({ shortResult: house, trackResult: house }).stage, 'first');

  const distant = new GenreDecisionTracker();
  distant.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const ambient = decisionResult('ambient', 0.52, 'downtempo', 0.26);
  for (let index = 0; index < 11; index += 1) {
    assert.equal(distant.push({ shortResult: ambient, trackResult: ambient }).stage, 'waiting');
  }
  const distantFirst = distant.push({ shortResult: ambient, trackResult: ambient });
  assert.equal(distantFirst.stage, 'first');
  assert.equal(distantFirst.authorPriorDistance, 4);

  const disconnected = new GenreDecisionTracker();
  disconnected.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const folk = decisionResult('folk', 0.52, 'country', 0.26);
  for (let index = 0; index < 13; index += 1) {
    assert.equal(disconnected.push({ shortResult: folk, trackResult: folk }).stage, 'waiting');
  }
  assert.equal(disconnected.push({ shortResult: folk, trackResult: folk }).stage, 'first');
});

test('a distant artist mismatch remains a soft guard rather than a permanent lock', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const ambient = decisionResult('ambient', 0.32, 'downtempo', 0.26);
  for (let index = 0; index < 11; index += 1) {
    assert.equal(tracker.push({ shortResult: ambient, trackResult: ambient }).stage, 'waiting');
  }
  assert.equal(tracker.push({ shortResult: ambient, trackResult: ambient }).stage, 'first');
});

test('a broad cumulative result cannot bypass the artist guard through recent refinement', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const broad = decisionResult('electronic', 0.52, 'house', 0.26);
  const folk = decisionResult('folk', 0.52, 'country', 0.26);
  for (let index = 0; index < 13; index += 1) {
    const event = tracker.push({ shortResult: folk, trackResult: broad, segmentResult: folk });
    assert.notEqual(event.stage, 'refinement');
  }
  const refined = tracker.push({ shortResult: folk, trackResult: broad, segmentResult: folk });
  assert.equal(refined.stage, 'refinement');
  assert.equal(refined.genreId, 'folk');
});

test('a sustained low score can produce the first result without a large score ratio', () => {
  const tracker = new GenreDecisionTracker();
  const result = decisionResult('dubstep', 0.16, 'trance', 0.15);
  let event;
  for (let index = 0; index < 11; index += 1) {
    event = tracker.push({ shortResult: result, trackResult: result, segmentResult: result });
    assert.equal(event.stage, 'waiting');
  }
  event = tracker.push({ shortResult: result, trackResult: result, segmentResult: result });
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'dubstep');
  assert.equal(event.supportedByRelativeLead, true);
});

test('persistent low-score fallback still rejects sub-floor or unstable guesses', () => {
  const tooWeak = new GenreDecisionTracker();
  const weakResult = decisionResult('dubstep', 0.14, 'trance', 0.13);
  for (let index = 0; index < 12; index += 1) {
    assert.equal(tooWeak.push({
      shortResult: weakResult,
      trackResult: weakResult,
      segmentResult: weakResult
    }).stage, 'waiting');
  }

  const unstable = new GenreDecisionTracker();
  const dubstep = decisionResult('dubstep', 0.2, 'trance', 0.08);
  const trance = decisionResult('trance', 0.2, 'dubstep', 0.08);
  let event;
  for (let index = 0; index < 12; index += 1) {
    const result = index % 2 ? dubstep : trance;
    event = unstable.push({ shortResult: result, trackResult: result, segmentResult: result });
  }
  assert.equal(event.stage, 'waiting');
  assert.equal(unstable.currentId, '');
});

test('the first specific result follows cumulative evidence rather than the recent winner', () => {
  const tracker = new GenreDecisionTracker();
  const cumulativeHouse = decisionResult('house', 0.54, 'techno', 0.31);
  const recentTechno = decisionResult('techno', 0.62, 'house', 0.22);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeHouse,
      segmentResult: cumulativeHouse
    });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
});

test('a conflicting recent section prevents an intro from becoming the first result', () => {
  const tracker = new GenreDecisionTracker();
  const intro = decisionResult('ambient', 0.58, 'house', 0.22);
  const body = decisionResult('house', 0.54, 'ambient', 0.24);
  let event;

  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({ shortResult: intro, trackResult: intro, segmentResult: intro });
    assert.equal(event.stage, 'waiting');
  }
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({ shortResult: body, trackResult: intro, segmentResult: body });
    assert.equal(event.stage, 'waiting');
  }
  assert.equal(tracker.currentId, '');

  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({ shortResult: body, trackResult: body, segmentResult: body });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
});

test('Ambient needs sustained recent evidence unless an Ambient prior supports it', () => {
  const ambient = decisionResult('ambient', 0.58, 'house', 0.22);
  const unsupported = new GenreDecisionTracker();
  for (let index = 0; index < 11; index += 1) {
    assert.equal(unsupported.push({
      shortResult: ambient,
      trackResult: ambient,
      segmentResult: ambient
    }).stage, 'waiting');
  }
  assert.equal(unsupported.push({
    shortResult: ambient,
    trackResult: ambient,
    segmentResult: ambient
  }).stage, 'first');

  const supported = new GenreDecisionTracker();
  supported.setContext({ priorGenreIds: ['ambient'], guardGenreIds: ['ambient'] });
  for (let index = 0; index < 3; index += 1) {
    assert.equal(supported.push({
      shortResult: ambient,
      trackResult: ambient,
      segmentResult: ambient
    }).stage, 'waiting');
  }
  assert.equal(supported.push({
    shortResult: ambient,
    trackResult: ambient,
    segmentResult: ambient
  }).stage, 'first');
});

test('an Ambient EDM intro is not committed after the recent body changes family', () => {
  const tracker = new GenreDecisionTracker();
  const ambient = decisionResult('ambient', 0.58, 'house', 0.22);
  const house = decisionResult('house', 0.54, 'ambient', 0.24);
  for (let index = 0; index < 8; index += 1) {
    assert.equal(tracker.push({
      shortResult: ambient,
      trackResult: ambient,
      segmentResult: ambient
    }).stage, 'waiting');
  }
  for (let index = 0; index < 4; index += 1) {
    assert.equal(tracker.push({
      shortResult: house,
      trackResult: ambient,
      segmentResult: house
    }).stage, 'waiting');
  }
  assert.equal(tracker.currentId, '');

  let event;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
});

test('matching recent evidence can accelerate but never replace the cumulative first candidate', () => {
  const tracker = new GenreDecisionTracker();
  const weakTechno = decisionResult('techno', 0.26, 'house', 0.24);
  const cumulativeHouse = decisionResult('house', 0.38, 'techno', 0.3);
  const recentHouse = decisionResult('house', 0.4, 'techno', 0.24);
  let event;
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({
      shortResult: weakTechno,
      trackResult: weakTechno,
      segmentResult: weakTechno
    });
  }
  event = tracker.push({
    shortResult: recentHouse,
    trackResult: weakTechno,
    segmentResult: recentHouse
  });
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({
      shortResult: recentHouse,
      trackResult: cumulativeHouse,
      segmentResult: recentHouse
    });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
  assert.equal(event.supportedByRecent, true);
});

test('recent evidence cannot claim independent support before the full first-result warmup', () => {
  const tracker = new GenreDecisionTracker();
  const cumulativeHouse = decisionResult('house', 0.41, 'techno', 0.32);
  const recentHouse = decisionResult('house', 0.43, 'techno', 0.25);
  let event;
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({
      shortResult: recentHouse,
      trackResult: cumulativeHouse,
      segmentResult: recentHouse
    });
  }
  assert.equal(event.stage, 'waiting');
  assert.equal(tracker.currentId, '');
});

test('a sustained concrete recent conflict delays the first cumulative result', () => {
  const tracker = new GenreDecisionTracker();
  const weakHouse = decisionResult('house', 0.26, 'techno', 0.24);
  const strongHouse = decisionResult('house', 0.5, 'techno', 0.28);
  const recentTechno = decisionResult('techno', 0.44, 'house', 0.24);
  let event;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: weakHouse,
      segmentResult: recentTechno
    });
  }
  assert.equal(event.stage, 'waiting');

  event = tracker.push({
    shortResult: recentTechno,
    trackResult: strongHouse,
    segmentResult: recentTechno
  });
  assert.equal(event.stage, 'waiting');
  assert.equal(event.recentConflictGenreId, 'techno');
  assert.equal(tracker.currentId, '');

  const cumulativeTechno = decisionResult('techno', 0.48, 'house', 0.26);
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeTechno,
      segmentResult: recentTechno
    });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'techno');
});

test('a broad recent result cannot veto a concrete cumulative first result', () => {
  const tracker = new GenreDecisionTracker();
  const weakHouse = decisionResult('house', 0.26, 'electronic', 0.24);
  const strongHouse = decisionResult('house', 0.5, 'electronic', 0.28);
  const recentElectronic = decisionResult('electronic', 0.48, 'house', 0.2);
  let event;
  let first;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({
      shortResult: recentElectronic,
      trackResult: weakHouse,
      segmentResult: recentElectronic
    });
    if (event.stage === 'first') first = event;
  }
  if (!first) {
    event = tracker.push({
      shortResult: recentElectronic,
      trackResult: strongHouse,
      segmentResult: recentElectronic
    });
    if (event.stage === 'first') first = event;
  }
  assert.equal(first?.stage, 'first');
  assert.equal(first?.genreId, 'house');
});

test('broad Electronic stays provisional and never prevents a later concrete first result', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.62, 'house', 0.24);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({ shortResult: electronic, trackResult: electronic });
  }
  assert.equal(event.stage, 'provisional');
  assert.equal(tracker.currentId, '');
  assert.equal(isBroadAudioGenre(event.genreId), true);

  const house = decisionResult('house', 0.63, 'electronic', 0.24);
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
});

test('a stable short result refines but never becomes the first cumulative result', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.42, 'house', 0.36);
  const narrowHouse = decisionResult('house', 0.38, 'electronic', 0.36);
  let event;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({ shortResult: electronic, trackResult: electronic, segmentResult: electronic });
  }
  assert.equal(event.stage, 'provisional');

  let refinement;
  for (let index = 0; index < 5; index += 1) {
    event = tracker.push({ shortResult: narrowHouse, trackResult: electronic, segmentResult: electronic });
    if (event.stage === 'refinement') refinement = event;
  }
  assert.equal(refinement?.stage, 'refinement');
  assert.equal(refinement?.genreId, 'house');
  assert.equal(refinement?.previousGenreId, 'electronic');
});

test('a persistent low-score lead can refine a broad result', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.42, 'house', 0.36);
  for (let index = 0; index < 6; index += 1) {
    tracker.push({ shortResult: electronic, trackResult: electronic, segmentResult: electronic });
  }

  const dubstep = decisionResult('dubstep', 0.16, 'trance', 0.15);
  let event;
  let refinement;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({ shortResult: dubstep, trackResult: electronic, segmentResult: dubstep });
    if (event.stage === 'refinement') refinement = event;
  }
  assert.equal(refinement?.genreId, 'dubstep');
  assert.equal(refinement?.supportedByRelativeLead, true);
});

test('alternating short guesses do not refine a broad running average', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.42, 'house', 0.36);
  const house = decisionResult('house', 0.38, 'electronic', 0.36);
  const techno = decisionResult('techno', 0.39, 'electronic', 0.36);
  let event;
  for (const result of [house, techno, house, techno, house, techno]) {
    event = tracker.push({ shortResult: result, trackResult: electronic, segmentResult: electronic });
  }
  assert.notEqual(event.stage, 'refinement');
  assert.equal(tracker.currentId, '');
});

test('a concrete recent section can escape an inconclusive full-track average', () => {
  const tracker = new GenreDecisionTracker();
  const unknownTrack = decisionResult('unknown', 0.25, 'electronic', 0.22);
  const weakMetal = decisionResult('metal', 0.14, 'rock', 0.13);
  for (let index = 0; index < 6; index += 1) {
    tracker.push({ shortResult: weakMetal, trackResult: unknownTrack, segmentResult: weakMetal });
  }

  const hardcore = decisionResult('hardcore', 0.38, 'metal', 0.22);
  let event;
  let refinement;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({ shortResult: hardcore, trackResult: unknownTrack, segmentResult: hardcore });
    if (event.stage === 'refinement') refinement = event;
  }
  assert.equal(refinement?.stage, 'refinement');
  assert.equal(refinement?.genreId, 'hardcore');
});

test('large same-track seeks reset genre evidence while normal progress does not', () => {
  const previous = { positionMs: 12000, sampledAtMs: 100000, playbackRate: 1, playing: true };
  assert.equal(hasSignificantPlaybackSeek(previous, {
    positionMs: 13220,
    sampledAtMs: 101200,
    playing: true
  }), false);
  assert.equal(hasSignificantPlaybackSeek(previous, {
    positionMs: 62000,
    sampledAtMs: 101200,
    playing: true
  }), true);
});

test('local genre inference pauses only when its result can no longer affect a fixed track', () => {
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'specific' }), false);
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'authoritative' }), false);
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'specific', dynamicEnabled: true }), true);
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'authoritative', dynamicEnabled: true }), false);
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'broad' }), true);
  assert.equal(shouldAnalyzeAudioGenre({ metadataKind: 'artist' }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'electronic',
    acceptedWindows: 200
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 99
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 100
  }), false);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 23,
    settleWindowLimit: 24
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 24,
    settleWindowLimit: 24
  }), false);
});

test('dynamic assistance keeps the displayed metadata and AI baseline aligned', () => {
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'broad',
    baseGenreId: 'unknown',
    decisionGenreId: 'house',
    decisionStage: 'memory',
    dynamicEnabled: false
  }), true);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'specific',
    baseGenreId: 'trance',
    decisionGenreId: 'house',
    decisionStage: 'memory',
    dynamicEnabled: false
  }), false);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'specific',
    baseGenreId: 'house',
    decisionGenreId: 'trance',
    decisionStage: 'first',
    dynamicEnabled: false
  }), false);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'specific',
    baseGenreId: 'house',
    decisionGenreId: 'trance',
    decisionStage: 'first',
    dynamicEnabled: true
  }), false);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'specific',
    baseGenreId: 'house',
    decisionGenreId: 'trance',
    decisionStage: 'dynamic',
    dynamicEnabled: true
  }), true);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'authoritative',
    baseGenreId: 'house',
    decisionGenreId: 'trance',
    decisionStage: 'dynamic',
    dynamicEnabled: true
  }), false);
  assert.equal(shouldReplaceMetadataWithAudioGenre({
    metadataKind: 'specific',
    baseGenreId: 'house',
    decisionGenreId: 'electronic',
    decisionStage: 'dynamic',
    dynamicEnabled: true
  }), false);
});

test('specific metadata becomes the baseline for sustained dynamic change detection', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'house' });
  assert.equal(tracker.currentId, 'house');
  assert.equal(tracker.externalBaseline, true);

  const trance = decisionResult('trance', 0.44, 'house', 0.24);
  let event;
  for (let index = 0; index < 9; index += 1) {
    event = tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
    assert.notEqual(event.stage, 'correction');
    assert.notEqual(event.stage, 'dynamic');
  }
  event = tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  assert.equal(event.stage, 'dynamic');
  assert.equal(event.previousGenreId, 'house');
  assert.equal(tracker.externalBaseline, false);
});

test('dynamic detection keeps an unsupported Future Bass baseline for compatible model evidence', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'future-bass' });
  const proxy = decisionResult(
    'dubstep',
    0.48,
    'techno',
    0.16,
    { 'future-bass': 0.48, phonk: 0.08 }
  );
  let event;
  for (let index = 0; index < 20; index += 1) {
    event = tracker.push({ shortResult: proxy, trackResult: proxy, segmentResult: proxy });
    assert.notEqual(event.stage, 'dynamic');
  }
  assert.equal(tracker.currentId, 'future-bass');
  assert.equal(event.currentGenreId, 'future-bass');
});

test('dynamic detection also protects a Phonk baseline from its Trap proxy', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'phonk' });
  const proxy = decisionResult(
    'hip-hop',
    0.44,
    'house',
    0.16,
    { 'future-bass': 0.12, phonk: 0.46 }
  );
  let event;
  for (let index = 0; index < 16; index += 1) {
    event = tracker.push({ shortResult: proxy, trackResult: proxy, segmentResult: proxy });
    assert.notEqual(event.stage, 'dynamic');
  }
  assert.equal(tracker.currentId, 'phonk');
});

test('dynamic detection can leave and later restore an unsupported metadata baseline', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'future-bass' });
  const techno = decisionResult(
    'techno',
    0.5,
    'dubstep',
    0.18,
    { 'future-bass': 0.12, phonk: 0.05 }
  );
  let switchEvent;
  for (let index = 0; index < 10; index += 1) {
    const event = tracker.push({ shortResult: techno, trackResult: techno, segmentResult: techno });
    if (event.stage === 'dynamic') switchEvent = event;
  }
  assert.equal(switchEvent?.genreId, 'techno');
  assert.equal(tracker.currentId, 'techno');

  const futureBassProxy = decisionResult(
    'dubstep',
    0.46,
    'techno',
    0.14,
    { 'future-bass': 0.5, phonk: 0.06 }
  );
  let restoreEvent;
  for (let index = 0; index < 10; index += 1) {
    const event = tracker.push({
      shortResult: futureBassProxy,
      trackResult: futureBassProxy,
      segmentResult: futureBassProxy
    });
    if (event.stage === 'dynamic') restoreEvent = event;
  }
  assert.equal(restoreEvent?.genreId, 'future-bass');
  assert.equal(restoreEvent?.restoredBaseline, true);
  assert.equal(restoreEvent?.inferredFromCompatibility, true);
  assert.equal(tracker.currentId, 'future-bass');
});

test('static artist fallback protects unsupported families without permanently locking them', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: false, baselineGenreId: 'future-bass' });
  const proxy = decisionResult(
    'dubstep',
    0.48,
    'techno',
    0.16,
    { 'future-bass': 0.5, phonk: 0.05 }
  );
  let event;
  for (let index = 0; index < 20; index += 1) {
    event = tracker.push({ shortResult: proxy, trackResult: proxy, segmentResult: proxy });
    assert.notEqual(event.stage, 'correction');
  }
  assert.equal(tracker.currentId, 'future-bass');

  const correctionTracker = new GenreDecisionTracker();
  correctionTracker.setContext({ dynamicEnabled: false, baselineGenreId: 'future-bass' });
  const techno = decisionResult(
    'techno',
    0.52,
    'dubstep',
    0.18,
    { 'future-bass': 0.1, phonk: 0.04 }
  );
  let correction;
  for (let index = 0; index < 12; index += 1) {
    const next = correctionTracker.push({ shortResult: techno, trackResult: techno, segmentResult: techno });
    if (next.stage === 'correction') correction = next;
  }
  assert.equal(correction?.genreId, 'techno');
  assert.equal(correctionTracker.currentId, 'techno');
});

test('a late catalog result realigns an unpublished AI first result', () => {
  const tracker = new GenreDecisionTracker();
  const trance = decisionResult('trance', 0.58, 'house', 0.22);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  }
  assert.equal(event.stage, 'first');
  assert.equal(tracker.currentId, 'trance');

  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'house' });
  assert.equal(tracker.currentId, 'house');
  assert.equal(tracker.externalBaseline, true);
  assert.equal(tracker.lastSwitchWindow, tracker.acceptedWindows);
});

test('a late catalog result also realigns an AI correction made before lookup completed', () => {
  const tracker = new GenreDecisionTracker();
  const trance = decisionResult('trance', 0.58, 'house', 0.22);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  }

  const cumulativeDubstep = decisionResult('dubstep', 0.52, 'trance', 0.2);
  let event;
  let correction;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({
      shortResult: cumulativeDubstep,
      trackResult: cumulativeDubstep,
      segmentResult: cumulativeDubstep
    });
    if (event.stage === 'correction') correction = event;
  }
  assert.equal(correction?.stage, 'correction');
  assert.equal(tracker.correctionCount, 1);

  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'house' });
  assert.equal(tracker.currentId, 'house');
  assert.equal(tracker.externalBaseline, true);
});

test('an unresolved local-AI track stays identifying instead of displaying Unknown', () => {
  assert.equal(shouldKeepGenreIdentifying({
    displayedGenreId: 'unknown',
    modelState: 'prediction'
  }), true);
  assert.equal(shouldKeepGenreIdentifying({
    displayedGenreId: 'unknown',
    decisionGenreId: 'house',
    modelState: 'prediction'
  }), false);
  assert.equal(shouldKeepGenreIdentifying({
    displayedGenreId: 'unknown',
    modelState: 'unavailable'
  }), false);
  assert.equal(shouldKeepGenreIdentifying({
    displayedGenreId: 'house',
    modelState: 'prediction'
  }), false);
});

test('a late first result retains a correction tail beyond the normal analysis horizon', () => {
  const tracker = new GenreDecisionTracker({
    correctionWindowLimit: 10,
    postFirstCorrectionWindows: 12
  });
  const unknown = decisionResult('unknown', 0.3, 'electronic', 0.26);
  for (let index = 0; index < 10; index += 1) {
    tracker.push({ shortResult: unknown, trackResult: unknown, segmentResult: unknown });
  }

  const house = decisionResult('house', 0.58, 'electronic', 0.22);
  let event;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.acceptedWindows, 14);
  assert.equal(event.analysisWindowLimit, 26);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 24,
    settleWindowLimit: event.analysisWindowLimit
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 26,
    settleWindowLimit: event.analysisWindowLimit
  }), false);
});

test('static detection does not let a sustained recent section override the cumulative result', () => {
  const tracker = new GenreDecisionTracker();
  const hardcore = decisionResult('hardcore', 0.62, 'trance', 0.2);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({ shortResult: hardcore, trackResult: hardcore });
  }
  assert.equal(event.stage, 'first');

  const stableTrack = decisionResult('hardcore', 0.52, 'trance', 0.32);
  const trance = decisionResult('trance', 0.58, 'hardcore', 0.42);
  for (let index = 0; index < 12; index += 1) {
    event = tracker.push({ shortResult: trance, trackResult: stableTrack, segmentResult: trance });
    assert.notEqual(event.stage, 'correction');
  }
  assert.equal(tracker.currentId, 'hardcore');
});

test('a stricter cumulative conclusion can finalize one earlier cumulative correction', () => {
  const tracker = new GenreDecisionTracker({
    correctionWindowLimit: 10,
    postFirstCorrectionWindows: 12
  });
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'first');

  const cumulativeTechno = decisionResult('techno', 0.54, 'house', 0.26);
  let firstCorrection;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({
      shortResult: cumulativeTechno,
      trackResult: cumulativeTechno,
      segmentResult: cumulativeTechno
    });
    if (event.stage === 'correction') firstCorrection = event;
  }
  assert.equal(firstCorrection?.genreId, 'techno');
  assert.equal(firstCorrection?.correctionCount, 1);
  assert.equal(firstCorrection?.finalCorrectionCount, 0);
  assert.equal(firstCorrection?.analysisWindowLimit, 27);

  const cumulativeDubstep = decisionResult('dubstep', 0.5, 'techno', 0.25);
  const broadRecent = decisionResult('electronic', 0.42, 'dubstep', 0.25);
  for (let index = 0; index < 9; index += 1) {
    event = tracker.push({
      shortResult: broadRecent,
      trackResult: cumulativeDubstep,
      segmentResult: broadRecent
    });
    assert.notEqual(event.correctionEvidence, 'cumulative-final');
  }
  event = tracker.push({
    shortResult: broadRecent,
    trackResult: cumulativeDubstep,
    segmentResult: broadRecent
  });
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'dubstep');
  assert.equal(event.previousGenreId, 'techno');
  assert.equal(event.correctionEvidence, 'cumulative-final');
  assert.equal(event.correctionCount, 2);
  assert.equal(event.finalCorrectionCount, 1);

  const laterHouse = decisionResult('house', 0.65, 'dubstep', 0.2);
  for (let index = 0; index < 12; index += 1) {
    event = tracker.push({ shortResult: laterHouse, trackResult: laterHouse, segmentResult: laterHouse });
  }
  assert.notEqual(event.stage, 'correction');
  assert.equal(tracker.currentId, 'dubstep');
});

test('AI analyzing remains visible only while a static correction can still occur', () => {
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'techno',
    acceptedWindows: 20,
    correctionCount: 1,
    finalCorrectionCount: 0
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'dubstep',
    acceptedWindows: 23,
    correctionCount: 2,
    finalCorrectionCount: 1
  }), false);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'dubstep',
    acceptedWindows: 500,
    correctionCount: 8,
    finalCorrectionCount: 1,
    fullTrackLearning: true
  }), true);
});

test('first full-track learning can revise a cumulative result beyond the normal correction limits', () => {
  const tracker = new GenreDecisionTracker({ correctionWindowLimit: 20 });
  tracker.setContext({ fullTrackLearning: true });
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  let event;
  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'first');

  for (const genreId of ['techno', 'dubstep', 'trance']) {
    const candidate = decisionResult(genreId, 0.54, tracker.currentId, 0.26);
    for (let index = 0; index < 11; index += 1) {
      event = tracker.push({ shortResult: candidate, trackResult: candidate, segmentResult: candidate });
      assert.notEqual(event.stage, 'correction');
    }
    event = tracker.push({ shortResult: candidate, trackResult: candidate, segmentResult: candidate });
    assert.equal(event.stage, 'correction');
    assert.equal(event.genreId, genreId);
    assert.equal(event.correctionEvidence, 'cumulative-full-track');
  }

  assert.equal(event.acceptedWindows, 44);
  assert.equal(event.correctionCount, 3);
  assert.equal(tracker.currentId, 'trance');
});

test('a stable cumulative result can correct an intro decision even when the recent segment is broad', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const intro = decisionResult('hip-hop', 0.52, 'dubstep', 0.26);
  let event;
  for (let index = 0; index < 14; index += 1) {
    event = tracker.push({ shortResult: intro, trackResult: intro, segmentResult: intro });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'hip-hop');

  const cumulativeDubstep = decisionResult('dubstep', 0.4, 'hip-hop', 0.28);
  const broadRecent = decisionResult('electronic', 0.42, 'dubstep', 0.25);
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({
      shortResult: broadRecent,
      trackResult: cumulativeDubstep,
      segmentResult: broadRecent
    });
    assert.notEqual(event.stage, 'correction');
  }
  event = tracker.push({
    shortResult: broadRecent,
    trackResult: cumulativeDubstep,
    segmentResult: broadRecent
  });
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'dubstep');
  assert.equal(event.correctionEvidence, 'cumulative');
  assert.equal(event.supportedByPrior, true);
});

test('static detection ignores a persistent recent challenger while cumulative evidence is unchanged', () => {
  const tracker = new GenreDecisionTracker();
  const trance = decisionResult('trance', 0.62, 'dubstep', 0.2);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  }

  const cumulativeTrance = decisionResult('trance', 0.5, 'dubstep', 0.18);
  const dubstep = decisionResult('dubstep', 0.2, 'trance', 0.08);
  let event;
  for (let index = 0; index < 10; index += 1) {
    event = tracker.push({
      shortResult: dubstep,
      trackResult: cumulativeTrance,
      segmentResult: dubstep
    });
    assert.notEqual(event.stage, 'correction');
  }
  assert.equal(tracker.currentId, 'trance');
});

test('static detection keeps the cumulative result despite a long conflicting recent majority', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 10; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.58, 'techno', 0.18);
  const recentTechno = decisionResult('techno', 0.4, 'house', 0.2);
  let event;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeHouse,
      segmentResult: recentTechno
    });
  }
  assert.notEqual(event.stage, 'correction');

  for (let index = 0; index < 8; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeHouse,
      segmentResult: recentTechno
    });
    assert.notEqual(event.stage, 'correction');
  }
  assert.equal(tracker.currentId, 'house');
});

test('static detection gives no independent override to overwhelming recent evidence', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 10; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.58, 'techno', 0.18);
  const decisiveTechno = decisionResult('techno', 0.5, 'house', 0.2);
  let event;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({
      shortResult: decisiveTechno,
      trackResult: cumulativeHouse,
      segmentResult: decisiveTechno
    });
  }
  assert.notEqual(event.stage, 'correction');
  assert.equal(tracker.currentId, 'house');
});

test('static detection corrects a low-margin cumulative winner only after it is persistent', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeTechno = decisionResult('techno', 0.205, 'house', 0.185);
  const recentTechno = decisionResult('techno', 0.2, 'house', 0.18);
  let event;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeTechno,
      segmentResult: recentTechno
    });
    assert.notEqual(event.stage, 'correction');
  }
  event = tracker.push({
    shortResult: recentTechno,
    trackResult: cumulativeTechno,
    segmentResult: recentTechno
  });
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'techno');
  assert.equal(event.correctionEvidence, 'cumulative');
});

test('static detection rejects a stable cumulative winner below the noise floor', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const weakTechno = decisionResult('techno', 0.14, 'house', 0.13);
  let event;
  for (let index = 0; index < 12; index += 1) {
    event = tracker.push({ shortResult: weakTechno, trackResult: weakTechno, segmentResult: weakTechno });
  }
  assert.equal(event.stage, 'challenger');
  assert.equal(tracker.currentId, 'house');
});

test('a broad cumulative result cannot authorize a concrete static correction', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const broadTrack = decisionResult('electronic', 0.44, 'techno', 0.25);
  const recentTechno = decisionResult('techno', 0.4, 'house', 0.2);
  let event;
  for (let index = 0; index < 4; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: broadTrack,
      segmentResult: recentTechno
    });
  }
  assert.notEqual(event.stage, 'correction');
  assert.equal(tracker.currentId, 'house');
});

test('static detection stabilizes a family before refining to a persistent child genre', () => {
  const tracker = new GenreDecisionTracker();
  const hardTechno = decisionResultFromScores({
    'hard-techno': 0.46,
    techno: 0.22,
    trance: 0.18
  });
  let first;
  let refinement;
  for (let index = 0; index < 16; index += 1) {
    const event = tracker.push({
      shortResult: hardTechno,
      trackResult: hardTechno,
      segmentResult: hardTechno
    });
    if (event.stage === 'first') first = event;
    if (event.stage === 'refinement') refinement = event;
  }
  assert.equal(first?.genreId, 'techno');
  assert.equal(refinement?.genreId, 'hard-techno');
  assert.equal(first?.acceptedWindows, 8);
  assert.equal(refinement?.acceptedWindows, 9);
  assert.equal(refinement?.parentGenreId, 'techno');
  assert.equal(refinement?.hierarchicalRefinement, true);
});

test('dynamic detection switches across families before refining within the new family', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'trance' });
  const familySplit = decisionResultFromScores({
    'hard-techno': 0.34,
    'minimal-techno': 0.31,
    techno: 0.2,
    trance: 0.18
  });
  let familySwitch;
  for (let index = 0; index < 10; index += 1) {
    const event = tracker.push({
      shortResult: familySplit,
      trackResult: familySplit,
      segmentResult: familySplit
    });
    if (event.stage === 'dynamic') familySwitch = event;
  }
  assert.equal(familySwitch?.genreId, 'techno');
  assert.equal(familySwitch?.familyLevelDecision, true);
  assert.equal(familySwitch?.acceptedWindows, 10);

  const hardTechno = decisionResultFromScores({
    'hard-techno': 0.46,
    techno: 0.25,
    trance: 0.14
  });
  let refinement;
  for (let index = 0; index < 10; index += 1) {
    const event = tracker.push({
      shortResult: hardTechno,
      trackResult: hardTechno,
      segmentResult: hardTechno
    });
    if (event.hierarchicalRefinement) refinement = event;
  }
  assert.equal(refinement?.stage, 'dynamic');
  assert.equal(refinement?.genreId, 'hard-techno');
  assert.equal(refinement?.acceptedWindows, 13);
  assert.equal(refinement?.parentGenreId, 'techno');
});

test('several weaker branches cannot outscore a stronger branchless genre', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true, baselineGenreId: 'techno' });
  const splitTechno = decisionResultFromScores({
    synthwave: 0.3,
    'hard-techno': 0.25,
    'minimal-techno': 0.23,
    techno: 0.2
  });
  assert.equal(audioGenreFamilyResult(splitTechno).id, 'synthwave');

  let switchEvent;
  for (let index = 0; index < 16; index += 1) {
    const event = tracker.push({
      shortResult: splitTechno,
      trackResult: splitTechno,
      segmentResult: splitTechno
    });
    if (event.stage === 'dynamic') switchEvent = event;
  }
  assert.equal(switchEvent?.genreId, 'synthwave');
  assert.equal(tracker.currentId, 'synthwave');
});

test('static and dynamic detection assign authority to cumulative and recent evidence respectively', () => {
  const fixed = new GenreDecisionTracker();
  const dynamic = new GenreDecisionTracker();
  dynamic.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 8; index += 1) {
    fixed.push({ shortResult: house, trackResult: house, segmentResult: house });
    dynamic.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeTechno = decisionResult('techno', 0.48, 'house', 0.28);
  let fixedCorrection;
  for (let index = 0; index < 8; index += 1) {
    const fixedEvent = fixed.push({
      shortResult: house,
      trackResult: cumulativeTechno,
      segmentResult: house
    });
    const dynamicEvent = dynamic.push({
      shortResult: house,
      trackResult: cumulativeTechno,
      segmentResult: house
    });
    if (fixedEvent.stage === 'correction') fixedCorrection = fixedEvent;
    assert.notEqual(dynamicEvent.stage, 'correction');
    assert.notEqual(dynamicEvent.stage, 'dynamic');
  }
  assert.equal(fixedCorrection?.genreId, 'techno');
  assert.equal(dynamic.currentId, 'house');

  const recentTechno = decisionResult('techno', 0.5, 'house', 0.24);
  let dynamicSwitch;
  for (let index = 0; index < 6; index += 1) {
    const event = dynamic.push({
      shortResult: recentTechno,
      trackResult: cumulativeTechno,
      segmentResult: recentTechno
    });
    if (event.stage === 'dynamic') dynamicSwitch = event;
  }
  assert.equal(dynamicSwitch?.genreId, 'techno');
});

test('dynamic genre changes require the opt-in setting, a long majority, and cooldown', () => {
  const makeTracker = (dynamicEnabled) => {
    const tracker = new GenreDecisionTracker({ correctionWindowLimit: 3, postFirstCorrectionWindows: 0 });
    tracker.setContext({ dynamicEnabled });
    return tracker;
  };
  const fixed = makeTracker(false);
  const dynamic = makeTracker(true);
  const house = decisionResult('house', 0.64, 'trance', 0.18);
  for (let index = 0; index < 8; index += 1) {
    fixed.push({ shortResult: house, trackResult: house, segmentResult: house });
    dynamic.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const stableTrack = decisionResult('house', 0.52, 'trance', 0.32);
  const tranceSegment = decisionResult('trance', 0.65, 'house', 0.28);
  let fixedEvent;
  let dynamicEvent;
  let dynamicSwitch;
  for (let index = 0; index < 15; index += 1) {
    fixedEvent = fixed.push({ shortResult: tranceSegment, trackResult: stableTrack, segmentResult: tranceSegment });
    dynamicEvent = dynamic.push({ shortResult: tranceSegment, trackResult: stableTrack, segmentResult: tranceSegment });
    if (dynamicEvent.stage === 'dynamic') dynamicSwitch = dynamicEvent;
  }
  assert.notEqual(fixedEvent.stage, 'dynamic');
  assert.equal(dynamicSwitch?.stage, 'dynamic');
  assert.equal(dynamicSwitch?.previousGenreId, 'house');
});

test('dynamic detection can follow more than three stable section changes', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.64, 'trance', 0.18);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.52, 'trance', 0.2);
  const sectionGenres = ['techno', 'dubstep', 'trance', 'hardcore'];
  const switches = [];
  for (const genreId of sectionGenres) {
    const section = decisionResult(genreId, 0.62, tracker.currentId, 0.2);
    for (let index = 0; index < 10; index += 1) {
      const event = tracker.push({
        shortResult: section,
        trackResult: cumulativeHouse,
        segmentResult: section
      });
      if (event.stage === 'dynamic') switches.push(event.genreId);
    }
  }

  assert.deepEqual(switches, sectionGenres);
  assert.equal(tracker.currentId, 'hardcore');
  assert.equal(tracker.dynamicSwitchCount, 4);
});

test('dynamic detection accepts a persistent low-score family lead without a fixed score ratio', () => {
  const tracker = new GenreDecisionTracker({ correctionWindowLimit: 3, postFirstCorrectionWindows: 0 });
  tracker.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.64, 'dubstep', 0.18);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.5, 'dubstep', 0.18);
  const dubstep = decisionResult('dubstep', 0.171, 'house', 0.165);
  let dynamicSwitch;
  for (let index = 0; index < 10; index += 1) {
    const event = tracker.push({
      shortResult: dubstep,
      trackResult: cumulativeHouse,
      segmentResult: dubstep
    });
    if (event.stage === 'dynamic') dynamicSwitch = event;
  }
  assert.equal(dynamicSwitch?.genreId, 'dubstep');
  assert.equal(dynamicSwitch?.supportedByPersistentLowScore, true);
});

test('an early correction cannot bypass cooldown after a dynamic switch', () => {
  const tracker = new GenreDecisionTracker();
  tracker.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.62, 'trance', 0.2);
  for (let index = 0; index < 11; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.5, 'trance', 0.28);
  const recentTrance = decisionResult('trance', 0.33, 'house', 0.25);
  let event;
  let dynamicSwitch;
  for (let index = 0; index < 10; index += 1) {
    event = tracker.push({
      shortResult: recentTrance,
      trackResult: cumulativeHouse,
      segmentResult: recentTrance
    });
    if (event.stage === 'dynamic') dynamicSwitch = event;
  }
  assert.equal(dynamicSwitch?.stage, 'dynamic');

  const cumulativeTrance = decisionResult('trance', 0.52, 'dubstep', 0.28);
  const recentDubstep = decisionResult('dubstep', 0.5, 'trance', 0.2);
  for (let index = 0; index < 5; index += 1) {
    event = tracker.push({
      shortResult: recentDubstep,
      trackResult: cumulativeTrance,
      segmentResult: recentDubstep
    });
    assert.notEqual(event.stage, 'correction');
  }
});

test('broad Electronic cannot correct or dynamically replace a concrete audio result', () => {
  const tracker = new GenreDecisionTracker({ correctionWindowLimit: 3, postFirstCorrectionWindows: 0 });
  tracker.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.64, 'electronic', 0.18);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const electronic = decisionResult('electronic', 0.72, 'house', 0.2);
  let event;
  for (let index = 0; index < 20; index += 1) {
    event = tracker.push({ shortResult: electronic, trackResult: electronic, segmentResult: electronic });
  }
  assert.notEqual(event.stage, 'correction');
  assert.notEqual(event.stage, 'dynamic');
  assert.equal(tracker.currentId, 'house');
});
