import type { CSSProperties } from 'react';
import type { AnswerDto, QuestionDto, SubScenarioDto, SubScenarioScore } from '@anlet/shared';

interface E2EChecklistTableProps {
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  answers: AnswerDto[];
  subScenarioScores: SubScenarioScore[];
  e2eAutomationRate: number;
}

export function E2EChecklistTable({
  questions,
  subScenarios,
  answers,
  subScenarioScores,
  e2eAutomationRate,
}: E2EChecklistTableProps) {
  const answerByKey = new Map(
    answers.map((a) => [`${a.questionId}:${a.subScenarioId}`, a.selectedOption]),
  );
  const scoreByCode = new Map(subScenarioScores.map((s) => [s.subScenarioCode, s]));
  const hasExcludedQuestion = questions.some((q) => !q.includeInE2ECheck);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Cognitive Activity</th>
            <th style={cellStyle}>Service Capability</th>
            {subScenarios.map((s) => (
              <th key={s.id} style={cellStyle}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id}>
              <td style={cellStyle}>{q.cognitiveActivity}</td>
              <td style={cellStyle}>
                {q.serviceCapability}
                {!q.includeInE2ECheck && ' *'}
              </td>
              {subScenarios.map((s) => {
                const selected = answerByKey.get(`${q.id}:${s.id}`);
                return (
                  <td key={s.id} style={{ ...cellStyle, textAlign: 'center' }}>
                    {selected === 'A' ? 'S' : 'P'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td style={cellStyle} colSpan={2}>
              <strong>End-to-end automation achieved</strong>
            </td>
            {subScenarios.map((s) => (
              <td key={s.id} style={{ ...cellStyle, textAlign: 'center' }}>
                <strong>{scoreByCode.get(s.code)?.e2eAchieved ? 'Y' : 'N'}</strong>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: '0.85em', color: '#666' }}>
        S = System, P = People.
        {hasExcludedQuestion &&
          ' * Excluded from the end-to-end automation determination (Intent is assessed separately).'}
      </p>
      <p>
        <strong>E2E automation rate: {(e2eAutomationRate * 100).toFixed(1)}%</strong>
      </p>
    </div>
  );
}

const cellStyle: CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  fontSize: '0.9em',
};
