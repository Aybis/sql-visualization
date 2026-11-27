/**
 * Crisp Vector SVG ERD Renderer
 * Renders Entity-Relationship Diagrams with Crow's Foot (IE) notation,
 * exact column-level port routing (orthogonal rounded or cubic Bezier),
 * self-referencing loops, schema accent colors, and highlight/dim states.
 * Works identically in browser DOM and standalone offline SVG exports / CLI.
 */

import { CARD_METRICS, getColumnPortOffsetY, shortenType } from '../layout/erdLayout.js';

export const THEMES = {
  dark: {
    canvasBg: '#0c111b',
    dotColor: '#1d273b',
    cardBg: '#131b2b',
    cardBgHover: '#172135',
    cardBorder: '#26344f',
    cardBorderSelected: '#60a5fa',
    cardBorderExternal: '#64748b',
    headerText: '#f8fafc',
    schemaTagBg: 'rgba(15, 23, 42, 0.42)',
    schemaTagText: '#cbd5e1',
    rowHover: '#1a253b',
    rowDivider: '#1d2940',
    colText: '#e2e8f0',
    colTextMuted: '#94a3b8',
    typeText: '#7dd3fc',
    pkBg: 'rgba(245, 158, 11, 0.16)',
    pkText: '#fbbf24',
    fkBg: 'rgba(59, 130, 246, 0.18)',
    fkText: '#60a5fa',
    ukBg: 'rgba(168, 85, 247, 0.18)',
    ukText: '#c084fc',
    edgeColor: '#5b7296',
    edgeInferred: '#d97706',
    edgeHighlight: '#38bdf8',
    edgeSelected: '#f59e0b',
    labelBg: '#0f172a',
    labelBorder: '#334155',
    labelText: '#e2e8f0',
    shadowColor: 'rgba(0, 0, 0, 0.45)',
    schemaPalette: ['#2563eb', '#0891b2', '#7c3aed', '#059669', '#d97706', '#db2777', '#4f46e5', '#0d9488'],
  },
  light: {
    canvasBg: '#f6f8fc',
    dotColor: '#cbd5e1',
    cardBg: '#ffffff',
    cardBgHover: '#f8fafc',
    cardBorder: '#cbd5e1',
    cardBorderSelected: '#2563eb',
    cardBorderExternal: '#94a3b8',
    headerText: '#ffffff',
    schemaTagBg: 'rgba(255, 255, 255, 0.22)',
    schemaTagText: '#ffffff',
    rowHover: '#f1f5f9',
    rowDivider: '#e2e8f0',
    colText: '#0f172a',
    colTextMuted: '#64748b',
    typeText: '#0369a1',
    pkBg: '#fef3c7',
    pkText: '#b45309',
    fkBg: '#dbeafe',
    fkText: '#1d4ed8',
    ukBg: '#f3e8ff',
    ukText: '#7e22ce',
    edgeColor: '#64748b',
    edgeInferred: '#d97706',
    edgeHighlight: '#2563eb',
    edgeSelected: '#ea580c',
    labelBg: '#ffffff',
    labelBorder: '#cbd5e1',
    labelText: '#334155',
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    schemaPalette: ['#2563eb', '#0e7490', '#6d28d9', '#047857', '#b45309', '#be185d', '#4338ca', '#0f766e'],
  },
};

export function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getHeaderAccent(table, schemaIndexMap, palette) {
  if (table.isExternal) return '#475569';
  if (table.schema && schemaIndexMap.has(table.schema)) {
    return palette[schemaIndexMap.get(table.schema) % palette.length];
  }
  if (table.isJunctionTable) return palette[2 % palette.length];
  return palette[0];
}

/**
 * Generates exact SVG vector path elements for Crow's Foot (Information Engineering) symbols
 * at a port touching a vertical table edge.
 *
 * @param {number} x Port X coordinate right on the table card border
 * @param {number} y Port Y coordinate
 * @param {number} dir Direction OUTWARD from table border: +1 (right edge) or -1 (left edge)
 * @param {'1'|'0..1'|'1..N'|'0..N'} multiplicity
 * @param {string} stroke Color
 * @param {string} fillBg Canvas background color (to fill hollow '0' circle)
 */
