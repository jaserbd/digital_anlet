import type { BenchmarkRowDto, SubScenarioDto } from '@anlet/shared';
import { ScoreBar } from './ScoreBar';
import { SortableTable, type SortableTableColumn } from './SortableTable';

// Shared by AdminPage's cross-org benchmarking table and ExecutivePage's own-org OpCo
// table (SECOND_REVIEW.md item 9) — both consume the same flat BenchmarkRowDto shape, one
// row per (Organization, OpCo) pair, so Organization/NatCo/Country/scores are always shown
// together with sort/filter, not behind an exclusive grouping-mode toggle.
export function BenchmarkTable({
  rows,
  subScenarios,
  hideOrganizationColumn,
}: {
  rows: BenchmarkRowDto[];
  subScenarios: SubScenarioDto[];
  hideOrganizationColumn?: boolean;
}) {
  const columns: SortableTableColumn<BenchmarkRowDto>[] = [
    ...(hideOrganizationColumn
      ? []
      : [
          {
            key: 'organization',
            header: 'Organization',
            getValue: (r: BenchmarkRowDto) => r.organizationName,
            filterable: true,
          },
        ]),
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName, filterable: true },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterable: true },
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

  return (
    <SortableTable
      columns={columns}
      rows={rows}
      rowKey={(r) => `${r.organizationId}:${r.opCoId ?? 'none'}`}
      emptyMessage="No data yet."
    />
  );
}
