import type { MembershipDto, UserDto } from '@anlet/shared';
import { type Placement, placementKey } from './placements';

// Users per organization (USERS_PER_ORGANIZATION_PLAN.md): every user belongs to exactly one
// organization (`UserDto.organizationId`) and is listed in that organization's table only. Project
// Admin memberships in client organizations don't make anyone a member there — they're shown as
// the consultant's "Project Admin of" projects instead.

/** One table row: a user + one of their Executive / Normal User memberships, or the user alone. */
export interface UserRowData {
  user: UserDto;
  membership: MembershipDto | null;
}

export interface OrganizationUserGroup {
  organizationId: string;
  organizationName: string;
  userCount: number;
  rows: UserRowData[];
}

/** The user's Executive / Normal User memberships — all in their own organization. */
export function memberMemberships(user: UserDto): MembershipDto[] {
  return user.memberships.filter((m) => m.role !== 'PROJECT_ADMIN');
}

/** The projects a consultant is Project Admin of (one name per project). */
export function projectAdminOf(user: UserDto): string[] {
  const names = user.memberships.filter((m) => m.role === 'PROJECT_ADMIN').map((m) => m.projectName ?? '—');
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/** One group per organization (alphabetical), keeping only users whose email contains `search`. */
export function groupUsersByOrganization(users: UserDto[], search = ''): OrganizationUserGroup[] {
  const needle = search.trim().toLowerCase();
  const groups = new Map<string, OrganizationUserGroup>();
  for (const user of users) {
    if (needle && !user.email.toLowerCase().includes(needle)) continue;
    const group = groups.get(user.organizationId) ?? {
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      userCount: 0,
      rows: [],
    };
    const memberships = memberMemberships(user);
    group.userCount += 1;
    group.rows.push(...(memberships.length > 0 ? memberships.map((membership) => ({ user, membership })) : [{ user, membership: null }]));
    groups.set(user.organizationId, group);
  }
  return [...groups.values()].sort((a, b) => a.organizationName.localeCompare(b.organizationName));
}

/** The project + organization pairs a user isn't in yet. */
function freePlacements(user: UserDto, placements: Placement[]): Placement[] {
  const taken = new Set(user.memberships.map((m) => placementKey(m)));
  return placements.filter((p) => !taken.has(placementKey(p)));
}

/** Where a user can be added: projects of their own organization — or anywhere for a non-admin
 * without any membership at all yet (not even as Project Admin), who then belongs to that
 * organization (same rule as the server). */
export function addablePlacements(user: UserDto, placements: Placement[]): Placement[] {
  const free = freePlacements(user, placements);
  if (user.role !== 'ADMIN' && user.memberships.length === 0) return free;
  return free.filter((p) => p.organizationId === user.organizationId);
}

/** Where a membership can move: another project of the organization, or — for the user's only
 * membership — another organization too (which moves the person). Application Admins and
 * Project Admins (consultants) stay in their own organization. */
export function movePlacements(user: UserDto, placements: Placement[]): Placement[] {
  const free = freePlacements(user, placements);
  const staysInOrganization = user.role === 'ADMIN' || user.memberships.some((m) => m.role === 'PROJECT_ADMIN');
  if (!staysInOrganization && memberMemberships(user).length === 1) return free;
  return free.filter((p) => p.organizationId === user.organizationId);
}
