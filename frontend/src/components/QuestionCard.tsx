import type { AnswerOption, QuestionDto } from '@anlet/shared';

interface QuestionCardProps {
  question: QuestionDto;
  selected: AnswerOption | undefined;
  onSelect: (option: AnswerOption) => void;
}

export function QuestionCard({ question, selected, onSelect }: QuestionCardProps) {
  return (
    <fieldset style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <legend>
        <strong>{question.serviceCapability}</strong> ({question.cognitiveActivity})
      </legend>
      <p style={{ whiteSpace: 'pre-wrap' }}>{question.questionText}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {question.options.map((opt) => (
          <label key={opt.option} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <input
              type="radio"
              name={question.id}
              checked={selected === opt.option}
              onChange={() => onSelect(opt.option)}
            />
            <span>
              <strong>{opt.option}.</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{opt.text}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
