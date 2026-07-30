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
  getAcceptingStatus: (code: string, organizationId: string) =>
    apiClient.get<AcceptingStatus>(
      `/questionnaires/${code}/accepting?organizationId=${encodeURIComponent(organizationId)}`,
    ),
  setAcceptingResponses: (code: string, organizationId: string, acceptingResponses: boolean) =>
    apiClient.patch<void>(`/questionnaires/${code}/accepting`, { organizationId, acceptingResponses }),
};
