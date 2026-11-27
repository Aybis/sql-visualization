/**
 * Minimalist Black & White Vector SVG ERD Renderer (Airbnb-inspired aesthetic)
 * Crisp monochrome table cards with soft elevation, rounded corners (rx=14),
 * high-contrast PK/FK/UK badges, Crow's Foot (IE) notation, and subtle animated
 * directional flow on active relationships.
 */

import { CARD_METRICS, getColumnPortOffsetY, shortenType } from '../layout/erdLayout.js';

export const THEMES = {
  light: {
    canvasBg: '#fafafa',
    dotColor: '#d9d9d9',
    cardBg: '#ffffff',
    cardBgHover: '#fcfcfc',
    cardBorder: '#e5e5e5',
    cardBorderSelected: '#111111',
    cardBorderExternal: '#a3a3a3',
    headerText: '#ffffff',
    schemaTagBg: 'rgba(255, 255, 255, 0.18)',
    schemaTagText: '#ffffff',
    rowHover: '#f7f7f7',
    rowDivider: '#f0f0f0',
    colText: '#111111',
    colTextMuted: '#717171',
    typeText: '#717171',
    pkBg: '#111111',
    pkText: '#ffffff',
    fkBg: '#f0f0f0',
    fkText: '#111111',
    ukBg: '#f5f5f5',
    ukText: '#525252',
    edgeColor: '#a3a3a3',
    edgeInferred: '#737373',
    edgeHighlight: '#111111',
    edgeSelected: '#000000',
    labelBg: '#ffffff',
    labelBorder: '#d4d4d4',
    labelText: '#111111',
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    // Subtle monochrome grayscale steps per schema
    schemaPalette: ['#111111', '#262626', '#3f3f46', '#52525b', '#171717', '#404040', '#27272a', '#525252'],
  },
  dark: {
    canvasBg: '#09090b',
    dotColor: '#222227',
    cardBg: '#121215',
    cardBgHover: '#18181c',
    cardBorder: '#27272d',
    cardBorderSelected: '#fafafa',
    cardBorderExternal: '#52525b',
    headerText: '#fafafa',
    schemaTagBg: 'rgba(255, 255, 255, 0.12)',
    schemaTagText: '#e4e4e7',
    rowHover: '#1b1b20',
    rowDivider: '#1e1e24',
    colText: '#f4f4f5',
    colTextMuted: '#a1a1aa',
    typeText: '#a1a1aa',
    pkBg: '#fafafa',
    pkText: '#09090b',
    fkBg: '#24242b',
    fkText: '#f4f4f5',
    ukBg: '#1f1f25',
    ukText: '#d4d4d8',
    edgeColor: '#52525b',
    edgeInferred: '#a1a1aa',
    edgeHighlight: '#fafafa',
    edgeSelected: '#ffffff',
    labelBg: '#121215',
    labelBorder: '#3f3f46',
    labelText: '#fafafa',
    shadowColor: 'rgba(0, 0, 0, 0.55)',
    // Refined obsidian/charcoal tonal steps per schema
    schemaPalette: ['#222228', '#2a2a32', '#1d1d22', '#31313a', '#26262d', '#2e2e36', '#202026', '#35353f'],
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

function getHeaderAccent(table, schemaIndexMap, palette, isDark) {
  if (table.isExternal) return isDark ? '#52525b' : '#71717a';
  if (table.schema && schemaIndexMap.has(table.schema)) {
    return palette[schemaIndexMap.get(table.schema) % palette.length];
  }
  if (table.isJunctionTable) return palette[2 % palette.length];
  return palette[0];
}

function buildCrowsFootMarkup(x, y, dir, multiplicity, stroke, fillBg) {
  const parts = [];
  const sw = 1.65;
  const footLen = 11;
  const footHalfH = 6.2;

  if (multiplicity === '0..N' || multiplicity === '1..N') {
    const apexX = x + dir * footLen;
    parts.push(
      `<path d="M ${apexX} ${y} L ${x} ${y - footHalfH} M ${apexX} ${y} L ${x} ${y} M ${apexX} ${y} L ${x} ${y + footHalfH}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`
    );
    if (multiplicity === '0..N') {
      const cx = x + dir * (footLen + 5.2);
      parts.push(
        `<circle cx="${cx}" cy="${y}" r="3.6" stroke="${stroke}" stroke-width="${sw}" fill="${fillBg}"/>`
      );
    } else {
      const bx = x + dir * (footLen + 3.5);
      parts.push(
        `<line x1="${bx}" y1="${y - 6}" x2="${bx}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
      );
    }
  } else if (multiplicity === '0..1') {
    const barX = x + dir * 6;
    const cx = x + dir * 14.5;
    parts.push(
      `<line x1="${barX}" y1="${y - 6}" x2="${barX}" y2="${y + 6}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`
    );
    parts.push(
      `<circle cx="${cx}" cy="${y}" r="3.6" stroke="${stroke}" stroke-width="${sw}" fill="${fillBg}"/>`
    );
  } else {
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

function buildRoundedOrthogonalPath(pts, radius = 11) {
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

export function computeEdgeRoute(rel, srcNode, tgtNode, options = {}, laneIndex = 0) {
  const { detailMode = 'full', edgeStyle = 'orthogonal' } = options;

  const srcY = srcNode.y + getColumnPortOffsetY(srcNode, rel.sourceColumns[0], detailMode);
  const tgtY = tgtNode.y + getColumnPortOffsetY(tgtNode, rel.targetColumns[0], detailMode);

  if (rel.sourceTableId === rel.targetTableId) {
    const x = srcNode.x + srcNode.width;
    const loopW = 38 + laneIndex * 18;
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
        : buildRoundedOrthogonalPath(pts, 12);
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
    srcX = srcRight;
    srcDir = 1;
    tgtX = tgtLeft;
    tgtDir = -1;
  } else if (srcLeft >= tgtRight + minClearance) {
    srcX = srcLeft;
    srcDir = -1;
    tgtX = tgtRight;
    tgtDir = 1;
  } else {
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
      pathD = buildRoundedOrthogonalPath(pts, 12);
      labelPos = { x: midX, y: (srcY + tgtY) / 2 };
    }
  } else {
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
      pathD = buildRoundedOrthogonalPath(pts, 12);
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

export function renderErdSvg(schema, layout, options = {}) {
  const {
    theme: themeName = 'light',
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

  const isDark = themeName === 'dark';
  const theme = THEMES[themeName] || THEMES.light;
  const { nodes, bounds } = layout;

  const schemaIndexMap = new Map();
  schema.schemas.forEach((s, i) => schemaIndexMap.set(s, i));

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

    const strokeWidth = isSelected ? 2.5 : isHighlighted ? 2.1 : 1.45;
    const dashAttr = rel.inferred ? 'stroke-dasharray="5 4"' : '';
    const opacity = isDimmed ? 0.14 : 1;

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

    // Subtle animated flow shimmer along highlighted/selected edges (live DOM only)
    const flowOverlay =
      !standalone && (isHighlighted || isSelected) && !rel.inferred
        ? `<path class="erd-edge-flow" d="${route.pathD}" fill="none" stroke="${theme.canvasBg}" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="4 20" stroke-linecap="round"/>`
        : '';

    let labelMarkup = '';
    if (showEdgeLabels || isSelected || isHighlighted) {
      const cardText = rel.cardinality === '1:1' ? '1:1' : 'N:1';
      const labelStr = rel.inferred ? `${cardText} ~` : cardText;
      const w = labelStr.length * 6.8 + 16;
      const pillBg = isSelected || isHighlighted ? stroke : theme.labelBg;
      const pillText = isSelected || isHighlighted ? (isDark ? '#09090b' : '#ffffff') : theme.labelText;
      labelMarkup = `
        <g class="erd-edge-label" transform="translate(${route.labelPos.x.toFixed(1)}, ${route.labelPos.y.toFixed(1)})">
          <rect x="${(-w / 2).toFixed(1)}" y="-10" width="${w.toFixed(1)}" height="20" rx="10" fill="${pillBg}" stroke="${isHighlighted || isSelected ? stroke : theme.labelBorder}" stroke-width="1"/>
          <text x="0" y="3.5" text-anchor="middle" font-size="10" font-weight="700" fill="${pillText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(labelStr)}</text>
        </g>`;
    }

    const edgeGroup = `
      <g class="erd-edge${isHighlighted ? ' is-highlighted' : ''}${isSelected ? ' is-selected' : ''}" data-relation-id="${escapeXml(rel.id)}" style="opacity:${opacity}">
        <path class="erd-edge-hit" d="${route.pathD}" fill="none" stroke="transparent" stroke-width="14" stroke-linecap="round"/>
        <path class="erd-edge-line" d="${route.pathD}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${dashAttr} stroke-linecap="round" stroke-linejoin="round"/>
        ${flowOverlay}
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

  // Render Airbnb-style Minimalist Monochrome Table Cards
  const tableCards = [];
  for (const node of nodes.values()) {
    const t = node.table;
    const isSelected = t.id === selectedTableId;
    const isHighlighted = highlightedTables.has(t.id);
    const isDimmed = hasHighlight && !isHighlighted;
    const opacity = isDimmed ? 0.24 : 1;

    const accent = getHeaderAccent(t, schemaIndexMap, theme.schemaPalette, isDark);
    const headerTextColor = t.isExternal ? '#ffffff' : theme.headerText;
    const borderColor = isSelected
      ? theme.cardBorderSelected
      : isHighlighted
        ? theme.edgeHighlight
        : t.isExternal
          ? theme.cardBorderExternal
          : theme.cardBorder;
    const borderWidth = isSelected ? 2.2 : isHighlighted ? 1.8 : 1.1;
    const borderDash = t.isExternal ? 'stroke-dasharray="5 3"' : '';
    const clipId = `clip_${t.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const cardRadius = 14;

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
      const bw = badgeTag.length * 6.2 + 14;
      badgeMarkup = `
        <rect x="${node.width - bw - 10}" y="10" width="${bw}" height="18" rx="9" fill="${theme.schemaTagBg}"/>
        <text x="${node.width - bw / 2 - 10}" y="22.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="${t.isExternal ? '#ffffff' : theme.schemaTagText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(badgeTag)}</text>`;
    }

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
            `<line x1="10" y1="${rowY}" x2="${node.width - 10}" y2="${rowY}" stroke="${theme.rowDivider}" stroke-width="1"/>`
          );
        }

        let cursorX = 11;
        let badgesSvg = '';

        if (col.isPrimaryKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="22" height="16" rx="8" fill="${theme.pkBg}"/><text x="${cursorX + 11}" y="${rowY + 16.3}" text-anchor="middle" font-size="9" font-weight="700" fill="${theme.pkText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">PK</text>`;
          cursorX += 26;
        }
        if (col.isForeignKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="22" height="16" rx="8" fill="${theme.fkBg}" stroke="${theme.cardBorder}" stroke-width="0.75"/><text x="${cursorX + 11}" y="${rowY + 16.3}" text-anchor="middle" font-size="9" font-weight="700" fill="${theme.fkText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">FK</text>`;
          cursorX += 26;
        }
        if (col.isUnique && !col.isPrimaryKey) {
          badgesSvg += `<rect x="${cursorX}" y="${rowY + 5}" width="22" height="16" rx="8" fill="${theme.ukBg}"/><text x="${cursorX + 11}" y="${rowY + 16.3}" text-anchor="middle" font-size="9" font-weight="700" fill="${theme.ukText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">UK</text>`;
          cursorX += 26;
        }
        if (!col.isPrimaryKey && !col.isForeignKey && !col.isUnique) {
          badgesSvg += `<circle cx="${cursorX + 4}" cy="${rowY + 13}" r="2.1" fill="${theme.colTextMuted}" opacity="${col.nullable ? '0.35' : '0.7'}"/>`;
          cursorX += 13;
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
            <text x="${cursorX + 2}" y="${textY}" font-size="12" font-weight="${fontWeight}" fill="${theme.colText}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(dispCol)}</text>
            ${
              showTypes && typeLabel
                ? `<text x="${node.width - 11}" y="${textY}" text-anchor="end" font-size="10.5" fill="${theme.typeText}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(typeLabel)}</text>`
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
            <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="${cardRadius}" ry="${cardRadius}"/>
          </clipPath>
        </defs>
        <rect x="0" y="4" width="${node.width}" height="${node.height}" rx="${cardRadius}" ry="${cardRadius}" fill="${theme.shadowColor}"/>
        <g clip-path="url(#${clipId})">
          <rect x="0" y="0" width="${node.width}" height="${node.height}" fill="${theme.cardBg}"/>
          <rect class="erd-table-header" x="0" y="0" width="${node.width}" height="${CARD_METRICS.HEADER_HEIGHT}" fill="${accent}"/>
          <text x="13" y="24" font-size="13" font-weight="700" letter-spacing="-0.015em" fill="${headerTextColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">${escapeXml(headerTitle)}</text>
          ${badgeMarkup}
          ${rowsMarkup.join('')}
        </g>
        <rect x="0" y="0" width="${node.width}" height="${node.height}" rx="${cardRadius}" ry="${cardRadius}" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" ${borderDash}/>
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
        <pattern id="erd-dot-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.15" fill="${theme.dotColor}"/>
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
