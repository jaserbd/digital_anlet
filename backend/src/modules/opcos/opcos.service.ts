import { prisma } from '../../lib/prisma';

export class OpCoNameTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}

export function listOpCos(organizationId: string) {
  return prisma.opCo.findMany({
    where: { organizationId },
    select: { id: true, name: true, country: true, organizationId: true },
    orderBy: { name: 'asc' },
  });
}

export async function createOpCo(input: { name: string; country: string; organizationId: string }) {
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  const existing = await prisma.opCo.findUnique({
    where: { organizationId_name: { organizationId: input.organizationId, name: input.name } },
  });
  if (existing) {
    throw new OpCoNameTakenError();
  }

  return prisma.opCo.create({
    data: input,
    select: { id: true, name: true, country: true, organizationId: true },
  });
}
