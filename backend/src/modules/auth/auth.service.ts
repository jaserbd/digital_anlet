import type { AuthenticatedUserDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken, type JwtPayload } from '../../lib/jwt';
import { generateResetToken, hashResetToken } from '../../lib/token';
import { sendPasswordResetEmail } from '../../lib/mailer';
import { env } from '../../config/env';
import { UserNotFoundError } from '../users/users.service';
import { listUserContexts, type RequestUser } from '../../lib/userContext';

export class InvalidCredentialsError extends Error {}
export class InvalidResetTokenError extends Error {}
// A context switch to a membership that isn't the caller's, or to the admin context by a
// non-admin.
export class InvalidContextError extends Error {}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function login(email: string, password: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
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
// (mustChangePassword: true, either from single-create or bulk CSV) can reach any other
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
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

// Forgot-password flow, step 1 (OVERVIEW.md item 12) — deliberately resolves the same way
// whether or not the email belongs to a real (active) user, so the API response itself never
// discloses which emails are registered. Only emits/persists a token when there's actually
// someone to email.
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return;
  }

  const token = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

// Forgot-password flow, step 2 — redeems a single-use token (rejecting an unknown, expired,
// or already-used one) and sets the new password. A successful reset also clears
// mustChangePassword: it supersedes the one-time-admin-password flow (OVERVIEW.md item 4).
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
