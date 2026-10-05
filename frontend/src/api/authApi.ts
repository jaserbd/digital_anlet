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
  // Switch the active working context (MULTI_ORG_PLAN.md): a membership id, or null for the
  // admin context.
  switchContext: (membershipId: string | null) => apiClient.post<void>('/auth/context', { membershipId }),
  updateProfile: (input: { opCoId?: string; workingDomain: string; designation: string }) =>
    apiClient.put<void>('/auth/profile', input),
  changePassword: (input: ChangePasswordRequestDto) => apiClient.put<void>('/auth/change-password', input),
  forgotPassword: (input: ForgotPasswordRequestDto) => apiClient.post<void>('/auth/forgot-password', input),
  resetPassword: (input: ResetPasswordRequestDto) => apiClient.post<void>('/auth/reset-password', input),
};
