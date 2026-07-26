import type { AuthenticatedUserDto } from '@anlet/shared';
import { apiClient } from './client';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<void>('/auth/login', { email, password }),
  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<AuthenticatedUserDto>('/auth/me'),
};
