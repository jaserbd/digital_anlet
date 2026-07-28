import type { QuestionDto } from '@anlet/shared';

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
