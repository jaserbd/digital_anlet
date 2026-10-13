import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/lib/jwt';
import { createApp } from '../src/app';
import { AUTH_COOKIE_NAME } from '../src/middleware/auth';
import { getOrCreateResponse, submitResponse, upsertAnswer } from '../src/modules/responses/responses.service';
import { getBenchmarkingSummary, getOrganizationQuestionnaireSummary } from '../src/modules/insights/insights.service';
import { getAcceptingResponses, setAcceptingResponses } from '../src/modules/questionnaire/questionnaire.service';
import {
  OrganizationNotInProjectError,
  ProjectRequiredError,
  addMembership,
} from '../src/modules/users/users.service';
import {
  CONSULTANCY_ORGANIZATION_NAME,
  InvalidQuestionnaireSelectionError,
  NotProjectAdminCandidateError,
  ProjectHasNoOrganizationsError,
  ProjectNotEmptyError,
  ProjectOrganizationHasAnswersError,
  addProjectAdmin,
  createProject,
  deleteProject,
  importProject,
  listProjectAdminCandidates,
  listProjects,
  removeProjectAdmin,
  updateProject,
} from '../src/modules/projects/projects.service';

// Integration test against the real local Postgres for PROJECTS_PLAN.md / PROJECTS_V2_PLAN.md:
// organizations in several projects, memberships (and answers) per project, project-level Project
// Admins, per-project open/close and benchmarking, the Excel import — plus Project Admin scoping
// through the real HTTP routes (most of it lives in the controllers), with signed session cookies.

const PREFIX = '__integration-test-projects';
const ORG_A = `${PREFIX}-org-a__`;
const ORG_B = `${PREFIX}-org-b__`;
const COUNTRY = `${PREFIX}-country__`;
const QUESTIONNAIRE = 'CORE_STABILITY_GB1059B'; // 7 questions, one synthetic sub-scenario, no KEIs
const RAN = 'RAN_FM_GB1059A';
const CORE_FM = 'CORE_FM_GB1059B';

let server: Server;
let baseUrl: string;
let orgAId: string;
let orgBId: string;
let consultancyId: string;
let createdConsultancy = false;
let projectAId: string; // orgA (+ orgB later)
let projectBId: string; // orgA too: a second assessment round of the same organization
let adminId: string;
let consultantId: string; // Detecon member → Project Admin of A
let outsiderId: string; // not a Project Admin candidate
let executiveId: string; // Executive of orgA in project A
let memberAId: string; // Normal User of orgA in project A
let memberBId: string; // Normal User of orgB outside projects (until orgB joins A)

const email = (label: string) => `${PREFIX}-${label}__@example.com`;

async function createRawUser(label: string, opts: { organizationId: string; role?: 'ADMIN' | 'NORMAL_USER' }) {
  const user = await prisma.user.create({
    data: { email: email(label), passwordHash: 'x', role: opts.role ?? 'NORMAL_USER', organizationId: opts.organizationId },
  });
  return user.id;
}

async function addRawMembership(
  userId: string,
  organizationId: string,
  projectId: string | null,
  role: 'NORMAL_USER' | 'EXECUTIVE' | 'PROJECT_ADMIN',
) {
  return (await prisma.membership.create({ data: { userId, organizationId, projectId, role } })).id;
}

function membershipOf(userId: string, organizationId: string, projectId: string | null) {
  return prisma.membership.findFirstOrThrow({ where: { userId, organizationId, projectId } });
}

