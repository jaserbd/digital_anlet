import type { Role } from '@anlet/shared';

export const ROLE_LABELS: Record<Role, string> = {
  NORMAL_USER: 'Normal User',
  EXECUTIVE: 'Executive',
  ADMIN: 'Application Admin',
  PROJECT_ADMIN: 'Project Admin',
};

/** Roles that can be chosen when creating a user (the backend enforces the same rules): Executive
 * / Normal User for every admin, plus Application Admin for the super admin. Project Admins are
 * picked per project on the Projects list (PROJECTS_V2_PLAN.md). */
export function assignableRoles(caller: { role: Role; isSuperAdmin: boolean }): Role[] {
  return caller.role === 'ADMIN' && caller.isSuperAdmin ? ['NORMAL_USER', 'EXECUTIVE', 'ADMIN'] : ['NORMAL_USER', 'EXECUTIVE'];
}

/** Organization roles that can be set on a membership in the users table. */
export function assignableMembershipRoles(): Role[] {
  return ['NORMAL_USER', 'EXECUTIVE'];
}
