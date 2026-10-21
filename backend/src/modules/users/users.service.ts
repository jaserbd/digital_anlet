import type {
  CreateUserResultDto,
  MembershipDto,
  Role,
  UserDto,
} from '@anlet/shared';
import type { Prisma } from '@prisma/client';
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
// A Project Admin acting outside their own organization + project, on another Project Admin or
// an admin account, or assigning a role other than Executive / Normal User (PROJECTS_PLAN.md).
export class OutsideProjectError extends Error {}
// Placement of a membership (PROJECTS_V2_PLAN.md): an organization that is in projects needs one
// of them; one outside projects takes none.
export class ProjectRequiredError extends Error {}
export class OrganizationNotInProjectError extends Error {}
// Project Admin memberships are added/removed on the project (PROJECTS_V2_PLAN.md).
export class ProjectAdminMembershipError extends Error {}
// USERS_PER_ORGANIZATION_PLAN.md: a user belongs to exactly one organization.
export class OtherOrganizationError extends Error {
  constructor(readonly organizationName: string) {
    super(`This user already belongs to ${organizationName} — a user is in one organization only; use “Move to…” to change it`);
  }
}
// Moving to another organization moves the person, so it needs their only membership.
export class SeveralMembershipsError extends Error {}
// Application Admins and Project Admins (consultants) stay in their own organization.
export class StaysInOrganizationError extends Error {}

// Organization roles; Project Admins are added per project (projects.service.ts), never here.
type MembershipRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE' | 'PROJECT_ADMIN'>;
type MemberRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
const PROJECT_ADMIN_ASSIGNABLE_ROLES: Role[] = ['NORMAL_USER', 'EXECUTIVE'];

/** A Project Admin's scope: their active membership's organization and project. */
export interface ProjectAdminScope {
  organizationId: string;
  projectId: string | null;
}

/** Project Admins may assign only Executive / Normal User, in their own organization + project. */
export function assertProjectAdminMayAssign(
  scope: ProjectAdminScope,
  target: { organizationId: string; projectId: string | null },
  role: Role,
): void {
  if (
    target.organizationId !== scope.organizationId ||
    target.projectId !== scope.projectId ||
    !PROJECT_ADMIN_ASSIGNABLE_ROLES.includes(role)
  ) {
    throw new OutsideProjectError();
  }
}

/** A Project Admin may manage a user only if it is a non-admin client member whose every
 * membership lies in the Project Admin's organization + project and none of them is a Project
 * Admin one — so they can never affect another client, project or consultant. */
export async function assertProjectAdminMayManageUser(scope: ProjectAdminScope, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, memberships: { select: { organizationId: true, projectId: true, role: true } } },
  });
  if (!user) throw new UserNotFoundError();
  const inScope =
    user.role !== 'ADMIN' &&
    user.memberships.length > 0 &&
    user.memberships.every(
      (m) =>
        m.organizationId === scope.organizationId &&
        m.projectId === scope.projectId &&
        PROJECT_ADMIN_ASSIGNABLE_ROLES.includes(m.role),
    );
  if (!inScope) throw new OutsideProjectError();
}

/** A Project Admin may change or remove an Executive / Normal User membership of their own organization + project. */
export async function assertProjectAdminMayManageMembership(scope: ProjectAdminScope, membershipId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { organizationId: true, projectId: true, role: true },
  });
  if (!membership) throw new MembershipNotFoundError();
  assertProjectAdminMayAssign(scope, membership, membership.role);
}

/**
 * Validates where a membership goes (PROJECTS_V2_PLAN.md): the organization must exist; if it is
 * in any project, `projectId` must be one of them (members take part per project); if it is in
 * none, `projectId` must be empty.
 */
export async function assertPlacement(organizationId: string, projectId: string | null): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { projects: { select: { projectId: true } } },
  });
  if (!organization) throw new OrganizationNotFoundError();
  const projectIds = organization.projects.map((p) => p.projectId);
  if (projectId === null) {
    if (projectIds.length > 0) throw new ProjectRequiredError();
  } else if (!projectIds.includes(projectId)) {
    throw new OrganizationNotInProjectError();
  }
}

