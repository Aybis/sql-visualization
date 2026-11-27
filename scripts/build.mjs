#!/usr/bin/env node
/**
 * Zero-Dependency Offline Single-File Bundler
 * Bundles src/index.html + src/styles/app.css + all ES modules into a single
 * self-contained dist/sql-to-erd.html that runs directly via file:// with ZERO
 * internet connection, ZERO server, and ZERO external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

// Topological module order (dependencies first)
const MODULE_ORDER = [
  'parser/tokenizer.js',
  'parser/relationInferrer.js',
  'parser/sqlParser.js',
  'layout/erdLayout.js',
  'renderer/svgRenderer.js',
  'renderer/viewport.js',
  'export/exporters.js',
  'samples/presets.js',
  'ui/app.js',
];

function stripModuleSyntax(code) {
  // Remove single-line and multi-line import statements
  let out = code.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  // Convert `export const|let|var|function|async function|class` -> declaration
  out = out.replace(/^\s*export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '');
  // Remove any bare `export { ... };`
  out = out.replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');
  return out.trim();
}

function build() {
  const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(srcDir, 'styles/app.css'), 'utf8');

  const bundleChunks = [];
  for (const relPath of MODULE_ORDER) {
    const absPath = path.join(srcDir, relPath);
    const raw = fs.readFileSync(absPath, 'utf8');
    bundleChunks.push(`/* === ${relPath} === */\n${stripModuleSyntax(raw)}`);
  }

  // Escape closing script tags if any exist in string literals
  const jsBundle = `(function () {\n'use strict';\n\n${bundleChunks.join('\n\n')}\n\n})();`.replace(
    /<\/script>/gi,
    '<\\/script>'
  );

  // Inline CSS and JS into HTML (use function replacer so `$'` / `$$` in source code are never expanded!)
  let outHtml = html.replace(
    /<link\s+rel="stylesheet"\s+href="\.\/styles\/app\.css"\s*\/?>/,
    () => `<style>\n${css}\n</style>`
  );
  outHtml = outHtml.replace(
    /<script\s+type="module"\s+src="\.\/ui\/app\.js"><\/script>/,
    () => `<script>\n${jsBundle}\n</script>`
  );

  fs.mkdirSync(distDir, { recursive: true });
  const outPath = path.join(distDir, 'sql-to-erd.html');
  fs.writeFileSync(outPath, outHtml, 'utf8');

  const sizeKb = (Buffer.byteLength(outHtml, 'utf8') / 1024).toFixed(1);
  console.log(`Built 100% offline single-file app: ${outPath} (${sizeKb} KB)`);
}

build();
