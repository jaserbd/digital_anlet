import type { CSSProperties } from 'react';
import type { QuestionDto, QuestionScore, SubScenarioDto } from '@anlet/shared';

interface ScoreBreakdownTableProps {
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  questionScores: QuestionScore[];
}

// The results page's primary table (SECOND_REVIEW.md item 7): one row per question, grouped
// visually by Cognitive Activity (IAADE) on the left, one column per sub-scenario, cell =
// that question's compensated score for that sub-scenario (the value that actually feeds
// the sub-scenario's weighted-average overallScore — see scoring.ts). A skipped
// (question, subScenario) cell shows "—" rather than a misleading 0.
export function ScoreBreakdownTable({ questions, subScenarios, questionScores }: ScoreBreakdownTableProps) {
  const scoreByKey = new Map(
    questionScores.map((qs) => [`${qs.questionId}:${qs.subScenarioId}`, qs]),
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={cellStyle}>Cognitive Activity</th>
            <th style={cellStyle}>Service Capability</th>
            <th style={cellStyle}>Weight</th>
            {subScenarios.map((s) => (
              <th key={s.id} style={cellStyle}>
                {s.name} ({(s.faultDistributionWeight * 100).toFixed(0)}%)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => {
            const showCognitiveActivity = i === 0 || questions[i - 1]!.cognitiveActivity !== q.cognitiveActivity;
            return (
              <tr key={q.id}>
                <td style={cellStyle}>{showCognitiveActivity ? q.cognitiveActivity : ''}</td>
                <td style={cellStyle}>{q.serviceCapability}</td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>{(q.weight * 100).toFixed(0)}%</td>
                {subScenarios.map((s) => {
                  const qs = scoreByKey.get(`${q.id}:${s.id}`);
                  return (
                    <td key={s.id} style={{ ...cellStyle, textAlign: 'center' }}>
                      {qs?.compensatedScore != null ? (
                        qs.compensatedScore.toFixed(2)
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: '0.85em', color: '#666' }}>
        Each cell is the question's compensated score for that sub-scenario (see the
        compensation rule in CLAUDE.md) — "—" means the question was skipped for that
        sub-scenario.
      </p>
    </div>
  );
}

const cellStyle: CSSProperties = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  fontSize: '0.9em',
};
