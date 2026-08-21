import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The site is a pile of static assets on Pages: no server rendering, no Pages Functions.
// Everything it shows is public and comes from /api/v1, which keeps the API the one back
// end and the front end cacheable all the way to the edge.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
});
