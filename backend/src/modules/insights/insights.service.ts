import type { Role } from '@anlet/shared';
import type {
  AnswerDistributionEntryDto,
  AnswerDrilldownDto,
  AnswerDrilldownEntryDto,
  AnswerOption,
  AnswerOptionCounts,
  BenchmarkingSummaryDto,
  BenchmarkRowDto,
  CognitiveActivityAverageDto,
  CognitiveActivitySummaryDto,
  CombinedBenchmarkingSummaryDto,
  CombinedBenchmarkRowDto,
  CommentDrilldownEntryDto,
  CrossOrgCommentCollectionDto,
  CrossOrgCommentEntryDto,
  CrossOrgKeiCommentEntryDto,
  DrilldownRespondentIdentityDto,
  KeiDrilldownEntryDto,
  OpCoBenchmarkingSummaryDto,
  OrganizationQuestionnaireSummaryDto,
  RespondentSummaryDto,
  SubScenarioAverageDto,
  SubScenarioCode,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { round4 } from '../../lib/rounding';

export class QuestionnaireNotFoundError extends Error {}

// An Executive can now also answer/submit a questionnaire personally (MANAGEMENT_VIEW.md
// item 2) — that response merges into the same Respondents table / benchmarking averages a
// Normal User's does, so every respondent-scoped query below counts both roles. Admin never
// answers questionnaires and is excluded.
const RESPONDENT_ROLES: Role[] = ['NORMAL_USER', 'EXECUTIVE'];

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
  keiScores: number[];
  commentCount: number;
}

interface ScoredResponseLike {
  result: {
    finalScore: unknown;
    e2eAutomationRate: unknown;
    keiScore: unknown;
    subScenarioScores: { overallScore: unknown; subScenario: { code: SubScenarioCode } }[];
  } | null;
  _count: { comments: number };
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
      keiScores: [],
      commentCount: 0,
    };
    acc.finalScores.push(Number(response.result.finalScore));
    acc.e2eRates.push(Number(response.result.e2eAutomationRate));
    // Null when the questionnaire has no KEIs or every KEI was skipped — excluded, not 0.
    if (response.result.keiScore != null) acc.keiScores.push(Number(response.result.keiScore));
    acc.commentCount += response._count.comments;
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
    where: { organizationId, role: { in: RESPONDENT_ROLES } },
    orderBy: { email: 'asc' },
    include: {
      opCo: { select: { id: true, name: true, country: true } },
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
      opCoId: u.opCo?.id ?? null,
      opCoName: u.opCo?.name ?? null,
      country: u.opCo?.country ?? null,
      workingDomain: u.workingDomain,
      designation: u.designation,
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

type IdentitySourceUser = {
  id: string;
  email: string;
  workingDomain: string | null;
  designation: string | null;
  opCo: { id: string; name: string; country: string } | null;
};

function toIdentity(user: IdentitySourceUser): DrilldownRespondentIdentityDto {
  return {
    userId: user.id,
    email: user.email,
    opCoId: user.opCo?.id ?? null,
    opCoName: user.opCo?.name ?? null,
    country: user.opCo?.country ?? null,
    workingDomain: user.workingDomain,
    designation: user.designation,
  };
}

// One respondent's KEI state, as selected for the drill-down and comment-collection views.
const KEI_STATE_SELECT = {
  indicatorId: true,
  selectedOption: true,
  indicatorValue: true,
  comment: true,
} as const;

const IDENTITY_SELECT = {
  id: true,
  email: true,
  workingDomain: true,
  designation: true,
  opCo: { select: { id: true, name: true, country: true } },
} as const;

/**
 * Per-respondent answer visibility for Executive/Admin (SECOND_REVIEW.md item 10) — unlike
 * getOrganizationQuestionnaireSummary's aggregate-only answerDistribution, this retains each
 * individual respondent (email, OpCo/country, workingDomain/designation) behind every
 * (question, subScenario, option) they chose, plus (THIRD_REVIEW.md item 8) that
 * respondent's own comment for the specific question, and the full org-scoped comment list
 * independently (`comments`) for the Organization Deep-Dive page and GroupedCommentsList.
 * Scoped to SUBMITTED responses only, same convention as the rest of this module. Callers
 * are responsible for authorizing that `organizationId` is one the requester may view (same
 * convention as getOrganizationQuestionnaireSummary).
 */
export async function getAnswerDrilldown(
  organizationId: string,
  questionnaireCode: string,
): Promise<AnswerDrilldownDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const responseScope = { questionnaireId: questionnaire.id, status: 'SUBMITTED' as const, user: { organizationId } };

  const [answers, comments, keis] = await Promise.all([
    prisma.answer.findMany({
      where: { response: responseScope },
      select: {
        questionId: true,
        subScenarioId: true,
        selectedOption: true,
        response: { select: { user: { select: IDENTITY_SELECT } } },
      },
    }),
    prisma.questionComment.findMany({
      where: { response: responseScope },
      select: {
        questionId: true,
        commentText: true,
        appliesToNone: true,
        subScenarios: { select: { subScenarioId: true } },
        response: { select: { user: { select: IDENTITY_SELECT } } },
      },
    }),
    prisma.responseKei.findMany({
      where: { response: responseScope },
      orderBy: { indicator: { sortOrder: 'asc' } },
      select: {
        ...KEI_STATE_SELECT,
        response: { select: { user: { select: IDENTITY_SELECT } } },
      },
    }),
  ]);

  const commentByUserAndQuestion = new Map<string, string>();
  const commentEntries: CommentDrilldownEntryDto[] = comments.map((c) => {
    commentByUserAndQuestion.set(`${c.response.user.id}:${c.questionId}`, c.commentText);
    return {
      questionId: c.questionId,
      subScenarioIds: c.subScenarios.map((s) => s.subScenarioId),
      appliesToNone: c.appliesToNone,
      commentText: c.commentText,
      respondent: toIdentity(c.response.user),
    };
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
      ...toIdentity(a.response.user),
      comment: commentByUserAndQuestion.get(`${a.response.user.id}:${a.questionId}`) ?? null,
    });
  }

  const keiResponses: KeiDrilldownEntryDto[] = keis.map((k) => ({
    indicatorId: k.indicatorId,
    selectedOption: k.selectedOption,
    indicatorValue: k.indicatorValue,
    comment: k.comment,
    respondent: toIdentity(k.response.user),
  }));

  return {
    questionnaireCode: questionnaire.code,
    entries: [...byKey.values()],
    comments: commentEntries,
    keiResponses,
  };
}

