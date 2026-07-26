import type { Role } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';

export class EmailTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

export async function createUser(input: CreateUserInput) {
  const [existingUser, organization] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.organization.findUnique({ where: { id: input.organizationId } }),
  ]);

  if (existingUser) {
    throw new EmailTakenError();
  }
  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
    },
    select: {
      id: true,
      email: true,
      role: true,
      organizationId: true,
      firstName: true,
      lastName: true,
    },
  });
}
