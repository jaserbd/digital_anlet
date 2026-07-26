import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { getBenchmarkingSummary } from '../src/modules/insights/insights.service';
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
