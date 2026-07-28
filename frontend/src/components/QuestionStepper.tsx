import type { QuestionDto } from '@anlet/shared';
import { groupByCognitiveActivity } from '../lib/cognitiveActivity';

interface QuestionStepperProps {
  questions: QuestionDto[];
  currentIndex: number;
  isComplete: (questionId: string) => boolean;
  onSelect: (index: number) => void;
}

// Steps over questions (question-major layout) instead of sub-scenarios — see
// QuestionCard.tsx. "Complete" means every sub-scenario for that question is either
// answered or covered by a comment (see QuestionnairePage's isQuestionComplete). Grouped by
// Cognitive Activity (IAADE) per SECOND_REVIEW.md item 5.
export function QuestionStepper({ questions, currentIndex, isComplete, onSelect }: QuestionStepperProps) {
  const groups = groupByCognitiveActivity(questions);

  return (
    <nav style={{ marginBottom: '1.5rem' }}>
      {groups.map((group) => (
        <div key={group.name} style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '0.2rem' }}>
            {group.name} — {group.questions.length} question{group.questions.length === 1 ? '' : 's'},{' '}
            {(group.weight * 100).toFixed(0)}%
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {group.questions.map((q) => {
              const i = questions.indexOf(q);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelect(i)}
                  style={{
                    fontWeight: i === currentIndex ? 'bold' : 'normal',
                    textDecoration: isComplete(q.id) ? 'underline' : 'none',
                  }}
                >
                  {i + 1}. {q.serviceCapability} {isComplete(q.id) ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
