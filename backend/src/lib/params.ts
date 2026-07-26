import type { Request } from 'express';

/** Express types route params as `string | string[]`; route definitions here never use
 * repeated param names, so this narrows to the single-value case (or throws). */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw new Error(`Missing or invalid route param "${name}"`);
  }
  return value;
}
