import type {
  AnswerDrilldownDto,
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
};
