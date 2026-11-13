import type {
  ProjectImportMemberDto,
  ProjectMemberImportContextDto,
  ProjectMembersImportResultDto,
  ProjectQuestionnaireSelectionDto,
} from '@anlet/shared';
import { apiClient } from './client';

// Project Admins only (PROJECT_ADMIN_IMPORT_PLAN.md): the project of the active context.
export const projectMembersApi = {
  context: () => apiClient.get<ProjectMemberImportContextDto>('/project-members/context'),
  import: (members: ProjectImportMemberDto[]) =>
    apiClient.post<ProjectMembersImportResultDto>('/project-members/import', { members }),
  // The project's questionnaire selection (PROJECT_ADMIN_QUESTIONNAIRES_PLAN.md).
  questionnaires: () => apiClient.get<ProjectQuestionnaireSelectionDto>('/project-members/questionnaires'),
  setQuestionnaires: (questionnaireCodes: string[]) =>
    apiClient.put<ProjectQuestionnaireSelectionDto>('/project-members/questionnaires', { questionnaireCodes }),
};
