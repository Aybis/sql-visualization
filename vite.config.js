import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite + React + Tailwind CSS v4 + shadcn/ui configured for 100% offline usage:
 * - `npm run dev` runs local React + Tailwind HMR
 * - `npm run build` outputs a single self-contained `dist/index.html` via vite-plugin-singlefile
 *   that runs directly via file:// with ZERO internet and ZERO server required.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
