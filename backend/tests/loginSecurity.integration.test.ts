import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { resolveRequestUser } from '../src/lib/userContext';
import {
  InvalidCredentialsError,
  InvalidResetTokenError,
  LINK_TTL_MS,
  MAX_FAILED_LOGINS,
  changeOwnPassword,
  issueAccountLink,
  login,
  resetPassword,
} from '../src/modules/auth/auth.service';

// Integration test against the real local Postgres — ONBOARDING_SECURITY_PLAN.md Phase 6:
// the sign-in pause after repeated wrong passwords, sessions ending on a password change, and
// deactivated accounts.

const ORG_NAME = '__integration-test-login-security-org__';
const EMAIL = '__integration-test-login-security__@example.com';
const PASSWORD = 'correct-horse-battery';

let orgId: string;
let userId: string;

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { name: ORG_NAME } })).id;
  userId = (
    await prisma.user.create({
      data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), role: 'NORMAL_USER', organizationId: orgId },
    })
  ).id;
});

afterAll(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

const token = (url: string) => new URL(url).searchParams.get('token')!;
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('sign-in hardening (real DB)', () => {
  it('pauses sign-in after repeated wrong passwords, even for the right one, until a reset', async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await expect(login(EMAIL, 'wrong-password')).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    const paused = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(paused.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await expect(login(EMAIL, PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError);

    // Once the pause has passed, the right password works and the counter starts over.
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await expect(login(EMAIL.toUpperCase(), PASSWORD)).resolves.toEqual(expect.any(String));
    const cleared = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(cleared.failedLoginCount).toBe(0);
    expect(cleared.lockedUntil).toBeNull();
  }, 60_000);

  it('refuses an unknown address the same way', async () => {
    await expect(login('nobody-here@example.com', 'whatever-password')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('signs out sessions issued before a password change, not the one issued after', async () => {
    const before = nowSeconds() - 120;
    expect(await resolveRequestUser(userId, null, before)).not.toBeNull();
    await changeOwnPassword(userId, PASSWORD, 'another-long-password');
    expect(await resolveRequestUser(userId, null, before)).toBeNull();
    expect(await resolveRequestUser(userId, null, nowSeconds())).not.toBeNull();

    await resetPassword(token(await issueAccountLink(userId, 'RESET', LINK_TTL_MS.RESET)), PASSWORD);
    expect(await resolveRequestUser(userId, null, nowSeconds() - 60)).toBeNull();
  });

  it('keeps a deactivated account out: no sign-in, no session, no reset link', async () => {
    const link = await issueAccountLink(userId, 'RESET', LINK_TTL_MS.RESET);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await expect(login(EMAIL, PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(await resolveRequestUser(userId, null, nowSeconds())).toBeNull();
    await expect(resetPassword(token(link), 'yet-another-password')).rejects.toBeInstanceOf(InvalidResetTokenError);
  });
});
