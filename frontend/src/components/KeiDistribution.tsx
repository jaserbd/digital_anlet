import { useState } from 'react';
import type { EffectivenessIndicatorDto, KeiDrilldownEntryDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { OptionCountsChart, OPTION_COLORS } from './charts/OptionCountsChart';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import {
  buildKeiChartData,
  buildKeiResponsesSheet,
  indexKeiResponses,
  keiOptionsOffered,
  type KeiBucket,
} from '../lib/keiDistribution';

const SKIPPED_COLOR = '#777';

// Executive / Admin view of submitted Key Effectiveness Indicator answers (NEW_HVS_PLAN.md
// Phase B) — the KEI analogue of AnswerDistributionDrilldown: per-indicator option counts
// (plus how many skipped it with a comment), each count expanding into the respondents behind
// it with their measured value and comment. `opCoScopeId` scopes to one NatCo the same way.
export function KeiDistribution({
  indicators,
  responses,
  opCoScopeId,
  exportFileNamePrefix,
}: {
  indicators: EffectivenessIndicatorDto[];
  responses: KeiDrilldownEntryDto[];
  opCoScopeId?: string | null;
  exportFileNamePrefix?: string;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const index = indexKeiResponses(responses, opCoScopeId);
  const options = keiOptionsOffered(indicators);
  const scopedResponses = opCoScopeId ? responses.filter((r) => r.respondent.opCoId === opCoScopeId) : responses;

  return (
    <Box>
      {exportFileNamePrefix && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button
            variant="outlined"
            disabled={scopedResponses.length === 0}
            onClick={() =>
              exportRowsToXlsx(`${exportFileNamePrefix}-effectiveness-indicators`, [
                buildKeiResponsesSheet(indicators, scopedResponses),
              ])
            }
          >
            Export to Excel
          </Button>
        </Box>
      )}
      <Stack spacing={1.5}>
        {indicators.map((k) => {
          const counts = index.countsByIndicator.get(k.id);
          const expanded = expandedKey?.startsWith(`${k.id}:`) ? expandedKey : null;
          const buckets: KeiBucket[] = [...options, 'skipped'];
          return (
            <Paper key={k.id} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>
                {k.name}{' '}
                <Typography component="span" color="text.secondary">
                  — weight {(k.weight * 100).toFixed(0)}%
                </Typography>
              </Typography>
              <Stack spacing={0.25} sx={{ my: 1 }}>
                {k.options.map((o) => (
                  <Typography key={o.option} variant="body2" color="text.secondary">
                    {o.option} ({o.criteria}): {o.text}
                  </Typography>
                ))}
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {buckets.map((bucket) => {
                  const count = counts?.[bucket] ?? 0;
                  const key = `${k.id}:${bucket}`;
                  const isExpanded = expanded === key;
                  const color = bucket === 'skipped' ? SKIPPED_COLOR : OPTION_COLORS[bucket];
                  return (
                    <Chip
                      key={bucket}
                      size="small"
                      label={`${bucket === 'skipped' ? 'Skipped' : bucket}: ${count}`}
                      clickable={count > 0}
                      variant={isExpanded ? 'filled' : 'outlined'}
                      onClick={() => count > 0 && setExpandedKey(isExpanded ? null : key)}
                      title={count > 0 ? 'Click to see who answered this' : undefined}
                      sx={{
                        borderColor: color,
                        color: isExpanded ? '#fff' : color,
                        bgcolor: isExpanded ? color : 'transparent',
                        opacity: count > 0 ? 1 : 0.4,
                        fontWeight: 600,
                      }}
                    />
                  );
                })}
              </Stack>
              {expanded && <KeiRespondentTable respondents={index.respondentsByKey.get(expanded) ?? []} />}
            </Paper>
          );
        })}
      </Stack>
      <Box sx={{ maxWidth: 700, mt: 2 }}>
        <OptionCountsChart data={buildKeiChartData(indicators, index)} options={options} />
      </Box>
    </Box>
  );
}

function KeiRespondentTable({ respondents }: { respondents: KeiDrilldownEntryDto[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 1.5 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>NatCo</TableCell>
            <TableCell>Country</TableCell>
            <TableCell>Designation</TableCell>
            <TableCell>Measured value</TableCell>
            <TableCell>Comment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {respondents.map((r) => (
            <TableRow key={r.respondent.userId}>
              <TableCell>{r.respondent.email}</TableCell>
              <TableCell>{r.respondent.opCoName ?? '—'}</TableCell>
              <TableCell>{r.respondent.country ?? '—'}</TableCell>
              <TableCell>{r.respondent.designation ?? '—'}</TableCell>
              <TableCell>{r.indicatorValue ?? '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{r.comment ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
