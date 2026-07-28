import type {
  AnswerDistributionEntryDto,
  AnswerDrilldownDto,
  AnswerDrilldownEntryDto,
  AnswerOption,
  AnswerOptionCounts,
  BenchmarkingSummaryDto,
  BenchmarkRowDto,
  OpCoBenchmarkingSummaryDto,
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
 * Per-respondent answer visibility for Executive/Admin (SECOND_REVIEW.md item 10) — unlike
 * getOrganizationQuestionnaireSummary's aggregate-only answerDistribution, this retains each
 * individual respondent (email, OpCo/country, workingDomain/designation) behind every
 * (question, subScenario, option) they chose. Scoped to SUBMITTED responses only, same
 * convention as the rest of this module. Callers are responsible for authorizing that
 * `organizationId` is one the requester may view (same convention as
 * getOrganizationQuestionnaireSummary).
 */
export async function getAnswerDrilldown(
  organizationId: string,
  questionnaireCode: string,
): Promise<AnswerDrilldownDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const answers = await prisma.answer.findMany({
    where: {
      response: { questionnaireId: questionnaire.id, status: 'SUBMITTED', user: { organizationId } },
    },
    select: {
      questionId: true,
      subScenarioId: true,
      selectedOption: true,
      response: {
        select: {
          user: {
            select: {
              id: true,
              email: true,
              workingDomain: true,
              designation: true,
              opCo: { select: { name: true, country: true } },
            },
          },
        },
      },
    },
  });

  const byKey = new Map<string, AnswerDrilldownEntryDto>();
  for (const a of answers) {
    const key = `${a.questionId}:${a.subScenarioId}:${a.selectedOption}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        questionId: a.questionId,
        subScenarioId: a.subScenarioId,
        option: a.selectedOption,
        respondents: [],
      };
      byKey.set(key, entry);
    }
    entry.respondents.push({
      userId: a.response.user.id,
      email: a.response.user.email,
      opCoName: a.response.user.opCo?.name ?? null,
      country: a.response.user.opCo?.country ?? null,
      workingDomain: a.response.user.workingDomain,
      designation: a.response.user.designation,
    });
  }

  return { questionnaireCode: questionnaire.code, entries: [...byKey.values()] };
}

interface BenchmarkRowLabel {
  organizationId: string;
  organizationName: string;
  opCoId: string | null;
  opCoName: string;
  country: string | null;
}

function rowKey(organizationId: string, opCoId: string | null): string {
  return `${organizationId}:${opCoId ?? 'none'}`;
}

/**
 * One row per (Organization, OpCo) pair, optionally scoped to a single organization —
 * shared by getBenchmarkingSummary (cross-org, Admin) and getOpCoBenchmarkingSummary
 * (single-org, Executive/Admin). A synthetic "no OpCo" row (opCoId/country null, opCoName
 * falls back to the organization's own name) is included for any organization that either
 * has zero OpCos at all (small orgs) or has at least one NORMAL_USER not yet assigned one —
 * SECOND_REVIEW.md item 9's "for small organizations, NatCo and Organization will be the
 * same" plus not silently dropping unassigned respondents from the table.
 */
async function computeBenchmarkRows(
  questionnaire: { id: string; subScenarios: { code: SubScenarioCode }[] },
  scopeOrganizationId?: string,
): Promise<BenchmarkRowDto[]> {
  const orgWhere = scopeOrganizationId ? { id: scopeOrganizationId } : {};
  const organizations = await prisma.organization.findMany({
    where: orgWhere,
    orderBy: { name: 'asc' },
    include: { opCos: { orderBy: { name: 'asc' } } },
  });

  const unassignedUserOrgIds = new Set(
    (
      await prisma.user.findMany({
        where: {
          role: 'NORMAL_USER',
          opCoId: null,
          ...(scopeOrganizationId ? { organizationId: scopeOrganizationId } : {}),
        },
        select: { organizationId: true },
        distinct: ['organizationId'],
      })
    ).map((u) => u.organizationId),
  );

  const rowLabels: BenchmarkRowLabel[] = [];
  for (const org of organizations) {
    for (const opCo of org.opCos) {
      rowLabels.push({
        organizationId: org.id,
        organizationName: org.name,
        opCoId: opCo.id,
        opCoName: opCo.name,
        country: opCo.country,
      });
    }
    if (org.opCos.length === 0 || unassignedUserOrgIds.has(org.id)) {
      rowLabels.push({
        organizationId: org.id,
        organizationName: org.name,
        opCoId: null,
        opCoName: org.name,
        country: null,
      });
    }
  }

  const respondentCounts = await prisma.user.groupBy({
    by: ['organizationId', 'opCoId'],
    where: { role: 'NORMAL_USER', ...(scopeOrganizationId ? { organizationId: scopeOrganizationId } : {}) },
    _count: { _all: true },
  });
  const respondentCountByKey = new Map(
    respondentCounts.map((r) => [rowKey(r.organizationId, r.opCoId), r._count._all]),
  );

  const submittedResponses = await prisma.questionnaireResponse.findMany({
    where: {
      questionnaireId: questionnaire.id,
      status: 'SUBMITTED',
      ...(scopeOrganizationId ? { user: { organizationId: scopeOrganizationId } } : {}),
    },
    include: {
      user: { select: { organizationId: true, opCoId: true } },
      result: { include: { subScenarioScores: { include: { subScenario: true } } } },
    },
  });
  const byKey = groupScores(submittedResponses, (r) => rowKey(r.user.organizationId, r.user.opCoId));

  return rowLabels.map((label) => {
    const key = rowKey(label.organizationId, label.opCoId);
    const acc = byKey.get(key);
    return {
      organizationId: label.organizationId,
      organizationName: label.organizationName,
      opCoId: label.opCoId,
      opCoName: label.opCoName,
      country: label.country,
      respondentCount: respondentCountByKey.get(key) ?? 0,
      submittedCount: acc?.finalScores.length ?? 0,
      averageFinalScore: average(acc?.finalScores ?? []),
      averageE2eAutomationRate: average(acc?.e2eRates ?? []),
      subScenarioAverages: subScenarioAverages(acc, questionnaire.subScenarios),
    };
  });
}

async function loadQuestionnaireForBenchmarking(questionnaireCode: string) {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { code: questionnaireCode },
    include: { subScenarios: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }
  return questionnaire;
}

/**
 * Cross-organization benchmarking for Admin (REQUIREMENTS.md, Group3_Admin) — one row per
 * (Organization, OpCo) pair, so Organization/NatCo/Country are always visible together
 * rather than being exclusive grouping modes (SECOND_REVIEW.md item 9). Averages are
 * computed only over SUBMITTED responses; a row with none gets null averages (not 0 — 0
 * would misleadingly read as "scored zero").
 */
export async function getBenchmarkingSummary(questionnaireCode: string): Promise<BenchmarkingSummaryDto> {
  const questionnaire = await loadQuestionnaireForBenchmarking(questionnaireCode);
  const rows = await computeBenchmarkRows(questionnaire);
  return { questionnaireCode: questionnaire.code, rows };
}

/**
 * Benchmarks OpCos within a single organization — the Group CTO / Admin view of "how do my
 * NatCos compare for this HVS" (FIRST_REVIEW.md). Same row shape and averaging rules as
 * getBenchmarkingSummary, scoped to one organizationId. Callers are responsible for
 * authorizing that `organizationId` is one the requester may view (same convention as
 * getOrganizationQuestionnaireSummary).
 */
export async function getOpCoBenchmarkingSummary(
  organizationId: string,
  questionnaireCode: string,
): Promise<OpCoBenchmarkingSummaryDto> {
  const questionnaire = await loadQuestionnaireForBenchmarking(questionnaireCode);
  const rows = await computeBenchmarkRows(questionnaire, organizationId);
  return { questionnaireCode: questionnaire.code, organizationId, rows };
}
