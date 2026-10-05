import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { verifyPassword } from '../src/lib/password';
import { verifyToken } from '../src/lib/jwt';
import { listUserContexts, resolveRequestUser } from '../src/lib/userContext';
import { InvalidContextError, switchContext } from '../src/modules/auth/auth.service';
import { NoMembershipError, getOrCreateResponse } from '../src/modules/responses/responses.service';
import {
  AlreadyMemberError,
  CannotChangeOwnRoleError,
  CannotModifyAdminError,
  MembershipHasResponsesError,
  SuperAdminRequiredError,
  addMembership,
  createUser,
  createUsersBulk,
  deleteUser,
  listUsers,
  removeMembership,
  setTemporaryPassword,
  updateMembership,
  updateUser,
} from '../src/modules/users/users.service';

// Integration test against the real local Postgres. Covers ADMIN_MANAGEMENT_PLAN.md Phase 1
// (global Admin role reserved for the super admin) and MULTI_ORG_PLAN.md: organization
// memberships, context switching, separate answers per organization, admin-generated
// temporary passwords.

const ORG_A_NAME = '__integration-test-users-org-a__';
const ORG_B_NAME = '__integration-test-users-org-b__';

let orgAId: string;
let orgBId: string;
const userIds: string[] = [];
let adminId: string; // a regular admin
let superAdminId: string;

type MembershipSpec = { organizationId: string; role: 'NORMAL_USER' | 'EXECUTIVE' };

async function createRawUser(
  label: string,
  opts: { organizationId: string; role?: 'NORMAL_USER' | 'ADMIN'; isSuperAdmin?: boolean; memberOf?: MembershipSpec[] },
) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-users-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: opts.role ?? 'NORMAL_USER',
      isSuperAdmin: opts.isSuperAdmin ?? false,
      organizationId: opts.organizationId,
      memberships: { create: opts.memberOf ?? [] },
    },
  });
  userIds.push(user.id);
  return user.id;
}

beforeAll(async () => {
  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({ data: { name: ORG_A_NAME } }),
    prisma.organization.create({ data: { name: ORG_B_NAME } }),
  ]);
  orgAId = orgA.id;
  orgBId = orgB.id;
  adminId = await createRawUser('caller-admin', { organizationId: orgAId, role: 'ADMIN' });
  superAdminId = await createRawUser('caller-super', { organizationId: orgAId, role: 'ADMIN', isSuperAdmin: true });
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } }); // memberships cascade
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

describe('global Admin role (real DB)', () => {
  it('reserves granting and removing Admin for the super admin', async () => {
    const userId = await createRawUser('role-promote', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgAId, role: 'NORMAL_USER' }],
    });

    await expect(updateUser(adminId, userId, { role: 'ADMIN' })).rejects.toBeInstanceOf(SuperAdminRequiredError);
    expect((await updateUser(superAdminId, userId, { role: 'ADMIN' })).role).toBe('ADMIN');
    await expect(updateUser(adminId, userId, { role: 'NORMAL_USER' })).rejects.toBeInstanceOf(SuperAdminRequiredError);
    const demoted = await updateUser(superAdminId, userId, { role: 'NORMAL_USER' });
    expect(demoted.role).toBe('NORMAL_USER');
    expect(demoted.memberships).toHaveLength(1); // memberships survive admin grants/removals
  });

  it('never lets anyone modify the super admin, nor change their own role', async () => {
    await expect(updateUser(adminId, superAdminId, { role: 'NORMAL_USER' })).rejects.toBeInstanceOf(
      CannotModifyAdminError,
    );
    await expect(updateUser(adminId, adminId, { role: 'NORMAL_USER' })).rejects.toBeInstanceOf(CannotChangeOwnRoleError);
  });

  it('lets only the super admin create an admin account (with no membership)', async () => {
    const input = {
      email: '__integration-test-users-created-admin__@example.com',
      password: 'a-long-enough-password',
      role: 'ADMIN' as const,
      organizationId: orgAId,
    };
    await expect(createUser(input, adminId)).rejects.toBeInstanceOf(SuperAdminRequiredError);
    const { status, user } = await createUser(input, superAdminId);
    userIds.push(user.id);
    expect(status).toBe('created');
    expect(user.role).toBe('ADMIN');
    expect(user.memberships).toEqual([]);
  });

  it('lets only the super admin delete an admin, and nobody the super admin', async () => {
    const userId = await createRawUser('delete-admin', { organizationId: orgAId, role: 'ADMIN' });
    await expect(deleteUser(adminId, userId)).rejects.toBeInstanceOf(SuperAdminRequiredError);
    await expect(deleteUser(adminId, superAdminId)).rejects.toBeInstanceOf(CannotModifyAdminError);
    await deleteUser(superAdminId, userId);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});

