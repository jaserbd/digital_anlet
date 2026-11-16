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
  // Reverse proxies in front of the app (Cloud Run's front end, Vite's dev proxy): how many
  // X-Forwarded-For hops to trust, so rate limiting sees the real client address.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  COOKIE_SECURE: booleanString.default(true),
  // Seed-time bootstrap admin account (idempotent upsert, see prisma/seed/seed.ts).
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  // Password-reset email delivery (OVERVIEW.md item 12) — a plain SMTP relay (see
  // lib/mailer.ts) rather than a vendor-specific SDK, so any provider works.
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  SMTP_FROM: z.string().email(),
  // Display name of the sender (ONBOARDING_SECURITY_PLAN.md Phase 2).
  SMTP_FROM_NAME: z.string().min(1).default('ANLET'),
  // Off unless explicitly "true": dev, CI and a production without real SMTP credentials only
  // log instead of attempting to send (lib/mailer.ts).
  MAIL_ENABLED: booleanString.default(false),
  // 32 random bytes, base64 — encrypts the mailbox password saved in the Management Console
  // (lib/secretBox.ts, ONBOARDING_SECURITY_PLAN.md Phase 2b). Without it the settings are read-only.
  MAIL_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64-encoded')
    .optional(),
  // The frontend's own origin, used to build the emailed reset link — the backend can't
  // infer this from its own request in dev (backend :4000, frontend :5173 behind Vite's
  // proxy); in production single-host deploy this is just the app's own URL.
  APP_BASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);

/** A production server must never sign sessions with a short or placeholder secret. Called at
 * server start only — the seed scripts load this file with a dummy JWT_SECRET they never use. */
export function assertProductionSecrets(): void {
  if (env.NODE_ENV === 'production' && (env.JWT_SECRET.length < 32 || /change-me/i.test(env.JWT_SECRET))) {
    throw new Error('JWT_SECRET must be at least 32 characters and not a placeholder in production');
  }
}
