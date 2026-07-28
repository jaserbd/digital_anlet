import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { ScoreSummary } from '../components/ScoreSummary';
import { ScoreBreakdownTable } from '../components/ScoreBreakdownTable';
import { E2EChecklistTable } from '../components/E2EChecklistTable';
import { CoreDomainSummary } from '../components/CoreDomainSummary';
import { LogoutButton } from '../components/LogoutButton';

export function ResultsPage() {
  const { responseId } = useParams<{ responseId: string }>();

  const responseQuery = useQuery({
    queryKey: ['response-by-id', responseId],
    queryFn: () => responsesApi.get(responseId!),
    enabled: !!responseId,
  });

  const resultQuery = useQuery({
    queryKey: ['result', responseId],
    queryFn: () => responsesApi.getResult(responseId!),
    enabled: !!responseId,
  });

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', responseQuery.data?.questionnaireCode],
    queryFn: () => questionnaireApi.get(responseQuery.data!.questionnaireCode),
    enabled: !!responseQuery.data,
  });

  if (responseQuery.isLoading || resultQuery.isLoading || questionnaireQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (
    !responseQuery.data ||
    !resultQuery.data ||
    !questionnaireQuery.data ||
    responseQuery.isError ||
    resultQuery.isError ||
    questionnaireQuery.isError
  ) {
    return <p>Results aren&apos;t available for this response.</p>;
  }

  const { data: response } = responseQuery;
  const { data: result } = resultQuery;
  const { data: questionnaire } = questionnaireQuery;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{questionnaire.name} — Results</h1>
        <LogoutButton />
      </div>

      {questionnaire.acceptingResponses && (
        <p>
          <Link to={`/questionnaire/${questionnaire.code}`}>Review / edit your answers</Link> — this
          assessment is still open; re-submitting recomputes your score.
        </p>
      )}

      <p style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>
        {result.finalScore.toFixed(2)} <span style={{ fontSize: '1rem', color: '#666' }}>/ 4</span>
      </p>

      <h2>Score breakdown</h2>
      <ScoreBreakdownTable
        questions={questionnaire.questions}
        subScenarios={questionnaire.subScenarios}
        questionScores={result.questionScores}
      />

      <h2 style={{ marginTop: '1.5rem' }}>Sub-scenario summary</h2>
      <ScoreSummary
        finalScore={result.finalScore}
        subScenarios={questionnaire.subScenarios}
        subScenarioScores={result.subScenarioScores}
        hideFinalScore
      />

      {questionnaire.hasE2ECheck && (
        <>
          <h2>E2E automation checklist</h2>
          <E2EChecklistTable
            questions={questionnaire.questions}
            subScenarios={questionnaire.subScenarios}
            answers={response.answers}
            subScenarioScores={result.subScenarioScores}
            e2eAutomationRate={result.e2eAutomationRate}
          />
        </>
      )}

      {questionnaire.networkType === 'Core' && <CoreDomainSummary />}

      {response.comments.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.5rem' }}>Your comments</h2>
          <ul style={{ paddingLeft: '1.25rem' }}>
            {response.comments.map((c) => {
              const question = questionnaire.questions.find((q) => q.id === c.questionId);
              const subScenarioNames = c.subScenarioIds
                .map((id) => questionnaire.subScenarios.find((s) => s.id === id)?.name)
                .filter((name): name is string => !!name);
              return (
                <li key={c.questionId} style={{ marginBottom: '0.75rem' }}>
                  <strong>{question?.serviceCapability ?? c.questionId}</strong>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>
                    Applies to:{' '}
                    {c.appliesToNone
                      ? 'None of the sub-scenarios'
                      : subScenarioNames.length > 0
                        ? subScenarioNames.join(', ')
                        : '—'}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{c.commentText}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
