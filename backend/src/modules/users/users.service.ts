import type { BulkCreateUsersResultDto, Role } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { generatePassword } from '../../lib/generatePassword';

export class EmailTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class UserNotFoundError extends Error {}
export class OpCoNotInOrganizationError extends Error {}
export class CannotModifyAdminError extends Error {}
export class OpCoRequiredError extends Error {}
export class UserHasResponsesError extends Error {}

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
      // Admin-set password is explicitly one-time (OVERVIEW.md item 4) — see the
      // mustChangePassword doc comment on the User model.
      mustChangePassword: true,
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
 * Admin-only delete (ADMIN.md item 1). Refuses ADMIN-role targets (same restriction as
 * updateUser — those are seed-time bootstrap only) and blocks deletion of anyone with any
 * questionnaire response history (User.responses has no onDelete: Cascade, and their
 * assessment history has real value even after they leave).
 */
export async function deleteUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }
  if (user.role === 'ADMIN') {
    throw new CannotModifyAdminError();
  }

  const responseCount = await prisma.questionnaireResponse.count({ where: { userId } });
  if (responseCount > 0) {
    throw new UserHasResponsesError();
  }

  await prisma.user.delete({ where: { id: userId } });
}

export interface BulkCreateUserRow {
  email: string;
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
  organization: string;
  password?: string;
}

/**
 * Admin-only: create many users from CSV rows (OVERVIEW.md item 4) — processed one row at a
 * time so a bad row (unknown organization name, taken email, weak password) is reported
 * per-row rather than aborting the whole batch. `organization` is matched case-insensitively
 * against existing organization names (resolved once up front, not once per row). A row that
 * omits `password` gets a generated one-time password; either way the created account has
 * mustChangePassword: true (createUser's own default).
 */
export async function createUsersBulk(rows: BulkCreateUserRow[]): Promise<BulkCreateUsersResultDto[]> {
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  const orgIdByName = new Map(organizations.map((o) => [o.name.trim().toLowerCase(), o.id]));

  const results: BulkCreateUsersResultDto[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 1;

    if (row.password && row.password.length < 8) {
      results.push({ row: rowNumber, email: row.email, status: 'error', error: 'Password must be at least 8 characters' });
      continue;
    }

    const organizationId = orgIdByName.get(row.organization.trim().toLowerCase());
    if (!organizationId) {
      results.push({
        row: rowNumber,
        email: row.email,
        status: 'error',
        error: `Organization "${row.organization}" not found`,
      });
      continue;
    }

    const password = row.password ?? generatePassword();
    try {
      const user = await createUser({ email: row.email, password, role: row.role, organizationId });
      results.push({ row: rowNumber, email: user.email, status: 'created', tempPassword: password });
    } catch (err) {
      const error = err instanceof EmailTakenError ? 'A user with this email already exists' : 'Failed to create user';
      results.push({ row: rowNumber, email: row.email, status: 'error', error });
    }
  }
  return results;
}

/**
 * Self-service profile completion (see ProfilePage.tsx) — a NORMAL_USER or EXECUTIVE picks
 * their OpCo (which encodes Country + Company) from a dropdown scoped to their own
 * Organization, plus free-text Working Domain and Designation. Not an Admin action.
 *
 * OpCo is mandatory for a NORMAL_USER but optional for an EXECUTIVE (MANAGEMENT_REVIEW2.md
 * item 2 — an Executive can skip NatCo entirely and stay permanently unassigned); Working
 * Domain/Designation stay required for both roles.
 */
export async function updateOwnProfile(
  userId: string,
  input: { opCoId?: string; workingDomain: string; designation: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }

  if (input.opCoId) {
    const opCo = await prisma.opCo.findUnique({ where: { id: input.opCoId } });
    if (!opCo || opCo.organizationId !== user.organizationId) {
      throw new OpCoNotInOrganizationError();
    }
  } else if (user.role === 'NORMAL_USER') {
    throw new OpCoRequiredError();
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      opCoId: input.opCoId ?? null,
      workingDomain: input.workingDomain,
      designation: input.designation,
    },
  });
}
