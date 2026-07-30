import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Binds to 0.0.0.0 (not just localhost) so other devices on the same LAN can reach the
    // dev server, e.g. http://<this-machine's-LAN-IP>:5173 — Vite prints that URL on start.
    host: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  optimizeDeps: {
    // jsPDF's ESM build dynamically imports these optional plugins (canvas/SVG embedding)
    // that we never install or use (we only use jsPDF for text + jspdf-autotable) — without
    // this exclusion, Vite's dependency pre-bundling scanner tries to eagerly resolve them
    // and the dev server fails to start entirely.
    exclude: ['html2canvas', 'canvg', 'dompurify'],
  },
  build: {
    // Backend serves this directory directly in the single-host production setup
    // (see backend/src/app.ts) and the local `npm run build && npm start` sanity check.
    outDir: '../backend/public',
    emptyOutDir: true,
  },
});
