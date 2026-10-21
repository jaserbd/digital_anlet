import type {
  ProjectAdminCandidateDto,
  ProjectDto,
  ProjectImportRequestDto,
  ProjectImportResultDto,
  ProjectImportResultRowDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { generatePassword } from '../../lib/generatePassword';
import { createOrganization } from '../organizations/organizations.service';
import { HVS_GROUPS } from '../questionnaire/hvsGroups';
import {
  AlreadyMemberError,
  EmailTakenError,
  OtherOrganizationError,
  SuperAdminRequiredError,
  createUser,
} from '../users/users.service';

// Projects (PROJECTS_PLAN.md, PROJECTS_V2_PLAN.md): a client engagement with linked organizations
// (an organization can be in several projects), a questionnaire selection and memberships that
// belong to the project — so answers are separate per project. A Project Admin of a project holds
// a PROJECT_ADMIN membership in each of its organizations; they are added and removed here, as a
// whole. Application-Admin-only module.

export class ProjectNotFoundError extends Error {}
export class ProjectNameTakenError extends Error {}
export class ProjectNotEmptyError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class InvalidQuestionnaireSelectionError extends Error {}
// Removing an organization from a project whose members there already hold answers.
export class ProjectOrganizationHasAnswersError extends Error {}
export class NotProjectAdminCandidateError extends Error {}
export class ProjectHasNoOrganizationsError extends Error {}
// The person already takes part in the project with another role.
export class ProjectRoleConflictError extends Error {}

// Project Admins come from the consultancy: Application Admins and members of this organization.
export const CONSULTANCY_ORGANIZATION_NAME = 'Detecon';

// Same rule as users.service.ts: a response with something worth keeping.
const RESPONSE_WITH_DATA = {
  OR: [
    { status: 'SUBMITTED' as const },
    { answers: { some: {} } },
    { comments: { some: {} } },
    { keis: { some: {} } },
  ],
};

const PROJECT_SELECT = {
  id: true,
  name: true,
  questionnaires: { select: { questionnaire: { select: { code: true } } } },
  organizations: {
    select: { organization: { select: { id: true, name: true } } },
    orderBy: { organization: { name: 'asc' as const } },
  },
  memberships: { select: { role: true, user: { select: { id: true, email: true } } } },
} as const;

type ProjectRow = NonNullable<Awaited<ReturnType<typeof findProjectRow>>>;

function findProjectRow(id: string) {
  return prisma.project.findUnique({ where: { id }, select: PROJECT_SELECT });
}

function toProjectDto(project: ProjectRow): ProjectDto {
  const admins = new Map<string, string>();
  for (const m of project.memberships) {
    if (m.role === 'PROJECT_ADMIN') admins.set(m.user.id, m.user.email);
  }
  return {
    id: project.id,
    name: project.name,
    organizations: project.organizations.map((o) => o.organization),
    projectAdmins: [...admins]
      .map(([userId, email]) => ({ userId, email }))
      .sort((a, b) => a.email.localeCompare(b.email)),
    memberCount: project.memberships.filter((m) => m.role !== 'PROJECT_ADMIN').length,
    questionnaireCodes: project.questionnaires.map((q) => q.questionnaire.code).sort(),
  };
}

/**
 * Resolves a questionnaire selection to ids (PROJECT_QUESTIONNAIRES_PLAN.md): at least one
 * active questionnaire, and an HVS group (Core FM + Stability) all-or-nothing, since its
 * combined score and views need both halves.
 */
async function resolveQuestionnaireSelection(codes: string[]): Promise<string[]> {
  const unique = [...new Set(codes)];
  const questionnaires = await prisma.questionnaire.findMany({
    where: { code: { in: unique }, isActive: true },
    select: { id: true },
  });
  const splitsGroup = HVS_GROUPS.some((g) => {
    const selected = g.questionnaireCodes.filter((c) => unique.includes(c)).length;
    return selected > 0 && selected < g.questionnaireCodes.length;
  });
  if (unique.length === 0 || questionnaires.length !== unique.length || splitsGroup) {
    throw new InvalidQuestionnaireSelectionError();
  }
  return questionnaires.map((q) => q.id);
}

// The default for a new project: every active questionnaire except those still in review at
// TM Forum, which Admins enable per project (REVIEW_QUESTIONNAIRES_PLAN.md).
// "IP Change Management" matches the stored "IP Change Management (R)" too (seed.ts tags names).
function withoutReviewTag(name: string): string {
  return name.replace(/\s*\(R\)$/, '');
}

async function defaultQuestionnaireIds(): Promise<string[]> {
  const questionnaires = await prisma.questionnaire.findMany({
    where: { isActive: true, inReview: false },
    select: { id: true },
  });
  return questionnaires.map((q) => q.id);
}

async function loadProjectDto(id: string): Promise<ProjectDto> {
  const project = await findProjectRow(id);
  if (!project) throw new ProjectNotFoundError();
  return toProjectDto(project);
}

export async function listProjects(): Promise<ProjectDto[]> {
  const projects = await prisma.project.findMany({ select: PROJECT_SELECT, orderBy: { name: 'asc' } });
  return projects.map(toProjectDto);
}

function findProjectByName(name: string) {
  return prisma.project.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
}

export async function createProject(name: string): Promise<ProjectDto> {
  if (await findProjectByName(name)) throw new ProjectNameTakenError();
  // A new project starts with every questionnaire except those still in review; narrow it
  // down (or add those) afterwards.
  const questionnaireIds = await defaultQuestionnaireIds();
  const project = await prisma.project.create({
    data: { name, questionnaires: { create: questionnaireIds.map((questionnaireId) => ({ questionnaireId })) } },
  });
  return loadProjectDto(project.id);
}

async function projectAdminIds(projectId: string): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: { projectId, role: 'PROJECT_ADMIN' },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

/** Links an organization to a project; the project's Project Admins get the Project Admin role
 * there too. Idempotent. */
async function linkOrganization(projectId: string, organizationId: string): Promise<void> {
  const admins = await projectAdminIds(projectId);
  await prisma.$transaction([
    prisma.projectOrganization.createMany({ data: [{ projectId, organizationId }], skipDuplicates: true }),
    prisma.membership.createMany({
      data: admins.map((userId) => ({ userId, organizationId, projectId, role: 'PROJECT_ADMIN' as const })),
      skipDuplicates: true,
    }),
  ]);
}

/** Unlinks an organization from a project. Refused while its members in this project hold answers;
 * otherwise their memberships (with empty responses) and the per-project settings go too. */
async function unlinkOrganization(projectId: string, organizationId: string): Promise<void> {
  const scope = { projectId, organizationId };
  const withAnswers = await prisma.questionnaireResponse.count({
    where: { membership: scope, ...RESPONSE_WITH_DATA },
  });
  if (withAnswers > 0) throw new ProjectOrganizationHasAnswersError();
  await prisma.$transaction([
    prisma.questionnaireResponse.deleteMany({ where: { membership: scope } }),
    prisma.membership.deleteMany({ where: scope }),
    prisma.questionnaireProjectSetting.deleteMany({ where: scope }),
    prisma.projectOrganization.deleteMany({ where: scope }),
  ]);
}

/** Renames the project and/or replaces its organizations and questionnaire selection. */
export async function updateProject(
  id: string,
  input: { name?: string; organizationIds?: string[]; questionnaireCodes?: string[] },
): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true, organizations: { select: { organizationId: true } } },
  });
  if (!project) throw new ProjectNotFoundError();

  if (input.name !== undefined && input.name.toLowerCase() !== project.name.toLowerCase()) {
    if (await findProjectByName(input.name)) throw new ProjectNameTakenError();
  }

  if (input.organizationIds) {
    const wanted = [...new Set(input.organizationIds)];
    const found = await prisma.organization.count({ where: { id: { in: wanted } } });
    if (found !== wanted.length) throw new OrganizationNotFoundError();
  }

  const questionnaireIds = input.questionnaireCodes
    ? await resolveQuestionnaireSelection(input.questionnaireCodes)
    : undefined;

  if (input.organizationIds) {
    const current = project.organizations.map((o) => o.organizationId);
    for (const organizationId of current.filter((o) => !input.organizationIds!.includes(o))) {
      await unlinkOrganization(id, organizationId);
    }
    for (const organizationId of input.organizationIds.filter((o) => !current.includes(o))) {
      await linkOrganization(id, organizationId);
    }
  }

  await prisma.$transaction(async (tx) => {
    if (questionnaireIds) {
      await tx.projectQuestionnaire.deleteMany({ where: { projectId: id } });
      await tx.projectQuestionnaire.createMany({
        data: questionnaireIds.map((questionnaireId) => ({ projectId: id, questionnaireId })),
      });
    }
    if (input.name !== undefined) {
      await tx.project.update({ where: { id }, data: { name: input.name } });
    }
  });
  return loadProjectDto(id);
}

