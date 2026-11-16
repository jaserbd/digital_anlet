import { useMemo, useState, type ReactNode } from 'react';
import type { QuestionDto, SubScenarioDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { SectionCard } from './SectionCard';
import { GroupedCommentsList, type CommentEntry } from './GroupedCommentsList';
import { formatQuestionLabel } from '../lib/cognitiveActivity';

export interface UncoveredGap {
  questionId: string;
  questionLabel: string;
  subScenarioId: string;
  subScenarioLabel: string;
}

// A Key Effectiveness Indicator that's neither answered nor explained by a comment.
export interface UncoveredKei {
  indicatorId: string;
  name: string;
}

interface ReviewStepProps {
  uncovered: UncoveredGap[];
  uncoveredKeis?: UncoveredKei[];
  // KEIs whose comment is non-empty, for the comments list below.
  keiComments?: { indicatorId: string; name: string; comment: string }[];
  onJumpToKeis?: () => void;
  skippedCoveredCount: number;
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  comments: CommentEntry[];
  onJumpTo: (questionId: string) => void;
  // The same answering cards as the steps (same state and saves), opened in place here
  // (ONBOARDING_SECURITY_PLAN.md Phase 4), so fixing a gap needs no trip back through the steps.
  renderQuestion: (questionId: string) => ReactNode;
  renderKei?: (indicatorId: string) => ReactNode;
  indicatorNames?: Map<string, string>;
}

function questionLabelFallback(q: QuestionDto): string {
  return formatQuestionLabel(q);
}

const MAX_MISSING_CHIPS = 3;

function toggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// One open item of the Review step: a gap (or a just-fixed one, while it stays open) with its
// answering card expandable in place.
function ReviewItem({
  title,
  open,
  covered,
  missing,
  onToggle,
  onOpenStep,
  openStepLabel,
  children,
}: {
  title: string;
  open: boolean;
  covered: boolean;
  missing: string[];
  onToggle: () => void;
  onOpenStep?: () => void;
  openStepLabel: string;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ mb: 1.5, borderColor: covered ? 'success.light' : 'warning.light', borderLeftWidth: 4 }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1, px: 2, py: 1.25 }}
      >
        <Typography sx={{ fontWeight: 600, flexGrow: 1, minWidth: 200 }}>{title}</Typography>
        {covered ? (
          <Chip size="small" color="success" label="Covered ✓" />
        ) : missing.length > MAX_MISSING_CHIPS ? (
          // Up to 8 sub-scenarios (IP): one count chip, names on hover, instead of a wall of chips.
          <Chip size="small" color="warning" variant="outlined" label={`${missing.length} sub-scenarios`} title={missing.join(', ')} />
        ) : (
          missing.map((m) => <Chip key={m} size="small" color="warning" variant="outlined" label={m} />)
        )}
        <Button size="small" variant={open ? 'text' : 'contained'} onClick={onToggle}>
          {open ? 'Close' : 'Answer here'}
        </Button>
        {onOpenStep && (
          <Link component="button" type="button" variant="body2" onClick={onOpenStep} underline="hover">
            {openStepLabel}
          </Link>
        )}
      </Stack>
      {open && <Box sx={{ px: 2, pb: 1 }}>{children}</Box>}
    </Paper>
  );
}

