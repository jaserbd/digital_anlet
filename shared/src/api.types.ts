import type { AnswerOption, Role, SubScenarioCode } from './enums';

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
  subScenarios: SubScenarioDto[];
  questions: QuestionDto[];
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
