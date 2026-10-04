import { useState } from 'react';
import type { RespondentSummaryDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { ScoreBar } from './ScoreBar';
import { ScoreBarChart } from './charts/ScoreBarChart';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { buildRespondentsSheet } from '../lib/sheetBuilders';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Per-respondent table (MANAGEMENT_VIEW.md item 2b) — NatCo/Country/Working-Domain
// ("Role")/Designation columns alongside Email/Status/Final score, each Excel-style
// filterable (item 2c), with a live "filtered vs. overall" average-score comparison (item
// 2d) computed from the individual respondent scores currently on screen. Replaces the
// plain Email/Status/Score table previously inlined in ExecutivePage.tsx.
export function RespondentsTable({
  respondents,
  title,
  exportFileNamePrefix,
}: {
  respondents: RespondentSummaryDto[];
  title: string;
  exportFileNamePrefix?: string;
}) {
  const [visibleRows, setVisibleRows] = useState<RespondentSummaryDto[]>(respondents);

  const overallAverage = average(respondents.map((r) => r.finalScore).filter((v): v is number => v != null));
  const isFiltered = visibleRows.length !== respondents.length;
  const filteredAverage = isFiltered
    ? average(visibleRows.map((r) => r.finalScore).filter((v): v is number => v != null))
    : null;

  const columns: SortableTableColumn<RespondentSummaryDto>[] = [
    { key: 'email', header: 'Email', getValue: (r) => r.email, filterType: 'multiselect' },
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName, filterType: 'multiselect' },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' },
    { key: 'workingDomain', header: 'Working Domain', getValue: (r) => r.workingDomain, filterType: 'multiselect' },
    { key: 'designation', header: 'Designation', getValue: (r) => r.designation, filterType: 'multiselect' },
    {
      key: 'status',
      header: 'Status',
      getValue: (r) => STATUS_LABEL[r.status] ?? r.status,
      filterType: 'multiselect',
    },
    {
      key: 'finalScore',
      header: 'Final score',
      getValue: (r) => r.finalScore,
      render: (r) => <ScoreBar value={r.finalScore} />,
    },
  ];

  function handleExport() {
    if (!exportFileNamePrefix) return;
    exportRowsToXlsx(`${exportFileNamePrefix}-respondents`, [buildRespondentsSheet(visibleRows)]);
  }

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">{title}</Typography>
        {exportFileNamePrefix && (
          <Button variant="outlined" onClick={handleExport} disabled={visibleRows.length === 0}>
            Export to Excel
          </Button>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Average score — all {respondents.length} respondent{respondents.length === 1 ? '' : 's'}:{' '}
        <strong>{overallAverage != null ? overallAverage.toFixed(2) : '—'}</strong>
        {isFiltered && (
          <>
            {' '}
            · Average score — {visibleRows.length} filtered:{' '}
            <strong>{filteredAverage != null ? filteredAverage.toFixed(2) : '—'}</strong>
          </>
        )}
      </Typography>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SortableTable
          columns={columns}
          rows={respondents}
          rowKey={(r) => r.userId}
          onFilteredRowsChange={setVisibleRows}
          emptyMessage="No respondents in this organization yet."
        />
        <ScoreBarChart
          data={visibleRows.map((r) => ({ label: r.email, score: r.finalScore }))}
          series={[{ key: 'score', name: 'Final score' }]}
        />
      </div>
    </div>
  );
}
