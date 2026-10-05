import type { AnswerOption, Role, SubScenarioCode } from './enums';
import type { ScoreResultDto } from './scoring.types';

// One working context a user can switch into (MULTI_ORG_PLAN.md): "Admin (all clients)"
// (membershipId null, admins only) or one of their organization memberships.
export interface UserContextDto {
  membershipId: string | null;
  organizationId: string;
  organizationName: string;
  role: Role;
}

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  // The *active context's* role and organization (MULTI_ORG_PLAN.md) — what every screen
  // works with. ADMIN + home organization in the admin context; otherwise the active
  // membership's role and organization.
  role: Role;
  organizationId: string;
  activeMembershipId: string | null;
  // Global admin (independent of the active context) — admins can always switch to the
  // admin context.
  isAdmin: boolean;
  // Every context this user can switch into; the frontend shows a picker after login when
  // there's more than one.
  contexts: UserContextDto[];
  // The active membership's profile (null in the admin context). Null until completed —
  // a NORMAL_USER membership with opCoId == null is routed to /profile before answering.
  opCoId: string | null;
  workingDomain: string | null;
  designation: string | null;
  // True for every admin-created account until they set their own password (OVERVIEW.md
  // item 4) — ProtectedRoute redirects to /change-password before anything else while true.
  mustChangePassword: boolean;
  // An ADMIN who may also create/promote/demote admins (ADMIN_MANAGEMENT_PLAN.md).
  isSuperAdmin: boolean;
}

export interface SwitchContextRequestDto {
  // null = the admin context (admins only)
  membershipId: string | null;
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
  // Grouping header from the source xlsx (e.g. "Communication"); null when the
  // questionnaire has no sub-scenario categories.
  category: string | null;
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

// Key Effectiveness Indicator (NEW_HVS_PLAN.md Phase B) — an outcome measure (MTTR,
// automation ratio, ...) answered once per response on an A-C range scale, scored
// separately from the IAADE questions (ScoreResultDto.keiScore).
export interface EffectivenessIndicatorDto {
  id: string;
  sortOrder: number;
  name: string;
  description: string;
  weight: number;
  options: QuestionOptionDto[];
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
  // Empty for questionnaires without KEIs (RAN, Core, Fixed Access).
  effectivenessIndicators: EffectivenessIndicatorDto[];
  // The source's note under its KEI block (e.g. values are for pilot use); null without KEIs.
  keiNote: string | null;
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

// One respondent's state for one KEI — also the PUT /responses/:id/kei request body. A KEI
// is answered with selectedOption, or skipped when unanswered but explained by a non-empty
// comment (submit is blocked otherwise). indicatorValue is the free-text measured value
// (e.g. "85%"), informational only — never scored.
export interface KeiAnswerDto {
  indicatorId: string;
  selectedOption: AnswerOption | null;
  indicatorValue: string | null;
  comment: string | null;
}

export interface ResponseDto {
  id: string;
  status: ResponseStatus;
  questionnaireCode: string;
  answers: AnswerDto[];
  comments: QuestionCommentDto[];
  keiAnswers: KeiAnswerDto[];
}

// A skipped (question, subScenario) pair with no comment covering it — returned when
// submission is blocked so the frontend can show exactly what's missing.
export interface UncoveredSkipDto {
  questionId: string;
  subScenarioId: string;
}

// The 422 body returned when submission is blocked: uncovered (question, subScenario) pairs
// plus the ids of KEIs that are neither answered nor explained by a comment.
export interface UncoveredSkipErrorDto {
  error: string;
  missing: UncoveredSkipDto[];
  missingKeis: string[];
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

// One organization + role for a user (MULTI_ORG_PLAN.md), with that organization's profile.
export interface MembershipDto {
  id: string;
  organizationId: string;
  organizationName: string;
  role: Role; // EXECUTIVE or NORMAL_USER
  opCoId: string | null;
  opCoName: string | null;
  workingDomain: string | null;
  designation: string | null;
  // Responses recorded under this membership — a membership with any can't be removed.
  responseCount: number;
}

export interface UserDto {
  id: string;
  email: string;
  // Global role only: ADMIN, or NORMAL_USER for every non-admin (whose per-organization roles
  // are in `memberships`).
  role: Role;
  // Home organization (the internal org for admins).
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  isSuperAdmin: boolean;
  memberships: MembershipDto[];
}

// Grant (role: 'ADMIN') or remove (role: 'NORMAL_USER') the global Admin role — super admin only.
export interface UpdateUserRequestDto {
  role?: Role;
}

export interface AddMembershipRequestDto {
  organizationId: string;
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
}

export interface UpdateMembershipRequestDto {
  role: Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
}

// "Create user" with an email that already exists (and a non-admin role) adds a membership to
// that user instead of failing (MULTI_ORG_PLAN.md).
export interface CreateUserResultDto {
  status: 'created' | 'membership-added';
  user: UserDto;
}

// Admin-generated one-time password (admin_management.md line 12), shown once to forward to
// the user, who must change it at next login.
export interface TemporaryPasswordDto {
  temporaryPassword: string;
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
  // 'membership-added': the email already existed, so the row's organization/role was added
  // to that user (password unchanged — no tempPassword).
  status: 'created' | 'membership-added' | 'error';
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

// One respondent's KEI state (answer, measured value, comment) — the KEI analogue of both
// AnswerDrilldownEntryDto and CommentDrilldownEntryDto, kept flat since KEIs have no
// sub-scenarios; the frontend derives per-option counts and respondent lists from it.
export interface KeiDrilldownEntryDto extends KeiAnswerDto {
  respondent: DrilldownRespondentIdentityDto;
}

export interface AnswerDrilldownDto {
  questionnaireCode: string;
  entries: AnswerDrilldownEntryDto[];
  comments: CommentDrilldownEntryDto[];
  keiResponses: KeiDrilldownEntryDto[];
}

// Cross-organization analogue of CommentDrilldownEntryDto (ADMIN.md item 3) — Admin's
// Comment Collection table across every organization at once, so it needs the
// organization identity CommentDrilldownEntryDto doesn't carry (that one is already scoped to
// a single organizationId by its caller).
export interface CrossOrgCommentEntryDto extends CommentDrilldownEntryDto {
  organizationId: string;
  organizationName: string;
}

export interface CrossOrgKeiCommentEntryDto extends KeiDrilldownEntryDto {
  organizationId: string;
  organizationName: string;
}

export interface CrossOrgCommentCollectionDto {
  questionnaireCode: string;
  comments: CrossOrgCommentEntryDto[];
  // KEI states that carry a comment (NEW_HVS_PLAN.md Phase B).
  keiComments: CrossOrgKeiCommentEntryDto[];
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
  // Average Effective Indicator (KEI) score over this row's SUBMITTED responses that have
  // one; null when there are none (or the questionnaire has no KEIs).
  averageKeiScore: number | null;
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
