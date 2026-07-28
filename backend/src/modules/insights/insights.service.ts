import type {
  AnswerDistributionEntryDto,
  AnswerOption,
  AnswerOptionCounts,
  BenchmarkingGroupBy,
  BenchmarkingSummaryDto,
  OpCoBenchmarkDto,
  OpCoBenchmarkingSummaryDto,
  OrganizationBenchmarkDto,
  OrganizationQuestionnaireSummaryDto,
  RespondentSummaryDto,
  SubScenarioAverageDto,
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

// Shared by getBenchmarkingSummary (group by organization or country) and
// getOpCoBenchmarkingSummary (group by OpCo within one organization) — the underlying
// "average a submitted response's score into whichever group it belongs to" computation
// is identical, only the grouping key differs.
interface ScoreAccumulator {
  finalScores: number[];
  e2eRates: number[];
  subScenarioScores: Map<SubScenarioCode, number[]>;
}

interface ScoredResponseLike {
  result: {
    finalScore: unknown;
    e2eAutomationRate: unknown;
    subScenarioScores: { overallScore: unknown; subScenario: { code: SubScenarioCode } }[];
  } | null;
}

function groupScores<T extends ScoredResponseLike, K extends string>(
  responses: T[],
  keyOf: (response: T) => K | null,
): Map<K, ScoreAccumulator> {
  const byKey = new Map<K, ScoreAccumulator>();
  for (const response of responses) {
    if (!response.result) continue; // shouldn't happen for SUBMITTED, but guards a partial write
    const key = keyOf(response);
    if (key == null) continue;
    const acc = byKey.get(key) ?? {
      finalScores: [],
      e2eRates: [],
      subScenarioScores: new Map<SubScenarioCode, number[]>(),
    };
    acc.finalScores.push(Number(response.result.finalScore));
    acc.e2eRates.push(Number(response.result.e2eAutomationRate));
    for (const s of response.result.subScenarioScores) {
      if (s.overallScore == null) continue; // fully-skipped sub-scenario — excluded, not 0
      const scores = acc.subScenarioScores.get(s.subScenario.code) ?? [];
      scores.push(Number(s.overallScore));
      acc.subScenarioScores.set(s.subScenario.code, scores);
    }
    byKey.set(key, acc);
  }
  return byKey;
}

function subScenarioAverages(
  acc: ScoreAccumulator | undefined,
  subScenarios: { code: SubScenarioCode }[],
): SubScenarioAverageDto[] {
  return subScenarios.map((s) => ({
    subScenarioCode: s.code,
    averageScore: average(acc?.subScenarioScores.get(s.code) ?? []),
  }));
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
 * Cross-organization (or cross-country) comparison for Admin benchmarking
 * (REQUIREMENTS.md, Group3_Admin). Averages are computed only over SUBMITTED responses; a
 * group with none gets null averages (not 0 — 0 would misleadingly read as "scored zero").
 *
 * `groupBy: 'country'` groups by each respondent's OpCo.country instead of their
 * organizationId — respondents with no OpCo assigned yet are excluded from that grouping
 * (there's no country to attribute them to). Reuses `OrganizationBenchmarkDto`'s shape for
 * both modes: in country mode, `organizationId`/`organizationName` both hold the country
 * name (used as the row key and label respectively) rather than an actual organization.
 */
export async function getBenchmarkingSummary(
  questionnaireCode: string,
  groupBy: BenchmarkingGroupBy = 'organization',
): Promise<BenchmarkingSummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: { subScenarios: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const submittedResponses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId: questionnaire.id, status: 'SUBMITTED' },
    include: {
      user: { select: { organizationId: true, opCo: { select: { country: true } } } },
      result: { include: { subScenarioScores: { include: { subScenario: true } } } },
    },
  });

  let groupLabels: { id: string; name: string }[];
  let respondentCountByGroup: Map<string, number>;
  let byGroup: Map<string, ScoreAccumulator>;

  if (groupBy === 'organization') {
    const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' } });
    groupLabels = organizations.map((org) => ({ id: org.id, name: org.name }));

    const respondentCounts = await prisma.user.groupBy({
      by: ['organizationId'],
      where: { role: 'NORMAL_USER' },
      _count: { _all: true },
    });
    respondentCountByGroup = new Map(respondentCounts.map((r) => [r.organizationId, r._count._all]));

    byGroup = groupScores(submittedResponses, (r) => r.user.organizationId);
  } else {
    const countries = await prisma.opCo.findMany({
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    });
    groupLabels = countries.map((c) => ({ id: c.country, name: c.country }));

    const usersWithCountry = await prisma.user.findMany({
      where: { role: 'NORMAL_USER', opCoId: { not: null } },
      select: { opCo: { select: { country: true } } },
    });
    respondentCountByGroup = new Map();
    for (const u of usersWithCountry) {
      const country = u.opCo!.country;
      respondentCountByGroup.set(country, (respondentCountByGroup.get(country) ?? 0) + 1);
    }

    byGroup = groupScores(submittedResponses, (r) => r.user.opCo?.country ?? null);
  }

  const organizationBenchmarks: OrganizationBenchmarkDto[] = groupLabels.map((group) => {
    const acc = byGroup.get(group.id);
    return {
      organizationId: group.id,
      organizationName: group.name,
      respondentCount: respondentCountByGroup.get(group.id) ?? 0,
      submittedCount: acc?.finalScores.length ?? 0,
      averageFinalScore: average(acc?.finalScores ?? []),
      averageE2eAutomationRate: average(acc?.e2eRates ?? []),
      subScenarioAverages: subScenarioAverages(acc, questionnaire.subScenarios),
    };
  });

  return {
    questionnaireCode: questionnaire.code,
    groupBy,
    organizations: organizationBenchmarks,
  };
}