// Shown as the final step before Submit: a warning summary of any unanswered questions that
// still need a covering comment, then a dedicated list of every comment the user added
// (per FIRST_REVIEW.md's "dedicated section for the user comments" requirement). Each gap opens
// its question right here; an opened question stays open (marked "Covered ✓") once fixed, so it
// never vanishes mid-typing, and Submit below unlocks as soon as nothing is left.
//
// Terminology: "unanswered" is any (question, subScenario) with no selected option. Once an
// unanswered pair is covered by a comment it's a "skip" (submittable, scored via
// re-normalization); until then it's just "unanswered" and blocks submission.
export function ReviewStep({
  uncovered,
  skippedCoveredCount,
  questions,
  subScenarios,
  comments,
  onJumpTo,
  uncoveredKeis = [],
  keiComments = [],
  onJumpToKeis,
  renderQuestion,
  renderKei,
  indicatorNames,
}: ReviewStepProps) {
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [openKeis, setOpenKeis] = useState<Set<string>>(new Set());

  const gapsByQuestion = useMemo(() => {
    const map = new Map<string, UncoveredGap[]>();
    for (const g of uncovered) map.set(g.questionId, [...(map.get(g.questionId) ?? []), g]);
    return map;
  }, [uncovered]);
  const uncoveredKeiIds = new Set(uncoveredKeis.map((k) => k.indicatorId));

  // Questions with gaps plus any the user opened here, in questionnaire order.
  const shownQuestions = questions
    .map((q, i) => ({ question: q, ordinal: i + 1 }))
    .filter(({ question }) => gapsByQuestion.has(question.id) || openQuestions.has(question.id));
  const shownKeiIds = [...new Set([...uncoveredKeis.map((k) => k.indicatorId), ...openKeis])];
  const questionCount = gapsByQuestion.size;

  return (
    <SectionCard title="Review before submitting">
      {uncovered.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>
            {uncovered.length} unanswered sub-scenario answer{uncovered.length === 1 ? '' : 's'} without a covering
            comment, in {questionCount} question{questionCount === 1 ? '' : 's'}.
          </strong>{' '}
          Click <em>Answer here</em> to answer them, or add a comment tagged to that sub-scenario — right on this page.
          Submit unlocks as soon as nothing is left.
        </Alert>
      )}
      {uncoveredKeis.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>
            {uncoveredKeis.length} effectiveness indicator{uncoveredKeis.length === 1 ? ' is' : 's are'} neither
            answered nor explained.
          </strong>{' '}
          Pick an option, or add a comment saying why it can&apos;t be answered.
        </Alert>
      )}
      {uncovered.length === 0 && uncoveredKeis.length === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Every question is answered or has a covering comment. You&apos;re ready to submit.
        </Alert>
      )}

      {shownQuestions.map(({ question, ordinal }) => {
        const gaps = gapsByQuestion.get(question.id) ?? [];
        return (
          <ReviewItem
            key={question.id}
            title={`${ordinal}. ${gaps[0]?.questionLabel ?? questionLabelFallback(question)}`}
            open={openQuestions.has(question.id)}
            covered={gaps.length === 0}
            missing={gaps.map((g) => g.subScenarioLabel)}
            onToggle={() => setOpenQuestions((prev) => toggled(prev, question.id))}
            onOpenStep={() => onJumpTo(question.id)}
            openStepLabel="Open as step"
          >
            {renderQuestion(question.id)}
          </ReviewItem>
        );
      })}
      {renderKei &&
        shownKeiIds.map((id) => (
          <ReviewItem
            key={id}
            title={`Effectiveness indicator: ${indicatorNames?.get(id) ?? ''}`}
            open={openKeis.has(id)}
            covered={!uncoveredKeiIds.has(id)}
            missing={['answer or comment']}
            onToggle={() => setOpenKeis((prev) => toggled(prev, id))}
            onOpenStep={onJumpToKeis}
            openStepLabel="Open indicators step"
          >
            {renderKei(id)}
          </ReviewItem>
        ))}

      {skippedCoveredCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
          {skippedCoveredCount} question{skippedCoveredCount === 1 ? ' is' : 's are'} left unanswered but
          covered by a comment — these will be scored as skipped (excluded and re-normalized), not as 0.
        </Typography>
      )}

      <Typography variant="h6" sx={{ mb: 1, mt: 2 }}>
        Your comments
      </Typography>
      {/* Skip the question list's own "No comments were added." when KEI comments follow. */}
      {(comments.length > 0 || keiComments.length === 0) && (
        <GroupedCommentsList questions={questions} subScenarios={subScenarios} comments={comments} />
      )}
      {keiComments.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>Effectiveness indicators</Typography>
          <List dense disablePadding>
            {keiComments.map((k) => (
              <ListItem key={k.indicatorId} disableGutters sx={{ display: 'block' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {k.name}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {k.comment}
                </Typography>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </SectionCard>
  );
}
