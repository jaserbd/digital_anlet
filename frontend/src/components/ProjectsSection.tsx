import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  HvsListItemDto,
  OrganizationDto,
  ProjectAdminCandidateDto,
  ProjectDto,
  ProjectImportResultDto,
} from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { projectsApi } from '../api/projectsApi';
import { organizationsApi } from '../api/organizationsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { ApiError } from '../api/client';
import {
  MEMBER_ROLE_LABELS,
  buildProjectTemplate,
  downloadWorkbook,
  readProjectWorkbook,
  type ParsedProjectWorkbook,
} from '../lib/projectTemplate';
import { useTemplateLists } from '../lib/templateLists';
import { ImportResults } from './ImportResults';
import { WelcomeEmailCheckbox } from './WelcomeEmailCheckbox';
import { useWelcomeEmailChoice } from '../lib/accountEmails';
import { QuestionnaireSelection } from './QuestionnaireSelection';
import { SectionCard } from './SectionCard';
import { CollapsibleTable } from './CollapsibleTable';

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// Projects (PROJECTS_PLAN.md) — Application Admins group client organizations into projects and
// import a whole project (organizations, NatCos, members with roles) from the Excel template.
// A project's Project Admins are its PROJECT_ADMIN memberships, managed under Existing users.
export function ProjectsSection() {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });
  // The Application Admin context lists every questionnaire, grouped as HVS items.
  const hvsQuery = useQuery({ queryKey: ['hvs-entries'], queryFn: questionnaireApi.listHvsEntries });
  const candidatesQuery = useQuery({ queryKey: ['project-admin-candidates'], queryFn: projectsApi.projectAdminCandidates });
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    void queryClient.invalidateQueries({ queryKey: ['users'] });
    void queryClient.invalidateQueries({ queryKey: ['project-admin-candidates'] });
  };

  const createProject = useMutation({
    mutationFn: () => projectsApi.create(name),
    onSuccess: (project) => {
      setMessage({ kind: 'success', text: `Created project "${project.name}"` });
      setName('');
      refresh();
    },
    onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Failed to create project') }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createProject.mutate();
  }


  return (
    <SectionCard title="Projects">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A project is a client engagement: its organizations (an organization can be in several
        projects, e.g. yearly rounds), questionnaires and members — answers are separate per project.
        Pick its Project Admins (Detecon consultants or Application Admins) here; they manage members,
        NatCos and open/close for this project only, see its dashboard and can test-answer
        questionnaires (not counted in any results).
      </Typography>
      <Stack component="form" onSubmit={handleSubmit} direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField required size="small" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="contained" disabled={createProject.isPending}>
          {createProject.isPending ? 'Creating…' : 'Create project'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.kind === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <CollapsibleTable label="Projects" count={projectsQuery.data?.length ?? 0}>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Organizations</TableCell>
                <TableCell>Questionnaires</TableCell>
                <TableCell>Project Admins</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {projectsQuery.data?.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  organizations={orgsQuery.data ?? []}
                  candidates={candidatesQuery.data ?? []}
                  hvsEntries={hvsQuery.data ?? []}
                  onSaved={refresh}
                />
              ))}
              {projectsQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>No projects yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CollapsibleTable>
      <ProjectImportForm hvsNames={(hvsQuery.data ?? []).map((e) => e.name)} onImported={refresh} />
    </SectionCard>
  );
}

