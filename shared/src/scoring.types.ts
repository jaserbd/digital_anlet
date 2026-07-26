import type { SubScenarioCode } from './enums';

export interface SubScenarioScore {
  subScenarioCode: SubScenarioCode;
  overallScore: number;
  e2eAchieved: boolean;
}

export interface ScoreResultDto {
  finalScore: number;
  e2eAutomationRate: number;
  subScenarioScores: SubScenarioScore[];
}
