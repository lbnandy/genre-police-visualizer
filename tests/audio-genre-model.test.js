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
  audioGenreTreeDistance,
  buildPatchTensor,
  discogsClassToMajor,
  fuseGenreEvidence,
  hasSignificantPlaybackSeek,
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

test('family aggregation does not reward a family merely for having more labels', () => {
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

function decisionResult(id, confidence, runnerUpId, runnerUpScore) {
  const scores = { [id]: confidence, [runnerUpId]: runnerUpScore };
  return {
    id,
    confidence,
    margin: confidence - runnerUpScore,
    scores,
    ranked: Object.entries(scores)
      .map(([genreId, score]) => ({ id: genreId, score }))
      .sort((left, right) => right.score - left.score)
  };
}

test('author agreement can produce the first result early without bypassing temporal stability', () => {
  const unsupported = new GenreDecisionTracker();
  const supported = new GenreDecisionTracker();
  supported.setContext({ priorGenreIds: ['hardcore'] });
  const result = decisionResult('hardcore', 0.38, 'house', 0.31);
  for (let index = 0; index < 2; index += 1) {
    assert.equal(unsupported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
    assert.equal(supported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
  }
  assert.equal(unsupported.push({ shortResult: result, trackResult: result }).stage, 'waiting');
  assert.equal(supported.push({ shortResult: result, trackResult: result }).stage, 'first');
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
  for (let index = 0; index < 2; index += 1) {
    assert.equal(nearby.push({ shortResult: house, trackResult: house }).stage, 'waiting');
  }
  assert.equal(nearby.push({ shortResult: house, trackResult: house }).stage, 'first');

  const distant = new GenreDecisionTracker();
  distant.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const ambient = decisionResult('ambient', 0.52, 'downtempo', 0.26);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(distant.push({ shortResult: ambient, trackResult: ambient }).stage, 'waiting');
  }
  const distantFirst = distant.push({ shortResult: ambient, trackResult: ambient });
  assert.equal(distantFirst.stage, 'first');
  assert.equal(distantFirst.authorPriorDistance, 4);

  const disconnected = new GenreDecisionTracker();
  disconnected.setContext({ priorGenreIds: ['dubstep'], guardGenreIds: ['dubstep'] });
  const folk = decisionResult('folk', 0.52, 'country', 0.26);
  for (let index = 0; index < 7; index += 1) {
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
  for (let index = 0; index < 7; index += 1) {
    const event = tracker.push({ shortResult: folk, trackResult: broad, segmentResult: folk });
    assert.notEqual(event.stage, 'refinement');
  }
  const refined = tracker.push({ shortResult: folk, trackResult: broad, segmentResult: folk });
  assert.equal(refined.stage, 'refinement');
  assert.equal(refined.genreId, 'folk');
});

test('a sustained low score with a clear relative lead can produce the first result', () => {
  const tracker = new GenreDecisionTracker();
  const result = decisionResult('dubstep', 0.19, 'trance', 0.07);
  let event;
  for (let index = 0; index < 9; index += 1) {
    event = tracker.push({ shortResult: result, trackResult: result, segmentResult: result });
    assert.equal(event.stage, 'waiting');
  }
  event = tracker.push({ shortResult: result, trackResult: result, segmentResult: result });
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'dubstep');
  assert.equal(event.supportedByRelativeLead, true);
});

test('relative lead fallback still rejects very weak or unstable guesses', () => {
  const tooWeak = new GenreDecisionTracker();
  const weakResult = decisionResult('dubstep', 0.17, 'trance', 0.03);
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
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeHouse,
      segmentResult: recentTechno
    });
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
  for (let index = 0; index < 3; index += 1) {
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

test('recent evidence cannot claim independent support during the first six windows', () => {
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
  for (let index = 0; index < 3; index += 1) {
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
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({
      shortResult: recentElectronic,
      trackResult: weakHouse,
      segmentResult: recentElectronic
    });
  }
  event = tracker.push({
    shortResult: recentElectronic,
    trackResult: strongHouse,
    segmentResult: recentElectronic
  });
  assert.equal(event.stage, 'first');
  assert.equal(event.genreId, 'house');
});

test('broad Electronic stays provisional and never prevents a later concrete first result', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.62, 'house', 0.24);
  let event;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({ shortResult: electronic, trackResult: electronic });
  }
  assert.equal(event.stage, 'provisional');
  assert.equal(tracker.currentId, '');
  assert.equal(isBroadAudioGenre(event.genreId), true);

  const house = decisionResult('house', 0.63, 'electronic', 0.24);
  for (let index = 0; index < 3; index += 1) {
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

test('a persistent relative lead can refine a broad result despite low absolute scores', () => {
  const tracker = new GenreDecisionTracker();
  const electronic = decisionResult('electronic', 0.42, 'house', 0.36);
  for (let index = 0; index < 6; index += 1) {
    tracker.push({ shortResult: electronic, trackResult: electronic, segmentResult: electronic });
  }

  const dubstep = decisionResult('dubstep', 0.19, 'trance', 0.07);
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
  const weakMetal = decisionResult('metal', 0.27, 'rock', 0.23);
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
  for (let index = 0; index < 7; index += 1) {
    event = tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
    assert.notEqual(event.stage, 'correction');
    assert.notEqual(event.stage, 'dynamic');
  }
  event = tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  assert.equal(event.stage, 'dynamic');
  assert.equal(event.previousGenreId, 'house');
  assert.equal(tracker.externalBaseline, false);
});

test('a late catalog result realigns an unpublished AI first result', () => {
  const tracker = new GenreDecisionTracker();
  const trance = decisionResult('trance', 0.58, 'house', 0.22);
  let event;
  for (let index = 0; index < 3; index += 1) {
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
  for (let index = 0; index < 3; index += 1) {
    tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  }

  const cumulativeTrance = decisionResult('trance', 0.5, 'dubstep', 0.28);
  const recentDubstep = decisionResult('dubstep', 0.52, 'trance', 0.2);
  let event;
  for (let index = 0; index < 5; index += 1) {
    event = tracker.push({
      shortResult: recentDubstep,
      trackResult: cumulativeTrance,
      segmentResult: recentDubstep
    });
  }
  assert.equal(event.stage, 'correction');
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
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }
  assert.equal(event.stage, 'first');
  assert.equal(event.acceptedWindows, 13);
  assert.equal(event.analysisWindowLimit, 25);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 24,
    settleWindowLimit: event.analysisWindowLimit
  }), true);
  assert.equal(shouldAnalyzeAudioGenre({
    metadataKind: 'broad',
    decisionGenreId: 'house',
    acceptedWindows: 25,
    settleWindowLimit: event.analysisWindowLimit
  }), false);
});

test('a sustained stronger recent result can correct the first audio decision once', () => {
  const tracker = new GenreDecisionTracker();
  const hardcore = decisionResult('hardcore', 0.62, 'trance', 0.2);
  let event;
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({ shortResult: hardcore, trackResult: hardcore });
  }
  assert.equal(event.stage, 'first');

  const stableTrack = decisionResult('hardcore', 0.52, 'trance', 0.32);
  const trance = decisionResult('trance', 0.58, 'hardcore', 0.42);
  for (let index = 0; index < 5; index += 1) {
    event = tracker.push({ shortResult: trance, trackResult: stableTrack, segmentResult: trance });
  }
  assert.equal(event.stage, 'correction');
  assert.equal(event.previousGenreId, 'hardcore');

  const house = decisionResult('house', 0.7, 'trance', 0.3);
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({ shortResult: house, trackResult: stableTrack, segmentResult: house });
  }
  assert.notEqual(event.stage, 'correction');
});

