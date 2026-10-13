import type {
  AnswerDrilldownDto,
  BenchmarkingSummaryDto,
  CognitiveActivitySummaryDto,
  CombinedBenchmarkingSummaryDto,
  CrossOrgCommentCollectionDto,
  OpCoBenchmarkingSummaryDto,
  OrganizationQuestionnaireSummaryDto,
} from '@anlet/shared';
import { apiClient } from './client';

// Organization dashboards are per project (PROJECTS_V2_PLAN.md). Executives and Project Admins get
// their active project server-side; Application Admins (Deep-Dive) pass the project they look at
// (null = the organization's members outside projects).
function withProject(url: string, projectId?: string | null): string {
  return projectId ? `${url}&projectId=${encodeURIComponent(projectId)}` : url;
}

export const insightsApi = {
  getOrganizationSummary: (organizationId: string, questionnaireCode: string, projectId?: string | null) =>
    apiClient.get<OrganizationQuestionnaireSummaryDto>(
      withProject(
        `/organizations/${organizationId}/questionnaire-summary?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
        projectId,
      ),
    ),
  getBenchmarkingSummary: (questionnaireCode: string) =>
    apiClient.get<BenchmarkingSummaryDto>(
      `/organizations/benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getOpCoBenchmarkingSummary: (organizationId: string, questionnaireCode: string, projectId?: string | null) =>
    apiClient.get<OpCoBenchmarkingSummaryDto>(
      withProject(
        `/organizations/${organizationId}/opco-benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
        projectId,
      ),
    ),
  getAnswerDrilldown: (organizationId: string, questionnaireCode: string, projectId?: string | null) =>
    apiClient.get<AnswerDrilldownDto>(
      withProject(
        `/organizations/${organizationId}/answer-drilldown?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
        projectId,
      ),
    ),
  getCombinedBenchmarkingSummary: (groupCode: string) =>
    apiClient.get<CombinedBenchmarkingSummaryDto>(
      `/organizations/benchmarking/combined?groupCode=${encodeURIComponent(groupCode)}`,
    ),
  getCombinedOpCoBenchmarkingSummary: (organizationId: string, groupCode: string, projectId?: string | null) =>
    apiClient.get<CombinedBenchmarkingSummaryDto>(
      withProject(
        `/organizations/${organizationId}/opco-benchmarking/combined?groupCode=${encodeURIComponent(groupCode)}`,
        projectId,
      ),
    ),
  getCrossOrgCommentCollection: (questionnaireCode: string) =>
    apiClient.get<CrossOrgCommentCollectionDto>(
      `/organizations/comment-collection?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getCognitiveActivitySummary: (
    organizationId: string,
    questionnaireCode: string,
    filters: { opCoId?: string; country?: string } = {},
    projectId?: string | null,
  ) => {
    const params = new URLSearchParams({ questionnaireCode });
    if (projectId) params.set('projectId', projectId);
    if (filters.opCoId) params.set('opCoId', filters.opCoId);
    if (filters.country) params.set('country', filters.country);
    return apiClient.get<CognitiveActivitySummaryDto>(
      `/organizations/${organizationId}/cognitive-activity-summary?${params.toString()}`,
    );
  },
};
