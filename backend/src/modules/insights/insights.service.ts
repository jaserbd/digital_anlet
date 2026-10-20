import { createHash } from 'node:crypto';
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
  NatCoStatusDto,
  OpCoBenchmarkingSummaryDto,
  OrganizationQuestionnaireSummaryDto,
  RespondentSummaryDto,
  SubScenarioAverageDto,
  SubScenarioCode,
} from '@anlet/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { round4 } from '../../lib/rounding';

export class QuestionnaireNotFoundError extends Error {}

// An Executive can now also answer/submit a questionnaire personally (MANAGEMENT_VIEW.md
// item 2) — that response merges into the same Respondents table / benchmarking averages a
// Normal User's does, so every respondent-scoped query below counts both roles. Admin never
// answers questionnaires and is excluded. Project Admins (PROJECTS_PLAN.md) may answer, but only
// to test — their responses are excluded everywhere via COUNTED_MEMBERSHIP.
const RESPONDENT_ROLES: Role[] = ['NORMAL_USER', 'EXECUTIVE'];
const COUNTED_MEMBERSHIP = { role: { in: RESPONDENT_ROLES } };

/** What an organization dashboard looks at (PROJECTS_V2_PLAN.md): one organization within one
 * project (null = its memberships outside projects) — answers are separate per project. */
export interface InsightsScope {
  organizationId: string;
  projectId: string | null;
}

function scopedMembership(scope: InsightsScope) {
  return { organizationId: scope.organizationId, projectId: scope.projectId, ...COUNTED_MEMBERSHIP };
}

type OpCoIdentity = { id: string; name: string; country: string };

/** Per organization, its only OpCo — for organizations with exactly one. Members without an OpCo
 * (typically Executives, whose profile doesn't ask for one) count as that OpCo's members in every
 * view (benchmark rows, participation, drill-downs, spider-chart filter), so they don't show up
 * as a separate "no NatCo" group (EXECUTIVE_FEEDBACK_PLAN.md). */
async function soleOpCoByOrganization(organizationIds: string[]): Promise<Map<string, OpCoIdentity>> {
  const opCos = await prisma.opCo.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true, name: true, country: true, organizationId: true },
  });
  const byOrg = new Map<string, OpCoIdentity[]>();
  for (const { organizationId, ...opCo } of opCos) {
    byOrg.set(organizationId, [...(byOrg.get(organizationId) ?? []), opCo]);
  }
  return new Map([...byOrg].filter(([, list]) => list.length === 1).map(([orgId, list]) => [orgId, list[0]!]));
}

async function soleOpCo(organizationId: string): Promise<OpCoIdentity | undefined> {
  return (await soleOpCoByOrganization([organizationId])).get(organizationId);
}

// Executives see participants anonymously (ANONYMOUS_EXECUTIVE_PLAN.md): no emails, names,
// designations or user ids leave the server for them. Admins pass `anonymize: false`.
export interface InsightsViewOptions {
  anonymize?: boolean;
}

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
 * responsible for authorizing that `scope` is one the requester may view.
 */
