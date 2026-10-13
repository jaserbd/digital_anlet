import type { UserContextDto } from '@anlet/shared';
import { ROLE_LABELS } from './roles';

/** "Application Admin — all projects", "C056875 · Post Luxemburg — Executive" or, outside
 * projects, "Detecon — Executive" (PROJECTS_V2_PLAN.md). */
export function formatContextLabel(context: UserContextDto): string {
  if (context.membershipId === null) return 'Application Admin — all projects';
  const where = context.projectName ? `${context.projectName} · ${context.organizationName}` : context.organizationName;
  return `${where} — ${ROLE_LABELS[context.role]}`;
}

/** Stable key for a context (the admin context has no membership id). */
export function contextKey(membershipId: string | null): string {
  return membershipId ?? 'admin';
}
