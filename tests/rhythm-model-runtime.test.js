'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  BluesteinRealFft,
  CausalFeatures,
  HOP_SIZE,
  LocalRhythmModel,
  SAMPLE_RATE,
  buildFilterbank
} = require('../src/rhythm-model-runtime');

const root = path.resolve(__dirname, '..');

function approximately(actual, expected, tolerance = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('Bluestein FFT matches a direct arbitrary-length DFT', () => {
  const input = Float32Array.from([0.2, -0.4, 0.8, 0.1, -0.3, 0.6, -0.2]);
  const actual = new BluesteinRealFft(input.length).magnitude(input, 3);
  for (let bin = 0; bin < actual.length; bin += 1) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < input.length; index += 1) {
      const angle = -2 * Math.PI * bin * index / input.length;
      real += input[index] * Math.cos(angle);
      imaginary += input[index] * Math.sin(angle);
    }
    approximately(actual[bin], Math.hypot(real, imaginary), 1e-6);
  }
});

test('JavaScript causal BeatNet features match the Python reference pipeline', () => {
  assert.equal(buildFilterbank().length, 136);
  const features = new CausalFeatures();
  let frame = null;
  for (let hop = 0; hop < 20; hop += 1) {
    frame = features.update(Float32Array.from(
      { length: HOP_SIZE },
      (_value, index) => Math.sin(2 * Math.PI * 110 * (hop * HOP_SIZE + index) / SAMPLE_RATE)
    ));
  }
  const reference = new Map([
    [0, 0.07744191586971283],
    [1, 0.1792919933795929],
    [12, 0.013847650028765202],
    [40, 0.00019063419313170016],
    [80, 0.000005280705408949871],
    [135, 0.0000003106315205059218],
    [148, 0.0006181532517075539]
  ]);
  for (const [index, expected] of reference) approximately(frame[index], expected, 5e-7);
  approximately(frame.reduce((sum, value) => sum + value, 0), 8.8283109664917, 2e-6);
});

test('bundled ONNX BeatNet keeps recurrent state and emits rhythm updates', { timeout: 15000 }, async () => {
  const modelPath = path.join(root, 'assets', 'models', 'beatnet-model-1.onnx');
  assert.equal(fs.existsSync(modelPath), true);
  const events = [];
  const model = new LocalRhythmModel({ modelPath, onEvent: (event) => events.push(event) });
  assert.equal(await model.initialize(), true);
  for (let hop = 0; hop < 16; hop += 1) {
    model.ingest(Float32Array.from(
      { length: HOP_SIZE },
      (_value, index) => 0.15 * Math.sin(2 * Math.PI * 110 * (hop * HOP_SIZE + index) / SAMPLE_RATE)
    ));
    while (model.processing || model.queue.length) {
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
  }
  const ready = events.find((event) => event.type === 'ready');
  const rhythm = events.find((event) => event.type === 'rhythm');
  assert.match(ready?.model || '', /ONNX/);
  assert.ok(Number.isFinite(rhythm?.beat));
  assert.ok(Number.isFinite(rhythm?.downbeat));
  assert.ok(Number.isFinite(rhythm?.inferenceMs));
  assert.equal(model.hidden.length, 300);
  assert.ok(model.hidden.some((value) => Math.abs(value) > 1e-7));
  await model.close();
});

test('closing the rhythm model during initialization releases the late session', async () => {
  let finishCreate;
  let releases = 0;
  const events = [];
  const session = { release: async () => { releases += 1; } };
  const ort = {
    InferenceSession: {
      create: () => new Promise((resolve) => { finishCreate = () => resolve(session); })
    }
  };
  const model = new LocalRhythmModel({ modelPath: 'delayed.onnx', ort, onEvent: (event) => events.push(event) });
  const initialization = model.initialize();

  await model.close();
  finishCreate();

  assert.equal(await initialization, false);
  assert.equal(releases, 1);
  assert.deepEqual(events, []);
});

test('portable runtime no longer depends on a user-installed Python model host', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const audio = fs.readFileSync(path.join(root, 'renderer', 'audio-engine.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.doesNotMatch(main, /GP_RHYTHM_MODEL_PYTHON|rhythm-model\.py|beatnet-model-1\.pt/);
  assert.match(main, /beatnet-model-1\.onnx/);
  assert.match(preload, /submitRhythmAudio/);
  assert.match(audio, /AudioWorkletNode[\s\S]*submitRhythmAudio/);
  assert.equal(packageJson.dependencies['onnxruntime-node'], '^1.29.0');
  assert.ok(packageJson.build.asarUnpack.some((entry) => entry.includes('onnxruntime-node')));
  assert.ok(packageJson.build.files.some((entry) => entry.includes('beatnet-model-1.pt')));
});
