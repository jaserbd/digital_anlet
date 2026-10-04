import type { BulkCreateUsersResultDto, BulkCreateUsersRowDto, Role, UpdateUserRequestDto, UserDto } from '@anlet/shared';
import { apiClient } from './client';

export interface CreateUserInput {
  email: string;
  password: string;
  // ADMIN is accepted only from the super admin (enforced server-side).
  role: Role;
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

export const usersApi = {
  create: (input: CreateUserInput) => apiClient.post<UserDto>('/users', input),
  bulkCreate: (rows: BulkCreateUsersRowDto[]) =>
    apiClient.post<BulkCreateUsersResultDto[]>('/users/bulk', { rows }),
  list: (organizationId?: string) =>
    apiClient.get<UserDto[]>(`/users${organizationId ? `?organizationId=${organizationId}` : ''}`),
  update: (userId: string, input: UpdateUserRequestDto) =>
    apiClient.patch<UserDto>(`/users/${userId}`, input),
  delete: (userId: string) => apiClient.delete<void>(`/users/${userId}`),
};
