import type { SubScenarioDto, SubScenarioScore } from '@anlet/shared';

interface ScoreSummaryProps {
  finalScore: number;
  subScenarios: SubScenarioDto[];
  subScenarioScores: SubScenarioScore[];
}

export function ScoreSummary({ finalScore, subScenarios, subScenarioScores }: ScoreSummaryProps) {
  const scoreByCode = new Map(subScenarioScores.map((s) => [s.subScenarioCode, s]));

  return (
    <section>
      <p style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>
        {finalScore.toFixed(2)} <span style={{ fontSize: '1rem', color: '#666' }}>/ 4</span>
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 480 }}>
        <thead>
          <tr>
            <th style={cellStyle}>Sub-scenario</th>
            <th style={cellStyle}>Weight</th>
            <th style={cellStyle}>Score</th>
          </tr>
        </thead>
        <tbody>
          {subScenarios.map((s) => (
            <tr key={s.id}>
              <td style={cellStyle}>{s.name}</td>
              <td style={cellStyle}>{(s.faultDistributionWeight * 100).toFixed(0)}%</td>
              <td style={cellStyle}>{scoreByCode.get(s.code)?.overallScore?.toFixed(2) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};
