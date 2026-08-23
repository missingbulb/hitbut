import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The operator dashboard: static assets on GitHub Pages, separate from the product site.
// `base` is relative so the same build works at a user site (`/`) and at a project site
// (`/hitbut/`), which is where Pages puts it — an absolute base would 404 every asset.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
});
