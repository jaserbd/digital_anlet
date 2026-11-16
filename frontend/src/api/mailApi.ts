import type { MailStatusDto } from '@anlet/shared';
import { apiClient } from './client';

export const mailApi = {
  status: () => apiClient.get<MailStatusDto>('/mail/status'),
  // Super admin only; sends to the caller's own address.
  sendTest: () => apiClient.post<void>('/mail/test'),
};
