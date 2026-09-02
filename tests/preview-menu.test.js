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
  const instrumentalHipHop = findNode(hipHop.children, 'instrumental-hip-hop');
  assert.equal(instrumentalHipHop.selectable, true);
  assert.equal(findNode(instrumentalHipHop.children, 'lo-fi-hip-hop').selectable, true);
  const phonk = findNode(hipHop.children, 'phonk');
  assert.equal(phonk.selectable, true);
  assert.equal(findNode(phonk.children, 'drift-phonk').selectable, true);

  const hardDance = findNode(tree, 'hard-dance');
  assert.equal(findNode(hardDance.children, 'hardstyle').selectable, true);
  assert.equal(findNode(hardDance.children, 'hardcore').selectable, true);
  assert.equal(findNode(findNode(hardDance.children, 'hardcore').children, 'frenchcore').selectable, true);

  const jazz = findNode(tree, 'jazz');
  for (const id of ['bebop', 'swing-jazz', 'jazz-fusion']) {
    assert.equal(findNode(jazz.children, id).selectable, true, id);
  }
  const latin = findNode(tree, 'latin');
  assert.equal(findNode(latin.children, 'bossa-nova').selectable, true);

  const classical = findNode(tree, 'classical');
  for (const id of ['baroque', 'romantic-classical', 'opera', 'modern-classical']) {
    assert.equal(findNode(classical.children, id).selectable, true, id);
  }

  const rnb = findNode(tree, 'rnb');
  for (const id of ['contemporary-rnb', 'alternative-rnb', 'new-jack-swing']) {
    assert.equal(findNode(rnb.children, id).selectable, true, id);
  }
  const soul = findNode(tree, 'soul');
  assert.equal(findNode(soul.children, 'neo-soul').selectable, true);
  assert.equal(findNode(tree, 'gospel').selectable, true);
  assert.equal(findNode(tree, 'funk').selectable, true);

  const electronic = findNode(tree, 'electronic');
  assert.equal(electronic.selectable, true);
  assert.equal(findNode(electronic.children, 'ambient').selectable, true);
  const edm = findNode(electronic.children, 'edm');
  assert.equal(edm.selectable, false);
  assert.equal(findNode(edm.children, 'house').selectable, true);
  assert.equal(findNode(edm.children, 'techno').selectable, true);
  assert.equal(findNode(edm.children, 'trance').selectable, true);
  const downtempo = findNode(electronic.children, 'downtempo');
  assert.equal(downtempo.selectable, true);
  assert.equal(findNode(downtempo.children, 'chillout').selectable, true);
  assert.equal(findNode(electronic.children, 'idm').selectable, true);
  assert.equal(findNode(electronic.children, 'glitch').selectable, true);
});

test('preview roots use stable genre names rather than presentation buckets', () => {
  const tree = buildPreviewTree(THEMES, DEMO_THEME_IDS);
  const rootLabels = tree.map((group) => group.label);
  for (const expected of [
    'BLUES', 'CLASSICAL', 'ELECTRONIC', 'FUNK / SOUL', 'HIP-HOP',
    'JAZZ', 'LATIN', 'POP', 'REGGAE', 'ROCK & METAL', 'STAGE & SCREEN'
  ]) {
    assert.ok(rootLabels.includes(expected), expected);
  }
  for (const retired of ['ART MUSIC', 'DANCE MUSIC', 'GUITAR MUSIC', 'HEAVY MUSIC', 'MAINSTREAM', 'URBAN']) {
    assert.equal(rootLabels.includes(retired), false, retired);
  }
});

test('every concrete visual is available from the preview tree', () => {
  assert.deepEqual(
    new Set(DEMO_THEME_IDS),
    new Set(Object.keys(THEMES).filter((id) => !['edm', 'unknown'].includes(id)))
  );
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
