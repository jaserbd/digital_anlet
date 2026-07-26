import jwt from 'jsonwebtoken';
import type { Role } from '@anlet/shared';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  organizationId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
