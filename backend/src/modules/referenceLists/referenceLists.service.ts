import type { ReferenceListCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class OrganizationNotFoundError extends Error {}
export class OrganizationIdRequiredError extends Error {}
export class OrganizationIdNotAllowedError extends Error {}
export class ReferenceListEntryNameTakenError extends Error {}
export class ReferenceListEntryNotFoundError extends Error {}

function assertScope(category: ReferenceListCategory, organizationId: string | undefined) {
  if (category === 'NATCO_NAME') {
    if (!organizationId) {
      throw new OrganizationIdRequiredError();
    }
  } else if (organizationId) {
    throw new OrganizationIdNotAllowedError();
  }
}

export function listReferenceListEntries(category: ReferenceListCategory, organizationId?: string) {
  assertScope(category, organizationId);
  return prisma.referenceListEntry.findMany({
    where: { category, organizationId: organizationId ?? null },
    orderBy: { name: 'asc' },
  });
}

export async function createReferenceListEntry(input: {
  category: ReferenceListCategory;
  name: string;
  organizationId?: string;
}) {
  assertScope(input.category, input.organizationId);

  if (input.organizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!organization) {
      throw new OrganizationNotFoundError();
    }
  }

  // Postgres treats NULL organizationId as distinct across rows, so the DB's
  // @@unique([category, organizationId, name]) only actually dedupes NATCO_NAME (which
  // always has a non-null organizationId) — enforce case-insensitive uniqueness for the
  // three global categories here instead of via a partial unique index.
  const existing = await prisma.referenceListEntry.findFirst({
    where: {
      category: input.category,
      organizationId: input.organizationId ?? null,
      name: { equals: input.name, mode: 'insensitive' },
    },
  });
  if (existing) {
    throw new ReferenceListEntryNameTakenError();
  }

  return prisma.referenceListEntry.create({
    data: {
      category: input.category,
      name: input.name,
      organizationId: input.organizationId ?? null,
    },
  });
}

export async function deleteReferenceListEntry(id: string): Promise<void> {
  const entry = await prisma.referenceListEntry.findUnique({ where: { id } });
  if (!entry) {
    throw new ReferenceListEntryNotFoundError();
  }
  // No dependents check: OpCo.name/country and User.workingDomain/designation copy the
  // string value at write time rather than FK'ing to this row, so deleting an entry can't
  // orphan anything — it only removes it from future dropdown choices.
  await prisma.referenceListEntry.delete({ where: { id } });
}

// Used by opcos.service.ts/users.service.ts to validate a write against the catalog
// without a round trip through listReferenceListEntries's scope assertions.
export async function referenceListEntryExists(
  category: ReferenceListCategory,
  name: string,
  organizationId?: string,
): Promise<boolean> {
  const entry = await prisma.referenceListEntry.findFirst({
    where: {
      category,
      organizationId: organizationId ?? null,
      name: { equals: name, mode: 'insensitive' },
    },
    select: { id: true },
  });
  return entry !== null;
}