function buildCrowsFootMarkup(x, y, dir, multiplicity, stroke, fillBg) {
  const parts = [];
  const sw = 1.6;
  const footLen = 11;
  const footHalfH = 6.2;

  if (multiplicity === '0..N' || multiplicity === '1..N') {
    // Crow's foot splaying from (x + dir*footLen, y) to the table edge x
    const apexX = x + dir * footLen;
    parts.push(
      `<path d="M ${apexX} ${y} L ${x} ${y - footHalfH} M ${apexX} ${y} L ${x} ${y} M ${apexX} ${y} L ${x} ${y + footHalfH}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`
    );
    if (multiplicity === '0..N') {
      // Hollow circle slightly outward from apex
      const cx = x + dir * (footLen + 5.2);
      parts.push(
        `<circle cx="${cx}" cy="${y}" r="3.6" stroke="${stroke}" stroke-width="${sw}" fill="${fillBg}"/>`
      );
    } else {
      // Mandatory bar
      const bx = x + dir * (footLen + 3.5);
      parts.push(
        `<line x1="${bx}" y1="${y - 6}" x2="${bx}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
    }
  } else if (multiplicity === '0..1') {
    // One bar close to edge + hollow circle outward
    const barX = x + dir * 6;
    const cx = x + dir * 14.5;
    parts.push(
      `<line x1="${barX}" y1="${y - 6}" x2="${barX}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
    );
    parts.push(
      `<circle cx="${cx}" cy="${y}" r="3.6" stroke="${stroke}" stroke-width="${sw}" fill="${fillBg}"/>`
    );
  } else {
    // Mandatory One: double perpendicular bar (||)
    const bar1 = x + dir * 6;
    const bar2 = x + dir * 11.5;
    parts.push(
      `<line x1="${bar1}" y1="${y - 6}" x2="${bar1}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
    );
    parts.push(
      `<line x1="${bar2}" y1="${y - 6}" x2="${bar2}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
    );
  }

  return parts.join('');
}

/**
 * Builds an orthogonal polyline with smooth quadratic corner rounding.
 */
function buildRoundedOrthogonalPath(pts, radius = 9) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 0.5 || len2 < 0.5) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const r = Math.min(radius, len1 / 2, len2 / 2);
    const p1x = curr.x - (v1x / len1) * r;
    const p1y = curr.y - (v1y / len1) * r;
    const p2x = curr.x + (v2x / len2) * r;
    const p2y = curr.y + (v2y / len2) * r;

    d += ` L ${p1x.toFixed(1)} ${p1y.toFixed(1)} Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

/**
 * Computes routed edge geometry between source and target table nodes.
 */
export function computeEdgeRoute(rel, srcNode, tgtNode, options = {}, laneIndex = 0) {
  const { detailMode = 'full', edgeStyle = 'orthogonal' } = options;

  const srcY = srcNode.y + getColumnPortOffsetY(srcNode, rel.sourceColumns[0], detailMode);
  const tgtY = tgtNode.y + getColumnPortOffsetY(tgtNode, rel.targetColumns[0], detailMode);

  // Self-referencing loop on the right side of the card
  if (rel.sourceTableId === rel.targetTableId) {
    const x = srcNode.x + srcNode.width;
    const loopW = 36 + laneIndex * 18;
    const y1 = srcY;
    const y2 = Math.abs(tgtY - srcY) < 12 ? srcY - 22 : tgtY;
    const pts = [
      { x, y: y1 },
      { x: x + loopW, y: y1 },
      { x: x + loopW, y: y2 },
      { x, y: y2 },
    ];
    const pathD =
      edgeStyle === 'curved'
        ? `M ${x} ${y1} C ${x + loopW * 1.45} ${y1}, ${x + loopW * 1.45} ${y2}, ${x} ${y2}`
        : buildRoundedOrthogonalPath(pts, 10);
    return {
      pathD,
      srcPort: { x, y: y1, dir: 1 },
      tgtPort: { x, y: y2, dir: 1 },
      labelPos: { x: x + loopW + 6, y: (y1 + y2) / 2 },
    };
  }

  const srcLeft = srcNode.x;
  const srcRight = srcNode.x + srcNode.width;
  const tgtLeft = tgtNode.x;
  const tgtRight = tgtNode.x + tgtNode.width;

  let srcX, srcDir, tgtX, tgtDir;
  const minClearance = 36;

  if (tgtLeft >= srcRight + minClearance) {
    // Target is clearly to the right of source
    srcX = srcRight;
    srcDir = 1;
    tgtX = tgtLeft;
    tgtDir = -1;
  } else if (srcLeft >= tgtRight + minClearance) {
    // Target is clearly to the left of source
    srcX = srcLeft;
    srcDir = -1;
    tgtX = tgtRight;
    tgtDir = 1;
  } else {
    // Horizontally overlapping or tightly adjacent: pick shorter outer side (both right or both left)
    const rightSpan = Math.abs(srcRight - tgtRight);
    const leftSpan = Math.abs(srcLeft - tgtLeft);
    if (rightSpan <= leftSpan) {
      srcX = srcRight;
      srcDir = 1;
      tgtX = tgtRight;
      tgtDir = 1;
    } else {
      srcX = srcLeft;
      srcDir = -1;
      tgtX = tgtLeft;
      tgtDir = -1;
    }
  }

  const stub = 26;
  const laneOffset = ((laneIndex % 5) - 2) * 10;

  let pathD;
  let labelPos;

  if (srcDir !== tgtDir) {
    // Facing sides (Left-Right or Right-Left)
    const midX = (srcX + tgtX) / 2 + laneOffset;
    if (edgeStyle === 'curved') {
      const dx = Math.max(48, Math.abs(tgtX - srcX) * 0.45);
      const cp1x = srcX + srcDir * dx;
      const cp2x = tgtX + tgtDir * dx;
      pathD = `M ${srcX} ${srcY} C ${cp1x.toFixed(1)} ${srcY}, ${cp2x.toFixed(1)} ${tgtY}, ${tgtX} ${tgtY}`;
      labelPos = { x: (srcX + tgtX) / 2, y: (srcY + tgtY) / 2 };
    } else {
      const pts = [
        { x: srcX, y: srcY },
        { x: midX, y: srcY },
        { x: midX, y: tgtY },
        { x: tgtX, y: tgtY },
      ];
      pathD = buildRoundedOrthogonalPath(pts, 10);
      labelPos = { x: midX, y: (srcY + tgtY) / 2 };
    }
  } else {
    // Same-side C-bend (both right or both left)
    const outerX =
      srcDir === 1
        ? Math.max(srcX, tgtX) + stub + 14 + laneIndex * 14
        : Math.min(srcX, tgtX) - stub - 14 - laneIndex * 14;

    if (edgeStyle === 'curved') {
      pathD = `M ${srcX} ${srcY} C ${outerX} ${srcY}, ${outerX} ${tgtY}, ${tgtX} ${tgtY}`;
      labelPos = { x: outerX - srcDir * 10, y: (srcY + tgtY) / 2 };
    } else {
      const pts = [
        { x: srcX, y: srcY },
        { x: outerX, y: srcY },
        { x: outerX, y: tgtY },
        { x: tgtX, y: tgtY },
      ];
      pathD = buildRoundedOrthogonalPath(pts, 10);
      labelPos = { x: outerX, y: (srcY + tgtY) / 2 };
    }
  }

  return {
    pathD,
    srcPort: { x: srcX, y: srcY, dir: srcDir },
    tgtPort: { x: tgtX, y: tgtY, dir: tgtDir },
    labelPos,
  };
}

/**
 * Renders the complete ERD diagram as SVG inner markup (edges + nodes) or standalone SVG document.
 */
export function renderErdSvg(schema, layout, options = {}) {
  const {
    theme: themeName = 'dark',
    detailMode = 'full',
    showTypes = true,
    showNullability = true,
    showEdgeLabels = false,
    edgeStyle = 'orthogonal',
    selectedTableId = null,
    hoveredTableId = null,
    selectedRelationId = null,
    hoveredRelationId = null,
    standalone = false,
    includeGrid = false,
  } = options;

  const theme = THEMES[themeName] || THEMES.dark;
  const { nodes, bounds } = layout;

  const schemaIndexMap = new Map();
  schema.schemas.forEach((s, i) => schemaIndexMap.set(s, i));

  // Determine active highlight focus set (table + direct neighbors + incident edges)
  const activeTableId = hoveredTableId || selectedTableId;
  const activeRelId = hoveredRelationId || selectedRelationId;
  const highlightedTables = new Set();
  const highlightedRelations = new Set();

  const visibleRelations = schema.relations.filter(
    (r) => nodes.has(r.sourceTableId) && nodes.has(r.targetTableId)
  );

  if (activeTableId && nodes.has(activeTableId)) {
    highlightedTables.add(activeTableId);
    for (const r of visibleRelations) {
      if (r.sourceTableId === activeTableId || r.targetTableId === activeTableId) {
        highlightedRelations.add(r.id);
        highlightedTables.add(r.sourceTableId);
        highlightedTables.add(r.targetTableId);
      }
    }
  } else if (activeRelId) {
    const rel = visibleRelations.find((r) => r.id === activeRelId);
    if (rel) {
      highlightedRelations.add(rel.id);
      highlightedTables.add(rel.sourceTableId);
      highlightedTables.add(rel.targetTableId);
    }
  }

  const hasHighlight = highlightedTables.size > 0;

  // Group relations by table pair to compute lane staggering cleanly
  const pairCounts = new Map();
  const edgesBack = [];
  const edgesFront = [];

  for (const rel of visibleRelations) {
    const srcNode = nodes.get(rel.sourceTableId);
    const tgtNode = nodes.get(rel.targetTableId);
    const pairKey = [rel.sourceTableId, rel.targetTableId].sort().join('::');
    const laneIdx = pairCounts.get(pairKey) || 0;
    pairCounts.set(pairKey, laneIdx + 1);

    const route = computeEdgeRoute(rel, srcNode, tgtNode, { detailMode, edgeStyle }, laneIdx);
    const isSelected = rel.id === selectedRelationId;
    const isHighlighted = highlightedRelations.has(rel.id);
    const isDimmed = hasHighlight && !isHighlighted;

    let stroke = rel.inferred ? theme.edgeInferred : theme.edgeColor;
    if (isSelected) stroke = theme.edgeSelected;
    else if (isHighlighted) stroke = theme.edgeHighlight;

    const strokeWidth = isSelected ? 2.6 : isHighlighted ? 2.2 : 1.5;
    const dashAttr = rel.inferred ? 'stroke-dasharray="6 4"' : '';
    const opacity = isDimmed ? 0.16 : 1;

    const srcFoot = buildCrowsFootMarkup(
      route.srcPort.x,
      route.srcPort.y,
      route.srcPort.dir,
      rel.sourceEnd,
      stroke,
      theme.canvasBg
    );
    const tgtFoot = buildCrowsFootMarkup(
      route.tgtPort.x,
      route.tgtPort.y,
      route.tgtPort.dir,
      rel.targetEnd,
      stroke,
      theme.canvasBg
    );

    let labelMarkup = '';
    if (showEdgeLabels || isSelected || isHighlighted) {
      const cardText = rel.cardinality === '1:1' ? '1:1' : 'N:1';
      const labelStr = rel.inferred ? `${cardText} ~` : cardText;
      const w = labelStr.length * 6.8 + 14;
      labelMarkup = `
        <g class="erd-edge-label" transform="translate(${route.labelPos.x.toFixed(1)}, ${route.labelPos.y.toFixed(1)})">
          <rect x="${(-w / 2).toFixed(1)}" y="-10" width="${w.toFixed(1)}" height="20" rx="6" fill="${theme.labelBg}" stroke="${isHighlighted || isSelected ? stroke : theme.labelBorder}" stroke-width="1"/>
          <text x="0" y="3.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="${isHighlighted || isSelected ? stroke : theme.labelText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(labelStr)}</text>
        </g>`;
    }

    const edgeGroup = `
      <g class="erd-edge${isHighlighted ? ' is-highlighted' : ''}${isSelected ? ' is-selected' : ''}" data-relation-id="${escapeXml(rel.id)}" style="opacity:${opacity}">
        <path class="erd-edge-hit" d="${route.pathD}" fill="none" stroke="transparent" stroke-width="14" stroke-linecap="round"/>
        <path class="erd-edge-line" d="${route.pathD}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} stroke-linecap="round" stroke-linejoin="round"/>
        ${srcFoot}
        ${tgtFoot}
        ${labelMarkup}
      </g>`;

    if (isHighlighted || isSelected) {
      edgesFront.push(edgeGroup);
    } else {
      edgesBack.push(edgeGroup);
    }
  }

  // Render Table Cards
  const tableCards = [];
  for (const node of nodes.values()) {
    const t = node.table;
    const isSelected = t.id === selectedTableId;
    const isHighlighted = highlightedTables.has(t.id);
    const isDimmed = hasHighlight && !isHighlighted;
    const opacity = isDimmed ? 0.28 : 1;

    const accent = getHeaderAccent(t, schemaIndexMap, theme.schemaPalette);
    const borderColor = isSelected
      ? theme.cardBorderSelected
      : isHighlighted
        ? theme.edgeHighlight
        : t.isExternal
          ? theme.cardBorderExternal
          : theme.cardBorder;
    const borderWidth = isSelected || isHighlighted ? 2 : 1.2;
    const borderDash = t.isExternal ? 'stroke-dasharray="5 3"' : '';
    const clipId = `clip_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Header content
    const headerTitle = t.name.length > 28 ? t.name.slice(0, 26) + '…' : t.name;
    const badgeTag = t.isExternal
      ? 'EXT'
      : t.schema
        ? t.schema.length > 10
          ? t.schema.slice(0, 9) + '…'
          : t.schema
        : t.isJunctionTable
          ? 'M:N'
          : null;

    let badgeMarkup = '';
    if (badgeTag) {
      const bw = badgeTag.length * 6.2 + 12;
      badgeMarkup = `
        <rect x="${node.width - bw - 10}" y="10" width="${bw}" height="18" rx="5" fill="${theme.schemaTagBg}"/>
        <text x="${node.width - bw / 2 - 10}" y="22.5" text-anchor="middle" font-size="10" font-weight="600" fill="${theme.schemaTagText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(badgeTag)}</text>`;
    }

    // Column rows
    const rowsMarkup = [];
    if (detailMode === 'compact') {
      const pkCount = t.primaryKeys.length;
      const fkCount = t.columns.filter((c) => c.isForeignKey).length;
      const summary = `${t.columns.length} cols${pkCount ? ` · ${pkCount} PK` : ''}${fkCount ? ` · ${fkCount} FK` : ''}`;
      rowsMarkup.push(
        `<text x="12" y="${CARD_METRICS.HEADER_HEIGHT + 9}" font-size="11" fill="${theme.colTextMuted}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(summary)}</text>`
      );
    } else {
      node.visibleColumns.forEach((col, idx) => {
        const rowY = CARD_METRICS.HEADER_HEIGHT + idx * CARD_METRICS.ROW_HEIGHT;
        const textY = rowY + 17;

        if (idx > 0) {
          rowsMarkup.push(
            `<line x1="0" y1="${rowY}" x2="${node.width}" y2="${rowY}" stroke="${theme.rowDivider}" stroke-width="1"/>`
          );
        }

        // Key Badges (PK, FK, UK)
        let cursorX = 10;
        let badgesSvg = '';

        if (col.isPrimaryKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="21" height="16" rx="4" fill="${theme.pkBg}"/><text x="${cursorX + 10.5}" y="${rowY + 16.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${theme.pkText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">PK</text>`;
          cursorX += 24;
        }
        if (col.isForeignKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="21" height="16" rx="4" fill="${theme.fkBg}"/><text x="${cursorX + 10.5}" y="${rowY + 16.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${theme.fkText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">FK</text>`;
          cursorX += 24;
        }
        if (col.isUnique && !col.isPrimaryKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="21" height="16" rx="4" fill="${theme.ukBg}"/><text x="${cursorX + 10.5}" y="${rowY + 16.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${theme.ukText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">UK</text>`;
          cursorX += 24;
        }
        if (!col.isPrimaryKey && !col.isForeignKey && !col.isUnique) {
          // Subtle dot for regular column
          badgesSvg += `<circle cx="${cursorX + 5}" cy="${rowY + 13}" r="2.3" fill="${col.nullable ? theme.colTextMuted : theme.typeText}" opacity="0.55"/>`;
          cursorX += 14;
        }

        const nullMark = showNullability && col.nullable ? '?' : '';
        const colLabel = `${col.name}${nullMark}`;
        const maxColChars = Math.max(10, Math.floor((node.width - cursorX - (showTypes ? 95 : 16)) / 7.1));
        const dispCol = colLabel.length > maxColChars ? colLabel.slice(0, maxColChars - 1) + '…' : colLabel;

        const typeLabel = showTypes ? shortenType(col.type) : '';
        const fontWeight = col.isPrimaryKey ? '600' : '400';

        rowsMarkup.push(`
          <g class="erd-col-row" data-col-name="${escapeXml(col.name)}">
            ${badgesSvg}
            <text x="${cursorX + 2}" y="${textY}" font-size="12" font-weight="${fontWeight}" fill="${col.isPrimaryKey || col.isForeignKey ? theme.colText : theme.colText}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(dispCol)}</text>
            ${
              showTypes && typeLabel
                ? `<text x="${node.width - 10}" y="${textY}" text-anchor="end" font-size="10.8" fill="${theme.typeText}" opacity="0.88" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(typeLabel)}</text>`
                : ''
            }
          </g>`);
      });

      if (detailMode === 'keys' && node.visibleColumns.length < t.columns.length) {
        const hidden = t.columns.length - node.visibleColumns.length;
        const fy = CARD_METRICS.HEADER_HEIGHT + node.visibleColumns.length * CARD_METRICS.ROW_HEIGHT + 15;
        rowsMarkup.push(
          `<text x="${node.width / 2}" y="${fy}" text-anchor="middle" font-size="10.5" fill="${theme.colTextMuted}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">+ ${hidden} more column${hidden > 1 ? 's' : ''}</text>`
        );
      }
    }

    tableCards.push(`
      <g class="erd-table${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}" data-table-id="${escapeXml(t.id)}" transform="translate(${node.x}, ${node.y})" style="opacity:${opacity}">
        <defs>
          <clipPath id="${clipId}">
            <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="9" ry="9"/>
          </clipPath>
        </defs>
        <rect x="0" y="2" width="${node.width}" height="${node.height}" rx="9" ry="9" fill="${theme.shadowColor}"/>
        <g clip-path="url(#${clipId})">
          <rect x="0" y="0" width="${node.width}" height="${node.height}" fill="${theme.cardBg}"/>
          <rect class="erd-table-header" x="0" y="0" width="${node.width}" height="${CARD_METRICS.HEADER_HEIGHT}" fill="${accent}"/>
          <text x="12" y="24" font-size="13" font-weight="700" fill="${theme.headerText}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(headerTitle)}</text>
          ${badgeMarkup}
          ${rowsMarkup.join('')}
        </g>
        <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="9" ry="9" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" ${borderDash}/>
      </g>`);
  }

  const innerContent = `
    <g class="erd-edges-back">${edgesBack.join('')}</g>
    <g class="erd-edges-front">${edgesFront.join('')}</g>
    <g class="erd-tables">${tableCards.join('')}</g>
  `;

  if (!standalone) {
    return innerContent;
  }

  const gridDef = includeGrid
    ? `<defs>
        <pattern id="erd-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="${theme.dotColor}"/>
        </pattern>
      </defs>
      <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${theme.canvasBg}"/>
      <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="url(#erd-dot-grid)"/>`
    : `<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${theme.canvasBg}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}" viewBox="${Math.floor(bounds.minX)} ${Math.floor(bounds.minY)} ${Math.ceil(bounds.width)} ${Math.ceil(bounds.height)}">
  <title>SQL to ERD Diagram</title>
  ${gridDef}
  ${innerContent}
</svg>`;
}
