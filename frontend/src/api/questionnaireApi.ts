import type { HvsListItemDto, QuestionnaireDto, QuestionnaireSummaryDto } from '@anlet/shared';
import { apiClient } from './client';

interface AcceptingStatus {
  questionnaireCode: string;
  organizationId: string;
  acceptingResponses: boolean;
}

export const questionnaireApi = {
  list: () => apiClient.get<QuestionnaireSummaryDto[]>('/questionnaires'),
  listHvsEntries: () => apiClient.get<HvsListItemDto[]>('/questionnaires/hvs-entries'),
  get: (code: string) => apiClient.get<QuestionnaireDto>(`/questionnaires/${code}`),
  // Open/close is per organization + project (PROJECTS_V2_PLAN.md); projectId null = outside projects.
  getAcceptingStatus: (code: string, organizationId: string, projectId: string | null) =>
    apiClient.get<AcceptingStatus>(
      `/questionnaires/${code}/accepting?organizationId=${encodeURIComponent(organizationId)}${
        projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''
      }`,
    ),
  setAcceptingResponses: (code: string, organizationId: string, acceptingResponses: boolean, projectId: string | null) =>
    apiClient.patch<void>(`/questionnaires/${code}/accepting`, { organizationId, projectId, acceptingResponses }),
};
