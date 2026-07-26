import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it('parses days, hours, minutes, and seconds', () => {
    expect(parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDurationMs('12h')).toBe(12 * 60 * 60 * 1000);
    expect(parseDurationMs('30m')).toBe(30 * 60 * 1000);
    expect(parseDurationMs('45s')).toBe(45 * 1000);
  });

  it('treats a bare number as seconds', () => {
    expect(parseDurationMs('90')).toBe(90 * 1000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationMs('not-a-duration')).toThrow();
  });
});
