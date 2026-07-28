import type { AnswerOption, Role, SubScenarioCode } from './enums';
import type { ScoreResultDto } from './scoring.types';

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  // Null until the user completes their profile (see ProfilePage) — a NORMAL_USER with
  // opCoId == null is routed there before reaching the domain picker. Not required for
  // EXECUTIVE/ADMIN, who don't answer questionnaires.
  opCoId: string | null;
  workingDomain: string | null;
  designation: string | null;
}

export interface SubScenarioDto {
  id: string;
  code: SubScenarioCode;
  name: string;
  description: string;
  faultDistributionWeight: number;
  sortOrder: number;
}

export interface QuestionOptionDto {
  option: AnswerOption;
  text: string;
  // Intentionally exposed (SECOND_REVIEW.md item 6) — see backend questionnaire module.
  criteria: number;
}

export interface QuestionDto {
  id: string;
  sortOrder: number;
  cognitiveActivity: string;
  serviceCapability: string;
  questionText: string;
  weight: number;
  // false only for the Intent question — excluded from the E2E Automation Ratio Checklist.
  includeInE2ECheck: boolean;
  options: QuestionOptionDto[];
  // Per-question guidance from the source xlsx's Guideline sheet — only populated for RAN
  // FM questions today (see CLAUDE.md). Shown as a collapsible section on the question card.
  answeringGuideline: string | null;
}

export interface QuestionnaireDto {
  id: string;
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  hasE2ECheck: boolean;
  // Questionnaire-level context from the source xlsx's Guideline sheet. Shown as a
  // collapsible section above the question flow.
  guidelineText: string | null;
  subScenarios: SubScenarioDto[];
  questions: QuestionDto[];
}

// Lightweight listing for the Domain -> questionnaire picker — no questions/sub-scenarios.
export interface QuestionnaireSummaryDto {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
}

export type ResponseStatus = 'IN_PROGRESS' | 'SUBMITTED';

export interface AnswerDto {
  questionId: string;
  subScenarioId: string;
  selectedOption: AnswerOption;
}

// One comment per question per response, optionally tagged to specific sub-scenarios
// (subScenarioIds) or explicitly to none of them (appliesToNone) — see CLAUDE.md
// "Per-question comments and skips".
export interface QuestionCommentDto {
  questionId: string;
  commentText: string;
  appliesToNone: boolean;
  subScenarioIds: string[];
}

export interface ResponseDto {
  id: string;
  status: ResponseStatus;
  questionnaireCode: string;
  answers: AnswerDto[];
  comments: QuestionCommentDto[];
}

// A skipped (question, subScenario) pair with no comment covering it — returned when
// submission is blocked so the frontend can show exactly what's missing.
export interface UncoveredSkipDto {
  questionId: string;
  subScenarioId: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
}

export interface OpCoDto {
  id: string;
  name: string;
  country: string;
  organizationId: string;
}

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  opCoId: string | null;
  workingDomain: string | null;
  designation: string | null;
}

// Admin-only reassignment (SECOND_REVIEW.md item 8) — changing organizationId always clears
// opCoId server-side unless a new opCoId (validated against the new org) is given too.
export interface UpdateUserRequestDto {
  organizationId?: string;
  opCoId?: string | null;
}

export type RespondentStatus = 'NOT_STARTED' | ResponseStatus;

export interface RespondentSummaryDto {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: RespondentStatus;
  finalScore: number | null;
}

export type AnswerOptionCounts = Record<AnswerOption, number>;

export interface AnswerDistributionEntryDto {
  questionId: string;
  subScenarioId: string;
  counts: AnswerOptionCounts;
}

export interface OrganizationQuestionnaireSummaryDto {
  questionnaireCode: string;
  respondents: RespondentSummaryDto[];
  answerDistribution: AnswerDistributionEntryDto[];
}

// Individual-answer visibility for Executive/Admin (SECOND_REVIEW.md item 10) — "role" maps
// to workingDomain/designation (the free-text profile fields), not the Role enum. Scoped to
// SUBMITTED responses only, same convention as answerDistribution above. This exposes which
// specific respondent picked which option — an intentional privacy/scope expansion over the
// aggregate-only answerDistribution, not an oversight (the review's own example: a Group
// CTO wants to see who, from which OpCo/country, chose which option).
export interface DrilldownRespondentDto {
  userId: string;
  email: string;
  opCoName: string | null;
  country: string | null;
  workingDomain: string | null;
  designation: string | null;
}

export interface AnswerDrilldownEntryDto {
  questionId: string;
  subScenarioId: string;
  option: AnswerOption;
  respondents: DrilldownRespondentDto[];
}

export interface AnswerDrilldownDto {
  questionnaireCode: string;
  entries: AnswerDrilldownEntryDto[];
}

export interface SubScenarioAverageDto {
  subScenarioCode: SubScenarioCode;
  averageScore: number | null;
}

// One row per (Organization, OpCo) pair (SECOND_REVIEW.md item 9) — every level (org,
// NatCo, country) is always present on every row rather than being an exclusive grouping
// mode. `opCoId`/`country` are null for a synthetic "no OpCo" row, which exists for any
// organization that either has zero OpCos at all (small orgs — opCoName then falls back to
// organizationName, matching the review's "NatCo and Organization will be the same") or has
// at least one respondent who hasn't been assigned an OpCo yet.
export interface BenchmarkRowDto {
  organizationId: string;
  organizationName: string;
  opCoId: string | null;
  opCoName: string;
  country: string | null;
  respondentCount: number;
  submittedCount: number;
  averageFinalScore: number | null;
  averageE2eAutomationRate: number | null;
  subScenarioAverages: SubScenarioAverageDto[];
}

// Admin-only, cross-organization.
export interface BenchmarkingSummaryDto {
  questionnaireCode: string;
  rows: BenchmarkRowDto[];
}

// Same row shape as BenchmarkingSummaryDto, scoped to one organization — for the
// Executive/Admin "benchmark OpCos within one organization" view.
export interface OpCoBenchmarkingSummaryDto {
  questionnaireCode: string;
  organizationId: string;
  rows: BenchmarkRowDto[];
}

// Guideline point 7 in CORE_FM.xlsx: "final score = 50% * fault management score + 50% *
// stability score". Combined per-user once they've submitted both; null fields mean that
// half hasn't been submitted yet.
export interface CoreDomainSummaryDto {
  faultManagement: ScoreResultDto | null;
  stability: ScoreResultDto | null;
  combinedScore: number | null;
}
