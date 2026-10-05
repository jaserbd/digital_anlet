import { prisma } from '../../lib/prisma';
import { referenceListEntryExists } from '../referenceLists/referenceLists.service';

export class OpCoNameTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class OpCoNotFoundError extends Error {}
export class OpCoHasDependentsError extends Error {}
export class NatCoNameNotInCatalogError extends Error {}
export class CountryNotInCatalogError extends Error {}

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

  // Name/country must come from the Admin-managed reference lists (see
  // referenceLists.service.ts) — prevents the spelling drift that motivated this catalog in
  // the first place. Checked here (not just in the frontend) so a direct API call can't
  // bypass the dropdown.
  const [nameInCatalog, countryInCatalog] = await Promise.all([
    referenceListEntryExists('NATCO_NAME', input.name, input.organizationId),
    referenceListEntryExists('COUNTRY', input.country),
  ]);
  if (!nameInCatalog) {
    throw new NatCoNameNotInCatalogError();
  }
  if (!countryInCatalog) {
    throw new CountryNotInCatalogError();
  }

  return prisma.opCo.create({
    data: input,
    select: { id: true, name: true, country: true, organizationId: true },
  });
}

// Admin-only delete (ADMIN.md item 1). Blocked (not cascaded) if any membership is still
// assigned to this OpCo — those respondents' NatCo would otherwise silently disappear from
// their history.
export async function deleteOpCo(id: string): Promise<void> {
  const opCo = await prisma.opCo.findUnique({ where: { id } });
  if (!opCo) {
    throw new OpCoNotFoundError();
  }

  const membershipCount = await prisma.membership.count({ where: { opCoId: id } });
  if (membershipCount > 0) {
    throw new OpCoHasDependentsError();
  }

  await prisma.opCo.delete({ where: { id } });
}
