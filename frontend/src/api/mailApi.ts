import type { MailStatusDto, UpdateMailSettingsRequestDto } from '@anlet/shared';
import { apiClient } from './client';

export const mailApi = {
  status: () => apiClient.get<MailStatusDto>('/mail/status'),
  // Super admin only: verified against the mail server before saving.
  update: (input: UpdateMailSettingsRequestDto) => apiClient.put<MailStatusDto>('/mail/settings', input),
  reset: () => apiClient.delete<MailStatusDto>('/mail/settings'),
  // Super admin only; sends to the caller's own address.
  sendTest: () => apiClient.post<void>('/mail/test'),
};