export async function getOrganizationQuestionnaireSummary(
  scope: InsightsScope,
  questionnaireCode: string,
  options: InsightsViewOptions = {},
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

  // Respondents = this organization's memberships (MULTI_ORG_PLAN.md) — profile and response
  // are per membership, so a person in two organizations appears in each with that
  // organization's NatCo and answers.
  const memberships = await prisma.membership.findMany({
    where: scopedMembership(scope),
    orderBy: { user: { email: 'asc' } },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      opCo: { select: { id: true, name: true, country: true } },
      responses: {
        where: { questionnaireId: questionnaire.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { result: true },
      },
    },
  });

  const fallbackOpCo = await soleOpCo(scope.organizationId);
  const respondents: RespondentSummaryDto[] = memberships.map((m) => {
    const latest = m.responses[0];
    const opCo = m.opCo ?? fallbackOpCo;
    return {
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      status: latest?.status ?? 'NOT_STARTED',
      finalScore: latest?.result ? Number(latest.result.finalScore) : null,
      opCoId: opCo?.id ?? null,
      opCoName: opCo?.name ?? null,
      country: opCo?.country ?? null,
      workingDomain: m.workingDomain,
      designation: m.designation,
    };
  });

  const grouped = await prisma.answer.groupBy({
    by: ['questionId', 'subScenarioId', 'selectedOption'],
    where: {
      response: {
        questionnaireId: questionnaire.id,
        status: 'SUBMITTED',
        membership: scopedMembership(scope),
      },
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

  if (options.anonymize) {
    return {
      questionnaireCode: questionnaire.code,
      anonymized: true,
      respondents: [],
      natCoStatus: summarizeByNatCo(respondents),
      answerDistribution,
    };
  }
  return { questionnaireCode: questionnaire.code, anonymized: false, respondents, natCoStatus: [], answerDistribution };
}

// Per-NatCo participation counts — what an Executive sees instead of per-person rows.
function summarizeByNatCo(respondents: RespondentSummaryDto[]): NatCoStatusDto[] {
  const groups = new Map<string, NatCoStatusDto & { scoreSum: number; scoreCount: number }>();
  for (const r of respondents) {
    const key = r.opCoId ?? '';
    const g = groups.get(key) ?? {
      opCoId: r.opCoId,
      opCoName: r.opCoName,
      country: r.country,
      participantCount: 0,
      submittedCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
      averageFinalScore: null,
      scoreSum: 0,
      scoreCount: 0,
    };
    g.participantCount += 1;
    if (r.status === 'SUBMITTED') g.submittedCount += 1;
    else if (r.status === 'IN_PROGRESS') g.inProgressCount += 1;
    else g.notStartedCount += 1;
    if (r.status === 'SUBMITTED' && r.finalScore != null) {
      g.scoreSum += r.finalScore;
      g.scoreCount += 1;
    }
    groups.set(key, g);
  }
  return [...groups.values()]
    .map(({ scoreSum, scoreCount, ...g }) => ({ ...g, averageFinalScore: scoreCount > 0 ? round4(scoreSum / scoreCount) : null }))
    .sort((a, b) => (a.opCoName ?? '\uffff').localeCompare(b.opCoName ?? '\uffff'));
}

// Stable "Participant N" labels for one organization + questionnaire, numbered in the order of
// a hash of the user id — never by email, name or submission time, so the numbers reveal
// nothing about who is who. Within one organization a user has exactly one membership.
function buildPseudonyms(userIds: Iterable<string>, questionnaireId: string): Map<string, string> {
  const ordered = [...new Set(userIds)]
    .map((id) => ({ id, hash: createHash('sha256').update(`${questionnaireId}:${id}`).digest('hex') }))
    .sort((a, b) => a.hash.localeCompare(b.hash));
  return new Map(ordered.map((u, i) => [u.id, `Participant ${i + 1}`]));
}

function anonymizeIdentity<T extends DrilldownRespondentIdentityDto>(identity: T, pseudonyms: Map<string, string>): T {
  const label = pseudonyms.get(identity.userId) ?? 'Participant';
  return { ...identity, userId: label, email: label, designation: null };
}

// A respondent's identity comes from the membership the response belongs to
// (MULTI_ORG_PLAN.md): email from the user, NatCo/profile from that organization's membership.
type IdentitySourceMembership = {
  userId: string;
  workingDomain: string | null;
  designation: string | null;
  opCo: { id: string; name: string; country: string } | null;
  user: { email: string };
};

// `fallbackOpCo`: the organization's only OpCo, for members without one (soleOpCoByOrganization).
function toIdentity(membership: IdentitySourceMembership, fallbackOpCo?: OpCoIdentity): DrilldownRespondentIdentityDto {
  const opCo = membership.opCo ?? fallbackOpCo;
  return {
    userId: membership.userId,
    email: membership.user.email,
    opCoId: opCo?.id ?? null,
    opCoName: opCo?.name ?? null,
    country: opCo?.country ?? null,
    workingDomain: membership.workingDomain,
    designation: membership.designation,
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
  userId: true,
  workingDomain: true,
  designation: true,
  opCo: { select: { id: true, name: true, country: true } },
  user: { select: { email: true } },
} as const;

/**
 * Per-respondent answer visibility for Executive/Admin (SECOND_REVIEW.md item 10) — unlike
 * getOrganizationQuestionnaireSummary's aggregate-only answerDistribution, this retains each
 * individual respondent (email, OpCo/country, workingDomain/designation) behind every
 * (question, subScenario, option) they chose, plus (THIRD_REVIEW.md item 8) that
 * respondent's own comment for the specific question, and the full org-scoped comment list
 * independently (`comments`) for the Organization Deep-Dive page and GroupedCommentsList.
 * Scoped to SUBMITTED responses only, same convention as the rest of this module. Callers
 * are responsible for authorizing that `scope` is one the requester may view (same
 * convention as getOrganizationQuestionnaireSummary).
 */
export async function getAnswerDrilldown(
  scope: InsightsScope,
  questionnaireCode: string,
  options: InsightsViewOptions = {},
): Promise<AnswerDrilldownDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  const responseScope = {
    questionnaireId: questionnaire.id,
    status: 'SUBMITTED' as const,
    membership: scopedMembership(scope),
  };

  const [answers, comments, keis, fallbackOpCo] = await Promise.all([
    prisma.answer.findMany({
      where: { response: responseScope },
      select: {
        questionId: true,
        subScenarioId: true,
        selectedOption: true,
        response: { select: { membership: { select: IDENTITY_SELECT } } },
      },
    }),
    prisma.questionComment.findMany({
      where: { response: responseScope },
      select: {
        questionId: true,
        commentText: true,
        appliesToNone: true,
        subScenarios: { select: { subScenarioId: true } },
        response: { select: { membership: { select: IDENTITY_SELECT } } },
      },
    }),
    prisma.responseKei.findMany({
      where: { response: responseScope },
      orderBy: { indicator: { sortOrder: 'asc' } },
      select: {
        ...KEI_STATE_SELECT,
        response: { select: { membership: { select: IDENTITY_SELECT } } },
      },
    }),
    soleOpCo(scope.organizationId),
  ]);

  const commentByUserAndQuestion = new Map<string, string>();
  const commentEntries: CommentDrilldownEntryDto[] = comments.map((c) => {
    commentByUserAndQuestion.set(`${c.response.membership.userId}:${c.questionId}`, c.commentText);
    return {
      questionId: c.questionId,
      subScenarioIds: c.subScenarios.map((s) => s.subScenarioId),
      appliesToNone: c.appliesToNone,
      commentText: c.commentText,
      respondent: toIdentity(c.response.membership, fallbackOpCo),
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
      ...toIdentity(a.response.membership, fallbackOpCo),
      comment: commentByUserAndQuestion.get(`${a.response.membership.userId}:${a.questionId}`) ?? null,
    });
  }

  const keiResponses: KeiDrilldownEntryDto[] = keis.map((k) => ({
    indicatorId: k.indicatorId,
    selectedOption: k.selectedOption,
    indicatorValue: k.indicatorValue,
    comment: k.comment,
    respondent: toIdentity(k.response.membership, fallbackOpCo),
  }));

  const entries = [...byKey.values()];
  if (options.anonymize) {
    const pseudonyms = buildPseudonyms(
      [...answers, ...comments, ...keis].map((x) => x.response.membership.userId),
      questionnaire.id,
    );
    return {
      questionnaireCode: questionnaire.code,
      anonymized: true,
      entries: entries.map((e) => ({ ...e, respondents: e.respondents.map((r) => anonymizeIdentity(r, pseudonyms)) })),
      comments: commentEntries.map((c) => ({ ...c, respondent: anonymizeIdentity(c.respondent, pseudonyms) })),
      keiResponses: keiResponses.map((k) => ({ ...k, respondent: anonymizeIdentity(k.respondent, pseudonyms) })),
    };
  }

  return {
    questionnaireCode: questionnaire.code,
    anonymized: false,
    entries,
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
 * computeBenchmarkRows below). Callers are responsible for authorizing that `scope`
 * is one the requester may view (same convention as getAnswerDrilldown).
 */
export async function getCognitiveActivitySummary(
  scope: InsightsScope,
  questionnaireCode: string,
  filters: { opCoId?: string; country?: string },
): Promise<CognitiveActivitySummaryDto> {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { code: questionnaireCode } });
  if (!questionnaire) {
    throw new QuestionnaireNotFoundError();
  }

  // Members without an OpCo belong to the organization's only OpCo (soleOpCoByOrganization).
  const fallbackOpCo = await soleOpCo(scope.organizationId);
  const orUnassigned = (matchesFallback: boolean, condition: Prisma.MembershipWhereInput): Prisma.MembershipWhereInput =>
    matchesFallback ? { OR: [condition, { opCoId: null }] } : condition;
  const scoreResults = await prisma.scoreResult.findMany({
    where: {
      response: {
        questionnaireId: questionnaire.id,
        status: 'SUBMITTED',
        membership: {
          ...scopedMembership(scope),
          AND: [
            ...(filters.opCoId ? [orUnassigned(fallbackOpCo?.id === filters.opCoId, { opCoId: filters.opCoId })] : []),
            ...(filters.country
              ? [orUnassigned(fallbackOpCo?.country === filters.country, { opCo: { country: filters.country } })]
              : []),
          ],
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

  const membershipWithOrg = {
    select: {
      ...IDENTITY_SELECT,
      organization: { select: { id: true, name: true } },
      project: { select: { name: true } },
    },
  };
  const [comments, keiComments] = await Promise.all([
    prisma.questionComment.findMany({
      where: { response: { questionnaireId: questionnaire.id, status: 'SUBMITTED', membership: COUNTED_MEMBERSHIP } },
      select: {
        questionId: true,
        commentText: true,
        appliesToNone: true,
        subScenarios: { select: { subScenarioId: true } },
        response: { select: { membership: membershipWithOrg } },
      },
    }),
    // KEI comments (NEW_HVS_PLAN.md Phase B) join the same collection.
    prisma.responseKei.findMany({
      where: {
        response: { questionnaireId: questionnaire.id, status: 'SUBMITTED', membership: COUNTED_MEMBERSHIP },
        comment: { not: null },
      },
      orderBy: { indicator: { sortOrder: 'asc' } },
      select: { ...KEI_STATE_SELECT, response: { select: { membership: membershipWithOrg } } },
    }),
  ]);

  const fallbackOpCos = await soleOpCoByOrganization([
    ...new Set([...comments, ...keiComments].map((c) => c.response.membership.organization.id)),
  ]);
  const commentEntries: CrossOrgCommentEntryDto[] = comments.map((c) => ({
    questionId: c.questionId,
    subScenarioIds: c.subScenarios.map((s) => s.subScenarioId),
    appliesToNone: c.appliesToNone,
    commentText: c.commentText,
    respondent: toIdentity(c.response.membership, fallbackOpCos.get(c.response.membership.organization.id)),
    organizationId: c.response.membership.organization.id,
    organizationName: c.response.membership.organization.name,
    projectName: c.response.membership.project?.name ?? null,
  }));

  const keiCommentEntries: CrossOrgKeiCommentEntryDto[] = keiComments.map((k) => ({
    indicatorId: k.indicatorId,
    selectedOption: k.selectedOption,
    indicatorValue: k.indicatorValue,
    comment: k.comment,
    respondent: toIdentity(k.response.membership, fallbackOpCos.get(k.response.membership.organization.id)),
    organizationId: k.response.membership.organization.id,
    organizationName: k.response.membership.organization.name,
    projectName: k.response.membership.project?.name ?? null,
  }));

  return { questionnaireCode: questionnaire.code, comments: commentEntries, keiComments: keiCommentEntries };
}

interface BenchmarkRowLabel {
  projectId: string | null;
  projectName: string | null;
  organizationId: string;
  organizationName: string;
  opCoId: string | null;
  opCoName: string;
  country: string | null;
  // The synthetic "no OpCo" row of an organization that has OpCos (see computeBenchmarkRows).
  optionalUnassigned: boolean;
}

// computeBenchmarkRows' rows, still carrying BenchmarkRowLabel's flag for the callers to filter on.
type BenchmarkRowWithFlag = BenchmarkRowDto & { optionalUnassigned: boolean };

// Drops the synthetic "no OpCo" rows nobody in them has submitted (EXECUTIVE_FEEDBACK_PLAN.md) — in
// the combined table only when both questionnaires' rows are empty, so the two sets stay paired.
function visibleBenchmarkRows(rows: BenchmarkRowWithFlag[], keep?: (row: BenchmarkRowWithFlag) => boolean): BenchmarkRowDto[] {
  return rows
    .filter((r) => !r.optionalUnassigned || r.submittedCount > 0 || (keep?.(r) ?? false))
    .map(({ optionalUnassigned: _ignored, ...row }) => row);
}

function rowKey(projectId: string | null, organizationId: string, opCoId: string | null): string {
  return `${projectId ?? 'none'}:${organizationId}:${opCoId ?? 'none'}`;
}

interface BenchmarkUnit {
  projectId: string | null;
  projectName: string | null;
  organization: { id: string; name: string; opCos: { id: string; name: string; country: string }[] };
}

/** The (project, organization) pairs benchmark rows are built for: every project link, plus each
 * organization's memberships outside projects — for organizations in no project at all, or that
 * have respondents outside projects (e.g. Detecon). Ordered by project (outside projects last),
 * then organization. */
async function benchmarkUnits(scope?: InsightsScope): Promise<BenchmarkUnit[]> {
  const orgSelect = { id: true, name: true, opCos: { orderBy: { name: 'asc' as const } } };
  if (scope) {
    const [organization, project] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: scope.organizationId }, select: orgSelect }),
      scope.projectId ? prisma.project.findUnique({ where: { id: scope.projectId }, select: { name: true } }) : null,
    ]);
    return [{ projectId: scope.projectId, projectName: project?.name ?? null, organization }];
  }
  const [links, organizations, projectlessMemberships] = await Promise.all([
    prisma.projectOrganization.findMany({
      select: { project: { select: { id: true, name: true } }, organization: { select: orgSelect } },
      orderBy: [{ project: { name: 'asc' } }, { organization: { name: 'asc' } }],
    }),
    prisma.organization.findMany({
      select: { ...orgSelect, _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.membership.findMany({
      where: { ...COUNTED_MEMBERSHIP, projectId: null },
      select: { organizationId: true },
      distinct: ['organizationId'],
    }),
  ]);
  const withProjectless = new Set(projectlessMemberships.map((m) => m.organizationId));
  return [
    ...links.map((l) => ({ projectId: l.project.id, projectName: l.project.name, organization: l.organization })),
    ...organizations
      .filter((o) => o._count.projects === 0 || withProjectless.has(o.id))
      .map(({ _count: _ignored, ...organization }) => ({ projectId: null, projectName: null, organization })),
  ];
}

/**
 * One row per (Project, Organization, OpCo) — PROJECTS_V2_PLAN.md: an organization in two
 * projects gets separate rows, since answers are separate per project — optionally scoped to one
 * organization + project. Shared by getBenchmarkingSummary (cross-org, Admin) and
 * getOpCoBenchmarkingSummary (single-org, Executive/Admin). A synthetic "no OpCo" row
 * (opCoId/country null, opCoName falls back to the organization's own name) is included for any
 * organization that either has zero OpCos at all (small orgs) or has at least one respondent not
 * yet assigned one — SECOND_REVIEW.md item 9's "for small organizations, NatCo and Organization
 * will be the same" plus not silently dropping unassigned respondents from the table.
 * EXECUTIVE_FEEDBACK_PLAN.md: an organization with exactly one OpCo counts unassigned members
 * under that OpCo instead (no extra row), and with several OpCos the synthetic row is dropped
 * unless someone in it submitted (visibleBenchmarkRows) — it read as a duplicate of the real
 * NatCo row.
 */
async function computeBenchmarkRows(
  questionnaire: { id: string; subScenarios: { code: SubScenarioCode }[] },
  scope?: InsightsScope,
): Promise<BenchmarkRowWithFlag[]> {
  const units = await benchmarkUnits(scope);
  const membershipWhere = scope ? scopedMembership(scope) : COUNTED_MEMBERSHIP;
  // Organizations whose members without an OpCo are counted under their only OpCo.
  const singleOpCoByOrg = new Map(
    units.filter((u) => u.organization.opCos.length === 1).map((u) => [u.organization.id, u.organization.opCos[0]!.id]),
  );
  const effectiveOpCoId = (organizationId: string, opCoId: string | null) =>
    opCoId ?? singleOpCoByOrg.get(organizationId) ?? null;

  const unassignedKeys = new Set(
    (
      await prisma.membership.findMany({
        where: { ...membershipWhere, opCoId: null },
        select: { organizationId: true, projectId: true },
        distinct: ['organizationId', 'projectId'],
      })
    ).map((m) => rowKey(m.projectId, m.organizationId, null)),
  );

  const rowLabels: BenchmarkRowLabel[] = [];
  for (const { projectId, projectName, organization: org } of units) {
    for (const opCo of org.opCos) {
      rowLabels.push({
        projectId,
        projectName,
        organizationId: org.id,
        organizationName: org.name,
        opCoId: opCo.id,
        opCoName: opCo.name,
        country: opCo.country,
        optionalUnassigned: false,
      });
    }
    if (org.opCos.length === 0 || (org.opCos.length > 1 && unassignedKeys.has(rowKey(projectId, org.id, null)))) {
      rowLabels.push({
        projectId,
        projectName,
        organizationId: org.id,
        organizationName: org.name,
        opCoId: null,
        opCoName: org.name,
        country: null,
        // Only an organization's sole row is kept when nobody in it submitted.
        optionalUnassigned: org.opCos.length > 0,
      });
    }
  }

  const respondentCounts = await prisma.membership.groupBy({
    by: ['projectId', 'organizationId', 'opCoId'],
    where: membershipWhere,
    _count: { _all: true },
  });
  const respondentCountByKey = new Map<string, number>();
  for (const r of respondentCounts) {
    const key = rowKey(r.projectId, r.organizationId, effectiveOpCoId(r.organizationId, r.opCoId));
    respondentCountByKey.set(key, (respondentCountByKey.get(key) ?? 0) + r._count._all);
  }

  const submittedResponses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId: questionnaire.id, status: 'SUBMITTED', membership: membershipWhere },
    include: {
      membership: { select: { organizationId: true, projectId: true, opCoId: true } },
      result: { include: { subScenarioScores: { include: { subScenario: true } } } },
      _count: { select: { comments: true } },
    },
  });
  const byKey = groupScores(submittedResponses, (r) =>
    rowKey(r.membership.projectId, r.membership.organizationId, effectiveOpCoId(r.membership.organizationId, r.membership.opCoId)),
  );

  return rowLabels.map(({ optionalUnassigned, ...label }): BenchmarkRowWithFlag => {
    const key = rowKey(label.projectId, label.organizationId, label.opCoId);
    const acc = byKey.get(key);
    return {
      projectId: label.projectId,
      projectName: label.projectName,
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
      optionalUnassigned,
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
  const rows = visibleBenchmarkRows(await computeBenchmarkRows(questionnaire));
  return { questionnaireCode: questionnaire.code, rows };
}

/**
 * Benchmarks OpCos within a single organization — the Group CTO / Admin view of "how do my
 * NatCos compare for this HVS" (FIRST_REVIEW.md). Same row shape and averaging rules as
 * getBenchmarkingSummary, scoped to one organization + project. Callers are responsible for
 * authorizing that `scope` is one the requester may view (same convention as
 * getOrganizationQuestionnaireSummary).
 */
export async function getOpCoBenchmarkingSummary(
  scope: InsightsScope,
  questionnaireCode: string,
): Promise<OpCoBenchmarkingSummaryDto> {
  const questionnaire = await loadQuestionnaireForBenchmarking(questionnaireCode);
  const rows = visibleBenchmarkRows(await computeBenchmarkRows(questionnaire, scope));
  return { questionnaireCode: questionnaire.code, organizationId: scope.organizationId, rows };
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
  scope?: InsightsScope,
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
    computeBenchmarkRows(qA, scope),
    computeBenchmarkRows(qB, scope),
  ]);
  const keyOf = (r: BenchmarkRowDto) => rowKey(r.projectId, r.organizationId, r.opCoId);
  const submittedInB = new Set(rowsB.filter((r) => r.submittedCount > 0).map(keyOf));
  const submittedInA = new Set(rowsA.filter((r) => r.submittedCount > 0).map(keyOf));
  const visibleA = visibleBenchmarkRows(rowsA, (r) => submittedInB.has(keyOf(r)));
  const byKeyB = new Map(visibleBenchmarkRows(rowsB, (r) => submittedInA.has(keyOf(r))).map((r) => [keyOf(r), r]));

  const rows: CombinedBenchmarkRowDto[] = visibleA.map((rowA) => {
    const rowB = byKeyB.get(keyOf(rowA))!;
    const combinedAverageFinalScore =
      rowA.averageFinalScore != null && rowB.averageFinalScore != null
        ? round4(0.5 * rowA.averageFinalScore + 0.5 * rowB.averageFinalScore)
        : null;
    return {
      projectId: rowA.projectId,
      projectName: rowA.projectName,
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
    ...(scope ? { organizationId: scope.organizationId } : {}),
    rows,
  };
}
