import type { AnswerOption, ResponseDto, ScoreResultDto } from '@anlet/shared';
import { apiClient } from './client';

export const responsesApi = {
  getOrCreate: (questionnaireCode: string) =>
    apiClient.post<ResponseDto>('/responses', { questionnaireCode }),
  get: (responseId: string) => apiClient.get<ResponseDto>(`/responses/${responseId}`),
  upsertAnswer: (
    responseId: string,
    answer: { questionId: string; subScenarioId: string; selectedOption: AnswerOption },
  ) => apiClient.put<void>(`/responses/${responseId}/answers`, answer),
  submit: (responseId: string) =>
    apiClient.post<ScoreResultDto>(`/responses/${responseId}/submit`),
  getResult: (responseId: string) =>
    apiClient.get<ScoreResultDto>(`/responses/${responseId}/result`),
};
