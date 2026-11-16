import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretBoxError, decryptSecret, encryptSecret, parseKey } from './secretBox';

const key = randomBytes(32);

describe('secretBox', () => {
  it('round-trips, with a fresh IV every time', () => {
    const a = encryptSecret('abcd efgh ijkl mnop', key);
    const b = encryptSecret('abcd efgh ijkl mnop', key);
    expect(a).not.toBe(b);
    expect(a).not.toContain('abcd');
    expect(decryptSecret(a, key)).toBe('abcd efgh ijkl mnop');
  });

  it('refuses a wrong key or a tampered value', () => {
    const sealed = encryptSecret('secret', key);
    expect(() => decryptSecret(sealed, randomBytes(32))).toThrow(SecretBoxError);
    const [v, iv, tag, ct] = sealed.split(':');
    const flipped = Buffer.from(ct!, 'base64');
    flipped[0]! ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64')].join(':'), key)).toThrow(SecretBoxError);
    expect(() => decryptSecret('garbage', key)).toThrow(SecretBoxError);
  });

  it('accepts only 32-byte base64 keys', () => {
    expect(parseKey(key.toString('base64')).equals(key)).toBe(true);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow(SecretBoxError);
  });
});
