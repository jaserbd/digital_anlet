import { env } from '../../src/config/env';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';
import { parseRanFmXlsx } from './parseRanFmXlsx';

const INTERNAL_ORG_NAME = 'Anlet (Internal)';

async function seedInternalOrgAndAdmin() {
  const org = await prisma.organization.upsert({
    where: { name: INTERNAL_ORG_NAME },
    update: {},
    create: { name: INTERNAL_ORG_NAME },
  });

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { passwordHash, role: 'ADMIN', organizationId: org.id },
    create: {
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  console.log(`Seeded internal org "${INTERNAL_ORG_NAME}" and admin user "${env.ADMIN_EMAIL}"`);
}

async function seedRanFmQuestionnaire() {
  const parsed = parseRanFmXlsx();

  const questionnaire = await prisma.questionnaire.upsert({
    where: { code: parsed.code },
    update: {
      name: parsed.name,
      networkType: parsed.networkType,
      hvsCategory: parsed.hvsCategory,
    },
    create: {
      code: parsed.code,
      name: parsed.name,
      networkType: parsed.networkType,
      hvsCategory: parsed.hvsCategory,
    },
  });

  for (const s of parsed.subScenarios) {
    await prisma.subScenario.upsert({
      where: { questionnaireId_code: { questionnaireId: questionnaire.id, code: s.code } },
      update: {
        name: s.name,
        description: s.description,
        faultDistributionWeight: s.faultDistributionWeight,
        sortOrder: s.sortOrder,
      },
      create: {
        questionnaireId: questionnaire.id,
        code: s.code,
        name: s.name,
        description: s.description,
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
        complianceWithStandards: q.complianceWithStandards,
        standardSource: q.standardSource,
      },
    });
  }

  console.log(
    `Seeded questionnaire "${parsed.code}" with ${parsed.subScenarios.length} sub-scenarios and ${parsed.questions.length} questions`,
  );
}

async function main() {
  await seedInternalOrgAndAdmin();
  await seedRanFmQuestionnaire();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
