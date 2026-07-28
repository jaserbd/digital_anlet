import type { QuestionnaireDto, QuestionnaireSummaryDto } from '@anlet/shared';
import { apiClient } from './client';

export const questionnaireApi = {
  list: () => apiClient.get<QuestionnaireSummaryDto[]>('/questionnaires'),
  get: (code: string) => apiClient.get<QuestionnaireDto>(`/questionnaires/${code}`),
  setAcceptingResponses: (code: string, acceptingResponses: boolean) =>
    apiClient.patch<void>(`/questionnaires/${code}/accepting`, { acceptingResponses }),
};
