import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { parseDurationMs } from '../../lib/duration';
import { AUTH_COOKIE_NAME } from '../../middleware/auth';
import {
  DesignationNotInCatalogError,
  NoActiveMembershipError,
  OpCoNotInOrganizationError,
  OpCoRequiredError,
  UserNotFoundError,
  WorkingDomainNotInCatalogError,
  updateOwnProfile,
} from '../users/users.service';
import {
  InvalidContextError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  changeOwnPassword,
  switchContext,
  getAuthenticatedUser,
  login,
  requestPasswordReset,
  resetPassword,
} from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
  // Optional here regardless of role — updateOwnProfile enforces it's still required for a
  // NORMAL_USER (an Executive may skip it, MANAGEMENT_REVIEW2.md item 2).
  opCoId: z.string().min(1).optional(),
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
  const user = await getAuthenticatedUser(req.user);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(user);
}

const switchContextSchema = z.object({ membershipId: z.string().min(1).nullable() });

export async function switchContextHandler(req: Request, res: Response) {
  const parsed = switchContextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    const token = await switchContext(req.user!, parsed.data.membershipId);
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions);
    res.status(204).end();
  } catch (err) {
    if (err instanceof InvalidContextError) {
      res.status(403).json({ error: 'You do not have access to that organization' });
      return;
    }
    throw err;
  }
}

export async function changePasswordHandler(req: Request, res: Response) {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    await changeOwnPassword(req.user!.sub, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).end();
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
}

export async function forgotPasswordHandler(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  // Always 204, regardless of whether the email is registered — see requestPasswordReset's
  // own doc comment for why (no user-enumeration signal).
  await requestPasswordReset(parsed.data.email);
  res.status(204).end();
}

export async function resetPasswordHandler(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.newPassword);
    res.status(204).end();
  } catch (err) {
    if (err instanceof InvalidResetTokenError) {
      res.status(400).json({ error: 'This reset link is invalid or has expired' });
      return;
    }
    throw err;
  }
}

export async function updateProfileHandler(req: Request, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    await updateOwnProfile(req.user!, parsed.data);
    res.status(204).end();
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (err instanceof NoActiveMembershipError) {
      res.status(400).json({ error: 'Switch to an organization to complete its profile' });
      return;
    }
    if (err instanceof OpCoNotInOrganizationError) {
      res.status(400).json({ error: 'Selected OpCo does not belong to your organization' });
      return;
    }
    if (err instanceof OpCoRequiredError) {
      res.status(400).json({ error: 'OpCo is required' });
      return;
    }
    if (err instanceof WorkingDomainNotInCatalogError) {
      res.status(400).json({ error: 'Working Domain must be selected from the list' });
      return;
    }
    if (err instanceof DesignationNotInCatalogError) {
      res.status(400).json({ error: 'Designation must be selected from the list' });
      return;
    }
    throw err;
  }
}
