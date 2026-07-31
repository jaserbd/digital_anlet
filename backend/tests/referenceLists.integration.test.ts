import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  OrganizationIdNotAllowedError,
  OrganizationIdRequiredError,
  ReferenceListEntryNameTakenError,
  createReferenceListEntry,
  listReferenceListEntries,
} from '../src/modules/referenceLists/referenceLists.service';
import { CountryNotInCatalogError, NatCoNameNotInCatalogError, createOpCo } from '../src/modules/opcos/opcos.service';
import {
  DesignationNotInCatalogError,
  WorkingDomainNotInCatalogError,
  updateOwnProfile,
} from '../src/modules/users/users.service';

// Integration test against the real local Postgres, following the existing
// users.integration.test.ts convention (no mocking, service functions called directly,
// namespaced fixtures cleaned up in afterAll). Covers the reference-list dropdowns that
// replaced free-text entry for Country/Working Domain/Designation/NatCo Name.

const ORG_NAME = '__integration-test-reflists-org__';
const COUNTRY_NAME = `__integration-test-country-${Date.now()}__`;
const NATCO_NAME = `__integration-test-natco-${Date.now()}__`;
const WORKING_DOMAIN_NAME = `__integration-test-domain-${Date.now()}__`;
const DESIGNATION_NAME = `__integration-test-designation-${Date.now()}__`;

let orgId: string;
const referenceListEntryIds: string[] = [];
const opCoIds: string[] = [];
const userIds: string[] = [];

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: ORG_NAME } });
  orgId = org.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.opCo.deleteMany({ where: { id: { in: opCoIds } } });
  await prisma.referenceListEntry.deleteMany({ where: { id: { in: referenceListEntryIds } } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('createReferenceListEntry / listReferenceListEntries (real DB)', () => {
  it('creates and lists a global-category entry', async () => {
    const entry = await createReferenceListEntry({ category: 'COUNTRY', name: COUNTRY_NAME });
    referenceListEntryIds.push(entry.id);

    const entries = await listReferenceListEntries('COUNTRY');
    expect(entries.some((e) => e.name === COUNTRY_NAME)).toBe(true);
  });

  it('rejects a case-insensitive duplicate within the same global category', async () => {
    await expect(
      createReferenceListEntry({ category: 'COUNTRY', name: COUNTRY_NAME.toUpperCase() }),
    ).rejects.toBeInstanceOf(ReferenceListEntryNameTakenError);
  });

  it('requires organizationId for NATCO_NAME', async () => {
    await expect(createReferenceListEntry({ category: 'NATCO_NAME', name: 'x' })).rejects.toBeInstanceOf(
      OrganizationIdRequiredError,
    );
  });

  it('rejects organizationId for a global category', async () => {
    await expect(
      createReferenceListEntry({ category: 'COUNTRY', name: 'y', organizationId: orgId }),
    ).rejects.toBeInstanceOf(OrganizationIdNotAllowedError);
  });

  it('creates and lists a NATCO_NAME entry scoped to one organization', async () => {
    const entry = await createReferenceListEntry({ category: 'NATCO_NAME', name: NATCO_NAME, organizationId: orgId });
    referenceListEntryIds.push(entry.id);

    const entries = await listReferenceListEntries('NATCO_NAME', orgId);
    expect(entries.some((e) => e.name === NATCO_NAME)).toBe(true);
  });
});

describe('createOpCo catalog validation (real DB)', () => {
  it('rejects a name not present in this organization\'s NatCo Name catalog', async () => {
    const country = await createReferenceListEntry({ category: 'COUNTRY', name: `${COUNTRY_NAME}-2` });
    referenceListEntryIds.push(country.id);

    await expect(
      createOpCo({ name: 'not-in-catalog', country: country.name, organizationId: orgId }),
    ).rejects.toBeInstanceOf(NatCoNameNotInCatalogError);
  });

  it('rejects a country not present in the Country catalog', async () => {
    const natCo = await createReferenceListEntry({ category: 'NATCO_NAME', name: `${NATCO_NAME}-2`, organizationId: orgId });
    referenceListEntryIds.push(natCo.id);

    await expect(
      createOpCo({ name: natCo.name, country: 'not-in-catalog', organizationId: orgId }),
    ).rejects.toBeInstanceOf(CountryNotInCatalogError);
  });

  it('succeeds when both name and country are in their catalogs', async () => {
    const [natCo, country] = await Promise.all([
      createReferenceListEntry({ category: 'NATCO_NAME', name: `${NATCO_NAME}-3`, organizationId: orgId }),
      createReferenceListEntry({ category: 'COUNTRY', name: `${COUNTRY_NAME}-3` }),
    ]);
    referenceListEntryIds.push(natCo.id, country.id);

    const opCo = await createOpCo({ name: natCo.name, country: country.name, organizationId: orgId });
    opCoIds.push(opCo.id);

    expect(opCo.name).toBe(natCo.name);
  });
});

describe('updateOwnProfile catalog validation (real DB)', () => {
  it('rejects a workingDomain/designation not present in their catalogs', async () => {
    const user = await prisma.user.create({
      data: {
        email: '__integration-test-reflists-profile__@example.com',
        passwordHash: 'not-a-real-hash',
        role: 'EXECUTIVE',
        organizationId: orgId,
      },
    });
    userIds.push(user.id);

    await expect(
      updateOwnProfile(user.id, { workingDomain: 'not-in-catalog', designation: 'not-in-catalog' }),
    ).rejects.toBeInstanceOf(WorkingDomainNotInCatalogError);

    const designation = await createReferenceListEntry({ category: 'WORKING_DOMAIN', name: WORKING_DOMAIN_NAME });
    referenceListEntryIds.push(designation.id);

    await expect(
      updateOwnProfile(user.id, { workingDomain: WORKING_DOMAIN_NAME, designation: 'still-not-in-catalog' }),
    ).rejects.toBeInstanceOf(DesignationNotInCatalogError);
  });

  it('succeeds once both are in their catalogs', async () => {
    const user = await prisma.user.create({
      data: {
        email: '__integration-test-reflists-profile-2__@example.com',
        passwordHash: 'not-a-real-hash',
        role: 'EXECUTIVE',
        organizationId: orgId,
      },
    });
    userIds.push(user.id);

    const entry = await createReferenceListEntry({ category: 'DESIGNATION', name: DESIGNATION_NAME });
    referenceListEntryIds.push(entry.id);

    await expect(
      updateOwnProfile(user.id, { workingDomain: WORKING_DOMAIN_NAME, designation: DESIGNATION_NAME }),
    ).resolves.toBeUndefined();
  });
});
