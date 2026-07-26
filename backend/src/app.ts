import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Frontend build output is written to backend/public (see frontend/vite.config.ts outDir).
// Relative to this file: src/app.ts during dev (public doesn't exist, skipped) or dist/app.js in
// the built/Docker image, where '../public' resolves to backend/public.
const publicDir = path.resolve(dirname, '../public');

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Single-host: serve the built React app for everything else, once it exists.
  // Absent during local `tsx watch` dev (Vite serves the frontend on its own port instead).
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
