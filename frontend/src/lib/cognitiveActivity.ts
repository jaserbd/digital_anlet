import type { QuestionDto, QuestionScore } from '@anlet/shared';

export interface CognitiveActivityGroup {
  name: string;
  questions: QuestionDto[];
  weight: number;
}

// Groups questions by Cognitive Activity (IAADE), preserving first-appearance order —
// questions are already sorted by sortOrder, which follows IAADE order, so activities land
// in contiguous runs. Shared by QuestionStepper.tsx and ExecutivePage.tsx (SECOND_REVIEW.md
// item 5: show the IAADE section, its question count, and its combined weight).
export function groupByCognitiveActivity(questions: QuestionDto[]): CognitiveActivityGroup[] {
  const groups: CognitiveActivityGroup[] = [];
  const byName = new Map<string, CognitiveActivityGroup>();
  for (const q of questions) {
    let group = byName.get(q.cognitiveActivity);
    if (!group) {
      group = { name: q.cognitiveActivity, questions: [], weight: 0 };
      byName.set(q.cognitiveActivity, group);
      groups.push(group);
    }
    group.questions.push(q);
    group.weight += q.weight;
  }
  return groups;
}

// Cognitive-Activity-first question label (THIRD_REVIEW.md item 2) — e.g. "Intent (Intent
// driven)" rather than "Intent driven (Intent)", to keep the IAADE activity as the primary
// identifier with the Service Capability as supporting detail.
export function formatQuestionLabel(q: { cognitiveActivity: string; serviceCapability: string }): string {
  return `${q.cognitiveActivity} (${q.serviceCapability})`;
}

// Per-question/per-group answer-completeness coloring (FORTH_REVIEW.md item 3). Deliberately
// based on raw answered-cell counts only, not comment coverage — a fully-skip-covered
// question still reads "empty" here, since coverage/skip status is already surfaced
// separately (the amber unanswered-row highlighting, the progress text); this is a distinct
// "how much did you actually answer" signal, not a duplicate of it.
export type CoverageStatus = 'complete' | 'partial' | 'empty';

export function questionCoverageStatus(answeredCount: number, total: number): CoverageStatus {
  if (total === 0 || answeredCount >= total) return 'complete';
  if (answeredCount === 0) return 'empty';
  return 'partial';
}

export function groupCoverageStatus(statuses: CoverageStatus[]): CoverageStatus {
  if (statuses.length === 0 || statuses.every((s) => s === 'complete')) return 'complete';
  if (statuses.every((s) => s === 'empty')) return 'empty';
  return 'partial';
}

export const COVERAGE_COLORS: Record<CoverageStatus, { fg: string; bg: string; border: string }> = {
  complete: { fg: '#1e7e34', bg: '#e6f4ea', border: '#1e7e34' },
  partial: { fg: '#b8860b', bg: '#fff4e5', border: '#f0ad4e' },
  empty: { fg: '#c0392b', bg: '#fdecea', border: '#c0392b' },
};

export interface CognitiveActivityAxis {
  axis: string;
  value: number | null;
}

// Personal (Normal User) IAADE/Cognitive-Activity spider-chart data (ADMIN_2.md item 1) —
// averages each group's compensatedScore across all (question, subScenario) pairs, reusing
// groupByCognitiveActivity so the grouping/ordering logic isn't duplicated. A group with
// every cell skipped (compensatedScore null) is omitted entirely, rather than plotted as 0 —
// same "excluded, not misleading zero" convention as scoring.ts/insights.service.ts.
export function computeCognitiveActivityAverages(
  questions: QuestionDto[],
  questionScores: QuestionScore[],
): CognitiveActivityAxis[] {
  const scoreByQuestionId = new Map<string, number[]>();
  for (const qs of questionScores) {
    if (qs.compensatedScore == null) continue;
    const scores = scoreByQuestionId.get(qs.questionId) ?? [];
    scores.push(qs.compensatedScore);
    scoreByQuestionId.set(qs.questionId, scores);
  }

  return groupByCognitiveActivity(questions)
    .map((group) => {
      const values = group.questions.flatMap((q) => scoreByQuestionId.get(q.id) ?? []);
      return {
        axis: group.name,
        value: values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null,
      };
    })
    .filter((axis) => axis.value != null);
}
