import type { UserDto } from '@anlet/shared';
import { apiClient } from './client';

export interface CreateUserInput {
  email: string;
  password: string;
  role: 'NORMAL_USER' | 'EXECUTIVE';
  organizationId: string;
  firstName?: string;
  lastName?: string;
}

export const usersApi = {
  create: (input: CreateUserInput) => apiClient.post<UserDto>('/users', input),
};
