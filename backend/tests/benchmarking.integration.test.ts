import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { callerFor } from './testUsers';
import { getBenchmarkingSummary, getOpCoBenchmarkingSummary } from '../src/modules/insights/insights.service';
import {
  getOrCreateResponse,
  submitResponse,
  upsertAnswer,
  upsertComment,
} from '../src/modules/responses/responses.service';

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
      memberships: { create: { organizationId: orgId, role: 'NORMAL_USER' } },
    },
  });
  userIds.push(user.id);
  return user.id;
}

// Same golden-master override pattern verified in scoring.test.ts / insights tests:
// B for Intent-driven/Processing-Error, B for Data-collection/Communications, A
// everywhere else -> final score 3.9145.
// All callers in this file use orgAId — every submitter created here belongs to Org A.
async function submitAllA(userId: string) {
  const response = await getOrCreateResponse(await callerFor(userId), 'RAN_FM_GB1059A');
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
  const response = await getOrCreateResponse(await callerFor(userId), 'RAN_FM_GB1059A');
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
  it("averages scores across an organization's submitters and shows null for an organization with none", async () => {
    const submitter1 = await createUser(orgAId, 'all-a');
    const submitter2 = await createUser(orgAId, 'golden-master');
    await createUser(orgAId, 'not-started'); // counts toward respondentCount, not submittedCount

    await submitAllA(submitter1); // final score 4
    await submitGoldenMasterPattern(submitter2); // final score 3.9145 (verified in scoring.test.ts)

    // THIRD_REVIEW.md item 8: commentCount should reflect QuestionComment rows across this
    // group's SUBMITTED responses — one comment from submitter1, none from submitter2.
    const submitter1Response = await getOrCreateResponse(await callerFor(submitter1), 'RAN_FM_GB1059A');
    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true },
    });
    await upsertComment(submitter1Response.id, submitter1, {
      questionId: questionnaire.questions[0]!.id,
      commentText: 'Great automation coverage here.',
      subScenarioIds: [],
      appliesToNone: true,
    });

    const summary = await getBenchmarkingSummary('RAN_FM_GB1059A');
    // Neither org has any OpCo yet at this point in the test, so each gets exactly one
    // synthetic row whose opCoName falls back to the organization's own name.
    const byName = Object.fromEntries(summary.rows.map((r) => [r.organizationName, r]));

    const orgA = byName[ORG_WITH_SUBMISSIONS_NAME];
    expect(orgA).toMatchObject({
      opCoId: null,
      opCoName: ORG_WITH_SUBMISSIONS_NAME,
      country: null,
      respondentCount: 3,
      submittedCount: 2,
      // (4 + 3.9145) / 2 = 3.95725, rounded to 4dp (matches insights.service.ts's `average`)
      averageFinalScore: 3.9573,
      commentCount: 1,
    });
    const equipment = orgA?.subScenarioAverages.find((s) => s.subScenarioCode === 'EQUIPMENT');
    expect(equipment?.averageScore).toBe(4); // both submitters scored 4 on Equipment
    const processingError = orgA?.subScenarioAverages.find((s) => s.subScenarioCode === 'PROCESSING_ERROR');
    expect(processingError?.averageScore).toBe(3.915); // (4 + 3.83) / 2, exact at 4dp

    const orgB = byName[ORG_WITHOUT_RESPONDENTS_NAME];
    expect(orgB).toMatchObject({
      opCoId: null,
      opCoName: ORG_WITHOUT_RESPONDENTS_NAME,
      respondentCount: 0,
      submittedCount: 0,
      averageFinalScore: null,
      averageE2eAutomationRate: null,
      commentCount: 0,
    });
    expect(orgB?.subScenarioAverages.every((s) => s.averageScore === null)).toBe(true);
  });
});

describe('getBenchmarkingSummary NatCo/country rows and getOpCoBenchmarkingSummary (real DB)', () => {
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
    await prisma.membership.updateMany({ where: { userId: kenyaUser }, data: { opCoId: opCoKenyaId } });
    await prisma.membership.updateMany({ where: { userId: nigeriaUser }, data: { opCoId: opCoNigeriaId } });

    await submitAllA(kenyaUser); // final score 4
    await submitGoldenMasterPattern(nigeriaUser); // final score 3.9145
  });

  afterAll(async () => {
    await prisma.opCo.deleteMany({ where: { id: { in: [opCoKenyaId, opCoNigeriaId] } } });
  });

  it('includes each OpCo as its own row, carrying Organization/NatCo/Country together', async () => {
    const summary = await getBenchmarkingSummary('RAN_FM_GB1059A');
    const byOpCoName = Object.fromEntries(summary.rows.map((r) => [r.opCoName, r]));

    expect(byOpCoName[OPCO_KENYA_NAME]).toMatchObject({
      organizationName: ORG_WITH_SUBMISSIONS_NAME,
      country: COUNTRY_A,
      respondentCount: 1,
      submittedCount: 1,
      averageFinalScore: 4,
    });
    expect(byOpCoName[OPCO_NIGERIA_NAME]).toMatchObject({
      organizationName: ORG_WITH_SUBMISSIONS_NAME,
      country: COUNTRY_B,
      respondentCount: 1,
      submittedCount: 1,
      averageFinalScore: 3.9145,
    });
  });

  it('benchmarks OpCos within one organization, including a synthetic row for unassigned respondents', async () => {
    const summary = await getOpCoBenchmarkingSummary(orgAId, 'RAN_FM_GB1059A');
    expect(summary.organizationId).toBe(orgAId);
    const byName = Object.fromEntries(summary.rows.map((o) => [o.opCoName, o]));

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
    // The 3 users created in the first describe block (submitter1/2, not-started) still
    // have no opCoId — they land in a synthetic row rather than being silently dropped.
    expect(byName[ORG_WITH_SUBMISSIONS_NAME]).toMatchObject({
      opCoId: null,
      country: null,
      respondentCount: 3,
      submittedCount: 2,
    });
  });
});
