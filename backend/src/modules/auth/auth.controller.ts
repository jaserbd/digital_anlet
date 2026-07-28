import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { parseDurationMs } from '../../lib/duration';
import { AUTH_COOKIE_NAME } from '../../middleware/auth';
import {
  OpCoNotInOrganizationError,
  UserNotFoundError,
  updateOwnProfile,
} from '../users/users.service';
import { InvalidCredentialsError, getAuthenticatedUser, login } from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  opCoId: z.string().min(1),
  workingDomain: z.string().trim().min(1).max(200),
  designation: z.string().trim().min(1).max(200),
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

export async function meHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await getAuthenticatedUser(req.user.sub);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(user);
}

export async function updateProfileHandler(req: Request, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    await updateOwnProfile(req.user!.sub, parsed.data);
    res.status(204).end();
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (err instanceof OpCoNotInOrganizationError) {
      res.status(400).json({ error: 'Selected OpCo does not belong to your organization' });
      return;
    }
    throw err;
  }
}
