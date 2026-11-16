import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountEmailResultDto } from '@anlet/shared';
import { mailApi } from '../api/mailApi';

// Welcome / reset emails with set-password links (ONBOARDING_SECURITY_PLAN.md Phase 3).

// Same limit as the server's MAX_ACCOUNT_EMAILS_PER_REQUEST.
export const WELCOME_EMAIL_BATCH_SIZE = 10;

/** Whether the server actually sends emails — the welcome email checkboxes default to it. */
export function useMailEnabled(): boolean | undefined {
  return useQuery({ queryKey: ['mail-enabled'], queryFn: mailApi.enabled, staleTime: 60_000 }).data?.enabled;
}

/** The "Send welcome email" choice of a form: on by default whenever the server sends emails,
 * until the admin ticks it themselves. */
export function useWelcomeEmailChoice() {
  const mailEnabled = useMailEnabled();
  const [choice, setChoice] = useState<boolean | null>(null);
  return { sendWelcome: choice ?? !!mailEnabled, setSendWelcome: setChoice, mailEnabled };
}

export function accountEmailOutcomeText(result: AccountEmailResultDto): string {
  switch (result.outcome) {
    case 'sent':
      return 'Email sent';
    case 'disabled':
      return 'Not sent — email sending is switched off';
    case 'failed':
      return `Email failed${result.error ? `: ${result.error}` : ''}`;
  }
}
