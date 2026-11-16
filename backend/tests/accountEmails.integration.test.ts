import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';

// Integration test against the real local Postgres. Covers ONBOARDING_SECURITY_PLAN.md Phase 3:
// welcome / admin-sent reset emails with single-use links, email confirmation on redemption.

class MailDisabledError extends Error {}
const sendWelcomeEmail = vi.fn().mockResolvedValue(undefined);
const sendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/lib/mailer', () => ({
  MailDisabledError,
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmail(...args),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const { sendAccountEmail, sendWelcomeEmails } = await import('../src/modules/users/accountEmails.service');
const { InvalidResetTokenError, resetPassword } = await import('../src/modules/auth/auth.service');
const { CannotModifyAdminError, OutsideProjectError } = await import('../src/modules/users/users.service');

const PREFIX = '__integration-test-account-emails';
const orgIds: string[] = [];
const projectIds: string[] = [];
const userIds: string[] = [];
let adminId: string;
let superAdminId: string;
let memberAId: string; // project P, organization A
let memberBId: string; // project P, organization B
let outsiderId: string; // project Q
let projectP: string;
let orgA: string;

async function user(label: string, data: { organizationId: string; role?: 'ADMIN' | 'NORMAL_USER'; isSuperAdmin?: boolean; projectId?: string }) {
  const created = await prisma.user.create({
    data: {
      email: `${PREFIX}-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: data.role ?? 'NORMAL_USER',
      isSuperAdmin: data.isSuperAdmin ?? false,
      organizationId: data.organizationId,
      firstName: 'Ada',
      ...(data.projectId
        ? { memberships: { create: { organizationId: data.organizationId, projectId: data.projectId, role: 'NORMAL_USER' } } }
        : {}),
    },
  });
  userIds.push(created.id);
  return created.id;
}

function lastUrl(mock: typeof sendWelcomeEmail): URL {
  return new URL(mock.mock.calls.at(-1)![1] as string);
}

beforeAll(async () => {
  const [a, b, q] = await Promise.all(
    ['a', 'b', 'q'].map((n) => prisma.organization.create({ data: { name: `${PREFIX}-org-${n}__` } })),
  );
  orgIds.push(a!.id, b!.id, q!.id);
  orgA = a!.id;
  const p = await prisma.project.create({
    data: { name: `${PREFIX}-project-p__`, organizations: { create: [{ organizationId: a!.id }, { organizationId: b!.id }] } },
  });
  const qProject = await prisma.project.create({
    data: { name: `${PREFIX}-project-q__`, organizations: { create: [{ organizationId: q!.id }] } },
  });
  projectIds.push(p.id, qProject.id);
  projectP = p.id;

  adminId = await user('admin', { organizationId: a!.id, role: 'ADMIN' });
  superAdminId = await user('super', { organizationId: a!.id, role: 'ADMIN', isSuperAdmin: true });
  memberAId = await user('member-a', { organizationId: a!.id, projectId: p.id });
  memberBId = await user('member-b', { organizationId: b!.id, projectId: p.id });
  outsiderId = await user('outsider', { organizationId: q!.id, projectId: qProject.id });
});

beforeEach(() => {
  sendWelcomeEmail.mockReset().mockResolvedValue(undefined);
  sendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.$disconnect();
});

describe('welcome emails (real DB)', () => {
  it('emails a 7-day set-password link that confirms the address when used', async () => {
    const result = await sendAccountEmail(adminId, memberAId, 'welcome');
    expect(result).toMatchObject({ outcome: 'sent', email: `${PREFIX}-member-a__@example.com` });
    expect(sendWelcomeEmail.mock.calls[0]![2]).toMatchObject({ firstName: 'Ada', organizationName: `${PREFIX}-org-a__` });

    const url = lastUrl(sendWelcomeEmail);
    expect(url.pathname).toBe('/reset-password');
    expect(url.searchParams.get('welcome')).toBe('1');
    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: memberAId, usedAt: null } });
    expect(token.purpose).toBe('INVITE');
    const days = (token.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    expect(await resetPassword(url.searchParams.get('token')!, 'my-own-password')).toEqual({ email: result.email });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: memberAId } });
    expect(stored.emailVerifiedAt).not.toBeNull();
    expect(stored.mustChangePassword).toBe(false);
  });

  it('only the latest link works, and using one cancels the others', async () => {
    await sendAccountEmail(adminId, memberBId, 'welcome');
    const first = lastUrl(sendWelcomeEmail).searchParams.get('token')!;
    await sendAccountEmail(adminId, memberBId, 'welcome');
    const second = lastUrl(sendWelcomeEmail).searchParams.get('token')!;
    await sendAccountEmail(adminId, memberBId, 'reset');
    const reset = lastUrl(sendPasswordResetEmail).searchParams.get('token')!;

    await expect(resetPassword(first, 'password-one')).rejects.toBeInstanceOf(InvalidResetTokenError);
    await resetPassword(second, 'password-two');
    await expect(resetPassword(reset, 'password-three')).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('admin-sent reset links last 24 hours', async () => {
    await sendAccountEmail(adminId, outsiderId, 'reset');
    expect(sendPasswordResetEmail.mock.calls[0]![2]).toBe('24 hours');
    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: outsiderId, purpose: 'RESET' } });
    const hours = (token.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });

  it('reports switched-off sending and mail server errors instead of throwing', async () => {
    sendWelcomeEmail.mockRejectedValueOnce(new MailDisabledError());
    expect((await sendAccountEmail(adminId, memberAId, 'welcome')).outcome).toBe('disabled');

    sendWelcomeEmail.mockRejectedValueOnce(new Error('550 mailbox unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendAccountEmail(adminId, memberAId, 'welcome')).toMatchObject({ outcome: 'failed', error: '550 mailbox unavailable' });
    consoleError.mockRestore();
  });

  it('follows the temporary-password rules: never the super admin or yourself; admins only by the super admin', async () => {
    await expect(sendAccountEmail(adminId, superAdminId, 'reset')).rejects.toBeInstanceOf(CannotModifyAdminError);
    await expect(sendAccountEmail(adminId, adminId, 'reset')).rejects.toBeInstanceOf(CannotModifyAdminError);
    expect((await sendAccountEmail(superAdminId, adminId, 'welcome')).outcome).toBe('sent');
  });

  it('lets a Project Admin email members of any organization of their project, nobody else', async () => {
    const scope = { organizationId: orgA, projectId: projectP };
    expect((await sendAccountEmail(adminId, memberBId, 'welcome', scope)).outcome).toBe('sent');
    await expect(sendAccountEmail(adminId, outsiderId, 'welcome', scope)).rejects.toBeInstanceOf(OutsideProjectError);

    const batch = await sendWelcomeEmails(adminId, [memberAId, outsiderId], scope);
    expect(batch.map((r) => r.outcome)).toEqual(['sent', 'failed']);
    expect(batch[1]!.error).toBe('Not allowed to email this user');
  });
});
