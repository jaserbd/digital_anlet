import type { QuestionDto, QuestionScore, SubScenarioDto } from '@anlet/shared';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface ScoreBreakdownTableProps {
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  questionScores: QuestionScore[];
}

// The results page's primary table (SECOND_REVIEW.md item 7): one row per question, grouped
// visually by Cognitive Activity (IAADE) on the left, one column per sub-scenario, cell =
// that question's compensated score for that sub-scenario (the value that actually feeds
// the sub-scenario's weighted-average overallScore — see scoring.ts). A skipped
// (question, subScenario) cell shows "—" rather than a misleading 0.
export function ScoreBreakdownTable({ questions, subScenarios, questionScores }: ScoreBreakdownTableProps) {
  const scoreByKey = new Map(
    questionScores.map((qs) => [`${qs.questionId}:${qs.subScenarioId}`, qs]),
  );

  return (
    <div>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cognitive Activity</TableCell>
              <TableCell>Service Capability</TableCell>
              <TableCell align="center">Weight</TableCell>
              {subScenarios.map((s) => (
                <TableCell key={s.id} align="center">
                  {s.name} ({(s.faultDistributionWeight * 100).toFixed(0)}%)
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {questions.map((q, i) => {
              const showCognitiveActivity = i === 0 || questions[i - 1]!.cognitiveActivity !== q.cognitiveActivity;
              return (
                <TableRow key={q.id}>
                  <TableCell>{showCognitiveActivity ? q.cognitiveActivity : ''}</TableCell>
                  <TableCell>{q.serviceCapability}</TableCell>
                  <TableCell align="center">{(q.weight * 100).toFixed(0)}%</TableCell>
                  {subScenarios.map((s) => {
                    const qs = scoreByKey.get(`${q.id}:${s.id}`);
                    return (
                      <TableCell key={s.id} align="center">
                        {qs?.compensatedScore != null ? (
                          qs.compensatedScore.toFixed(2)
                        ) : (
                          <Typography component="span" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Each cell is the question's compensated score for that sub-scenario — see the
        TMF compensation rule. "—" means the question was skipped for that sub-scenario.
      </Typography>
    </div>
  );
}
