import { describe, expect, it } from 'vitest';
import type { MembershipDto, Role, UserDto } from '@anlet/shared';
import { addablePlacements, groupUsersByOrganization, movePlacements, projectAdminOf } from './userGroups';
import type { Placement } from './placements';

const ORGS: Record<string, string> = { post: 'Post Luxemburg', detecon: 'Detecon', telco: 'Telco B' };

function membership(organizationId: string, projectId: string | null, role: Role): MembershipDto {
  return {
    id: `${organizationId}:${projectId}:${role}`,
    organizationId,
    organizationName: ORGS[organizationId]!,
    role,
    projectId,
    projectName: projectId,
    opCoId: null,
    opCoName: null,
    workingDomain: null,
    designation: null,
    responseCount: 0,
  };
}

function user(email: string, organizationId: string, memberships: MembershipDto[], role: Role = 'NORMAL_USER'): UserDto {
  return {
    id: email,
    email,
    role,
    organizationId,
    organizationName: ORGS[organizationId]!,
    firstName: null,
    lastName: null,
    isSuperAdmin: false,
    memberships,
  };
}

const placements: Placement[] = [
  { organizationId: 'post', organizationName: ORGS.post!, projectId: 'C056875', projectName: 'C056875' },
  { organizationId: 'post', organizationName: ORGS.post!, projectId: 'C2027', projectName: 'C2027' },
  { organizationId: 'telco', organizationName: ORGS.telco!, projectId: 'T1', projectName: 'T1' },
  { organizationId: 'detecon', organizationName: ORGS.detecon!, projectId: null, projectName: null },
];

const engineer = user('eng@post.test', 'post', [membership('post', 'C056875', 'NORMAL_USER'), membership('post', 'C2027', 'EXECUTIVE')]);
const consultant = user('consultant@detecon.test', 'detecon', [
  membership('detecon', null, 'EXECUTIVE'),
  membership('post', 'C056875', 'PROJECT_ADMIN'),
  membership('telco', 'T1', 'PROJECT_ADMIN'),
]);
const admin = user('admin@detecon.test', 'detecon', [], 'ADMIN');

// USERS_PER_ORGANIZATION_PLAN.md
describe('groupUsersByOrganization', () => {
  it("lists each user once, in their own organization's table, one row per project", () => {
    const groups = groupUsersByOrganization([engineer, consultant, admin]);
    expect(groups.map((g) => [g.organizationName, g.userCount, g.rows.length])).toEqual([
      ['Detecon', 2, 2],
      ['Post Luxemburg', 1, 2],
    ]);
    // The consultant's Project Admin memberships don't make them a Post Luxemburg member.
    const detecon = groups[0]!;
    expect(detecon.rows.map((r) => [r.user.email, r.membership?.role ?? null])).toEqual([
      ['consultant@detecon.test', 'EXECUTIVE'],
      ['admin@detecon.test', null],
    ]);
  });

  it('narrows every table by email', () => {
    expect(groupUsersByOrganization([engineer, consultant, admin], 'CONSULT').map((g) => g.organizationName)).toEqual(['Detecon']);
    expect(groupUsersByOrganization([engineer], 'nobody')).toEqual([]);
  });
});

describe('projectAdminOf', () => {
  it("names each project a consultant administers once", () => {
    expect(projectAdminOf(consultant)).toEqual(['C056875', 'T1']);
    expect(projectAdminOf(engineer)).toEqual([]);
  });
});

describe('addablePlacements / movePlacements', () => {
  it('only offers projects of the own organization once someone is a member there', () => {
    expect(addablePlacements(engineer, placements)).toEqual([]);
    expect(addablePlacements(user('new@x.test', 'post', []), placements)).toHaveLength(4); // not placed yet
    expect(addablePlacements(admin, placements).map((p) => p.organizationId)).toEqual(['detecon']);
  });

  it('moves to another organization only from the only membership', () => {
    expect(movePlacements(engineer, placements)).toEqual([]); // both Post Luxemburg projects taken
    const single = user('one@post.test', 'post', [membership('post', 'C056875', 'NORMAL_USER')]);
    expect(movePlacements(single, placements).map((p) => p.projectId)).toEqual(['C2027', 'T1', null]);
  });

  it('keeps Application Admins and Project Admins in their own organization', () => {
    expect(movePlacements(consultant, placements)).toEqual([]); // Detecon's only placement is taken
    const adminMember = user('admin2@detecon.test', 'detecon', [membership('detecon', null, 'EXECUTIVE')], 'ADMIN');
    expect(movePlacements(adminMember, placements)).toEqual([]);
    // A consultant with only Project Admin memberships isn't "unplaced" either.
    const onlyProjectAdmin = user('pa@detecon.test', 'detecon', [membership('post', 'C056875', 'PROJECT_ADMIN')]);
    expect(addablePlacements(onlyProjectAdmin, placements).map((p) => p.organizationId)).toEqual(['detecon']);
  });
});
