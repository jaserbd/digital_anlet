import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  getAnswerDrilldown,
  getCognitiveActivitySummary,
  getOrganizationQuestionnaireSummary,
} from '../src/modules/insights/insights.service';
import {
  getOrCreateResponse,
  submitResponse,
  upsertAnswer,
  upsertComment,
} from '../src/modules/responses/responses.service';

// Integration test against the real local Postgres. Requires the seed to have already run
// (`npm run db:seed -w backend`) so RAN_FM_GB1059A exists. Creates two throwaway
// organizations to verify the summary is correctly org-scoped (no cross-org leakage).

const ORG_A_NAME = '__integration-test-insights-org-a__';
const ORG_B_NAME = '__integration-test-insights-org-b__';

let orgAId: string;
let orgBId: string;
const userIds: string[] = [];
const opCoIds: string[] = [];

async function createUser(orgId: string, label: string, opCoId?: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-insights-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
      ...(opCoId ? { opCoId } : {}),
    },
  });
  userIds.push(user.id);
  return user.id;
}

async function answerAllAndSubmit(userId: string, orgId: string, override?: { serviceCapability: string; subScenarioCode: string; option: 'A' | 'B' | 'C' | 'D' }) {
  const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { code: 'RAN_FM_GB1059A' },
    include: { questions: true, subScenarios: true },
  });
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      const useOverride =
        override &&
        question.serviceCapability === override.serviceCapability &&
        subScenario.code === override.subScenarioCode;
      await upsertAnswer(response.id, userId, orgId, {
        questionId: question.id,
        subScenarioId: subScenario.id,
        selectedOption: useOverride ? override.option : 'A',
      });
    }
  }
  await submitResponse(response.id, userId, orgId);
}

