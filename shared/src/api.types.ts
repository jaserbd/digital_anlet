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

export interface SubScenarioAverageDto {
  subScenarioCode: SubScenarioCode;
  averageScore: number | null;
}

export interface OrganizationBenchmarkDto {
  organizationId: string;
  organizationName: string;
  respondentCount: number;
  submittedCount: number;
  averageFinalScore: number | null;
  averageE2eAutomationRate: number | null;
  subScenarioAverages: SubScenarioAverageDto[];
}

// Admin-only, cross-organization by default, or cross-country when groupBy = 'country'
// (grouping key becomes each respondent's OpCo.country instead of their organizationId —
// respondents with no OpCo yet are excluded from a country grouping).
export type BenchmarkingGroupBy = 'organization' | 'country';

export interface BenchmarkingSummaryDto {
  questionnaireCode: string;
  groupBy: BenchmarkingGroupBy;
  organizations: OrganizationBenchmarkDto[];
}

// Same shape as OrganizationBenchmarkDto, keyed by OpCo instead of Organization — for the
// Executive/Admin "benchmark OpCos within one organization" view.
export interface OpCoBenchmarkDto {
  opCoId: string;
  opCoName: string;
  country: string;
  respondentCount: number;
  submittedCount: number;
  averageFinalScore: number | null;
  averageE2eAutomationRate: number | null;
  subScenarioAverages: SubScenarioAverageDto[];
}

export interface OpCoBenchmarkingSummaryDto {
  questionnaireCode: string;
  organizationId: string;
  opCos: OpCoBenchmarkDto[];
}

// Guideline point 7 in CORE_FM.xlsx: "final score = 50% * fault management score + 50% *
// stability score". Combined per-user once they've submitted both; null fields mean that
// half hasn't been submitted yet.
export interface CoreDomainSummaryDto {
  faultManagement: ScoreResultDto | null;
  stability: ScoreResultDto | null;
  combinedScore: number | null;
}