/**
 * IAADE/Cognitive-Activity spider-chart data for Executive/Admin (ADMIN_2.md item 1) — the
 * aggregate analogue of what a Normal User already gets for free from their own
 * ScoreResultDto.questionScores. Averages QuestionScoreResult.compensatedScore across
 * SUBMITTED responses, grouped by each question's cognitiveActivity (ordered by that
 * activity's first question sortOrder, mirroring the frontend's groupByCognitiveActivity
 * contiguous-run assumption), plus the same responses' overall finalScore for the headline
 * number shown next to the chart. A null averageScore/averageFinalScore means no matching
 * SUBMITTED response had a score there — never a misleading 0 (same convention as
 * computeBenchmarkRows below). Callers are responsible for authorizing that `organizationId`
 * is one the requester may view (same convention as getAnswerDrilldown).
 */
export async function getCognitiveActivitySummary(
  organizationId: string,
  questionnaireCode: string,
  filters: { opCoId?: string; country?: string },
): Promise<CognitiveActivitySummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const scoreResults = await prisma.scoreResult.findMany({
    where: {
      response: {
        questionnaireId: questionnaire.id,
        status: 'SUBMITTED',
        user: {
          organizationId,
          ...(filters.opCoId ? { opCoId: filters.opCoId } : {}),
          ...(filters.country ? { opCo: { country: filters.country } } : {}),
        },
      },
    },
    select: {
      finalScore: true,
      questionScores: {
        select: {
          compensatedScore: true,
          question: { select: { cognitiveActivity: true, sortOrder: true } },
        },
      },
    },
  });

  const byActivity = new Map<string, { sum: number; count: number; sortOrder: number }>();
  let finalScoreSum = 0;
  for (const sr of scoreResults) {
    finalScoreSum += Number(sr.finalScore);
    for (const qs of sr.questionScores) {
      if (qs.compensatedScore == null) continue; // skipped — excluded, not 0 (scoring.ts convention)
      const key = qs.question.cognitiveActivity;
      const entry = byActivity.get(key) ?? { sum: 0, count: 0, sortOrder: qs.question.sortOrder };
      entry.sum += Number(qs.compensatedScore);
      entry.count += 1;
      byActivity.set(key, entry);
    }
  }

  const activities: CognitiveActivityAverageDto[] = [...byActivity.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([cognitiveActivity, entry]) => ({
      cognitiveActivity,
      averageScore: entry.count > 0 ? round4(entry.sum / entry.count) : null,
    }));

  return {
    activities,
    averageFinalScore: scoreResults.length > 0 ? round4(finalScoreSum / scoreResults.length) : null,
    sampleSize: scoreResults.length,
  };
}

/**
 * Cross-organization Comment Collection for Admin (ADMIN.md item 3) — the unscoped analogue
 * of getAnswerDrilldown's `comments` half: every comment for this questionnaire across every
 * organization at once, each carrying its respondent's organization identity (which
 * getAnswerDrilldown's per-org callers have no need for, since it's already implied by the
 * organizationId they passed in). Scoped to SUBMITTED responses only, same convention as the
 * rest of this module.
 */
