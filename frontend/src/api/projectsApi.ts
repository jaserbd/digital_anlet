import type {
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
};
