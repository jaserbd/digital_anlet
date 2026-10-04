import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  CannotChangeOwnRoleError,
  CannotModifyAdminError,
  EmailTakenError,
  SuperAdminRequiredError,
  OpCoNotInOrganizationError,
  OrganizationNotFoundError,
  UserHasResponsesError,
  UserNotFoundError,
  createUser,
  createUsersBulk,
  deleteUser,
  listUsers,
  updateUser,
} from './users.service';

// Any admin may create Executive/Normal-User accounts; only the super admin may create an
// ADMIN (enforced by createUser — ADMIN_MANAGEMENT_PLAN.md).
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['NORMAL_USER', 'EXECUTIVE', 'ADMIN']),
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
    const user = await createUser(parsed.data, req.user!.sub);
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof SuperAdminRequiredError) {
      res.status(403).json({ error: 'Only the super admin can create admin accounts' });
      return;
    }
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

const bulkCreateUsersSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().email(),
        role: z.enum(['NORMAL_USER', 'EXECUTIVE']),
        organization: z.string().trim().min(1),
        password: z.string().min(8).optional(),
      }),
    )
    .min(1),
});

export async function bulkCreateUsersHandler(req: Request, res: Response) {
  const parsed = bulkCreateUsersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const results = await createUsersBulk(parsed.data.rows);
  res.status(201).json(results);
}

export async function listUsersHandler(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
  const users = await listUsers({ organizationId });
  res.json(users);
}

const updateUserSchema = z.object({
  organizationId: z.string().min(1).optional(),
  opCoId: z.string().min(1).nullable().optional(),
  role: z.enum(['NORMAL_USER', 'EXECUTIVE', 'ADMIN']).optional(),
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
    const user = await updateUser(req.user!.sub, userId, parsed.data);
    res.json(user);
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (err instanceof CannotModifyAdminError) {
      res.status(403).json({ error: 'The super admin account cannot be changed' });
      return;
    }
    if (err instanceof SuperAdminRequiredError) {
      res.status(403).json({ error: 'Only the super admin can grant, remove or change admin accounts' });
      return;
    }
    if (err instanceof CannotChangeOwnRoleError) {
      res.status(400).json({ error: 'You cannot change your own role' });
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

export async function deleteUserHandler(req: Request, res: Response) {
  const userId = req.params.id;
  if (typeof userId !== 'string') {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }

  try {
    await deleteUser(req.user!.sub, userId);
    res.status(204).end();
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (err instanceof CannotModifyAdminError) {
      res.status(403).json({ error: 'This account cannot be deleted' });
      return;
    }
    if (err instanceof SuperAdminRequiredError) {
      res.status(403).json({ error: 'Only the super admin can delete admin accounts' });
      return;
    }
    if (err instanceof UserHasResponsesError) {
      res.status(409).json({ error: 'Cannot delete a user who has questionnaire response history' });
      return;
    }
    throw err;
  }
}
