import type { SubScenarioCode } from './enums';

export interface SubScenarioScore {
  subScenarioCode: SubScenarioCode;
  // Null only when every question in this sub-scenario was skipped (no answer, covered by
  // a comment) — excluded from the final-score weighted average in that case.
  overallScore: number | null;
  e2eAchieved: boolean;
}

// Per-question, per-sub-scenario score breakdown — the compensated score that feeds into
// SubScenarioScore.overallScore's weighted average. Emitted for every (question,
// subScenario) pair, including unanswered ones (both scores null there), so a results-page
// matrix can render one row per question without re-deriving anything.
export interface QuestionScore {
  questionId: string;
  subScenarioId: string;
  originalScore: number | null;
  compensatedScore: number | null;
}

export interface ScoreResultDto {
  finalScore: number;
  e2eAutomationRate: number;
  // Effective Indicator (KEI) score — separate from finalScore, never blended into it. Null
  // when the questionnaire has no KEIs or every KEI was skipped.
  keiScore: number | null;
  subScenarioScores: SubScenarioScore[];
  questionScores: QuestionScore[];
}
