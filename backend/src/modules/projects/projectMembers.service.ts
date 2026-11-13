import type {
  ProjectQuestionnaireSelectionDto,
  ProjectImportMemberDto,
  ProjectMemberImportContextDto,
  ProjectMembersImportResultDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { listHvsEntries } from '../questionnaire/questionnaire.service';
import { ProjectNotFoundError, updateProject } from './projects.service';
import { type ImportOrganization, importMembers, labelKey } from './memberImport';

// A Project Admin's Excel member import (PROJECT_ADMIN_IMPORT_PLAN.md): Executives and Normal
// Users into any organization of the project of their active context.

export async function getMemberImportContext(projectId: string): Promise<ProjectMemberImportContextDto> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      organizations: {
        select: {
          organization: {
            select: { id: true, name: true, opCos: { select: { name: true, country: true }, orderBy: { name: 'asc' } } },
          },
        },
      },
    },
  });
  if (!project) throw new ProjectNotFoundError();
  return {
    projectId: project.id,
    projectName: project.name,
    organizations: project.organizations
      .map(({ organization }) => ({ id: organization.id, name: organization.name, natCos: organization.opCos }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function importProjectMembers(
  projectId: string,
  members: ProjectImportMemberDto[],
  callerId: string,
): Promise<ProjectMembersImportResultDto> {
  const context = await getMemberImportContext(projectId);
  const organizations = new Map<string, ImportOrganization>(
    context.organizations.map((o) => [labelKey(o.name), { id: o.id, name: o.name }]),
  );
  const rows = await importMembers(members, {
    projectId,
    organizations,
    callerId,
    asProjectAdmin: true,
    unknownOrganization: (name) => `Organization "${name}" is not in project ${context.projectName}`,
  });
  return { projectName: context.projectName, rows };
}

// The project's questionnaires, chosen by its Project Admin (PROJECT_ADMIN_QUESTIONNAIRES_PLAN.md)
// out of every active questionnaire — in-review ones included — with the same rules as the
// Application Admin's selection (updateProject: at least one, HVS groups as a whole).
// Deselecting one keeps existing responses reachable.
export async function getProjectQuestionnaireSelection(projectId: string): Promise<ProjectQuestionnaireSelectionDto> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, questionnaires: { select: { questionnaire: { select: { code: true } } } } },
  });
  if (!project) throw new ProjectNotFoundError();
  return {
    projectName: project.name,
    entries: await listHvsEntries(null),
    questionnaireCodes: project.questionnaires.map((q) => q.questionnaire.code).sort(),
  };
}

export async function setProjectQuestionnaireSelection(
  projectId: string,
  questionnaireCodes: string[],
): Promise<ProjectQuestionnaireSelectionDto> {
  await updateProject(projectId, { questionnaireCodes });
  return getProjectQuestionnaireSelection(projectId);
}
