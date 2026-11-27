#!/usr/bin/env node
/**
 * Zero-Dependency Local Offline HTTP Server for SQL-to-ERD Studio
 * Serves src/ on http://127.0.0.1:4173 (or PORT env var).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.sql': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/offline') {
    const distFile = path.join(rootDir, 'dist', 'sql-to-erd.html');
    fs.readFile(distFile, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Run npm run build first.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  let relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const fullPath = path.resolve(srcDir, relPath);

  // Prevent directory traversal outside srcDir
  if (!fullPath.startsWith(srcDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`SQL-to-ERD Offline Studio running at http://${host}:${port}`);
  console.log('Press Ctrl+C to stop.');
});
