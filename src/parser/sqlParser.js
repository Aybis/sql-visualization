/**
 * Comprehensive Multi-Dialect SQL DDL Parser
 * Supports MySQL / MariaDB, PostgreSQL (including pg_dump), SQLite, SQL Server (T-SQL), and Oracle.
 * Extracts tables, schemas, columns, types, PKs, FKs, composite keys, unique constraints,
 * indexes, enums, comments, cardinality, optionality, and diagnostics.
 */

import { TokenType, tokenizeSql, splitStatements } from './tokenizer.js';
import { inferImplicitRelations } from './relationInferrer.js';

const COLUMN_CONSTRAINT_STARTERS = new Set([
  'NOT',
  'NULL',
  'PRIMARY',
  'UNIQUE',
  'DEFAULT',
  'REFERENCES',
  'CONSTRAINT',
  'CHECK',
  'AUTO_INCREMENT',
  'AUTOINCREMENT',
  'IDENTITY',
  'GENERATED',
  'COLLATE',
  'CHARACTER',
  'CHARSET',
  'COMMENT',
  'ON',
  'AS',
  'VISIBLE',
  'INVISIBLE',
  'STORAGE',
  'COLUMN_FORMAT',
  'MASKED',
  'SPARSE',
  'ROWGUIDCOL',
  'ENABLE',
  'DISABLE',
  'DEFERRABLE',
  'INITIALLY',
  'FOREIGN',
]);

const TYPE_MODIFIER_WORDS = new Set([
  'UNSIGNED',
  'SIGNED',
  'ZEROFILL',
  'VARYING',
  'PRECISION',
  'WITH',
  'WITHOUT',
  'TIME',
  'ZONE',
  'LOCAL',
  'LARGE',
  'OBJECT',
  'DOUBLE',
  'INT',
  'INTEGER',
  'CHAR',
  'CHARACTER',
  'BYTE',
  'NATIONAL',
  'BIT',
  'LONG',
  'SHORT',
  'YEAR',
  'MONTH',
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'TO',
]);

