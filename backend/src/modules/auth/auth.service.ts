import type { AuthenticatedUserDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken, type JwtPayload } from '../../lib/jwt';
import { generateResetToken, hashResetToken } from '../../lib/token';
import { sendPasswordResetEmail } from '../../lib/mailer';
import { env } from '../../config/env';
import { UserNotFoundError } from '../users/users.service';

export class InvalidCredentialsError extends Error {}
export class InvalidResetTokenError extends Error {}

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

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
  return signToken(payload);
}

// Fetched fresh from the DB (not just echoed from the JWT payload) because opCoId/
// workingDomain/designation can change after login via profile completion, without a
// fresh token being issued — see ProfilePage.tsx's post-submit `/api/auth/me` refetch.
export async function getAuthenticatedUser(userId: string): Promise<AuthenticatedUserDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      opCoId: true,
      workingDomain: true,
      designation: true,
      mustChangePassword: true,
      isSuperAdmin: true,
    },
  });
  return user;
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