/** Only an empty project (no organizations, hence no members) can be deleted. */
export async function deleteProject(id: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { _count: { select: { organizations: true, memberships: true } } },
  });
  if (!project) throw new ProjectNotFoundError();
  if (project._count.organizations > 0 || project._count.memberships > 0) throw new ProjectNotEmptyError();
  await prisma.project.delete({ where: { id } });
}

/** Who can be picked as a Project Admin: Application Admins and Detecon's people (their own
 * organization — one per user, USERS_PER_ORGANIZATION_PLAN.md). */
export async function listProjectAdminCandidates(): Promise<ProjectAdminCandidateDto[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: 'ADMIN' }, { organization: { name: CONSULTANCY_ORGANIZATION_NAME } }],
    },
    select: { id: true, email: true },
    orderBy: { email: 'asc' },
  });
  return users.map((u) => ({ userId: u.id, email: u.email }));
}

/**
 * Makes someone Project Admin of a project: the Project Admin role in each of its organizations
 * (and, via linkOrganization, in organizations added later). Refused for people who aren't
 * Application Admins or Detecon members, for a project without organizations yet, and for someone
 * already taking part in the project with another role.
 */
export async function addProjectAdmin(projectId: string, userId: string): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizations: { select: { organizationId: true } } },
  });
  if (!project) throw new ProjectNotFoundError();
  if (project.organizations.length === 0) throw new ProjectHasNoOrganizationsError();
  if (!(await listProjectAdminCandidates()).some((c) => c.userId === userId)) {
    throw new NotProjectAdminCandidateError();
  }
  const otherRole = await prisma.membership.count({
    where: { userId, projectId, role: { not: 'PROJECT_ADMIN' } },
  });
  if (otherRole > 0) throw new ProjectRoleConflictError();
  await prisma.membership.createMany({
    data: project.organizations.map((o) => ({
      userId,
      organizationId: o.organizationId,
      projectId,
      role: 'PROJECT_ADMIN' as const,
    })),
    skipDuplicates: true,
  });
  return loadProjectDto(projectId);
}

