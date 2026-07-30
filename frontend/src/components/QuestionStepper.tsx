import type { QuestionDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import {
  COVERAGE_COLORS,
  groupByCognitiveActivity,
  groupCoverageStatus,
  questionCoverageStatus,
} from '../lib/cognitiveActivity';

interface QuestionStepperProps {
  questions: QuestionDto[];
  currentIndex: number;
  isComplete: (questionId: string) => boolean;
  onSelect: (index: number) => void;
  // Raw answered-cell counts per question, for the green/yellow/red coloring (FORTH_REVIEW.md
  // item 3) — a separate signal from `isComplete`, which is coverage-aware (answered OR
  // covered by a comment) and gates Submit. This one is purely "how much did you actually
  // answer," never affected by comments.
  coverageByQuestionId: Map<string, { answeredCount: number; total: number }>;
}

// Steps over questions (question-major layout) instead of sub-scenarios — see
// QuestionCard.tsx. "Complete" means every sub-scenario for that question is either
// answered or covered by a comment (see QuestionnairePage's isQuestionComplete). Grouped by
// Cognitive Activity (IAADE) per SECOND_REVIEW.md item 5. The Cognitive Activity group header
// is the visually dominant element (FORTH_REVIEW.md item 4 — previously the sub-scenario/
// Service Capability button text was more prominent than the IAADE grouping, which is
// backwards from what the activity model is meant to emphasize).
//
// Coverage colors (COVERAGE_COLORS) are a functional status signal (green/yellow/red), kept
// as-is rather than folded into the brand magenta palette (OVERVIEW.md item 5) — this is data,
// not decoration.
export function QuestionStepper({
  questions,
  currentIndex,
  isComplete,
  onSelect,
  coverageByQuestionId,
}: QuestionStepperProps) {
  const groups = groupByCognitiveActivity(questions);

  return (
    <Box component="nav" sx={{ mb: 3 }}>
      {groups.map((group) => {
        const groupStatus = groupCoverageStatus(
          group.questions.map((q) => {
            const c = coverageByQuestionId.get(q.id);
            return questionCoverageStatus(c?.answeredCount ?? 0, c?.total ?? 0);
          }),
        );
        const groupColors = COVERAGE_COLORS[groupStatus];
        return (
          <Box key={group.name} sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: '1.05em',
                fontWeight: 700,
                color: groupColors.fg,
                background: groupColors.bg,
                borderLeft: `4px solid ${groupColors.border}`,
                borderRadius: 1,
                px: 1,
                py: 0.5,
                mb: 0.75,
              }}
            >
              {group.name} — {group.questions.length} question{group.questions.length === 1 ? '' : 's'},{' '}
              {(group.weight * 100).toFixed(0)}%
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {group.questions.map((q) => {
                const i = questions.indexOf(q);
                const c = coverageByQuestionId.get(q.id);
                const status = questionCoverageStatus(c?.answeredCount ?? 0, c?.total ?? 0);
                const colors = COVERAGE_COLORS[status];
                return (
                  <Button
                    key={q.id}
                    onClick={() => onSelect(i)}
                    variant={i === currentIndex ? 'outlined' : 'text'}
                    size="small"
                    sx={{
                      fontWeight: i === currentIndex ? 700 : 400,
                      textDecoration: isComplete(q.id) ? 'underline' : 'none',
                      borderLeft: `3px solid ${colors.border}`,
                      borderRadius: 1,
                      color: colors.fg,
                      ...(i === currentIndex ? { borderColor: colors.border } : {}),
                    }}
                  >
                    {i + 1}. {q.serviceCapability} {isComplete(q.id) ? '✓' : ''}
                  </Button>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
