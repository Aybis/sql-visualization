/**
 * Heuristic / Implicit Foreign Key Relation Inferrer
 * Used when a user's SQL dump lacks explicit FOREIGN KEY constraints (common in MyISAM,
 * legacy schemas, or stripped exports) and enables "Infer Relations".
 * Inferred relations are always clearly flagged with `inferred: true`.
 */

function singularize(word) {
  const lower = word.toLowerCase();
  if (lower.endsWith('ies') && lower.length > 3) return lower.slice(0, -3) + 'y';
  if (lower.endsWith('sses') || lower.endsWith('shes') || lower.endsWith('ches') || lower.endsWith('xes')) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && lower.length > 2) {
    return lower.slice(0, -1);
  }
  return lower;
}

function pluralizeCandidates(stem) {
  const s = stem.toLowerCase();
  const set = new Set([s, `${s}s`, `${s}es`]);
  if (s.endsWith('y') && s.length > 1) {
    set.add(s.slice(0, -1) + 'ies');
  }
  return [...set];
}

/**
 * Infers likely foreign-key relationships based on column naming conventions:
 * e.g. `user_id` -> `users.id` or `user.id` or `user.user_id`
 *      `author_id` (skipped unless `authors` table exists)
 *      `parent_id` -> self-reference `<same_table>.id`
 */
export function inferImplicitRelations(tables, existingRelations) {
  const inferred = [];
  const existingKeys = new Set(
    existingRelations.map(
      (r) =>
        `${r.sourceTableId.toLowerCase()}(${r.sourceColumns.join(',').toLowerCase()})->${r.targetTableId.toLowerCase()}`
    )
  );
  const existingSourceCols = new Set(
    existingRelations.flatMap((r) =>
      r.sourceColumns.map((c) => `${r.sourceTableId.toLowerCase()}.${c.toLowerCase()}`)
    )
  );

  // Index real (non-external) tables by normalized name & singularized name
  const realTables = tables.filter((t) => !t.isExternal);
  const byName = new Map();
  for (const t of realTables) {
    const lower = t.name.toLowerCase();
    byName.set(lower, t);
    const sing = singularize(lower);
    if (!byName.has(sing)) byName.set(sing, t);
  }

  for (const tbl of realTables) {
    for (const col of tbl.columns) {
      const colLower = col.name.toLowerCase();
      // Skip if already part of an explicit FK
      if (existingSourceCols.has(`${tbl.id.toLowerCase()}.${colLower}`)) continue;
      // Skip bare primary key `id`
      if (colLower === 'id') continue;

      let targetTable = null;
      let targetCol = null;

      // Self-reference pattern: parent_id
      if (colLower === 'parent_id') {
        const pk = tbl.columns.find((c) => c.isPrimaryKey) || tbl.columns.find((c) => c.name.toLowerCase() === 'id');
        if (pk && pk.name.toLowerCase() !== colLower) {
          targetTable = tbl;
          targetCol = pk.name;
        }
      } else if (colLower.endsWith('_id') && colLower.length > 3) {
        const stem = colLower.slice(0, -3);
        const candidates = pluralizeCandidates(stem);

        for (const cand of candidates) {
          const match = byName.get(cand);
          if (match) {
            // Prefer matching `id`, or `<stem>_id`, or single PK
            const idCol =
              match.columns.find((c) => c.name.toLowerCase() === 'id') ||
              match.columns.find((c) => c.name.toLowerCase() === colLower) ||
              (match.primaryKeys.length === 1 ? match.columns.find((c) => c.isPrimaryKey) : null);
            if (idCol) {
              targetTable = match;
              targetCol = idCol.name;
              break;
            }
          }
        }
      } else if (/Id$/.test(col.name) && col.name.length > 2) {
        // camelCase: userId -> users.id
        const stem = col.name.slice(0, -2).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
        const candidates = pluralizeCandidates(stem);
        for (const cand of candidates) {
          const match = byName.get(cand);
          if (match) {
            const idCol =
              match.columns.find((c) => c.name.toLowerCase() === 'id') ||
              (match.primaryKeys.length === 1 ? match.columns.find((c) => c.isPrimaryKey) : null);
            if (idCol) {
              targetTable = match;
              targetCol = idCol.name;
              break;
            }
          }
        }
      }

      if (!targetTable || !targetCol) continue;
      // Avoid matching a table's own sole PK (e.g., users.user_id -> users.user_id)
      if (targetTable.id === tbl.id && targetCol.toLowerCase() === colLower) continue;

      const key = `${tbl.id.toLowerCase()}(${colLower})->${targetTable.id.toLowerCase()}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      const isUnique = col.isUnique || (tbl.primaryKeys.length === 1 && tbl.primaryKeys[0].toLowerCase() === colLower);
      const isNullable = col.nullable;

      inferred.push({
        id: `inf_${inferred.length + 1}`,
        name: `inferred_${tbl.name}_${col.name}`,
        sourceTableId: tbl.id,
        sourceColumns: [col.name],
        targetTableId: targetTable.id,
        targetColumns: [targetCol],
        cardinality: isUnique ? '1:1' : 'N:1',
        sourceEnd: isUnique ? (isNullable ? '0..1' : '1') : '0..N',
        targetEnd: isNullable ? '0..1' : '1',
        onDelete: null,
        onUpdate: null,
        isSelfReference: targetTable.id === tbl.id,
        isComposite: false,
        inferred: true,
      });
    }
  }

  return inferred;
}
