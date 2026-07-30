import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { questionnaireApi } from '../api/questionnaireApi';
import { PageShell } from '../components/PageShell';
import { ChoiceCard } from '../components/ChoiceCard';

// HVS-category-first, then Domain (OVERVIEW.md item 1 — was Domain-first). Selecting a
// (hvsCategory, networkType) pair resolves straight to its questionnaire when there's exactly
// one match (true for all questionnaires today); a future HVS with multiple matching
// questionnaires per domain falls back to a plain assessment-picker list instead of guessing.
// ChoiceCard tiles (OVERVIEW.md item 5) replace the original plain stacked buttons.
export function DomainPickerPage() {
  const navigate = useNavigate();
  const [selectedHvs, setSelectedHvs] = useState<string | null>(null);

  const questionnairesQuery = useQuery({
    queryKey: ['questionnaires'],
    queryFn: questionnaireApi.list,
  });

  if (questionnairesQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!questionnairesQuery.data) {
    return <p>Something went wrong loading the available assessments.</p>;
  }

  const hvsCategories = [...new Set(questionnairesQuery.data.map((q) => q.hvsCategory))];
  const questionnairesInHvs = questionnairesQuery.data.filter((q) => q.hvsCategory === selectedHvs);
  const domainsInHvs = [...new Set(questionnairesInHvs.map((q) => q.networkType))];

  function selectDomain(domain: string) {
    const matches = questionnairesInHvs.filter((q) => q.networkType === domain);
    const only = matches[0];
    if (matches.length === 1 && only) {
      navigate(`/questionnaire/${only.code}`);
    }
  }

  return (
    <PageShell title="Anlet" maxWidth={700}>
      {!selectedHvs ? (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Choose an HVS
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
            {hvsCategories.map((hvs) => (
              <ChoiceCard key={hvs} label={hvs} onClick={() => setSelectedHvs(hvs)} />
            ))}
          </Stack>
        </>
      ) : (
        <>
          <Button onClick={() => setSelectedHvs(null)} sx={{ mb: 2 }}>
            ← Back to HVS
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {selectedHvs} — choose a domain
          </Typography>
          <Stack spacing={3}>
            {domainsInHvs.map((domain) => {
              const matches = questionnairesInHvs.filter((q) => q.networkType === domain);
              return matches.length === 1 ? (
                <ChoiceCard key={domain} label={`${domain} Domain`} onClick={() => selectDomain(domain)} />
              ) : (
                <Box key={domain}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    {domain} Domain — choose an assessment
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
                    {matches.map((q) => (
                      <ChoiceCard key={q.code} label={q.name} onClick={() => navigate(`/questionnaire/${q.code}`)} />
                    ))}
                  </Stack>
                </Box>
              );
            })}
            {domainsInHvs.length === 0 && <Typography>No assessments available for this HVS yet.</Typography>}
          </Stack>
        </>
      )}
    </PageShell>
  );
}
