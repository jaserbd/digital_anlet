import type { QuestionDto, QuestionScore } from '@anlet/shared';
import { CognitiveActivityChart } from './charts/RadarScoreChart';
import { computeCognitiveActivityAverages } from '../lib/cognitiveActivity';

// A Normal User's own IAADE/Cognitive-Activity spider chart (ADMIN_2.md item 1), shown at the
// top of their results — no fetch needed, everything is already loaded wherever
// QuestionnaireResultDetail renders (questionnaire.questions + result.questionScores).
export function PersonalCognitiveActivityRadar({
  questions,
  questionScores,
  finalScore,
}: {
  questions: QuestionDto[];
  questionScores: QuestionScore[];
  finalScore: number;
}) {
  const data = computeCognitiveActivityAverages(questions, questionScores);
  if (data.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
      <div style={{ flex: '1 1 380px', maxWidth: 520 }}>
        <CognitiveActivityChart axes={data} />
      </div>
      <p style={{ fontSize: '1.875rem', margin: 0 }}>
        {finalScore.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#666' }}>/ 4 average</span>
      </p>
    </div>
  );
}
