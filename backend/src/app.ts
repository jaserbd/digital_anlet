import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes/index';
import { errorHandler } from './middleware/errorHandler';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Frontend build output is written to backend/public (see frontend/vite.config.ts outDir).
// Relative to this file: src/app.ts during dev (public doesn't exist, skipped) or dist/app.js in
// the built/Docker image, where '../public' resolves to backend/public.
const publicDir = path.resolve(dirname, '../public');

export function createApp() {
  const app = express();

  // Behind Cloud Run's front end (and Vite's proxy in dev): req.ip is the client's address
  // rather than the proxy's, which the sign-in rate limits key on (auth.routes.ts).
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  // Security headers (ONBOARDING_SECURITY_PLAN.md Phase 6). Everything is same-origin: scripts
  // only from our own build; inline styles for MUI's emotion; data:/blob: images for chart
  // capture and PDF export; no framing by other sites (clickjacking).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Dev runs on plain http://localhost; production is https-only already.
          upgradeInsecureRequests: null,
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Only meaningful over https; the header is ignored on http://localhost.
      strictTransportSecurity: { maxAge: 31536000, includeSubDomains: false },
    }),
  );

  app.use(express.json({ limit: '2mb' })); // project Excel imports can carry a few thousand rows
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', apiRouter);

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

  app.use(errorHandler);

  return app;
}
