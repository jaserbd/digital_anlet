import { useQuery } from '@tanstack/react-query';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { AnswerDistributionDrilldown } from './AnswerDistributionDrilldown';
import { RespondentsTable } from './RespondentsTable';
import { NatCoStatusTable } from './NatCoStatusTable';
import { buildCommentCollectionRows, CommentCollectionTable } from './CommentCollectionTable';
import { buildKeiCommentRows } from '../lib/keiDistribution';
import { KeiDistribution } from './KeiDistribution';
import { AggregateCognitiveActivityRadar, type OrganizationSwitcher } from './AggregateCognitiveActivityRadar';
import {
  cognitiveActivitySummaryQueryKey,
  NO_COGNITIVE_ACTIVITY_FILTERS,
  type CognitiveActivityFilters,
} from '../lib/cognitiveActivityFilters';
import { withReviewTag } from '../lib/inReview';

// Fetches everything one member questionnaire's section of an organization overview needs.
// Shared by ExecutivePage.tsx (own org) and OrganizationDeepDivePage.tsx (any org, ADMIN.md
// item 2's Executive-parity ask) — both call this with identical query keys per
// (organizationId, questionnaireCode), so TanStack Query dedupes by key: one network request
// per query no matter how many components ask for it.
// `projectId`: the project an Application Admin looks at (Deep-Dive, PROJECTS_V2_PLAN.md);
// omitted for Executives / Project Admins, whose active project the server applies.
export function useQuestionnaireExecutiveData(
  organizationId: string,
  questionnaireCode: string | undefined,
  projectId?: string | null,
  // The spider chart's current filter — its data goes into the PDF report.
  cognitiveFilters: CognitiveActivityFilters = NO_COGNITIVE_ACTIVITY_FILTERS,
) {
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode!),
    enabled: !!questionnaireCode,
  });
  const summaryQuery = useQuery({
    queryKey: ['organization-summary', organizationId, questionnaireCode, projectId ?? null],
    queryFn: () => insightsApi.getOrganizationSummary(organizationId, questionnaireCode!, projectId),
    enabled: !!questionnaireCode,
  });
  const drilldownQuery = useQuery({
    queryKey: ['answer-drilldown', organizationId, questionnaireCode, projectId ?? null],
    queryFn: () => insightsApi.getAnswerDrilldown(organizationId, questionnaireCode!, projectId),
    enabled: !!questionnaireCode,
  });
  const cognitiveActivityQuery = useQuery({
    queryKey: cognitiveActivitySummaryQueryKey(organizationId, questionnaireCode, cognitiveFilters, projectId),
    queryFn: () =>
      insightsApi.getCognitiveActivitySummary(
        organizationId,
        questionnaireCode!,
        { opCoId: cognitiveFilters.opCoId || undefined, country: cognitiveFilters.country || undefined },
        projectId,
      ),
    enabled: !!questionnaireCode,
  });
  return { questionnaireQuery, summaryQuery, drilldownQuery, cognitiveActivityQuery };
}

// Respondents + Answer distribution + Comment Collection for one questionnaire — extracted
// so the HVS-group case (Core FM + Stability) can render this once per member questionnaire
// below the combined benchmarking table, while the single-questionnaire case renders it
// exactly as before. Download-everything buttons live at the page level
// (organizationReport.ts) — this component only renders tables, each with its own standalone
// "Export to Excel" button.
export function QuestionnaireExecutiveDetail({
  organizationId,
  questionnaireCode,
  projectId,
  opCoScopeId,
  organizationSwitcher,
  cognitiveFilters,
  onCognitiveFiltersChange,
}: {
  organizationId: string;
  questionnaireCode: string;
  // See useQuestionnaireExecutiveData.
  projectId?: string | null;
  // Scopes the Answer distribution's respondent lists to one NatCo (OrganizationDeepDivePage's
  // admin-exclusive drill-down) — omitted by ExecutivePage, which has no need to scope within
  // its own single organization.
  opCoScopeId?: string | null;
  // ADMIN_2.md item 1's Admin-only Organization dropdown, gating the spider chart's own
  // NatCo/Country filters — omitted by ExecutivePage, which never switches organizations.
  organizationSwitcher?: OrganizationSwitcher;
  // The spider chart's filter, held by the page for its PDF report (see AggregateCognitiveActivityRadar).
  cognitiveFilters?: CognitiveActivityFilters;
  onCognitiveFiltersChange?: (filters: CognitiveActivityFilters) => void;
}) {
  const { questionnaireQuery, summaryQuery, drilldownQuery } = useQuestionnaireExecutiveData(
    organizationId,
    questionnaireCode,
    projectId,
    cognitiveFilters,
  );

  if (questionnaireQuery.isLoading || summaryQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!questionnaireQuery.data || !summaryQuery.data) {
    return <p>Something went wrong loading the organization summary.</p>;
  }
  const { data: questionnaire } = questionnaireQuery;
  const { data: summary } = summaryQuery;
  // Executives get anonymized data from the server (ANONYMOUS_EXECUTIVE_PLAN.md); Admins don't.
  const anonymized = summary.anonymized || !!drilldownQuery.data?.anonymized;

  return (
    <>
      <AggregateCognitiveActivityRadar
        organizationId={organizationId}
        questionnaireCode={questionnaireCode}
        projectId={projectId}
        organizationSwitcher={organizationSwitcher}
        filters={cognitiveFilters}
        onFiltersChange={onCognitiveFiltersChange}
      />

      {summary.anonymized ? (
        <NatCoStatusTable
          rows={summary.natCoStatus}
          title={`${questionnaire.name} — Participation`}
          exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
        />
      ) : (
        <RespondentsTable
          respondents={summary.respondents}
          title={`${questionnaire.name} — Respondents`}
          exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
        />
      )}

      <h3 style={{ marginTop: '1.5rem' }}>{questionnaire.name} — Answer distribution</h3>
      <AnswerDistributionDrilldown
        questions={questionnaire.questions}
        subScenarios={questionnaire.subScenarios}
        entries={drilldownQuery.data?.entries ?? []}
        comments={drilldownQuery.data?.comments ?? []}
        opCoScopeId={opCoScopeId}
        exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
        anonymized={anonymized}
      />

      {questionnaire.effectivenessIndicators.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>{questionnaire.name} — Key Effectiveness Indicators</h3>
          <KeiDistribution
            indicators={questionnaire.effectivenessIndicators}
            responses={drilldownQuery.data?.keiResponses ?? []}
            opCoScopeId={opCoScopeId}
            exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
            anonymized={anonymized}
          />
        </>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <CommentCollectionTable
          rows={[
            ...buildCommentCollectionRows(drilldownQuery.data?.comments ?? [], questionnaire.questions, questionnaire.subScenarios),
            ...buildKeiCommentRows(drilldownQuery.data?.keiResponses ?? [], questionnaire.effectivenessIndicators),
          ]}
          domain={questionnaire.networkType}
          hvs={withReviewTag(questionnaire.hvsCategory, questionnaire.inReview)}
          title={`${questionnaire.name} — Comment Collection`}
          exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
          anonymized={anonymized}
        />
      </div>
    </>
  );
}
