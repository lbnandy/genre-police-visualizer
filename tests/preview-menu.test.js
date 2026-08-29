'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { THEMES, DEMO_THEME_IDS } = require('../src/themes');
const { buildPreviewTree } = require('../src/preview-menu');

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children || [], id);
    if (nested) return nested;
  }
  return null;
}

test('preview menu nests subgenres under their immediate parent genres', () => {
  const tree = buildPreviewTree(THEMES, DEMO_THEME_IDS);
  const house = findNode(tree, 'house');
  const electro = findNode(house.children, 'electro-house');
  assert.ok(house.selectable);
  assert.ok(electro.selectable);
  assert.equal(findNode(electro.children, 'complextro').selectable, true);
  assert.equal(findNode(house.children, 'big-room-house').selectable, true);
  assert.equal(findNode(house.children, 'amapiano').selectable, true);

  const dubstep = findNode(tree, 'dubstep');
  assert.equal(findNode(dubstep.children, 'riddim').selectable, true);
  assert.equal(findNode(dubstep.children, 'colour-bass').selectable, true);

  const breakbeat = findNode(tree, 'breakbeat');
  assert.equal(findNode(breakbeat.children, 'breakcore').selectable, true);

  const metalcore = findNode(tree, 'metalcore');
  assert.equal(findNode(metalcore.children, 'deathcore').selectable, true);

  const dnb = findNode(tree, 'drum-bass');
  assert.equal(findNode(dnb.children, 'drumstep').selectable, true);

  const hipHop = findNode(tree, 'hip-hop');
  assert.equal(findNode(hipHop.children, 'experimental-hip-hop').selectable, true);
  const phonk = findNode(hipHop.children, 'phonk');
  assert.equal(phonk.selectable, true);
  assert.equal(findNode(phonk.children, 'drift-phonk').selectable, true);

  const hardDance = findNode(tree, 'hard-dance');
  assert.equal(findNode(hardDance.children, 'hardstyle').selectable, true);
  assert.equal(findNode(hardDance.children, 'hardcore').selectable, false);
  assert.equal(findNode(findNode(hardDance.children, 'hardcore').children, 'frenchcore').selectable, true);
});

test('preview hierarchy keeps every previewable genre exactly once', () => {
  const tree = buildPreviewTree(THEMES, DEMO_THEME_IDS);
  const ids = [];
  const collect = (nodes) => nodes.forEach((node) => {
    if (node.selectable) ids.push(node.id);
    collect(node.children || []);
  });
  collect(tree);
  assert.equal(ids.length, DEMO_THEME_IDS.length);
  assert.deepEqual(new Set(ids), new Set(DEMO_THEME_IDS));
});
