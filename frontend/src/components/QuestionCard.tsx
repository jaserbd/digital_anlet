import type { AnswerOption, QuestionDto, SubScenarioDto } from '@anlet/shared';
import { QuestionCommentEditor, type CommentState } from './QuestionCommentEditor';

interface QuestionCardProps {
  question: QuestionDto;
  subScenarios: SubScenarioDto[];
  answers: Map<string, AnswerOption>; // keyed by subScenarioId, this question only
  comment: CommentState;
  onSelect: (subScenarioId: string, option: AnswerOption | null) => void;
  onCommentChange: (comment: CommentState) => void;
}

// Question-major layout (per FIRST_REVIEW.md): the question and its options are shown
// once, with one A-D dropdown per sub-scenario below — instead of repeating the whole
// question once per sub-scenario (the old sub-scenario-major layout).
export function QuestionCard({
  question,
  subScenarios,
  answers,
  comment,
  onSelect,
  onCommentChange,
}: QuestionCardProps) {
  return (
    <fieldset style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <legend>
        <strong>{question.serviceCapability}</strong> ({question.cognitiveActivity}) — weight{' '}
        {(question.weight * 100).toFixed(0)}%
      </legend>
      <p style={{ whiteSpace: 'pre-wrap' }}>{question.questionText}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
        {question.options.map((opt) => (
          <div key={opt.option}>
            <strong>
              {opt.option} ({opt.criteria}).
            </strong>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{opt.text}</span>
          </div>
        ))}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 480 }}>
        <thead>
          <tr>
            <th style={cellStyle}>Sub-scenario</th>
            <th style={cellStyle}>Weight</th>
            <th style={cellStyle}>Answer</th>
          </tr>
        </thead>
        <tbody>
          {subScenarios.map((s) => (
            <tr key={s.id}>
              <td style={cellStyle}>{s.name}</td>
              <td style={cellStyle}>{(s.faultDistributionWeight * 100).toFixed(0)}%</td>
              <td style={cellStyle}>
                <select
                  value={answers.get(s.id) ?? ''}
                  onChange={(e) => onSelect(s.id, (e.target.value || null) as AnswerOption | null)}
                >
                  <option value="">— Not answered —</option>
                  {question.options.map((opt) => (
                    <option key={opt.option} value={opt.option}>
                      {opt.option} ({opt.criteria})
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <QuestionCommentEditor subScenarios={subScenarios} comment={comment} onChange={onCommentChange} />
    </fieldset>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};
