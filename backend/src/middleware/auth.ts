import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type JwtPayload } from '../lib/jwt';
import { resolveRequestUser } from '../lib/userContext';

export const AUTH_COOKIE_NAME = 'anlet_token';

// Verifies the session cookie, then resolves the caller's active context from the database
// (lib/userContext.ts) — so req.user.role/organizationId always reflect current memberships and
// roles, never a stale token. Tokens issued before multi-organization memberships (no
// membershipId) simply get the default context.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  resolveRequestUser(payload.sub, payload.membershipId ?? null)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }
      req.user = user;
      next();
    })
    .catch(next);
}
