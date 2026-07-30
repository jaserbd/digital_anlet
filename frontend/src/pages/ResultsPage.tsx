import { useParams } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { CoreDomainSummary } from '../components/CoreDomainSummary';
import { PageShell } from '../components/PageShell';
import { QuestionnaireResultDetail } from '../components/QuestionnaireResultDetail';

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
    return <Typography color="text.secondary">Loading…</Typography>;
  }
  if (
    !responseQuery.data ||
    !resultQuery.data ||
    !questionnaireQuery.data ||
    responseQuery.isError ||
    resultQuery.isError ||
    questionnaireQuery.isError
  ) {
    return <Typography color="text.secondary">Results aren&apos;t available for this response.</Typography>;
  }

  const { data: response } = responseQuery;
  const { data: result } = resultQuery;
  const { data: questionnaire } = questionnaireQuery;

  return (
    <PageShell title={`${questionnaire.name} — Results`} maxWidth={1400}>
      {questionnaire.acceptingResponses && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Link component={RouterLink} to={`/questionnaire/${questionnaire.code}`}>
            Review / edit your answers
          </Link>{' '}
          — this assessment is still open; re-submitting recomputes your score.
        </Alert>
      )}

      <QuestionnaireResultDetail questionnaire={questionnaire} response={response} result={result} />

      {questionnaire.networkType === 'Core' && <CoreDomainSummary />}
    </PageShell>
  );
}
