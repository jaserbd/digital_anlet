import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type {
  AnswerDrilldownEntryDto,
  CommentDrilldownEntryDto,
  DrilldownRespondentDto,
  QuestionDto,
  SubScenarioDto,
} from '@anlet/shared';
import { groupByCognitiveActivity } from '../lib/cognitiveActivity';
import { buildAnswerMatrix } from '../lib/answerMatrix';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { ANSWER_OPTIONS, buildOptionCountsChartData, indexAnswerDistribution } from '../lib/answerDistribution';
import { OptionCountsChart, OPTION_COLORS } from './charts/OptionCountsChart';
import { buildCommentCollectionRows, buildCommentCollectionSheet } from './CommentCollectionTable';

interface AnswerDistributionDrilldownProps {
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  entries: AnswerDrilldownEntryDto[];
  // The full org-scoped comment list (same data already fetched for Comment Collection
  // right below this component) — ADMIN_3.md item 3 moved the "Export answer matrix"
  // button's comments out of buildAnswerMatrix's interleaved columns into their own sheet,
  // reusing the same buildCommentCollectionRows/Sheet shape used everywhere else.
  comments: CommentDrilldownEntryDto[];
  // Scopes counts/respondents to one NatCo (THIRD_REVIEW.md item 8's Organization Deep-Dive
  // page); omit for the org-wide view (ExecutivePage). Counts/respondent lists are derived
  // directly from `entries` rather than a separate aggregate endpoint, so the same data
  // powers both the unscoped and per-NatCo views without a new backend query shape.
  opCoScopeId?: string | null;
  // Filename prefix for the "Export answer matrix" button (MANAGEMENT_VIEW.md's answer-
  // distribution redesign ask) — the on-screen count/drilldown view below is unchanged; this
  // only adds an offline-analysis export of the same `entries` data as a flat matrix.
  exportFileNamePrefix?: string;
}

