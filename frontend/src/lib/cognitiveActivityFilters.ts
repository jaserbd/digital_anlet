import { useState } from 'react';

// The spider chart's NatCo/Country filter ('' = all). Held by the page when it also feeds the
// PDF report (EXECUTIVE_FEEDBACK_PLAN.md), so the report shows what's on screen.
export interface CognitiveActivityFilters {
  opCoId: string;
  country: string;
}

export const NO_COGNITIVE_ACTIVITY_FILTERS: CognitiveActivityFilters = { opCoId: '', country: '' };

// Same key as useQuestionnaireExecutiveData's report query, so both share one request.
export function cognitiveActivitySummaryQueryKey(
  organizationId: string,
  questionnaireCode: string | undefined,
  filters: CognitiveActivityFilters,
  projectId?: string | null,
) {
  return ['cognitive-activity-summary', organizationId, questionnaireCode, filters.opCoId, filters.country, projectId ?? null];
}

// The spider charts' NatCo/Country filters per questionnaire, held by the page so its PDF
// report shows the same scope as the screen (EXECUTIVE_FEEDBACK_PLAN.md). `scopeKey` (the
// organization) resets them when the page switches organizations.
export function useCognitiveFilterState(scopeKey: string) {
  const [byKey, setByKey] = useState<Record<string, CognitiveActivityFilters>>({});
  return {
    filtersFor: (code: string | undefined) => (code && byKey[`${scopeKey}:${code}`]) || NO_COGNITIVE_ACTIVITY_FILTERS,
    setFiltersFor: (code: string) => (filters: CognitiveActivityFilters) =>
      setByKey((prev) => ({ ...prev, [`${scopeKey}:${code}`]: filters })),
  };
}
