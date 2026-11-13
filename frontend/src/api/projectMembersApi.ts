import type {
  ProjectImportMemberDto,
  ProjectMemberImportContextDto,
  ProjectMembersImportResultDto,
} from '@anlet/shared';
import { apiClient } from './client';

// Project Admins only (PROJECT_ADMIN_IMPORT_PLAN.md): the project of the active context.
export const projectMembersApi = {
  context: () => apiClient.get<ProjectMemberImportContextDto>('/project-members/context'),
  import: (members: ProjectImportMemberDto[]) =>
    apiClient.post<ProjectMembersImportResultDto>('/project-members/import', { members }),
};
