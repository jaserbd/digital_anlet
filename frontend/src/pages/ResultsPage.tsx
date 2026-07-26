import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { ScoreSummary } from '../components/ScoreSummary';
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

      <ScoreSummary
        finalScore={result.finalScore}
        subScenarios={questionnaire.subScenarios}
        subScenarioScores={result.subScenarioScores}
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
    </main>
  );
}
