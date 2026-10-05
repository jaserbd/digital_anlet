import type {
  BulkCreateUsersResultDto,
  CreateUserResultDto,
  MembershipDto,
  Role,
  UserDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';
import { generatePassword } from '../../lib/generatePassword';
import type { RequestUser } from '../../lib/userContext';
import { referenceListEntryExists } from '../referenceLists/referenceLists.service';

export class EmailTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class UserNotFoundError extends Error {}
export class MembershipNotFoundError extends Error {}
export class OpCoNotInOrganizationError extends Error {}
export class CannotModifyAdminError extends Error {}
export class OpCoRequiredError extends Error {}
export class UserHasResponsesError extends Error {}
export class MembershipHasResponsesError extends Error {}
export class AlreadyMemberError extends Error {}
export class WorkingDomainNotInCatalogError extends Error {}
export class DesignationNotInCatalogError extends Error {}
// Profile completion needs an active membership (the admin context has no profile).
export class NoActiveMembershipError extends Error {}
// Granting/removing the Admin role, creating an admin, or modifying/deleting an existing admin
// account is reserved for the super admin (ADMIN_MANAGEMENT_PLAN.md).
export class SuperAdminRequiredError extends Error {}
export class CannotChangeOwnRoleError extends Error {}

type MembershipRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;

// A response that holds something worth keeping: submitted, or with any answer, comment or KEI.
// Opening a questionnaire or results page creates an empty IN_PROGRESS response, which must not
// make a membership impossible to remove (MULTI_ORG_PLAN.md).
const RESPONSE_WITH_DATA = {
  OR: [
    { status: 'SUBMITTED' as const },
    { answers: { some: {} } },
    { comments: { some: {} } },
    { keis: { some: {} } },
  ],
};

// Re-read from the DB on every privileged call rather than trusting the JWT payload, so a
// token issued before a role change can't be used to claim super admin rights.
async function isCallerSuperAdmin(callerId: string): Promise<boolean> {
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { role: true, isSuperAdmin: true },
  });
  return caller?.role === 'ADMIN' && caller.isSuperAdmin;
}

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  organizationId: true,
  firstName: true,
  lastName: true,
  isSuperAdmin: true,
  memberships: {
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
      opCoId: true,
      opCo: { select: { name: true } },
      workingDomain: true,
      designation: true,
      _count: { select: { responses: { where: RESPONSE_WITH_DATA } } },
    },
    orderBy: { organization: { name: 'asc' } },
  },
} as const;

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserRow>>>;

function findUserRow(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
}

function toUserDto(user: UserRow): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    firstName: user.firstName,
    lastName: user.lastName,
    isSuperAdmin: user.isSuperAdmin,
    memberships: user.memberships.map((m): MembershipDto => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
      opCoId: m.opCoId,
      opCoName: m.opCo?.name ?? null,
      workingDomain: m.workingDomain,
      designation: m.designation,
      responseCount: m._count.responses,
    })),
  };
}

async function loadUserDto(userId: string): Promise<UserDto> {
  const user = await findUserRow(userId);
  if (!user) throw new UserNotFoundError();
  return toUserDto(user);
}

export interface CreateUserInput {
  email: string;
  password: string;
  // ADMIN only when the caller is the super admin (checked by createUser).
  role: Role;
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Creates an account — or, when the email already exists and the role isn't Admin, adds the
 * organization + role to that user as a new membership (MULTI_ORG_PLAN.md; password unchanged).
 * A new Admin is a global role with the given organization as home organization and no
 * membership; any other new user gets one membership.
 */
export async function createUser(
  input: CreateUserInput,
  callerId?: string,
): Promise<CreateUserResultDto> {
  if (input.role === 'ADMIN' && !(callerId && (await isCallerSuperAdmin(callerId)))) {
    throw new SuperAdminRequiredError();
  }
  const [existingUser, organization] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.organization.findUnique({ where: { id: input.organizationId } }),
  ]);
  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  if (existingUser) {
    if (input.role === 'ADMIN') throw new EmailTakenError();
    await addMembershipRow(existingUser.id, input.organizationId, input.role as MembershipRole);
    return { status: 'membership-added', user: await loadUserDto(existingUser.id) };
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role === 'ADMIN' ? 'ADMIN' : 'NORMAL_USER',
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      // Admin-set password is explicitly one-time (OVERVIEW.md item 4) — see the
      // mustChangePassword doc comment on the User model.
      mustChangePassword: true,
      ...(input.role === 'ADMIN'
        ? {}
        : {
            memberships: {
              create: { organizationId: input.organizationId, role: input.role as MembershipRole },
            },
          }),
    },
    select: USER_SELECT,
  });
  return { status: 'created', user: toUserDto(user) };
}

