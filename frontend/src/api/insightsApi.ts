import type { OrganizationQuestionnaireSummaryDto } from '@anlet/shared';
import { apiClient } from './client';

export const insightsApi = {
  getOrganizationSummary: (organizationId: string, questionnaireCode: string) =>
    apiClient.get<OrganizationQuestionnaireSummaryDto>(
      `/organizations/${organizationId}/questionnaire-summary?questionnaireCode=${encodeURIComponent(questionnaireCode)}`,
    ),
};
