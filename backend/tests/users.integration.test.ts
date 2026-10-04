import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  CannotChangeOwnRoleError,
  CannotModifyAdminError,
  OpCoNotInOrganizationError,
  SuperAdminRequiredError,
  createUser as createUserViaService,
  deleteUser,
  listUsers,
  updateUser,
} from '../src/modules/users/users.service';

// Integration test against the real local Postgres. Covers SECOND_REVIEW.md item 8 —
// Admin reassigning an existing user's Organization (and OpCo) — and ADMIN_MANAGEMENT_PLAN.md
// Phase 1: role changes, with granting/removing Admin reserved for the super admin.

const ORG_A_NAME = '__integration-test-users-org-a__';
const ORG_B_NAME = '__integration-test-users-org-b__';

let orgAId: string;
let orgBId: string;
let opCoAId: string;
let opCoBId: string;
const userIds: string[] = [];
let adminId: string; // a regular (internal) admin
let superAdminId: string;

beforeAll(async () => {
  const [orgA, orgB] = await Promise.all([
    prisma.organization.create({ data: { name: ORG_A_NAME } }),
    prisma.organization.create({ data: { name: ORG_B_NAME } }),
  ]);
  orgAId = orgA.id;
  orgBId = orgB.id;

  const [opCoA, opCoB] = await Promise.all([
    prisma.opCo.create({ data: { name: 'OpCo A', country: 'Testland A', organizationId: orgAId } }),
    prisma.opCo.create({ data: { name: 'OpCo B', country: 'Testland B', organizationId: orgBId } }),
  ]);
  opCoAId = opCoA.id;
  opCoBId = opCoB.id;

  adminId = await createUser('caller-admin', { organizationId: orgAId, role: 'ADMIN' });
  superAdminId = await createUser('caller-super', {
    organizationId: orgAId,
    role: 'ADMIN',
    isSuperAdmin: true,
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.opCo.deleteMany({ where: { id: { in: [opCoAId, opCoBId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

async function createUser(
  label: string,
  opts: {
    organizationId: string;
    opCoId?: string;
    role?: 'NORMAL_USER' | 'EXECUTIVE' | 'ADMIN';
    isSuperAdmin?: boolean;
  },
) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-users-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: opts.role ?? 'NORMAL_USER',
      isSuperAdmin: opts.isSuperAdmin ?? false,
      organizationId: opts.organizationId,
      opCoId: opts.opCoId,
    },
  });
  userIds.push(user.id);
  return user.id;
}

describe('updateUser (real DB)', () => {
  it('reassigning organizationId clears opCoId, since the old OpCo belongs to the old org', async () => {
    const userId = await createUser('reassign', { organizationId: orgAId, opCoId: opCoAId });

    const updated = await updateUser(adminId, userId, { organizationId: orgBId });

    expect(updated.organizationId).toBe(orgBId);
    expect(updated.opCoId).toBeNull();
  });

  it('accepts a new opCoId in the same call, validated against the new organization', async () => {
    const userId = await createUser('reassign-with-opco', {
      organizationId: orgAId,
      opCoId: opCoAId,
    });

    const updated = await updateUser(adminId, userId, { organizationId: orgBId, opCoId: opCoBId });

    expect(updated.organizationId).toBe(orgBId);
    expect(updated.opCoId).toBe(opCoBId);
  });

  it('rejects an opCoId that does not belong to the target organization', async () => {
    const userId = await createUser('reassign-invalid-opco', {
      organizationId: orgAId,
      opCoId: opCoAId,
    });

    await expect(
      updateUser(adminId, userId, { organizationId: orgBId, opCoId: opCoAId }),
    ).rejects.toBeInstanceOf(OpCoNotInOrganizationError);
  });

  it('lets only the super admin reassign another admin account', async () => {
    const userId = await createUser('admin-guard', { organizationId: orgAId, role: 'ADMIN' });

    await expect(updateUser(adminId, userId, { organizationId: orgBId })).rejects.toBeInstanceOf(
      SuperAdminRequiredError,
    );
    const updated = await updateUser(superAdminId, userId, { organizationId: orgBId });
    expect(updated.organizationId).toBe(orgBId);
  });

  it('never lets anyone modify the super admin account', async () => {
    await expect(
      updateUser(adminId, superAdminId, { organizationId: orgBId }),
    ).rejects.toBeInstanceOf(CannotModifyAdminError);
    await expect(
      updateUser(superAdminId, superAdminId, { role: 'EXECUTIVE' }),
    ).rejects.toBeInstanceOf(CannotModifyAdminError);
  });
});

describe('role changes (real DB)', () => {
  it('lets any admin switch a user between Normal User and Executive', async () => {
    const userId = await createUser('role-switch', { organizationId: orgAId });

    expect((await updateUser(adminId, userId, { role: 'EXECUTIVE' })).role).toBe('EXECUTIVE');
    expect((await updateUser(adminId, userId, { role: 'NORMAL_USER' })).role).toBe('NORMAL_USER');
  });

  it('reserves granting and removing Admin for the super admin', async () => {
    const userId = await createUser('role-promote', { organizationId: orgAId });

    await expect(updateUser(adminId, userId, { role: 'ADMIN' })).rejects.toBeInstanceOf(
      SuperAdminRequiredError,
    );
    expect((await updateUser(superAdminId, userId, { role: 'ADMIN' })).role).toBe('ADMIN');

    await expect(updateUser(adminId, userId, { role: 'EXECUTIVE' })).rejects.toBeInstanceOf(
      SuperAdminRequiredError,
    );
    expect((await updateUser(superAdminId, userId, { role: 'EXECUTIVE' })).role).toBe('EXECUTIVE');
  });

  it("refuses to change the caller's own role", async () => {
    await expect(updateUser(adminId, adminId, { role: 'EXECUTIVE' })).rejects.toBeInstanceOf(
      CannotChangeOwnRoleError,
    );
  });

  it('lets only the super admin create an admin account', async () => {
    const input = {
      email: '__integration-test-users-created-admin__@example.com',
      password: 'a-long-enough-password',
      role: 'ADMIN' as const,
      organizationId: orgAId,
    };
    await expect(createUserViaService(input, adminId)).rejects.toBeInstanceOf(
      SuperAdminRequiredError,
    );
    const created = await createUserViaService(input, superAdminId);
    userIds.push(created.id);
    expect(created.role).toBe('ADMIN');
    expect(created.isSuperAdmin).toBe(false);
  });

  it('lets only the super admin delete an admin, and nobody the super admin', async () => {
    const userId = await createUser('delete-admin', { organizationId: orgAId, role: 'ADMIN' });

    await expect(deleteUser(adminId, userId)).rejects.toBeInstanceOf(SuperAdminRequiredError);
    await expect(deleteUser(adminId, superAdminId)).rejects.toBeInstanceOf(CannotModifyAdminError);
    await deleteUser(superAdminId, userId);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});

describe('listUsers (real DB)', () => {
  it('includes admins (flagging the super admin) and can be scoped to one organization', async () => {
    const normalUserId = await createUser('list-normal', { organizationId: orgAId });
    const otherOrgUserId = await createUser('list-other-org', { organizationId: orgBId });

    const scoped = await listUsers({ organizationId: orgAId });
    expect(scoped.some((u) => u.id === normalUserId)).toBe(true);
    expect(scoped.some((u) => u.id === otherOrgUserId)).toBe(false);
    expect(scoped.find((u) => u.id === superAdminId)?.isSuperAdmin).toBe(true);
    expect(scoped.find((u) => u.id === adminId)?.isSuperAdmin).toBe(false);
  });
});
