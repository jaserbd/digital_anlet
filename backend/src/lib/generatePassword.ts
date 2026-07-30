import { randomBytes } from 'node:crypto';

// One-time temporary password for admin-created accounts that don't specify their own
// (bulk CSV upload — OVERVIEW.md item 4). base64url keeps it URL/CSV-safe and free of
// characters that are easy to mis-copy (no +/=).
export function generatePassword(): string {
  return randomBytes(9).toString('base64url');
}
