import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '../api/organizationsApi';
import { projectsApi } from '../api/projectsApi';
import { useAuth } from '../context/AuthContext';

/** Where a membership can sit (PROJECTS_V2_PLAN.md): an organization within one of its projects,
 * or — for an organization in no project (e.g. Detecon) — the organization alone. */
export interface Placement {
  organizationId: string;
  organizationName: string;
  projectId: string | null;
  projectName: string | null;
}

export function placementKey(p: { organizationId: string; projectId: string | null }): string {
  return `${p.projectId ?? 'none'}:${p.organizationId}`;
}

export function placementLabel(p: { organizationName: string; projectName: string | null }): string {
  return p.projectName ? `${p.projectName} · ${p.organizationName}` : p.organizationName;
}

/**
 * The placements the caller may use: every project + organization pair and every organization
 * outside projects for an Application Admin; just the active organization + project for a Project
 * Admin (`fixed`), whose server-side checks reject anything else anyway.
 */
export function usePlacements(): { placements: Placement[] | undefined; isLoading: boolean; fixed: Placement | null } {
  const { user } = useAuth();
  const isApplicationAdmin = user?.role === 'ADMIN';
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list, enabled: isApplicationAdmin });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list, enabled: isApplicationAdmin });

  if (!isApplicationAdmin) {
    const active = user?.contexts.find((c) => c.membershipId === user.activeMembershipId);
    const fixed =
      user?.role === 'PROJECT_ADMIN' && active
        ? {
            organizationId: active.organizationId,
            organizationName: active.organizationName,
            projectId: active.projectId,
            projectName: active.projectName,
          }
        : null;
    return { placements: fixed ? [fixed] : [], isLoading: false, fixed };
  }
  if (!projectsQuery.data || !orgsQuery.data) {
    return { placements: undefined, isLoading: projectsQuery.isLoading || orgsQuery.isLoading, fixed: null };
  }
  const inProjects = new Set(projectsQuery.data.flatMap((p) => p.organizations.map((o) => o.id)));
  const placements: Placement[] = [
    ...projectsQuery.data.flatMap((p) =>
      p.organizations.map((o) => ({ organizationId: o.id, organizationName: o.name, projectId: p.id, projectName: p.name })),
    ),
    ...orgsQuery.data
      .filter((o) => !inProjects.has(o.id))
      .map((o) => ({ organizationId: o.id, organizationName: o.name, projectId: null, projectName: null })),
  ];
  return { placements, isLoading: false, fixed: null };
}