describe('memberships (real DB)', () => {
  it('creating a user with an existing email adds a membership instead of failing', async () => {
    const email = '__integration-test-users-multi__@example.com';
    const first = await createUser(
      { email, password: 'first-password-123', role: 'EXECUTIVE', organizationId: orgAId },
      adminId,
    );
    userIds.push(first.user.id);
    expect(first.status).toBe('created');
    expect(first.user.role).toBe('NORMAL_USER'); // global role; Executive lives on the membership

    const second = await createUser(
      { email, password: 'ignored-password', role: 'NORMAL_USER', organizationId: orgBId },
      adminId,
    );
    expect(second.status).toBe('membership-added');
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.memberships.map((m) => `${m.organizationName}:${m.role}`).sort()).toEqual(
      [`${ORG_A_NAME}:EXECUTIVE`, `${ORG_B_NAME}:NORMAL_USER`].sort(),
    );
    // Password unchanged by the second create.
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: first.user.id } });
    expect(await verifyPassword('first-password-123', stored.passwordHash)).toBe(true);

    await expect(
      createUser({ email, password: 'x-password-123', role: 'NORMAL_USER', organizationId: orgBId }, adminId),
    ).rejects.toBeInstanceOf(AlreadyMemberError);
  });

  it('lets any admin add, change and remove memberships of a non-admin user', async () => {
    const userId = await createRawUser('membership-crud', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgAId, role: 'NORMAL_USER' }],
    });

    let user = await addMembership(adminId, userId, { organizationId: orgBId, role: 'EXECUTIVE' });
    const inB = user.memberships.find((m) => m.organizationId === orgBId)!;
    expect(inB.role).toBe('EXECUTIVE');

    user = await updateMembership(adminId, userId, inB.id, { role: 'NORMAL_USER' });
    expect(user.memberships.find((m) => m.id === inB.id)?.role).toBe('NORMAL_USER');

    user = await removeMembership(adminId, userId, inB.id);
    expect(user.memberships.map((m) => m.organizationId)).toEqual([orgAId]);
  });

  it("lets only the super admin (or that admin themself) change an admin account's memberships", async () => {
    await expect(
      addMembership(adminId, superAdminId, { organizationId: orgBId, role: 'EXECUTIVE' }),
    ).rejects.toBeInstanceOf(SuperAdminRequiredError);
    const self = await addMembership(superAdminId, superAdminId, { organizationId: orgBId, role: 'EXECUTIVE' });
    expect(self.memberships.some((m) => m.organizationId === orgBId)).toBe(true);
  });

  it('blocks removing a membership that has responses', async () => {
    const userId = await createRawUser('membership-responses', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgAId, role: 'NORMAL_USER' }],
    });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId } });
    await getOrCreateResponse({ sub: userId, membershipId: membership.id }, 'RAN_FM_GB1059A');
    await expect(removeMembership(adminId, userId, membership.id)).rejects.toBeInstanceOf(MembershipHasResponsesError);
  });

  it('keeps answers separate per organization', async () => {
    const userId = await createRawUser('separate-answers', {
      organizationId: orgAId,
      memberOf: [
        { organizationId: orgAId, role: 'NORMAL_USER' },
        { organizationId: orgBId, role: 'NORMAL_USER' },
      ],
    });
    const [inA, inB] = await Promise.all([
      prisma.membership.findFirstOrThrow({ where: { userId, organizationId: orgAId } }),
      prisma.membership.findFirstOrThrow({ where: { userId, organizationId: orgBId } }),
    ]);
    const responseA = await getOrCreateResponse({ sub: userId, membershipId: inA.id }, 'RAN_FM_GB1059A');
    const responseB = await getOrCreateResponse({ sub: userId, membershipId: inB.id }, 'RAN_FM_GB1059A');
    expect(responseA.id).not.toBe(responseB.id);
    expect((await getOrCreateResponse({ sub: userId, membershipId: inA.id }, 'RAN_FM_GB1059A')).id).toBe(responseA.id);
    await expect(getOrCreateResponse({ sub: userId, membershipId: null }, 'RAN_FM_GB1059A')).rejects.toBeInstanceOf(
      NoMembershipError,
    );
  });

  it('lists users with their memberships, narrowed to one organization', async () => {
    const memberOfB = await createRawUser('list-b', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgBId, role: 'NORMAL_USER' }],
    });
    const scoped = await listUsers({ organizationId: orgBId });
    expect(scoped.find((u) => u.id === memberOfB)?.memberships.map((m) => m.organizationId)).toEqual([orgBId]);
  });
});

