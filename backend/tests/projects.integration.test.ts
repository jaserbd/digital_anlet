import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/lib/jwt';
import { createApp } from '../src/app';
import { AUTH_COOKIE_NAME } from '../src/middleware/auth';
import { getOrCreateResponse, submitResponse, upsertAnswer } from '../src/modules/responses/responses.service';
import {
  InvalidQuestionnaireSelectionError,
  OrganizationInOtherProjectError,
  ProjectNotEmptyError,
  createProject,
  deleteProject,
  importProject,
  listProjects,
  updateProject,
} from '../src/modules/projects/projects.service';

// Integration test against the real local Postgres for PROJECTS_PLAN.md: projects and the Excel
// import (service level), and Project Admin scoping through the real HTTP routes — most of that
// scoping lives in the controllers, so it's exercised end to end with signed session cookies.

const PREFIX = '__integration-test-projects';
const ORG_A = `${PREFIX}-org-a__`;
const ORG_B = `${PREFIX}-org-b__`;
const ORG_IMPORT = `${PREFIX}-org-import__`;
const PROJECT_A = `${PREFIX}-project-a__`;
const PROJECT_IMPORT = `${PREFIX}-project-import__`;
const COUNTRY = `${PREFIX}-country__`;
const QUESTIONNAIRE = 'CORE_STABILITY_GB1059B'; // 7 questions, one synthetic sub-scenario, no KEIs

let server: Server;
let baseUrl: string;
let orgAId: string;
let orgBId: string;
let projectAId: string;
let adminId: string;
let projectAdminId: string;
let projectAdminMembershipId: string;
let executiveId: string;
let executiveMembershipId: string;
let memberAId: string; // Normal User in org A
let memberBId: string; // Normal User in org B
const userIds: string[] = [];
const projectIds: string[] = [];

const email = (label: string) => `${PREFIX}-${label}__@example.com`;

async function createRawUser(
  label: string,
  opts: { organizationId: string; role?: 'ADMIN' | 'NORMAL_USER'; membership?: 'NORMAL_USER' | 'EXECUTIVE' | 'PROJECT_ADMIN' },
) {
  const user = await prisma.user.create({
    data: {
      email: email(label),
      passwordHash: 'not-a-real-hash',
      role: opts.role ?? 'NORMAL_USER',
      organizationId: opts.organizationId,
      memberships: opts.membership ? { create: { organizationId: opts.organizationId, role: opts.membership } } : undefined,
    },
    include: { memberships: true },
  });
  userIds.push(user.id);
  return { id: user.id, membershipId: user.memberships[0]?.id ?? null };
}

function cookieFor(userId: string, membershipId: string | null) {
  return `${AUTH_COOKIE_NAME}=${signToken({ sub: userId, email: 'x', membershipId })}`;
}

async function api(
  method: string,
  path: string,
  as: { userId: string; membershipId: string | null },
  body?: unknown,
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely-typed JSON assertions in tests
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { cookie: cookieFor(as.userId, as.membershipId), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const asAdmin = () => ({ userId: adminId, membershipId: null });
const asProjectAdmin = () => ({ userId: projectAdminId, membershipId: projectAdminMembershipId });
const asExecutive = () => ({ userId: executiveId, membershipId: executiveMembershipId });

async function answerAllAndSubmit(userId: string, membershipId: string, option: 'A' | 'C') {
  const response = await getOrCreateResponse({ sub: userId, membershipId }, QUESTIONNAIRE);
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { code: QUESTIONNAIRE },
    include: { questions: true, subScenarios: true },
  });
  for (const question of questionnaire.questions) {
    for (const subScenario of questionnaire.subScenarios) {
      await upsertAnswer(response.id, userId, { questionId: question.id, subScenarioId: subScenario.id, selectedOption: option });
    }
  }
  await submitResponse(response.id, userId);
  return response.id;
}

