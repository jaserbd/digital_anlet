import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { callerFor } from './testUsers';
import {
  AcceptanceClosedError,
  deleteAnswer,
  getOrCreateResponse,
  submitResponse,
  upsertAnswer,
  upsertComment,
} from '../src/modules/responses/responses.service';
import { setAcceptingResponses } from '../src/modules/questionnaire/questionnaire.service';

// Integration test against the real local Postgres. Uses its own throwaway Questionnaire
// (not the shared seeded RAN_FM_GB1059A) — even though acceptingResponses is now
// per-organization (THIRD_REVIEW.md item 7), toggling it on the real seeded questionnaire
// could still race with other test files concurrently submitting against RAN_FM_GB1059A
// (vitest runs test files in parallel).

const ORG_NAME = '__integration-test-accepting-org__';
const OTHER_ORG_NAME = '__integration-test-accepting-other-org__';
const QUESTIONNAIRE_CODE = '__integration-test-accepting-questionnaire__';

let orgId: string;
let otherOrgId: string;
let questionnaireId: string;
let questionId: string;
let subScenarioId: string;
const userIds: string[] = [];

async function createUser(label: string, forOrgId: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-accepting-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: forOrgId,
      memberships: { create: { organizationId: forOrgId, role: 'NORMAL_USER' } },
    },
  });
  userIds.push(user.id);
  return user.id;
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: ORG_NAME } });
  orgId = org.id;
  const otherOrg = await prisma.organization.create({ data: { name: OTHER_ORG_NAME } });
  otherOrgId = otherOrg.id;

  const questionnaire = await prisma.questionnaire.create({
    data: {
      code: QUESTIONNAIRE_CODE,
      name: 'Accepting-toggle test questionnaire',
      networkType: 'RAN',
      hvsCategory: 'Fault Management',
      hasE2ECheck: false,
    },
  });
  questionnaireId = questionnaire.id;

  const subScenario = await prisma.subScenario.create({
    data: {
      questionnaireId,
      code: 'OVERALL',
      name: 'Overall',
      faultDistributionWeight: 1,
      sortOrder: 0,
    },
  });
  subScenarioId = subScenario.id;

  const question = await prisma.question.create({
    data: {
      questionnaireId,
      sortOrder: 0,
      cognitiveActivity: 'Intent',
      serviceCapability: 'Test capability',
      questionText: 'Test question?',
      weight: 1,
      optionAText: 'Option A',
      optionBText: 'Option B',
      optionACriteria: 4,
      optionBCriteria: 0,
      includeInE2ECheck: false,
    },
  });
  questionId = question.id;
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.questionnaireOrgSetting.deleteMany({ where: { questionnaireId } });
  await prisma.question.deleteMany({ where: { questionnaireId } });
  await prisma.subScenario.deleteMany({ where: { questionnaireId } });
  await prisma.questionnaire.delete({ where: { id: questionnaireId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.organization.delete({ where: { id: otherOrgId } });
  await prisma.$disconnect();
});

describe('acceptingResponses toggle (real DB)', () => {
  it('allows editing and re-submitting an already-SUBMITTED response while still accepting responses, updating the score', async () => {
    const userId = await createUser('reopen', orgId);
    const response = await getOrCreateResponse(await callerFor(userId), QUESTIONNAIRE_CODE);

    await upsertAnswer(response.id, userId, { questionId, subScenarioId, selectedOption: 'A' });
    const firstResult = await submitResponse(response.id, userId);
    expect(firstResult.finalScore).toBe(4);

    const submittedOnce = await prisma.questionnaireResponse.findUniqueOrThrow({
      where: { id: response.id },
    });
    expect(submittedOnce.status).toBe('SUBMITTED');
    const firstSubmittedAt = submittedOnce.submittedAt!;

    // Still accepting responses -> editing and re-submitting an already-SUBMITTED response
    // is legal, not blocked (SECOND_REVIEW.md item 1) — score is recomputed from scratch.
    await upsertAnswer(response.id, userId, { questionId, subScenarioId, selectedOption: 'B' });
    const secondResult = await submitResponse(response.id, userId);
    expect(secondResult.finalScore).toBe(0);

    const resubmitted = await prisma.questionnaireResponse.findUniqueOrThrow({
      where: { id: response.id },
    });
    expect(resubmitted.status).toBe('SUBMITTED');
    expect(resubmitted.submittedAt!.getTime()).toBeGreaterThan(firstSubmittedAt.getTime());
  });

  it('blocks every mutation once the questionnaire stops accepting responses for that organization, including for an already-SUBMITTED response', async () => {
    const userId = await createUser('closed', orgId);
    const response = await getOrCreateResponse(await callerFor(userId), QUESTIONNAIRE_CODE);
    await upsertAnswer(response.id, userId, { questionId, subScenarioId, selectedOption: 'A' });
    await submitResponse(response.id, userId);

    await setAcceptingResponses(QUESTIONNAIRE_CODE, orgId, false);
    try {
      await expect(
        upsertAnswer(response.id, userId, { questionId, subScenarioId, selectedOption: 'B' }),
      ).rejects.toBeInstanceOf(AcceptanceClosedError);
      await expect(
        deleteAnswer(response.id, userId, { questionId, subScenarioId }),
      ).rejects.toBeInstanceOf(AcceptanceClosedError);
      await expect(
        upsertComment(response.id, userId, {
          questionId,
          commentText: 'test comment',
          subScenarioIds: [],
          appliesToNone: true,
        }),
      ).rejects.toBeInstanceOf(AcceptanceClosedError);
      await expect(submitResponse(response.id, userId)).rejects.toBeInstanceOf(AcceptanceClosedError);
    } finally {
      // Reset so this doesn't leak into other tests within this same describe/file.
      await setAcceptingResponses(QUESTIONNAIRE_CODE, orgId, true);
    }
  });

  it('closing for one organization does not affect another organization (THIRD_REVIEW.md item 7)', async () => {
    const closedOrgUserId = await createUser('independence-closed-org', orgId);
    const otherOrgUserId = await createUser('independence-other-org', otherOrgId);

    await setAcceptingResponses(QUESTIONNAIRE_CODE, orgId, false);
    try {
      const closedOrgResponse = await getOrCreateResponse(await callerFor(closedOrgUserId), QUESTIONNAIRE_CODE);
      await expect(
        upsertAnswer(closedOrgResponse.id, closedOrgUserId, {
          questionId,
          subScenarioId,
          selectedOption: 'A',
        }),
      ).rejects.toBeInstanceOf(AcceptanceClosedError);

      // otherOrgId was never closed -> fully independent, unaffected by orgId's toggle.
      const otherOrgResponse = await getOrCreateResponse(await callerFor(otherOrgUserId), QUESTIONNAIRE_CODE);
      await upsertAnswer(otherOrgResponse.id, otherOrgUserId, {
        questionId,
        subScenarioId,
        selectedOption: 'A',
      });
      const result = await submitResponse(otherOrgResponse.id, otherOrgUserId);
      expect(result.finalScore).toBe(4);
    } finally {
      await setAcceptingResponses(QUESTIONNAIRE_CODE, orgId, true);
    }
  });
});
