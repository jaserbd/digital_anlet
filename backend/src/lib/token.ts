import { createHash, randomBytes } from 'node:crypto';

// Password-reset tokens (OVERVIEW.md item 12) — the random token is only ever shown once, in
// the emailed link; only its hash is persisted (SHA-256 is fine here, unlike password hashing,
// since the token itself is already high-entropy random data, not low-entropy user input).
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