async function api(
  method: string,
  path: string,
  as: { userId: string; membershipId: string | null },
  body?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosely-typed JSON assertions in tests
): Promise<{ status: number; json: any }> {
  const cookie = `${AUTH_COOKIE_NAME}=${signToken({ sub: as.userId, email: 'x', membershipId: as.membershipId })}`;
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

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
  const existingConsultancy = await prisma.organization.findFirst({ where: { name: CONSULTANCY_ORGANIZATION_NAME } });
  createdConsultancy = !existingConsultancy;
  consultancyId = (existingConsultancy ?? (await prisma.organization.create({ data: { name: CONSULTANCY_ORGANIZATION_NAME } }))).id;
  await prisma.referenceListEntry.create({ data: { category: 'COUNTRY', name: COUNTRY } });

  projectAId = (await createProject(`${PREFIX}-project-a__`)).id;
  projectBId = (await createProject(`${PREFIX}-project-b__`)).id;
  await updateProject(projectAId, { organizationIds: [orgAId] });
  await updateProject(projectBId, { organizationIds: [orgAId] });

  adminId = await createRawUser('admin', { organizationId: orgAId, role: 'ADMIN' });
  consultantId = await createRawUser('consultant', { organizationId: consultancyId });
  await addRawMembership(consultantId, consultancyId, null, 'EXECUTIVE');
  outsiderId = await createRawUser('outsider', { organizationId: orgAId });
  executiveId = await createRawUser('executive', { organizationId: orgAId });
  await addRawMembership(executiveId, orgAId, projectAId, 'EXECUTIVE');
  memberAId = await createRawUser('member-a', { organizationId: orgAId });
  await addRawMembership(memberAId, orgAId, projectAId, 'NORMAL_USER');
  memberBId = await createRawUser('member-b', { organizationId: orgBId });
  await addRawMembership(memberBId, orgBId, null, 'NORMAL_USER');

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await prisma.questionnaireResponse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  const orgs = await prisma.organization.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  if (createdConsultancy) orgIds.push(consultancyId);
  await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.opCo.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.referenceListEntry.deleteMany({ where: { OR: [{ organizationId: { in: orgIds } }, { name: COUNTRY }] } });
  await prisma.questionnaireOrgSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.questionnaireProjectSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.projectOrganization.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe('projects and organizations (real DB)', () => {
  it('lets an organization be in several projects, with members placed per project', async () => {
    const projects = (await listProjects()).filter((p) => p.name.startsWith(PREFIX));
    expect(projects.map((p) => p.organizations.map((o) => o.name))).toEqual([[ORG_A], [ORG_A]]);
    expect(projects.find((p) => p.id === projectAId)!.memberCount).toBe(2);

    // An organization in projects needs one of them; a project it isn't in is refused.
    await expect(addMembership(adminId, outsiderId, { organizationId: orgAId, role: 'NORMAL_USER' })).rejects.toBeInstanceOf(
      ProjectRequiredError,
    );
    await expect(
      addMembership(adminId, memberBId, { organizationId: orgBId, projectId: projectAId, role: 'NORMAL_USER' }),
    ).rejects.toBeInstanceOf(OrganizationNotInProjectError);

    // The same person can take part in both rounds of organization A.
    await addMembership(adminId, memberAId, { organizationId: orgAId, projectId: projectBId, role: 'EXECUTIVE' });
    const memberships = await prisma.membership.findMany({ where: { userId: memberAId }, orderBy: { createdAt: 'asc' } });
    expect(memberships.map((m) => [m.projectId, m.role])).toEqual([
      [projectAId, 'NORMAL_USER'],
      [projectBId, 'EXECUTIVE'],
    ]);
  });

  it('keeps answers, dashboards and open/close separate per project', async () => {
    const inA = await membershipOf(memberAId, orgAId, projectAId);
    const inB = await membershipOf(memberAId, orgAId, projectBId);
    const responseA = await answerAllAndSubmit(memberAId, inA.id, 'A');
    const responseB = await getOrCreateResponse({ sub: memberAId, membershipId: inB.id }, QUESTIONNAIRE);
    expect(responseB.id).not.toBe(responseA);

    const summaryA = await getOrganizationQuestionnaireSummary({ organizationId: orgAId, projectId: projectAId }, QUESTIONNAIRE);
    const summaryB = await getOrganizationQuestionnaireSummary({ organizationId: orgAId, projectId: projectBId }, QUESTIONNAIRE);
    expect(summaryA.respondents.find((r) => r.email === email('member-a'))?.status).toBe('SUBMITTED');
    expect(summaryB.respondents.find((r) => r.email === email('member-a'))?.status).toBe('IN_PROGRESS');
    expect(summaryB.respondents.map((r) => r.email)).not.toContain(email('executive'));

    const questionnaire = await prisma.questionnaire.findUniqueOrThrow({ where: { code: QUESTIONNAIRE } });
    await setAcceptingResponses(QUESTIONNAIRE, orgAId, false, projectAId);
    expect(await getAcceptingResponses(questionnaire.id, orgAId, projectAId)).toBe(false);
    expect(await getAcceptingResponses(questionnaire.id, orgAId, projectBId)).toBe(true);
    await setAcceptingResponses(QUESTIONNAIRE, orgAId, true, projectAId);

    // Benchmark rows are per project + organization.
    const rows = (await getBenchmarkingSummary(QUESTIONNAIRE)).rows.filter((r) => r.organizationName === ORG_A);
    expect(rows.map((r) => [r.projectName, r.submittedCount])).toEqual([
      [`${PREFIX}-project-a__`, 1],
      [`${PREFIX}-project-b__`, 0],
    ]);
  });

  it('refuses to unlink an organization whose members hold answers in the project', async () => {
    await expect(updateProject(projectAId, { organizationIds: [] })).rejects.toBeInstanceOf(ProjectOrganizationHasAnswersError);
    await expect(deleteProject(projectAId)).rejects.toBeInstanceOf(ProjectNotEmptyError);
  });
});

describe('project-level Project Admins (real DB)', () => {
  it('offers Application Admins and Detecon members as candidates only', async () => {
    const candidates = (await listProjectAdminCandidates()).map((c) => c.email);
    expect(candidates).toContain(email('admin'));
    expect(candidates).toContain(email('consultant'));
    expect(candidates).not.toContain(email('outsider'));
    await expect(addProjectAdmin(projectAId, outsiderId)).rejects.toBeInstanceOf(NotProjectAdminCandidateError);
    const empty = await createProject(`${PREFIX}-project-empty__`);
    await expect(addProjectAdmin(empty.id, consultantId)).rejects.toBeInstanceOf(ProjectHasNoOrganizationsError);
    await deleteProject(empty.id);
  });

  it('adds a Project Admin to every organization of one project only, including organizations added later', async () => {
    const project = await addProjectAdmin(projectAId, consultantId);
    expect(project.projectAdmins.map((a) => a.email)).toEqual([email('consultant')]);
    expect((await listProjects()).find((p) => p.id === projectBId)!.projectAdmins).toEqual([]);

    // Organization B joins project A: its members move in, and the Project Admin covers it too.
    const memberB = await membershipOf(memberBId, orgBId, null);
    await updateProject(projectAId, { organizationIds: [orgAId, orgBId] });
    await prisma.membership.update({ where: { id: memberB.id }, data: { projectId: projectAId } });
    const adminMemberships = await prisma.membership.findMany({ where: { userId: consultantId, role: 'PROJECT_ADMIN' } });
    expect(adminMemberships.map((m) => [m.organizationId, m.projectId]).sort()).toEqual(
      [
        [orgAId, projectAId],
        [orgBId, projectAId],
      ].sort(),
    );
  });

  it('removes a Project Admin from the project, with their test answers', async () => {
    const extra = await addProjectAdmin(projectAId, adminId);
    expect(extra.projectAdmins).toHaveLength(2);
    const membership = await membershipOf(adminId, orgAId, projectAId);
    const response = await getOrCreateResponse({ sub: adminId, membershipId: membership.id }, QUESTIONNAIRE);
    const after = await removeProjectAdmin(projectAId, adminId);
    expect(after.projectAdmins.map((a) => a.email)).toEqual([email('consultant')]);
    expect(await prisma.questionnaireResponse.findUnique({ where: { id: response.id } })).toBeNull();
  });

  it('imports a project with an existing organization, a new Project Admin (as a Detecon member) and members', async () => {
    const result = await importProject(
      {
        projectName: `${PREFIX}-project-import__`,
        organizations: [ORG_A, `${PREFIX}-org-import__`],
        questionnaires: ['ran fault management', 'Core Network Stability', 'Not a questionnaire'],
        natCos: [{ organization: `${PREFIX}-org-import__`, name: 'NatCo One', country: COUNTRY.toUpperCase() }],
        members: [
          { organization: '', email: email('new-consultant'), role: 'PROJECT_ADMIN' },
          { organization: '', email: email('consultant'), role: 'PROJECT_ADMIN' },
          { organization: '', email: email('outsider'), role: 'PROJECT_ADMIN' },
          { organization: ORG_A, email: email('member-a'), role: 'NORMAL_USER' },
          { organization: `${PREFIX}-org-import__`, email: email('imp-exec'), role: 'EXECUTIVE' },
        ],
      },
      adminId,
    );
    expect(result.project.organizations.map((o) => o.name).sort()).toEqual([ORG_A, `${PREFIX}-org-import__`].sort());
    expect(result.project.questionnaireCodes).toEqual([CORE_FM, QUESTIONNAIRE, RAN].sort());
    expect(result.project.projectAdmins.map((a) => a.email).sort()).toEqual([email('consultant'), email('new-consultant')].sort());
    const byLabel = new Map(result.rows.filter((r) => r.sheet === 'Members').map((r) => [r.label, r]));
    expect(byLabel.get(email('new-consultant'))).toMatchObject({ status: 'created', tempPassword: expect.any(String) });
    expect(byLabel.get(email('consultant'))?.status).toBe('membership-added');
    expect(byLabel.get(email('outsider'))?.status).toBe('error');
    expect(byLabel.get(email('member-a'))?.status).toBe('membership-added'); // a third project for member A
    expect(byLabel.get(email('imp-exec'))?.status).toBe('created');
    const newConsultant = await prisma.user.findUniqueOrThrow({ where: { email: email('new-consultant') }, include: { memberships: true } });
    expect(newConsultant.memberships.some((m) => m.organizationId === consultancyId && m.projectId === null)).toBe(true);
    expect(result.rows.filter((r) => r.sheet === 'Questionnaires').map((r) => r.status)).toEqual(['created', 'created', 'error']);

    // Re-import without a Questionnaires sheet leaves the selection unchanged.
    const again = await importProject(
      { projectName: `${PREFIX}-project-import__`, organizations: [ORG_A], natCos: [], members: [] },
      adminId,
    );
    expect(again.project.questionnaireCodes).toEqual(result.project.questionnaireCodes);
  });

  it('rejects an invalid questionnaire selection', async () => {
    for (const codes of [[CORE_FM], [], ['NOT_A_CODE']]) {
      await expect(updateProject(projectBId, { questionnaireCodes: codes })).rejects.toBeInstanceOf(
        InvalidQuestionnaireSelectionError,
      );
    }
  });
});

describe('Project Admin scoping over HTTP (real DB)', () => {
  const asAdmin = () => ({ userId: adminId, membershipId: null });
  let asProjectAdmin: { userId: string; membershipId: string };
  let asExecutive: { userId: string; membershipId: string };

  beforeAll(async () => {
    asProjectAdmin = { userId: consultantId, membershipId: (await membershipOf(consultantId, orgAId, projectAId)).id };
    asExecutive = { userId: executiveId, membershipId: (await membershipOf(executiveId, orgAId, projectAId)).id };
  });

  it('keeps project management Application-Admin-only', async () => {
    expect((await api('GET', '/projects', asProjectAdmin)).status).toBe(403);
    expect((await api('POST', `/projects/${projectAId}/project-admins`, asProjectAdmin, { userId: consultantId })).status).toBe(403);
    expect((await api('GET', '/projects/project-admin-candidates', asAdmin())).status).toBe(200);
  });

  it('lists only members of the own organization and project', async () => {
    const { status, json } = await api('GET', '/users', asProjectAdmin);
    expect(status).toBe(200);
    const emails = json.map((u: { email: string }) => u.email);
    expect(emails).toContain(email('executive'));
    expect(emails).toContain(email('member-a'));
    const memberA = json.find((u: { email: string }) => u.email === email('member-a'));
    expect(memberA.memberships.map((m: { projectId: string }) => m.projectId)).toEqual([projectAId]);
  });

  it('adds Executives and Normal Users to the own organization + project only', async () => {
    const add = (projectId: string, role = 'EXECUTIVE', label = 'pa-created') =>
      api('POST', '/users', asProjectAdmin, { email: email(label), password: 'password123', role, organizationId: orgAId, projectId });
    expect((await add(projectAId)).status).toBe(201);
    expect((await add(projectBId, 'EXECUTIVE', 'pa-created-b')).status).toBe(403);
    expect((await add(projectAId, 'ADMIN', 'pa-created-admin')).status).toBe(403);
  });

  it('manages members and temporary passwords only inside the project, and never moves them', async () => {
    const memberA = await membershipOf(executiveId, orgAId, projectAId);
    expect((await api('PATCH', `/users/${executiveId}/memberships/${memberA.id}`, asProjectAdmin, { role: 'NORMAL_USER' })).status).toBe(200);
    expect((await api('PATCH', `/users/${executiveId}/memberships/${memberA.id}`, asProjectAdmin, { role: 'EXECUTIVE' })).status).toBe(200);
    expect(
      (await api('PATCH', `/users/${executiveId}/memberships/${memberA.id}`, asProjectAdmin, { organizationId: orgAId, projectId: projectBId })).status,
    ).toBe(403);
    // Member A also takes part in project B (and the import project) — outside this Project Admin's scope.
    expect((await api('POST', `/users/${memberAId}/temporary-password`, asProjectAdmin)).status).toBe(403);
    expect((await api('POST', `/users/${executiveId}/temporary-password`, asProjectAdmin)).status).toBe(200);
    // Project Admin memberships are managed on the project, not in the users table.
    const consultantInA = await membershipOf(consultantId, orgAId, projectAId);
    expect((await api('DELETE', `/users/${consultantId}/memberships/${consultantInA.id}`, asAdmin())).status).toBe(400);
  });

  it('toggles open/close for the own organization + project only', async () => {
    const toggle = (projectId: string) =>
      api('PATCH', `/questionnaires/${QUESTIONNAIRE}/accepting`, asProjectAdmin, { organizationId: orgAId, projectId, acceptingResponses: true });
    expect((await toggle(projectAId)).status).toBe(204);
    expect((await toggle(projectBId)).status).toBe(403);
  });

  it('shows dashboards for the active project only, with identities, excluding Project Admin answers', async () => {
    await answerAllAndSubmit(consultantId, asProjectAdmin.membershipId, 'C');
    // The projectId query param is ignored for non-admins: the active membership decides.
    const summary = await api(
      'GET',
      `/organizations/${orgAId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}&projectId=${projectBId}`,
      asProjectAdmin,
    );
    expect(summary.status).toBe(200);
    expect(summary.json.anonymized).toBe(false);
    const statusOf = (who: string) => summary.json.respondents.find((r: { email: string }) => r.email === email(who))?.status;
    expect(statusOf('member-a')).toBe('SUBMITTED'); // project A's answer, not project B's in-progress one
    expect(statusOf('consultant')).toBeUndefined();
    const executiveView = await api('GET', `/organizations/${orgAId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}`, asExecutive);
    expect(executiveView.json.anonymized).toBe(true);

    const adminViewB = await api(
      'GET',
      `/organizations/${orgAId}/questionnaire-summary?questionnaireCode=${QUESTIONNAIRE}&projectId=${projectBId}`,
      asAdmin(),
    );
    expect(adminViewB.json.respondents.find((r: { email: string }) => r.email === email('member-a'))?.status).toBe('IN_PROGRESS');
  });

  it('limits questionnaires to the project selection, keeping existing responses reachable', async () => {
    const existing = await api('POST', '/responses', asProjectAdmin, { questionnaireCode: QUESTIONNAIRE });
    expect(existing.status).toBe(200);
    await updateProject(projectAId, { questionnaireCodes: [RAN] });
    expect((await api('GET', '/questionnaires', asProjectAdmin)).json.map((q: { code: string }) => q.code)).toEqual([RAN]);
    expect((await api('GET', '/questionnaires/hvs-entries', asExecutive)).json.map((h: { key: string }) => h.key)).toEqual([RAN]);
    expect((await api('GET', '/questionnaires', asAdmin())).json.length).toBeGreaterThan(1);
    expect((await api('POST', '/responses', asExecutive, { questionnaireCode: CORE_FM })).status).toBe(403);
    expect((await api('POST', '/responses', asProjectAdmin, { questionnaireCode: QUESTIONNAIRE })).json.id).toBe(existing.json.id);
    const all = await prisma.questionnaire.findMany({ where: { isActive: true }, select: { code: true } });
    await updateProject(projectAId, { questionnaireCodes: all.map((q) => q.code) });
  });

  it('lets only Application Admins and Project Admins reset their own answers', async () => {
    const memberAInA = await membershipOf(memberAId, orgAId, projectAId);
    const memberResponse = await prisma.questionnaireResponse.findFirstOrThrow({ where: { membershipId: memberAInA.id } });
    expect((await api('DELETE', `/responses/${memberResponse.id}`, { userId: memberAId, membershipId: memberAInA.id })).status).toBe(403);
    const ownResponse = await prisma.questionnaireResponse.findFirstOrThrow({ where: { membershipId: asProjectAdmin.membershipId } });
    expect((await api('DELETE', `/responses/${ownResponse.id}`, asProjectAdmin)).status).toBe(204);
  });
});
