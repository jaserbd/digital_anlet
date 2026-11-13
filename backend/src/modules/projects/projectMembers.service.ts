import type {
  ProjectImportMemberDto,
  ProjectMemberImportContextDto,
  ProjectMembersImportResultDto,
} from '@anlet/shared';
import { prisma } from '../../lib/prisma';
import { ProjectNotFoundError } from './projects.service';
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
