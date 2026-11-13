import { useQuery, useQueryClient } from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import { projectMembersApi } from '../api/projectMembersApi';
import { QuestionnaireSelection } from './QuestionnaireSelection';
import { SectionCard } from './SectionCard';

// A Project Admin's questionnaire selection for the project of the active context
// (PROJECT_ADMIN_QUESTIONNAIRES_PLAN.md): every questionnaire, in-review "(R)" ones included.
export function ProjectQuestionnairesSection() {
  const queryClient = useQueryClient();
  const selectionQuery = useQuery({ queryKey: ['project-members', 'questionnaires'], queryFn: projectMembersApi.questionnaires });
  const selection = selectionQuery.data;

  return (
    <SectionCard title="Questionnaires">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The assessments members of project <strong>{selection?.projectName ?? '…'}</strong> can answer, in every
        organization of the project. Assessments marked (R) are still in review at TM Forum. Deselecting one stops new
        responses; answers already given and their results stay available, and selecting it again brings it back.
      </Typography>
      {selection ? (
        <QuestionnaireSelection
          selectedCodes={selection.questionnaireCodes}
          hvsEntries={selection.entries}
          onSave={projectMembersApi.setQuestionnaires}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['project-members', 'questionnaires'] });
            // The Project Admin's own lists (dashboard and answering) follow the selection.
            void queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
            void queryClient.invalidateQueries({ queryKey: ['hvs-entries'] });
          }}
          showSelectedChips
        />
      ) : (
        <Typography color="text.secondary">Loading…</Typography>
      )}
    </SectionCard>
  );
}
