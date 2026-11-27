/**
 * Offline ERD Exporters
 * Supports standalone SVG, High-DPI PNG (browser Canvas), Mermaid erDiagram,
 * DBML, JSON schema, and Markdown Data Dictionary.
 */

import { renderErdSvg } from '../renderer/svgRenderer.js';

/**
 * Exports a self-contained SVG string.
 */
export function exportSvg(schema, layout, options = {}) {
  return renderErdSvg(schema, layout, {
    ...options,
    selectedTableId: null,
    hoveredTableId: null,
    selectedRelationId: null,
    hoveredRelationId: null,
    standalone: true,
    includeGrid: options.includeGrid ?? true,
  });
}

function sanitizeMermaidIdent(name) {
  return String(name || 'unnamed').replace(/[^A-Za-z0-9_]/g, '_');
}

function sanitizeMermaidType(type) {
  return String(type || 'unknown')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_(),]/g, '')
    .replace(/,/g, '_') || 'unknown';
}

/**
 * Exports schema to Mermaid erDiagram syntax.
 */
export function exportMermaid(schema) {
  const lines = ['erDiagram'];

  for (const t of schema.tables) {
    const tName = sanitizeMermaidIdent(t.schema ? `${t.schema}_${t.name}` : t.name);
    lines.push(`    ${tName} {`);
    for (const c of t.columns) {
      const mType = sanitizeMermaidType(c.type);
      const mCol = sanitizeMermaidIdent(c.name);
      const keys = [];
      if (c.isPrimaryKey) keys.push('PK');
      if (c.isForeignKey) keys.push('FK');
      if (c.isUnique && !c.isPrimaryKey) keys.push('UK');
      const keyPart = keys.length > 0 ? ` ${keys.join(',')}` : '';
      const commentPart = c.comment ? ` "${c.comment.replace(/"/g, "'")}"` : '';
      lines.push(`        ${mType} ${mCol}${keyPart}${commentPart}`);
    }
    lines.push('    }');
  }

  if (schema.relations.length > 0) {
    lines.push('');
    for (const r of schema.relations) {
      const srcTable = schema.tables.find((t) => t.id === r.sourceTableId);
      const tgtTable = schema.tables.find((t) => t.id === r.targetTableId);
      if (!srcTable || !tgtTable) continue;
      const src = sanitizeMermaidIdent(srcTable.schema ? `${srcTable.schema}_${srcTable.name}` : srcTable.name);
      const tgt = sanitizeMermaidIdent(tgtTable.schema ? `${tgtTable.schema}_${tgtTable.name}` : tgtTable.name);

      // Parent (target) to Child (source)
      const leftCard = r.targetEnd === '0..1' ? '|o' : '||';
      const rightCard = r.cardinality === '1:1' ? (r.sourceEnd === '0..1' ? 'o|' : '||') : 'o{';
      const lineStyle = r.inferred ? '..' : '--';
      const label = `${r.sourceColumns.join(', ')} -> ${r.targetColumns.join(', ')}`;
      lines.push(`    ${tgt} ${leftCard}${lineStyle}${rightCard} ${src} : "${label}"`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Exports schema to DBML (Database Markup Language).
 */
export function exportDbml(schema) {
  const lines = [];

  for (const en of schema.enums || []) {
    const name = en.schema ? `${en.schema}.${en.name}` : en.name;
    lines.push(`Enum ${name} {`);
    for (const v of en.values) {
      lines.push(`  "${v.replace(/"/g, '\\"')}"`);
    }
    lines.push('}');
    lines.push('');
  }

  for (const t of schema.tables) {
    if (t.isExternal) continue;
    const tName = t.schema ? `${t.schema}.${t.name}` : t.name;
    lines.push(`Table ${tName} {`);
    for (const c of t.columns) {
      const attrs = [];
      if (c.isPrimaryKey) attrs.push('pk');
      if (c.autoIncrement) attrs.push('increment');
      if (!c.nullable && !c.isPrimaryKey) attrs.push('not null');
      if (c.isUnique && !c.isPrimaryKey) attrs.push('unique');
      if (c.defaultValue !== null) attrs.push(`default: \`${c.defaultValue}\``);
      if (c.comment) attrs.push(`note: '${c.comment.replace(/'/g, "\\'")}'`);
      const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
      lines.push(`  ${c.name} "${c.type}"${attrStr}`);
    }
    if (t.comment) {
      lines.push(`  Note: '${t.comment.replace(/'/g, "\\'")}'`);
    }
    lines.push('}');
    lines.push('');
  }

  for (const r of schema.relations) {
    const srcCols = r.sourceColumns.length > 1 ? `(${r.sourceColumns.join(', ')})` : r.sourceColumns[0];
    const tgtCols = r.targetColumns.length > 1 ? `(${r.targetColumns.join(', ')})` : r.targetColumns[0];
    const op = r.cardinality === '1:1' ? '-' : '>';
    const opts = [];
    if (r.onDelete) opts.push(`delete: ${r.onDelete.toLowerCase()}`);
    if (r.onUpdate) opts.push(`update: ${r.onUpdate.toLowerCase()}`);
    const optStr = opts.length > 0 ? ` [${opts.join(', ')}]` : '';
    const prefix = r.inferred ? '// inferred: ' : '';
    lines.push(`${prefix}Ref: ${r.sourceTableId}.${srcCols} ${op} ${r.targetTableId}.${tgtCols}${optStr}`);
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Exports structured JSON representation of schema and optional layout.
 */
export function exportJson(schema, layout = null) {
  const payload = {
    dialect: schema.dialect,
    stats: schema.stats,
    schemas: schema.schemas,
    enums: schema.enums,
    tables: schema.tables,
    relations: schema.relations,
    warnings: schema.warnings,
  };
  if (layout && layout.nodes) {
    payload.layout = Object.fromEntries(
      [...layout.nodes.entries()].map(([id, n]) => [id, { x: n.x, y: n.y, width: n.width, height: n.height }])
    );
  }
  return JSON.stringify(payload, null, 2) + '\n';
}

/**
 * Exports human-readable Markdown Data Dictionary & Relationships report.
 */
export function exportMarkdownDocs(schema) {
  const lines = [
    '# Database Schema & Relationships',
    '',
    `- **Detected Dialect:** ${schema.dialect}`,
    `- **Tables:** ${schema.stats.tableCount}${schema.stats.externalTableCount ? ` (+${schema.stats.externalTableCount} external)` : ''}`,
    `- **Total Columns:** ${schema.stats.columnCount}`,
    `- **Relationships:** ${schema.stats.relationCount} (${schema.stats.explicitRelationCount} explicit${schema.stats.inferredRelationCount ? `, ${schema.stats.inferredRelationCount} inferred` : ''})`,
    '',
    '## Relationships',
    '',
  ];

  if (schema.relations.length === 0) {
    lines.push('_No relationships found._');
  } else {
    lines.push('| Child Table | Child Column(s) | Cardinality | Parent Table | Parent Column(s) | ON DELETE | Source |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of schema.relations) {
      lines.push(
        `| \`${r.sourceTableId}\` | \`${r.sourceColumns.join(', ')}\` | **${r.cardinality}** | \`${r.targetTableId}\` | \`${r.targetColumns.join(', ')}\` | ${r.onDelete || '—'} | ${r.inferred ? 'Inferred' : 'FK'} |`
      );
    }
  }

  lines.push('', '## Tables', '');
  for (const t of schema.tables) {
    const tag = t.isExternal ? ' *(External Reference)*' : t.isJunctionTable ? ' *(Junction Table)*' : '';
    lines.push(`### \`${t.id}\`${tag}`);
    if (t.comment) lines.push('', `> ${t.comment}`);
    lines.push('');
    lines.push('| Column | Type | Keys | Nullable | Default | Notes |');
    lines.push('|---|---|---|---|---|---|');
    for (const c of t.columns) {
      const keys = [];
      if (c.isPrimaryKey) keys.push('PK');
      if (c.isForeignKey) keys.push('FK');
      if (c.isUnique && !c.isPrimaryKey) keys.push('UK');
      const refNote = c.references ? `→ \`${c.references.tableId}.${c.references.column}\`` : '';
      const note = [refNote, c.comment || ''].filter(Boolean).join(' · ');
      lines.push(
        `| \`${c.name}\` | \`${c.type}\` | ${keys.join(', ') || '—'} | ${c.nullable ? 'YES' : 'NO'} | ${c.defaultValue !== null ? `\`${c.defaultValue}\`` : '—'} | ${note || '—'} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Browser-only: Renders an SVG string to a crisp High-DPI PNG Blob completely offline.
 */
export async function exportPngBlob(svgString, scale = 2) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.max(1, img.naturalWidth || img.width);
        const h = Math.max(1, img.naturalHeight || img.height);
        // Cap pixel dimensions safely for huge diagrams so browser canvas never fails
        const maxDim = 8192;
        const effectiveScale = Math.min(scale, maxDim / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(w * effectiveScale);
        canvas.height = Math.ceil(h * effectiveScale);
        const ctx = canvas.getContext('2d');
        ctx.scale(effectiveScale, effectiveScale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode PNG image.'));
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG to PNG.'));
    };
    img.src = url;
  });
}
