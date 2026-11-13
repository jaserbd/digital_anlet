import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { OrganizationDto, ProjectDto, QuestionnaireSummaryDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { projectsApi } from '../api/projectsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { questionnaireInitials } from '../lib/questionnaireInitials';
import { SectionCard } from './SectionCard';

// Application Admin's project dashboard (ADMIN_DASHBOARD_PLAN.md): every project at a glance,
// not as a table — as cards, or grouped by organization (e.g. yearly rounds of one client).
// Questionnaires show as Domain + HVS badges (RAN-FM, Core-ST, …) with the full name on hover.

type View = 'cards' | 'organizations';
const VIEW_STORAGE_KEY = 'anlet.projectDashboardView';

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'organizations' ? 'organizations' : 'cards';
  } catch {
    return 'cards';
  }
}

function saveView(view: View): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Not remembered — fine.
  }
}

export function ProjectDashboardSection() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const questionnairesQuery = useQuery({ queryKey: ['questionnaires'], queryFn: questionnaireApi.list });
  const [view, setView] = useState<View>(readView);

  const projects = projectsQuery.data ?? [];
  const questionnaires = questionnairesQuery.data ?? [];
  const organizationCount = new Set(projects.flatMap((p) => p.organizations.map((o) => o.id))).size;
  const total = (key: 'memberCount' | 'submittedResponses' | 'inProgressResponses') =>
    projects.reduce((sum, p) => sum + p[key], 0);

  return (
    <SectionCard
      title="Project dashboard"
      action={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, next: View | null) => {
            if (!next) return;
            setView(next);
            saveView(next);
          }}
          aria-label="Project dashboard view"
        >
          <ToggleButton value="cards">Cards</ToggleButton>
          <ToggleButton value="organizations">By organization</ToggleButton>
        </ToggleButtonGroup>
      }
    >
      {projectsQuery.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : projects.length === 0 ? (
        <Typography color="text.secondary">No projects yet — create one in the Management Console.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {projects.length} project{projects.length === 1 ? '' : 's'} · {organizationCount} organization
            {organizationCount === 1 ? '' : 's'} · {total('memberCount')} members · {total('submittedResponses')} submitted
            and {total('inProgressResponses')} in-progress assessments
          </Typography>
          {view === 'cards' ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} questionnaires={questionnaires} />
              ))}
            </Box>
          ) : (
            <ByOrganization projects={projects} questionnaires={questionnaires} />
          )}
        </>
      )}
    </SectionCard>
  );
}

function QuestionnaireBadges({ codes, questionnaires }: { codes: string[]; questionnaires: QuestionnaireSummaryDto[] }) {
  // Released first, then those in review; each in the questionnaire list's order.
  const selected = questionnaires
    .filter((q) => codes.includes(q.code))
    .sort((a, b) => Number(a.inReview) - Number(b.inReview));
  if (selected.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No questionnaires
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {selected.map((q) => (
        <Tooltip key={q.code} title={q.name}>
          <Chip
            size="small"
            label={questionnaireInitials(q)}
            color={q.inReview ? 'default' : 'primary'}
            variant={q.inReview ? 'outlined' : 'filled'}
            sx={{ fontWeight: 600 }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}

function ProgressLine({ project }: { project: ProjectDto }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {project.memberCount} member{project.memberCount === 1 ? '' : 's'} · {project.submittedResponses} submitted ·{' '}
      {project.inProgressResponses} in progress
    </Typography>
  );
}

function OrganizationChips({ organizations }: { organizations: OrganizationDto[] }) {
  const navigate = useNavigate();
  if (organizations.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No organization yet
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {organizations.map((o) => (
        <Chip key={o.id} size="small" variant="outlined" label={o.name} onClick={() => navigate(`/admin/organizations/${o.id}`)} />
      ))}
    </Box>
  );
}

function ProjectCard({ project, questionnaires }: { project: ProjectDto; questionnaires: QuestionnaireSummaryDto[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          Project
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
          {project.name}
        </Typography>
      </Box>
      <OrganizationChips organizations={project.organizations} />
      <QuestionnaireBadges codes={project.questionnaireCodes} questionnaires={questionnaires} />
      <ProgressLine project={project} />
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        Project Admins: {project.projectAdmins.length > 0 ? project.projectAdmins.map((a) => a.email).join(', ') : 'none yet'}
      </Typography>
    </Paper>
  );
}

function ByOrganization({ projects, questionnaires }: { projects: ProjectDto[]; questionnaires: QuestionnaireSummaryDto[] }) {
  const groups = new Map<string, { organization: OrganizationDto; projects: ProjectDto[] }>();
  for (const project of projects) {
    for (const organization of project.organizations) {
      const group = groups.get(organization.id) ?? { organization, projects: [] };
      group.projects.push(project);
      groups.set(organization.id, group);
    }
  }
  const withoutOrganization = projects.filter((p) => p.organizations.length === 0);
  const sorted = [...groups.values()].sort((a, b) => a.organization.name.localeCompare(b.organization.name));

  return (
    <Stack spacing={3}>
      {sorted.map(({ organization, projects: orgProjects }) => (
        <OrganizationGroup key={organization.id} title={organization.name} organizationId={organization.id} projects={orgProjects} questionnaires={questionnaires} />
      ))}
      {withoutOrganization.length > 0 && (
        <OrganizationGroup title="Without organization" projects={withoutOrganization} questionnaires={questionnaires} />
      )}
    </Stack>
  );
}

function OrganizationGroup({
  title,
  organizationId,
  projects,
  questionnaires,
}: {
  title: string;
  organizationId?: string;
  projects: ProjectDto[];
  questionnaires: QuestionnaireSummaryDto[];
}) {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, mb: 1, cursor: organizationId ? 'pointer' : undefined, display: 'inline-block' }}
        onClick={organizationId ? () => navigate(`/admin/organizations/${organizationId}`) : undefined}
      >
        {title}{' '}
        <Typography component="span" variant="body2" color="text.secondary">
          — {projects.length} project{projects.length === 1 ? '' : 's'}
        </Typography>
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
        {projects.map((project) => (
          <Paper key={project.id} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{project.name}</Typography>
            <QuestionnaireBadges codes={project.questionnaireCodes} questionnaires={questionnaires} />
            <ProgressLine project={project} />
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
