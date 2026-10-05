import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Identity plus the chosen working context only (MULTI_ORG_PLAN.md) — role and organization
// are re-resolved from the database on every request (see lib/userContext.ts), so they're no
// longer trusted from the token.
export interface JwtPayload {
  sub: string;
  email: string;
  // Active membership; null = admin context (or the user's default context).
  membershipId: string | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
