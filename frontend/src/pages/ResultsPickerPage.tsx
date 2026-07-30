import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { questionnaireApi } from '../api/questionnaireApi';
import { PageShell } from '../components/PageShell';
import { ChoiceCard } from '../components/ChoiceCard';

// Domain -> HVS picker for viewing results (FORTH_REVIEW.md items 5/6) — a structural copy
// of DomainPickerPage.tsx's click-based two-level list, but sourced from listHvsEntries so
// Core Fault Management + Stability collapse into one HVS entry here (unlike
// DomainPickerPage, which keeps them separate since they're independently answerable).
// ChoiceCard tiles (OVERVIEW.md item 5) replace the original plain stacked buttons.
export function ResultsPickerPage() {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const hvsEntriesQuery = useQuery({ queryKey: ['hvs-entries'], queryFn: questionnaireApi.listHvsEntries });

  if (hvsEntriesQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!hvsEntriesQuery.data) {
    return <p>Something went wrong loading the available assessments.</p>;
  }

  const domains = [...new Set(hvsEntriesQuery.data.map((e) => e.networkType))];
  const entriesInDomain = hvsEntriesQuery.data.filter((e) => e.networkType === selectedDomain);

  function goToEntry(entry: { kind: 'single' | 'group'; key: string }) {
    navigate(entry.kind === 'group' ? `/results/hvs/${entry.key}` : `/results/questionnaire/${entry.key}`);
  }

  return (
    <PageShell title="Results" maxWidth={700}>
      {!selectedDomain ? (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Choose a domain
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
            {domains.map((domain) => (
              <ChoiceCard key={domain} label={`${domain} Domain`} onClick={() => setSelectedDomain(domain)} />
            ))}
          </Stack>
        </>
      ) : (
        <>
          <Button onClick={() => setSelectedDomain(null)} sx={{ mb: 2 }}>
            ← Back to domains
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {selectedDomain} Domain — choose an assessment
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
            {entriesInDomain.map((entry) => (
              <ChoiceCard key={entry.key} label={entry.name} onClick={() => goToEntry(entry)} />
            ))}
            {entriesInDomain.length === 0 && <Typography>No assessments available in this domain yet.</Typography>}
          </Stack>
        </>
      )}
    </PageShell>
  );
}
