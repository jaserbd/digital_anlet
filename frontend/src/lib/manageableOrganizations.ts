import { useQuery } from '@tanstack/react-query';
import type { OrganizationDto } from '@anlet/shared';
import { organizationsApi } from '../api/organizationsApi';
import { useAuth } from '../context/AuthContext';

/**
 * The organizations the caller may manage in the Management Console sections (PROJECTS_PLAN.md):
 * every organization for an Application Admin, or just the active organization for a Project
 * Admin — whose server-side checks reject anything else anyway.
 */
export function useManageableOrganizations(): { organizations: OrganizationDto[] | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const isApplicationAdmin = user?.role === 'ADMIN';
  const query = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list, enabled: isApplicationAdmin });
  if (isApplicationAdmin) return { organizations: query.data, isLoading: query.isLoading };

  const active = user?.contexts.find((c) => c.membershipId === user.activeMembershipId);
  const organizations =
    user?.role === 'PROJECT_ADMIN' && active
      ? [{ id: active.organizationId, name: active.organizationName, projectId: null }]
      : [];
  return { organizations, isLoading: false };
}
