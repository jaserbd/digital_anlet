import type { AnswerOption, Role, SubScenarioCode } from './enums';
import type { ScoreResultDto } from './scoring.types';

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
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
  // Criteria numbers are intentionally omitted — see backend questionnaire module.
  options: QuestionOptionDto[];
}

export interface QuestionnaireDto {
  id: string;
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  hasE2ECheck: boolean;
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

export interface ResponseDto {
  id: string;
  status: ResponseStatus;
  questionnaireCode: string;
  answers: AnswerDto[];
}

export interface OrganizationDto {
  id: string;
  name: string;
}

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
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

export interface BenchmarkingSummaryDto {
  questionnaireCode: string;
  organizations: OrganizationBenchmarkDto[];
}

// Guideline point 7 in CORE_FM.xlsx: "final score = 50% * fault management score + 50% *
// stability score". Combined per-user once they've submitted both; null fields mean that
// half hasn't been submitted yet.
export interface CoreDomainSummaryDto {
  faultManagement: ScoreResultDto | null;
  stability: ScoreResultDto | null;
  combinedScore: number | null;
}