async function addMembershipRow(
  userId: string,
  organizationId: string,
  role: MembershipRole,
): Promise<void> {
  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (existing) throw new AlreadyMemberError();
  await prisma.membership.create({ data: { userId, organizationId, role } });
}

/**
 * Admin-only: list existing users with their memberships, optionally narrowed to one
 * organization (users with a membership there, or whose home organization it is).
 */
export async function listUsers(filter?: { organizationId?: string }): Promise<UserDto[]> {
  const users = await prisma.user.findMany({
    where: filter?.organizationId
      ? {
          OR: [
            { organizationId: filter.organizationId },
            { memberships: { some: { organizationId: filter.organizationId } } },
          ],
        }
      : {},
    orderBy: { email: 'asc' },
    select: USER_SELECT,
  });
  return users.map(toUserDto);
}

// Who may change an account's memberships: any admin for a non-admin user; for an admin
// account, only the super admin or that admin themself (e.g. the super admin adding their own
// email to a client organization — MULTI_ORG_PLAN.md).
async function assertCanManageMemberships(callerId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new UserNotFoundError();
  if (user.role === 'ADMIN' && callerId !== userId && !(await isCallerSuperAdmin(callerId))) {
    throw new SuperAdminRequiredError();
  }
}

export async function addMembership(
  callerId: string,
  userId: string,
  input: { organizationId: string; role: MembershipRole },
): Promise<UserDto> {
  await assertCanManageMemberships(callerId, userId);
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!organization) throw new OrganizationNotFoundError();
  await addMembershipRow(userId, input.organizationId, input.role);
  return loadUserDto(userId);
}

async function loadMembershipOfUser(userId: string, membershipId: string) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, _count: { select: { responses: { where: RESPONSE_WITH_DATA } } } },
  });
  if (!membership || membership.userId !== userId) throw new MembershipNotFoundError();
  return membership;
}

export async function updateMembership(
  callerId: string,
  userId: string,
  membershipId: string,
  input: { role: MembershipRole },
): Promise<UserDto> {
  await assertCanManageMemberships(callerId, userId);
  await loadMembershipOfUser(userId, membershipId);
  await prisma.membership.update({ where: { id: membershipId }, data: { role: input.role } });
  return loadUserDto(userId);
}

// Blocked while the membership has responses with data — that assessment history belongs to
// the organization and has value after the person leaves (same idea as deleteUser). Empty
// in-progress responses (created just by opening a page) are removed with the membership.
export async function removeMembership(
  callerId: string,
  userId: string,
  membershipId: string,
): Promise<UserDto> {
  await assertCanManageMemberships(callerId, userId);
  const membership = await loadMembershipOfUser(userId, membershipId);
  if (membership._count.responses > 0) throw new MembershipHasResponsesError();
  await prisma.$transaction([
    prisma.questionnaireResponse.deleteMany({ where: { membershipId } }),
    prisma.membership.delete({ where: { id: membershipId } }),
  ]);
  return loadUserDto(userId);
}

export interface UpdateUserInput {
  // Grant ('ADMIN') or remove ('NORMAL_USER') the global Admin role — super admin only.
  role?: Role;
}

/**
 * Grants or removes the global Admin role (super admin only). Memberships are unaffected — a
 * former admin keeps any organization memberships they hold. The super admin account itself
 * is never modifiable, and nobody changes their own role.
 */
export async function updateUser(
  callerId: string,
  userId: string,
  input: UpdateUserInput,
): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }
  if (user.isSuperAdmin) {
    throw new CannotModifyAdminError();
  }
  const nextRole =
    input.role === undefined ? undefined : input.role === 'ADMIN' ? 'ADMIN' : 'NORMAL_USER';
  const roleChanging = nextRole !== undefined && nextRole !== user.role;
  if (roleChanging && userId === callerId) {
    throw new CannotChangeOwnRoleError();
  }
  if (roleChanging && !(await isCallerSuperAdmin(callerId))) {
    throw new SuperAdminRequiredError();
  }
  if (roleChanging) {
    await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });
  }
  return loadUserDto(userId);
}

/**
 * Admin-generated one-time password (admin_management.md line 12) — for when the user can't
 * use the emailed reset link. Any admin for a non-admin user; only the super admin for another
 * admin; never for the super admin account or the caller's own account (use Change password).
 * The user must set their own password at next login.
 */
export async function setTemporaryPassword(callerId: string, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserNotFoundError();
  if (user.isSuperAdmin || userId === callerId) throw new CannotModifyAdminError();
  if (user.role === 'ADMIN' && !(await isCallerSuperAdmin(callerId)))
    throw new SuperAdminRequiredError();

  const temporaryPassword = generatePassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
  });
  return temporaryPassword;
}

