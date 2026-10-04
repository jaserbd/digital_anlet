import type { ReferenceListCategory } from '@prisma/client';
import { env } from '../../src/config/env';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { parseRanFmXlsx } from './parseRanFmXlsx';
import { parseCoreFaultManagementXlsx, parseCoreStabilityXlsx } from './parseCoreFmXlsx';
import { parseIpFmXlsx } from './parseIpFmXlsx';
import { parseTransportMicrowaveXlsx, parseTransportOtnXlsx } from './parseTransportXlsx';
import { parseFixedAccessXlsx } from './parseFixedAccessXlsx';
import countries from './data/countries.json';

const INTERNAL_ORG_NAME = 'Anlet (Internal)';

// Non-exhaustive starting points for the two categories with no universal standard list
// (unlike Country, which is seeded from countries.json) — Admin extends these further via
// the Management Console's reference-list sections.
const STARTER_WORKING_DOMAINS = [
  'RAN',
  'Core',
  'IP',
  'Transport',
  'Fixed Access',
  'NOC',
  'Field Operations',
  'Planning & Engineering',
  'IT/OSS',
];

const STARTER_DESIGNATIONS = [
  'Network Engineer',
  'NOC Engineer',
  'Team Lead',
  'Solution Architect',
  'Manager',
  'Director',
  'CTO',
];

async function seedInternalOrgAndAdmin() {
  const org = await prisma.organization.upsert({
    where: { name: INTERNAL_ORG_NAME },
    update: {},
    create: { name: INTERNAL_ORG_NAME },
  });

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    // The bootstrap admin is the super admin (ADMIN_MANAGEMENT_PLAN.md) — in production
    // ADMIN_EMAIL is jaserbin.rahman@detecon.com.
    update: { passwordHash, role: 'ADMIN', isSuperAdmin: true, organizationId: org.id },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      isSuperAdmin: true,
      organizationId: org.id,
    },
  });

  console.log(`Seeded internal org "${INTERNAL_ORG_NAME}" and super admin "${env.ADMIN_EMAIL}"`);
}

async function seedQuestionnaire(parsed: ParsedQuestionnaire) {
  const questionnaire = await prisma.questionnaire.upsert({
    where: { code: parsed.code },
    update: {
      name: parsed.name,
      networkType: parsed.networkType,
      hvsCategory: parsed.hvsCategory,
      hasE2ECheck: parsed.hasE2ECheck,
      guidelineText: parsed.guidelineText,
      keiNote: parsed.keiNote,
    },
    create: {
      code: parsed.code,
      name: parsed.name,
      networkType: parsed.networkType,
      hvsCategory: parsed.hvsCategory,
      hasE2ECheck: parsed.hasE2ECheck,
      guidelineText: parsed.guidelineText,
      keiNote: parsed.keiNote,
    },
  });

  for (const s of parsed.subScenarios) {
    await prisma.subScenario.upsert({
      where: { questionnaireId_code: { questionnaireId: questionnaire.id, code: s.code } },
      update: {
        name: s.name,
        description: s.description,
        category: s.category,
        faultDistributionWeight: s.faultDistributionWeight,
        sortOrder: s.sortOrder,
      },
      create: {
        questionnaireId: questionnaire.id,
        code: s.code,
        name: s.name,
        description: s.description,
        category: s.category,
        faultDistributionWeight: s.faultDistributionWeight,
        sortOrder: s.sortOrder,
      },
    });
  }

  for (const q of parsed.questions) {
    await prisma.question.upsert({
      where: {
        questionnaireId_sortOrder: { questionnaireId: questionnaire.id, sortOrder: q.sortOrder },
      },
      update: {
        cognitiveActivity: q.cognitiveActivity,
        serviceCapability: q.serviceCapability,
        questionText: q.questionText,
        weight: q.weight,
        optionAText: q.optionText.A ?? '',
        optionBText: q.optionText.B ?? null,
        optionCText: q.optionText.C ?? null,
        optionDText: q.optionText.D ?? null,
        optionACriteria: q.optionCriteria.A ?? null,
        optionBCriteria: q.optionCriteria.B ?? null,
        optionCCriteria: q.optionCriteria.C ?? null,
        optionDCriteria: q.optionCriteria.D ?? null,
        includeInE2ECheck: q.includeInE2ECheck,
        answeringGuideline: q.answeringGuideline,
        complianceWithStandards: q.complianceWithStandards,
        standardSource: q.standardSource,
      },
      create: {
        questionnaireId: questionnaire.id,
        sortOrder: q.sortOrder,
        cognitiveActivity: q.cognitiveActivity,
        serviceCapability: q.serviceCapability,
        questionText: q.questionText,
        weight: q.weight,
        optionAText: q.optionText.A ?? '',
        optionBText: q.optionText.B ?? null,
        optionCText: q.optionText.C ?? null,
        optionDText: q.optionText.D ?? null,
        optionACriteria: q.optionCriteria.A ?? null,
        optionBCriteria: q.optionCriteria.B ?? null,
        optionCCriteria: q.optionCriteria.C ?? null,
        optionDCriteria: q.optionCriteria.D ?? null,
        includeInE2ECheck: q.includeInE2ECheck,
        answeringGuideline: q.answeringGuideline,
        complianceWithStandards: q.complianceWithStandards,
        standardSource: q.standardSource,
      },
    });
  }

  for (const k of parsed.effectivenessIndicators) {
    const data = {
      name: k.name,
      description: k.description,
      weight: k.weight,
      optionAText: k.optionText.A ?? '',
      optionBText: k.optionText.B ?? null,
      optionCText: k.optionText.C ?? null,
      optionDText: k.optionText.D ?? null,
      optionACriteria: k.optionCriteria.A ?? null,
      optionBCriteria: k.optionCriteria.B ?? null,
      optionCCriteria: k.optionCriteria.C ?? null,
      optionDCriteria: k.optionCriteria.D ?? null,
    };
    await prisma.effectivenessIndicator.upsert({
      where: {
        questionnaireId_sortOrder: { questionnaireId: questionnaire.id, sortOrder: k.sortOrder },
      },
      update: data,
      create: { questionnaireId: questionnaire.id, sortOrder: k.sortOrder, ...data },
    });
  }

  await backfillQuestionnaireOrgSettings(questionnaire.id);

  console.log(
    `Seeded questionnaire "${parsed.code}" with ${parsed.subScenarios.length} sub-scenarios, ${parsed.questions.length} questions and ${parsed.effectivenessIndicators.length} KEIs`,
  );
}

