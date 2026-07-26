// Loads backend/.env from the current working directory. Every entrypoint (`tsx watch`
// via `npm run dev -w backend`, and `node dist/server.js` via the backend's own `start`
// script) runs with CWD = backend/, so dotenv's default CWD-relative lookup just works.
// In Docker/Cloud Run there's no .env file and env vars are injected directly — dotenv
// silently no-ops when the file is missing.
import 'dotenv/config';
import { z } from 'zod';

// z.coerce.boolean() uses JS `Boolean(value)`, which treats any non-empty string
// (including the literal "false") as true — not what we want for a "false"/"true" env var.
const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: booleanString.default('true'),
  // Seed-time bootstrap admin account (idempotent upsert, see prisma/seed/seed.ts).
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
});

export const env = envSchema.parse(process.env);
