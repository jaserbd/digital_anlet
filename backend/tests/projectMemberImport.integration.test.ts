import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/lib/jwt';
import { createApp } from '../src/app';
import { AUTH_COOKIE_NAME } from '../src/middleware/auth';
import { addProjectAdmin, createProject, importProject, updateProject } from '../src/modules/projects/projects.service';
import { labelKey } from '../src/modules/projects/memberImport';

// Integration test against the real local Postgres for PROJECT_ADMIN_IMPORT_PLAN.md: a Project
// Admin's Excel member import over HTTP (any organization of the project, NatCo / working domain /
// designation matching and creation, fill-empty-only) and the same columns on the Application
// Admin's project import.

const PREFIX = '__integration-test-pmi';
const ORG_A = `${PREFIX}-org-a__`;
const ORG_B = `${PREFIX}-org-b__`;
const ORG_OUT = `${PREFIX}-org-out__`; // not in the project
const COUNTRY = `${PREFIX}-country__`;
const DESIGNATION = `${PREFIX} Sr. Engineer`;
const WORKING_DOMAIN = `${PREFIX} RAN Ops`;

let server: Server;
let baseUrl: string;
let orgAId: string;
let orgBId: string;
let projectId: string;
let adminId: string;
let asProjectAdmin: { userId: string; membershipId: string };
let asExecutive: { userId: string; membershipId: string };

const email = (label: string) => `${PREFIX}-${label}__@example.com`;

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
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: res.status === 204 ? null : await res.json() };
}

function profileOf(label: string, organizationId: string) {
  return prisma.membership.findFirstOrThrow({
    where: { organizationId, projectId, user: { email: email(label) } },
    select: { role: true, workingDomain: true, designation: true, opCo: { select: { name: true, country: true } } },
  });
}

beforeAll(async () => {
  orgAId = (await prisma.organization.create({ data: { name: ORG_A } })).id;
  orgBId = (await prisma.organization.create({ data: { name: ORG_B } })).id;
  await prisma.organization.create({ data: { name: ORG_OUT } });
  await prisma.referenceListEntry.createMany({
    data: [
      { category: 'COUNTRY', name: COUNTRY },
      { category: 'DESIGNATION', name: DESIGNATION },
      { category: 'WORKING_DOMAIN', name: WORKING_DOMAIN },
    ],
  });
  await prisma.opCo.create({ data: { name: `${PREFIX} Kenya`, country: COUNTRY, organizationId: orgAId } });

  projectId = (await createProject(`${PREFIX}-project__`)).id;
  await updateProject(projectId, { organizationIds: [orgAId, orgBId] });

  const consultancy =
    (await prisma.organization.findFirst({ where: { name: 'Detecon' } })) ??
    (await prisma.organization.create({ data: { name: 'Detecon' } }));
  adminId = (
    await prisma.user.create({ data: { email: email('admin'), passwordHash: 'x', role: 'ADMIN', organizationId: orgAId } })
  ).id;
  const consultant = await prisma.user.create({
    data: {
      email: email('consultant'),
      passwordHash: 'x',
      role: 'NORMAL_USER',
      organizationId: consultancy.id,
      memberships: { create: { organizationId: consultancy.id, role: 'EXECUTIVE' } },
    },
  });
  await addProjectAdmin(projectId, consultant.id);
  asProjectAdmin = {
    userId: consultant.id,
    membershipId: (await prisma.membership.findFirstOrThrow({ where: { userId: consultant.id, organizationId: orgAId, projectId } })).id,
  };
  const executive = await prisma.user.create({
    data: {
      email: email('executive'),
      passwordHash: 'x',
      role: 'NORMAL_USER',
      organizationId: orgAId,
      memberships: { create: { organizationId: orgAId, projectId, role: 'EXECUTIVE', designation: 'Head of RAN' } },
    },
    include: { memberships: true },
  });
  asExecutive = { userId: executive.id, membershipId: executive.memberships[0]!.id };

  server = createApp().listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  const orgIds = (await prisma.organization.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } })).map((o) => o.id);
  await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.opCo.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.referenceListEntry.deleteMany({
    where: { OR: [{ organizationId: { in: orgIds } }, { name: { startsWith: PREFIX } }, { name: { startsWith: PREFIX.toUpperCase() } }] },
  });
  await prisma.questionnaireOrgSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.questionnaireProjectSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.projectOrganization.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe('labelKey', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(labelKey(' Sr. Engineer ')).toBe(labelKey('SR-ENGINEER'));
    expect(labelKey('sr  engineer')).toBe(labelKey('Sr_Engineer'));
    expect(labelKey('Engineer')).not.toBe(labelKey('Sr. Engineer'));
  });
});

