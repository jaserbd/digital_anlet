import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { parseDurationMs } from '../../lib/duration';
import { AUTH_COOKIE_NAME } from '../../middleware/auth';
import { InvalidCredentialsError, login } from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: parseDurationMs(env.JWT_EXPIRES_IN),
};

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const token = await login(parsed.data.email, parsed.data.password);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.status(204).end();
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    throw err;
  }
}

export function logoutHandler(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.status(204).end();
}

export function meHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({
    id: req.user.sub,
    email: req.user.email,
    role: req.user.role,
    organizationId: req.user.organizationId,
  });
}
