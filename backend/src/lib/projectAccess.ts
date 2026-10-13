import type { Request, Response } from 'express';
import type { RequestUser } from './userContext';

// Project Admins (PROJECTS_PLAN.md, PROJECTS_V2_PLAN.md) hold Application Admin rights, but only
// for the organization + project of their active PROJECT_ADMIN membership — every org-scoped
// admin route checks the target with these helpers.

export function isProjectAdmin(user: RequestUser): boolean {
  return user.role === 'PROJECT_ADMIN';
}

/** A Project Admin's scope: the active membership's organization and project. */
export interface ProjectAdminScope {
  organizationId: string;
  projectId: string | null;
}

export function projectAdminScopeOf(user: RequestUser): ProjectAdminScope | undefined {
  return isProjectAdmin(user) ? { organizationId: user.organizationId, projectId: user.projectId } : undefined;
}

/** Application Admin (admin context): anything. Project Admin: their active organization + project. */
export function canManageOrganization(user: RequestUser, organizationId: string, projectId: string | null): boolean {
  return (
    user.role === 'ADMIN' ||
    (isProjectAdmin(user) && user.organizationId === organizationId && user.projectId === projectId)
  );
}

/** Read access to an organization's dashboards: Application Admin any; Executive and Project Admin
 * their own (the project then comes from their active membership — see insightsScope). */
export function canViewOrganization(user: RequestUser, organizationId: string): boolean {
  return user.role === 'ADMIN' || user.organizationId === organizationId;
}

/** Responds 403 and returns false when the caller may not manage the organization + project. */
export function requireManageOrganization(
  req: Request,
  res: Response,
  organizationId: string,
  projectId: string | null,
): boolean {
  if (canManageOrganization(req.user!, organizationId, projectId)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

/** Reads an optional `projectId` (query or body); '' / absent = no project. */
export function optionalProjectId(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Organization-level data shared by all its projects (NatCos and their names): Application Admin,
 * or a Project Admin of that organization in any of its projects. */
export function requireManageOrganizationData(req: Request, res: Response, organizationId: string): boolean {
  const user = req.user!;
  if (user.role === 'ADMIN' || (isProjectAdmin(user) && user.organizationId === organizationId)) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
}
