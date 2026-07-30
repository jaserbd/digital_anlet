import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrganizationDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { opCoApi } from '../api/opCoApi';
import { insightsApi } from '../api/insightsApi';
import { CognitiveActivityChart } from './charts/RadarScoreChart';

export interface OrganizationSwitcher {
  organizations: OrganizationDto[];
  currentOrganizationId: string;
  onChange: (organizationId: string) => void;
}

// Executive/Admin aggregate IAADE/Cognitive-Activity spider chart (ADMIN_2.md item 1), shown
// at the top of each questionnaire's org-overview section — averaged across that
// organization's SUBMITTED responses, filterable by NatCo/Country (independent dropdowns,
// per product decision). `organizationSwitcher` is only passed by OrganizationDeepDivePage
// (Admin) — ExecutivePage has no need to switch organizations.
export function AggregateCognitiveActivityRadar({
  organizationId,
  questionnaireCode,
  organizationSwitcher,
}: {
  organizationId: string;
  questionnaireCode: string;
  organizationSwitcher?: OrganizationSwitcher;
}) {
  const [opCoId, setOpCoId] = useState('');
  const [country, setCountry] = useState('');

  const opCosQuery = useQuery({
    queryKey: ['opcos', organizationId],
    queryFn: () => opCoApi.list(organizationId),
  });
  const countries = useMemo(
    () => [...new Set((opCosQuery.data ?? []).map((o) => o.country))].sort(),
    [opCosQuery.data],
  );

  const summaryQuery = useQuery({
    queryKey: ['cognitive-activity-summary', organizationId, questionnaireCode, opCoId, country],
    queryFn: () =>
      insightsApi.getCognitiveActivitySummary(organizationId, questionnaireCode, {
        opCoId: opCoId || undefined,
        country: country || undefined,
      }),
  });

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
        {organizationSwitcher && (
          <TextField
            select
            label="Organization"
            size="small"
            value={organizationSwitcher.currentOrganizationId}
            onChange={(e) => organizationSwitcher.onChange(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {organizationSwitcher.organizations.map((org) => (
              <MenuItem key={org.id} value={org.id}>
                {org.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <TextField
          select
          label="NatCo"
          size="small"
          value={opCoId}
          onChange={(e) => setOpCoId(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All NatCos</MenuItem>
          {(opCosQuery.data ?? []).map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Country"
          size="small"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All countries</MenuItem>
          {countries.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {summaryQuery.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !summaryQuery.data || summaryQuery.data.sampleSize === 0 ? (
        <Typography color="text.secondary">No submitted responses match this filter yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: '1 1 380px', maxWidth: 520 }}>
            <CognitiveActivityChart
              axes={summaryQuery.data.activities
                .filter((a) => a.averageScore != null)
                .map((a) => ({ axis: a.cognitiveActivity, value: a.averageScore }))}
            />
          </Box>
          <Typography sx={{ fontSize: '1.875rem' }}>
            {summaryQuery.data.averageFinalScore?.toFixed(2) ?? '—'}{' '}
            <Typography component="span" sx={{ fontSize: '0.9rem' }} color="text.secondary">
              / 4 average ({summaryQuery.data.sampleSize} submitted)
            </Typography>
          </Typography>
        </Box>
      )}
    </Box>
  );
}