beforeAll(async () => {
  orgAId = (await prisma.organization.create({ data: { name: ORG_A_NAME } })).id;
  orgBId = (await prisma.organization.create({ data: { name: ORG_B_NAME } })).id;
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.opCo.deleteMany({ where: { id: { in: opCoIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await prisma.$disconnect();
});

describe('getOrganizationQuestionnaireSummary (real DB)', () => {
  it('reports respondent status/score and answer distribution, scoped to one organization', async () => {
    const submitterId = await createUser(orgAId, 'submitter');
    await createUser(orgAId, 'not-started'); // never answers — asserted as NOT_STARTED below
    const otherOrgUserId = await createUser(orgBId, 'other-org');

    // Org A: one submitter answers B for Intent-driven/Equipment, A everywhere else.
    await answerAllAndSubmit(submitterId, orgAId, {
      serviceCapability: 'Intent-driven',
      subScenarioCode: 'EQUIPMENT',
      option: 'B',
    });
    // Org B: a user in a *different* org also submits — must not leak into Org A's summary.
    await answerAllAndSubmit(otherOrgUserId, orgBId, {
      serviceCapability: 'Intent-driven',
      subScenarioCode: 'EQUIPMENT',
      option: 'C',
    });

    const summary = await getOrganizationQuestionnaireSummary(orgAId, 'RAN_FM_GB1059A');

    const respondentsByEmail = Object.fromEntries(summary.respondents.map((r) => [r.email, r]));
    expect(Object.keys(respondentsByEmail)).toHaveLength(2); // only Org A's 2 users, not Org B's
    expect(respondentsByEmail[`__integration-test-insights-submitter__@example.com`]).toMatchObject({
      status: 'SUBMITTED',
      finalScore: expect.any(Number),
    });
    expect(respondentsByEmail[`__integration-test-insights-not-started__@example.com`]).toMatchObject({
      status: 'NOT_STARTED',
      finalScore: null,
    });

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true, subScenarios: true },
    });
    const intentQuestion = questionnaire.questions.find((q) => q.serviceCapability === 'Intent-driven')!;
    const equipmentSubScenario = questionnaire.subScenarios.find((s) => s.code === 'EQUIPMENT')!;
    const otherSubScenario = questionnaire.subScenarios.find((s) => s.code === 'PROCESSING_ERROR')!;

    const equipmentEntry = summary.answerDistribution.find(
      (e) => e.questionId === intentQuestion.id && e.subScenarioId === equipmentSubScenario.id,
    );
    // Only Org A's submitter counted (B), not Org B's submitter (C) -> B:1, C:0.
    expect(equipmentEntry?.counts).toEqual({ A: 0, B: 1, C: 0, D: 0 });

    const otherEntry = summary.answerDistribution.find(
      (e) => e.questionId === intentQuestion.id && e.subScenarioId === otherSubScenario.id,
    );
    expect(otherEntry?.counts).toEqual({ A: 1, B: 0, C: 0, D: 0 });

    expect(summary.answerDistribution).toHaveLength(
      questionnaire.questions.length * questionnaire.subScenarios.length,
    );
  });
});

describe('getAnswerDrilldown (real DB)', () => {
  it('retains individual respondent identity per (question, subScenario, option), scoped to one organization', async () => {
    const drilldownUserId = await createUser(orgAId, 'drilldown-submitter');
    const otherOrgDrilldownUserId = await createUser(orgBId, 'drilldown-other-org');

    // Org A: submits B for Intent-driven/Equipment. Org B: submits C for the same cell —
    // must not leak into Org A's drilldown.
    await answerAllAndSubmit(drilldownUserId, orgAId, {
      serviceCapability: 'Intent-driven',
      subScenarioCode: 'EQUIPMENT',
      option: 'B',
    });
    await answerAllAndSubmit(otherOrgDrilldownUserId, orgBId, {
      serviceCapability: 'Intent-driven',
      subScenarioCode: 'EQUIPMENT',
      option: 'C',
    });

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true, subScenarios: true },
    });
    const intentQuestion = questionnaire.questions.find((q) => q.serviceCapability === 'Intent-driven')!;
    const equipmentSubScenario = questionnaire.subScenarios.find((s) => s.code === 'EQUIPMENT')!;

    const drilldown = await getAnswerDrilldown(orgAId, 'RAN_FM_GB1059A');

    const entryB = drilldown.entries.find(
      (e) => e.questionId === intentQuestion.id && e.subScenarioId === equipmentSubScenario.id && e.option === 'B',
    );
    expect(entryB?.respondents.map((r) => r.email)).toContain(
      '__integration-test-insights-drilldown-submitter__@example.com',
    );

    const entryC = drilldown.entries.find(
      (e) => e.questionId === intentQuestion.id && e.subScenarioId === equipmentSubScenario.id && e.option === 'C',
    );
    expect(entryC).toBeUndefined();
  });

  it('surfaces a respondent comment both inline on their answer entry and in the org-scoped comments list (THIRD_REVIEW.md item 8)', async () => {
    const commenterId = await createUser(orgAId, 'commenter');
    const otherOrgCommenterId = await createUser(orgBId, 'commenter-other-org');

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true, subScenarios: true },
    });
    const intentQuestion = questionnaire.questions.find((q) => q.serviceCapability === 'Intent-driven')!;
    const equipmentSubScenario = questionnaire.subScenarios.find((s) => s.code === 'EQUIPMENT')!;

    const response = await getOrCreateResponse(commenterId, 'RAN_FM_GB1059A');
    for (const question of questionnaire.questions) {
      for (const subScenario of questionnaire.subScenarios) {
        await upsertAnswer(response.id, commenterId, orgAId, {
          questionId: question.id,
          subScenarioId: subScenario.id,
          selectedOption: 'A',
        });
      }
    }
    await upsertComment(response.id, commenterId, orgAId, {
      questionId: intentQuestion.id,
      commentText: 'Automated end-to-end for this sub-scenario.',
      subScenarioIds: [equipmentSubScenario.id],
      appliesToNone: false,
    });
    await submitResponse(response.id, commenterId, orgAId);

    // A different org's comment must not leak into Org A's drilldown.
    await answerAllAndSubmit(otherOrgCommenterId, orgBId);

    const drilldown = await getAnswerDrilldown(orgAId, 'RAN_FM_GB1059A');

    const answerEntry = drilldown.entries.find(
      (e) => e.questionId === intentQuestion.id && e.subScenarioId === equipmentSubScenario.id && e.option === 'A',
    );
    const commenterRespondent = answerEntry?.respondents.find(
      (r) => r.email === '__integration-test-insights-commenter__@example.com',
    );
    expect(commenterRespondent?.comment).toBe('Automated end-to-end for this sub-scenario.');

    const commentEntry = drilldown.comments.find(
      (c) => c.questionId === intentQuestion.id && c.respondent.email === commenterRespondent?.email,
    );
    expect(commentEntry).toMatchObject({
      subScenarioIds: [equipmentSubScenario.id],
      appliesToNone: false,
      commentText: 'Automated end-to-end for this sub-scenario.',
      respondent: expect.objectContaining({ userId: commenterId }),
    });
    expect(drilldown.comments.some((c) => c.respondent.userId === otherOrgCommenterId)).toBe(false);
  });
});

