import type { AnswerOption, SubScenarioCode } from '@anlet/shared';

export interface ParsedQuestion {
  sortOrder: number;
  cognitiveActivity: string;
  serviceCapability: string;
  questionText: string;
  weight: number;
  optionText: Partial<Record<AnswerOption, string>>;
  optionCriteria: Partial<Record<AnswerOption, number>>;
  complianceWithStandards: boolean | null;
  standardSource: string | null;
  includeInE2ECheck: boolean;
}

export interface ParsedSubScenario {
  code: SubScenarioCode;
  name: string;
  description: string;
  faultDistributionWeight: number;
  sortOrder: number;
}

export interface ParsedQuestionnaire {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  // false only for Core Network Stability — see schema.prisma's Questionnaire.hasE2ECheck.
  hasE2ECheck: boolean;
  subScenarios: ParsedSubScenario[];
  questions: ParsedQuestion[];
}
