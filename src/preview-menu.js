'use strict';

function normalizedLabel(value) {
  return String(value || '').trim().toLocaleUpperCase();
}

function buildPreviewTree(themes = {}, previewIds = []) {
  const selectable = new Set(previewIds.filter((id) => themes[id]));
  const labelToId = new Map();
  for (const [id, theme] of Object.entries(themes)) {
    if (id === 'unknown' || !theme?.label) continue;
    const label = normalizedLabel(theme.label);
    if (!labelToId.has(label)) labelToId.set(label, id);
  }

  const active = new Set(selectable);
  for (const startingId of selectable) {
    let currentId = startingId;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parentId = labelToId.get(normalizedLabel(themes[currentId]?.parent));
      if (!parentId || parentId === currentId) break;
      active.add(parentId);
      currentId = parentId;
    }
  }

  const children = new Map();
  const roots = new Map();
  const append = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  for (const id of active) {
    const parentLabel = normalizedLabel(themes[id]?.parent) || 'OTHER';
    const parentId = labelToId.get(parentLabel);
    if (parentId && parentId !== id && active.has(parentId)) append(children, parentId, id);
    else append(roots, parentLabel, id);
  }

  const byLabel = (left, right) => String(themes[left]?.label || left)
    .localeCompare(String(themes[right]?.label || right), 'en');
  const makeNode = (id) => ({
    id,
    label: themes[id]?.label || id,
    selectable: selectable.has(id),
    children: (children.get(id) || []).sort(byLabel).map(makeNode)
  });

  return [...roots.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([label, ids]) => ({ label, children: ids.sort(byLabel).map(makeNode) }));
}

module.exports = { buildPreviewTree };
