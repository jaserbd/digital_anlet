import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt';

export const AUTH_COOKIE_NAME = 'anlet_token';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}
