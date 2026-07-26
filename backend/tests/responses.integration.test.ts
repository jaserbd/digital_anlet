import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  ForbiddenError,
  IncompleteResponseError,
  getOrCreateResponse,
  getResult,
  submitResponse,
  upsertAnswer,
} from '../src/modules/responses/responses.service';

// Integration tests against the real local Postgres (see docker-compose.yml). Requires the
// seed to have already run (`npm run db:seed -w backend`) so the RAN_FM_GB1059A
// questionnaire exists. Creates and tears down its own throwaway org/users — each test
// uses its own user so the single-shot-per-user response semantics don't create
// ordering dependencies between tests.

const TEST_ORG_NAME = '__integration-test-org__';

const userIds: string[] = [];
let orgId: string;

async function createTestUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
    },
  });
  userIds.push(user.id);
  return user.id;
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: TEST_ORG_NAME } });
  orgId = org.id;
});

afterAll(async () => {
  // Cascades: QuestionnaireResponse -> Answer, ScoreResult -> SubScenarioScoreResult.
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

describe('responses full submit flow (real DB)', () => {
  it('creates a response, records answers, submits, and computes a matching persisted result', async () => {
    const userId = await createTestUser('submitter');
    const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');
    expect(response.status).toBe('IN_PROGRESS');

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

    const result = await submitResponse(response.id, userId);
    // All-A across every question/sub-scenario -> every score hits its ceiling and every
    // sub-scenario achieves E2E, matching the scoring.test.ts unit-test golden master.
    expect(result.finalScore).toBe(4);
    expect(result.e2eAutomationRate).toBe(1);
    expect(result.subScenarioScores).toHaveLength(5);
    expect(result.subScenarioScores.every((s) => s.e2eAchieved)).toBe(true);

    const persisted = await getResult(response.id, userId);
    expect(persisted).toEqual(result);

    const updated = await prisma.questionnaireResponse.findUniqueOrThrow({
      where: { id: response.id },
    });
    expect(updated.status).toBe('SUBMITTED');
    expect(updated.submittedAt).not.toBeNull();

    // Single-shot for MVP: revisiting after submit returns the same submitted response,
    // not a fresh blank one (this was a real bug caught during manual browser testing).
    const revisited = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');
    expect(revisited.id).toBe(response.id);
    expect(revisited.status).toBe('SUBMITTED');
  });

  it('rejects submitting an incomplete response', async () => {
    const userId = await createTestUser('incomplete');
    const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
      where: { code: 'RAN_FM_GB1059A' },
      include: { questions: true, subScenarios: true },
    });
    const firstQuestion = questionnaire.questions[0]!;
    const firstSubScenario = questionnaire.subScenarios[0]!;
    await upsertAnswer(response.id, userId, {
      questionId: firstQuestion.id,
      subScenarioId: firstSubScenario.id,
      selectedOption: 'A',
    });

    await expect(submitResponse(response.id, userId)).rejects.toBeInstanceOf(
      IncompleteResponseError,
    );
  });

  it('rejects another user from reading or answering someone else’s response', async () => {
    const userId = await createTestUser('owner');
    const otherUserId = await createTestUser('intruder');
    const response = await getOrCreateResponse(userId, 'RAN_FM_GB1059A');

    await expect(
      upsertAnswer(response.id, otherUserId, {
        questionId: 'irrelevant',
        subScenarioId: 'irrelevant',
        selectedOption: 'A',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
