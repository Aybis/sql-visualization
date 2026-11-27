import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseSqlToSchema } from '../src/parser/sqlParser.js';
import { computeErdLayout } from '../src/layout/erdLayout.js';
import {
  exportSvg,
  exportMermaid,
  exportDbml,
  exportJson,
  exportMarkdownDocs,
} from '../src/export/exporters.js';
import { SAMPLE_PRESETS } from '../src/samples/presets.js';

test('exports valid SVG, Mermaid, DBML, Markdown, and JSON offline', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.saas_postgres.sql);
  const layout = computeErdLayout(schema, { algorithm: 'hierarchical' });

  const svg = exportSvg(schema, layout, { theme: 'light', showEdgeLabels: true });
  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('<svg '));
  assert.ok(svg.includes('organizations'));
  assert.ok(svg.includes('subscriptions'));
  assert.ok(svg.includes('erd-edge'));

  const mermaid = exportMermaid(schema);
  assert.ok(mermaid.startsWith('erDiagram'));
  assert.ok(mermaid.includes('workspace_organizations'));
  assert.ok(mermaid.includes('billing_subscriptions'));

  const dbml = exportDbml(schema);
  assert.ok(dbml.includes('Enum billing.plan_tier'));
  assert.ok(dbml.includes('Table auth.accounts'));
  assert.ok(dbml.includes('Ref: billing.subscriptions.organization_id - workspace.organizations.id'));

  const md = exportMarkdownDocs(schema);
  assert.ok(md.includes('# Database Schema & Relationships'));
  assert.ok(md.includes('| `billing.invoices` |'));

  const json = JSON.parse(exportJson(schema, layout));
  assert.equal(json.tables.length, 8);
  assert.equal(json.relations.length, 13);
  assert.ok(json.layout['auth.accounts']);
});

test('CLI converts a real SQL file to SVG and Mermaid cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql2erd-test-'));
  const inSql = path.join(tmpDir, 'sample.sql');
  const outSvg = path.join(tmpDir, 'out.svg');
  const outMmd = path.join(tmpDir, 'out.mmd');

  fs.writeFileSync(inSql, SAMPLE_PRESETS.ecommerce_mysql.sql, 'utf8');

  execFileSync('node', ['bin/sql2erd.mjs', inSql, '-o', outSvg, '--theme', 'dark'], {
    cwd: process.cwd(),
  });
  execFileSync('node', ['bin/sql2erd.mjs', inSql, '-f', 'mermaid', '-o', outMmd], {
    cwd: process.cwd(),
  });

  const svgText = fs.readFileSync(outSvg, 'utf8');
  const mmdText = fs.readFileSync(outMmd, 'utf8');

  assert.ok(svgText.includes('<svg '));
  assert.ok(svgText.includes('order_items'));
  assert.ok(mmdText.startsWith('erDiagram'));
  assert.ok(mmdText.includes('order_items'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('single-file offline bundle builds with valid JS syntax and zero external CDN references', () => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: process.cwd() });
  const distHtml = fs.readFileSync(path.join(process.cwd(), 'dist/sql-to-erd.html'), 'utf8');

  // Verify no external scripts/stylesheets/fonts (100% offline guarantee)
  assert.equal(/<script[^>]+src=/.test(distHtml), false, 'Should not load any external script');
  assert.equal(/<link[^>]+href=["']https?:\/\//.test(distHtml), false, 'Should not load any external CSS/fonts');

  // Extract inline script and verify JS syntax compiles cleanly
  const match = distHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match && match[1].length > 10000, 'Expected substantial inline JS bundle');
  assert.doesNotThrow(() => new Function(match[1]), 'Bundled JS should have zero syntax errors');
});
