import type { QuestionDto, QuestionScore } from '@anlet/shared';
import { CognitiveActivityChart } from './charts/RadarScoreChart';
import { computeCognitiveActivityAverages } from '../lib/cognitiveActivity';

// A Normal User's own IAADE/Cognitive-Activity spider chart (ADMIN_2.md item 1), shown at the
// top of their results — no fetch needed, everything is already loaded wherever
// QuestionnaireResultDetail renders (questionnaire.questions + result.questionScores).
export function PersonalCognitiveActivityRadar({
  questions,
  questionScores,
}: {
  questions: QuestionDto[];
  questionScores: QuestionScore[];
}) {
  const data = computeCognitiveActivityAverages(questions, questionScores);
  if (data.length === 0) {
    return null;
  }

  // The overall score sits beside it in QuestionnaireResultDetail's score card.
  return <CognitiveActivityChart axes={data} />;
}
