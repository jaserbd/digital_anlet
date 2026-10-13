import type { Request, Response } from 'express';
import { z } from 'zod';
import { isProjectAdmin } from '../../lib/projectAccess';
import {
  AlreadyMemberError,
  CannotChangeOwnRoleError,
  CannotModifyAdminError,
  EmailTakenError,
  MembershipHasResponsesError,
  MembershipNotFoundError,
  SuperAdminRequiredError,
  OrganizationNotFoundError,
  OutsideProjectError,
  UserHasResponsesError,
  UserNotFoundError,
  addMembership,
  assertProjectAdminMayAssign,
  assertProjectAdminMayManageMembership,
  assertProjectAdminMayManageUser,
  createUser,
  deleteUser,
  listUsers,
  removeMembership,
  setTemporaryPassword,
  updateMembership,
  updateUser,
} from './users.service';

// Project Admins (PROJECTS_PLAN.md) reach this router too, scoped to the organization of their
// active membership: the scope id below is passed to / checked against every service call.
function projectAdminScope(req: Request): string | undefined {
  return isProjectAdmin(req.user!) ? req.user!.organizationId : undefined;
}

// Any admin may create Executive/Normal-User accounts; only the super admin may create an
// ADMIN (enforced by createUser — ADMIN_MANAGEMENT_PLAN.md). PROJECT_ADMIN = a Project Admin
// membership in the given organization (Application Admins only).
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['NORMAL_USER', 'EXECUTIVE', 'ADMIN', 'PROJECT_ADMIN']),
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
    const result = await createUser(parsed.data, req.user!.sub, projectAdminScope(req));
    res.status(result.status === 'created' ? 201 : 200).json(result);
  } catch (err) {
    if (err instanceof OutsideProjectError) {
      res.status(403).json({ error: 'Project Admins can only add Executives and Normal Users to their own organization' });
      return;
    }
    if (err instanceof SuperAdminRequiredError) {
      res.status(403).json({ error: 'Only the super admin can create admin accounts' });
      return;
    }
    if (err instanceof EmailTakenError) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    if (err instanceof AlreadyMemberError) {
      res.status(409).json({ error: 'This user is already a member of that organization' });
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
  const projectAdminOrganizationId = projectAdminScope(req);
  const users = await listUsers(
    projectAdminOrganizationId ? { projectAdminOrganizationId } : { organizationId },
  );
  res.json(users);
}

const updateUserSchema = z.object({
  // Global role only: grant ('ADMIN') or remove ('NORMAL_USER') Admin.
  role: z.enum(['NORMAL_USER', 'ADMIN']).optional(),
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

function requireUserId(req: Request, res: Response): string | null {
  const userId = req.params.id;
  if (typeof userId !== 'string') {
    res.status(400).json({ error: 'Invalid user id' });
    return null;
  }
  return userId;
}

// Shared error mapping for the membership + temporary-password routes below.
function handleUserAdminErrors(err: unknown, res: Response): boolean {
  if (err instanceof OutsideProjectError) {
    res.status(403).json({ error: 'Outside your project — Project Admins manage Executives and Normal Users of their own organization only' });
    return true;
  }
  if (err instanceof UserNotFoundError || err instanceof MembershipNotFoundError) {
    res.status(404).json({ error: 'Not found' });
    return true;
  }
  if (err instanceof OrganizationNotFoundError) {
    res.status(400).json({ error: 'Organization not found' });
    return true;
  }
  if (err instanceof AlreadyMemberError) {
    res.status(409).json({ error: 'This user is already a member of that organization' });
    return true;
  }
  if (err instanceof MembershipHasResponsesError) {
    res.status(409).json({ error: 'This membership has questionnaire responses and cannot be removed' });
    return true;
  }
  if (err instanceof SuperAdminRequiredError) {
    res.status(403).json({ error: 'Only the super admin can change another admin account' });
    return true;
  }
  if (err instanceof CannotModifyAdminError) {
    res.status(403).json({ error: 'This account cannot be changed here' });
    return true;
  }
  return false;
}

const membershipRoleSchema = z.enum(['NORMAL_USER', 'EXECUTIVE', 'PROJECT_ADMIN']);
const addMembershipSchema = z.object({ organizationId: z.string().min(1), role: membershipRoleSchema });
const updateMembershipSchema = z.object({ role: membershipRoleSchema });

export async function addMembershipHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = addMembershipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    const scope = projectAdminScope(req);
    if (scope) assertProjectAdminMayAssign(scope, parsed.data.organizationId, parsed.data.role);
    res.status(201).json(await addMembership(req.user!.sub, userId, parsed.data));
  } catch (err) {
    if (!handleUserAdminErrors(err, res)) throw err;
  }
}

export async function updateMembershipHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = updateMembershipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  try {
    const membershipId = String(req.params.membershipId);
    const scope = projectAdminScope(req);
    if (scope) {
      await assertProjectAdminMayManageMembership(scope, membershipId);
      assertProjectAdminMayAssign(scope, scope, parsed.data.role);
    }
    res.json(await updateMembership(req.user!.sub, userId, membershipId, parsed.data));
  } catch (err) {
    if (!handleUserAdminErrors(err, res)) throw err;
  }
}

export async function removeMembershipHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const membershipId = String(req.params.membershipId);
    const scope = projectAdminScope(req);
    if (scope) await assertProjectAdminMayManageMembership(scope, membershipId);
    res.json(await removeMembership(req.user!.sub, userId, membershipId));
  } catch (err) {
    if (!handleUserAdminErrors(err, res)) throw err;
  }
}

export async function setTemporaryPasswordHandler(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const scope = projectAdminScope(req);
    if (scope) await assertProjectAdminMayManageUser(scope, userId);
    const temporaryPassword = await setTemporaryPassword(req.user!.sub, userId);
    res.json({ temporaryPassword });
  } catch (err) {
    if (!handleUserAdminErrors(err, res)) throw err;
  }
}
