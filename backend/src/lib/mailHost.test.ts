import { describe, expect, it } from 'vitest';
import { MailHostNotAllowedError, assertPublicMailHost, isInternalAddress } from './mailHost';

const resolvesTo = (...addresses: string[]) => async () => addresses.map((address) => ({ address }));

describe('assertPublicMailHost', () => {
  it('accepts a public mail server on a mail port', async () => {
    await expect(assertPublicMailHost('smtp.example.com', 587, resolvesTo('142.250.102.108'))).resolves.toBeUndefined();
    await expect(assertPublicMailHost('8.8.8.8', 465)).resolves.toBeUndefined();
  });

  it('refuses other ports', async () => {
    await expect(assertPublicMailHost('smtp.example.com', 5432, resolvesTo('142.250.102.108'))).rejects.toBeInstanceOf(MailHostNotAllowedError);
  });

  it('refuses internal, loopback and metadata addresses — typed or behind a name', async () => {
    for (const host of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '169.254.169.254', '::1', '[::1]', '::ffff:10.0.0.1', 'fd00::1']) {
      await expect(assertPublicMailHost(host, 587), host).rejects.toBeInstanceOf(MailHostNotAllowedError);
    }
    await expect(assertPublicMailHost('metadata.internal', 587, resolvesTo('169.254.169.254'))).rejects.toBeInstanceOf(MailHostNotAllowedError);
    // One internal address among several is enough to refuse.
    await expect(assertPublicMailHost('mixed.example', 587, resolvesTo('8.8.8.8', '10.0.0.5'))).rejects.toBeInstanceOf(MailHostNotAllowedError);
  });

  it('refuses a name that does not resolve', async () => {
    const fails = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertPublicMailHost('nope.invalid', 587, fails)).rejects.toBeInstanceOf(MailHostNotAllowedError);
  });

  it('classifies addresses', () => {
    expect(isInternalAddress('8.8.8.8')).toBe(false);
    expect(isInternalAddress('2a00:1450:4001::6c')).toBe(false);
    expect(isInternalAddress('172.20.1.1')).toBe(true);
    expect(isInternalAddress('not-an-ip')).toBe(true);
  });
});
