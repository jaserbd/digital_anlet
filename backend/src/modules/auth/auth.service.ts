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