describe('getCognitiveActivitySummary (real DB)', () => {
  async function finalScoreOf(userId: string): Promise<number> {
    const result = await prisma.scoreResult.findFirstOrThrow({ where: { response: { userId } } });
    return Number(result.finalScore);
  }

  it('averages per Cognitive Activity and overall final score across an org, scoped and filterable by OpCo', async () => {
    const opCo = await prisma.opCo.create({ data: { name: '__test-opco__', country: 'Testland', organizationId: orgAId } });
    opCoIds.push(opCo.id);

    const inOpCoUserId = await createUser(orgAId, 'cog-in-opco', opCo.id);
    const noOpCoUserId = await createUser(orgAId, 'cog-no-opco');
    const otherOrgUserId = await createUser(orgBId, 'cog-other-org');

    await answerAllAndSubmit(inOpCoUserId, orgAId, {
      serviceCapability: 'Intent-driven',
      subScenarioCode: 'EQUIPMENT',
      option: 'B',
    });
    await answerAllAndSubmit(noOpCoUserId, orgAId);
    // A different org's submission must not leak into Org A's summary.
    await answerAllAndSubmit(otherOrgUserId, orgBId);

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true },
    });
    const distinctActivities = new Set(questionnaire.questions.map((q) => q.cognitiveActivity));

    // Other tests in this file also submit RAN_FM_GB1059A responses into Org A, so the
    // unfiltered sampleSize isn't exactly 2 here — assert shape/bounds instead of an exact
    // count, and rely on the OpCo/Country-scoped assertions below (this test's own OpCo is
    // otherwise untouched) for a precise number.
    const orgSummary = await getCognitiveActivitySummary(orgAId, 'RAN_FM_GB1059A', {});
    const scoreA = await finalScoreOf(inOpCoUserId);
    expect(orgSummary.sampleSize).toBeGreaterThanOrEqual(2);
    expect(new Set(orgSummary.activities.map((a) => a.cognitiveActivity))).toEqual(distinctActivities);
    expect(orgSummary.activities.every((a) => a.averageScore == null || (a.averageScore >= 0 && a.averageScore <= 4))).toBe(true);

    const opCoScoped = await getCognitiveActivitySummary(orgAId, 'RAN_FM_GB1059A', { opCoId: opCo.id });
    expect(opCoScoped.sampleSize).toBe(1);
    expect(opCoScoped.averageFinalScore).toBeCloseTo(scoreA, 4);

    const countryScoped = await getCognitiveActivitySummary(orgAId, 'RAN_FM_GB1059A', { country: 'Testland' });
    expect(countryScoped.sampleSize).toBe(1);
    expect(countryScoped.averageFinalScore).toBeCloseTo(scoreA, 4);
  });
});
