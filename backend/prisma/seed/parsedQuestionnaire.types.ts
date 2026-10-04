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
  // Per-question guidance from the xlsx's Guideline sheet ("Answering Guideline" column).
  // Only RAN_FM.xlsx's Guideline sheet has this per-question breakdown — CORE_FM.xlsx's
  // Guideline sheet is a numbered intro/change-history only, so Core questions leave this
  // null (SECOND_REVIEW.md item 4 — don't fabricate guidance that isn't in the source).
  answeringGuideline: string | null;
}

export interface ParsedSubScenario {
  code: SubScenarioCode;
  name: string;
  description: string;
  // Header grouping above the sub-scenario columns in the source xlsx, if it has one.
  category: string | null;
  faultDistributionWeight: number;
  sortOrder: number;
}

// Key Effectiveness Indicator (NEW_HVS_PLAN.md Phase B) — only IP_FM.xlsx and
// Transport.xlsx have them. Criteria come from the Scoring sheet like question criteria.
export interface ParsedEffectivenessIndicator {
  sortOrder: number;
  name: string;
  description: string;
  weight: number;
  optionText: Partial<Record<AnswerOption, string>>;
  optionCriteria: Partial<Record<AnswerOption, number>>;
}

export interface ParsedQuestionnaire {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  // false only for Core Network Stability — see schema.prisma's Questionnaire.hasE2ECheck.
  hasE2ECheck: boolean;
  // Questionnaire-level context from the xlsx's Guideline sheet (Introduction + Sub-scenarios
  // for RAN; the numbered Introduction for Core FM/Stability, which share one Guideline
  // sheet — see CLAUDE.md). Null only if a future questionnaire's source has no Guideline
  // sheet at all.
  guidelineText: string | null;
  subScenarios: ParsedSubScenario[];
  questions: ParsedQuestion[];
  // Empty (and keiNote null) for questionnaires whose source has no KEI block.
  effectivenessIndicators: ParsedEffectivenessIndicator[];
  keiNote: string | null;
}
