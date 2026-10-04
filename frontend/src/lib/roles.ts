import type { Role } from '@anlet/shared';

export const ROLE_LABELS: Record<Role, string> = {
  NORMAL_USER: 'Normal User',
  EXECUTIVE: 'Executive',
  ADMIN: 'Admin',
};

/** Roles the current admin may assign: Normal User / Executive for every admin, plus Admin
 * for the super admin only (ADMIN_MANAGEMENT_PLAN.md — the backend enforces the same rule). */
export function assignableRoles(isSuperAdmin: boolean): Role[] {
  return isSuperAdmin ? ['NORMAL_USER', 'EXECUTIVE', 'ADMIN'] : ['NORMAL_USER', 'EXECUTIVE'];
}
