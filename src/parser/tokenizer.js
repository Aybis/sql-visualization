/**
 * Multi-dialect SQL Tokenizer (MySQL, PostgreSQL, SQLite, SQL Server, Oracle)
 * Handles comments, MySQL conditional comments, PostgreSQL dollar-quoted strings,
 * COPY ... FROM stdin blocks, quoted identifiers (`...`, "...", [...]), and operators.
 */

export const TokenType = Object.freeze({
  WORD: 'WORD',
  QUOTED_IDENT: 'QUOTED_IDENT',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  SYMBOL: 'SYMBOL',
  EOF: 'EOF',
});

/**
 * Strip PostgreSQL COPY ... FROM stdin; data blocks before tokenizing so large dumps
 * with inline TSV rows don't pollute the token stream or break trailing ALTER TABLEs.
 */
export function stripPostgresCopyData(sql) {
  // Matches COPY [schema.]table (...) FROM stdin; followed by lines up to \.
  const lines = sql.split(/\r?\n/);
  const out = [];
  let inCopy = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCopy) {
      out.push(''); // preserve line numbers
      if (line === '\\.' || line.trim() === '\\.') {
        inCopy = false;
      }
      continue;
    }

    if (/^\s*COPY\s+.+\s+FROM\s+stdin\s*;\s*$/i.test(line)) {
      inCopy = true;
      out.push(''); // preserve line numbers
      continue;
    }

    out.push(line);
  }
  return out.join('\n');
}

/**
 * Tokenizes raw SQL DDL text into a flat token array with line/column metadata.
 */
