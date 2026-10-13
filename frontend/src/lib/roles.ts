import type { Role } from '@anlet/shared';

export const ROLE_LABELS: Record<Role, string> = {
  NORMAL_USER: 'Normal User',
  EXECUTIVE: 'Executive',
  ADMIN: 'Application Admin',
  PROJECT_ADMIN: 'Project Admin',
};

/** Roles the current admin may assign when creating a user (the backend enforces the same
 * rules): Project Admins add Executives / Normal Users to their organization; Application Admins
 * also Project Admins; the super admin also Application Admins (ADMIN_MANAGEMENT_PLAN.md,
 * PROJECTS_PLAN.md). */
export function assignableRoles(caller: { role: Role; isSuperAdmin: boolean }): Role[] {
  if (caller.role === 'PROJECT_ADMIN') return ['NORMAL_USER', 'EXECUTIVE'];
  return caller.isSuperAdmin
    ? ['NORMAL_USER', 'EXECUTIVE', 'PROJECT_ADMIN', 'ADMIN']
    : ['NORMAL_USER', 'EXECUTIVE', 'PROJECT_ADMIN'];
}

/** Organization roles an admin may set on a membership (Admin is global, not a membership role). */
export function assignableMembershipRoles(callerRole: Role): Role[] {
  return callerRole === 'PROJECT_ADMIN' ? ['NORMAL_USER', 'EXECUTIVE'] : ['NORMAL_USER', 'EXECUTIVE', 'PROJECT_ADMIN'];
}
