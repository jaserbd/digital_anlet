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

export const insightsApi = {
  getOrganizationSummary: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<OrganizationQuestionnaireSummaryDto>(
      `/organizations/${organizationId}/questionnaire-summary?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getBenchmarkingSummary: (questionnaireCode: string) =>
    apiClient.get<BenchmarkingSummaryDto>(
      `/organizations/benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getOpCoBenchmarkingSummary: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<OpCoBenchmarkingSummaryDto>(
      `/organizations/${organizationId}/opco-benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getAnswerDrilldown: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<AnswerDrilldownDto>(
      `/organizations/${organizationId}/answer-drilldown?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getCombinedBenchmarkingSummary: (groupCode: string) =>
    apiClient.get<CombinedBenchmarkingSummaryDto>(
      `/organizations/benchmarking/combined?groupCode=${encodeURIComponent(groupCode)}`,
    ),
  getCombinedOpCoBenchmarkingSummary: (organizationId: string, groupCode: string) =>
    apiClient.get<CombinedBenchmarkingSummaryDto>(
      `/organizations/${organizationId}/opco-benchmarking/combined?groupCode=${encodeURIComponent(groupCode)}`,
    ),
  getCrossOrgCommentCollection: (questionnaireCode: string) =>
    apiClient.get<CrossOrgCommentCollectionDto>(
      `/organizations/comment-collection?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getCognitiveActivitySummary: (
    organizationId: string,
    questionnaireCode: string,
    filters: { opCoId?: string; country?: string } = {},
  ) => {
    const params = new URLSearchParams({ questionnaireCode });
    if (filters.opCoId) params.set('opCoId', filters.opCoId);
    if (filters.country) params.set('country', filters.country);
    return apiClient.get<CognitiveActivitySummaryDto>(
      `/organizations/${organizationId}/cognitive-activity-summary?${params.toString()}`,
    );
  },
};