test('persistent low-score relative evidence can correct an early wrong result', () => {
  const tracker = new GenreDecisionTracker();
  const trance = decisionResult('trance', 0.62, 'dubstep', 0.2);
  for (let index = 0; index < 3; index += 1) {
    tracker.push({ shortResult: trance, trackResult: trance, segmentResult: trance });
  }

  const cumulativeTrance = decisionResult('trance', 0.5, 'dubstep', 0.18);
  const dubstep = decisionResult('dubstep', 0.2, 'trance', 0.08);
  let event;
  let correction;
  for (let index = 0; index < 6; index += 1) {
    event = tracker.push({
      shortResult: dubstep,
      trackResult: cumulativeTrance,
      segmentResult: dubstep
    });
    if (event.stage === 'correction') correction = event;
  }
  assert.equal(correction?.genreId, 'dubstep');
  assert.equal(correction?.supportedByRelativeLead, true);
});

test('strong cumulative opposition asks for a longer recent majority but cannot veto it', () => {
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

  event = tracker.push({
    shortResult: recentTechno,
    trackResult: cumulativeHouse,
    segmentResult: recentTechno
  });
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'techno');
  assert.equal(event.cumulativeSignal, 'opposition');
  assert.ok(event.correctionEvidenceStreak >= 2);
});

test('overwhelming recent evidence can override cumulative opposition without six-window delay', () => {
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
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'techno');
  assert.equal(event.cumulativeSignal, 'opposition');
});

test('cumulative support can accelerate a coherent early correction', () => {
  const tracker = new GenreDecisionTracker();
  const house = decisionResult('house', 0.62, 'techno', 0.2);
  for (let index = 0; index < 8; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeTechno = decisionResult('techno', 0.4, 'house', 0.3);
  const recentTechno = decisionResult('techno', 0.34, 'house', 0.26);
  let event;
  for (let index = 0; index < 3; index += 1) {
    event = tracker.push({
      shortResult: recentTechno,
      trackResult: cumulativeTechno,
      segmentResult: recentTechno
    });
  }
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'techno');
  assert.equal(event.cumulativeSignal, 'support');
});

test('a broad cumulative result is neutral during concrete early correction', () => {
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
  assert.equal(event.stage, 'correction');
  assert.equal(event.genreId, 'techno');
  assert.equal(event.cumulativeSignal, 'neutral');
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
  for (let index = 0; index < 3; index += 1) {
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

test('dynamic detection accepts a persistent low-score result with a clear relative lead', () => {
  const tracker = new GenreDecisionTracker({ correctionWindowLimit: 3, postFirstCorrectionWindows: 0 });
  tracker.setContext({ dynamicEnabled: true });
  const house = decisionResult('house', 0.64, 'dubstep', 0.18);
  for (let index = 0; index < 3; index += 1) {
    tracker.push({ shortResult: house, trackResult: house, segmentResult: house });
  }

  const cumulativeHouse = decisionResult('house', 0.5, 'dubstep', 0.18);
  const dubstep = decisionResult('dubstep', 0.2, 'house', 0.08);
  let dynamicSwitch;
  for (let index = 0; index < 8; index += 1) {
    const event = tracker.push({
      shortResult: dubstep,
      trackResult: cumulativeHouse,
      segmentResult: dubstep
    });
    if (event.stage === 'dynamic') dynamicSwitch = event;
  }
  assert.equal(dynamicSwitch?.genreId, 'dubstep');
  assert.equal(dynamicSwitch?.supportedByRelativeLead, true);
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
  for (let index = 0; index < 6; index += 1) {
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
  for (let index = 0; index < 3; index += 1) {
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
