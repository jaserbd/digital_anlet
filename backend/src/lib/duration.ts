const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses durations like "7d", "12h", "30m", "45s", or a bare number of seconds. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${value}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * (unit ? UNIT_MS[unit]! : 1000);
}
