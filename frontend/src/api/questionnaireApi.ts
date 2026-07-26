import type { QuestionnaireDto } from '@anlet/shared';
import { apiClient } from './client';

export const questionnaireApi = {
  get: (code: string) => apiClient.get<QuestionnaireDto>(`/questionnaires/${code}`),
};