describe('Project Admin member import over HTTP (real DB)', () => {
  it('describes the project with its organizations and NatCos', async () => {
    const { status, json } = await api('GET', '/project-members/context', asProjectAdmin);
    expect(status).toBe(200);
    expect(json.projectId).toBe(projectId);
    expect(json.organizations.map((o: { name: string }) => o.name)).toEqual([ORG_A, ORG_B]);
    expect(json.organizations[0].natCos).toEqual([{ name: `${PREFIX} Kenya`, country: COUNTRY }]);
  });

  it('imports into every organization of the project, matching and creating NatCos and list entries', async () => {
    const { status, json } = await api('POST', '/project-members/import', asProjectAdmin, {
      members: [
        // Existing NatCo / designation / working domain, spelled differently.
        {
          organization: ORG_A.toUpperCase(),
          email: email('eng-a'),
          role: 'NORMAL_USER',
          natCo: `${PREFIX.toUpperCase()}   kenya`,
          workingDomain: `${PREFIX} ran-ops`,
          designation: `${PREFIX.toUpperCase()} SR ENGINEER`,
        },
        // New NatCo (with country) in the other organization, a new designation in two spellings.
        { organization: ORG_B, email: email('eng-b'), role: 'EXECUTIVE', natCo: `${PREFIX} Ghana`, country: COUNTRY, designation: `${PREFIX} Lead  Architect` },
        { organization: ORG_B, email: email('eng-b2'), role: 'NORMAL_USER', natCo: `${PREFIX} ghana`, designation: `${PREFIX} lead-architect` },
        // Unknown NatCo without a country: created without NatCo, with a warning.
        { organization: ORG_A, email: email('eng-c'), role: 'NORMAL_USER', natCo: `${PREFIX} Atlantis` },
        { organization: ORG_OUT, email: email('outside'), role: 'NORMAL_USER' },
        { organization: ORG_A, email: email('admin'), role: 'EXECUTIVE' },
      ],
    });
    expect(status).toBe(201);
    const byEmail = Object.fromEntries(json.rows.map((r: { label: string }) => [r.label, r]));
    expect(byEmail[email('eng-a')]).toMatchObject({ status: 'created', organization: ORG_A });
    expect(byEmail[email('eng-a')].tempPassword).toBeTruthy();
    expect(byEmail[email('eng-b')]).toMatchObject({ status: 'created', organization: ORG_B });
    expect(byEmail[email('eng-c')]).toMatchObject({ status: 'created' });
    expect(byEmail[email('eng-c')].warning).toMatch(/does not exist — add its Country/);
    expect(byEmail[email('outside')]).toMatchObject({ status: 'error', error: expect.stringMatching(/is not in project/) });
    expect(byEmail[email('admin')]).toMatchObject({ status: 'error', error: 'This email belongs to an admin account' });

    expect(await profileOf('eng-a', orgAId)).toEqual({
      role: 'NORMAL_USER',
      workingDomain: WORKING_DOMAIN,
      designation: DESIGNATION,
      opCo: { name: `${PREFIX} Kenya`, country: COUNTRY },
    });
    const engB = await profileOf('eng-b', orgBId);
    expect(engB).toMatchObject({ role: 'EXECUTIVE', designation: `${PREFIX} Lead Architect`, opCo: { name: `${PREFIX} Ghana`, country: COUNTRY } });
    expect(await profileOf('eng-b2', orgBId)).toMatchObject({ designation: `${PREFIX} Lead Architect`, opCo: { name: `${PREFIX} Ghana` } });
    expect((await profileOf('eng-c', orgAId)).opCo).toBeNull();

    expect(await prisma.referenceListEntry.count({ where: { category: 'DESIGNATION', name: { startsWith: PREFIX, mode: 'insensitive' } } })).toBe(2);
    expect(await prisma.referenceListEntry.count({ where: { category: 'NATCO_NAME', organizationId: orgBId } })).toBe(1);
    expect(await prisma.opCo.count({ where: { organizationId: orgBId } })).toBe(1);
  });

  it('fills only empty profile fields of existing members', async () => {
    const { json } = await api('POST', '/project-members/import', asProjectAdmin, {
      members: [
        { organization: ORG_A, email: email('executive'), role: 'EXECUTIVE', workingDomain: WORKING_DOMAIN, designation: DESIGNATION },
        { organization: ORG_A, email: email('eng-a'), role: 'EXECUTIVE' },
      ],
    });
    expect(json.rows[0]).toMatchObject({ status: 'existing', warning: 'Kept the existing designation' });
    expect(await profileOf('executive', orgAId)).toMatchObject({ workingDomain: WORKING_DOMAIN, designation: 'Head of RAN' });
    expect(json.rows[1]).toMatchObject({ status: 'error', error: expect.stringMatching(/another role/) });
  });

  it('is for Project Admins only, with Executive / Normal User roles', async () => {
    const member = { organization: ORG_A, email: email('x'), role: 'EXECUTIVE' };
    expect((await api('POST', '/project-members/import', asExecutive, { members: [member] })).status).toBe(403);
    expect((await api('POST', '/project-members/import', { userId: adminId, membershipId: null }, { members: [member] })).status).toBe(403);
    expect(
      (await api('POST', '/project-members/import', asProjectAdmin, { members: [{ ...member, role: 'PROJECT_ADMIN' }] })).status,
    ).toBe(400);
    expect(await prisma.user.count({ where: { email: email('x') } })).toBe(0);
  });
});

describe('Application Admin project import with profile columns (real DB)', () => {
  it('fills NatCo, working domain and designation too', async () => {
    const result = await importProject(
      {
        projectName: `${PREFIX}-project__`,
        organizations: [ORG_A],
        natCos: [],
        members: [
          { organization: ORG_A, email: email('imported'), role: 'NORMAL_USER', natCo: `${PREFIX} KENYA`, designation: `${PREFIX} sr engineer` },
        ],
      },
      adminId,
    );
    expect(result.rows.find((r) => r.sheet === 'Members')).toMatchObject({ status: 'created', row: 1 });
    expect(await profileOf('imported', orgAId)).toMatchObject({ designation: DESIGNATION, opCo: { name: `${PREFIX} Kenya` } });
  });
});
