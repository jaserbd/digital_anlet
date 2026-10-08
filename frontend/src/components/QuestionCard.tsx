import { Fragment } from 'react';
import type { AnswerOption, QuestionDto, SubScenarioDto } from '@anlet/shared';
import { formatQuestionLabel } from '../lib/cognitiveActivity';
import { categoryRowSpans, hasSubScenarioCategories } from '../lib/subScenarioCategories';
import { QuestionCommentEditor, type CommentState } from './QuestionCommentEditor';
import { QUESTION_COLORS } from '../lib/questionText';
import { OptionList, QuestionText } from './QuestionContent';

interface QuestionCardProps {
  question: QuestionDto;
  ordinal: number;
  subScenarios: SubScenarioDto[];
  answers: Map<string, AnswerOption>; // keyed by subScenarioId, this question only
  comment: CommentState;
  onSelect: (subScenarioId: string, option: AnswerOption | null) => void;
  onCommentChange: (comment: CommentState) => void;
}

// Question-major layout (per FIRST_REVIEW.md): the question and its options are shown
// once, with one A-D radio group per sub-scenario below — instead of repeating the whole
// question once per sub-scenario (the old sub-scenario-major layout).
export function QuestionCard({
  question,
  ordinal,
  subScenarios,
  answers,
  comment,
  onSelect,
  onCommentChange,
}: QuestionCardProps) {
  const unansweredSubScenarioIds = subScenarios.filter((s) => !answers.has(s.id)).map((s) => s.id);
  // Categories render as a full-width heading row above each group rather than a column: the
  // answer cell's radios don't wrap, so an extra column would squeeze the sub-scenario names.
  const groupStarts = hasSubScenarioCategories(subScenarios) ? categoryRowSpans(subScenarios) : null;

  return (
    <fieldset style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <legend>
        <strong>
          {ordinal}. {formatQuestionLabel(question)}
        </strong>{' '}
        — weight {(question.weight * 100).toFixed(0)}%
      </legend>
      <QuestionText text={question.questionText} />
      {question.answeringGuideline && (
        <details style={{ margin: '0 0 1rem', border: '1px solid #ddd', borderRadius: 4, padding: '0.4rem 0.6rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Guideline for this question</summary>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>{question.answeringGuideline}</p>
        </details>
      )}
      <OptionList options={question.options} />

      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
        <thead>
          <tr>
            <th style={cellStyle}>Sub-scenario</th>
            <th style={cellStyle}>Weight</th>
            <th style={cellStyle}>Answer</th>
          </tr>
        </thead>
        <tbody>
          {subScenarios.map((s) => (
            <Fragment key={s.id}>
              {groupStarts?.has(s.id) && (
                <tr>
                  <td colSpan={3} style={{ ...cellStyle, fontWeight: 'bold', background: '#f3f3f3' }}>
                    {s.category}
                  </td>
                </tr>
              )}
              <tr style={unansweredSubScenarioIds.includes(s.id) ? { background: '#fff4e5' } : undefined}>
                <td style={cellStyle}>{s.name}</td>
                <td style={cellStyle}>{(s.faultDistributionWeight * 100).toFixed(0)}%</td>
                <td style={cellStyle}>
                  <div role="radiogroup" aria-label={`Answer for ${s.name}`} style={radioGroupStyle}>
                    <label style={radioLabelStyle}>
                      <input
                        type="radio"
                        name={`answer-${question.id}-${s.id}`}
                        checked={!answers.has(s.id)}
                        onChange={() => onSelect(s.id, null)}
                      />
                      <span style={{ fontSize: '0.85em', color: '#666' }}>No answer</span>
                    </label>
                    {question.options.map((opt) => {
                      const selected = answers.get(s.id) === opt.option;
                      return (
                        <label key={opt.option} style={radioLabelStyle}>
                          <input
                            type="radio"
                            name={`answer-${question.id}-${s.id}`}
                            checked={selected}
                            onChange={() => onSelect(s.id, opt.option)}
                          />
                          <span style={selected ? selectedAnswerStyle : undefined}>
                            {opt.option} ({opt.criteria})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>

      <QuestionCommentEditor
        subScenarios={subScenarios}
        comment={comment}
        onChange={onCommentChange}
        unansweredSubScenarioIds={unansweredSubScenarioIds}
      />
    </fieldset>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};

const radioGroupStyle = {
  display: 'flex',
  gap: '0.6rem',
  flexWrap: 'nowrap' as const,
  alignItems: 'center',
};

const radioLabelStyle = {
  display: 'flex',
  gap: '0.25rem',
  alignItems: 'center',
  whiteSpace: 'nowrap' as const,
};

// The picked answer reads as a filled chip, so chosen answers stand out from the other options.
const selectedAnswerStyle = {
  padding: '0 0.45rem',
  borderRadius: 999,
  background: QUESTION_COLORS.selected,
  color: '#ffffff',
  fontWeight: 700,
};
