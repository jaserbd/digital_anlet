import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { LogoutButton } from '../components/LogoutButton';
import { BenchmarkTable } from '../components/BenchmarkTable';
import { groupByCognitiveActivity } from '../lib/cognitiveActivity';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
};

export function ExecutivePage() {
  const { user } = useAuth();
  const organizationId = user!.organizationId;
  const [subScenarioIndex, setSubScenarioIndex] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const drilldownQuery = useQuery({
    queryKey: ['answer-drilldown', organizationId, effectiveCode],
    queryFn: () => insightsApi.getAnswerDrilldown(organizationId, effectiveCode),
    enabled: !!effectiveCode,
  });

  // Reset the sub-scenario tab when switching assessments — a different questionnaire may
  // have fewer sub-scenarios than the previously selected tab index.
  useEffect(() => {
    setSubScenarioIndex(0);
    setExpandedKey(null);
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
  const respondentsByKey = new Map(
    (drilldownQuery.data?.entries ?? []).map((e) => [
      `${e.questionId}:${e.subScenarioId}:${e.option}`,
      e.respondents,
    ]),
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
        <BenchmarkTable
          rows={opCoBenchmarkQuery.data.rows}
          subScenarios={questionnaire.subScenarios}
          hideOrganizationColumn
        />
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
            {groupByCognitiveActivity(questionnaire.questions).map((group) => (
              <Fragment key={group.name}>
                <tr>
                  <td style={{ ...cellStyle, fontWeight: 'bold', background: '#f5f5f5' }} colSpan={5}>
                    {group.name} — {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
                    {' '}({(group.weight * 100).toFixed(0)}%)
                  </td>
                </tr>
                {group.questions.map((q) => {
                  const counts = countsByKey.get(`${q.id}:${currentSubScenario.id}`);
                  const availableOptions = new Set(q.options.map((o) => o.option));
                  const expandedRespondents = expandedKey ? respondentsByKey.get(expandedKey) : undefined;
                  const rowHasExpanded = expandedKey?.startsWith(`${q.id}:${currentSubScenario.id}:`);
                  return (
                    <Fragment key={q.id}>
                      <tr>
                        <td style={{ ...cellStyle, paddingLeft: '1.5rem' }}>{q.serviceCapability}</td>
                        {(['A', 'B', 'C', 'D'] as const).map((option) => {
                          if (!availableOptions.has(option)) {
                            return (
                              <td key={option} style={{ ...cellStyle, textAlign: 'center' }}>
                                —
                              </td>
                            );
                          }
                          const count = counts?.[option] ?? 0;
                          const key = `${q.id}:${currentSubScenario.id}:${option}`;
                          return (
                            <td
                              key={option}
                              style={{
                                ...cellStyle,
                                textAlign: 'center',
                                cursor: count > 0 ? 'pointer' : 'default',
                                textDecoration: expandedKey === key ? 'underline' : 'none',
                              }}
                              onClick={() => count > 0 && setExpandedKey(expandedKey === key ? null : key)}
                              title={count > 0 ? 'Click to see who chose this option' : undefined}
                            >
                              {count}
                            </td>
                          );
                        })}
                      </tr>
                      {rowHasExpanded && (
                        <tr>
                          <td colSpan={5} style={{ ...cellStyle, background: '#f9f9f9' }}>
                            <strong>Respondents ({expandedKey!.split(':')[2]}):</strong>
                            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem' }}>
                              {(expandedRespondents ?? []).map((r) => (
                                <li key={r.userId}>
                                  {r.email} — {r.opCoName ?? 'no OpCo'}
                                  {r.country ? `, ${r.country}` : ''}
                                  {r.designation ? ` — ${r.designation}` : ''}
                                  {r.workingDomain ? ` (${r.workingDomain})` : ''}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
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
