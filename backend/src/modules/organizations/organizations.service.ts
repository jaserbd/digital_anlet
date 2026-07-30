import { prisma } from '../../lib/prisma';

export function listOrganizations() {
  return prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export class OrganizationNameTakenError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class OrganizationHasDependentsError extends Error {}

// New organizations start accepting every existing questionnaire (THIRD_REVIEW.md item 7 —
// QuestionnaireOrgSetting backfill, mirroring seed.ts's symmetric backfill for a newly-added
// questionnaire against every existing organization).
export async function createOrganization(name: string) {
  const existing = await prisma.organization.findUnique({ where: { name } });
  if (existing) {
    throw new OrganizationNameTakenError();
  }
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name }, select: { id: true, name: true } });
    const questionnaires = await tx.questionnaire.findMany({ select: { id: true } });
    if (questionnaires.length > 0) {
      await tx.questionnaireOrgSetting.createMany({
        data: questionnaires.map((q) => ({
          questionnaireId: q.id,
          organizationId: org.id,
          acceptingResponses: true,
        })),
      });
    }
    return org;
  });
}

// Admin-only delete (ADMIN.md item 1). Blocked (not cascaded) if the organization still has
// any OpCos or Users — deleting those would silently destroy real assessment history, and
// neither relation has onDelete: Cascade in the schema. QuestionnaireOrgSetting rows are pure
// per-org acceptance defaults with no historical value, so those are removed automatically in
// the same transaction as the organization itself.
export async function deleteOrganization(id: string): Promise<void> {
  const organization = await prisma.organization.findUnique({ where: { id } });
  if (!organization) {
    throw new OrganizationNotFoundError();
  }

  const [opCoCount, userCount] = await Promise.all([
    prisma.opCo.count({ where: { organizationId: id } }),
    prisma.user.count({ where: { organizationId: id } }),
  ]);
  if (opCoCount > 0 || userCount > 0) {
    throw new OrganizationHasDependentsError();
  }

  await prisma.$transaction([
    prisma.questionnaireOrgSetting.deleteMany({ where: { organizationId: id } }),
    prisma.organization.delete({ where: { id } }),
  ]);
}
