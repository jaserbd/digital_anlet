import type {
  ProjectAdminCandidateDto,
  ProjectDto,
  ProjectImportRequestDto,
  ProjectImportResultDto,
  UpdateProjectRequestDto,
} from '@anlet/shared';
import { apiClient } from './client';

// Application Admins only (PROJECTS_PLAN.md).
export const projectsApi = {
  list: () => apiClient.get<ProjectDto[]>('/projects'),
  create: (name: string) => apiClient.post<ProjectDto>('/projects', { name }),
  update: (id: string, input: UpdateProjectRequestDto) => apiClient.patch<ProjectDto>(`/projects/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/projects/${id}`),
  import: (input: ProjectImportRequestDto) => apiClient.post<ProjectImportResultDto>('/projects/import', input),
  // Project Admins per project (PROJECTS_V2_PLAN.md).
  projectAdminCandidates: () => apiClient.get<ProjectAdminCandidateDto[]>('/projects/project-admin-candidates'),
  addProjectAdmin: (id: string, userId: string) => apiClient.post<ProjectDto>(`/projects/${id}/project-admins`, { userId }),
  removeProjectAdmin: (id: string, userId: string) => apiClient.delete<ProjectDto>(`/projects/${id}/project-admins/${userId}`),
};
