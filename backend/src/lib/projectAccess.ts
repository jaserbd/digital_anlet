import type { Request, Response } from 'express';
import type { RequestUser } from './userContext';

// Project Admins (PROJECTS_PLAN.md) hold Application Admin rights, but only for the
// organization of their active PROJECT_ADMIN membership — every org-scoped admin route checks
// the target organization with these helpers.

export function isProjectAdmin(user: RequestUser): boolean {
  return user.role === 'PROJECT_ADMIN';
}

/** Application Admin (admin context): any organization. Project Admin: their active organization. */
export function canManageOrganization(user: RequestUser, organizationId: string): boolean {
  return user.role === 'ADMIN' || (isProjectAdmin(user) && user.organizationId === organizationId);
}

/** Read access to an organization's dashboards: Application Admin any; Executive and Project Admin their own. */
export function canViewOrganization(user: RequestUser, organizationId: string): boolean {
  return user.role === 'ADMIN' || user.organizationId === organizationId;
}

/** Responds 403 and returns false when the caller may not manage the organization. */
export function requireManageOrganization(req: Request, res: Response, organizationId: string): boolean {
  if (canManageOrganization(req.user!, organizationId)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
