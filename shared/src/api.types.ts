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
  // True for every admin-created account until they set their own password (OVERVIEW.md
  // item 4) — ProtectedRoute redirects to /change-password before anything else while true.
  mustChangePassword: boolean;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

// Forgot-password flow (OVERVIEW.md item 12). ForgotPasswordRequestDto's response is always
// 204 regardless of whether the email exists — no user-enumeration signal.
export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
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
  // Admin-controlled open/close toggle, scoped to the requesting user's own organization
  // (THIRD_REVIEW.md item 7 — was a single global flag). While true, a SUBMITTED response
  // stays editable and re-submittable; once false, QuestionnairePage redirects a SUBMITTED
  // user straight to results (today's original locked-forever behavior).
  acceptingResponses: boolean;
  subScenarios: SubScenarioDto[];
  questions: QuestionDto[];
}

// Lightweight listing for the Domain -> questionnaire picker — no questions/sub-scenarios.
// No acceptingResponses here (THIRD_REVIEW.md item 7 made it per-organization, not global —
// see QuestionnaireDto.acceptingResponses / SetAcceptingResponsesRequestDto below).
export interface QuestionnaireSummaryDto {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
}

export interface SetAcceptingResponsesRequestDto {
  organizationId: string;
  acceptingResponses: boolean;
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

// Backs the Country / Working Domain / Designation / NatCo Name dropdowns — Admin-managed
// picklists that replaced free-text entry on OpCo creation and profile completion, so those
// fields can no longer drift in spelling. COUNTRY/WORKING_DOMAIN/DESIGNATION are global
// (organizationId null); NATCO_NAME is scoped per Organization.
export type ReferenceListCategory = 'COUNTRY' | 'WORKING_DOMAIN' | 'DESIGNATION' | 'NATCO_NAME';

export interface ReferenceListEntryDto {
  id: string;
  category: ReferenceListCategory;
  name: string;
  organizationId: string | null;
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

// Bulk user creation from an uploaded CSV (OVERVIEW.md item 4) — one row per user, parsed
// client-side and posted as a plain JSON array (no multipart upload needed). `organization`
// is an exact organization name, resolved server-side. `password` is optional — omitted rows
// get a generated one-time password (see BulkCreateUsersResultDto.tempPassword).
export interface BulkCreateUsersRowDto {
  email: string;
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
  organization: string;
  password?: string;
}

// One result per input row, in the same order — a bad row (unknown org, taken email, weak
// password) doesn't abort the rest of the batch.
export interface BulkCreateUsersResultDto {
  row: number;
  email: string;
  status: 'created' | 'error';
  // Only present when status === 'created' — the one-time password (either the row's own or
  // a generated one), shown to the Admin exactly once since it isn't stored in plain text.
  tempPassword?: string;
  error?: string;
}

export type RespondentStatus = 'NOT_STARTED' | ResponseStatus;

// MANAGEMENT_VIEW.md item 2b: NatCo/country/workingDomain/designation added so the
// Executive's Respondents table can filter/export on the same identity fields already
// exposed by DrilldownRespondentIdentityDto, without a full per-question drilldown fetch.
export interface RespondentSummaryDto {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: RespondentStatus;
  finalScore: number | null;
  opCoId: string | null;
  opCoName: string | null;
  country: string | null;
  workingDomain: string | null;
  designation: string | null;
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
export interface DrilldownRespondentIdentityDto {
  userId: string;
  email: string;
  opCoId: string | null;
  opCoName: string | null;
  country: string | null;
  workingDomain: string | null;
  designation: string | null;
}

// THIRD_REVIEW.md item 8: adds this respondent's own comment for the specific question this
// entry is under (comment collection is a core purpose of the app, per the review) —
// distinct from CommentDrilldownEntryDto below, which is the full org-scoped comment list
// independent of any particular answer option.
export interface DrilldownRespondentDto extends DrilldownRespondentIdentityDto {
  comment: string | null;
}

export interface AnswerDrilldownEntryDto {
  questionId: string;
  subScenarioId: string;
  option: AnswerOption;
  respondents: DrilldownRespondentDto[];
}

// Full org-scoped comment list (THIRD_REVIEW.md item 8) — feeds both the Organization
// Deep-Dive page's per-NatCo Comments-column expansion and GroupedCommentsList's
// multi-respondent rendering.
export interface CommentDrilldownEntryDto {
  questionId: string;
  subScenarioIds: string[];
  appliesToNone: boolean;
  commentText: string;
  respondent: DrilldownRespondentIdentityDto;
}

export interface AnswerDrilldownDto {
  questionnaireCode: string;
  entries: AnswerDrilldownEntryDto[];
  comments: CommentDrilldownEntryDto[];
}

// Cross-organization analogue of CommentDrilldownEntryDto (ADMIN.md item 3) — Admin's
// Comment Collection table across every organization at once, so it needs the
// organization identity CommentDrilldownEntryDto doesn't carry (that one is already scoped to
// a single organizationId by its caller).
export interface CrossOrgCommentEntryDto extends CommentDrilldownEntryDto {
  organizationId: string;
  organizationName: string;
}

export interface CrossOrgCommentCollectionDto {
  questionnaireCode: string;
  comments: CrossOrgCommentEntryDto[];
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
  // Count of QuestionComment rows across this row's SUBMITTED responses (THIRD_REVIEW.md
  // item 8) — feeds the Organization Deep-Dive page's clickable Comments column.
  commentCount: number;
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
  faultManagementQuestionnaireCode: string;
  stability: ScoreResultDto | null;
  stabilityQuestionnaireCode: string;
  combinedScore: number | null;
}

// FORTH_REVIEW.md items 5/6: a Domain -> HVS picker entry, collapsing questionnaires that
// belong to the same HVS group (today, only Core Fault Management + Stability) into one
// selectable item instead of listing them separately. `kind: 'single'` behaves exactly like
// the existing QuestionnaireSummaryDto-driven pickers; `kind: 'group'` carries the member
// questionnaireCodes so the caller can fetch/link to each half.
export interface HvsListItemDto {
  kind: 'single' | 'group';
  key: string; // questionnaire code for 'single', HVS group code for 'group'
  name: string;
  networkType: string;
  questionnaireCodes: string[];
}

// One row per (Organization, OpCo) pair, blending two BenchmarkRowDtos (one per HVS-group
// member questionnaire) 50/50 per CORE_FM.xlsx's Guideline point 7 — the org/OpCo-wide
// analogue of CoreDomainSummaryDto, which is per-user only.
export interface CombinedBenchmarkRowDto {
  organizationId: string;
  organizationName: string;
  opCoId: string | null;
  opCoName: string;
  country: string | null;
  faultManagement: BenchmarkRowDto;
  stability: BenchmarkRowDto;
  combinedAverageFinalScore: number | null;
}

export interface CombinedBenchmarkingSummaryDto {
  groupCode: string;
  organizationId?: string; // present only for the single-organization (Executive/Admin) variant
  rows: CombinedBenchmarkRowDto[];
}

// ADMIN_2.md item 1: one axis of the IAADE/Cognitive-Activity spider chart — averageScore is
// null only when every matched response's questions in this activity were skipped (excluded,
// same "no misleading zero" convention as BenchmarkRowDto.averageFinalScore).
export interface CognitiveActivityAverageDto {
  cognitiveActivity: string;
  averageScore: number | null;
}

// Executive/Admin aggregate view (org- and optionally OpCo/country-scoped) of the same
// per-Cognitive-Activity averaging a Normal User's own result already gets for free from
// ScoreResultDto.questionScores. sampleSize is the count of SUBMITTED responses matched by
// the filters — 0 means averageFinalScore/every activity's averageScore are null, not 0.
export interface CognitiveActivitySummaryDto {
  activities: CognitiveActivityAverageDto[];
  averageFinalScore: number | null;
  sampleSize: number;
}
