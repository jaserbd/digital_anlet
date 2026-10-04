import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnswerOption } from '@anlet/shared';
import { prisma } from '../src/lib/prisma';
import { getQuestionnaireByCode } from '../src/modules/questionnaire/questionnaire.service';
import {
  getOrCreateResponse,
  getResult,
  submitResponse,
  upsertAnswer,
  upsertComment,
} from '../src/modules/responses/responses.service';
import { getAnswerDrilldown, getOpCoBenchmarkingSummary } from '../src/modules/insights/insights.service';

// End-to-end (service layer, real DB) check of the IP / Transport / Fixed Access
// questionnaires added from NEW_HVS_PLAN.md Phase A. Requires the seed to have run. Each
// test uses its own throwaway user (single-shot response per user per questionnaire).

const TEST_ORG_NAME = '__integration-test-new-hvs-org__';

const userIds: string[] = [];
let orgId: string;

async function createTestUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-new-hvs-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
    },
  });
  userIds.push(user.id);
  return user.id;
}

async function answerAll(
  code: string,
  label: string,
  pick: (q: { cognitiveActivity: string }) => AnswerOption,
  skip?: { questionIndex: number; subScenarioIndex: number },
) {
  const userId = await createTestUser(`${code}-${label}`);
  const questionnaire = await getQuestionnaireByCode(code, orgId);
  const response = await getOrCreateResponse(userId, code);
  for (const [qi, q] of questionnaire.questions.entries()) {
    for (const [si, s] of questionnaire.subScenarios.entries()) {
      if (skip && skip.questionIndex === qi && skip.subScenarioIndex === si) continue;
      await upsertAnswer(response.id, userId, orgId, {
        questionId: q.id,
        subScenarioId: s.id,
        selectedOption: pick(q),
      });
    }
  }
  return { userId, response, questionnaire };
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: TEST_ORG_NAME } });
  orgId = org.id;
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

const NEW_QUESTIONNAIRES = [
  { code: 'IP_FM_GB1523E', networkType: 'IP', subScenarios: 8, questions: 8, hasE2ECheck: true, categorized: true },
  { code: 'TRANSPORT_MW_FM_GB1523D', networkType: 'Transport', subScenarios: 4, questions: 9, hasE2ECheck: false, categorized: true },
  { code: 'TRANSPORT_OTN_FM_GB1523D', networkType: 'Transport', subScenarios: 6, questions: 8, hasE2ECheck: false, categorized: true },
  { code: 'FIXED_ACCESS_FM_GB1523C', networkType: 'Fixed Access', subScenarios: 4, questions: 9, hasE2ECheck: true, categorized: false },
] as const;

describe.each(NEW_QUESTIONNAIRES)('$code (real DB)', (expected) => {
  it('is served by the questionnaire API with its sub-scenarios, categories and criteria', async () => {
    const questionnaire = await getQuestionnaireByCode(expected.code, orgId);
    expect(questionnaire.networkType).toBe(expected.networkType);
    expect(questionnaire.hasE2ECheck).toBe(expected.hasE2ECheck);
    expect(questionnaire.acceptingResponses).toBe(true);
    expect(questionnaire.guidelineText).toBeTruthy();
    expect(questionnaire.subScenarios).toHaveLength(expected.subScenarios);
    expect(questionnaire.questions).toHaveLength(expected.questions);
    expect(questionnaire.subScenarios.every((s) => (s.category != null) === expected.categorized)).toBe(true);
    // Every offered option carries a numeric criterion.
    for (const q of questionnaire.questions) {
      expect(q.options.every((o) => typeof o.criteria === 'number')).toBe(true);
    }
  });

  it('submits an all-A response and persists a matching result (score 4 via compensation)', async () => {
    const { userId, response, questionnaire } = await answerAll(expected.code, 'all-a', () => 'A');
    const result = await submitResponse(response.id, userId, orgId);
    expect(result.finalScore).toBe(4);
    expect(result.subScenarioScores).toHaveLength(expected.subScenarios);
    expect(result.questionScores).toHaveLength(expected.subScenarios * expected.questions);
    // Order-sensitive: persisted result must come back in computeScoreResult's order.
    expect(await getResult(response.id, userId)).toEqual(result);

    const benchmark = await getOpCoBenchmarkingSummary(orgId, expected.code);
    const row = benchmark.rows.find((r) => r.submittedCount > 0)!;
    expect(row.averageFinalScore).toBe(4);
    expect(row.subScenarioAverages).toHaveLength(questionnaire.subScenarios.length);

    const drilldown = await getAnswerDrilldown(orgId, expected.code);
    const answeredCells = drilldown.entries.filter((e) => e.option === 'A');
    expect(answeredCells).toHaveLength(expected.subScenarios * expected.questions);
  });

  it('accepts a skip covered by a sub-scenario-tagged comment and re-normalizes the score', async () => {
    const { userId, response, questionnaire } = await answerAll(expected.code, 'skip', () => 'A', {
      questionIndex: 0,
      subScenarioIndex: 0,
    });
    await upsertComment(response.id, userId, orgId, {
      questionId: questionnaire.questions[0]!.id,
      commentText: 'Not applicable here.',
      subScenarioIds: [questionnaire.subScenarios[0]!.id],
      appliesToNone: false,
    });
    const result = await submitResponse(response.id, userId, orgId);
    expect(result.finalScore).toBe(4);
    expect(result.questionScores.filter((qs) => qs.compensatedScore === null)).toHaveLength(1);
  });
});

describe('IP_FM_GB1523E demo answers (real DB)', () => {
  it("reproduces IP_FM.xlsx's cached capability score 0.9 and E2E rate 0", async () => {
    // The workbook's demo: D everywhere, C for Solution Implementation (which has no D).
    const { userId, response } = await answerAll('IP_FM_GB1523E', 'demo', (q) =>
      q.cognitiveActivity === 'Execution' ? 'C' : 'D',
    );
    const result = await submitResponse(response.id, userId, orgId);
    expect(result.finalScore).toBeCloseTo(0.9, 4);
    expect(result.e2eAutomationRate).toBe(0);
  });
});
