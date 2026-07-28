import type { AuthenticatedUserDto } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { verifyPassword } from '../../lib/password';
import { signToken, type JwtPayload } from '../../lib/jwt';

export class InvalidCredentialsError extends Error {}

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
    },
  });
  return user;
}
