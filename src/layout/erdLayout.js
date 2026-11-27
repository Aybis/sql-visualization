/**
 * ERD Graph Layout Engine
 * Computes exact table card geometry, column port positions, and clean non-overlapping
 * layouts (Hierarchical Relationship Flow, Force-Directed Clustered, and Schema/Alpha Grid).
 */

export const CARD_METRICS = Object.freeze({
  HEADER_HEIGHT: 38,
  ROW_HEIGHT: 26,
  FOOTER_HEIGHT: 10,
  COMPACT_HEIGHT: 52,
  MIN_WIDTH: 224,
  MAX_WIDTH: 360,
  PADDING_X: 28,
});

/**
 * Returns the columns visible on a table card under the current detail mode.
 */
export function getVisibleColumns(table, detailMode = 'full') {
  if (detailMode === 'compact') return [];
  if (detailMode === 'keys') {
    const keyCols = table.columns.filter((c) => c.isPrimaryKey || c.isForeignKey || c.isUnique);
    return keyCols.length > 0 ? keyCols : table.columns.slice(0, 3);
  }
  return table.columns;
}

/**
 * Computes exact pixel width and height of a table card.
 */
export function measureTableCard(table, options = {}) {
  const { detailMode = 'full', showTypes = true } = options;
  const visibleColumns = getVisibleColumns(table, detailMode);

  // Estimate character width cleanly using monospace/sans metrics
  const titleLen = (table.schema ? `${table.schema}.${table.name}` : table.name).length;
  let maxWidth = Math.max(CARD_METRICS.MIN_WIDTH, titleLen * 8.4 + 78);

  if (detailMode !== 'compact') {
    for (const col of visibleColumns) {
      const namePx = col.name.length * 7.4;
      const typeStr = showTypes ? shortenType(col.type) : '';
      const typePx = typeStr.length * 6.5;
      const badgePx = (col.isPrimaryKey ? 24 : 0) + (col.isForeignKey ? 24 : 0) + (col.isUnique && !col.isPrimaryKey ? 22 : 0) + 18;
      const rowWidth = CARD_METRICS.PADDING_X + badgePx + namePx + (showTypes ? typePx + 22 : 8);
      if (rowWidth > maxWidth) maxWidth = rowWidth;
    }
  }

  const width = Math.min(CARD_METRICS.MAX_WIDTH, Math.ceil(maxWidth));

  let height;
  if (detailMode === 'compact') {
    height = CARD_METRICS.COMPACT_HEIGHT;
  } else {
    const rowCount = Math.max(1, visibleColumns.length);
    const hasHiddenCount = detailMode === 'keys' && visibleColumns.length < table.columns.length;
    height =
      CARD_METRICS.HEADER_HEIGHT +
      rowCount * CARD_METRICS.ROW_HEIGHT +
      (hasHiddenCount ? 22 : CARD_METRICS.FOOTER_HEIGHT);
  }

  return { width, height, visibleColumns };
}

/**
 * Truncates excessively verbose column types (e.g. long ENUMs) for crisp card display.
 */
export function shortenType(typeStr) {
  if (!typeStr) return '';
  let s = typeStr
    .replace(/CHARACTER VARYING/i, 'VARCHAR')
    .replace(/TIMESTAMP WITHOUT TIME ZONE/i, 'TIMESTAMP')
    .replace(/TIMESTAMP WITH TIME ZONE/i, 'TIMESTAMPTZ')
    .replace(/TIME WITHOUT TIME ZONE/i, 'TIME')
    .replace(/DOUBLE PRECISION/i, 'DOUBLE');
  if (s.length > 22) {
    const paren = s.indexOf('(');
    if (paren > 0 && s.toUpperCase().startsWith('ENUM')) {
      return 'ENUM(...)';
    }
    return s.slice(0, 20) + '…';
  }
  return s;
}

/**
 * Computes the vertical Y offset (relative to card top) of a column's connection port.
 */
export function getColumnPortOffsetY(cardInfo, columnName, detailMode = 'full') {
  if (detailMode === 'compact' || !cardInfo.visibleColumns || cardInfo.visibleColumns.length === 0) {
    return CARD_METRICS.HEADER_HEIGHT / 2;
  }
  const lower = (columnName || '').toLowerCase();
  const idx = cardInfo.visibleColumns.findIndex((c) => c.name.toLowerCase() === lower);
  if (idx === -1) {
    return CARD_METRICS.HEADER_HEIGHT / 2;
  }
  return CARD_METRICS.HEADER_HEIGHT + idx * CARD_METRICS.ROW_HEIGHT + CARD_METRICS.ROW_HEIGHT / 2;
}

