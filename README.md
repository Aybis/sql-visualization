# SQL to ERD — 100% Offline React + Vite + Tailwind + shadcn/ui Studio

Convert any `.sql` schema or database dump file into a crisp, interactive **Entity-Relationship Diagram (ERD)** — built with **React 19, Vite, Tailwind CSS v4, and shadcn/ui (Radix UI + Lucide)** and running **100% offline** from file import all the way to diagram visualization and export.

> **Zero internet required at runtime:** Every step (reading your `.sql` file, parsing tables & foreign keys, laying out the graph, rendering Crow's Foot relationships, and exporting SVG/PNG/Mermaid/DBML/Markdown/JSON) runs completely locally inside your browser — no external server, no database connection, and no CDN calls.

## Quick Start

### 1. Double-Click Standalone Offline App (No Server & No Internet Needed)
Open [`dist/index.html`](./dist/index.html) directly in Chrome, Safari, Edge, or Firefox (built with `vite-plugin-singlefile` so React + CSS + JS are all inlined in one file).

### 2. Development Mode (React + Vite HMR)
```bash
npm install
npm run dev
# Opens at http://127.0.0.1:5173
```

### 3. Build Single-File Offline Bundle
```bash
npm run build
# Outputs self-contained dist/index.html
npm run preview
# Serves dist/ locally at http://127.0.0.1:4173
```

### 4. Offline Command-Line Tool (CLI)
```bash
node bin/sql2erd.mjs samples/ecommerce_mysql.sql -o erd.svg
node bin/sql2erd.mjs samples/saas_postgres.sql --format mermaid -o erd.mmd
node bin/sql2erd.mjs samples/saas_postgres.sql --format dbml -o schema.dbml
node bin/sql2erd.mjs samples/saas_postgres.sql --format markdown -o docs.md
node bin/sql2erd.mjs samples/legacy_no_fks_mysql.sql --infer --theme dark -o erd.svg
```

## Supported SQL Dialects

- **MySQL / MariaDB** (`mysqldump`, backticks, `ENGINE=InnoDB`, `COMMENT`, `/*!40101 ... */`, inline & multi-action `ALTER TABLE`)
- **PostgreSQL** (`pg_dump`, multi-schema `schema.table`, `COPY ... FROM stdin` auto-skipping, `ALTER TABLE ONLY`, `CREATE TYPE ... AS ENUM`, `COMMENT ON TABLE/COLUMN`)
- **SQLite** (inline `REFERENCES`, `AUTOINCREMENT`, composite `PRIMARY KEY`)
- **SQL Server (T-SQL)** (`[dbo].[Table]`, `GO` batches, `IDENTITY(1,1)`, `WITH CHECK ADD CONSTRAINT`)
- **Oracle & Standard ANSI SQL** (`VARCHAR2`, `NUMBER`, quoted identifiers, composite FKs)

## Testing

```bash
npm test
```
