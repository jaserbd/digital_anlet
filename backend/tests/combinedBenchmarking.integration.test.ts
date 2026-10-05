import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { callerFor } from './testUsers';
import { getCombinedBenchmarkingSummary } from '../src/modules/insights/insights.service';
import { HVS_GROUPS } from '../src/modules/questionnaire/hvsGroups';
import { getOrCreateResponse, submitResponse, upsertAnswer } from '../src/modules/responses/responses.service';

// Integration test against the real local Postgres. Requires the seed to have already run
// (`npm run db:seed -w backend`) so CORE_FM_GB1059B/CORE_STABILITY_GB1059B exist.

const CORE_GROUP = HVS_GROUPS.find((g) => g.groupCode === 'CORE_FM_STABILITY')!;

const ORG_BOTH_HALVES_NAME = '__integration-test-combined-benchmark-org-both__';
const ORG_ONE_HALF_NAME = '__integration-test-combined-benchmark-org-one__';

let orgBothId: string;
let orgOneId: string;
const userIds: string[] = [];

async function createUser(orgId: string, label: string) {
  const user = await prisma.user.create({
    data: {
      email: `__integration-test-combined-benchmark-${label}__@example.com`,
      passwordHash: 'not-a-real-hash',
      role: 'NORMAL_USER',
      organizationId: orgId,
      memberships: { create: { organizationId: orgId, role: 'NORMAL_USER' } },
    },
  });
  userIds.push(user.id);
  return user.id;
}

// All-A on every question/sub-scenario compensates every capped question up to the
// ceiling for both Core questionnaires (verified in scoring.test.ts: Core FM's Equipment
// sub-scenario reaches exactly 4 all-A; Core Stability has no capped question at all), so a
// full all-A submission gives finalScore = 4 for either questionnaire.
async function submitAllA(userId: string, questionnaireCode: string) {
  const response = await getOrCreateResponse(await callerFor(userId), questionnaireCode);
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { code: questionnaireCode },
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

beforeAll(async () => {
  orgBothId = (await prisma.organization.create({ data: { name: ORG_BOTH_HALVES_NAME } })).id;
  orgOneId = (await prisma.organization.create({ data: { name: ORG_ONE_HALF_NAME } })).id;
});

afterAll(async () => {
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgBothId, orgOneId] } } });
  await prisma.$disconnect();
});

describe('getCombinedBenchmarkingSummary (real DB)', () => {
  it('blends both halves 50/50 for an org that submitted both, and returns null combined for an org missing one half', async () => {
    const bothUser = await createUser(orgBothId, 'both-halves');
    await submitAllA(bothUser, CORE_GROUP.questionnaireCodes[0]!);
    await submitAllA(bothUser, CORE_GROUP.questionnaireCodes[1]!);

    const oneUser = await createUser(orgOneId, 'one-half');
    await submitAllA(oneUser, CORE_GROUP.questionnaireCodes[0]!);
    // Deliberately no Stability submission for orgOneId.

    const summary = await getCombinedBenchmarkingSummary(CORE_GROUP);
    const byName = Object.fromEntries(summary.rows.map((r) => [r.organizationName, r]));

    const orgBoth = byName[ORG_BOTH_HALVES_NAME];
    expect(orgBoth?.faultManagement.averageFinalScore).toBe(4);
    expect(orgBoth?.stability.averageFinalScore).toBe(4);
    expect(orgBoth?.combinedAverageFinalScore).toBe(4);

    const orgOne = byName[ORG_ONE_HALF_NAME];
    expect(orgOne?.faultManagement.averageFinalScore).toBe(4);
    expect(orgOne?.stability.averageFinalScore).toBeNull();
    expect(orgOne?.combinedAverageFinalScore).toBeNull();
  });

  it('scopes to a single organization when one is provided', async () => {
    const summary = await getCombinedBenchmarkingSummary(CORE_GROUP, orgBothId);
    expect(summary.rows.every((r) => r.organizationId === orgBothId)).toBe(true);
  });
});