/**
 * Splits table IDs into connected components using undirected adjacency.
 */
function findConnectedComponents(tables, relations) {
  const adj = new Map();
  for (const t of tables) adj.set(t.id, new Set());
  for (const r of relations) {
    if (r.sourceTableId === r.targetTableId) continue;
    if (adj.has(r.sourceTableId) && adj.has(r.targetTableId)) {
      adj.get(r.sourceTableId).add(r.targetTableId);
      adj.get(r.targetTableId).add(r.sourceTableId);
    }
  }

  const visited = new Set();
  const components = [];

  for (const t of tables) {
    if (visited.has(t.id)) continue;
    const comp = [];
    const queue = [t.id];
    visited.add(t.id);
    while (queue.length > 0) {
      const cur = queue.shift();
      comp.push(cur);
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    components.push(comp);
  }

  // Sort components: largest connected graphs first, single isolated tables grouped at end alphabetically
  components.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a[0].localeCompare(b[0]);
  });

  return components;
}

/**
 * Computes hierarchical (Sugiyama-inspired) positions for a single connected component.
 * Direction: Left-to-Right from referenced Parent tables (rank 0) to Child tables (rank 1..k).
 */
function layoutComponentHierarchical(compIds, rels, cardMap, gapX = 120, gapY = 42) {
  const idSet = new Set(compIds);
  // Directed edges: parent (target) -> child (source) so parents sit left and children flow right
  const children = new Map();
  const parents = new Map();
  const inDegree = new Map();
  for (const id of compIds) {
    children.set(id, new Set());
    parents.set(id, new Set());
    inDegree.set(id, 0);
  }

  for (const r of rels) {
    if (r.sourceTableId === r.targetTableId) continue;
    if (!idSet.has(r.sourceTableId) || !idSet.has(r.targetTableId)) continue;
    const parentId = r.targetTableId;
    const childId = r.sourceTableId;
    if (!children.get(parentId).has(childId)) {
      children.get(parentId).add(childId);
      parents.get(childId).add(parentId);
      inDegree.set(childId, inDegree.get(childId) + 1);
    }
  }

  // Assign ranks via topological Kahn-like longest path with safe cycle breaking
  const rank = new Map();
  const queue = [];
  const tempIn = new Map(inDegree);

  for (const id of compIds) {
    if (tempIn.get(id) === 0) {
      rank.set(id, 0);
      queue.push(id);
    }
  }

  // If pure cycle with no zero-indegree root, pick node with highest out-degree
  if (queue.length === 0 && compIds.length > 0) {
    const best = [...compIds].sort((a, b) => children.get(b).size - children.get(a).size)[0];
    rank.set(best, 0);
    queue.push(best);
  }

  const processed = new Set();
  while (processed.size < compIds.length) {
    while (queue.length > 0) {
      const u = queue.shift();
      if (processed.has(u)) continue;
      processed.add(u);
      const uRank = rank.get(u) ?? 0;
      for (const v of children.get(u)) {
        const nextR = uRank + 1;
        if (!processed.has(v)) {
          rank.set(v, Math.max(rank.get(v) ?? 0, nextR));
          tempIn.set(v, Math.max(0, tempIn.get(v) - 1));
          if (tempIn.get(v) === 0) queue.push(v);
        }
      }
    }
    // Break remaining cycles if any nodes left unprocessed
    if (processed.size < compIds.length) {
      const remaining = compIds.filter((id) => !processed.has(id));
      remaining.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || children.get(b).size - children.get(a).size);
      const nextSeed = remaining[0];
      if (!rank.has(nextSeed)) rank.set(nextSeed, 0);
      queue.push(nextSeed);
    }
  }

  // Group into layers
  const maxRank = Math.max(0, ...rank.values());
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of compIds) {
    layers[rank.get(id) ?? 0].push(id);
  }

  // Initial deterministic sort within each layer by degree descending
  for (const layer of layers) {
    layer.sort((a, b) => {
      const degA = children.get(a).size + parents.get(a).size;
      const degB = children.get(b).size + parents.get(b).size;
      return degB - degA || a.localeCompare(b);
    });
  }

  // Barycenter crossing reduction sweeps (6 forward/backward passes)
  for (let pass = 0; pass < 6; pass++) {
    // Forward sweep: order layer L by average position of parents in earlier layers
    for (let l = 1; l < layers.length; l++) {
      const prevOrder = new Map();
      for (let p = 0; p < l; p++) {
        layers[p].forEach((id, idx) => prevOrder.set(id, idx));
      }
      layers[l].sort((a, b) => {
        const scoreA = averageNeighborIndex(parents.get(a), prevOrder);
        const scoreB = averageNeighborIndex(parents.get(b), prevOrder);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.localeCompare(b);
      });
    }
    // Backward sweep: order layer L by average position of children in later layers
    for (let l = layers.length - 2; l >= 0; l--) {
      const nextOrder = new Map();
      for (let p = l + 1; p < layers.length; p++) {
        layers[p].forEach((id, idx) => nextOrder.set(id, idx));
      }
      layers[l].sort((a, b) => {
        const scoreA = averageNeighborIndex(children.get(a), nextOrder);
        const scoreB = averageNeighborIndex(children.get(b), nextOrder);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.localeCompare(b);
      });
    }
  }

  // Compute coordinates per layer
  const positions = new Map();
  const layerWidths = layers.map((layer) =>
    Math.max(0, ...layer.map((id) => cardMap.get(id).width))
  );
  const layerHeights = layers.map((layer) =>
    layer.reduce((acc, id, idx) => acc + cardMap.get(id).height + (idx > 0 ? gapY : 0), 0)
  );
  const totalHeight = Math.max(0, ...layerHeights);

  let curX = 0;
  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    if (layer.length === 0) continue;
    let curY = Math.round((totalHeight - layerHeights[l]) / 2);
    for (const id of layer) {
      const card = cardMap.get(id);
      positions.set(id, { x: curX, y: curY });
      curY += card.height + gapY;
    }
    curX += layerWidths[l] + gapX;
  }

  const width = Math.max(0, curX - gapX);
  return { positions, width, height: totalHeight };
}

