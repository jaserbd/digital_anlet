import type {
  AnswerDistributionEntryDto,
  AnswerOption,
  AnswerOptionCounts,
  BenchmarkingSummaryDto,
  OrganizationBenchmarkDto,
  OrganizationQuestionnaireSummaryDto,
  RespondentSummaryDto,
  SubScenarioCode,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';

export class QuestionnaireNotFoundError extends Error {}

function emptyCounts(): AnswerOptionCounts {
  return { A: 0, B: 0, C: 0, D: 0 };
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(mean * 10000) / 10000;
}

/**
 * Per-question, per-sub-scenario answer distribution and per-respondent status for an
 * organization — the data behind the Executive's "how many people picked option A for
 * question 1" view (REQUIREMENTS.md, Group2_Executive). Distribution counts are scoped to
 * SUBMITTED responses only, so in-progress answers don't skew the picture. Callers are
 * responsible for authorizing that `organizationId` is one the requester may view.
 */
export async function getOrganizationQuestionnaireSummary(
  organizationId: string,
  questionnaireCode: string,
): Promise<OrganizationQuestionnaireSummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: {
      questions: { orderBy: { sortOrder: 'asc' } },
      subScenarios: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const users = await prisma.user.findMany({
    where: { organizationId, role: 'NORMAL_USER' },
    orderBy: { email: 'asc' },
    include: {
      responses: {
        where: { questionnaireId: questionnaire.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { result: true },
      },
    },
  });

  const respondents: RespondentSummaryDto[] = users.map((u) => {
    const latest = u.responses[0];
    return {
      userId: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: latest?.status ?? 'NOT_STARTED',
      finalScore: latest?.result ? Number(latest.result.finalScore) : null,
    };
  });

  const grouped = await prisma.answer.groupBy({
    by: ['questionId', 'subScenarioId', 'selectedOption'],
    where: {
      response: { questionnaireId: questionnaire.id, status: 'SUBMITTED', user: { organizationId } },
    },
    _count: { _all: true },
  });

  const countsByKey = new Map<string, AnswerOptionCounts>();
  for (const row of grouped) {
    const key = `${row.questionId}:${row.subScenarioId}`;
    const counts = countsByKey.get(key) ?? emptyCounts();
    counts[row.selectedOption as AnswerOption] = row._count._all;
    countsByKey.set(key, counts);
  }

  const answerDistribution: AnswerDistributionEntryDto[] = [];
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      const key = `${question.id}:${subScenario.id}`;
      answerDistribution.push({
        questionId: question.id,
        subScenarioId: subScenario.id,
        counts: countsByKey.get(key) ?? emptyCounts(),
      });
    }
  }

  return { questionnaireCode: questionnaire.code, respondents, answerDistribution };
}

/**
 * Cross-organization comparison for Admin benchmarking (REQUIREMENTS.md, Group3_Admin).
 * Averages are computed only over SUBMITTED responses; an organization with none gets
 * null averages (not 0 — 0 would misleadingly read as "scored zero").
 */
export async function getBenchmarkingSummary(questionnaireCode: string): Promise<BenchmarkingSummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: { subScenarios: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' } });

  const respondentCounts = await prisma.user.groupBy({
    by: ['organizationId'],
    where: { role: 'NORMAL_USER' },
    _count: { _all: true },
  });
  const respondentCountByOrg = new Map(respondentCounts.map((r) => [r.organizationId, r._count._all]));

  const submittedResponses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId: questionnaire.id, status: 'SUBMITTED' },
    include: {
      user: { select: { organizationId: true } },
      result: { include: { subScenarioScores: { include: { subScenario: true } } } },
    },
  });

  interface Accumulator {
    finalScores: number[];
    e2eRates: number[];
    subScenarioScores: Map<SubScenarioCode, number[]>;
  }
  const byOrg = new Map<string, Accumulator>();
  for (const response of submittedResponses) {
    if (!response.result) continue; // shouldn't happen for SUBMITTED, but guards a partial write
    const orgId = response.user.organizationId;
    const acc = byOrg.get(orgId) ?? {
      finalScores: [],
      e2eRates: [],
      subScenarioScores: new Map<SubScenarioCode, number[]>(),
    };
    acc.finalScores.push(Number(response.result.finalScore));
    acc.e2eRates.push(Number(response.result.e2eAutomationRate));
    for (const s of response.result.subScenarioScores) {
      const scores = acc.subScenarioScores.get(s.subScenario.code) ?? [];
      scores.push(Number(s.overallScore));
      acc.subScenarioScores.set(s.subScenario.code, scores);
    }
    byOrg.set(orgId, acc);
  }

  const organizationBenchmarks: OrganizationBenchmarkDto[] = organizations.map((org) => {
    const acc = byOrg.get(org.id);
    return {
      organizationId: org.id,
      organizationName: org.name,
      respondentCount: respondentCountByOrg.get(org.id) ?? 0,
      submittedCount: acc?.finalScores.length ?? 0,
      averageFinalScore: average(acc?.finalScores ?? []),
      averageE2eAutomationRate: average(acc?.e2eRates ?? []),
      subScenarioAverages: questionnaire.subScenarios.map((s) => ({
        subScenarioCode: s.code,
        averageScore: average(acc?.subScenarioScores.get(s.code) ?? []),
      })),
    };
  });

  return { questionnaireCode: questionnaire.code, organizations: organizationBenchmarks };
}
