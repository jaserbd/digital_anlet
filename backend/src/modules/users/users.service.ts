import type { Role } from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/password';

export class EmailTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class UserNotFoundError extends Error {}
export class OpCoNotInOrganizationError extends Error {}

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
      opCoId: true,
      workingDomain: true,
      designation: true,
    },
  });
}

/**
 * Self-service profile completion (see ProfilePage.tsx) — a NORMAL_USER picks their OpCo
 * (which encodes Country + Company) from a dropdown scoped to their own Organization, plus
 * free-text Working Domain and Designation. Not an Admin action.
 */
export async function updateOwnProfile(
  userId: string,
  input: { opCoId: string; workingDomain: string; designation: string },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UserNotFoundError();
  }

  const opCo = await prisma.opCo.findUnique({ where: { id: input.opCoId } });
  if (!opCo || opCo.organizationId !== user.organizationId) {
    throw new OpCoNotInOrganizationError();
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      opCoId: input.opCoId,
      workingDomain: input.workingDomain,
      designation: input.designation,
    },
  });
}
