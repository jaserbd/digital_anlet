import type { EffectivenessIndicatorDto, KeiAnswerDto } from '@anlet/shared';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { keiResultRows } from '../lib/kei';

interface KeiResultsTableProps {
  indicators: EffectivenessIndicatorDto[];
  answers: KeiAnswerDto[];
}

// A respondent's own Key Effectiveness Indicator answers on the results page (NEW_HVS_PLAN.md
// Phase B) — one row per KEI; an unanswered (skipped) KEI shows "—" and is excluded from the
// Effective Indicator score, its comment explaining why.
export function KeiResultsTable({ indicators, answers }: KeiResultsTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Indicator</TableCell>
            <TableCell align="center">Weight</TableCell>
            <TableCell>Answer</TableCell>
            <TableCell align="center">Score</TableCell>
            <TableCell>Measured value</TableCell>
            <TableCell>Comment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keiResultRows(indicators, answers).map((r) => (
            <TableRow key={r.indicator.id}>
              <TableCell sx={{ fontWeight: 600 }}>{r.indicator.name}</TableCell>
              <TableCell align="center">{(r.indicator.weight * 100).toFixed(0)}%</TableCell>
              <TableCell>{r.answer}</TableCell>
              <TableCell align="center">
                {r.score != null ? (
                  r.score.toFixed(2)
                ) : (
                  <Typography component="span" color="text.disabled">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell>{r.value ?? '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{r.comment ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
