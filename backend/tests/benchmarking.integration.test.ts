import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { getBenchmarkingSummary, getOpCoBenchmarkingSummary } from '../src/modules/insights/insights.service';
import { getOrCreateResponse, submitResponse, upsertAnswer } from '../src/modules/responses/responses.service';

// Integration test against the real local Postgres. Requires the seed to have already run
// (`npm run db:seed -w backend`) so RAN_FM_GB1059A exists.

const ORG_WITH_SUBMISSIONS_NAME = '__integration-test-benchmark-org-a__';
const ORG_WITHOUT_RESPONDENTS_NAME = '__integration-test-benchmark-org-b__';

let orgAId: string;
let orgBId: string;
const userIds: string[] = [];

async function createUser(orgId: string, label: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-benchmark-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
    },
  });
  userIds.push(user.id);
  return user.id;
}

// Same golden-master override pattern verified in scoring.test.ts / insights tests:
// B for Intent-driven/Processing-Error, B for Data-collection/Communications, A
// everywhere else -> final score 3.9145.
async function submitAllA(userId: string) {
  const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { code: 'RAN_FM_GB1059A' },
    include: { questions: true, subScenarios: true },
  });
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      await upsertAnswer(response.id, userId, {
        questionId: question.id,
        subScenarioId: subScenario.id,
        selectedOption: 'A',
      });
    }
  }
  return submitResponse(response.id, userId);
}

async function submitGoldenMasterPattern(userId: string) {
  const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { code: 'RAN_FM_GB1059A' },
    include: { questions: true, subScenarios: true },
  });
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      let option: 'A' | 'B' = 'A';
      if (question.serviceCapability === 'Intent-driven' && subScenario.code === 'PROCESSING_ERROR') {
        option = 'B';
      }
      if (question.serviceCapability === 'Data collection & Alarm filtering' && subScenario.code === 'COMMUNICATIONS') {
        option = 'B';
      }
      await upsertAnswer(response.id, userId, {
        questionId: question.id,
        subScenarioId: subScenario.id,
        selectedOption: option,
      });
    }
  }
  return submitResponse(response.id, userId);
}

beforeAll(async () => {
  orgAId = (await prisma.organization.create({ data: { name: ORG_WITH_SUBMISSIONS_NAME } })).id;
  orgBId = (await prisma.organization.create({ data: { name: ORG_WITHOUT_RESPONDENTS_NAME } })).id;
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

describe('getBenchmarkingSummary (real DB)', () => {
  it('averages scores across an organization\'s submitters and shows null for an organization with none', async () => {
    const submitter1 = await createUser(orgAId, 'all-a');
    const submitter2 = await createUser(orgAId, 'golden-master');
    await createUser(orgAId, 'not-started'); // counts toward respondentCount, not submittedCount

    await submitAllA(submitter1); // final score 4
    await submitGoldenMasterPattern(submitter2); // final score 3.9145 (verified in scoring.test.ts)

    const summary = await getBenchmarkingSummary('RAN_FM_GB1059A');
    const byName = Object.fromEntries(summary.organizations.map((o) => [o.organizationName, o]));

    const orgA = byName[ORG_WITH_SUBMISSIONS_NAME];
    expect(orgA).toMatchObject({
      respondentCount: 3,
      submittedCount: 2,
      // (4 + 3.9145) / 2 = 3.95725, rounded to 4dp (matches insights.service.ts's `average`)
      averageFinalScore: 3.9573,
    });
    const equipment = orgA?.subScenarioAverages.find((s) => s.subScenarioCode === 'EQUIPMENT');
    expect(equipment?.averageScore).toBe(4); // both submitters scored 4 on Equipment
    const processingError = orgA?.subScenarioAverages.find((s) => s.subScenarioCode === 'PROCESSING_ERROR');
    expect(processingError?.averageScore).toBe(3.915); // (4 + 3.83) / 2, exact at 4dp

    const orgB = byName[ORG_WITHOUT_RESPONDENTS_NAME];
    expect(orgB).toMatchObject({
      respondentCount: 0,
      submittedCount: 0,
      averageFinalScore: null,
      averageE2eAutomationRate: null,
    });
    expect(orgB?.subScenarioAverages.every((s) => s.averageScore === null)).toBe(true);
  });
});

describe('getBenchmarkingSummary groupBy="country" and getOpCoBenchmarkingSummary (real DB)', () => {
  // Country grouping is intentionally global across all organizations (an Admin benchmarks
  // countries cross-org), so these use unique, unmistakably-test-only country names —
  // real country names could collide with data seeded by other tests or manual QA.
  const COUNTRY_A = '__integration-test-country-a__';
  const COUNTRY_B = '__integration-test-country-b__';
  const OPCO_KENYA_NAME = '__integration-test-opco-kenya__';
  const OPCO_NIGERIA_NAME = '__integration-test-opco-nigeria__';
  let opCoKenyaId: string;
  let opCoNigeriaId: string;

  beforeAll(async () => {
    opCoKenyaId = (
      await prisma.opCo.create({ data: { name: OPCO_KENYA_NAME, country: COUNTRY_A, organizationId: orgAId } })
    ).id;
    opCoNigeriaId = (
      await prisma.opCo.create({ data: { name: OPCO_NIGERIA_NAME, country: COUNTRY_B, organizationId: orgAId } })
    ).id;

    const kenyaUser = await createUser(orgAId, 'opco-kenya');
    const nigeriaUser = await createUser(orgAId, 'opco-nigeria');
    await prisma.user.update({ where: { id: kenyaUser }, data: { opCoId: opCoKenyaId } });
    await prisma.user.update({ where: { id: nigeriaUser }, data: { opCoId: opCoNigeriaId } });

    await submitAllA(kenyaUser); // final score 4
    await submitGoldenMasterPattern(nigeriaUser); // final score 3.9145
  });

  afterAll(async () => {
    await prisma.opCo.deleteMany({ where: { id: { in: [opCoKenyaId, opCoNigeriaId] } } });
  });

  it('groups the cross-org benchmarking summary by OpCo.country when groupBy="country"', async () => {
    const summary = await getBenchmarkingSummary('RAN_FM_GB1059A', 'country');
    expect(summary.groupBy).toBe('country');
    const byCountry = Object.fromEntries(summary.organizations.map((o) => [o.organizationName, o]));

    expect(byCountry[COUNTRY_A]).toMatchObject({ respondentCount: 1, submittedCount: 1, averageFinalScore: 4 });
    expect(byCountry[COUNTRY_B]).toMatchObject({
      respondentCount: 1,
      submittedCount: 1,
      averageFinalScore: 3.9145,
    });
  });

  it('benchmarks OpCos within one organization', async () => {
    const summary = await getOpCoBenchmarkingSummary(orgAId, 'RAN_FM_GB1059A');
    expect(summary.organizationId).toBe(orgAId);
    const byName = Object.fromEntries(summary.opCos.map((o) => [o.opCoName, o]));

    expect(byName[OPCO_KENYA_NAME]).toMatchObject({
      country: COUNTRY_A,
      respondentCount: 1,
      submittedCount: 1,
      averageFinalScore: 4,
    });
    expect(byName[OPCO_NIGERIA_NAME]).toMatchObject({
      country: COUNTRY_B,
      respondentCount: 1,
      submittedCount: 1,
      averageFinalScore: 3.9145,
    });
  });
});
