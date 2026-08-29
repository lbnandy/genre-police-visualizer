'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('slightly reduces only medium-high and high spectrum peak densities', async () => {
  const { reduceDenseSpectrumBins } = await import('../renderer/spectrum-density.mjs');
  assert.equal(reduceDenseSpectrumBins(48), 48);
  assert.equal(reduceDenseSpectrumBins(50), 48);
  assert.equal(reduceDenseSpectrumBins(54), 52);
  assert.equal(reduceDenseSpectrumBins(56), 53);
  assert.equal(reduceDenseSpectrumBins(60), 57);
  assert.equal(reduceDenseSpectrumBins(64), 60);
});
