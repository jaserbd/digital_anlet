import { useEffect } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { PageShell } from '../components/PageShell';

// Landing page for a single (non-grouped) HVS reached from the new Results picker
// (FORTH_REVIEW.md item 6). getOrCreate is idempotent regardless of response status — if
// already SUBMITTED, redirect straight into the existing ResultsPage; if still IN_PROGRESS,
// there's nothing to show yet, so offer a link to go answer it instead.
export function SingleHvsResultsPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const questionnaireCode = code!;

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode),
  });
  const responseQuery = useQuery({
    queryKey: ['response', questionnaireCode],
    queryFn: () => responsesApi.getOrCreate(questionnaireCode),
  });

  useEffect(() => {
    if (responseQuery.data?.status === 'SUBMITTED') {
      navigate(`/results/${responseQuery.data.id}`, { replace: true });
    }
  }, [responseQuery.data, navigate]);

  if (questionnaireQuery.isLoading || responseQuery.isLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }
  if (!questionnaireQuery.data || !responseQuery.data) {
    return <Typography color="text.secondary">Something went wrong loading this assessment.</Typography>;
  }
  if (responseQuery.data.status === 'SUBMITTED') {
    return null; // redirecting
  }

  return (
    <PageShell title={questionnaireQuery.data.name} maxWidth={700}>
      <Button onClick={() => navigate('/results')} sx={{ mb: 2 }}>
        ← All results
      </Button>
      <Typography sx={{ mb: 1 }}>
        You haven&apos;t submitted this assessment yet, so there are no results to show.
      </Typography>
      <Link component={RouterLink} to={`/questionnaire/${questionnaireCode}`}>
        Go answer it
      </Link>
    </PageShell>
  );
}