function ProjectRow({
  project,
  organizations,
  candidates,
  hvsEntries,
  onSaved,
}: {
  project: ProjectDto;
  organizations: OrganizationDto[];
  candidates: ProjectAdminCandidateDto[];
  hvsEntries: HvsListItemDto[];
  onSaved: () => void;
}) {
  // Any organization can join any project (PROJECTS_V2_PLAN.md) — offer those not in this one.
  const unassigned = organizations.filter((o) => !project.organizations.some((po) => po.id === o.id));
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentIds = project.organizations.map((o) => o.id);

  const setOrganizations = useMutation({
    mutationFn: (organizationIds: string[]) => projectsApi.update(project.id, { organizationIds }),
    onSuccess: () => {
      setOrganizationId('');
      onSaved();
    },
    onError: (err) => setError(errorText(err, 'Failed to update project')),
  });
  const deleteProject = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: onSaved,
    onError: (err) => setError(errorText(err, 'Failed to delete project')),
  });

  return (
    <TableRow sx={{ verticalAlign: 'top' }}>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {project.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {project.memberCount} member{project.memberCount === 1 ? '' : 's'}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack spacing={1}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {project.organizations.map((o) => (
              <Chip
                key={o.id}
                size="small"
                label={o.name}
                onDelete={() => {
                  if (!window.confirm(`Remove "${o.name}" from project "${project.name}"?`)) return;
                  setError(null);
                  setOrganizations.mutate(currentIds.filter((id) => id !== o.id));
                }}
              />
            ))}
            {project.organizations.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No organization yet
              </Typography>
            )}
          </Stack>
          {unassigned.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                select
                size="small"
                label="Add organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                {unassigned.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                size="small"
                variant="contained"
                disabled={!organizationId || setOrganizations.isPending}
                onClick={() => {
                  setError(null);
                  setOrganizations.mutate([...currentIds, organizationId]);
                }}
              >
                Add
              </Button>
            </Stack>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <QuestionnaireSelection
          selectedCodes={project.questionnaireCodes}
          hvsEntries={hvsEntries}
          onSave={(questionnaireCodes) => projectsApi.update(project.id, { questionnaireCodes })}
          onSaved={onSaved}
        />
      </TableCell>
      <TableCell>
        <ProjectAdminsCell project={project} candidates={candidates} onSaved={onSaved} />
      </TableCell>
      <TableCell>
        <Button
          size="small"
          color="error"
          variant="outlined"
          disabled={project.organizations.length > 0 || deleteProject.isPending}
          title={project.organizations.length > 0 ? 'Remove its organizations first' : undefined}
          onClick={() => {
            if (window.confirm(`Delete project "${project.name}"?`)) deleteProject.mutate();
          }}
        >
          Delete
        </Button>
        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

// The project's Project Admins (PROJECTS_V2_PLAN.md): chips to remove, and a drop-down of
// Application Admins + Detecon members to add — no Excel needed for existing employees.
function ProjectAdminsCell({
  project,
  candidates,
  onSaved,
}: {
  project: ProjectDto;
  candidates: ProjectAdminCandidateDto[];
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => projectsApi.addProjectAdmin(project.id, userId),
    onSuccess: () => {
      setUserId('');
      onSaved();
    },
    onError: (err) => setError(errorText(err, 'Failed to add the Project Admin')),
  });
  const remove = useMutation({
    mutationFn: (adminId: string) => projectsApi.removeProjectAdmin(project.id, adminId),
    onSuccess: onSaved,
    onError: (err) => setError(errorText(err, 'Failed to remove the Project Admin')),
  });
  const available = candidates.filter((c) => !project.projectAdmins.some((a) => a.userId === c.userId));

  return (
    <Stack spacing={1} sx={{ minWidth: 240 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {project.projectAdmins.map((a) => (
          <Chip
            key={a.userId}
            size="small"
            label={a.email}
            onDelete={() => {
              if (window.confirm(`Remove ${a.email} as Project Admin of "${project.name}"? Their test answers in this project are deleted.`)) {
                setError(null);
                remove.mutate(a.userId);
              }
            }}
          />
        ))}
        {project.projectAdmins.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            None yet
          </Typography>
        )}
      </Stack>
      {project.organizations.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          Add an organization first
        </Typography>
      ) : (
        available.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Add Project Admin"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {available.map((c) => (
                <MenuItem key={c.userId} value={c.userId}>
                  {c.email}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="contained"
              disabled={!userId || add.isPending}
              onClick={() => {
                setError(null);
                add.mutate();
              }}
            >
              Add
            </Button>
          </Stack>
        )
      )}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  );
}

