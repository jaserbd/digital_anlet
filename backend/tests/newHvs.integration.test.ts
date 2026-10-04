import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AnswerOption } from '@anlet/shared';
import { prisma } from '../src/lib/prisma';
import { getQuestionnaireByCode } from '../src/modules/questionnaire/questionnaire.service';
import {
  InvalidKeiError,
  UncoveredSkipError,
  getOrCreateResponse,
  getResponse,
  getResult,
  submitResponse,
  upsertAnswer,
  upsertComment,
  upsertKei,
} from '../src/modules/responses/responses.service';
import {
  getAnswerDrilldown,
  getOpCoBenchmarkingSummary,
} from '../src/modules/insights/insights.service';

// End-to-end (service layer, real DB) check of the IP / Transport / Fixed Access
// questionnaires added from NEW_HVS_PLAN.md Phase A, and their Key Effectiveness Indicators
// (Phase B). Requires the seed to have run. Each test uses its own throwaway user
// (single-shot response per user per questionnaire).

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

// Answers every (question, subScenario) cell with `pick`, and — unless `keiPick` is null —
// every KEI with `keiPick` (default: option A), since KEIs must be covered to submit.
async function answerAll(
  code: string,
  label: string,
  pick: (q: { cognitiveActivity: string }) => AnswerOption,
  skip?: { questionIndex: number; subScenarioIndex: number },
  keiPick: ((sortOrder: number) => AnswerOption) | null = () => 'A',
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
  if (keiPick) {
    for (const k of questionnaire.effectivenessIndicators) {
      await upsertKei(response.id, userId, orgId, {
        indicatorId: k.id,
        selectedOption: keiPick(k.sortOrder),
        indicatorValue: null,
        comment: null,
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
  {
    code: 'IP_FM_GB1523E',
    networkType: 'IP',
    subScenarios: 8,
    questions: 8,
    keis: 3,
    hasE2ECheck: true,
    categorized: true,
  },
  {
    code: 'TRANSPORT_MW_FM_GB1523D',
    networkType: 'Transport',
    subScenarios: 4,
    questions: 9,
    keis: 2,
    hasE2ECheck: false,
    categorized: true,
  },
  {
    code: 'TRANSPORT_OTN_FM_GB1523D',
    networkType: 'Transport',
    subScenarios: 6,
    questions: 8,
    keis: 4,
    hasE2ECheck: false,
    categorized: true,
  },
  {
    code: 'FIXED_ACCESS_FM_GB1523C',
    networkType: 'Fixed Access',
    subScenarios: 4,
    questions: 9,
    keis: 0,
    hasE2ECheck: true,
    categorized: false,
  },
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
    expect(questionnaire.effectivenessIndicators).toHaveLength(expected.keis);
    expect(questionnaire.keiNote != null).toBe(expected.keis > 0);
    for (const k of questionnaire.effectivenessIndicators) {
      expect(k.options.map((o) => [o.option, o.criteria])).toEqual([
        ['A', 4],
        ['B', 3],
        ['C', 2],
      ]);
    }
    expect(
      questionnaire.subScenarios.every((s) => (s.category != null) === expected.categorized),
    ).toBe(true);
    // Every offered option carries a numeric criterion.
    for (const q of questionnaire.questions) {
      expect(q.options.every((o) => typeof o.criteria === 'number')).toBe(true);
    }
  });

  it('submits an all-A response and persists a matching result (score 4 via compensation)', async () => {
    const { userId, response, questionnaire } = await answerAll(expected.code, 'all-a', () => 'A');
    const result = await submitResponse(response.id, userId, orgId);
    expect(result.finalScore).toBe(4);
    expect(result.keiScore).toBe(expected.keis > 0 ? 4 : null);
    expect(result.subScenarioScores).toHaveLength(expected.subScenarios);
    expect(result.questionScores).toHaveLength(expected.subScenarios * expected.questions);
    // Order-sensitive: persisted result must come back in computeScoreResult's order.
    expect(await getResult(response.id, userId)).toEqual(result);

    const benchmark = await getOpCoBenchmarkingSummary(orgId, expected.code);
    const row = benchmark.rows.find((r) => r.submittedCount > 0)!;
    expect(row.averageFinalScore).toBe(4);
    expect(row.averageKeiScore).toBe(expected.keis > 0 ? 4 : null);
    expect(row.subScenarioAverages).toHaveLength(questionnaire.subScenarios.length);

    const drilldown = await getAnswerDrilldown(orgId, expected.code);
    const answeredCells = drilldown.entries.filter((e) => e.option === 'A');
    expect(answeredCells).toHaveLength(expected.subScenarios * expected.questions);
    expect(drilldown.keiResponses.filter((k) => k.selectedOption === 'A')).toHaveLength(
      expected.keis,
    );
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

describe('Key Effectiveness Indicators (real DB)', () => {
  it("reproduces IP_FM.xlsx's cached KEI score (B, C, C → 2.4)", async () => {
    const demo = ['B', 'C', 'C'] as const;
    const { userId, response } = await answerAll(
      'IP_FM_GB1523E',
      'kei-demo',
      () => 'A',
      undefined,
      (i) => demo[i]!,
    );
    const result = await submitResponse(response.id, userId, orgId);
    expect(result.keiScore).toBeCloseTo(2.4, 4);
    expect((await getResult(response.id, userId)).keiScore).toBeCloseTo(2.4, 4);
  });

  it('blocks submit while a KEI is neither answered nor explained, listing it', async () => {
    const { userId, response, questionnaire } = await answerAll(
      'TRANSPORT_OTN_FM_GB1523D',
      'kei-missing',
      () => 'A',
      undefined,
      null,
    );
    const [first, second] = questionnaire.effectivenessIndicators;
    // An indicator value alone doesn't cover a KEI — only an answer or a comment does.
    await upsertKei(response.id, userId, orgId, {
      indicatorId: first!.id,
      selectedOption: null,
      indicatorValue: '85%',
      comment: null,
    });
    await upsertKei(response.id, userId, orgId, {
      indicatorId: second!.id,
      selectedOption: 'B',
      indicatorValue: null,
      comment: null,
    });

    await expect(submitResponse(response.id, userId, orgId)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(UncoveredSkipError);
      expect((err as UncoveredSkipError).missing).toHaveLength(0);
      expect((err as UncoveredSkipError).missingKeis).toEqual(
        questionnaire.effectivenessIndicators.filter((k) => k.id !== second!.id).map((k) => k.id),
      );
      return true;
    });
  });

  it('accepts a KEI skipped with a comment and re-normalizes the KEI score over the rest', async () => {
    // Microwave: MTTR (weight 0.6) skipped with a comment, automation rate (0.4) answered C (2).
    const { userId, response, questionnaire } = await answerAll(
      'TRANSPORT_MW_FM_GB1523D',
      'kei-skip',
      () => 'A',
      undefined,
      null,
    );
    const [mttr, automation] = questionnaire.effectivenessIndicators;
    await upsertKei(response.id, userId, orgId, {
      indicatorId: mttr!.id,
      selectedOption: null,
      indicatorValue: null,
      comment: 'Not measured yet.',
    });
    await upsertKei(response.id, userId, orgId, {
      indicatorId: automation!.id,
      selectedOption: 'C',
      indicatorValue: ' 55% ',
      comment: null,
    });

    const result = await submitResponse(response.id, userId, orgId);
    expect(result.keiScore).toBe(2);

    const stored = await getResponse(response.id, userId);
    expect(stored.keiAnswers).toEqual(
      expect.arrayContaining([
        {
          indicatorId: mttr!.id,
          selectedOption: null,
          indicatorValue: null,
          comment: 'Not measured yet.',
        },
        { indicatorId: automation!.id, selectedOption: 'C', indicatorValue: '55%', comment: null },
      ]),
    );
    const drilldown = await getAnswerDrilldown(orgId, 'TRANSPORT_MW_FM_GB1523D');
    expect(
      drilldown.keiResponses.some(
        (k) => k.comment === 'Not measured yet.' && k.respondent.userId === userId,
      ),
    ).toBe(true);
  });

  it('clears a KEI back to unanswered when every field is empty', async () => {
    const { userId, response, questionnaire } = await answerAll(
      'IP_FM_GB1523E',
      'kei-clear',
      () => 'A',
    );
    const indicatorId = questionnaire.effectivenessIndicators[0]!.id;
    await upsertKei(response.id, userId, orgId, {
      indicatorId,
      selectedOption: null,
      indicatorValue: '  ',
      comment: '',
    });
    const stored = await getResponse(response.id, userId);
    expect(stored.keiAnswers.some((k) => k.indicatorId === indicatorId)).toBe(false);
  });

  it("rejects an option the KEI doesn't offer, or another questionnaire's KEI", async () => {
    const { userId, response, questionnaire } = await answerAll(
      'IP_FM_GB1523E',
      'kei-invalid',
      () => 'A',
    );
    const ip = questionnaire.effectivenessIndicators[0]!;
    await expect(
      upsertKei(response.id, userId, orgId, {
        indicatorId: ip.id,
        selectedOption: 'D',
        indicatorValue: null,
        comment: null,
      }),
    ).rejects.toBeInstanceOf(InvalidKeiError);

    const otn = await getQuestionnaireByCode('TRANSPORT_OTN_FM_GB1523D', orgId);
    await expect(
      upsertKei(response.id, userId, orgId, {
        indicatorId: otn.effectivenessIndicators[0]!.id,
        selectedOption: 'A',
        indicatorValue: null,
        comment: null,
      }),
    ).rejects.toBeInstanceOf(InvalidKeiError);
  });
});
