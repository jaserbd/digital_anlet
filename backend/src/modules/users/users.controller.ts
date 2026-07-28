import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  CannotModifyAdminError,
  EmailTakenError,
  OpCoNotInOrganizationError,
  OrganizationNotFoundError,
  UserNotFoundError,
  createUser,
  listUsers,
  updateUser,
} from './users.service';

// Admin can only assign Executive/Normal-User roles here — Admin accounts are
// seed-time bootstrap only (see prisma/seed/seed.ts), not created via this API.
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['NORMAL_USER', 'EXECUTIVE']),
  organizationId: z.string().min(1),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
});

export async function createUserHandler(req: Request, res: Response) {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const user = await createUser(parsed.data);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof EmailTakenError) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    if (err instanceof OrganizationNotFoundError) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }
    throw err;
  }
}

export async function listUsersHandler(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
  const users = await listUsers({ organizationId });
  res.json(users);
}

const updateUserSchema = z.object({
  organizationId: z.string().min(1).optional(),
  opCoId: z.string().min(1).nullable().optional(),
});

export async function updateUserHandler(req: Request, res: Response) {
  const userId = req.params.id;
  if (typeof userId !== 'string') {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  try {
    const user = await updateUser(userId, parsed.data);
    res.json(user);
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (err instanceof CannotModifyAdminError) {
      res.status(403).json({ error: 'Admin accounts cannot be reassigned' });
      return;
    }
    if (err instanceof OrganizationNotFoundError) {
      res.status(400).json({ error: 'Organization not found' });
      return;
    }
    if (err instanceof OpCoNotInOrganizationError) {
      res.status(400).json({ error: 'OpCo does not belong to the target organization' });
      return;
    }
    throw err;
  }
}