function averageNeighborIndex(neighborSet, indexMap) {
  let sum = 0;
  let count = 0;
  for (const nb of neighborSet) {
    if (indexMap.has(nb)) {
      sum += indexMap.get(nb);
      count++;
    }
  }
  return count > 0 ? sum / count : Number.MAX_SAFE_INTEGER / 2;
}

/**
 * Force-directed clustered layout with deterministic initial spiral + box-overlap removal.
 */
function layoutForceDirected(tables, relations, cardMap) {
  const n = tables.length;
  const pos = new Map();
  const vel = new Map();

  // Deterministic golden-angle spiral start
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  tables.forEach((t, idx) => {
    const r = 180 * Math.sqrt(idx + 1);
    const theta = idx * goldenAngle;
    pos.set(t.id, { x: Math.cos(theta) * r, y: Math.sin(theta) * r });
    vel.set(t.id, { vx: 0, vy: 0 });
  });

  const edges = relations.filter(
    (r) => r.sourceTableId !== r.targetTableId && pos.has(r.sourceTableId) && pos.has(r.targetTableId)
  );

  const iterations = Math.min(180, Math.max(60, n * 6));
  const pad = 64;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Pairwise box repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = tables[i].id;
        const b = tables[j].id;
        const pa = pos.get(a);
        const pb = pos.get(b);
        const ca = cardMap.get(a);
        const cb = cardMap.get(b);

        const cxA = pa.x + ca.width / 2;
        const cyA = pa.y + ca.height / 2;
        const cxB = pb.x + cb.width / 2;
        const cyB = pb.y + cb.height / 2;

        let dx = cxB - cxA;
        let dy = cyB - cyA;
        const dist = Math.hypot(dx, dy) || 1;
        const minDistX = (ca.width + cb.width) / 2 + pad;
        const minDistY = (ca.height + cb.height) / 2 + pad;

        // Long-range mild repulsion + strong overlap separation
        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          const push = 0.45;
          if (overlapX < overlapY) {
            const sign = dx >= 0 ? 1 : -1;
            vel.get(a).vx -= sign * overlapX * push;
            vel.get(b).vx += sign * overlapX * push;
          } else {
            const sign = dy >= 0 ? 1 : -1;
            vel.get(a).vy -= sign * overlapY * push;
            vel.get(b).vy += sign * overlapY * push;
          }
        } else if (dist < 700) {
          const repulse = (18000 / (dist * dist)) * cooling;
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          vel.get(a).vx -= fx;
          vel.get(a).vy -= fy;
          vel.get(b).vx += fx;
          vel.get(b).vy += fy;
        }
      }
    }

    // Spring attraction along foreign keys
    for (const r of edges) {
      const pa = pos.get(r.sourceTableId);
      const pb = pos.get(r.targetTableId);
      const ca = cardMap.get(r.sourceTableId);
      const cb = cardMap.get(r.targetTableId);

      const dx = pb.x + cb.width / 2 - (pa.x + ca.width / 2);
      const dy = pb.y + cb.height / 2 - (pa.y + ca.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const ideal = Math.max(ca.width, cb.width) + 120;
      const force = ((dist - ideal) * 0.045) * (0.35 + 0.65 * cooling);

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      vel.get(r.sourceTableId).vx += fx;
      vel.get(r.sourceTableId).vy += fy;
      vel.get(r.targetTableId).vx -= fx;
      vel.get(r.targetTableId).vy -= fy;
    }

    // Mild gravity toward origin to prevent drift
    for (const t of tables) {
      const p = pos.get(t.id);
      const v = vel.get(t.id);
      v.vx -= p.x * 0.004;
      v.vy -= p.y * 0.004;

      p.x += Math.max(-45, Math.min(45, v.vx));
      p.y += Math.max(-45, Math.min(45, v.vy));
      v.vx *= 0.65;
      v.vy *= 0.65;
    }
  }

  // Final deterministic overlap-removal pass
  removeOverlaps(tables, pos, cardMap, 56, 44);
  return pos;
}

