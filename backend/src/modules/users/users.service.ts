import type { Role } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';

export class EmailTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class UserNotFoundError extends Error {}
export class OpCoNotInOrganizationError extends Error {}
export class CannotModifyAdminError extends Error {}

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  organizationId: true,
  firstName: true,
  lastName: true,
  opCoId: true,
  workingDomain: true,
  designation: true,
} as const;

export interface CreateUserInput {
  email: string;
  password: string;
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

export async function createUser(input: CreateUserInput) {
  const [existingUser, organization] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.organization.findUnique({ where: { id: input.organizationId } }),
  ]);

  if (existingUser) {
    throw new EmailTakenError();
  }
  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
    },
    select: USER_SELECT,
  });
}

/**
 * Admin-only: list existing users, optionally scoped to one organization (used by
 * AdminPage's "reassign existing user" table — SECOND_REVIEW.md item 8). Never returns
 * ADMIN-role accounts — those are seed-time bootstrap only, not admin-manageable.
 */
export async function listUsers(filter?: { organizationId?: string }) {
  return prisma.user.findMany({
    where: {
      role: { not: 'ADMIN' },
      ...(filter?.organizationId ? { organizationId: filter.organizationId } : {}),
    },
    orderBy: { email: 'asc' },
    select: USER_SELECT,
  });
}

export interface UpdateUserInput {
  organizationId?: string;
  // Explicit null clears the OpCo; undefined leaves it untouched (unless organizationId
  // changes, which always clears it — an OpCo belongs to a specific organization).
  opCoId?: string | null;
}

/**
 * Admin-only: reassign an existing Executive/Normal-User account's Organization (and
 * optionally OpCo) — SECOND_REVIEW.md item 8 ("assign existing users to an Organization").
 * Changing organizationId always clears opCoId (the old OpCo belongs to the old org) unless
 * a new opCoId — already validated against the new org — is given in the same call; this
 * naturally re-triggers ProtectedRoute's profile-completion redirect for a NORMAL_USER.
 */
export async function updateUser(userId: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }
  if (user.role === 'ADMIN') {
    throw new CannotModifyAdminError();
  }

  const targetOrganizationId = input.organizationId ?? user.organizationId;
  if (input.organizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization) {
      throw new OrganizationNotFoundError();
    }
  }

  let opCoId: string | null | undefined = input.organizationId ? null : undefined;
  if (input.opCoId !== undefined) {
    if (input.opCoId === null) {
      opCoId = null;
    } else {
      const opCo = await prisma.opCo.findUnique({ where: { id: input.opCoId } });
      if (!opCo || opCo.organizationId !== targetOrganizationId) {
        throw new OpCoNotInOrganizationError();
      }
      opCoId = input.opCoId;
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(opCoId !== undefined ? { opCoId } : {}),
    },
    select: USER_SELECT,
  });
}

/**
 * Self-service profile completion (see ProfilePage.tsx) — a NORMAL_USER picks their OpCo
 * (which encodes Country + Company) from a dropdown scoped to their own Organization, plus
 * free-text Working Domain and Designation. Not an Admin action.
 */
export async function updateOwnProfile(
  userId: string,
  input: { opCoId: string; workingDomain: string; designation: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }

  const opCo = await prisma.opCo.findUnique({ where: { id: input.opCoId } });
  if (!opCo || opCo.organizationId !== user.organizationId) {
    throw new OpCoNotInOrganizationError();
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      opCoId: input.opCoId,
      workingDomain: input.workingDomain,
      designation: input.designation,
    },
  });
}
