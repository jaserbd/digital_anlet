import type {
  AnswerOption,
  QuestionScore,
  ScoreResultDto,
  SubScenarioCode,
  SubScenarioScore,
} from '@anlet/shared';
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

export interface ScoringIndicatorInput {
  id: string;
  weight: number;
  optionCriteria: Partial<Record<AnswerOption, number>>;
}

export interface ScoringKeiAnswerInput {
  indicatorId: string;
  selectedOption: AnswerOption;
}

export interface ComputeScoreParams {
  questions: ScoringQuestionInput[];
  subScenarios: ScoringSubScenarioInput[];
  answers: ScoringAnswerInput[];
  /** Key Effectiveness Indicators — omitted (or empty) for questionnaires without any. */
  indicators?: ScoringIndicatorInput[];
  keiAnswers?: ScoringKeiAnswerInput[];
}

/**
 * Effective Indicator score (NEW_HVS_PLAN.md Phase B): the weighted average of the answered
 * KEIs' criteria — `SUMPRODUCT(weight, score) / SUM(weight)` in the source Scoring sheets.
 * Kept separate from the IAADE capability score (never blended into finalScore). Unanswered
 * KEIs (skipped with a covering comment) are excluded and the remaining weights
 * re-normalized, same as skipped questions; null when nothing is answered.
 */
export function computeKeiScore(
  indicators: ScoringIndicatorInput[],
  keiAnswers: ScoringKeiAnswerInput[],
): number | null {
  const answerById = new Map(keiAnswers.map((a) => [a.indicatorId, a.selectedOption]));
  let weightedSum = 0;
  let weightSum = 0;
  for (const indicator of indicators) {
    const selected = answerById.get(indicator.id);
    if (!selected) continue;
    const score = indicator.optionCriteria[selected];
    if (score == null) {
      throw new Error(`Indicator ${indicator.id} has no criteria for option ${selected}`);
    }
    weightedSum += score * indicator.weight;
    weightSum += indicator.weight;
  }
  return weightSum > 0 ? round4(weightedSum / weightSum) : null;
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
 *
 * Skipped answers: a (question, subScenario) pair with no answer is excluded from that
 * sub-scenario's weighted average, and the remaining answered questions' weights are
 * re-normalized (divided by their own weight sum, not the full questionnaire's) so the
 * sub-scenario score stays meaningful despite the gap — callers (responses.service.ts)
 * are responsible for ensuring every skip is covered by a comment before calling this.
 * If every question in a sub-scenario is skipped, its overallScore is null and it is
 * excluded from the final-score weighted average the same way. Compensation only
 * considers *answered* anchor questions — if none are answered, compensation doesn't
 * apply for that sub-scenario.
 */
export function computeScoreResult(params: ComputeScoreParams): ScoreResultDto {
  const { questions, subScenarios, answers, indicators = [], keiAnswers = [] } = params;

  const ceiling = Math.max(...questions.map(topScoreOf));
  const answerByKey = new Map(
    answers.map((a) => [`${a.questionId}:${a.subScenarioId}`, a.selectedOption]),
  );

  const questionScores: QuestionScore[] = [];

  const subScenarioScores: SubScenarioScore[] = subScenarios.map((subScenario) => {
    const originalScores = new Map<string, number>();
    const selectedOptions = new Map<string, AnswerOption>();

    for (const question of questions) {
      const selected = answerByKey.get(`${question.id}:${subScenario.id}`);
      if (!selected) continue; // skipped — excluded below, weights re-normalized
      const originalScore = question.optionCriteria[selected];
      if (originalScore == null) {
        throw new Error(`Question ${question.id} has no criteria for option ${selected}`);
      }
      originalScores.set(question.id, originalScore);
      selectedOptions.set(question.id, selected);
    }

    const answeredQuestions = questions.filter((q) => originalScores.has(q.id));
    const answeredWeightSum = answeredQuestions.reduce((sum, q) => sum + q.weight, 0);

    const compensatedScores = new Map<string, number>();
    let overallScore: number | null = null;
    if (answeredWeightSum > 0) {
      const anchorQuestions = answeredQuestions.filter((q) => topScoreOf(q) === ceiling);
      const anchorAverage =
        anchorQuestions.length > 0
          ? anchorQuestions.reduce((sum, q) => sum + originalScores.get(q.id)!, 0) /
            anchorQuestions.length
          : null;

      let weightedSum = 0;
      for (const question of answeredQuestions) {
        const own = topScoreOf(question);
        const original = originalScores.get(question.id)!;
        const compensated =
          own < ceiling && original === own && anchorAverage != null && anchorAverage > own
            ? anchorAverage
            : original;
        compensatedScores.set(question.id, compensated);
        weightedSum += compensated * question.weight;
      }
      overallScore = round4(weightedSum / answeredWeightSum);
    }

    for (const question of questions) {
      questionScores.push({
        questionId: question.id,
        subScenarioId: subScenario.id,
        originalScore: originalScores.has(question.id) ? round4(originalScores.get(question.id)!) : null,
        compensatedScore: compensatedScores.has(question.id)
          ? round4(compensatedScores.get(question.id)!)
          : null,
      });
    }

    const e2eAchieved = questions
      .filter((q) => q.includeInE2ECheck)
      .every((q) => selectedOptions.get(q.id) === 'A');

    return {
      subScenarioCode: subScenario.code,
      overallScore,
      e2eAchieved,
    };
  });

  const scoredSubScenarios = subScenarios
    .map((s, i) => ({ subScenario: s, score: subScenarioScores[i]! }))
    .filter((x) => x.score.overallScore != null);
  const weightSum = scoredSubScenarios.reduce(
    (sum, x) => sum + x.subScenario.faultDistributionWeight,
    0,
  );
  const finalScore =
    weightSum > 0
      ? scoredSubScenarios.reduce(
          (sum, x) => sum + x.score.overallScore! * x.subScenario.faultDistributionWeight,
          0,
        ) / weightSum
      : 0;

  const e2eAutomationRate = subScenarios.reduce((sum, s, i) => {
    const score = subScenarioScores[i];
    return score?.e2eAchieved ? sum + s.faultDistributionWeight : sum;
  }, 0);

  return {
    finalScore: round4(finalScore),
    e2eAutomationRate: round4(e2eAutomationRate),
    keiScore: computeKeiScore(indicators, keiAnswers),
    subScenarioScores,
    questionScores,
  };
}
