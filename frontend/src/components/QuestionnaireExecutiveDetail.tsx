import { useQuery } from '@tanstack/react-query';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { AnswerDistributionDrilldown } from './AnswerDistributionDrilldown';
import { RespondentsTable } from './RespondentsTable';
import { buildCommentCollectionRows, CommentCollectionTable } from './CommentCollectionTable';
import { AggregateCognitiveActivityRadar, type OrganizationSwitcher } from './AggregateCognitiveActivityRadar';

// Fetches everything one member questionnaire's section of an organization overview needs.
// Shared by ExecutivePage.tsx (own org) and OrganizationDeepDivePage.tsx (any org, ADMIN.md
// item 2's Executive-parity ask) — both call this with identical query keys per
// (organizationId, questionnaireCode), so TanStack Query dedupes by key: one network request
// per query no matter how many components ask for it.
export function useQuestionnaireExecutiveData(organizationId: string, questionnaireCode: string | undefined) {
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', questionnaireCode],
    queryFn: () => questionnaireApi.get(questionnaireCode!),
    enabled: !!questionnaireCode,
  });
  const summaryQuery = useQuery({
    queryKey: ['organization-summary', organizationId, questionnaireCode],
    queryFn: () => insightsApi.getOrganizationSummary(organizationId, questionnaireCode!),
    enabled: !!questionnaireCode,
  });
  const drilldownQuery = useQuery({
    queryKey: ['answer-drilldown', organizationId, questionnaireCode],
    queryFn: () => insightsApi.getAnswerDrilldown(organizationId, questionnaireCode!),
    enabled: !!questionnaireCode,
  });
  return { questionnaireQuery, summaryQuery, drilldownQuery };
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
  opCoScopeId,
  organizationSwitcher,
}: {
  organizationId: string;
  questionnaireCode: string;
  // Scopes the Answer distribution's respondent lists to one NatCo (OrganizationDeepDivePage's
  // admin-exclusive drill-down) — omitted by ExecutivePage, which has no need to scope within
  // its own single organization.
  opCoScopeId?: string | null;
  // ADMIN_2.md item 1's Admin-only Organization dropdown, gating the spider chart's own
  // NatCo/Country filters — omitted by ExecutivePage, which never switches organizations.
  organizationSwitcher?: OrganizationSwitcher;
}) {
  const { questionnaireQuery, summaryQuery, drilldownQuery } = useQuestionnaireExecutiveData(organizationId, questionnaireCode);

  if (questionnaireQuery.isLoading || summaryQuery.isLoading) {
    return <p>Loading…</p>;
  }
  if (!questionnaireQuery.data || !summaryQuery.data) {
    return <p>Something went wrong loading the organization summary.</p>;
  }
  const { data: questionnaire } = questionnaireQuery;
  const { data: summary } = summaryQuery;

  return (
    <>
      <AggregateCognitiveActivityRadar
        organizationId={organizationId}
        questionnaireCode={questionnaireCode}
        organizationSwitcher={organizationSwitcher}
      />

      <RespondentsTable
        respondents={summary.respondents}
        title={`${questionnaire.name} — Respondents`}
        exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
      />

      <h3 style={{ marginTop: '1.5rem' }}>{questionnaire.name} — Answer distribution</h3>
      <AnswerDistributionDrilldown
        questions={questionnaire.questions}
        subScenarios={questionnaire.subScenarios}
        entries={drilldownQuery.data?.entries ?? []}
        comments={drilldownQuery.data?.comments ?? []}
        opCoScopeId={opCoScopeId}
        exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
      />

      <div style={{ marginTop: '1.5rem' }}>
        <CommentCollectionTable
          rows={buildCommentCollectionRows(drilldownQuery.data?.comments ?? [], questionnaire.questions, questionnaire.subScenarios)}
          domain={questionnaire.networkType}
          hvs={questionnaire.hvsCategory}
          title={`${questionnaire.name} — Comment Collection`}
          exportFileNamePrefix={`org-${organizationId}-${questionnaireCode}`}
        />
      </div>
    </>
  );
}