/** Removes someone as Project Admin of a project, with their test answers there (never counted). */
export async function removeProjectAdmin(projectId: string, userId: string): Promise<ProjectDto> {
  const scope = { projectId, userId, role: 'PROJECT_ADMIN' as const };
  await prisma.$transaction([
    prisma.questionnaireResponse.deleteMany({ where: { membership: scope } }),
    prisma.membership.deleteMany({ where: scope }),
  ]);
  return loadProjectDto(projectId);
}

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Excel project import (PROJECTS_PLAN.md): creates or reuses the project, links its organizations
 * (creating missing ones), their NatCos and members of the project, reusing anything that already
 * exists. Project Admin rows make the person Project Admin of the whole project (a new person is
 * created as a Detecon member first). Processed row by row so one bad row is reported without
 * aborting the rest; new accounts get a generated temporary password, returned once.
 */
export async function importProject(
  input: ProjectImportRequestDto,
  callerId: string,
): Promise<ProjectImportResultDto> {
  const rows: ProjectImportResultRowDto[] = [];

  const existingProject = await findProjectByName(input.projectName);
  const project = existingProject ?? (await createProject(input.projectName));

  // Questionnaires (sheet "Questionnaires", optional): names or codes of questionnaires or HVS
  // groups. Replaces the selection when given; otherwise a new project keeps createProject's
  // default (every questionnaire except those in review, "(R)") and an existing one is unchanged.
  if (input.questionnaires && input.questionnaires.length > 0) {
    const all = await prisma.questionnaire.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
    const current = new Set(
      (await prisma.projectQuestionnaire.findMany({ where: { projectId: project.id } })).map((q) => q.questionnaireId),
    );
    const selected = new Map<string, string>(); // id -> code
    for (const [index, raw] of input.questionnaires.entries()) {
      const key = normalize(raw);
      const group = HVS_GROUPS.find((g) => normalize(g.groupName) === key || normalize(g.groupCode) === key);
      const matches = group
        ? all.filter((q) => group.questionnaireCodes.includes(q.code))
        : all.filter((q) => [q.name, withoutReviewTag(q.name), q.code].some((v) => normalize(v) === key));
      const base = { sheet: 'Questionnaires' as const, row: index + 1, label: group?.groupName ?? matches[0]?.name ?? raw.trim() };
      // A group's member listed on its own still selects the whole group (both halves are needed).
      const ownGroup = !group && matches[0] ? HVS_GROUPS.find((g) => g.questionnaireCodes.includes(matches[0]!.code)) : undefined;
      const expanded = ownGroup ? all.filter((q) => ownGroup.questionnaireCodes.includes(q.code)) : matches;
      if (expanded.length === 0) {
        rows.push({ ...base, status: 'error', error: `Unknown questionnaire "${raw.trim()}"` });
        continue;
      }
      for (const q of expanded) selected.set(q.id, q.code);
      const isNew = existingProject && expanded.some((q) => !current.has(q.id));
      rows.push({ ...base, status: isNew || !existingProject ? 'created' : 'existing' });
    }
    if (selected.size > 0) {
      await updateProject(project.id, { questionnaireCodes: [...selected.values()] });
    }
  }

  // Organizations (sheet "Project") — linked to the project (an organization can be in several
  // projects); the only organizations NatCos and members may refer to.
  const linked = new Set(
    (await prisma.projectOrganization.findMany({ where: { projectId: project.id } })).map((l) => l.organizationId),
  );
  const orgIdByName = new Map<string, { id: string; name: string }>();
  for (const [index, rawName] of input.organizations.entries()) {
    const name = rawName.trim();
    const base = { sheet: 'Project' as const, row: index + 1, label: name };
    if (orgIdByName.has(normalize(name))) {
      rows.push({ ...base, status: 'error', error: 'Listed twice' });
      continue;
    }
    const existing = await prisma.organization.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    const organization = existing ?? (await createOrganization(name));
    await linkOrganization(project.id, organization.id);
    orgIdByName.set(normalize(name), { id: organization.id, name: organization.name });
    rows.push({ ...base, label: organization.name, status: existing && linked.has(existing.id) ? 'existing' : 'created' });
  }

  const resolveOrganization = (name: string) => orgIdByName.get(normalize(name));
  const unknownOrganization = (name: string) => `Organization "${name}" is not listed on the Project sheet`;

  // NatCos — each one also needs its name in the organization's NatCo Name list, and its
  // country in the global Country list (the same catalogs the Management Console validates).
  const countries = await prisma.referenceListEntry.findMany({
    where: { category: 'COUNTRY', organizationId: null },
    select: { name: true },
  });
  const countryByName = new Map(countries.map((c) => [normalize(c.name), c.name]));
  for (const [index, natCo] of input.natCos.entries()) {
    const name = natCo.name.trim();
    const base = { sheet: 'NatCos' as const, row: index + 1, label: name, organization: natCo.organization };
    const organization = resolveOrganization(natCo.organization);
    if (!organization) {
      rows.push({ ...base, status: 'error', error: unknownOrganization(natCo.organization) });
      continue;
    }
    const country = countryByName.get(normalize(natCo.country));
    if (!country) {
      rows.push({ ...base, status: 'error', error: `Country "${natCo.country}" is not in the Country list` });
      continue;
    }
    const catalogEntry = await prisma.referenceListEntry.findFirst({
      where: { category: 'NATCO_NAME', organizationId: organization.id, name: { equals: name, mode: 'insensitive' } },
    });
    if (!catalogEntry) {
      await prisma.referenceListEntry.create({
        data: { category: 'NATCO_NAME', organizationId: organization.id, name },
      });
    }
    const natCoName = catalogEntry?.name ?? name;
    const existing = await prisma.opCo.findUnique({
      where: { organizationId_name: { organizationId: organization.id, name: natCoName } },
    });
    if (!existing) {
      await prisma.opCo.create({ data: { name: natCoName, country, organizationId: organization.id } });
    }
    rows.push({ ...base, label: natCoName, organization: organization.name, status: existing ? 'existing' : 'created' });
  }

  // Members — Executives / Normal Users of an organization in this project, and Project Admins of
  // the whole project.
  const consultancy = await prisma.organization.findFirst({
    where: { name: CONSULTANCY_ORGANIZATION_NAME },
    select: { id: true },
  });
  for (const [index, member] of input.members.entries()) {
    const email = member.email.trim();
    const base = { sheet: 'Members' as const, row: index + 1, label: email, role: member.role };

    if (member.role === 'PROJECT_ADMIN') {
      rows.push({ ...base, organization: input.projectName, ...(await importProjectAdmin(project.id, email, consultancy?.id, callerId)) });
      continue;
    }

    const organization = resolveOrganization(member.organization);
    if (!organization) {
      rows.push({ ...base, organization: member.organization, status: 'error', error: unknownOrganization(member.organization) });
      continue;
    }
    const password = generatePassword();
    try {
      const result = await createUser(
        {
          email,
          password,
          role: member.role,
          organizationId: organization.id,
          projectId: project.id,
          firstName: member.firstName?.trim() || undefined,
          lastName: member.lastName?.trim() || undefined,
        },
        callerId,
      );
      rows.push({
        ...base,
        organization: organization.name,
        status: result.status,
        ...(result.status === 'created' ? { tempPassword: password } : {}),
      });
    } catch (err) {
      if (err instanceof AlreadyMemberError) {
        const membership = await prisma.membership.findFirst({
          where: { organizationId: organization.id, projectId: project.id, user: { email } },
          select: { role: true },
        });
        rows.push(
          membership?.role === member.role
            ? { ...base, organization: organization.name, status: 'existing' }
            : {
                ...base,
                organization: organization.name,
                status: 'error',
                error: `Already in this project with another role (${membership?.role ?? 'unknown'}) — change it under Existing users`,
              },
        );
        continue;
      }
      const error =
        err instanceof EmailTakenError || err instanceof SuperAdminRequiredError
          ? 'This email belongs to an admin account'
          : err instanceof OtherOrganizationError
            ? `Already belongs to ${err.organizationName} — a user is in one organization only`
            : 'Failed to create user';
      rows.push({ ...base, organization: organization.name, status: 'error', error });
    }
  }

  return { project: await loadProjectDto(project.id), rows };
}

