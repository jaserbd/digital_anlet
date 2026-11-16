import Box from '@mui/material/Box';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { questionnaireApi } from '../api/questionnaireApi';
import { responsesApi } from '../api/responsesApi';
import { PageShell } from '../components/PageShell';
import { CoreDomainSummary } from '../components/CoreDomainSummary';
import { QuestionnaireResultDetail } from '../components/QuestionnaireResultDetail';
import { PageLoading } from '../components/Loading';

// One HVS-group member's detail section — a SUBMITTED response gets the full
// QuestionnaireResultDetail; an IN_PROGRESS one is simply omitted from the detail (no
// duplicate "start this" link — CoreDomainSummary, above, already offers that).
function CoreHvsMemberDetail({ questionnaireCode }: { questionnaireCode: string }) {
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode),
  });
  const responseQuery = useQuery({
    queryKey: ['response', questionnaireCode],
    queryFn: () => responsesApi.getOrCreate(questionnaireCode),
  });
  const resultQuery = useQuery({
    queryKey: ['result-for-questionnaire', questionnaireCode],
    queryFn: () => responsesApi.getResult(responseQuery.data!.id),
    enabled: responseQuery.data?.status === 'SUBMITTED',
  });

  if (questionnaireQuery.isLoading || responseQuery.isLoading) {
    return <PageLoading />;
  }
  if (!questionnaireQuery.data || !responseQuery.data) {
    return null;
  }
  if (responseQuery.data.status !== 'SUBMITTED' || !resultQuery.data) {
    return null;
  }

  return (
    // A heading, not a SectionCard: the detail is itself a stack of cards.
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {questionnaireQuery.data.name} — detail
      </Typography>
      <QuestionnaireResultDetail
        questionnaire={questionnaireQuery.data}
        response={responseQuery.data}
        result={resultQuery.data}
      />
    </Box>
  );
}

// Landing page for the Core Fault Management + Stability HVS group (FORTH_REVIEW.md items
// 5/6) — the "summary of both halves, then detail of each" flow the review asked for. The
// summary section reuses CoreDomainSummary unchanged (it already shows both scores, the
// 50/50 combined score, and links to whichever half is missing); detail sections below only
// render for whichever half is already submitted.
export function CoreHvsResultsPage() {
  const navigate = useNavigate();
  const { groupCode } = useParams<{ groupCode: string }>();

  const hvsEntriesQuery = useQuery({ queryKey: ['hvs-entries'], queryFn: questionnaireApi.listHvsEntries });
  const entry = hvsEntriesQuery.data?.find((e) => e.key === groupCode && e.kind === 'group');

  if (hvsEntriesQuery.isLoading) {
    return <PageLoading />;
  }
  if (!entry) {
    return <Typography color="text.secondary">This HVS group wasn&apos;t found.</Typography>;
  }

  return (
    <PageShell title={entry.name} maxWidth={1400}>
      <Button onClick={() => navigate('/results')} sx={{ mb: 2 }}>
        ← All results
      </Button>

      <CoreDomainSummary />

      {entry.questionnaireCodes.map((code) => (
        <CoreHvsMemberDetail key={code} questionnaireCode={code} />
      ))}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Haven&apos;t started one of these yet?{' '}
        <Link component={RouterLink} to="/domains">
          Go to the assessment picker
        </Link>
        .
      </Typography>
    </PageShell>
  );
}
