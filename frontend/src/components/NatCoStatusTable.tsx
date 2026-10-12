import type { NatCoStatusDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { SortableTable, type SortableTableColumn } from './SortableTable';
import { ScoreBar } from './ScoreBar';
import { ScoreBarChart } from './charts/ScoreBarChart';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { buildNatCoStatusSheet } from '../lib/sheetBuilders';

const NO_NATCO = 'No NatCo yet';

// What an Executive sees instead of the per-person Respondents table (ANONYMOUS_EXECUTIVE_PLAN.md):
// how many people in each NatCo have submitted, are in progress or haven't started, and the
// NatCo's average score — never an individual's status or score.
export function NatCoStatusTable({
  rows,
  title,
  exportFileNamePrefix,
}: {
  rows: NatCoStatusDto[];
  title: string;
  exportFileNamePrefix?: string;
}) {
  const totals = rows.reduce(
    (t, r) => ({ participants: t.participants + r.participantCount, submitted: t.submitted + r.submittedCount }),
    { participants: 0, submitted: 0 },
  );

  const columns: SortableTableColumn<NatCoStatusDto>[] = [
    { key: 'opCo', header: 'NatCo', getValue: (r) => r.opCoName ?? NO_NATCO, filterType: 'multiselect' },
    { key: 'country', header: 'Country', getValue: (r) => r.country, filterType: 'multiselect' },
    { key: 'participants', header: 'Participants', getValue: (r) => r.participantCount },
    { key: 'submitted', header: 'Submitted', getValue: (r) => r.submittedCount },
    { key: 'inProgress', header: 'In progress', getValue: (r) => r.inProgressCount },
    { key: 'notStarted', header: 'Not started', getValue: (r) => r.notStartedCount },
    {
      key: 'averageFinalScore',
      header: 'Avg. final score',
      getValue: (r) => r.averageFinalScore,
      render: (r) => <ScoreBar value={r.averageFinalScore} />,
    },
  ];

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">{title}</Typography>
        {exportFileNamePrefix && (
          <Button
            variant="outlined"
            disabled={rows.length === 0}
            onClick={() => exportRowsToXlsx(`${exportFileNamePrefix}-participation`, [buildNatCoStatusSheet(rows)])}
          >
            Export to Excel
          </Button>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {totals.submitted} of {totals.participants} participant{totals.participants === 1 ? '' : 's'} submitted. Answers
        are shown without names or emails.
      </Typography>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <SortableTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.opCoId ?? 'none'}
          emptyMessage="No participants in this organization yet."
        />
        <ScoreBarChart
          data={rows.map((r) => ({ label: r.opCoName ?? NO_NATCO, score: r.averageFinalScore }))}
          series={[{ key: 'score', name: 'Avg. final score' }]}
        />
      </div>
    </div>
  );
}