/**
 * Guarantees zero overlapping bounding boxes with clean padding.
 */
function removeOverlaps(tables, pos, cardMap, padX = 56, padY = 44) {
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = tables[i].id;
        const b = tables[j].id;
        const pa = pos.get(a);
        const pb = pos.get(b);
        const ca = cardMap.get(a);
        const cb = cardMap.get(b);

        const cxA = pa.x + ca.width / 2;
        const cyA = pa.y + ca.height / 2;
        const cxB = pb.x + cb.width / 2;
        const cyB = pb.y + cb.height / 2;

        const dx = cxB - cxA;
        const dy = cyB - cyA;
        const overlapX = (ca.width + cb.width) / 2 + padX - Math.abs(dx);
        const overlapY = (ca.height + cb.height) / 2 + padY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          if (overlapX <= overlapY) {
            const shift = overlapX / 2 + 1;
            const sign = dx >= 0 ? 1 : -1;
            pa.x -= sign * shift;
            pb.x += sign * shift;
          } else {
            const shift = overlapY / 2 + 1;
            const sign = dy >= 0 ? 1 : -1;
            pa.y -= sign * shift;
            pb.y += sign * shift;
          }
        }
      }
    }
    if (!moved) break;
  }
}

/**
 * Clean Schema / Alphabetical Grid Layout
 */
function layoutGrid(tables, cardMap, gapX = 72, gapY = 44) {
  const sorted = [...tables].sort((a, b) => {
    const sa = (a.schema || '').localeCompare(b.schema || '');
    if (sa !== 0) return sa;
    return a.name.localeCompare(b.name);
  });

  const cols = Math.max(1, Math.min(5, Math.ceil(Math.sqrt(sorted.length * 1.15))));
  const colWidths = Array(cols).fill(0);
  const colHeights = Array(cols).fill(0);
  const assignments = Array.from({ length: cols }, () => []);

  // Balanced masonry column assignment (or row-major grouped by schema)
  const hasMultipleSchemas = new Set(sorted.map((t) => t.schema || '')).size > 1;

  if (hasMultipleSchemas) {
    sorted.forEach((t, idx) => {
      const c = idx % cols;
      assignments[c].push(t);
      colWidths[c] = Math.max(colWidths[c], cardMap.get(t.id).width);
    });
  } else {
    for (const t of sorted) {
      // Put in shortest column for balanced visual silhouette
      let bestCol = 0;
      for (let c = 1; c < cols; c++) {
        if (colHeights[c] < colHeights[bestCol]) bestCol = c;
      }
      assignments[bestCol].push(t);
      const card = cardMap.get(t.id);
      colWidths[bestCol] = Math.max(colWidths[bestCol], card.width);
      colHeights[bestCol] += card.height + gapY;
    }
  }

  const pos = new Map();
  let curX = 0;
  for (let c = 0; c < cols; c++) {
    let curY = 0;
    for (const t of assignments[c]) {
      const card = cardMap.get(t.id);
      pos.set(t.id, { x: curX, y: curY });
      curY += card.height + gapY;
    }
    curX += colWidths[c] + gapX;
  }
  return pos;
}