beforeAll(async () => {
  orgAId = (await prisma.organization.create({ data: { name: ORG_A } })).id;
  orgBId = (await prisma.organization.create({ data: { name: ORG_B } })).id;
  const questionnaires = await prisma.questionnaire.findMany({ where: { isActive: true }, select: { id: true } });
  projectAId = (
    await prisma.project.create({
      data: {
        name: PROJECT_A,
        organizations: { connect: { id: orgAId } },
        questionnaires: { create: questionnaires.map((q) => ({ questionnaireId: q.id })) },
      },
    })
  ).id;
  projectIds.push(projectAId);
  await prisma.referenceListEntry.create({ data: { category: 'COUNTRY', name: COUNTRY } });

  adminId = (await createRawUser('admin', { organizationId: orgAId, role: 'ADMIN' })).id;
  const projectAdmin = await createRawUser('project-admin', { organizationId: orgAId, membership: 'PROJECT_ADMIN' });
  projectAdminId = projectAdmin.id;
  projectAdminMembershipId = projectAdmin.membershipId!;
  const executive = await createRawUser('executive', { organizationId: orgAId, membership: 'EXECUTIVE' });
  executiveId = executive.id;
  executiveMembershipId = executive.membershipId!;
  memberAId = (await createRawUser('member-a', { organizationId: orgAId, membership: 'NORMAL_USER' })).id;
  memberBId = (await createRawUser('member-b', { organizationId: orgBId, membership: 'NORMAL_USER' })).id;

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  const testUsers = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const ids = [...new Set([...userIds, ...testUsers.map((u) => u.id)])];
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const orgs = await prisma.organization.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  await prisma.opCo.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.referenceListEntry.deleteMany({
    where: { OR: [{ organizationId: { in: orgIds } }, { name: COUNTRY }] },
  });
  await prisma.questionnaireOrgSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe('projects (real DB)', () => {
  it('lists a project with its organizations and Project Admins', async () => {
    const project = (await listProjects()).find((p) => p.id === projectAId)!;
    expect(project.organizations.map((o) => o.name)).toEqual([ORG_A]);
    expect(project.projectAdmins.map((a) => a.email)).toEqual([email('project-admin')]);
  });

  it('keeps an organization in at most one project and deletes only empty projects', async () => {
    const other = await createProject(`${PREFIX}-project-other__`);
    await expect(updateProject(other.id, { organizationIds: [orgAId] })).rejects.toBeInstanceOf(
      OrganizationInOtherProjectError,
    );
    const withB = await updateProject(other.id, { organizationIds: [orgBId] });
    expect(withB.organizations.map((o) => o.id)).toEqual([orgBId]);
    await expect(deleteProject(other.id)).rejects.toBeInstanceOf(ProjectNotEmptyError);
    await updateProject(other.id, { organizationIds: [] });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: orgBId } })).projectId).toBeNull();
    await deleteProject(other.id);
  });

  it('imports a project with organizations, NatCos and members, and reuses them on a re-import', async () => {
    await createRawUser('existing', { organizationId: orgBId, membership: 'NORMAL_USER' });
    const input = {
      projectName: PROJECT_IMPORT,
      organizations: [ORG_IMPORT],
      natCos: [
        { organization: ORG_IMPORT, name: 'NatCo One', country: COUNTRY.toUpperCase() },
        { organization: ORG_IMPORT, name: 'NatCo Two', country: 'Atlantis-not-a-country' },
        { organization: 'Unlisted Org', name: 'NatCo Three', country: COUNTRY },
      ],
      members: [
        { organization: ORG_IMPORT, email: email('imp-pa'), role: 'PROJECT_ADMIN' as const },
        { organization: ORG_IMPORT, email: email('imp-exec'), role: 'EXECUTIVE' as const, firstName: 'Exa' },
        { organization: ORG_IMPORT, email: email('existing'), role: 'NORMAL_USER' as const }, // existing account
        { organization: ORG_IMPORT, email: email('admin'), role: 'NORMAL_USER' as const },
      ],
    };
    const first = await importProject(input, adminId);
    expect(first.project.name).toBe(PROJECT_IMPORT);
    expect(first.project.projectAdmins.map((a) => a.email)).toEqual([email('imp-pa')]);
    const byLabel = new Map(first.rows.map((r) => [`${r.sheet}:${r.label}`, r]));
    expect(byLabel.get(`Project:${ORG_IMPORT}`)?.status).toBe('created');
    expect(byLabel.get('NatCos:NatCo One')?.status).toBe('created');
    expect(byLabel.get('NatCos:NatCo Two')?.status).toBe('error');
    expect(byLabel.get('NatCos:NatCo Three')?.error).toMatch(/not listed on the Project sheet/);
    expect(byLabel.get(`Members:${email('imp-pa')}`)?.status).toBe('created');
    expect(byLabel.get(`Members:${email('imp-pa')}`)?.tempPassword).toBeTruthy();
    expect(byLabel.get(`Members:${email('existing')}`)?.status).toBe('membership-added');
    expect(byLabel.get(`Members:${email('existing')}`)?.tempPassword).toBeUndefined();
    expect(byLabel.get(`Members:${email('admin')}`)?.status).toBe('membership-added');

    const org = await prisma.organization.findFirstOrThrow({ where: { name: ORG_IMPORT }, include: { opCos: true } });
    expect(org.projectId).toBe(first.project.id);
    expect(org.opCos).toEqual([expect.objectContaining({ name: 'NatCo One', country: COUNTRY })]);
    // New organizations accept every questionnaire, like any other new organization.
    expect(await prisma.questionnaireOrgSetting.count({ where: { organizationId: org.id } })).toBeGreaterThan(0);

    const second = await importProject(
      { ...input, members: [...input.members, { organization: ORG_IMPORT, email: email('imp-exec'), role: 'NORMAL_USER' as const }] },
      adminId,
    );
    const statuses = second.rows.filter((r) => r.status !== 'error').map((r) => r.status);
    expect(statuses.every((s) => s === 'existing')).toBe(true);
    const roleClash = second.rows.filter((r) => r.label === email('imp-exec'));
    expect(roleClash.map((r) => r.status)).toEqual(['existing', 'error']);
    expect(await prisma.project.count({ where: { name: PROJECT_IMPORT } })).toBe(1);
  });

  it('refuses to move an organization that belongs to another project', async () => {
    const result = await importProject(
      { projectName: `${PREFIX}-project-thief__`, organizations: [ORG_A], natCos: [], members: [] },
      adminId,
    );
    expect(result.rows[0]).toMatchObject({ status: 'error', error: 'Organization already belongs to another project' });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: orgAId } })).projectId).toBe(projectAId);
  });
});

