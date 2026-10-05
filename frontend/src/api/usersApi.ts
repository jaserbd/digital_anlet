import type {
  AddMembershipRequestDto,
  BulkCreateUsersResultDto,
  BulkCreateUsersRowDto,
  CreateUserResultDto,
  Role,
  TemporaryPasswordDto,
  UpdateMembershipRequestDto,
  UpdateUserRequestDto,
  UserDto,
} from '@anlet/shared';
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
  // An existing email (non-admin role) adds the organization as a membership instead
  // (MULTI_ORG_PLAN.md) — see CreateUserResultDto.status.
  create: (input: CreateUserInput) => apiClient.post<CreateUserResultDto>('/users', input),
  bulkCreate: (rows: BulkCreateUsersRowDto[]) =>
    apiClient.post<BulkCreateUsersResultDto[]>('/users/bulk', { rows }),
  list: (organizationId?: string) =>
    apiClient.get<UserDto[]>(`/users${organizationId ? `?organizationId=${organizationId}` : ''}`),
  update: (userId: string, input: UpdateUserRequestDto) =>
    apiClient.patch<UserDto>(`/users/${userId}`, input),
  delete: (userId: string) => apiClient.delete<void>(`/users/${userId}`),
  addMembership: (userId: string, input: AddMembershipRequestDto) =>
    apiClient.post<UserDto>(`/users/${userId}/memberships`, input),
  updateMembership: (userId: string, membershipId: string, input: UpdateMembershipRequestDto) =>
    apiClient.patch<UserDto>(`/users/${userId}/memberships/${membershipId}`, input),
  removeMembership: (userId: string, membershipId: string) =>
    apiClient.delete<UserDto>(`/users/${userId}/memberships/${membershipId}`),
  temporaryPassword: (userId: string) =>
    apiClient.post<TemporaryPasswordDto>(`/users/${userId}/temporary-password`),
};
