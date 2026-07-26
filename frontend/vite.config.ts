import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    // Backend serves this directory directly in the single-host production setup
    // (see backend/src/app.ts) and the local `npm run build && npm start` sanity check.
    outDir: '../backend/public',
    emptyOutDir: true,
  },
});