/**
 * Benchmarks OpCos within a single organization — the Group CTO / Admin view of "how do my
 * NatCos compare for this HVS" (FIRST_REVIEW.md). Same averaging rules as
 * getBenchmarkingSummary; scoped to one organizationId. Callers are responsible for
 * authorizing that `organizationId` is one the requester may view (same convention as
 * getOrganizationQuestionnaireSummary).
 */
export async function getOpCoBenchmarkingSummary(
  organizationId: string,
  questionnaireCode: string,
): Promise<OpCoBenchmarkingSummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: { subScenarios: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const opCos = await prisma.opCo.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

  const respondentCounts = await prisma.user.groupBy({
    by: ['opCoId'],
    where: { organizationId, role: 'NORMAL_USER', opCoId: { not: null } },
    _count: { _all: true },
  });
  const respondentCountByOpCo = new Map(
    respondentCounts.map((r) => [r.opCoId as string, r._count._all]),
  );

  const submittedResponses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId: questionnaire.id, status: 'SUBMITTED', user: { organizationId } },
    include: {
      user: { select: { opCoId: true } },
      result: { include: { subScenarioScores: { include: { subScenario: true } } } },
    },
  });

  const byOpCo = groupScores(submittedResponses, (r) => r.user.opCoId);

  const opCoBenchmarks: OpCoBenchmarkDto[] = opCos.map((opCo) => {
    const acc = byOpCo.get(opCo.id);
    return {
      opCoId: opCo.id,
      opCoName: opCo.name,
      country: opCo.country,
      respondentCount: respondentCountByOpCo.get(opCo.id) ?? 0,
      submittedCount: acc?.finalScores.length ?? 0,
      averageFinalScore: average(acc?.finalScores ?? []),
      averageE2eAutomationRate: average(acc?.e2eRates ?? []),
      subScenarioAverages: subScenarioAverages(acc, questionnaire.subScenarios),
    };
  });

  return { questionnaireCode: questionnaire.code, organizationId, opCos: opCoBenchmarks };
}
