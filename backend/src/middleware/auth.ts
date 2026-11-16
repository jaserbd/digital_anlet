import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type JwtPayload } from '../lib/jwt';
import { resolveRequestUser } from '../lib/userContext';

export const AUTH_COOKIE_NAME = 'anlet_token';

// What someone signed in with a one-time password may still call: see who they are, switch
// context, and set their own password. Everything else waits (the React router sends them to
// /change-password anyway — this makes the API agree, so a temporary password alone is not a
// working credential).
const OPEN_WHILE_PASSWORD_CHANGE_REQUIRED = new Set(['/api/auth/me', '/api/auth/context', '/api/auth/change-password']);

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

  resolveRequestUser(payload.sub, payload.membershipId ?? null, payload.iat)
    .then((user) => {
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
      }
      if (user.mustChangePassword && !OPEN_WHILE_PASSWORD_CHANGE_REQUIRED.has(req.originalUrl.split('?')[0]!.replace(/\/$/, ''))) {
        res.status(403).json({ error: 'Set your own password first', code: 'PASSWORD_CHANGE_REQUIRED' });
        return;
      }
      req.user = user;
      next();
    })
    .catch(next);
}
