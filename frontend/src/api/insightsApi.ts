import type {
  BenchmarkingGroupBy,
  BenchmarkingSummaryDto,
  OpCoBenchmarkingSummaryDto,
  OrganizationQuestionnaireSummaryDto,
} from '@anlet/shared';
import { apiClient } from './client';

export const insightsApi = {
  getOrganizationSummary: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<OrganizationQuestionnaireSummaryDto>(
      `/organizations/${organizationId}/questionnaire-summary?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
  getBenchmarkingSummary: (questionnaireCode: string, groupBy: BenchmarkingGroupBy = 'organization') =>
    apiClient.get<BenchmarkingSummaryDto>(
      `/organizations/benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}&groupBy=${groupBy}`,
    ),
  getOpCoBenchmarkingSummary: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<OpCoBenchmarkingSummaryDto>(
      `/organizations/${organizationId}/opco-benchmarking?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
};
