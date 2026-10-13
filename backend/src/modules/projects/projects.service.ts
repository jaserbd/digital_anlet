import type {
  ProjectDto,
  ProjectImportRequestDto,
  ProjectImportResultDto,
  ProjectImportResultRowDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { generatePassword } from '../../lib/generatePassword';
import { createOrganization } from '../organizations/organizations.service';
import { HVS_GROUPS } from '../questionnaire/hvsGroups';
import { AlreadyMemberError, EmailTakenError, SuperAdminRequiredError, createUser } from '../users/users.service';

// Projects (PROJECTS_PLAN.md): a client engagement grouping organizations — normally one. Its
// Project Admins are simply the PROJECT_ADMIN memberships in its organizations, so nothing here
// stores admins separately. Application-Admin-only module.

export class ProjectNotFoundError extends Error {}
export class ProjectNameTakenError extends Error {}
export class ProjectNotEmptyError extends Error {}
export class OrganizationNotFoundError extends Error {}
export class OrganizationInOtherProjectError extends Error {}
export class InvalidQuestionnaireSelectionError extends Error {}

const PROJECT_SELECT = {
  id: true,
  name: true,
  questionnaires: { select: { questionnaire: { select: { code: true } } } },
  organizations: {
    select: {
      id: true,
      name: true,
      projectId: true,
      memberships: {
        where: { role: 'PROJECT_ADMIN' as const },
        select: { user: { select: { id: true, email: true } } },
      },
    },
    orderBy: { name: 'asc' as const },
  },
} as const;

type ProjectRow = NonNullable<Awaited<ReturnType<typeof findProjectRow>>>;

function findProjectRow(id: string) {
  return prisma.project.findUnique({ where: { id }, select: PROJECT_SELECT });
}

function toProjectDto(project: ProjectRow): ProjectDto {
  const admins = new Map<string, string>();
  for (const org of project.organizations) {
    for (const m of org.memberships) admins.set(m.user.id, m.user.email);
  }
  return {
    id: project.id,
    name: project.name,
    organizations: project.organizations.map((o) => ({ id: o.id, name: o.name, projectId: o.projectId })),
    projectAdmins: [...admins]
      .map(([userId, email]) => ({ userId, email }))
      .sort((a, b) => a.email.localeCompare(b.email)),
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

async function allActiveQuestionnaireIds(): Promise<string[]> {
  const questionnaires = await prisma.questionnaire.findMany({ where: { isActive: true }, select: { id: true } });
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
  // A new project starts with every questionnaire; narrow it down afterwards.
  const questionnaireIds = await allActiveQuestionnaireIds();
  const project = await prisma.project.create({
    data: { name, questionnaires: { create: questionnaireIds.map((questionnaireId) => ({ questionnaireId })) } },
  });
  return loadProjectDto(project.id);
}

/** Renames the project and/or replaces its organizations. An organization already in another
 * project must be removed from it first; organizations dropped here become project-less. */
export async function updateProject(
  id: string,
  input: { name?: string; organizationIds?: string[]; questionnaireCodes?: string[] },
): Promise<ProjectDto> {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ProjectNotFoundError();

  if (input.name !== undefined && input.name.toLowerCase() !== project.name.toLowerCase()) {
    if (await findProjectByName(input.name)) throw new ProjectNameTakenError();
  }

  if (input.organizationIds) {
    const organizations = await prisma.organization.findMany({
      where: { id: { in: input.organizationIds } },
      select: { id: true, projectId: true },
    });
    if (organizations.length !== new Set(input.organizationIds).size) throw new OrganizationNotFoundError();
    if (organizations.some((o) => o.projectId !== null && o.projectId !== id)) {
      throw new OrganizationInOtherProjectError();
    }
  }

  const questionnaireIds = input.questionnaireCodes
    ? await resolveQuestionnaireSelection(input.questionnaireCodes)
    : undefined;

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
    if (input.organizationIds) {
      await tx.organization.updateMany({
        where: { projectId: id, id: { notIn: input.organizationIds } },
        data: { projectId: null },
      });
      await tx.organization.updateMany({ where: { id: { in: input.organizationIds } }, data: { projectId: id } });
    }
  });
  return loadProjectDto(id);
}

/** Only an empty project (no organizations) can be deleted — organizations are never deleted with it. */
export async function deleteProject(id: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: { _count: { select: { organizations: true } } },
  });
  if (!project) throw new ProjectNotFoundError();
  if (project._count.organizations > 0) throw new ProjectNotEmptyError();
  await prisma.project.delete({ where: { id } });
}

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Excel project import (PROJECTS_PLAN.md): creates the project, its organizations, their
 * NatCos and member accounts in one go, reusing anything that already exists. Processed row by
 * row so one bad row (unknown country, organization in another project, ...) is reported
 * without aborting the rest; new accounts get a generated temporary password, returned once.
 */
export async function importProject(
  input: ProjectImportRequestDto,
  callerId: string,
): Promise<ProjectImportResultDto> {
  const rows: ProjectImportResultRowDto[] = [];

  const existingProject = await findProjectByName(input.projectName);
  const project = existingProject ?? (await createProject(input.projectName));

  // Questionnaires (sheet "Questionnaires", optional): names or codes of questionnaires or HVS
  // groups. Replaces the selection when given; otherwise a new project keeps all of them and an
  // existing one is left unchanged.
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
        : all.filter((q) => normalize(q.name) === key || normalize(q.code) === key);
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

  // Organizations (sheet "Project") — the only organizations NatCos and members may refer to.
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
      select: { id: true, name: true, projectId: true },
    });
    if (existing && existing.projectId !== null && existing.projectId !== project.id) {
      rows.push({ ...base, status: 'error', error: 'Organization already belongs to another project' });
      continue;
    }
    const organization = existing ?? (await createOrganization(name));
    await prisma.organization.update({ where: { id: organization.id }, data: { projectId: project.id } });
    orgIdByName.set(normalize(name), { id: organization.id, name: organization.name });
    rows.push({ ...base, label: organization.name, status: existing ? 'existing' : 'created' });
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

  // Members — Project Admin / Executive / Normal User memberships.
  for (const [index, member] of input.members.entries()) {
    const email = member.email.trim();
    const base = {
      sheet: 'Members' as const,
      row: index + 1,
      label: email,
      role: member.role,
      organization: member.organization,
    };
    const organization = resolveOrganization(member.organization);
    if (!organization) {
      rows.push({ ...base, status: 'error', error: unknownOrganization(member.organization) });
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
          where: { organizationId: organization.id, user: { email } },
          select: { role: true },
        });
        rows.push(
          membership?.role === member.role
            ? { ...base, organization: organization.name, status: 'existing' }
            : {
                ...base,
                organization: organization.name,
                status: 'error',
                error: `Already a member with another role (${membership?.role ?? 'unknown'}) — change it under Manage users`,
              },
        );
        continue;
      }
      const error =
        err instanceof EmailTakenError || err instanceof SuperAdminRequiredError
          ? 'This email belongs to an admin account'
          : 'Failed to create user';
      rows.push({ ...base, organization: organization.name, status: 'error', error });
    }
  }

  return { project: await loadProjectDto(project.id), rows };
}