const SERIAL_TYPES = new Set(['SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'SERIAL2', 'SERIAL4', 'SERIAL8']);

const COMMON_SQL_TYPES = new Set([
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'VARCHAR', 'NVARCHAR', 'VARCHAR2', 'CHAR', 'NCHAR', 'CHARACTER',
  'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT', 'CLOB', 'NCLOB',
  'DECIMAL', 'NUMERIC', 'NUMBER', 'FLOAT', 'DOUBLE', 'REAL', 'MONEY',
  'BOOLEAN', 'BOOL', 'BIT', 'BINARY', 'VARBINARY', 'BLOB', 'BYTEA',
  'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'TIMESTAMPTZ', 'YEAR',
  'UUID', 'JSON', 'JSONB', 'XML', 'ENUM', 'SET',
  'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
]);

function isWord(tok, upper) {
  return tok && tok.type === TokenType.WORD && tok.upper === upper;
}

function isSym(tok, sym) {
  return tok && tok.type === TokenType.SYMBOL && tok.value === sym;
}

function isIdent(tok) {
  return tok && (tok.type === TokenType.WORD || tok.type === TokenType.QUOTED_IDENT);
}

/**
 * Reads an optionally schema-qualified identifier: [catalog.][schema.]name
 */
function readQualifiedName(tokens, pos) {
  const parts = [];
  let i = pos;
  while (i < tokens.length && isIdent(tokens[i])) {
    parts.push(tokens[i].value);
    i++;
    if (isSym(tokens[i], '.')) {
      i++;
    } else {
      break;
    }
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return { schema: null, name: parts[0], nextPos: i };
  }
  const name = parts[parts.length - 1];
  const schema = parts[parts.length - 2];
  return { schema, name, nextPos: i };
}

/**
 * Finds matching ')' index starting from an opening '(' at openIdx.
 */
function findMatchingParen(tokens, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < tokens.length; i++) {
    if (isSym(tokens[i], '(')) depth++;
    else if (isSym(tokens[i], ')')) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

/**
 * Splits a token slice by top-level commas (parenDepth === 0).
 */
function splitByTopLevelComma(tokens) {
  const items = [];
  let cur = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (isSym(t, '(')) depth++;
    else if (isSym(t, ')')) depth = Math.max(0, depth - 1);
    if (isSym(t, ',') && depth === 0) {
      if (cur.length > 0) items.push(cur);
      cur = [];
    } else {
      cur.push(t);
    }
  }
  if (cur.length > 0) items.push(cur);
  return items;
}

/**
 * Parses a parenthesized list of column names: (col1 [ASC|DESC], col2(191), ...)
 */
function parseColumnList(tokens, openIdx) {
  const closeIdx = findMatchingParen(tokens, openIdx);
  const inner = tokens.slice(openIdx + 1, closeIdx);
  const parts = splitByTopLevelComma(inner);
  const cols = [];
  for (const part of parts) {
    if (part.length > 0 && isIdent(part[0])) {
      cols.push(part[0].value);
    }
  }
  return { columns: cols, nextPos: closeIdx + 1 };
}

/**
 * Reads referential action after ON DELETE / ON UPDATE:
 * CASCADE | SET NULL | SET DEFAULT | RESTRICT | NO ACTION
 */
function readReferentialAction(tokens, pos) {
  let i = pos;
  if (isWord(tokens[i], 'CASCADE')) return { action: 'CASCADE', nextPos: i + 1 };
  if (isWord(tokens[i], 'RESTRICT')) return { action: 'RESTRICT', nextPos: i + 1 };
  if (isWord(tokens[i], 'SET')) {
    if (isWord(tokens[i + 1], 'NULL')) return { action: 'SET NULL', nextPos: i + 2 };
    if (isWord(tokens[i + 1], 'DEFAULT')) return { action: 'SET DEFAULT', nextPos: i + 2 };
    return { action: 'SET', nextPos: i + 1 };
  }
  if (isWord(tokens[i], 'NO') && isWord(tokens[i + 1], 'ACTION')) {
    return { action: 'NO ACTION', nextPos: i + 2 };
  }
  return { action: null, nextPos: i };
}

/**
 * Parses a REFERENCES [schema.]table [(cols)] [MATCH ...] [ON DELETE ...] [ON UPDATE ...] clause.
 */
function parseReferencesClause(tokens, pos) {
  let i = pos;
  if (!isWord(tokens[i], 'REFERENCES')) return null;
  i++;

  const target = readQualifiedName(tokens, i);
  if (!target) return null;
  i = target.nextPos;

  let targetColumns = [];
  if (isSym(tokens[i], '(')) {
    const parsed = parseColumnList(tokens, i);
    targetColumns = parsed.columns;
    i = parsed.nextPos;
  }

  let onDelete = null;
  let onUpdate = null;

  while (i < tokens.length) {
    if (isWord(tokens[i], 'ON')) {
      if (isWord(tokens[i + 1], 'DELETE')) {
        const res = readReferentialAction(tokens, i + 2);
        onDelete = res.action;
        i = res.nextPos;
        continue;
      }
      if (isWord(tokens[i + 1], 'UPDATE')) {
        const res = readReferentialAction(tokens, i + 2);
        onUpdate = res.action;
        i = res.nextPos;
        continue;
      }
    }
    if (isWord(tokens[i], 'MATCH')) {
      i += 2; // MATCH SIMPLE / FULL / PARTIAL
      continue;
    }
    if (isWord(tokens[i], 'NOT') && isWord(tokens[i + 1], 'DEFERRABLE')) {
      i += 2;
      continue;
    }
    if (isWord(tokens[i], 'DEFERRABLE')) {
      i += 1;
      continue;
    }
    if (isWord(tokens[i], 'INITIALLY')) {
      i += 2; // INITIALLY DEFERRED / IMMEDIATE
      continue;
    }
    if (isWord(tokens[i], 'NOT') && isWord(tokens[i + 1], 'FOR') && isWord(tokens[i + 2], 'REPLICATION')) {
      i += 3;
      continue;
    }
    break;
  }

  return {
    targetSchema: target.schema,
    targetTable: target.name,
    targetColumns,
    onDelete,
    onUpdate,
    nextPos: i,
  };
}

/**
 * Determines whether an item inside CREATE TABLE (...) is a table-level constraint/index
 * rather than a column definition.
 */
function isTableLevelItem(item) {
  if (!item || item.length === 0) return false;
  const first = item[0];
  // Quoted identifiers at start of an item are ALWAYS column names (e.g. `key` VARCHAR(64))
  if (first.type === TokenType.QUOTED_IDENT) return false;
  if (first.type !== TokenType.WORD) return false;

  const u = first.upper;
  if (u === 'CONSTRAINT') return true;
  if (u === 'FOREIGN' && isWord(item[1], 'KEY')) return true;
  if (u === 'PRIMARY' && isWord(item[1], 'KEY')) return true;
  if (u === 'CHECK' && isSym(item[1], '(')) return true;
  if (u === 'EXCLUDE' || u === 'PERIOD' || u === 'LIKE') return true;

  if (u === 'UNIQUE') {
    // UNIQUE (col), UNIQUE KEY ..., UNIQUE INDEX ..., UNIQUE [CLUSTERED|NONCLUSTERED] ...
    if (
      isSym(item[1], '(') ||
      isWord(item[1], 'KEY') ||
      isWord(item[1], 'INDEX') ||
      isWord(item[1], 'CLUSTERED') ||
      isWord(item[1], 'NONCLUSTERED') ||
      (isIdent(item[1]) && (isSym(item[2], '(') || isWord(item[2], 'USING')))
    ) {
      return true;
    }
    return false;
  }

  if (u === 'FULLTEXT' || u === 'SPATIAL') {
    if (isWord(item[1], 'KEY') || isWord(item[1], 'INDEX') || isSym(item[1], '(')) return true;
    return false;
  }

  if (u === 'KEY' || u === 'INDEX') {
    // KEY (col), KEY idx_name (col), KEY idx_name USING BTREE (col)
    if (isSym(item[1], '(')) return true;
    if (isWord(item[1], 'USING')) return true;
    if (isIdent(item[1]) && (isSym(item[2], '(') || isWord(item[2], 'USING'))) {
      // Distinguish column definitions like `index VARCHAR(32)` or `key INT(11)` from `KEY idx_name (col)`
      if (item[1].type === TokenType.WORD && COMMON_SQL_TYPES.has(item[1].upper)) {
        return false;
      }
      if (isSym(item[2], '(')) {
        const insideFirst = item[3];
        if (
          insideFirst &&
          (insideFirst.type === TokenType.NUMBER ||
            insideFirst.type === TokenType.STRING ||
            isWord(insideFirst, 'MAX'))
        ) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Formats a token sequence cleanly back into a readable SQL type or expression string.
 */
function formatTokens(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    let text = t.type === TokenType.STRING ? t.raw || `'${t.value}'` : t.value;
    if (i > 0) {
      const noSpaceBefore =
        text === '(' ||
        text === ')' ||
        text === ',' ||
        text === '.' ||
        text === '::' ||
        text === '[]';
      const noSpaceAfterPrev =
        prev.value === '(' || prev.value === '.' || prev.value === '::';
      if (!noSpaceBefore && !noSpaceAfterPrev) {
        out += ' ';
      } else if (text === '(' && prev.type === TokenType.WORD && prev.upper === 'AS') {
        out += ' ';
      }
    }
    out += text;
  }
  return out.trim();
}

/**
 * Parses a single column definition inside CREATE TABLE (...) or ALTER TABLE ADD COLUMN.
 */
function parseColumnDefinition(item) {
  if (!item || item.length < 2) return null;
  const colName = item[0].value;
  let i = 1;

  // Parse data type (handles schema.custom_type, VARCHAR(255), NUMERIC(10,2), TIMESTAMP WITH TIME ZONE, INT UNSIGNED, TEXT[], ENUM(...))
  const typeTokens = [];

  // Read base type name (may be schema.type_name)
  if (i < item.length && isIdent(item[i])) {
    typeTokens.push(item[i]);
    i++;
    if (isSym(item[i], '.') && isIdent(item[i + 1])) {
      typeTokens.push(item[i], item[i + 1]);
      i += 2;
    }
  }

  // Consume type arguments (...) and multi-word type modifiers
  while (i < item.length) {
    const t = item[i];

    // Parenthesized type params like (255), (10, 2), ('a', 'b'), (MAX)
    if (isSym(t, '(')) {
      const closeIdx = findMatchingParen(item, i);
      for (let k = i; k <= closeIdx; k++) typeTokens.push(item[k]);
      i = closeIdx + 1;
      continue;
    }

    // PostgreSQL array suffix []
    if (isSym(t, '[]')) {
      typeTokens.push(t);
      i++;
      continue;
    }

    // Stop if this word begins a column constraint
    if (t.type === TokenType.WORD && COLUMN_CONSTRAINT_STARTERS.has(t.upper)) {
      // Special case: CHARACTER VARYING is part of type, CHARACTER SET is a constraint
      if (t.upper === 'CHARACTER' && isWord(item[i + 1], 'VARYING')) {
        typeTokens.push(t, item[i + 1]);
        i += 2;
        continue;
      }
      break;
    }

    // Multi-word type modifiers (DOUBLE PRECISION, TIMESTAMP WITH TIME ZONE, INT UNSIGNED, etc.)
    if (t.type === TokenType.WORD && TYPE_MODIFIER_WORDS.has(t.upper)) {
      typeTokens.push(t);
      i++;
      continue;
    }

    break;
  }

  const rawType = formatTokens(typeTokens) || 'UNKNOWN';
  const baseTypeUpper = (typeTokens[0]?.value || '').toUpperCase();

  const column = {
    name: colName,
    type: rawType,
    nullable: !SERIAL_TYPES.has(baseTypeUpper),
    isPrimaryKey: false,
    isForeignKey: false,
    isUnique: false,
    autoIncrement: SERIAL_TYPES.has(baseTypeUpper),
    defaultValue: null,
    comment: null,
    inlineReferences: [],
  };

  // Parse column constraints
  while (i < item.length) {
    const t = item[i];
    if (t.type !== TokenType.WORD) {
      i++;
      continue;
    }

    const u = t.upper;

    if (u === 'NOT' && isWord(item[i + 1], 'NULL')) {
      column.nullable = false;
      i += 2;
      continue;
    }

    if (u === 'NULL') {
      column.nullable = true;
      i++;
      continue;
    }

    if (u === 'PRIMARY' && isWord(item[i + 1], 'KEY')) {
      column.isPrimaryKey = true;
      column.nullable = false;
      i += 2;
      if (isWord(item[i], 'CLUSTERED') || isWord(item[i], 'NONCLUSTERED') || isWord(item[i], 'ASC') || isWord(item[i], 'DESC')) {
        i++;
      }
      if (isWord(item[i], 'AUTOINCREMENT')) {
        column.autoIncrement = true;
        i++;
      }
      continue;
    }

    if (u === 'UNIQUE') {
      column.isUnique = true;
      i++;
      if (isWord(item[i], 'KEY') || isWord(item[i], 'INDEX')) i++;
      continue;
    }

    if (u === 'AUTO_INCREMENT' || u === 'AUTOINCREMENT') {
      column.autoIncrement = true;
      i++;
      continue;
    }

    if (u === 'IDENTITY') {
      column.autoIncrement = true;
      i++;
      if (isSym(item[i], '(')) {
        i = findMatchingParen(item, i) + 1;
      }
      continue;
    }

    if (u === 'GENERATED') {
      // GENERATED ALWAYS AS IDENTITY / GENERATED BY DEFAULT AS IDENTITY / GENERATED ALWAYS AS (...)
      i++;
      while (i < item.length) {
        if (isWord(item[i], 'IDENTITY')) {
          column.autoIncrement = true;
          i++;
          if (isSym(item[i], '(')) i = findMatchingParen(item, i) + 1;
          break;
        }
        if (isSym(item[i], '(')) {
          i = findMatchingParen(item, i) + 1;
          if (isWord(item[i], 'STORED') || isWord(item[i], 'VIRTUAL')) i++;
          break;
        }
        if (COLUMN_CONSTRAINT_STARTERS.has(item[i].upper || '') && !isWord(item[i], 'AS') && !isWord(item[i], 'DEFAULT')) {
          break;
        }
        i++;
      }
      continue;
    }

    if (u === 'DEFAULT') {
      i++;
      const defTokens = [];
      while (i < item.length) {
        const dt = item[i];
        if (isSym(dt, '(')) {
          const closeIdx = findMatchingParen(item, i);
          for (let k = i; k <= closeIdx; k++) defTokens.push(item[k]);
          i = closeIdx + 1;
          continue;
        }
        // Stop at the next column constraint keyword (allow NULL / TRUE / FALSE / CURRENT_TIMESTAMP / ::cast as default value)
        if (
          dt.type === TokenType.WORD &&
          COLUMN_CONSTRAINT_STARTERS.has(dt.upper) &&
          !(dt.upper === 'NULL' && defTokens.length === 0)
        ) {
          break;
        }
        defTokens.push(dt);
        i++;
      }
      if (defTokens.length > 0) {
        column.defaultValue = formatTokens(defTokens);
      }
      continue;
    }

    if (u === 'COMMENT') {
      i++;
      if (isSym(item[i], '=')) i++;
      if (item[i] && item[i].type === TokenType.STRING) {
        column.comment = item[i].value;
        i++;
      }
      continue;
    }

    if (u === 'CONSTRAINT') {
      const constraintName = isIdent(item[i + 1]) ? item[i + 1].value : null;
      i += constraintName ? 2 : 1;
      if (isWord(item[i], 'REFERENCES')) {
        const ref = parseReferencesClause(item, i);
        if (ref) {
          column.inlineReferences.push({ ...ref, constraintName });
          i = ref.nextPos;
        }
      }
      continue;
    }

    if (u === 'REFERENCES') {
      const ref = parseReferencesClause(item, i);
      if (ref) {
        column.inlineReferences.push({ ...ref, constraintName: null });
        i = ref.nextPos;
        continue;
      }
    }

    if (u === 'CHECK') {
      i++;
      if (isSym(item[i], '(')) {
        i = findMatchingParen(item, i) + 1;
      }
      continue;
    }

    if (u === 'CHARACTER' && isWord(item[i + 1], 'SET')) {
      i += 3;
      continue;
    }

    if (u === 'CHARSET' || u === 'COLLATE') {
      i += 2;
      continue;
    }

    if (u === 'ON' && isWord(item[i + 1], 'UPDATE')) {
      i += 2;
      // Skip CURRENT_TIMESTAMP or CURRENT_TIMESTAMP()
      if (i < item.length) i++;
      if (isSym(item[i], '(')) i = findMatchingParen(item, i) + 1;
      continue;
    }

    if (u === 'AS' && isSym(item[i + 1], '(')) {
      i = findMatchingParen(item, i + 1) + 1;
      if (isWord(item[i], 'STORED') || isWord(item[i], 'VIRTUAL') || isWord(item[i], 'PERSISTED')) i++;
      continue;
    }

    i++;
  }

  return column;
}

/**
 * Parses a table-level constraint or index item inside CREATE TABLE (...).
 */
function parseTableConstraint(item) {
  let i = 0;
  let constraintName = null;

  if (isWord(item[i], 'CONSTRAINT')) {
    i++;
    if (isIdent(item[i])) {
      constraintName = item[i].value;
      i++;
    }
  }

  const kw = item[i];
  if (!kw || kw.type !== TokenType.WORD) return null;

  // PRIMARY KEY (...)
  if (kw.upper === 'PRIMARY' && isWord(item[i + 1], 'KEY')) {
    i += 2;
    while (i < item.length && !isSym(item[i], '(')) i++;
    if (isSym(item[i], '(')) {
      const { columns } = parseColumnList(item, i);
      return { kind: 'PRIMARY_KEY', name: constraintName, columns };
    }
    return null;
  }

  // FOREIGN KEY [idx_name] (cols) REFERENCES ...
  if (kw.upper === 'FOREIGN' && isWord(item[i + 1], 'KEY')) {
    i += 2;
    if (isIdent(item[i]) && !isSym(item[i], '(')) {
      if (!constraintName) constraintName = item[i].value;
      i++;
    }
    if (!isSym(item[i], '(')) return null;
    const { columns: sourceColumns, nextPos } = parseColumnList(item, i);
    i = nextPos;
    const ref = parseReferencesClause(item, i);
    if (!ref) return null;
    return {
      kind: 'FOREIGN_KEY',
      name: constraintName,
      sourceColumns,
      ...ref,
    };
  }

  // UNIQUE [KEY|INDEX] [name] [USING ...] (cols)
  if (kw.upper === 'UNIQUE') {
    i++;
    if (isWord(item[i], 'KEY') || isWord(item[i], 'INDEX') || isWord(item[i], 'CLUSTERED') || isWord(item[i], 'NONCLUSTERED')) {
      i++;
    }
    let idxName = constraintName;
    if (isIdent(item[i]) && !isWord(item[i], 'USING')) {
      idxName = idxName || item[i].value;
      i++;
    }
    while (i < item.length && !isSym(item[i], '(')) i++;
    if (isSym(item[i], '(')) {
      const { columns } = parseColumnList(item, i);
      return { kind: 'UNIQUE', name: idxName, columns };
    }
    return null;
  }

  // [FULLTEXT|SPATIAL] KEY|INDEX [name] [USING ...] (cols)
  if (kw.upper === 'KEY' || kw.upper === 'INDEX' || kw.upper === 'FULLTEXT' || kw.upper === 'SPATIAL') {
    const indexType = kw.upper === 'FULLTEXT' || kw.upper === 'SPATIAL' ? kw.upper : 'INDEX';
    i++;
    if (isWord(item[i], 'KEY') || isWord(item[i], 'INDEX')) i++;
    let idxName = constraintName;
    if (isIdent(item[i]) && !isWord(item[i], 'USING')) {
      idxName = idxName || item[i].value;
      i++;
    }
    while (i < item.length && !isSym(item[i], '(')) i++;
    if (isSym(item[i], '(')) {
      const { columns } = parseColumnList(item, i);
      return { kind: 'INDEX', indexType, name: idxName, columns };
    }
    return null;
  }

  return null;
}

/**
 * Parses CREATE TABLE statement.
 */
function parseCreateTable(stmt, defaultSchema) {
  let i = 1; // after CREATE
  while (
    i < stmt.length &&
    stmt[i].type === TokenType.WORD &&
    ['TEMPORARY', 'TEMP', 'UNLOGGED', 'GLOBAL', 'LOCAL', 'EXTERNAL', 'OR', 'REPLACE'].includes(stmt[i].upper)
  ) {
    i++;
  }
  if (!isWord(stmt[i], 'TABLE')) return null;
  i++;

  // Optional IF NOT EXISTS
  if (isWord(stmt[i], 'IF') && isWord(stmt[i + 1], 'NOT') && isWord(stmt[i + 2], 'EXISTS')) {
    i += 3;
  }

  const qname = readQualifiedName(stmt, i);
  if (!qname) return null;
  i = qname.nextPos;

  // Find opening '(' of column definitions (skip CREATE TABLE foo AS SELECT ...)
  if (!isSym(stmt[i], '(')) {
    return null;
  }

  const closeIdx = findMatchingParen(stmt, i);
  const bodyTokens = stmt.slice(i + 1, closeIdx);
  const tailTokens = stmt.slice(closeIdx + 1);

  const items = splitByTopLevelComma(bodyTokens);
  const columns = [];
  const primaryKeys = [];
  const uniqueConstraints = [];
  const indexes = [];
  const foreignKeys = [];

  for (const item of items) {
    if (item.length === 0) continue;
    if (isTableLevelItem(item)) {
      const parsed = parseTableConstraint(item);
      if (!parsed) continue;
      if (parsed.kind === 'PRIMARY_KEY') {
        primaryKeys.push(...parsed.columns);
      } else if (parsed.kind === 'UNIQUE') {
        uniqueConstraints.push({ name: parsed.name, columns: parsed.columns });
      } else if (parsed.kind === 'INDEX') {
        indexes.push({ name: parsed.name, columns: parsed.columns, unique: false, type: parsed.indexType });
      } else if (parsed.kind === 'FOREIGN_KEY') {
        foreignKeys.push(parsed);
      }
    } else {
      const col = parseColumnDefinition(item);
      if (col) {
        if (col.isPrimaryKey) primaryKeys.push(col.name);
        if (col.isUnique) uniqueConstraints.push({ name: null, columns: [col.name] });
        if (col.inlineReferences.length > 0) {
          for (const ref of col.inlineReferences) {
            foreignKeys.push({
              kind: 'FOREIGN_KEY',
              name: ref.constraintName,
              sourceColumns: [col.name],
              targetSchema: ref.targetSchema,
              targetTable: ref.targetTable,
              targetColumns: ref.targetColumns,
              onDelete: ref.onDelete,
              onUpdate: ref.onUpdate,
            });
          }
        }
        delete col.inlineReferences;
        columns.push(col);
      }
    }
  }

  // Parse table tail options (e.g. COMMENT='...', ENGINE=InnoDB)
  let comment = null;
  let engine = null;
  for (let k = 0; k < tailTokens.length; k++) {
    if (isWord(tailTokens[k], 'COMMENT')) {
      let next = k + 1;
      if (isSym(tailTokens[next], '=')) next++;
      if (tailTokens[next] && tailTokens[next].type === TokenType.STRING) {
        comment = tailTokens[next].value;
      }
    }
    if (isWord(tailTokens[k], 'ENGINE')) {
      let next = k + 1;
      if (isSym(tailTokens[next], '=')) next++;
      if (tailTokens[next] && isIdent(tailTokens[next])) {
        engine = tailTokens[next].value;
      }
    }
  }

  return {
    schema: qname.schema || defaultSchema || null,
    name: qname.name,
    columns,
    primaryKeys: [...new Set(primaryKeys)],
    uniqueConstraints,
    indexes,
    foreignKeys,
    comment,
    engine,
    line: stmt[0].line,
    isExternal: false,
  };
}

/**
 * Parses ALTER TABLE statements (supports multiple comma-separated actions, ONLY, WITH CHECK, etc.)
 */
function parseAlterTable(stmt, defaultSchema) {
  let i = 2; // after ALTER TABLE
  if (isWord(stmt[i], 'IF') && isWord(stmt[i + 1], 'EXISTS')) i += 2;
  if (isWord(stmt[i], 'ONLY')) i++;

  const qname = readQualifiedName(stmt, i);
  if (!qname) return null;
  i = qname.nextPos;

  const actionsTokens = splitByTopLevelComma(stmt.slice(i));
  const actions = [];

  for (const act of actionsTokens) {
    let j = 0;
    // SQL Server: WITH CHECK / WITH NOCHECK
    if (isWord(act[j], 'WITH') && (isWord(act[j + 1], 'CHECK') || isWord(act[j + 1], 'NOCHECK'))) {
      j += 2;
    }

    if (isWord(act[j], 'ADD')) {
      j++;
      // ADD CONSTRAINT / PRIMARY KEY / FOREIGN KEY / UNIQUE / KEY / INDEX
      const rest = act.slice(j);
      if (rest.length === 0) continue;

      if (isTableLevelItem(rest)) {
        const parsed = parseTableConstraint(rest);
        if (parsed) actions.push(parsed);
        continue;
      }

      // ADD [COLUMN] [IF NOT EXISTS] col_def
      if (isWord(rest[0], 'COLUMN')) {
        let k = 1;
        if (isWord(rest[k], 'IF') && isWord(rest[k + 1], 'NOT') && isWord(rest[k + 2], 'EXISTS')) k += 3;
        const col = parseColumnDefinition(rest.slice(k));
        if (col) actions.push({ kind: 'ADD_COLUMN', column: col });
        continue;
      }

      // Bare ADD col_name col_type ...
      if (!isWord(rest[0], 'PARTITION') && !isWord(rest[0], 'CHECK')) {
        let k = 0;
        if (isWord(rest[k], 'IF') && isWord(rest[k + 1], 'NOT') && isWord(rest[k + 2], 'EXISTS')) k += 3;
        const col = parseColumnDefinition(rest.slice(k));
        if (col) actions.push({ kind: 'ADD_COLUMN', column: col });
      }
      continue;
    }

    // ALTER [COLUMN] col SET NOT NULL / DROP NOT NULL
    if (isWord(act[j], 'ALTER')) {
      j++;
      if (isWord(act[j], 'COLUMN')) j++;
      if (isIdent(act[j])) {
        const colName = act[j].value;
        j++;
        if (isWord(act[j], 'SET') && isWord(act[j + 1], 'NOT') && isWord(act[j + 2], 'NULL')) {
          actions.push({ kind: 'SET_NOT_NULL', columnName: colName, nullable: false });
        } else if (isWord(act[j], 'DROP') && isWord(act[j + 1], 'NOT') && isWord(act[j + 2], 'NULL')) {
          actions.push({ kind: 'SET_NOT_NULL', columnName: colName, nullable: true });
        }
      }
    }
  }

  return {
    schema: qname.schema || defaultSchema || null,
    tableName: qname.name,
    actions,
    line: stmt[0].line,
  };
}

/**
 * Parses CREATE [UNIQUE] INDEX ... ON [ONLY] [schema.]table (cols)
 */
function parseCreateIndex(stmt, defaultSchema) {
  let i = 1;
  let unique = false;
  while (i < stmt.length && !isWord(stmt[i], 'INDEX')) {
    if (isWord(stmt[i], 'UNIQUE')) unique = true;
    i++;
  }
  if (!isWord(stmt[i], 'INDEX')) return null;
  i++;

  if (isWord(stmt[i], 'CONCURRENTLY')) i++;
  if (isWord(stmt[i], 'IF') && isWord(stmt[i + 1], 'NOT') && isWord(stmt[i + 2], 'EXISTS')) i += 3;

  let indexName = null;
  if (!isWord(stmt[i], 'ON') && isIdent(stmt[i])) {
    const idxQ = readQualifiedName(stmt, i);
    if (idxQ) {
      indexName = idxQ.name;
      i = idxQ.nextPos;
    }
  }

  if (!isWord(stmt[i], 'ON')) return null;
  i++;
  if (isWord(stmt[i], 'ONLY')) i++;

  const target = readQualifiedName(stmt, i);
  if (!target) return null;
  i = target.nextPos;

  while (i < stmt.length && !isSym(stmt[i], '(')) i++;
  if (!isSym(stmt[i], '(')) return null;

  const { columns } = parseColumnList(stmt, i);
  return {
    schema: target.schema || defaultSchema || null,
    tableName: target.name,
    indexName,
    unique,
    columns,
  };
}

/**
 * Parses PostgreSQL CREATE TYPE [schema.]name AS ENUM ('a', 'b', ...)
 */
function parseCreateEnum(stmt, defaultSchema) {
  let i = 2; // after CREATE TYPE
  const qname = readQualifiedName(stmt, i);
  if (!qname) return null;
  i = qname.nextPos;
  if (!isWord(stmt[i], 'AS') || !isWord(stmt[i + 1], 'ENUM')) return null;
  i += 2;
  if (!isSym(stmt[i], '(')) return null;
  const closeIdx = findMatchingParen(stmt, i);
  const values = [];
  for (let k = i + 1; k < closeIdx; k++) {
    if (stmt[k].type === TokenType.STRING) values.push(stmt[k].value);
  }
  return {
    schema: qname.schema || defaultSchema || null,
    name: qname.name,
    values,
  };
}

/**
 * Parses PostgreSQL COMMENT ON TABLE / COMMENT ON COLUMN statements.
 */
function parseCommentOn(stmt) {
  if (!isWord(stmt[0], 'COMMENT') || !isWord(stmt[1], 'ON')) return null;
  const kind = stmt[2]?.upper;
  if (kind !== 'TABLE' && kind !== 'COLUMN') return null;

  const parts = [];
  let i = 3;
  while (i < stmt.length && isIdent(stmt[i])) {
    parts.push(stmt[i].value);
    i++;
    if (isSym(stmt[i], '.')) i++;
    else break;
  }

  if (!isWord(stmt[i], 'IS')) return null;
  i++;
  if (!stmt[i] || stmt[i].type !== TokenType.STRING) return null;

  return {
    kind,
    parts,
    text: stmt[i].value,
  };
}

/**
 * Detects probable SQL dialect from token clues.
 */
function detectDialect(rawSql, tokens) {
  let backticks = 0;
  let brackets = 0;
  let doubleQuotes = 0;
  for (const t of tokens) {
    if (t.type === TokenType.QUOTED_IDENT) {
      if (t.quote === '`') backticks++;
      else if (t.quote === '[') brackets++;
      else if (t.quote === '"') doubleQuotes++;
    }
  }
  const upper = rawSql.toUpperCase();
  if (backticks > 0 || upper.includes('ENGINE=INNODB') || upper.includes('AUTO_INCREMENT')) {
    return 'MySQL / MariaDB';
  }
  if (
    upper.includes('PG_CATALOG') ||
    upper.includes('SERIAL') ||
    upper.includes('JSONB') ||
    upper.includes('TIMESTAMPTZ') ||
    upper.includes('::') ||
    upper.includes('CREATE TYPE')
  ) {
    return 'PostgreSQL';
  }
  if (brackets > 0 || upper.includes('IDENTITY(') || upper.includes('NVARCHAR') || /\bGO\b/.test(upper)) {
    return 'SQL Server (T-SQL)';
  }
  if (upper.includes('AUTOINCREMENT') || upper.includes('PRAGMA ')) {
    return 'SQLite';
  }
  if (upper.includes('VARCHAR2') || upper.includes('NUMBER(') || upper.includes('SYSDATE')) {
    return 'Oracle';
  }
  if (doubleQuotes > 0) return 'PostgreSQL / ANSI SQL';
  return 'Standard SQL';
}

function makeTableId(schema, name) {
  return schema ? `${schema}.${name}` : name;
}

/**
 * Main Entry Point: Parses SQL text into a rich normalized ERD schema model.
 *
 * @param {string} rawSql
 * @param {object} [options]
 * @param {boolean} [options.inferRelations=false] Whether to also run heuristic relation inference
 * @param {boolean} [options.createExternalStubs=true] Create stub tables for referenced tables missing from SQL
 */
export function parseSqlToSchema(rawSql, options = {}) {
  const { inferRelations = false, createExternalStubs = true } = options;
  const tokens = tokenizeSql(rawSql || '');
  const statements = splitStatements(tokens);
  const dialect = detectDialect(rawSql || '', tokens);

  const tables = [];
  const tableLookup = new Map(); // lower-key -> table
  const pendingFks = [];
  const enums = [];
  const warnings = [];
  let defaultSchema = null;
  let skippedStatements = 0;

  const registerTable = (tbl) => {
    const id = makeTableId(tbl.schema, tbl.name);
    tbl.id = id;
    tables.push(tbl);
    tableLookup.set(id.toLowerCase(), tbl);
    if (!tableLookup.has(tbl.name.toLowerCase())) {
      tableLookup.set(tbl.name.toLowerCase(), tbl);
    }
    return tbl;
  };

  const findTable = (schema, name) => {
    if (schema) {
      const exact = tableLookup.get(`${schema}.${name}`.toLowerCase());
      if (exact) return exact;
    }
    if (defaultSchema) {
      const withDef = tableLookup.get(`${defaultSchema}.${name}`.toLowerCase());
      if (withDef) return withDef;
    }
    return tableLookup.get(name.toLowerCase()) || null;
  };

  const findColumn = (table, colName) => {
    const lower = colName.toLowerCase();
    return table.columns.find((c) => c.name.toLowerCase() === lower) || null;
  };

  // Pass 1: Process statements
  for (const stmt of statements) {
    if (!stmt || stmt.length === 0) continue;
    const first = stmt[0];

    // USE database;
    if (isWord(first, 'USE') && isIdent(stmt[1])) {
      defaultSchema = stmt[1].value;
      continue;
    }

    // CREATE ...
    if (isWord(first, 'CREATE')) {
      // CREATE TABLE
      const hasTable = stmt.slice(1, 5).some((t) => isWord(t, 'TABLE'));
      if (hasTable) {
        const parsed = parseCreateTable(stmt, defaultSchema);
        if (parsed) {
          // If duplicate table name appears, merge/replace gracefully
          const existing = findTable(parsed.schema, parsed.name);
          if (existing && !existing.isExternal) {
            warnings.push(`Duplicate table definition for "${parsed.name}" at line ${parsed.line}; kept latest definition.`);
            const idx = tables.indexOf(existing);
            if (idx !== -1) tables.splice(idx, 1);
          }
          const tbl = registerTable(parsed);
          for (const fk of tbl.foreignKeys) {
            pendingFks.push({
              sourceTableId: tbl.id,
              sourceSchema: tbl.schema,
              sourceTableName: tbl.name,
              ...fk,
            });
          }
          tbl.foreignKeys = [];
          continue;
        }
      }

      // CREATE [UNIQUE] INDEX
      const hasIndex = stmt.slice(1, 5).some((t) => isWord(t, 'INDEX'));
      if (hasIndex) {
        const idx = parseCreateIndex(stmt, defaultSchema);
        if (idx) {
          const tbl = findTable(idx.schema, idx.tableName);
          if (tbl) {
            tbl.indexes.push({
              name: idx.indexName,
              columns: idx.columns,
              unique: idx.unique,
              type: idx.unique ? 'UNIQUE' : 'INDEX',
            });
            if (idx.unique) {
              tbl.uniqueConstraints.push({ name: idx.indexName, columns: idx.columns });
            }
          }
          continue;
        }
      }

      // CREATE TYPE ... AS ENUM
      if (isWord(stmt[1], 'TYPE')) {
        const en = parseCreateEnum(stmt, defaultSchema);
        if (en) {
          enums.push(en);
          continue;
        }
      }

      skippedStatements++;
      continue;
    }

    // ALTER TABLE
    if (isWord(first, 'ALTER') && isWord(stmt[1], 'TABLE')) {
      const alter = parseAlterTable(stmt, defaultSchema);
      if (alter) {
        const tbl = findTable(alter.schema, alter.tableName);
        if (!tbl) {
          if (alter.actions.some((a) => a.kind === 'FOREIGN_KEY')) {
            warnings.push(`ALTER TABLE references unknown table "${alter.tableName}" (line ${alter.line}).`);
          }
          continue;
        }

        for (const act of alter.actions) {
          if (act.kind === 'PRIMARY_KEY') {
            for (const c of act.columns) {
              if (!tbl.primaryKeys.some((pk) => pk.toLowerCase() === c.toLowerCase())) {
                tbl.primaryKeys.push(c);
              }
            }
          } else if (act.kind === 'UNIQUE') {
            tbl.uniqueConstraints.push({ name: act.name, columns: act.columns });
          } else if (act.kind === 'INDEX') {
            tbl.indexes.push({ name: act.name, columns: act.columns, unique: false, type: act.indexType || 'INDEX' });
          } else if (act.kind === 'FOREIGN_KEY') {
            pendingFks.push({
              sourceTableId: tbl.id,
              sourceSchema: tbl.schema,
              sourceTableName: tbl.name,
              ...act,
            });
          } else if (act.kind === 'ADD_COLUMN') {
            const col = act.column;
            if (col.isPrimaryKey) tbl.primaryKeys.push(col.name);
            if (col.isUnique) tbl.uniqueConstraints.push({ name: null, columns: [col.name] });
            if (col.inlineReferences && col.inlineReferences.length > 0) {
              for (const ref of col.inlineReferences) {
                pendingFks.push({
                  sourceTableId: tbl.id,
                  sourceSchema: tbl.schema,
                  sourceTableName: tbl.name,
                  name: ref.constraintName,
                  sourceColumns: [col.name],
                  targetSchema: ref.targetSchema,
                  targetTable: ref.targetTable,
                  targetColumns: ref.targetColumns,
                  onDelete: ref.onDelete,
                  onUpdate: ref.onUpdate,
                });
              }
            }
            delete col.inlineReferences;
            if (!findColumn(tbl, col.name)) {
              tbl.columns.push(col);
            }
          } else if (act.kind === 'SET_NOT_NULL') {
            const col = findColumn(tbl, act.columnName);
            if (col) col.nullable = act.nullable;
          }
        }
        continue;
      }
    }

    // COMMENT ON TABLE / COLUMN (PostgreSQL)
    if (isWord(first, 'COMMENT') && isWord(stmt[1], 'ON')) {
      const cmt = parseCommentOn(stmt);
      if (cmt) {
        if (cmt.kind === 'TABLE') {
          const schema = cmt.parts.length > 1 ? cmt.parts[cmt.parts.length - 2] : null;
          const name = cmt.parts[cmt.parts.length - 1];
          const tbl = findTable(schema, name);
          if (tbl) tbl.comment = cmt.text;
        } else if (cmt.kind === 'COLUMN' && cmt.parts.length >= 2) {
          const colName = cmt.parts[cmt.parts.length - 1];
          const tblName = cmt.parts[cmt.parts.length - 2];
          const schema = cmt.parts.length >= 3 ? cmt.parts[cmt.parts.length - 3] : null;
          const tbl = findTable(schema, tblName);
          if (tbl) {
            const col = findColumn(tbl, colName);
            if (col) col.comment = cmt.text;
          }
        }
        continue;
      }
    }

    skippedStatements++;
  }

  // Pass 2: Apply PK and Unique flags to table columns
  for (const tbl of tables) {
    const pkSet = new Set(tbl.primaryKeys.map((c) => c.toLowerCase()));
    for (const col of tbl.columns) {
      if (pkSet.has(col.name.toLowerCase())) {
        col.isPrimaryKey = true;
        col.nullable = false;
      }
    }
    for (const uq of tbl.uniqueConstraints) {
      if (uq.columns.length === 1) {
        const col = findColumn(tbl, uq.columns[0]);
        if (col) col.isUnique = true;
      }
    }
  }

  // Pass 3: Resolve all explicit foreign keys into normalized relationship objects
  const relations = [];
  const seenRelKeys = new Set();

  for (const fk of pendingFks) {
    const sourceTable = findTable(fk.sourceSchema, fk.sourceTableName);
    if (!sourceTable) continue;

    let targetTable = findTable(fk.targetSchema, fk.targetTable);

    // If referenced table wasn't defined in SQL, optionally create an External stub table so the relation is still shown!
    if (!targetTable) {
      if (createExternalStubs) {
        const refCols = fk.targetColumns.length > 0 ? fk.targetColumns : ['id'];
        targetTable = registerTable({
          schema: fk.targetSchema || sourceTable.schema || null,
          name: fk.targetTable,
          columns: refCols.map((c) => ({
            name: c,
            type: 'EXTERNAL',
            nullable: false,
            isPrimaryKey: true,
            isForeignKey: false,
            isUnique: true,
            autoIncrement: false,
            defaultValue: null,
            comment: 'Referenced table not defined in SQL file',
          })),
          primaryKeys: [...refCols],
          uniqueConstraints: [],
          indexes: [],
          foreignKeys: [],
          comment: 'External reference (not defined in provided SQL)',
          engine: null,
          line: null,
          isExternal: true,
        });
        warnings.push(
          `Foreign key on "${sourceTable.id}" references "${fk.targetTable}", which is not defined in this SQL file. Added external stub table.`
        );
      } else {
        warnings.push(
          `Foreign key on "${sourceTable.id}" references missing table "${fk.targetTable}".`
        );
        continue;
      }
    }

    // Resolve target columns (default to target table's PK if omitted in SQL)
    let targetColumns = fk.targetColumns.length > 0 ? [...fk.targetColumns] : [...targetTable.primaryKeys];
    if (targetColumns.length === 0 && targetTable.columns.length > 0) {
      targetColumns = [targetTable.columns[0].name];
    }

    // Ensure stub table has referenced columns if multiple FKs point to different cols
    if (targetTable.isExternal) {
      for (const tc of targetColumns) {
        if (!findColumn(targetTable, tc)) {
          targetTable.columns.push({
            name: tc,
            type: 'EXTERNAL',
            nullable: false,
            isPrimaryKey: false,
            isForeignKey: false,
            isUnique: true,
            autoIncrement: false,
            defaultValue: null,
            comment: null,
          });
        }
      }
    }

    // Match source column casing to actual column definitions
    const resolvedSourceCols = fk.sourceColumns.map((c) => findColumn(sourceTable, c)?.name || c);
    const resolvedTargetCols = targetColumns.map((c) => findColumn(targetTable, c)?.name || c);

    // Deduplicate identical FK constraints
    const dedupeKey = `${sourceTable.id.toLowerCase()}(${resolvedSourceCols.join(',').toLowerCase()})->${targetTable.id.toLowerCase()}(${resolvedTargetCols.join(',').toLowerCase()})`;
    if (seenRelKeys.has(dedupeKey)) continue;
    seenRelKeys.add(dedupeKey);

    // Mark source columns as FKs
    for (let k = 0; k < resolvedSourceCols.length; k++) {
      const scol = findColumn(sourceTable, resolvedSourceCols[k]);
      if (scol) {
        scol.isForeignKey = true;
        scol.references = {
          tableId: targetTable.id,
          tableName: targetTable.name,
          column: resolvedTargetCols[k] || resolvedTargetCols[0] || 'id',
        };
      }
    }

    // Determine cardinality:
    // If sourceColumns is unique (exact match with PK or any UNIQUE constraint), it's 1:1; otherwise N:1 (child many -> parent one)
    const srcLowerSet = resolvedSourceCols.map((c) => c.toLowerCase()).sort().join(',');
    const pkLowerSet = sourceTable.primaryKeys.map((c) => c.toLowerCase()).sort().join(',');
    const isSourceUnique =
      (pkLowerSet.length > 0 && srcLowerSet === pkLowerSet) ||
      sourceTable.uniqueConstraints.some(
        (uq) => uq.columns.map((c) => c.toLowerCase()).sort().join(',') === srcLowerSet
      );

    // Optionality: if any source FK column is nullable, the relationship to parent is optional (0..1)
    const isSourceNullable = resolvedSourceCols.some((c) => {
      const col = findColumn(sourceTable, c);
      return col ? col.nullable : false;
    });

    const isSelfReference = sourceTable.id === targetTable.id;
    const cardinality = isSourceUnique ? '1:1' : 'N:1';

    relations.push({
      id: `rel_${relations.length + 1}`,
      name: fk.name || `fk_${sourceTable.name}_${resolvedSourceCols.join('_')}`,
      sourceTableId: sourceTable.id,
      sourceColumns: resolvedSourceCols,
      targetTableId: targetTable.id,
      targetColumns: resolvedTargetCols,
      cardinality, // from source (child) to target (parent): '1:1' or 'N:1'
      sourceEnd: isSourceUnique ? (isSourceNullable ? '0..1' : '1') : '0..N',
      targetEnd: isSourceNullable ? '0..1' : '1',
      onDelete: fk.onDelete || null,
      onUpdate: fk.onUpdate || null,
      isSelfReference,
      isComposite: resolvedSourceCols.length > 1,
      inferred: false,
    });
  }

  // Pass 4: Optionally infer implicit relations (useful for SQL dumps without FOREIGN KEY constraints)
  let inferredRelations = [];
  if (inferRelations) {
    inferredRelations = inferImplicitRelations(tables, relations);
  }

  // Pass 5: Detect junction / many-to-many join tables & collect schema list
  const schemasSet = new Set();
  for (const tbl of tables) {
    if (tbl.schema) schemasSet.add(tbl.schema);
    const outgoingTables = new Set(
      relations
        .filter((r) => r.sourceTableId === tbl.id && !r.isSelfReference)
        .map((r) => r.targetTableId)
    );
    const pkCols = tbl.columns.filter((c) => c.isPrimaryKey);
    const allPkAreFk = pkCols.length >= 2 && pkCols.every((c) => c.isForeignKey);
    const fkCount = tbl.columns.filter((c) => c.isForeignKey).length;
    tbl.isJunctionTable = allPkAreFk || (outgoingTables.size >= 2 && tbl.columns.length <= fkCount + 3);
  }

  const allRelations = [...relations, ...inferredRelations];

  return {
    dialect,
    tables,
    relations: allRelations,
    explicitRelationCount: relations.length,
    inferredRelationCount: inferredRelations.length,
    enums,
    schemas: [...schemasSet],
    warnings,
    stats: {
      tableCount: tables.filter((t) => !t.isExternal).length,
      externalTableCount: tables.filter((t) => t.isExternal).length,
      columnCount: tables.reduce((acc, t) => acc + t.columns.length, 0),
      relationCount: allRelations.length,
      explicitRelationCount: relations.length,
      inferredRelationCount: inferredRelations.length,
      enumCount: enums.length,
      skippedStatements,
    },
  };
}