/**
 * Admin-only delete (ADMIN.md item 1). An ADMIN target may be deleted only by the super
 * admin, and the super admin account never (same rules as updateUser). Blocks deletion of
 * anyone with any questionnaire response history (User.responses has no onDelete: Cascade,
 * and their assessment history has real value even after they leave).
 */
export async function deleteUser(callerId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }
  if (user.isSuperAdmin || userId === callerId) {
    throw new CannotModifyAdminError();
  }
  if (user.role === 'ADMIN' && !(await isCallerSuperAdmin(callerId))) {
    throw new SuperAdminRequiredError();
  }

  const responseCount = await prisma.questionnaireResponse.count({ where: { userId } });
  if (responseCount > 0) {
    throw new UserHasResponsesError();
  }

  await prisma.user.delete({ where: { id: userId } });
}

export interface BulkCreateUserRow {
  email: string;
  role: MembershipRole;
  organization: string;
  password?: string;
}

/**
 * Admin-only: create many users from CSV rows (OVERVIEW.md item 4) — processed one row at a
 * time so a bad row (unknown organization name, weak password, already a member) is reported
 * per-row rather than aborting the whole batch. `organization` is matched case-insensitively
 * against existing organization names (resolved once up front, not once per row). A row whose
 * email already exists adds that organization/role as a membership (MULTI_ORG_PLAN.md) and
 * leaves the password alone; a new account gets the row's password or a generated one-time
 * password, with mustChangePassword: true (createUser's own default).
 */
export async function createUsersBulk(
  rows: BulkCreateUserRow[],
): Promise<BulkCreateUsersResultDto[]> {
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  const orgIdByName = new Map(organizations.map((o) => [o.name.trim().toLowerCase(), o.id]));

  const results: BulkCreateUsersResultDto[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 1;

    if (row.password && row.password.length < 8) {
      results.push({
        row: rowNumber,
        email: row.email,
        status: 'error',
        error: 'Password must be at least 8 characters',
      });
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
      const result = await createUser({
        email: row.email,
        password,
        role: row.role,
        organizationId,
      });
      results.push(
        result.status === 'created'
          ? { row: rowNumber, email: result.user.email, status: 'created', tempPassword: password }
          : { row: rowNumber, email: result.user.email, status: 'membership-added' },
      );
    } catch (err) {
      const error =
        err instanceof AlreadyMemberError
          ? 'Already a member of this organization'
          : err instanceof EmailTakenError
            ? 'A user with this email already exists'
            : 'Failed to create user';
      results.push({ row: rowNumber, email: row.email, status: 'error', error });
    }
  }
  return results;
}

/**
 * Self-service profile completion (see ProfilePage.tsx) for the *active membership*
 * (MULTI_ORG_PLAN.md — the profile is per organization): the user picks their OpCo (which
 * encodes Country + Company) from that organization's NatCos, plus Working Domain and
 * Designation. Not an Admin action.
 *
 * OpCo is mandatory for a NORMAL_USER membership but optional for an EXECUTIVE
 * (MANAGEMENT_REVIEW2.md item 2); Working Domain/Designation stay required for both roles.
 */
export async function updateOwnProfile(
  caller: RequestUser,
  input: { opCoId?: string; workingDomain: string; designation: string },
): Promise<void> {
  if (!caller.membershipId) {
    throw new NoActiveMembershipError();
  }
  const membership = await prisma.membership.findUnique({ where: { id: caller.membershipId } });
  if (!membership) {
    throw new UserNotFoundError();
  }

  if (input.opCoId) {
    const opCo = await prisma.opCo.findUnique({ where: { id: input.opCoId } });
    if (!opCo || opCo.organizationId !== membership.organizationId) {
      throw new OpCoNotInOrganizationError();
    }
  } else if (membership.role === 'NORMAL_USER') {
    throw new OpCoRequiredError();
  }

  // Working Domain/Designation must come from the Admin-managed global reference lists —
  // see referenceLists.service.ts. Checked here (not just in the frontend dropdown) so a
  // direct API call can't bypass it.
  const [workingDomainInCatalog, designationInCatalog] = await Promise.all([
    referenceListEntryExists('WORKING_DOMAIN', input.workingDomain),
    referenceListEntryExists('DESIGNATION', input.designation),
  ]);
  if (!workingDomainInCatalog) {
    throw new WorkingDomainNotInCatalogError();
  }
  if (!designationInCatalog) {
    throw new DesignationNotInCatalogError();
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      opCoId: input.opCoId ?? null,
      workingDomain: input.workingDomain,
      designation: input.designation,
    },
  });
}
