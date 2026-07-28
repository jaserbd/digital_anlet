import type { OpCoDto } from '@anlet/shared';
import { apiClient } from './client';

export const opCoApi = {
  list: (organizationId: string) =>
    apiClient.get<OpCoDto[]>(`/opcos?organizationId=${encodeURIComponent(organizationId)}`),
  create: (input: { name: string; country: string; organizationId: string }) =>
    apiClient.post<OpCoDto>('/opcos', input),
};
