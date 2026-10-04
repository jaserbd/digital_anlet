import type { SubScenarioDto, SubScenarioScore } from '@anlet/shared';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { categoryRowSpans, hasSubScenarioCategories } from '../lib/subScenarioCategories';

interface ScoreSummaryProps {
  finalScore: number;
  subScenarios: SubScenarioDto[];
  subScenarioScores: SubScenarioScore[];
  // Set when a caller (e.g. ResultsPage) already renders the headline final score itself,
  // above a more detailed breakdown table — avoids showing the same number twice.
  hideFinalScore?: boolean;
}

export function ScoreSummary({
  finalScore,
  subScenarios,
  subScenarioScores,
  hideFinalScore,
}: ScoreSummaryProps) {
  const scoreByCode = new Map(subScenarioScores.map((s) => [s.subScenarioCode, s]));
  const rowSpans = hasSubScenarioCategories(subScenarios) ? categoryRowSpans(subScenarios) : null;

  return (
    <Box component="section">
      {!hideFinalScore && (
        <Typography sx={{ fontSize: '2.5rem', my: 1, fontWeight: 700, color: 'primary.main' }}>
          {finalScore.toFixed(2)}{' '}
          <Typography component="span" sx={{ fontSize: '1rem' }} color="text.secondary">
            / 4
          </Typography>
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: rowSpans ? 640 : 480 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {rowSpans && <TableCell>Category</TableCell>}
              <TableCell>Sub-scenario</TableCell>
              <TableCell>Weight</TableCell>
              <TableCell>Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subScenarios.map((s) => (
              <TableRow key={s.id}>
                {rowSpans?.has(s.id) && (
                  <TableCell rowSpan={rowSpans.get(s.id)} sx={{ fontWeight: 700, verticalAlign: 'top' }}>
                    {s.category}
                  </TableCell>
                )}
                <TableCell>{s.name}</TableCell>
                <TableCell>{(s.faultDistributionWeight * 100).toFixed(0)}%</TableCell>
                <TableCell>{scoreByCode.get(s.code)?.overallScore?.toFixed(2) ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
