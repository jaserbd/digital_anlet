import type { SubScenarioCode } from './enums';

export interface SubScenarioScore {
  subScenarioCode: SubScenarioCode;
  // Null only when every question in this sub-scenario was skipped (no answer, covered by
  // a comment) — excluded from the final-score weighted average in that case.
  overallScore: number | null;
  e2eAchieved: boolean;
}

export interface ScoreResultDto {
  finalScore: number;
  e2eAutomationRate: number;
  subScenarioScores: SubScenarioScore[];
}
