// Loads backend/.env from the current working directory. Every entrypoint (`tsx watch`
// via `npm run dev -w backend`, and `node dist/server.js` via the backend's own `start`
// script) runs with CWD = backend/, so dotenv's default CWD-relative lookup just works.
// In Docker/Cloud Run there's no .env file and env vars are injected directly — dotenv
// silently no-ops when the file is missing.
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
});

export const env = envSchema.parse(process.env);
