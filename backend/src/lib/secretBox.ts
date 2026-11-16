import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM for secrets the app has to read back in clear text (the mailbox password of
// MailSettings — ONBOARDING_SECURITY_PLAN.md Phase 2b), unlike user passwords, which are hashed.
// Format "v1:<iv>:<auth tag>:<ciphertext>", base64 parts. The 32-byte key comes from
// MAIL_ENCRYPTION_KEY (base64), so a database copy alone never reveals the secret.

export class SecretBoxError extends Error {}

const VERSION = 'v1';

export function parseKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new SecretBoxError('Encryption key must be 32 bytes (base64)');
  return key;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(sealed: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new SecretBoxError('Unrecognized encrypted value');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key or tampered value — GCM's authentication fails.
    throw new SecretBoxError('Could not decrypt (wrong key or tampered value)');
  }
}
