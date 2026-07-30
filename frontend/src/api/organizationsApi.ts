import type { OrganizationDto } from '@anlet/shared';
import { apiClient } from './client';

export const organizationsApi = {
  list: () => apiClient.get<OrganizationDto[]>('/organizations'),
  create: (name: string) => apiClient.post<OrganizationDto>('/organizations', { name }),
  delete: (id: string) => apiClient.delete<void>(`/organizations/${id}`),
};