describe('Project Admin scoping over HTTP (real DB)', () => {
  it('keeps project management Application-Admin-only', async () => {
    expect((await api('GET', '/projects', asProjectAdmin())).status).toBe(403);
    expect((await api('GET', '/projects', asAdmin())).status).toBe(200);
  });

  it('lists only members of the own organization, with only their memberships there', async () => {
    await prisma.membership.create({ data: { userId: memberBId, organizationId: orgAId, role: 'NORMAL_USER' } });
    const { status, json } = await api('GET', '/users', asProjectAdmin());
    expect(status).toBe(200);
    const emails = json.map((u: { email: string }) => u.email);
    expect(emails).toContain(email('member-a'));
    expect(emails).toContain(email('member-b'));
    expect(emails).not.toContain(email('admin'));
    const memberB = json.find((u: { email: string }) => u.email === email('member-b'));
    expect(memberB.memberships.map((m: { organizationId: string }) => m.organizationId)).toEqual([orgAId]);
    await prisma.membership.deleteMany({ where: { userId: memberBId, organizationId: orgAId } });
  });

  it('adds Executives and Normal Users to the own organization only', async () => {
    const ok = await api('POST', '/users', asProjectAdmin(), {
      email: email('pa-created'),
      password: 'password123',
      role: 'EXECUTIVE',
      organizationId: orgAId,
    });
    expect(ok.status).toBe(201);
    const otherOrg = await api('POST', '/users', asProjectAdmin(), {
      email: email('pa-created-b'),
      password: 'password123',
      role: 'NORMAL_USER',
      organizationId: orgBId,
    });
    expect(otherOrg.status).toBe(403);
    const projectAdminRole = await api('POST', '/users', asProjectAdmin(), {
      email: email('pa-created-pa'),
      password: 'password123',
      role: 'PROJECT_ADMIN',
      organizationId: orgAId,
    });
    expect(projectAdminRole.status).toBe(403);
    const adminAccount = await api('POST', '/users', asProjectAdmin(), {
      email: email('admin'),
      password: 'password123',
      role: 'NORMAL_USER',
      organizationId: orgAId,
    });
    expect(adminAccount.status).toBe(403);
  });

  it('changes roles, removes memberships and generates temporary passwords only inside the project', async () => {
    const memberA = await prisma.membership.findFirstOrThrow({ where: { userId: memberAId, organizationId: orgAId } });
    const promote = await api('PATCH', `/users/${memberAId}/memberships/${memberA.id}`, asProjectAdmin(), { role: 'EXECUTIVE' });
    expect(promote.status).toBe(200);
    const toProjectAdmin = await api('PATCH', `/users/${memberAId}/memberships/${memberA.id}`, asProjectAdmin(), {
      role: 'PROJECT_ADMIN',
    });
    expect(toProjectAdmin.status).toBe(403);
    await api('PATCH', `/users/${memberAId}/memberships/${memberA.id}`, asProjectAdmin(), { role: 'NORMAL_USER' });

    const memberB = await prisma.membership.findFirstOrThrow({ where: { userId: memberBId } });
    expect((await api('DELETE', `/users/${memberBId}/memberships/${memberB.id}`, asProjectAdmin())).status).toBe(403);

    const temp = await api('POST', `/users/${memberAId}/temporary-password`, asProjectAdmin());
    expect(temp.status).toBe(200);
    expect(temp.json.temporaryPassword).toBeTruthy();
    expect((await api('POST', `/users/${memberBId}/temporary-password`, asProjectAdmin())).status).toBe(403);

    // Granting Admin and deleting accounts stay Application-Admin-only.
    expect((await api('PATCH', `/users/${memberAId}`, asProjectAdmin(), { role: 'ADMIN' })).status).toBe(403);
    expect((await api('DELETE', `/users/${memberAId}`, asProjectAdmin())).status).toBe(403);
  });

  it('manages NatCos and the accepting toggle of the own organization only', async () => {
    const natCoName = await api('POST', '/reference-lists/NATCO_NAME', asProjectAdmin(), {
      name: 'PA NatCo',
      organizationId: orgAId,
    });
    expect(natCoName.status).toBe(201);
    expect(
      (await api('POST', '/reference-lists/COUNTRY', asProjectAdmin(), { name: `${PREFIX}-x__` })).status,
    ).toBe(403);
    const opCo = await api('POST', '/opcos', asProjectAdmin(), { name: 'PA NatCo', country: COUNTRY, organizationId: orgAId });
    expect(opCo.status).toBe(201);
    expect(
      (await api('POST', '/opcos', asProjectAdmin(), { name: 'PA NatCo', country: COUNTRY, organizationId: orgBId })).status,
    ).toBe(403);
    const opCoB = await prisma.opCo.create({ data: { name: 'B NatCo', country: COUNTRY, organizationId: orgBId } });
    expect((await api('DELETE', `/opcos/${opCoB.id}`, asProjectAdmin())).status).toBe(404);
    expect((await api('DELETE', `/opcos/${opCo.json.id}`, asProjectAdmin())).status).toBe(204);

    const close = await api('PATCH', `/questionnaires/${QUESTIONNAIRE}/accepting`, asProjectAdmin(), {
      organizationId: orgAId,
      acceptingResponses: false,
    });
    expect(close.status).toBe(204);
    await api('PATCH', `/questionnaires/${QUESTIONNAIRE}/accepting`, asProjectAdmin(), {
      organizationId: orgAId,
      acceptingResponses: true,
    });
    const otherOrg = await api('PATCH', `/questionnaires/${QUESTIONNAIRE}/accepting`, asProjectAdmin(), {
      organizationId: orgBId,
      acceptingResponses: false,
    });
    expect(otherOrg.status).toBe(403);
  });

  it('sees the own organization with identities, excludes their own test answers, and resets them', async () => {
    await answerAllAndSubmit(memberAId, (await prisma.membership.findFirstOrThrow({ where: { userId: memberAId, organizationId: orgAId } })).id, 'A');
    const projectAdminResponseId = await answerAllAndSubmit(projectAdminId, projectAdminMembershipId, 'C');

    const summary = await api('GET', `/organizations/${orgAId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}`, asProjectAdmin());
    expect(summary.status).toBe(200);
    expect(summary.json.anonymized).toBe(false);
    const respondentEmails = summary.json.respondents.map((r: { email: string }) => r.email);
    expect(respondentEmails).toContain(email('member-a'));
    expect(respondentEmails).not.toContain(email('project-admin'));

    // Only member A's all-A answers count: the org average is their score, not a blend.
    const benchmark = await api('GET', `/organizations/${orgAId}/opco-benchmarking?questionnaireCode=${QUESTIONNAIRE}`, asProjectAdmin());
    const submitted = benchmark.json.rows.reduce((n: number, r: { submittedCount: number }) => n + r.submittedCount, 0);
    expect(submitted).toBe(1);
    const drilldown = await api('GET', `/organizations/${orgAId}/answer-drilldown?questionnaireCode=${QUESTIONNAIRE}`, asProjectAdmin());
    expect(JSON.stringify(drilldown.json)).not.toContain(email('project-admin'));
    expect(drilldown.json.entries.some((e: { option: string; respondents: unknown[] }) => e.option === 'C' && e.respondents.length > 0)).toBe(false);

    expect((await api('GET', `/organizations/${orgBId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}`, asProjectAdmin())).status).toBe(403);
    const executiveView = await api('GET', `/organizations/${orgAId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}`, asExecutive());
    expect(executiveView.json.anonymized).toBe(true);

    // Reset: Normal Users can't; the Project Admin can, and the response is gone.
    const memberAResponse = await prisma.questionnaireResponse.findFirstOrThrow({ where: { userId: memberAId } });
    const memberAMembership = await prisma.membership.findFirstOrThrow({ where: { userId: memberAId, organizationId: orgAId } });
    expect((await api('DELETE', `/responses/${memberAResponse.id}`, { userId: memberAId, membershipId: memberAMembership.id })).status).toBe(403);
    expect((await api('DELETE', `/responses/${projectAdminResponseId}`, { userId: memberAId, membershipId: memberAMembership.id })).status).toBe(403);
    expect((await api('DELETE', `/responses/${projectAdminResponseId}`, asProjectAdmin())).status).toBe(204);
    expect(await prisma.questionnaireResponse.findUnique({ where: { id: projectAdminResponseId } })).toBeNull();
  });
});

