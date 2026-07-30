import type { QuestionDto, SubScenarioDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Link from '@mui/material/Link';
import { SectionCard } from './SectionCard';
import { GroupedCommentsList, type CommentEntry } from './GroupedCommentsList';

export interface UncoveredGap {
  questionId: string;
  questionLabel: string;
  subScenarioId: string;
  subScenarioLabel: string;
}

interface ReviewStepProps {
  uncovered: UncoveredGap[];
  skippedCoveredCount: number;
  questions: QuestionDto[];
  subScenarios: SubScenarioDto[];
  comments: CommentEntry[];
  onJumpTo: (questionId: string) => void;
}

// Shown as the final step before Submit: a warning summary of any unanswered questions that
// still need a covering comment, then a dedicated list of every comment the user added
// (per FIRST_REVIEW.md's "dedicated section for the user comments" requirement).
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
}: ReviewStepProps) {
  return (
    <SectionCard title="Review before submitting">
      {uncovered.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography sx={{ mb: 1 }}>
            <strong>
              You have {uncovered.length} unanswered question{uncovered.length === 1 ? '' : 's'} without a
              covering comment.
            </strong>{' '}
            Go back and either answer them, or add a comment explicitly tagged to that specific
            sub-scenario, before you can submit. Click a question below to jump straight to it.
          </Typography>
          <List dense disablePadding>
            {uncovered.map((g) => (
              <ListItem key={`${g.questionId}:${g.subScenarioId}`} disableGutters>
                <Link component="button" type="button" onClick={() => onJumpTo(g.questionId)} underline="hover">
                  {g.questionLabel} — {g.subScenarioLabel}
                </Link>
              </ListItem>
            ))}
          </List>
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 2 }}>
          Every question is answered or has a covering comment. You're ready to submit.
        </Alert>
      )}
      {skippedCoveredCount > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {skippedCoveredCount} question{skippedCoveredCount === 1 ? ' is' : 's are'} left unanswered but
          covered by a comment — these will be scored as skipped (excluded and re-normalized), not as 0.
        </Typography>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Your comments
      </Typography>
      <GroupedCommentsList questions={questions} subScenarios={subScenarios} comments={comments} />
    </SectionCard>
  );
}
