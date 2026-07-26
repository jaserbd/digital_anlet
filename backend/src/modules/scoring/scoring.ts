import type { AnswerOption, ScoreResultDto, SubScenarioCode, SubScenarioScore } from '@anlet/shared';
import { round4 } from '../../lib/rounding';

export interface ScoringQuestionInput {
  id: string;
  weight: number;
  /** Numeric score per option, e.g. { A: 4, B: 3, C: 0 }. Not every option is scored. */
  optionCriteria: Partial<Record<AnswerOption, number>>;
  /** false only for the Intent question — excluded from the E2E checklist. */
  includeInE2ECheck: boolean;
}

export interface ScoringSubScenarioInput {
  id: string;
  code: SubScenarioCode;
  faultDistributionWeight: number;
}

export interface ScoringAnswerInput {
  questionId: string;
  subScenarioId: string;
  selectedOption: AnswerOption;
}

export interface ComputeScoreParams {
  questions: ScoringQuestionInput[];
  subScenarios: ScoringSubScenarioInput[];
  answers: ScoringAnswerInput[];
}

function topScoreOf(question: ScoringQuestionInput): number {
  return Math.max(...Object.values(question.optionCriteria).filter((v): v is number => v != null));
}

/**
 * Computes the ANLET score for one questionnaire response.
 *
 * Compensation rule (see `What is ANLET compensation.pdf` and CLAUDE.md): a question's
 * own "top score" is the highest of its option criteria. When a question's original
 * score equals its own top score, and that top score is below the questionnaire's
 * ceiling (the highest top score across all questions), it is compensated up to the
 * average of the other questions whose top score *is* the ceiling — if that average is
 * higher. This is a general per-question rule, not a fixed list of "anchor" questions.
 */
export function computeScoreResult(params: ComputeScoreParams): ScoreResultDto {
  const { questions, subScenarios, answers } = params;

  const ceiling = Math.max(...questions.map(topScoreOf));
  const answerByKey = new Map(
    answers.map((a) => [`${a.questionId}:${a.subScenarioId}`, a.selectedOption]),
  );

  const subScenarioScores: SubScenarioScore[] = subScenarios.map((subScenario) => {
    const originalScores = new Map<string, number>();
    const selectedOptions = new Map<string, AnswerOption>();

    for (const question of questions) {
      const selected = answerByKey.get(`${question.id}:${subScenario.id}`);
      if (!selected) {
        throw new Error(
          `Missing answer for question ${question.id} in sub-scenario ${subScenario.id}`,
        );
      }
      const originalScore = question.optionCriteria[selected];
      if (originalScore == null) {
        throw new Error(`Question ${question.id} has no criteria for option ${selected}`);
      }
      originalScores.set(question.id, originalScore);
      selectedOptions.set(question.id, selected);
    }

    const anchorQuestions = questions.filter((q) => topScoreOf(q) === ceiling);
    const anchorAverage =
      anchorQuestions.reduce((sum, q) => sum + originalScores.get(q.id)!, 0) /
      anchorQuestions.length;

    let overallScore = 0;
    for (const question of questions) {
      const own = topScoreOf(question);
      const original = originalScores.get(question.id)!;
      const compensated =
        own < ceiling && original === own && anchorAverage > own ? anchorAverage : original;
      overallScore += compensated * question.weight;
    }

    const e2eAchieved = questions
      .filter((q) => q.includeInE2ECheck)
      .every((q) => selectedOptions.get(q.id) === 'A');

    return {
      subScenarioCode: subScenario.code,
      overallScore: round4(overallScore),
      e2eAchieved,
    };
  });

  const weightSum = subScenarios.reduce((sum, s) => sum + s.faultDistributionWeight, 0);
  const finalScore =
    subScenarios.reduce((sum, s, i) => {
      const score = subScenarioScores[i];
      return score ? sum + score.overallScore * s.faultDistributionWeight : sum;
    }, 0) / weightSum;

  const e2eAutomationRate = subScenarios.reduce((sum, s, i) => {
    const score = subScenarioScores[i];
    return score?.e2eAchieved ? sum + s.faultDistributionWeight : sum;
  }, 0);

  return {
    finalScore: round4(finalScore),
    e2eAutomationRate: round4(e2eAutomationRate),
    subScenarioScores,
  };
}