describe('questionnaires per project (real DB)', () => {
  const RAN = 'RAN_FM_GB1059A';
  const CORE_FM = 'CORE_FM_GB1059B';

  it('starts a new project with every questionnaire and rejects an invalid selection', async () => {
    const project = await createProject(`${PREFIX}-project-q__`);
    const activeCount = await prisma.questionnaire.count({ where: { isActive: true } });
    expect(project.questionnaireCodes).toHaveLength(activeCount);
    // Core FM without Core Stability splits the HVS group; empty and unknown are invalid too.
    for (const codes of [[CORE_FM], [], ['NOT_A_CODE']]) {
      await expect(updateProject(project.id, { questionnaireCodes: codes })).rejects.toBeInstanceOf(
        InvalidQuestionnaireSelectionError,
      );
    }
    const narrowed = await updateProject(project.id, { questionnaireCodes: [RAN, CORE_FM, QUESTIONNAIRE] });
    expect(narrowed.questionnaireCodes).toEqual([CORE_FM, QUESTIONNAIRE, RAN].sort());
    await deleteProject(project.id);
  });

  it('limits listings and new responses to the project questionnaires, keeping existing responses reachable', async () => {
    const existing = await api('POST', '/responses', asProjectAdmin(), { questionnaireCode: QUESTIONNAIRE });
    expect(existing.status).toBe(200);
    await updateProject(projectAId, { questionnaireCodes: [RAN] });

    const list = await api('GET', '/questionnaires', asProjectAdmin());
    expect(list.json.map((q: { code: string }) => q.code)).toEqual([RAN]);
    const hvs = await api('GET', '/questionnaires/hvs-entries', asExecutive());
    expect(hvs.json.map((h: { key: string }) => h.key)).toEqual([RAN]);
    const adminList = await api('GET', '/questionnaires', asAdmin());
    expect(adminList.json.length).toBeGreaterThan(1);
    // Organization B has no project: unrestricted.
    const memberB = await prisma.membership.findFirstOrThrow({ where: { userId: memberBId } });
    const listB = await api('GET', '/questionnaires', { userId: memberBId, membershipId: memberB.id });
    expect(listB.json.length).toBe(adminList.json.length);

    const refused = await api('POST', '/responses', asExecutive(), { questionnaireCode: CORE_FM });
    expect(refused.status).toBe(403);
    expect((await api('POST', '/responses', asExecutive(), { questionnaireCode: RAN })).status).toBe(200);
    const stillThere = await api('POST', '/responses', asProjectAdmin(), { questionnaireCode: QUESTIONNAIRE });
    expect(stillThere.json.id).toBe(existing.json.id);

    const all = await prisma.questionnaire.findMany({ where: { isActive: true }, select: { code: true } });
    await updateProject(projectAId, { questionnaireCodes: all.map((q) => q.code) });
  });

  it('imports a questionnaire selection by name, code or HVS group, expanding group members', async () => {
    const result = await importProject(
      {
        projectName: `${PREFIX}-project-qimport__`,
        organizations: [`${PREFIX}-org-qimport__`],
        questionnaires: ['ran fault management', 'Core Network Stability', 'Not a questionnaire'],
        natCos: [],
        members: [],
      },
      adminId,
    );
    const ranName = (await prisma.questionnaire.findUniqueOrThrow({ where: { code: RAN } })).name;
    expect(result.project.questionnaireCodes).toEqual([CORE_FM, QUESTIONNAIRE, RAN].sort());
    const qRows = result.rows.filter((r) => r.sheet === 'Questionnaires');
    expect(qRows.map((r) => r.status)).toEqual(['created', 'created', 'error']);
    expect(qRows[0]!.label).toBe(ranName);

    // Re-import without a Questionnaires sheet leaves the selection unchanged.
    const again = await importProject(
      { projectName: `${PREFIX}-project-qimport__`, organizations: [`${PREFIX}-org-qimport__`], natCos: [], members: [] },
      adminId,
    );
    expect(again.project.questionnaireCodes).toEqual(result.project.questionnaireCodes);
  });
});
