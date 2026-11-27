#!/usr/bin/env node
/**
 * Offline SQL-to-ERD CLI Tool
 * Usage:
 *   node bin/sql2erd.mjs <input.sql> [options]
 *
 * Options:
 *   -o, --out <file>         Output file path (prints to stdout if omitted)
 *   -f, --format <fmt>       svg | mermaid | dbml | json | markdown (default: svg)
 *   -l, --layout <algo>      hierarchical | clustered | grid (default: hierarchical)
 *   -t, --theme <theme>      dark | light (default: light)
 *   -d, --detail <mode>      full | keys | compact (default: full)
 *   -e, --edges <style>      orthogonal | curved (default: orthogonal)
 *       --infer              Also infer implicit FK relations from column names
 *       --labels             Show cardinality labels on all edges
 *   -h, --help               Show help
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseSqlToSchema } from '../src/parser/sqlParser.js';
import { computeErdLayout } from '../src/layout/erdLayout.js';
import {
  exportSvg,
  exportMermaid,
  exportDbml,
  exportJson,
  exportMarkdownDocs,
} from '../src/export/exporters.js';

function printHelp() {
  console.log(`SQL-to-ERD Offline CLI

Usage:
  node bin/sql2erd.mjs <input.sql> [options]

Options:
  -o, --out <file>         Write output to file (defaults to stdout)
  -f, --format <fmt>       svg | mermaid | dbml | json | markdown (default: svg)
  -l, --layout <algo>      hierarchical | clustered | grid (default: hierarchical)
  -t, --theme <theme>      dark | light (default: light)
  -d, --detail <mode>      full | keys | compact (default: full)
  -e, --edges <style>      orthogonal | curved (default: orthogonal)
      --infer              Infer implicit FK relations from *_id column names
      --labels             Show cardinality labels on all edges
  -h, --help               Show this help message
`);
}

function parseArgs(argv) {
  const opts = {
    input: null,
    out: null,
    format: 'svg',
    layout: 'hierarchical',
    theme: 'light',
    detail: 'full',
    edges: 'orthogonal',
    infer: false,
    labels: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-o' || arg === '--out') opts.out = argv[++i];
    else if (arg === '-f' || arg === '--format') opts.format = (argv[++i] || 'svg').toLowerCase();
    else if (arg === '-l' || arg === '--layout') opts.layout = (argv[++i] || 'hierarchical').toLowerCase();
    else if (arg === '-t' || arg === '--theme') opts.theme = (argv[++i] || 'light').toLowerCase();
    else if (arg === '-d' || arg === '--detail') opts.detail = (argv[++i] || 'full').toLowerCase();
    else if (arg === '-e' || arg === '--edges') opts.edges = (argv[++i] || 'orthogonal').toLowerCase();
    else if (arg === '--infer') opts.infer = true;
    else if (arg === '--labels') opts.labels = true;
    else if (!arg.startsWith('-') && !opts.input) opts.input = arg;
  }

  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || !opts.input) {
  printHelp();
  process.exit(opts.help ? 0 : 1);
}

const inputPath = path.resolve(opts.input);
if (!fs.existsSync(inputPath)) {
  console.error(`Error: SQL file not found: ${inputPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(inputPath, 'utf8');
const schema = parseSqlToSchema(sql, { inferRelations: opts.infer });
const layout = computeErdLayout(schema, {
  algorithm: opts.layout,
  detailMode: opts.detail,
  showTypes: true,
});

let output = '';
switch (opts.format) {
  case 'svg':
    output = exportSvg(schema, layout, {
      theme: opts.theme,
      detailMode: opts.detail,
      edgeStyle: opts.edges,
      showEdgeLabels: opts.labels,
      includeGrid: true,
    });
    break;
  case 'mermaid':
  case 'mmd':
    output = exportMermaid(schema);
    break;
  case 'dbml':
    output = exportDbml(schema);
    break;
  case 'json':
    output = exportJson(schema, layout);
    break;
  case 'markdown':
  case 'md':
    output = exportMarkdownDocs(schema);
    break;
  default:
    console.error(`Error: Unknown format "${opts.format}". Expected svg, mermaid, dbml, json, or markdown.`);
    process.exit(1);
}

if (opts.out) {
  const outPath = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, 'utf8');
  console.error(
    `Converted ${path.basename(inputPath)} (${schema.dialect}): ${schema.stats.tableCount} tables, ${schema.stats.relationCount} relations -> ${outPath}`
  );
} else {
  process.stdout.write(output);
}