/**
 * One organization per user (USERS_PER_ORGANIZATION_PLAN.md): every Executive / Normal User
 * membership is in the user's own organization (`User.organizationId`); Project Admin memberships
 * in client organizations don't count (consultants stay members of their own organization).
 * Returns whether adding a membership in `organizationId` also moves the user there: allowed for a
 * non-admin without any membership at all yet (not even as Project Admin), whose home organization
 * is then just where they were created.
 */
async function assertOwnOrganization(userId: string, organizationId: string): Promise<{ movesUser: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
      _count: { select: { memberships: true } },
    },
  });
  if (!user) throw new UserNotFoundError();
  if (user.organizationId === organizationId) return { movesUser: false };
  if (user.role !== 'ADMIN' && user._count.memberships === 0) return { movesUser: true };
  throw new OtherOrganizationError(user.organization.name);
}

function findMembership(userId: string, organizationId: string, projectId: string | null) {
  // findFirst: Prisma can't express a null in a compound-unique lookup.
  return prisma.membership.findFirst({ where: { userId, organizationId, projectId } });
}

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
  organization: { select: { name: true } },
  firstName: true,
  lastName: true,
  isSuperAdmin: true,
  memberships: {
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
      projectId: true,
      project: { select: { name: true } },
      opCoId: true,
      opCo: { select: { name: true } },
      workingDomain: true,
      designation: true,
      _count: { select: { responses: { where: RESPONSE_WITH_DATA } } },
    },
    orderBy: [{ project: { name: 'asc' } }, { organization: { name: 'asc' } }] as Prisma.MembershipOrderByWithRelationInput[],
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
    organizationName: user.organization.name,
    firstName: user.firstName,
    lastName: user.lastName,
    isSuperAdmin: user.isSuperAdmin,
    memberships: user.memberships.map((m): MembershipDto => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      projectId: m.projectId,
      projectName: m.project?.name ?? null,
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
  // The project the membership takes part in (PROJECTS_V2_PLAN.md) — see assertPlacement.
  // Ignored for a new Admin (no membership).
  projectId?: string | null;
  firstName?: string;
  lastName?: string;
}

/**
 * Creates an account — or, when the email already exists and the role isn't Admin, adds the
 * project + role to that user as a new membership (MULTI_ORG_PLAN.md; password unchanged) — only
 * in the user's own organization (assertOwnOrganization).
 * A new Admin is a global role with the given organization as home organization and no
 * membership; any other new user gets one membership.
 */
export async function createUser(
  input: CreateUserInput,
  callerId?: string,
  // Project Admins (PROJECTS_PLAN.md): Executive / Normal User in their organization + project
  // only, and never a membership on an existing admin account.
  scope?: ProjectAdminScope,
): Promise<CreateUserResultDto> {
  const projectId = input.role === 'ADMIN' ? null : (input.projectId ?? null);
  if (scope) assertProjectAdminMayAssign(scope, { organizationId: input.organizationId, projectId }, input.role);
  if (input.role === 'ADMIN' && !(callerId && (await isCallerSuperAdmin(callerId)))) {
    throw new SuperAdminRequiredError();
  }
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (input.role === 'ADMIN') {
    if (!(await prisma.organization.findUnique({ where: { id: input.organizationId } }))) {
      throw new OrganizationNotFoundError();
    }
  } else {
    await assertPlacement(input.organizationId, projectId);
  }

  if (existingUser) {
    if (input.role === 'ADMIN') throw new EmailTakenError();
    if (scope && existingUser.role === 'ADMIN') throw new OutsideProjectError();
    await addMembershipRow(existingUser.id, input.organizationId, projectId, input.role as MembershipRole);
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
              create: { organizationId: input.organizationId, projectId, role: input.role as MembershipRole },
            },
          }),
    },
    select: USER_SELECT,
  });
  return { status: 'created', user: toUserDto(user) };
}

