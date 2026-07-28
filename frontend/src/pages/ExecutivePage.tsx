import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { LogoutButton } from '../components/LogoutButton';
import { ScoreBar } from '../components/ScoreBar';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
};

export function ExecutivePage() {
  const { user } = useAuth();
  const organizationId = user!.organizationId;
  const [subScenarioIndex, setSubScenarioIndex] = useState(0);

  const questionnairesQuery = useQuery({ queryKey: ['questionnaires'], queryFn: questionnaireApi.list });
  const [questionnaireCode, setQuestionnaireCode] = useState('');
  const effectiveCode = questionnaireCode || questionnairesQuery.data?.[0]?.code || '';

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', effectiveCode],
    queryFn: () => questionnaireApi.get(effectiveCode),
    enabled: !!effectiveCode,
  });

  const summaryQuery = useQuery({
    queryKey: ['organization-summary', organizationId, effectiveCode],
    queryFn: () => insightsApi.getOrganizationSummary(organizationId, effectiveCode),
    enabled: !!effectiveCode,
  });

  const opCoBenchmarkQuery = useQuery({
    queryKey: ['opco-benchmarking', organizationId, effectiveCode],
    queryFn: () => insightsApi.getOpCoBenchmarkingSummary(organizationId, effectiveCode),
    enabled: !!effectiveCode,
  });

  // Reset the sub-scenario tab when switching assessments — a different questionnaire may
  // have fewer sub-scenarios than the previously selected tab index.
  useEffect(() => {
    setSubScenarioIndex(0);
  }, [effectiveCode]);

  if (questionnairesQuery.isLoading || questionnaireQuery.isLoading || summaryQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!questionnaireQuery.data || !summaryQuery.data) {
    return <p>Something went wrong loading the organization summary.</p>;
  }

  const { data: questionnaire } = questionnaireQuery;
  const { data: summary } = summaryQuery;
  const currentSubScenario = questionnaire.subScenarios[subScenarioIndex];

  const countsByKey = new Map(
    summary.answerDistribution.map((e) => [`${e.questionId}:${e.subScenarioId}`, e.counts]),
  );

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Organization Overview</h1>
        <LogoutButton />
      </div>

      <label>
        Assessment
        <select
          value={effectiveCode}
          onChange={(e) => setQuestionnaireCode(e.target.value)}
          style={{ display: 'block', marginBottom: '1rem' }}
        >
          {questionnairesQuery.data?.map((q) => (
            <option key={q.code} value={q.code}>
              {q.name}
            </option>
          ))}
        </select>
      </label>

      <h2>{questionnaire.name} — Respondents</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 600 }}>
        <thead>
          <tr>
            <th style={cellStyle}>Email</th>
            <th style={cellStyle}>Status</th>
            <th style={cellStyle}>Final score</th>
          </tr>
        </thead>
        <tbody>
          {summary.respondents.map((r) => (
            <tr key={r.userId}>
              <td style={cellStyle}>{r.email}</td>
              <td style={cellStyle}>{STATUS_LABEL[r.status]}</td>
              <td style={cellStyle}>{r.finalScore != null ? r.finalScore.toFixed(2) : '—'}</td>
            </tr>
          ))}
          {summary.respondents.length === 0 && (
            <tr>
              <td style={cellStyle} colSpan={3}>
                No normal users in this organization yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2 style={{ marginTop: '2rem' }}>OpCo benchmarking (submitted responses only)</h2>
      {opCoBenchmarkQuery.isLoading && <p>Loading…</p>}
      {opCoBenchmarkQuery.data && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={cellStyle}>OpCo</th>
                <th style={cellStyle}>Country</th>
                <th style={cellStyle}>Respondents</th>
                <th style={cellStyle}>Submitted</th>
                <th style={cellStyle}>Avg. final score</th>
                <th style={cellStyle}>Avg. E2E rate</th>
              </tr>
            </thead>
            <tbody>
              {opCoBenchmarkQuery.data.opCos.map((opCo) => (
                <tr key={opCo.opCoId}>
                  <td style={cellStyle}>{opCo.opCoName}</td>
                  <td style={cellStyle}>{opCo.country}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{opCo.respondentCount}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{opCo.submittedCount}</td>
                  <td style={cellStyle}>
                    <ScoreBar value={opCo.averageFinalScore} />
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    {opCo.averageE2eAutomationRate != null
                      ? `${(opCo.averageE2eAutomationRate * 100).toFixed(0)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
              {opCoBenchmarkQuery.data.opCos.length === 0 && (
                <tr>
                  <td style={cellStyle} colSpan={6}>
                    No OpCos created for this organization yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: '2rem' }}>Answer distribution (submitted responses only)</h2>
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {questionnaire.subScenarios.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubScenarioIndex(i)}
            style={{ fontWeight: i === subScenarioIndex ? 'bold' : 'normal' }}
          >
            {s.name}
          </button>
        ))}
      </nav>

      {currentSubScenario && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={cellStyle}>Service Capability</th>
              <th style={cellStyle}>A</th>
              <th style={cellStyle}>B</th>
              <th style={cellStyle}>C</th>
              <th style={cellStyle}>D</th>
            </tr>
          </thead>
          <tbody>
            {questionnaire.questions.map((q) => {
              const counts = countsByKey.get(`${q.id}:${currentSubScenario.id}`);
              const availableOptions = new Set(q.options.map((o) => o.option));
              const cell = (option: 'A' | 'B' | 'C' | 'D') =>
                availableOptions.has(option) ? (counts?.[option] ?? 0) : '—';
              return (
                <tr key={q.id}>
                  <td style={cellStyle}>{q.serviceCapability}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{cell('A')}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{cell('B')}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{cell('C')}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{cell('D')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

const cellStyle = {
  border: '1px solid #ccc',
  padding: '0.4rem 0.6rem',
  textAlign: 'left' as const,
};
