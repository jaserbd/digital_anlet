import type { UserContextDto } from '@anlet/shared';
import { ROLE_LABELS } from './roles';

/** "Admin — all clients" or "Client A — Executive". */
export function formatContextLabel(context: UserContextDto): string {
  return context.membershipId === null
    ? 'Admin — all clients'
    : `${context.organizationName} — ${ROLE_LABELS[context.role]}`;
}

/** Stable key for a context (the admin context has no membership id). */
export function contextKey(membershipId: string | null): string {
  return membershipId ?? 'admin';
}
