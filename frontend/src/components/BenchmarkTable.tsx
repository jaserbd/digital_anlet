import { useState } from 'react';
import type { BenchmarkRowDto, OrganizationDto, SubScenarioDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { ScoreBar } from './ScoreBar';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { OrganizationAutocomplete } from './OrganizationAutocomplete';
import { ScoreBarChart } from './charts/ScoreBarChart';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { buildBenchmarkSheet } from '../lib/sheetBuilders';

// Shared by AdminPage's cross-org benchmarking table and ExecutivePage's own-org OpCo
// table (SECOND_REVIEW.md item 9) — both consume the same flat BenchmarkRowDto shape, one
// row per (Organization, OpCo) pair, so Organization/NatCo/Country/scores are always shown
// together with sort/filter, not behind an exclusive grouping-mode toggle.
export function BenchmarkTable({
  rows,
  subScenarios,
  hideOrganizationColumn,
  organizations,
  onOrganizationSelect,
  onRowClick,
  showCommentsColumn,
  onCommentsClick,
  exportFileNamePrefix,
}: {
  rows: BenchmarkRowDto[];
  subScenarios: SubScenarioDto[];
  hideOrganizationColumn?: boolean;
  // Only used when !hideOrganizationColumn (THIRD_REVIEW.md item 8) — an autocomplete
  // replaces the plain substring filter for the Organization column, and selecting a match
  // navigates to that organization's Deep-Dive page instead of just filtering rows.
  organizations?: OrganizationDto[];
  onOrganizationSelect?: (org: OrganizationDto) => void;
  // Row/NatCo click-through — used by the Organization Deep-Dive page to drill into a
  // specific NatCo's per-question answer distribution.
  onRowClick?: (row: BenchmarkRowDto) => void;
  showCommentsColumn?: boolean;
  onCommentsClick?: (row: BenchmarkRowDto) => void;
  // Shows an "Export to Excel" button exporting exactly the currently filtered/sorted rows
  // (MANAGEMENT_VIEW.md item 1) — omitted (no button) when not supplied.
  exportFileNamePrefix?: string;
}) {
  const [visibleRows, setVisibleRows] = useState<BenchmarkRowDto[]>(rows);
  const columns: SortableTableColumn<BenchmarkRowDto>[] = [
    ...(hideOrganizationColumn
      ? []
      : [
          {
            key: 'organization',
            header: 'Organization',
            getValue: (r: BenchmarkRowDto) => r.organizationName,
            filterable: true,
            filterRenderer:
              organizations && onOrganizationSelect
                ? () => (
                    <OrganizationAutocomplete
                      organizations={organizations}
                      onSelect={onOrganizationSelect}
                      placeholder="Type to find an organization…"
                    />
                  )
                : undefined,
            render: onOrganizationSelect
              ? (r: BenchmarkRowDto) => (
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() =>
                      onOrganizationSelect({ id: r.organizationId, name: r.organizationName })
                    }
                  >
                    {r.organizationName}
                  </Link>
                )
              : undefined,
          },
        ]),
    {
      key: 'opCo',
      header: 'NatCo',
      getValue: (r) => r.opCoName,
      filterType: 'multiselect',
      render: onRowClick
        ? (r) => (
            <Link component="button" type="button" underline="hover" onClick={() => onRowClick(r)}>
              {r.opCoName}
            </Link>
          )
        : undefined,
    },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' },
    { key: 'respondents', header: 'Respondents', getValue: (r) => r.respondentCount, align: 'center' },
    { key: 'submitted', header: 'Submitted', getValue: (r) => r.submittedCount, align: 'center' },
    {
      key: 'finalScore',
      header: 'Avg. final score',
      getValue: (r) => r.averageFinalScore,
      render: (r) => <ScoreBar value={r.averageFinalScore} />,
    },
    {
      key: 'e2eRate',
      header: 'Avg. E2E rate',
      getValue: (r) => r.averageE2eAutomationRate,
      align: 'center',
      render: (r) =>
        r.averageE2eAutomationRate != null ? `${(r.averageE2eAutomationRate * 100).toFixed(0)}%` : '—',
    },
    ...(showCommentsColumn
      ? [
          {
            key: 'comments',
            header: 'Comments',
            align: 'center' as const,
            getValue: (r: BenchmarkRowDto) => r.commentCount,
            render: (r: BenchmarkRowDto) =>
              r.commentCount > 0 ? (
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => onCommentsClick?.(r)}
                  title="Click to see these comments"
                >
                  {r.commentCount}
                </Link>
              ) : (
                0
              ),
          },
        ]
      : []),
    ...subScenarios.map((s) => ({
      key: `sub-${s.id}`,
      header: s.name,
      align: 'center' as const,
      getValue: (r: BenchmarkRowDto) =>
        r.subScenarioAverages.find((a) => a.subScenarioCode === s.code)?.averageScore ?? null,
      render: (r: BenchmarkRowDto) => {
        const avg = r.subScenarioAverages.find((a) => a.subScenarioCode === s.code)?.averageScore;
        return avg != null ? avg.toFixed(2) : '—';
      },
    })),
  ];

  function handleExport() {
    if (!exportFileNamePrefix) return;
    exportRowsToXlsx(`${exportFileNamePrefix}-benchmarking`, [
      buildBenchmarkSheet(visibleRows, subScenarios, hideOrganizationColumn),
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
            score: r.averageFinalScore,
          }))}
          series={[{ key: 'score', name: 'Avg. final score' }]}
        />
      </div>
    </div>
  );
}
