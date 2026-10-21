// Questionnaires still "In Review" in TM Forum's library carry "(R)" (REVIEW_QUESTIONNAIRES_PLAN.md).
// Their stored names already end in " (R)" (seed.ts); these helpers tag labels built from other
// fields, such as the HVS category.
export const IN_REVIEW_TAG = '(R)';
export const IN_REVIEW_TOOLTIP = 'In review at TM Forum — the questionnaire content may still change';

export function withReviewTag(label: string, inReview: boolean): string {
  return inReview && !label.endsWith(IN_REVIEW_TAG) ? `${label} ${IN_REVIEW_TAG}` : label;
}

/** An HVS is tagged when every questionnaire under it is still in review. */
export function hvsLabel(hvsCategory: string, questionnaires: { hvsCategory: string; inReview: boolean }[]): string {
  const inHvs = questionnaires.filter((q) => q.hvsCategory === hvsCategory);
  return withReviewTag(hvsCategory, inHvs.length > 0 && inHvs.every((q) => q.inReview));
}
