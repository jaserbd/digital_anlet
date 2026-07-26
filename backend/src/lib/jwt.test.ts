import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import { signToken, verifyToken, type JwtPayload } from './jwt';

const payload: JwtPayload = {
  sub: 'user-1',
  email: 'user@example.com',
  role: 'NORMAL_USER',
  organizationId: 'org-1',
};

describe('jwt', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signToken(payload);
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('rejects an expired token', () => {
    const expiredToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: -10 });
    expect(() => verifyToken(expiredToken)).toThrow(jwt.TokenExpiredError);
  });

  it('rejects a token signed with a different secret', () => {
    const tokenFromElsewhere = jwt.sign(payload, 'a-different-secret');
    expect(() => verifyToken(tokenFromElsewhere)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow(jwt.JsonWebTokenError);
  });
});
