import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma';

// The mailer's own SMTP transport isn't exercised here — vi.mock replaces
// sendPasswordResetEmail before auth.service.ts (which imports it) is loaded, so no real SMTP
// connection is attempted from the test suite.
const sendPasswordResetEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../src/lib/mailer', () => ({ sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args) }));

const { InvalidResetTokenError, requestPasswordReset, resetPassword } = await import('../src/modules/auth/auth.service');
const { verifyPassword } = await import('../src/lib/password');

// Integration test against the real local Postgres. Covers OVERVIEW.md item 12 — forgot
// password via an emailed, single-use, expiring reset link.

const ORG_NAME = '__integration-test-password-reset-org__';

let orgId: string;
const userIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: ORG_NAME } });
  orgId = org.id;
});

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-password-reset-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
      mustChangePassword: true,
    },
  });
  userIds.push(user.id);
  return user;
}

function extractTokenFromEmail(): string {
  const resetUrl = sendPasswordResetEmail.mock.calls.at(-1)![1] as string;
  return new URL(resetUrl).searchParams.get('token')!;
}

describe('requestPasswordReset (real DB)', () => {
  it('creates a redeemable token and emails it for an existing active user', async () => {
    const user = await createUser('request');
    sendPasswordResetEmail.mockClear();

    await requestPasswordReset(user.email);

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail.mock.calls[0]![0]).toBe(user.email);

    const tokenCount = await prisma.passwordResetToken.count({ where: { userId: user.id } });
    expect(tokenCount).toBe(1);
  });

  it('resolves without emailing for a non-existent email (no user-enumeration signal)', async () => {
    sendPasswordResetEmail.mockClear();

    await expect(requestPasswordReset('__no-such-user__@example.com')).resolves.toBeUndefined();

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('resetPassword (real DB)', () => {
  it('redeems a valid token: sets the new password and clears mustChangePassword', async () => {
    const user = await createUser('redeem');
    sendPasswordResetEmail.mockClear();
    await requestPasswordReset(user.email);
    const token = extractTokenFromEmail();

    await resetPassword(token, 'brand-new-password-123');

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    await expect(verifyPassword('brand-new-password-123', updated.passwordHash)).resolves.toBe(true);
  });

  it('rejects redeeming the same token twice', async () => {
    const user = await createUser('reuse');
    sendPasswordResetEmail.mockClear();
    await requestPasswordReset(user.email);
    const token = extractTokenFromEmail();

    await resetPassword(token, 'first-new-password-123');

    await expect(resetPassword(token, 'second-new-password-123')).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('rejects an expired token', async () => {
    const user = await createUser('expired');
    sendPasswordResetEmail.mockClear();
    await requestPasswordReset(user.email);
    const token = extractTokenFromEmail();
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(resetPassword(token, 'new-password-123')).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('rejects an unknown token', async () => {
    await expect(resetPassword('not-a-real-token', 'new-password-123')).rejects.toBeInstanceOf(
      InvalidResetTokenError,
    );
  });
});