export async function getCrossOrgCommentCollection(questionnaireCode: string): Promise<CrossOrgCommentCollectionDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const userWithOrg = {
    select: { ...IDENTITY_SELECT, organization: { select: { id: true, name: true } } },
  };
  const [comments, keiComments] = await Promise.all([
    prisma.questionComment.findMany({
      where: { response: { questionnaireId: questionnaire.id, status: 'SUBMITTED' } },
      select: {
        questionId: true,
        commentText: true,
        appliesToNone: true,
        subScenarios: { select: { subScenarioId: true } },
        response: { select: { user: userWithOrg } },
      },
    }),
    // KEI comments (NEW_HVS_PLAN.md Phase B) join the same collection.
    prisma.responseKei.findMany({
      where: {
        response: { questionnaireId: questionnaire.id, status: 'SUBMITTED' },
        comment: { not: null },
      },
      orderBy: { indicator: { sortOrder: 'asc' } },
      select: { ...KEI_STATE_SELECT, response: { select: { user: userWithOrg } } },
    }),
  ]);

  const commentEntries: CrossOrgCommentEntryDto[] = comments.map((c) => ({
    questionId: c.questionId,
    subScenarioIds: c.subScenarios.map((s) => s.subScenarioId),
    appliesToNone: c.appliesToNone,
    commentText: c.commentText,
    respondent: toIdentity(c.response.user),
    organizationId: c.response.user.organization.id,
    organizationName: c.response.user.organization.name,
  }));

  const keiCommentEntries: CrossOrgKeiCommentEntryDto[] = keiComments.map((k) => ({
    indicatorId: k.indicatorId,
    selectedOption: k.selectedOption,
    indicatorValue: k.indicatorValue,
    comment: k.comment,
    respondent: toIdentity(k.response.user),
    organizationId: k.response.user.organization.id,
    organizationName: k.response.user.organization.name,
  }));

  return { questionnaireCode: questionnaire.code, comments: commentEntries, keiComments: keiCommentEntries };
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
 * has zero OpCos at all (small orgs) or has at least one respondent (Normal User or
 * Executive) not yet assigned one —
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
          role: { in: RESPONDENT_ROLES },
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
    where: { role: { in: RESPONDENT_ROLES }, ...(scopeOrganizationId ? { organizationId: scopeOrganizationId } : {}) },
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
      _count: { select: { comments: true } },
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
      averageKeiScore: average(acc?.keiScores ?? []),
      commentCount: acc?.commentCount ?? 0,
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

/**
 * Org/OpCo-wide analogue of responses.service.ts's getCoreDomainSummary (which is per-user
 * only) — blends two already-computed BenchmarkRowDto sets (one per HVS-group member
 * questionnaire) 50/50 per CORE_FM.xlsx's Guideline point 7 (FORTH_REVIEW.md items 5/6). Row
 * labels are identical between the two calls since they derive from org/OpCo membership,
 * not from the questionnaire itself, so every row in `rowsA` has a matching row in `rowsB`.
 */
export async function getCombinedBenchmarkingSummary(
  group: { groupCode: string; questionnaireCodes: string[] },
  scopeOrganizationId?: string,
): Promise<CombinedBenchmarkingSummaryDto> {
  const [codeA, codeB] = group.questionnaireCodes;
  if (!codeA || !codeB) {
    throw new QuestionnaireNotFoundError();
  }
  const [qA, qB] = await Promise.all([
    loadQuestionnaireForBenchmarking(codeA),
    loadQuestionnaireForBenchmarking(codeB),
  ]);
  const [rowsA, rowsB] = await Promise.all([
    computeBenchmarkRows(qA, scopeOrganizationId),
    computeBenchmarkRows(qB, scopeOrganizationId),
  ]);
  const byKeyB = new Map(rowsB.map((r) => [rowKey(r.organizationId, r.opCoId), r]));

  const rows: CombinedBenchmarkRowDto[] = rowsA.map((rowA) => {
    const rowB = byKeyB.get(rowKey(rowA.organizationId, rowA.opCoId))!;
    const combinedAverageFinalScore =
      rowA.averageFinalScore != null && rowB.averageFinalScore != null
        ? round4(0.5 * rowA.averageFinalScore + 0.5 * rowB.averageFinalScore)
        : null;
    return {
      organizationId: rowA.organizationId,
      organizationName: rowA.organizationName,
      opCoId: rowA.opCoId,
      opCoName: rowA.opCoName,
      country: rowA.country,
      faultManagement: rowA,
      stability: rowB,
      combinedAverageFinalScore,
    };
  });

  return {
    groupCode: group.groupCode,
    ...(scopeOrganizationId ? { organizationId: scopeOrganizationId } : {}),
    rows,
  };
}