describe('working context (real DB)', () => {
  it('defaults admins to the admin context and lets them switch into their memberships', async () => {
    const userId = await createRawUser('ctx-admin', {
      organizationId: orgAId,
      role: 'ADMIN',
      memberOf: [{ organizationId: orgBId, role: 'EXECUTIVE' }],
    });
    const contexts = await listUserContexts(userId);
    expect(contexts.map((c) => c.role)).toEqual(['ADMIN', 'EXECUTIVE']);

    const admin = (await resolveRequestUser(userId, null))!;
    expect(admin).toMatchObject({ role: 'ADMIN', membershipId: null });
    const token = await switchContext(admin, contexts[1]!.membershipId);
    const switched = (await resolveRequestUser(userId, verifyToken(token).membershipId))!;
    expect(switched).toMatchObject({ role: 'EXECUTIVE', organizationId: orgBId, isAdmin: true });
  });

  it("refuses switching into someone else's membership, or a non-admin into the admin context", async () => {
    const userId = await createRawUser('ctx-other', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgAId, role: 'NORMAL_USER' }],
    });
    const other = await prisma.membership.findFirstOrThrow({ where: { userId } });
    const admin = (await resolveRequestUser(adminId, null))!;
    await expect(switchContext(admin, other.id)).rejects.toBeInstanceOf(InvalidContextError);

    const member = (await resolveRequestUser(userId, null))!;
    expect(member.role).toBe('NORMAL_USER');
    await expect(switchContext(member, null)).rejects.toBeInstanceOf(InvalidContextError);
  });

  it("falls back to the default context once the token's membership is removed", async () => {
    const userId = await createRawUser('ctx-removed', {
      organizationId: orgAId,
      memberOf: [
        { organizationId: orgAId, role: 'NORMAL_USER' },
        { organizationId: orgBId, role: 'EXECUTIVE' },
      ],
    });
    const inB = await prisma.membership.findFirstOrThrow({ where: { userId, organizationId: orgBId } });
    expect((await resolveRequestUser(userId, inB.id))!.role).toBe('EXECUTIVE');
    await removeMembership(adminId, userId, inB.id);
    expect(await resolveRequestUser(userId, inB.id)).toMatchObject({ role: 'NORMAL_USER', organizationId: orgAId });
  });
});

describe('temporary passwords (real DB)', () => {
  it('lets any admin reset a non-admin user, forcing a password change at next login', async () => {
    const userId = await createRawUser('temp-pw', {
      organizationId: orgAId,
      memberOf: [{ organizationId: orgAId, role: 'NORMAL_USER' }],
    });
    const temporaryPassword = await setTemporaryPassword(adminId, userId);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(temporaryPassword, stored.passwordHash)).toBe(true);
    expect(stored.mustChangePassword).toBe(true);
  });

  it('reserves resetting another admin for the super admin; never the super admin or yourself', async () => {
    const otherAdmin = await createRawUser('temp-pw-admin', { organizationId: orgAId, role: 'ADMIN' });
    await expect(setTemporaryPassword(adminId, otherAdmin)).rejects.toBeInstanceOf(SuperAdminRequiredError);
    await expect(setTemporaryPassword(superAdminId, otherAdmin)).resolves.toEqual(expect.any(String));
    await expect(setTemporaryPassword(adminId, superAdminId)).rejects.toBeInstanceOf(CannotModifyAdminError);
    await expect(setTemporaryPassword(adminId, adminId)).rejects.toBeInstanceOf(CannotModifyAdminError);
  });
});

describe('bulk CSV with existing emails (real DB)', () => {
  it('adds a membership for an existing email and reports duplicates per row', async () => {
    const email = '__integration-test-users-bulk__@example.com';
    const results = await createUsersBulk([
      { email, role: 'NORMAL_USER', organization: ORG_A_NAME },
      { email, role: 'EXECUTIVE', organization: ORG_B_NAME },
      { email, role: 'EXECUTIVE', organization: ORG_B_NAME },
    ]);
    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    userIds.push(created.id);
    expect(results.map((r) => r.status)).toEqual(['created', 'membership-added', 'error']);
    expect(results[0]!.tempPassword).toEqual(expect.any(String));
    expect(results[1]!.tempPassword).toBeUndefined();
    expect(results[2]!.error).toBe('Already a member of this organization');
  });
});
