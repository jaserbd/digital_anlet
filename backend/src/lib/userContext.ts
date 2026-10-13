import type { Role, UserContextDto } from '@anlet/shared';
import { prisma } from './prisma';

// The caller as every request handler sees it (MULTI_ORG_PLAN.md): `role` and
// `organizationId` are the *active context's* — ADMIN + home organization in the admin
// context, or the active membership's role + organization — so handlers written for "one user
// = one organization + one role" keep working unchanged.
export interface RequestUser {
  sub: string;
  email: string;
  role: Role;
  organizationId: string;
  // The active membership's project (PROJECTS_V2_PLAN.md) — dashboards, questionnaires and
  // open/close are scoped to it. Null in the admin context and outside projects.
  projectId: string | null;
  membershipId: string | null;
  isAdmin: boolean;
}

/**
 * Resolves the active context fresh from the database on every request, so removing a
 * membership or changing a role takes effect immediately rather than when the login token
 * expires. A requested membership that no longer belongs to the user falls back to the
 * default context. Returns null for an unknown or deactivated user.
 */
export async function resolveRequestUser(
  userId: string,
  requestedMembershipId: string | null,
): Promise<RequestUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      organizationId: true,
      memberships: {
        select: { id: true, role: true, organizationId: true, projectId: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!user || !user.isActive) return null;

  const isAdmin = user.role === 'ADMIN';
  const requested = requestedMembershipId
    ? user.memberships.find((m) => m.id === requestedMembershipId)
    : undefined;
  const membership = requested ?? (isAdmin ? undefined : user.memberships[0]);

  if (membership) {
    return {
      sub: user.id,
      email: user.email,
      role: membership.role,
      organizationId: membership.organizationId,
      projectId: membership.projectId,
      membershipId: membership.id,
      isAdmin,
    };
  }
  // Admin context — or a non-admin with no memberships left, who can sign in but not answer
  // or view anything organization-specific (NORMAL_USER without a membership).
  return {
    sub: user.id,
    email: user.email,
    role: isAdmin ? 'ADMIN' : 'NORMAL_USER',
    organizationId: user.organizationId,
    projectId: null,
    membershipId: null,
    isAdmin,
  };
}

/** The contexts shown in the switcher: the admin context first (admins only), then each
 * membership ordered by project and organization name (project-less ones last). */
export async function listUserContexts(userId: string): Promise<UserContextDto[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
      memberships: {
        select: {
          id: true,
          role: true,
          organizationId: true,
          organization: { select: { name: true } },
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: [{ project: { name: 'asc' } }, { organization: { name: 'asc' } }],
      },
    },
  });
  const contexts: UserContextDto[] = user.memberships.map((m) => ({
    membershipId: m.id,
    organizationId: m.organizationId,
    organizationName: m.organization.name,
    projectId: m.projectId,
    projectName: m.project?.name ?? null,
    role: m.role,
  }));
  if (user.role === 'ADMIN') {
    contexts.unshift({
      membershipId: null,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      projectId: null,
      projectName: null,
      role: 'ADMIN',
    });
  }
  return contexts;
}
