import type { ReferenceListCategory, ReferenceListEntryDto } from '@anlet/shared';
import { apiClient } from './client';

export const referenceListsApi = {
  list: (category: ReferenceListCategory, organizationId?: string) =>
    apiClient.get<ReferenceListEntryDto[]>(
      `/reference-lists/${category}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
    ),
  create: (input: { category: ReferenceListCategory; name: string; organizationId?: string }) =>
    apiClient.post<ReferenceListEntryDto>(`/reference-lists/${input.category}`, {
      name: input.name,
      organizationId: input.organizationId,
    }),
  delete: (id: string) => apiClient.delete<void>(`/reference-lists/${id}`),
};
