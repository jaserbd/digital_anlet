import type { Request, Response } from 'express';
import { z } from 'zod';
import { projectAdminScopeOf } from '../../lib/projectAccess';
import {
  AlreadyMemberError,
  CannotChangeOwnRoleError,
  CannotModifyAdminError,
  EmailTakenError,
  MembershipHasResponsesError,
  MembershipNotFoundError,
  SuperAdminRequiredError,
  OrganizationNotFoundError,
  OrganizationNotInProjectError,
  OtherOrganizationError,
  SeveralMembershipsError,
  StaysInOrganizationError,
  OutsideProjectError,
  ProjectAdminMembershipError,
  ProjectRequiredError,
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

// Project Admins (PROJECTS_PLAN.md) reach this router too, scoped to the organization + project of
// their active membership: the scope below is passed to / checked against every service call.
function projectAdminScope(req: Request) {
  return projectAdminScopeOf(req.user!);
}

// Any admin may create Executive/Normal-User accounts; only the super admin may create an
// ADMIN (enforced by createUser — ADMIN_MANAGEMENT_PLAN.md). Project Admins are added per project
// (projects module), not here. `projectId` places the membership in one of the organization's
// projects (PROJECTS_V2_PLAN.md).
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['NORMAL_USER', 'EXECUTIVE', 'ADMIN']),
  organizationId: z.string().min(1),
  projectId: z.string().min(1).nullable().optional(),
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
      res.status(403).json({ error: 'Project Admins can only add Executives and Normal Users to their own organization and project' });
      return;
    }
    if (handlePlacementErrors(err, res)) return;
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
  const scope = projectAdminScope(req);
  const users = await listUsers(scope ? { projectAdminScope: scope } : { organizationId });
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
function handlePlacementErrors(err: unknown, res: Response): boolean {
  if (err instanceof ProjectRequiredError) {
    res.status(400).json({ error: 'This organization takes part in projects — choose one of its projects' });
    return true;
  }
  if (err instanceof OrganizationNotInProjectError) {
    res.status(400).json({ error: 'The organization is not part of that project' });
    return true;
  }
  // One organization per user (USERS_PER_ORGANIZATION_PLAN.md).
  if (err instanceof OtherOrganizationError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  if (err instanceof StaysInOrganizationError) {
    res.status(409).json({ error: 'Application Admins and Project Admins stay in their own organization' });
    return true;
  }
  if (err instanceof SeveralMembershipsError) {
    res.status(409).json({
      error: 'This user takes part in several projects — remove the other memberships before moving them to another organization',
    });
    return true;
  }
  return false;
}

function handleUserAdminErrors(err: unknown, res: Response): boolean {
  if (err instanceof OutsideProjectError) {
    res.status(403).json({ error: 'Outside your project — Project Admins manage Executives and Normal Users of their own organization and project only' });
    return true;
  }
  if (err instanceof ProjectAdminMembershipError) {
    res.status(400).json({ error: 'Project Admins are added and removed on the project' });
    return true;
  }
  if (handlePlacementErrors(err, res)) return true;
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

const membershipRoleSchema = z.enum(['NORMAL_USER', 'EXECUTIVE']);
const projectIdSchema = z.string().min(1).nullable().optional();
const addMembershipSchema = z.object({
  organizationId: z.string().min(1),
  projectId: projectIdSchema,
  role: membershipRoleSchema,
});
// `organizationId` moves the membership (and its answers) to another organization —
// Application Admins only (USERS_TABLE_PLAN.md).
const updateMembershipSchema = z
  .object({ role: membershipRoleSchema.optional(), organizationId: z.string().min(1).optional(), projectId: projectIdSchema })
  .refine((v) => v.role !== undefined || v.organizationId !== undefined || v.projectId !== undefined);

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
    if (scope) {
      assertProjectAdminMayAssign(
        scope,
        { organizationId: parsed.data.organizationId, projectId: parsed.data.projectId ?? null },
        parsed.data.role,
      );
    }
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
      if (parsed.data.role) assertProjectAdminMayAssign(scope, scope, parsed.data.role);
      // Moving people between organizations/projects is for Application Admins.
      if (parsed.data.organizationId !== undefined || parsed.data.projectId !== undefined) throw new OutsideProjectError();
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
