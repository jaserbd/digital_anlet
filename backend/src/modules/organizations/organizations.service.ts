import { prisma } from '../../lib/prisma';

export function listOrganizations() {
  return prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export class OrganizationNameTakenError extends Error {}

export async function createOrganization(name: string) {
  const existing = await prisma.organization.findUnique({ where: { name } });
  if (existing) {
    throw new OrganizationNameTakenError();
  }
  return prisma.organization.create({ data: { name }, select: { id: true, name: true } });
}