/**
 * Main Layout Computation
 *
 * @param {object} schema Parsed schema from parseSqlToSchema
 * @param {object} [options]
 * @param {'hierarchical'|'clustered'|'grid'} [options.algorithm='hierarchical']
 * @param {'full'|'keys'|'compact'} [options.detailMode='full']
 * @param {boolean} [options.showTypes=true]
 * @param {Set<string>} [options.visibleTableIds] Optional subset of tables to lay out
 * @param {Map<string, {x:number, y:number}>} [options.pinnedPositions] Optional user-dragged overrides
 */
export function computeErdLayout(schema, options = {}) {
  const {
    algorithm = 'hierarchical',
    detailMode = 'full',
    showTypes = true,
    visibleTableIds = null,
    pinnedPositions = null,
  } = options;

  const tables = visibleTableIds
    ? schema.tables.filter((t) => visibleTableIds.has(t.id))
    : schema.tables;

  const tableIdSet = new Set(tables.map((t) => t.id));
  const relations = schema.relations.filter(
    (r) => tableIdSet.has(r.sourceTableId) && tableIdSet.has(r.targetTableId)
  );

  const cardMap = new Map();
  for (const t of tables) {
    cardMap.set(t.id, measureTableCard(t, { detailMode, showTypes }));
  }

  let rawPositions = new Map();

  if (tables.length === 0) {
    return {
      nodes: new Map(),
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 },
    };
  }

  if (algorithm === 'grid') {
    rawPositions = layoutGrid(tables, cardMap);
  } else if (algorithm === 'clustered') {
    rawPositions = layoutForceDirected(tables, relations, cardMap);
  } else {
    // Hierarchical (default): pack connected components nicely
    const components = findConnectedComponents(tables, relations);
    const connectedComps = components.filter((c) => c.length > 1);
    const isolatedIds = components.filter((c) => c.length === 1).map((c) => c[0]);

    let curY = 0;
    const compGapY = 92;

    for (const comp of connectedComps) {
      const { positions, height } = layoutComponentHierarchical(comp, relations, cardMap);
      for (const [id, p] of positions) {
        rawPositions.set(id, { x: p.x, y: p.y + curY });
      }
      curY += height + compGapY;
    }

    // Place isolated tables in a neat compact grid row below connected components
    if (isolatedIds.length > 0) {
      const isoTables = isolatedIds.map((id) => tables.find((t) => t.id === id)).filter(Boolean);
      const isoPos = layoutGrid(isoTables, cardMap, 60, 36);
      for (const [id, p] of isoPos) {
        rawPositions.set(id, { x: p.x, y: p.y + curY });
      }
    }
  }

  // Normalize coordinates so minX = 60, minY = 60 (unless pinned)
  let minX = Infinity;
  let minY = Infinity;
  for (const p of rawPositions.values()) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  }
  const shiftX = Number.isFinite(minX) ? 60 - minX : 0;
  const shiftY = Number.isFinite(minY) ? 60 - minY : 0;

  const nodes = new Map();
  let bMinX = Infinity;
  let bMinY = Infinity;
  let bMaxX = -Infinity;
  let bMaxY = -Infinity;

  for (const t of tables) {
    const base = rawPositions.get(t.id) || { x: 60, y: 60 };
    const pinned = pinnedPositions?.get(t.id);
    const x = Math.round(pinned ? pinned.x : base.x + shiftX);
    const y = Math.round(pinned ? pinned.y : base.y + shiftY);
    const card = cardMap.get(t.id);

    nodes.set(t.id, {
      id: t.id,
      table: t,
      x,
      y,
      width: card.width,
      height: card.height,
      visibleColumns: card.visibleColumns,
    });

    if (x < bMinX) bMinX = x;
    if (y < bMinY) bMinY = y;
    if (x + card.width > bMaxX) bMaxX = x + card.width;
    if (y + card.height > bMaxY) bMaxY = y + card.height;
  }

  const padding = 80;
  const bounds = {
    minX: bMinX - padding,
    minY: bMinY - padding,
    maxX: bMaxX + padding,
    maxY: bMaxY + padding,
    width: Math.max(400, bMaxX - bMinX + padding * 2),
    height: Math.max(300, bMaxY - bMinY + padding * 2),
  };

  return { nodes, bounds };
}