export async function addMembershipRow(
  userId: string,
  organizationId: string,
  projectId: string | null,
  role: MembershipRole,
): Promise<void> {
  if (await findMembership(userId, organizationId, projectId)) throw new AlreadyMemberError();
  // Project Admin memberships sit in client organizations by design (projects.service.ts).
  const { movesUser } = role === 'PROJECT_ADMIN' ? { movesUser: false } : await assertOwnOrganization(userId, organizationId);
  await prisma.$transaction([
    prisma.membership.create({ data: { userId, organizationId, projectId, role } }),
    ...(movesUser ? [prisma.user.update({ where: { id: userId }, data: { organizationId } })] : []),
  ]);
}

/**
 * Admin-only: list existing users with their memberships, optionally narrowed to one
 * organization (users with a membership there, or whose home organization it is).
 */
export async function listUsers(filter?: {
  organizationId?: string;
  // Project Admins: only members of their organization + project, and only those memberships.
  projectAdminScope?: ProjectAdminScope;
}): Promise<UserDto[]> {
  const scope = filter?.projectAdminScope;
  if (scope) {
    const inScope = { organizationId: scope.organizationId, projectId: scope.projectId };
    const users = await prisma.user.findMany({
      where: { memberships: { some: inScope } },
      orderBy: { email: 'asc' },
      select: USER_SELECT,
    });
    return users.map((u) =>
      toUserDto({
        ...u,
        memberships: u.memberships.filter(
          (m) => m.organizationId === scope.organizationId && m.projectId === scope.projectId,
        ),
      }),
    );
  }
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
  input: { organizationId: string; projectId?: string | null; role: MemberRole },
): Promise<UserDto> {
  await assertCanManageMemberships(callerId, userId);
  const projectId = input.projectId ?? null;
  await assertPlacement(input.organizationId, projectId);
  await addMembershipRow(userId, input.organizationId, projectId, input.role);
  return loadUserDto(userId);
}

async function loadMembershipOfUser(userId: string, membershipId: string) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, role: true, _count: { select: { responses: { where: RESPONSE_WITH_DATA } } } },
  });
  if (!membership || membership.userId !== userId) throw new MembershipNotFoundError();
  return membership;
}

/**
 * Changes a membership's role and/or moves it to another organization and/or project
 * (USERS_TABLE_PLAN.md, PROJECTS_V2_PLAN.md). A move keeps the membership's responses — they
 * then count for the new organization + project — and clears its NatCo when the organization
 * changes (it belonged to the old one; a Normal User completes the profile again). Moving to
 * another organization moves the person (one organization per user, USERS_PER_ORGANIZATION_PLAN.md):
 * only their only membership can, and their organization follows. Project Admin memberships
 * are managed per project, not here.
 */
export async function updateMembership(
  callerId: string,
  userId: string,
  membershipId: string,
  input: { role?: MemberRole; organizationId?: string; projectId?: string | null },
): Promise<UserDto> {
  await assertCanManageMemberships(callerId, userId);
  await loadMembershipOfUser(userId, membershipId);
  const membership = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
  if (membership.role === 'PROJECT_ADMIN') throw new ProjectAdminMembershipError();

  const organizationId = input.organizationId ?? membership.organizationId;
  const projectId = input.organizationId !== undefined || input.projectId !== undefined ? (input.projectId ?? null) : membership.projectId;
  const moving = organizationId !== membership.organizationId || projectId !== membership.projectId;
  if (moving) {
    await assertPlacement(organizationId, projectId);
    if (await findMembership(userId, organizationId, projectId)) throw new AlreadyMemberError();
  }
  const orgChanging = organizationId !== membership.organizationId;
  // Another organization means moving the person (one organization per user), which only works
  // for their only membership.
  if (orgChanging) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, memberships: { where: { id: { not: membershipId } }, select: { role: true } } },
    });
    if (user.role === 'ADMIN' || user.memberships.some((m) => m.role === 'PROJECT_ADMIN')) {
      throw new StaysInOrganizationError();
    }
    if (user.memberships.length > 0) throw new SeveralMembershipsError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membershipId },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(moving ? { organizationId, projectId } : {}),
        ...(orgChanging ? { opCoId: null } : {}),
      },
    });
    if (orgChanging) {
      await tx.user.update({ where: { id: userId }, data: { organizationId } });
    }
  });
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
  if (membership.role === 'PROJECT_ADMIN') throw new ProjectAdminMembershipError();
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
