import { prisma } from '../../lib/prisma';

export class OpCoNameTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class OpCoNotFoundError extends Error {}
export class OpCoHasDependentsError extends Error {}

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

// Admin-only delete (ADMIN.md item 1). Blocked (not cascaded) if any user is still assigned
// to this OpCo — User.opCoId has no onDelete: Cascade, so those respondents' history would
// otherwise be orphaned.
export async function deleteOpCo(id: string): Promise<void> {
  const opCo = await prisma.opCo.findUnique({ where: { id } });
  if (!opCo) {
    throw new OpCoNotFoundError();
  }

  const userCount = await prisma.user.count({ where: { opCoId: id } });
  if (userCount > 0) {
    throw new OpCoHasDependentsError();
  }

  await prisma.opCo.delete({ where: { id } });
}
