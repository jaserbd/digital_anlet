import type {
  AuthenticatedUserDto,
  ChangePasswordRequestDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from '@anlet/shared';
import { apiClient } from './client';

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<void>('/auth/login', { email, password }),
  logout: () => apiClient.post<void>('/auth/logout'),
  me: () => apiClient.get<AuthenticatedUserDto>('/auth/me'),
  updateProfile: (input: { opCoId?: string; workingDomain: string; designation: string }) =>
    apiClient.put<void>('/auth/profile', input),
  changePassword: (input: ChangePasswordRequestDto) => apiClient.put<void>('/auth/change-password', input),
  forgotPassword: (input: ForgotPasswordRequestDto) => apiClient.post<void>('/auth/forgot-password', input),
  resetPassword: (input: ResetPasswordRequestDto) => apiClient.post<void>('/auth/reset-password', input),
};