export function tokenizeSql(rawSql) {
  const sql = stripPostgresCopyData(rawSql || '');
  const tokens = [];
  const len = sql.length;
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = (count = 1) => {
    for (let k = 0; k < count && i < len; k++) {
      if (sql[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f' || ch === '\v') {
      advance(1);
      continue;
    }

    // Single-line comment: -- ...
    if (ch === '-' && next === '-') {
      while (i < len && sql[i] !== '\n') advance(1);
      continue;
    }

    // MySQL single-line comment: # ...
    if (ch === '#') {
      while (i < len && sql[i] !== '\n') advance(1);
      continue;
    }

    // Block comment: /* ... */ (supports nested comments & MySQL conditional /*!40101 ... */)
    if (ch === '/' && next === '*') {
      // Skip block comments completely (including MySQL /*!40101 SET ... */ directives)
      advance(2);
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') {
          depth++;
          advance(2);
        } else if (sql[i] === '*' && sql[i + 1] === '/') {
          depth--;
          advance(2);
        } else {
          advance(1);
        }
      }
      continue;
    }

    const startLine = line;
    const startCol = col;

    // PostgreSQL dollar-quoted string: $$...$$ or $tag$...$tag$
    if (ch === '$') {
      const rest = sql.slice(i);
      const tagMatch = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        advance(tag.length);
        const startContent = i;
        const closeIdx = sql.indexOf(tag, i);
        if (closeIdx === -1) {
          const val = sql.slice(startContent);
          advance(len - i);
          tokens.push({ type: TokenType.STRING, value: val, raw: tag + val, line: startLine, col: startCol });
        } else {
          const val = sql.slice(startContent, closeIdx);
          advance(closeIdx - i + tag.length);
          tokens.push({ type: TokenType.STRING, value: val, raw: tag + val + tag, line: startLine, col: startCol });
        }
        continue;
      }
    }

    // Single-quoted string (supports '' escaping and \' backslash escaping)
    // Also supports PostgreSQL E'...' and N'...' (SQL Server)
    if (
      ch === "'" ||
      ((ch === 'N' || ch === 'n' || ch === 'E' || ch === 'e' || ch === 'B' || ch === 'b' || ch === 'X' || ch === 'x') &&
        next === "'")
    ) {
      let prefix = '';
      if (ch !== "'") {
        prefix = ch;
        advance(1);
      }
      advance(1); // opening '
      let val = '';
      while (i < len) {
        const c = sql[i];
        if (c === '\\' && i + 1 < len) {
          val += sql[i + 1];
          advance(2);
        } else if (c === "'" && sql[i + 1] === "'") {
          val += "'";
          advance(2);
        } else if (c === "'") {
          advance(1);
          break;
        } else {
          val += c;
          advance(1);
        }
      }
      tokens.push({ type: TokenType.STRING, value: val, raw: `${prefix}'${val}'`, line: startLine, col: startCol });
      continue;
    }

    // Backtick-quoted identifier (MySQL): `table_name`
    if (ch === '`') {
      advance(1);
      let val = '';
      while (i < len) {
        if (sql[i] === '`' && sql[i + 1] === '`') {
          val += '`';
          advance(2);
        } else if (sql[i] === '`') {
          advance(1);
          break;
        } else {
          val += sql[i];
          advance(1);
        }
      }
      tokens.push({ type: TokenType.QUOTED_IDENT, value: val, quote: '`', line: startLine, col: startCol });
      continue;
    }

    // Double-quoted identifier (PostgreSQL / ANSI / Oracle / SQLite): "table_name"
    if (ch === '"') {
      advance(1);
      let val = '';
      while (i < len) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          val += '"';
          advance(2);
        } else if (sql[i] === '"') {
          advance(1);
          break;
        } else {
          val += sql[i];
          advance(1);
        }
      }
      tokens.push({ type: TokenType.QUOTED_IDENT, value: val, quote: '"', line: startLine, col: startCol });
      continue;
    }

    // Bracket-quoted identifier (SQL Server / T-SQL / SQLite): [table_name]
    // Distinguish from PostgreSQL array brackets [] (which are empty or after a type/word immediately with ])
    if (ch === '[') {
      // If immediately followed by ']', treat as array brackets symbols
      if (next === ']') {
        advance(2);
        tokens.push({ type: TokenType.SYMBOL, value: '[]', line: startLine, col: startCol });
        continue;
      }
      const closeBracket = sql.indexOf(']', i + 1);
      const nextNewline = sql.indexOf('\n', i + 1);
      if (closeBracket !== -1 && (nextNewline === -1 || closeBracket < nextNewline)) {
        const inner = sql.slice(i + 1, closeBracket);
        // If inner looks like an identifier (not purely digits unless bracketed ident), treat as quoted ident
        if (inner.length > 0 && !/^\d+$/.test(inner)) {
          advance(closeBracket - i + 1);
          tokens.push({ type: TokenType.QUOTED_IDENT, value: inner, quote: '[', line: startLine, col: startCol });
          continue;
        }
      }
    }

    // Number literal
    if ((ch >= '0' && ch <= '9') || (ch === '.' && next >= '0' && next <= '9')) {
      let num = '';
      while (i < len && ((sql[i] >= '0' && sql[i] <= '9') || sql[i] === '.' || sql[i] === 'e' || sql[i] === 'E')) {
        num += sql[i];
        advance(1);
      }
      tokens.push({ type: TokenType.NUMBER, value: num, line: startLine, col: startCol });
      continue;
    }

    // Word / unquoted identifier / keyword
    if (/[A-Za-z_\u00C0-\u024F]/.test(ch)) {
      let word = '';
      while (i < len && /[A-Za-z0-9_$\u00C0-\u024F]/.test(sql[i])) {
        word += sql[i];
        advance(1);
      }
      tokens.push({
        type: TokenType.WORD,
        value: word,
        upper: word.toUpperCase(),
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // Two-character symbols (::, <>, !=, <=, >=, ->, ->>)
    if (
      (ch === ':' && next === ':') ||
      (ch === '<' && (next === '>' || next === '=')) ||
      (ch === '>' && next === '=') ||
      (ch === '!' && next === '=') ||
      (ch === '-' && next === '>') ||
      (ch === '|' && next === '|')
    ) {
      const sym = ch + next;
      advance(2);
      tokens.push({ type: TokenType.SYMBOL, value: sym, line: startLine, col: startCol });
      continue;
    }

    // Single-character symbol
    advance(1);
    tokens.push({ type: TokenType.SYMBOL, value: ch, line: startLine, col: startCol });
  }

  tokens.push({ type: TokenType.EOF, value: '', line, col });
  return tokens;
}

/**
 * Splits a flat token stream into SQL statements separated by ';' or T-SQL 'GO' batch dividers.
 * Respects parentheses depth so semicolons inside sub-blocks (e.g. triggers) don't break structure.
 */
export function splitStatements(tokens) {
  const statements = [];
  let current = [];
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === TokenType.EOF) break;

    if (t.type === TokenType.SYMBOL && t.value === '(') {
      parenDepth++;
      current.push(t);
      continue;
    }
    if (t.type === TokenType.SYMBOL && t.value === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current.push(t);
      continue;
    }

    // Semicolon at top level ends statement
    if (t.type === TokenType.SYMBOL && t.value === ';' && parenDepth === 0) {
      if (current.length > 0) {
        statements.push(current);
        current = [];
      }
      continue;
    }

    // T-SQL GO batch separator on its own line at top level
    if (
      t.type === TokenType.WORD &&
      t.upper === 'GO' &&
      parenDepth === 0 &&
      (current.length === 0 || current[current.length - 1].line !== t.line) &&
      (i + 1 >= tokens.length || tokens[i + 1].type === TokenType.EOF || tokens[i + 1].line !== t.line)
    ) {
      if (current.length > 0) {
        statements.push(current);
        current = [];
      }
      continue;
    }

    current.push(t);
  }

  if (current.length > 0) {
    statements.push(current);
  }

  return statements;
}
