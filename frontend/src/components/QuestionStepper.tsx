import type { QuestionDto } from '@anlet/shared';

interface QuestionStepperProps {
  questions: QuestionDto[];
  currentIndex: number;
  isComplete: (questionId: string) => boolean;
  onSelect: (index: number) => void;
}

// Steps over questions (question-major layout) instead of sub-scenarios — see
// QuestionCard.tsx. "Complete" means every sub-scenario for that question is either
// answered or covered by a comment (see QuestionnairePage's isQuestionComplete).
export function QuestionStepper({ questions, currentIndex, isComplete, onSelect }: QuestionStepperProps) {
  return (
    <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {questions.map((q, i) => (
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
      ))}
    </nav>
  );
}
