import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { organizationsApi } from '../api/organizationsApi';
import { insightsApi } from '../api/insightsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { BenchmarkTable } from '../components/BenchmarkTable';
import { CombinedBenchmarkTable } from '../components/CombinedBenchmarkTable';
import { buildCrossOrgCommentCollectionRows, CommentCollectionTable } from '../components/CommentCollectionTable';

export function AdminPage() {
  const navigate = useNavigate();
  return (
    <PageShell title="Admin" maxWidth={1400}>
      <Button variant="contained" onClick={() => navigate('/admin/management')} sx={{ mb: 3 }}>
        Management Console →
      </Button>
      <OrganizationsSection />
      <BenchmarkingSection />
    </PageShell>
  );
}

// Plain organization directory (ADMIN.md item 2) — a direct entry point into
// OrganizationDeepDivePage's Executive-parity view for any organization, alongside the
// existing Benchmarking table's org autocomplete/click-through (which stays working too).
// A dense list, not ChoiceCard tiles (OVERVIEW.md item 5) — that treatment is reserved for
// few-option "pick your path" screens, not admin directories that can grow arbitrarily long.
function OrganizationsSection() {
  const navigate = useNavigate();
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  return (
    <SectionCard title="Organizations">
      {orgsQuery.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : (
        <List disablePadding>
          {orgsQuery.data?.map((org) => (
            <ListItemButton
              key={org.id}
              onClick={() => navigate(`/admin/organizations/${org.id}`)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemText primary={org.name} />
            </ListItemButton>
          ))}
          {orgsQuery.data?.length === 0 && (
            <Typography color="text.secondary">No organizations yet.</Typography>
          )}
        </List>
      )}
    </SectionCard>
  );
}

function BenchmarkingSection() {
  const navigate = useNavigate();
  // listHvsEntries (FORTH_REVIEW.md items 5/6) collapses Core Fault Management + Stability
  // into one selectable "Core Network Fault Management & Stability Assessment" entry instead
  // of two independent questionnaire rows — everything else keeps working exactly as before.
  const hvsEntriesQuery = useQuery({ queryKey: ['hvs-entries'], queryFn: questionnaireApi.listHvsEntries });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });
  const [hvsKey, setHvsKey] = useState('');

  const effectiveEntry = hvsEntriesQuery.data?.find((e) => e.key === hvsKey) ?? hvsEntriesQuery.data?.[0];
  const isGroup = effectiveEntry?.kind === 'group';

  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', effectiveEntry?.key],
    queryFn: () => questionnaireApi.get(effectiveEntry!.questionnaireCodes[0]!),
    enabled: !!effectiveEntry && !isGroup,
  });
  const benchmarkQuery = useQuery({
    queryKey: ['benchmarking', effectiveEntry?.key],
    queryFn: () => insightsApi.getBenchmarkingSummary(effectiveEntry!.key),
    enabled: !!effectiveEntry && !isGroup,
  });
  const combinedQuery = useQuery({
    queryKey: ['combined-benchmarking', effectiveEntry?.key],
    queryFn: () => insightsApi.getCombinedBenchmarkingSummary(effectiveEntry!.key),
    enabled: !!effectiveEntry && isGroup,
  });

  if (hvsEntriesQuery.isLoading) {
    return (
      <SectionCard title="Benchmarking">
        <Typography color="text.secondary">Loading…</Typography>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Benchmarking">
      <TextField
        select
        label="Assessment"
        value={effectiveEntry?.key ?? ''}
        onChange={(e) => setHvsKey(e.target.value)}
        sx={{ mb: 2, minWidth: 320 }}
      >
        {hvsEntriesQuery.data?.map((entry) => (
          <MenuItem key={entry.key} value={entry.key}>
            {entry.name}
          </MenuItem>
        ))}
      </TextField>
      {isGroup ? (
        combinedQuery.data ? (
          <>
            <CombinedBenchmarkTable
              rows={combinedQuery.data.rows}
              exportFileNamePrefix={`admin-${effectiveEntry?.key ?? 'benchmarking'}`}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Combined avg is the 50/50 blend of Fault Management and Stability per the Core
              Domain guideline; either half shows "—" for a row with no submissions yet.
            </Typography>
          </>
        ) : (
          <Typography color="text.secondary">Loading…</Typography>
        )
      ) : questionnaireQuery.data && benchmarkQuery.data ? (
        <>
          <BenchmarkTable
            rows={benchmarkQuery.data.rows}
            subScenarios={questionnaireQuery.data.subScenarios}
            organizations={orgsQuery.data ?? []}
            onOrganizationSelect={(org) => navigate(`/admin/organizations/${org.id}`)}
            exportFileNamePrefix={`admin-${questionnaireQuery.data.code}`}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Type an organization's name in the Organization filter (or click its name in a
            row) to open its Deep-Dive page — NatCos, comments, and per-question breakdowns.
            Averages here are computed over submitted responses only; a row with none shows
            "—" rather than a misleading zero. A blank OpCo/Country means the respondent(s)
            haven't been assigned an OpCo yet — for a small organization with no OpCos at
            all, the NatCo column shows the organization's own name.
          </Typography>
        </>
      ) : (
        <Typography color="text.secondary">Loading…</Typography>
      )}

      {effectiveEntry && (
        <Box sx={{ mt: 3 }}>
          {effectiveEntry.questionnaireCodes.map((code) => (
            <Box key={code} sx={{ mb: 3 }}>
              <CrossOrgCommentCollectionSection questionnaireCode={code} />
            </Box>
          ))}
        </Box>
      )}
    </SectionCard>
  );
}

// Cross-organization Comment Collection (ADMIN.md item 3) — every comment for this
// questionnaire across every organization at once, with Organization as the first column.
// Rendered once per member questionnaire code by BenchmarkingSection above (1 for a plain
// HVS, 2 for the Core FM+Stability group — comments don't blend across questionnaires the
// way scores do, so this is two separate tables rather than one combined one).
function CrossOrgCommentCollectionSection({ questionnaireCode }: { questionnaireCode: string }) {
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode),
  });
  const commentsQuery = useQuery({
    queryKey: ['cross-org-comment-collection', questionnaireCode],
    queryFn: () => insightsApi.getCrossOrgCommentCollection(questionnaireCode),
  });

  if (questionnaireQuery.isLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }
  if (!questionnaireQuery.data) {
    return null;
  }
  const questionnaire = questionnaireQuery.data;
  const rows = buildCrossOrgCommentCollectionRows(
    commentsQuery.data?.comments ?? [],
    questionnaire.questions,
    questionnaire.subScenarios,
  );

  return (
    <CommentCollectionTable
      rows={rows}
      domain={questionnaire.networkType}
      hvs={questionnaire.hvsCategory}
      title={`${questionnaire.name} — Comment Collection (all organizations)`}
      showOrganizationColumn
      exportFileNamePrefix={`admin-${questionnaireCode}`}
    />
  );
}
