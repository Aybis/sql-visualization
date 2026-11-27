# SQL to ERD — 100% Offline Database Diagram Studio

Convert any `.sql` schema or database dump file into a crisp, interactive **Entity-Relationship Diagram (ERD)** — running **100% offline** with zero internet access, zero external CDNs, and zero required dependencies.

## Quick Start (3 Ways to Run Offline)

### 1. Double-Click Standalone Offline App (No Server Needed)
Open [`dist/sql-to-erd.html`](./dist/sql-to-erd.html) directly in Chrome, Safari, Edge, or Firefox.
Drop any `.sql` file anywhere on the window to visualize all tables and relationships instantly.

### 2. Local Web Server
```bash
npm start
# Opens at http://127.0.0.1:4173
```

### 3. Offline Command-Line Tool (CLI)
```bash
# Convert SQL file directly to an SVG ERD diagram
node bin/sql2erd.mjs samples/ecommerce_mysql.sql -o erd.svg

# Export to Mermaid, DBML, Markdown documentation, or JSON
node bin/sql2erd.mjs samples/saas_postgres.sql --format mermaid -o erd.mmd
node bin/sql2erd.mjs samples/saas_postgres.sql --format dbml -o schema.dbml
node bin/sql2erd.mjs samples/saas_postgres.sql --format markdown -o docs.md
node bin/sql2erd.mjs samples/saas_postgres.sql --format json -o schema.json

# Include inferred implicit foreign keys (for SQL files lacking FOREIGN KEY constraints)
node bin/sql2erd.mjs legacy_schema.sql --infer --theme dark --layout hierarchical -o erd.svg
```

## Supported SQL Dialects & Features

- **MySQL / MariaDB** (`mysqldump` files, backticks, `ENGINE=InnoDB`, `COMMENT`, conditional comments `/*!40101 ... */`, inline & `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`, multi-action `ALTER TABLE`)
- **PostgreSQL** (`pg_dump` files, multi-schema `schema.table`, `COPY ... FROM stdin; ... \.` auto-skipping, `ALTER TABLE ONLY ... ADD CONSTRAINT`, `CREATE TYPE ... AS ENUM`, `COMMENT ON TABLE/COLUMN`, `SERIAL/BIGSERIAL`, `TIMESTAMPTZ`, array types)
- **SQLite** (inline `REFERENCES`, `AUTOINCREMENT`, composite `PRIMARY KEY`, `PRAGMA`)
- **SQL Server (T-SQL)** (`[dbo].[Table]`, `GO` batch separators, `IDENTITY(1,1)`, `WITH CHECK ADD CONSTRAINT`, `PRIMARY KEY CLUSTERED`)
- **Oracle & Standard ANSI SQL** (`VARCHAR2`, `NUMBER`, quoted identifiers, composite FKs)

## Interactive Features

- **Crow's Foot (IE) Notation**: Accurate `1:1`, `N:1`, mandatory (`||`), optional (`o|`), and many (`o<`) markers with exact column-to-column port routing.
- **Smart Auto-Layouts**: Switch between **Hierarchical** (parent → child relationship flow), **Clustered** (organic force-directed), and **Grid** (schema/alphabetical).
- **Interactive Exploration**:
  - Drag tables freely (with optional grid snap) while relationship connectors update live.
  - Hover or click any table or relationship line to highlight connected neighbors and open the **Inspector**.
  - **Double-click any table** to enter **Focus Mode** (isolate 1-hop or 2-hop related tables in huge schemas).
  - Live **Search** (`Cmd/Ctrl + K`), schema filter chips, table visibility toggles, and interactive **Minimap**.
  - **Infer FKs** toggle detects implicit `*_id` / `*Id` relations when legacy SQL dumps omit explicit foreign keys (drawn clearly as dashed amber lines).
  - **Live SQL Editor** (`E`) to paste or tweak SQL and see the ERD update in real time.
- **100% Offline Exports**:
  - **SVG** vector diagram, **PNG (2x HD)** raster image, **Mermaid `erDiagram`**, **DBML**, **Markdown Data Dictionary**, **JSON**, and **Workspace Save/Restore (`.erd.json`)**.

## Development & Testing

```bash
# Run automated test suite (tokenizer, multi-dialect parser, layout, exporters, CLI)
npm test

# Rebuild single-file offline HTML bundle (dist/sql-to-erd.html)
npm run build
```