// Redesigned per OVERVIEW.md item 9 — the one component the earlier MUI/magenta redesign
// passes missed, still on native <details>/<table> markup. Cognitive Activity remains the
// primary structure (MANAGEMENT_REVIEW2.md item 1): one collapsed-by-default MUI Accordion
// per question. Within a question, sub-scenarios are now laid out horizontally as a row of
// small stat cards (previously one long vertical table with a row per sub-scenario) — each
// card's A/B/C/D chips share OptionCountsChart's own OPTION_COLORS, so a chip's color matches
// its bar in the chart directly below. Clicking a chip still expands a respondent table
// inline, now built on MUI Table (inherits the app-wide magenta header from theme.ts).
export function AnswerDistributionDrilldown({
  questions,
  subScenarios,
  entries,
  comments,
  opCoScopeId,
  exportFileNamePrefix,
}: AnswerDistributionDrilldownProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Reset when switching questionnaire/scope — a different question set or NatCo scope
  // invalidates any expanded respondent table.
  const questionIdsKey = questions.map((q) => q.id).join(',');
  useEffect(() => {
    setExpandedKey(null);
  }, [questionIdsKey, opCoScopeId]);

  function respondentsFor(entry: AnswerDrilldownEntryDto): DrilldownRespondentDto[] {
    return opCoScopeId ? entry.respondents.filter((r) => r.opCoId === opCoScopeId) : entry.respondents;
  }

  const { countsByKey, respondentsByKey } = indexAnswerDistribution(entries, opCoScopeId);

  function handleExportMatrix() {
    const scopedEntries = entries
      .map((e) => ({ ...e, respondents: respondentsFor(e) }))
      .filter((e) => e.respondents.length > 0);
    const scopedComments = opCoScopeId ? comments.filter((c) => c.respondent.opCoId === opCoScopeId) : comments;
    exportRowsToXlsx(`${exportFileNamePrefix ?? 'answer'}-matrix`, [
      ...buildAnswerMatrix(questions, subScenarios, scopedEntries),
      buildCommentCollectionSheet(buildCommentCollectionRows(scopedComments, questions, subScenarios)),
    ]);
  }

  return (
    <Box>
      {exportFileNamePrefix && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button variant="outlined" onClick={handleExportMatrix}>
            Export answer matrix (Excel)
          </Button>
        </Box>
      )}

      {groupByCognitiveActivity(questions).map((group) => (
        <Box key={group.name} sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: '1.05em',
              fontWeight: 700,
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              px: 1,
              py: 0.5,
              mb: 1,
              bgcolor: 'action.hover',
            }}
          >
            {group.name} — {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
            {' '}({(group.weight * 100).toFixed(0)}%)
          </Typography>

          {group.questions.map((q) => {
            const availableOptions = new Set(q.options.map((o) => o.option));
            const rowHasExpanded = expandedKey?.startsWith(`${q.id}:`);
            const expandedRespondents = expandedKey ? respondentsByKey.get(expandedKey) : undefined;
            const [expandedSubScenarioId, expandedOption] = expandedKey?.split(':').slice(1) ?? [];
            const expandedSubScenarioName = subScenarios.find((s) => s.id === expandedSubScenarioId)?.name;
            const availableOptionsOrdered = ANSWER_OPTIONS.filter((o) => availableOptions.has(o));
            const chartData = buildOptionCountsChartData(q, subScenarios, countsByKey, availableOptionsOrdered);

            return (
              <Accordion key={q.id} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 700 }}>{q.serviceCapability}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ mb: 1 }}>{q.questionText}</Typography>
                  <Stack spacing={0.25} sx={{ mb: 2 }}>
                    {q.options.map((o) => (
                      <Typography key={o.option} variant="body2" color="text.secondary">
                        {o.option} ({o.criteria}): {o.text}
                      </Typography>
                    ))}
                  </Stack>

                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                    {subScenarios.map((s) => {
                      const counts = countsByKey.get(`${q.id}:${s.id}`);
                      return (
                        <Paper key={s.id} variant="outlined" sx={{ p: 1.25, minWidth: 160 }}>
                          <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>
                            {s.name}
                          </Typography>
                          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {ANSWER_OPTIONS.map((option) => {
                              if (!availableOptions.has(option)) return null;
                              const count = counts?.[option] ?? 0;
                              const key = `${q.id}:${s.id}:${option}`;
                              const isExpanded = expandedKey === key;
                              return (
                                <Chip
                                  key={option}
                                  size="small"
                                  label={`${option}: ${count}`}
                                  clickable={count > 0}
                                  variant={isExpanded ? 'filled' : 'outlined'}
                                  onClick={() => count > 0 && setExpandedKey(isExpanded ? null : key)}
                                  title={count > 0 ? 'Click to see who chose this option' : undefined}
                                  sx={{
                                    borderColor: OPTION_COLORS[option],
                                    color: isExpanded ? '#fff' : OPTION_COLORS[option],
                                    bgcolor: isExpanded ? OPTION_COLORS[option] : 'transparent',
                                    opacity: count > 0 ? 1 : 0.4,
                                    fontWeight: 600,
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>

                  <Box sx={{ maxWidth: 700 }}>
                    <OptionCountsChart data={chartData} options={availableOptionsOrdered} />
                  </Box>

                  {rowHasExpanded && (
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                        Respondents — {expandedSubScenarioName}, option {expandedOption}:
                      </Typography>
                      <RespondentTable respondents={expandedRespondents ?? []} />
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function RespondentTable({ respondents }: { respondents: DrilldownRespondentDto[] }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>NatCo</TableCell>
            <TableCell>Country</TableCell>
            <TableCell>Working Domain</TableCell>
            <TableCell>Designation</TableCell>
            <TableCell>Comment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {respondents.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>{r.email}</TableCell>
              <TableCell>{r.opCoName ?? '—'}</TableCell>
              <TableCell>{r.country ?? '—'}</TableCell>
              <TableCell>{r.workingDomain ?? '—'}</TableCell>
              <TableCell>{r.designation ?? '—'}</TableCell>
              <TableCell>{r.comment ?? '—'}</TableCell>
            </TableRow>
          ))}
          {respondents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>No respondents.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
