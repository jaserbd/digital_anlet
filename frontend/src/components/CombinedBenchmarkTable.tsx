import { useState } from 'react';
import type { CombinedBenchmarkRowDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { ScoreBar } from './ScoreBar';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { ScoreBarChart } from './charts/ScoreBarChart';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { buildCombinedBenchmarkSheet } from '../lib/sheetBuilders';

// The org/OpCo-wide combined view for an HVS group (today, only Core Fault Management +
// Stability — FORTH_REVIEW.md items 5/6): one row per (Organization, OpCo) pair, showing
// both halves' averages alongside the 50/50 combined average, so Admin/Executive no longer
// have to pick one questionnaire at a time to see the full picture.
export function CombinedBenchmarkTable({
  rows,
  hideOrganizationColumn,
  exportFileNamePrefix,
}: {
  rows: CombinedBenchmarkRowDto[];
  hideOrganizationColumn?: boolean;
  // Shows an "Export to Excel" button exporting exactly the currently filtered/sorted rows
  // (MANAGEMENT_VIEW.md item 1) — omitted (no button) when not supplied.
  exportFileNamePrefix?: string;
}) {
  const [visibleRows, setVisibleRows] = useState<CombinedBenchmarkRowDto[]>(rows);

  const columns: SortableTableColumn<CombinedBenchmarkRowDto>[] = [
    ...(hideOrganizationColumn
      ? []
      : [
          {
            key: 'organization',
            header: 'Organization',
            getValue: (r: CombinedBenchmarkRowDto) => r.organizationName,
            filterable: true,
          },
        ]),
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName, filterType: 'multiselect' as const },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' as const },
    {
      key: 'faultManagement',
      header: 'Fault Mgmt avg',
      getValue: (r) => r.faultManagement.averageFinalScore,
      render: (r) => <ScoreBar value={r.faultManagement.averageFinalScore} />,
    },
    {
      key: 'stability',
      header: 'Stability avg',
      getValue: (r) => r.stability.averageFinalScore,
      render: (r) => <ScoreBar value={r.stability.averageFinalScore} />,
    },
    {
      key: 'combined',
      header: 'Combined avg',
      getValue: (r) => r.combinedAverageFinalScore,
      render: (r) => (
        <strong>
          <ScoreBar value={r.combinedAverageFinalScore} />
        </strong>
      ),
    },
  ];

  function handleExport() {
    if (!exportFileNamePrefix) return;
    exportRowsToXlsx(`${exportFileNamePrefix}-combined-benchmarking`, [
      buildCombinedBenchmarkSheet(visibleRows, hideOrganizationColumn),
    ]);
  }

  return (
    <div>
      {exportFileNamePrefix && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button variant="outlined" onClick={handleExport} disabled={visibleRows.length === 0}>
            Export to Excel
          </Button>
        </Box>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SortableTable
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.organizationId}:${r.opCoId ?? 'none'}`}
          emptyMessage="No data yet."
          onFilteredRowsChange={setVisibleRows}
        />
        <ScoreBarChart
          data={visibleRows.map((r) => ({
            label: hideOrganizationColumn ? r.opCoName : `${r.organizationName} — ${r.opCoName}`,
            faultManagement: r.faultManagement.averageFinalScore,
            stability: r.stability.averageFinalScore,
            combined: r.combinedAverageFinalScore,
          }))}
          series={[
            { key: 'faultManagement', name: 'Fault Mgmt avg' },
            { key: 'stability', name: 'Stability avg' },
            { key: 'combined', name: 'Combined avg' },
          ]}
        />
      </div>
    </div>
  );
}
