import type { AuthenticatedUserDto } from '@anlet/shared';
import type { TokenPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyAgainstNothing, verifyPassword } from '../../lib/password';
import { signToken, type JwtPayload } from '../../lib/jwt';
import { generateResetToken, hashResetToken } from '../../lib/token';
import { MailDisabledError, sendPasswordResetEmail } from '../../lib/mailer';
import { env } from '../../config/env';
import { normalizeEmail } from '../../lib/email';
import { UserNotFoundError } from '../users/users.service';
import { listUserContexts, type RequestUser } from '../../lib/userContext';

export class InvalidCredentialsError extends Error {}
export class InvalidResetTokenError extends Error {}
// A context switch to a membership that isn't the caller's, or to the admin context by a
// non-admin.
export class InvalidContextError extends Error {}

// How long each kind of emailed link works (ONBOARDING_SECURITY_PLAN.md Phase 3).
const HOUR_MS = 60 * 60 * 1000;
export const LINK_TTL_MS = {
  // Self-service "Forgot password".
  RESET: HOUR_MS,
  // Sent by an admin from the users table — the person may not read it within the hour.
  ADMIN_RESET: 24 * HOUR_MS,
  // Welcome email for a new account.
  INVITE: 7 * 24 * HOUR_MS,
} as const;

/** Issues a single-use emailed link (only its hash is stored) and returns its URL. An older
 * unused link of the same kind stops working, so only the latest email counts. */
export async function issueAccountLink(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
  const token = generateResetToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId, purpose, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    }),
  ]);
  return `${env.APP_BASE_URL}/reset-password?token=${token}${purpose === 'INVITE' ? '&welcome=1' : ''}`;
}

// Password guessing (ONBOARDING_SECURITY_PLAN.md Phase 6): after this many wrong passwords in a
// row, sign-in to the account is paused. Kept in the database, so it holds across Cloud Run
// instances (the per-address limiter in auth.routes.ts is per instance).
export const MAX_FAILED_LOGINS = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

/** Every refusal is the same error after the same amount of work — unknown address, wrong
 * password, deactivated or paused account — so neither the answer nor its timing says which. */
export async function login(email: string, password: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !user.isActive) {
    await verifyAgainstNothing(password);
    throw new InvalidCredentialsError();
  }

  const locked = user.lockedUntil != null && user.lockedUntil > new Date();
  const valid = await verifyPassword(password, user.passwordHash);
  if (locked) {
    throw new InvalidCredentialsError();
  }
  if (!valid) {
    const { failedLoginCount } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    if (failedLoginCount >= MAX_FAILED_LOGINS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK_MS) },
      });
    }
    throw new InvalidCredentialsError();
  }
  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  // Default context (MULTI_ORG_PLAN.md): admins start in the admin context, everyone else in
  // their first membership; the frontend offers the switcher/picker when there's more than one.
  const payload: JwtPayload = { sub: user.id, email: user.email, membershipId: null };
  return signToken(payload);
}

/** Issues a token for another of the caller's contexts — a membership of theirs, or (admins
 * only) the admin context (membershipId null). */
export async function switchContext(caller: RequestUser, membershipId: string | null): Promise<string> {
  if (membershipId === null) {
    if (!caller.isAdmin) throw new InvalidContextError();
  } else {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId }, select: { userId: true } });
    if (!membership || membership.userId !== caller.sub) throw new InvalidContextError();
  }
  return signToken({ sub: caller.sub, email: caller.email, membershipId });
}

// Built from the request's resolved context (lib/userContext.ts) plus a fresh read of the
// active membership's profile, since the profile can change after login (ProfilePage refetches
// /api/auth/me after saving).
export async function getAuthenticatedUser(caller: RequestUser): Promise<AuthenticatedUserDto | null> {
  const [user, membership, contexts] = await Promise.all([
    prisma.user.findUnique({ where: { id: caller.sub }, select: { mustChangePassword: true, isSuperAdmin: true } }),
    caller.membershipId
      ? prisma.membership.findUnique({
          where: { id: caller.membershipId },
          select: { opCoId: true, workingDomain: true, designation: true },
        })
      : null,
    listUserContexts(caller.sub),
  ]);
  if (!user) return null;
  return {
    id: caller.sub,
    email: caller.email,
    role: caller.role,
    organizationId: caller.organizationId,
    projectId: caller.projectId,
    activeMembershipId: caller.membershipId,
    isAdmin: caller.isAdmin,
    contexts,
    opCoId: membership?.opCoId ?? null,
    workingDomain: membership?.workingDomain ?? null,
    designation: membership?.designation ?? null,
    mustChangePassword: user.mustChangePassword,
    isSuperAdmin: user.isSuperAdmin,
  };
}

// Self-service password change (OVERVIEW.md item 4) — required before an admin-created user
// (mustChangePassword: true, from single-create, the project import or a temporary password) can reach any other
// route, mirroring ProtectedRoute's existing profile-completion gate. Clears the flag once
// the new password is set.
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const passwordHash = await hashPassword(newPassword);
  // passwordChangedAt signs out every other session; the caller's own cookie is re-issued by
  // the controller.
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
  });
}

// Forgot-password flow, step 1 (OVERVIEW.md item 12) — deliberately resolves the same way
// whether or not the email belongs to a real (active) user, so the API response itself never
// discloses which emails are registered. Only emits/persists a token when there's actually
// someone to email.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !user.isActive) {
    // Sending takes a second or two; without a comparable wait here, response time would show
    // which addresses are registered. (Not sent after responding instead: Cloud Run may pause
    // the instance once the response is out.)
    if (env.NODE_ENV !== 'test') await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1700));
    return;
  }

  const resetUrl = await issueAccountLink(user.id, 'RESET', LINK_TTL_MS.RESET);
  // A mail outage must not change the response either (a 500 only for registered addresses
  // would reveal them) — log it; admins can still hand out a temporary password.
  try {
    await sendPasswordResetEmail(user.email, resetUrl, 'the next hour');
  } catch (err) {
    if (!(err instanceof MailDisabledError)) console.error('Password reset email failed', err);
  }
}

// Forgot-password flow, step 2 — redeems a single-use token (rejecting an unknown, expired,
// or already-used one) and sets the new password. A successful reset also clears
// mustChangePassword: it supersedes the one-time-admin-password flow (OVERVIEW.md item 4).
// Welcome links (INVITE) are redeemed the same way. Either proves the address reaches the person
// (emailVerifiedAt), and every other outstanding link of theirs stops working.
export async function resetPassword(token: string, newPassword: string): Promise<{ email: string }> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { isActive: true } } },
  });
  // A deactivated account's outstanding link must not bring it back.
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.isActive) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // Signs out every older session and lifts a sign-in pause.
      data: {
        passwordHash,
        mustChangePassword: false,
        emailVerifiedAt: now,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      select: { email: true },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null, id: { not: record.id } } }),
  ]);
  return { email: user.email };
}