// Mirrors organizations.service.ts's createOrganization backfill from the other direction:
// a newly-seeded questionnaire starts accepting responses for every existing organization
// (THIRD_REVIEW.md item 7). Idempotent (skipDuplicates) so re-running the seed is safe.
async function backfillQuestionnaireOrgSettings(questionnaireId: string) {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  if (organizations.length === 0) {
    return;
  }
  await prisma.questionnaireOrgSetting.createMany({
    data: organizations.map((o) => ({
      questionnaireId,
      organizationId: o.id,
      acceptingResponses: true,
    })),
    skipDuplicates: true,
  });
}

// Global-category (organizationId null) rows aren't deduped by the DB — Postgres treats two
// NULLs as distinct, so the @@unique([category, organizationId, name]) constraint doesn't
// fire across them (see schema.prisma's comment on ReferenceListEntry). Dedup explicitly here
// instead of relying on createMany's skipDuplicates, so re-running the seed stays idempotent.
async function seedGlobalReferenceList(category: ReferenceListCategory, values: string[]) {
  const existing = await prisma.referenceListEntry.findMany({
    where: { category, organizationId: null },
    select: { name: true },
  });
  const existingLower = new Set(existing.map((e) => e.name.toLowerCase()));
  const toCreate = [...new Set(values)].filter((v) => !existingLower.has(v.toLowerCase()));
  if (toCreate.length === 0) {
    return;
  }
  await prisma.referenceListEntry.createMany({
    data: toCreate.map((name) => ({ category, name, organizationId: null })),
  });
}

// So nothing already in use by an existing OpCo/User becomes unselectable once the dropdowns
// go live — one ReferenceListEntry per distinct value already present in the DB, on top of
// the standard seeded lists above. Idempotent, safe to rerun.
async function backfillReferenceListsFromExistingData() {
  const [opCos, users] = await Promise.all([
    prisma.opCo.findMany({ select: { name: true, country: true, organizationId: true } }),
    prisma.user.findMany({ select: { workingDomain: true, designation: true } }),
  ]);

  await seedGlobalReferenceList(
    'COUNTRY',
    opCos.map((o) => o.country),
  );
  await seedGlobalReferenceList(
    'WORKING_DOMAIN',
    users.map((u) => u.workingDomain).filter((v): v is string => !!v),
  );
  await seedGlobalReferenceList(
    'DESIGNATION',
    users.map((u) => u.designation).filter((v): v is string => !!v),
  );

  // NatCo Name is org-scoped, so group existing OpCo names by organization first.
  const namesByOrg = new Map<string, Set<string>>();
  for (const opCo of opCos) {
    if (!namesByOrg.has(opCo.organizationId)) {
      namesByOrg.set(opCo.organizationId, new Set());
    }
    namesByOrg.get(opCo.organizationId)!.add(opCo.name);
  }
  for (const [organizationId, names] of namesByOrg) {
    const existing = await prisma.referenceListEntry.findMany({
      where: { category: 'NATCO_NAME', organizationId },
      select: { name: true },
    });
    const existingLower = new Set(existing.map((e) => e.name.toLowerCase()));
    const toCreate = [...names].filter((n) => !existingLower.has(n.toLowerCase()));
    if (toCreate.length === 0) {
      continue;
    }
    await prisma.referenceListEntry.createMany({
      data: toCreate.map((name) => ({ category: 'NATCO_NAME' as const, name, organizationId })),
    });
  }
}

async function seedReferenceLists() {
  await seedGlobalReferenceList('COUNTRY', countries);
  await seedGlobalReferenceList('WORKING_DOMAIN', STARTER_WORKING_DOMAINS);
  await seedGlobalReferenceList('DESIGNATION', STARTER_DESIGNATIONS);
  await backfillReferenceListsFromExistingData();
  console.log('Seeded reference lists (Country/Working Domain/Designation/NatCo Name)');
}

async function main() {
  await seedInternalOrgAndAdmin();
  await seedQuestionnaire(parseRanFmXlsx());
  await seedQuestionnaire(parseCoreFaultManagementXlsx());
  await seedQuestionnaire(parseCoreStabilityXlsx());
  await seedQuestionnaire(parseIpFmXlsx());
  await seedQuestionnaire(parseTransportMicrowaveXlsx());
  await seedQuestionnaire(parseTransportOtnXlsx());
  await seedQuestionnaire(parseFixedAccessXlsx());
  await seedReferenceLists();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
