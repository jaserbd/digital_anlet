import type {
  CoreDomainSummaryDto,
  KeiAnswerDto,
  QuestionCommentDto,
  AnswerOption,
  ResponseDto,
  ScoreResultDto,
} from '@anlet/shared';
import { apiClient } from './client';

export const responsesApi = {
  getOrCreate: (questionnaireCode: string) =>
    apiClient.post<ResponseDto>('/responses', { questionnaireCode }),
  get: (responseId: string) => apiClient.get<ResponseDto>(`/responses/${responseId}`),
  upsertAnswer: (
    responseId: string,
    answer: { questionId: string; subScenarioId: string; selectedOption: AnswerOption },
  ) => apiClient.put<void>(`/responses/${responseId}/answers`, answer),
  deleteAnswer: (responseId: string, questionId: string, subScenarioId: string) =>
    apiClient.delete<void>(`/responses/${responseId}/answers/${questionId}/${subScenarioId}`),
  upsertComment: (
    responseId: string,
    comment: Omit<QuestionCommentDto, 'subScenarioIds'> & { subScenarioIds: string[] },
  ) => apiClient.put<void>(`/responses/${responseId}/comments`, comment),
  // Saves one Key Effectiveness Indicator's full state; all-empty clears it back to unanswered.
  upsertKei: (responseId: string, kei: KeiAnswerDto) =>
    apiClient.put<void>(`/responses/${responseId}/kei`, kei),
  submit: (responseId: string) =>
    apiClient.post<ScoreResultDto>(`/responses/${responseId}/submit`),
  getResult: (responseId: string) =>
    apiClient.get<ScoreResultDto>(`/responses/${responseId}/result`),
  getCoreDomainSummary: () =>
    apiClient.get<CoreDomainSummaryDto>('/responses/core-domain-summary'),
};