/** One Project Admin row of an import: creates the person as a Detecon member when new, then
 * makes them Project Admin of the project. */
async function importProjectAdmin(
  projectId: string,
  email: string,
  consultancyId: string | undefined,
  callerId: string,
): Promise<Pick<ProjectImportResultRowDto, 'status' | 'tempPassword' | 'error'>> {
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  let tempPassword: string | undefined;
  if (!user) {
    if (!consultancyId) {
      return { status: 'error', error: `Create the "${CONSULTANCY_ORGANIZATION_NAME}" organization first` };
    }
    tempPassword = generatePassword();
    const created = await createUser(
      { email, password: tempPassword, role: 'EXECUTIVE', organizationId: consultancyId, projectId: null },
      callerId,
    );
    user = { id: created.user.id };
  }
  const alreadyAdmin = await prisma.membership.count({ where: { userId: user.id, projectId, role: 'PROJECT_ADMIN' } });
  try {
    await addProjectAdmin(projectId, user.id);
  } catch (err) {
    const error =
      err instanceof NotProjectAdminCandidateError
        ? `Only Application Admins and ${CONSULTANCY_ORGANIZATION_NAME} members can be Project Admins`
        : err instanceof ProjectRoleConflictError
          ? 'Already in this project with another role'
          : err instanceof ProjectHasNoOrganizationsError
            ? 'The project has no organization yet'
            : 'Failed to add the Project Admin';
    return { status: 'error', error, tempPassword };
  }
  if (tempPassword) return { status: 'created', tempPassword };
  return { status: alreadyAdmin > 0 ? 'existing' : 'membership-added' };
}