function ProjectImportForm({ hvsNames, onImported }: { hvsNames: string[]; onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateLists = useTemplateLists();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedProjectWorkbook | null>(null);
  const [result, setResult] = useState<ProjectImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { sendWelcome, setSendWelcome, mailEnabled } = useWelcomeEmailChoice();
  // Fixed at import time, so unticking afterwards doesn't stop the sending.
  const [welcomeOnImport, setWelcomeOnImport] = useState(false);

  const importProject = useMutation({
    mutationFn: () => projectsApi.import(parsed!.request!),
    onSuccess: (data) => {
      setResult(data);
      onImported();
    },
    onError: (err) => setError(errorText(err, 'Import failed')),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    try {
      setParsed(await readProjectWorkbook(file));
    } catch {
      setParsed(null);
      setError('Could not read this file as an Excel workbook');
    }
  }

  function handleReset() {
    setFileName(null);
    setParsed(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const request = parsed?.request;

  return (
    <Box component="section">
      <Typography variant="h6" sx={{ mb: 1 }}>
        Import a project from Excel
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Download the template, fill in the project, its organization(s), questionnaires, NatCos and
        members (Project Admin, Executive or Normal User), then upload it. New people get a welcome email with a
        link to set their password; anyone whose email isn&apos;t sent gets a temporary password in the results to
        forward instead.
      </Typography>
      <Button
        variant="text"
        onClick={() =>
          void buildProjectTemplate(templateLists, hvsNames).then((workbook) =>
            downloadWorkbook(workbook, 'anlet-project-template.xlsx'),
          )
        }
        sx={{ mb: 2, mr: 1 }}
      >
        Download Excel template
      </Button>
      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        {fileName ?? 'Choose Excel file'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => void handleFileChange(e)}
        />
      </Button>

      {parsed && !result && (
        <Box sx={{ mb: 2 }}>
          {parsed.errors.map((e) => (
            <Alert key={e} severity="error" sx={{ mb: 1 }}>
              {e}
            </Alert>
          ))}
          {parsed.skipped.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              These rows will be skipped:
              <ul style={{ margin: 0 }}>
                {parsed.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Alert>
          )}
          {request && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Project <strong>{request.projectName}</strong> — organization{request.organizations.length === 1 ? '' : 's'}{' '}
                <strong>{request.organizations.join(', ')}</strong>,{' '}
                {request.questionnaires
                  ? `${request.questionnaires.length} questionnaire${request.questionnaires.length === 1 ? '' : 's'} (${request.questionnaires.join(', ')})`
                  : 'all questionnaires (or the existing selection)'}
                , {request.natCos.length} NatCo
                {request.natCos.length === 1 ? '' : 's'}, {request.members.length} member
                {request.members.length === 1 ? '' : 's'} (
                {(Object.keys(MEMBER_ROLE_LABELS) as (keyof typeof MEMBER_ROLE_LABELS)[])
                  .map((role) => `${request.members.filter((m) => m.role === role).length} ${MEMBER_ROLE_LABELS[role]}`)
                  .join(', ')}
                ).
              </Typography>
              <WelcomeEmailCheckbox checked={sendWelcome} onChange={setSendWelcome} mailEnabled={mailEnabled} plural />
              <Button variant="contained" disabled={importProject.isPending} onClick={() => {
                  setWelcomeOnImport(sendWelcome);
                  importProject.mutate();
                }} sx={{ mr: 1 }}>
                {importProject.isPending ? 'Importing…' : 'Import project'}
              </Button>
            </>
          )}
          <Button variant="text" onClick={handleReset}>
            Cancel
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <ImportResults rows={result.rows} fileName={`project-import-${result.project.name}`} onReset={handleReset} sendWelcomeEmails={welcomeOnImport} />
      )}
    </Box>
  );
}
