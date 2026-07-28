import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  CannotModifyAdminError,
  OpCoNotInOrganizationError,
  listUsers,
  updateUser,
} from '../src/modules/users/users.service';

// Integration test against the real local Postgres. Covers SECOND_REVIEW.md item 8 —
// Admin reassigning an existing user's Organization (and OpCo).

const ORG_A_NAME = '__integration-test-users-org-a__';
const ORG_B_NAME = '__integration-test-users-org-b__';

let orgAId: string;
let orgBId: string;
let opCoAId: string;
let opCoBId: string;
const userIds: string[] = [];

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
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.opCo.deleteMany({ where: { id: { in: [opCoAId, opCoBId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

async function createUser(label: string, opts: { organizationId: string; opCoId?: string; role?: 'NORMAL_USER' | 'ADMIN' }) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-users-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: opts.role ?? 'NORMAL_USER',
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

    const updated = await updateUser(userId, { organizationId: orgBId });

    expect(updated.organizationId).toBe(orgBId);
    expect(updated.opCoId).toBeNull();
  });

  it('accepts a new opCoId in the same call, validated against the new organization', async () => {
    const userId = await createUser('reassign-with-opco', { organizationId: orgAId, opCoId: opCoAId });

    const updated = await updateUser(userId, { organizationId: orgBId, opCoId: opCoBId });

    expect(updated.organizationId).toBe(orgBId);
    expect(updated.opCoId).toBe(opCoBId);
  });

  it('rejects an opCoId that does not belong to the target organization', async () => {
    const userId = await createUser('reassign-invalid-opco', { organizationId: orgAId, opCoId: opCoAId });

    await expect(updateUser(userId, { organizationId: orgBId, opCoId: opCoAId })).rejects.toBeInstanceOf(
      OpCoNotInOrganizationError,
    );
  });

  it('refuses to reassign an ADMIN-role account', async () => {
    const userId = await createUser('admin-guard', { organizationId: orgAId, role: 'ADMIN' });

    await expect(updateUser(userId, { organizationId: orgBId })).rejects.toBeInstanceOf(
      CannotModifyAdminError,
    );
  });
});

describe('listUsers (real DB)', () => {
  it('excludes ADMIN-role accounts and can be scoped to one organization', async () => {
    const normalUserId = await createUser('list-normal', { organizationId: orgAId });
    await createUser('list-admin', { organizationId: orgAId, role: 'ADMIN' });

    const scoped = await listUsers({ organizationId: orgAId });
    expect(scoped.some((u) => u.id === normalUserId)).toBe(true);
    expect(scoped.every((u) => u.role !== 'ADMIN')).toBe(true);
  });
});
