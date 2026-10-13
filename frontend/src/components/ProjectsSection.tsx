import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HvsListItemDto, OrganizationDto, ProjectDto, ProjectImportResultDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import { referenceListsApi } from '../api/referenceListsApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { ApiError } from '../api/client';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import {
  MEMBER_ROLE_LABELS,
  downloadProjectTemplate,
  readProjectWorkbook,
  type ParsedProjectWorkbook,
} from '../lib/projectTemplate';
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
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    void queryClient.invalidateQueries({ queryKey: ['organizations'] });
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

  const unassigned = (orgsQuery.data ?? []).filter((o) => !o.projectId);

  return (
    <SectionCard title="Projects">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        A project is a client engagement — normally one organization with its NatCos. Its members
        only see and answer the project&apos;s questionnaires. Its Project Admins (Detecon consultants)
        manage members, NatCos and open/close for that organization only, see its dashboard and can
        test-answer questionnaires (not counted in any results).
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
                  unassigned={unassigned}
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
  unassigned,
  hvsEntries,
  onSaved,
}: {
  project: ProjectDto;
  unassigned: OrganizationDto[];
  hvsEntries: HvsListItemDto[];
  onSaved: () => void;
}) {
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
      <TableCell sx={{ fontWeight: 600 }}>{project.name}</TableCell>
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
        <QuestionnaireSelection project={project} hvsEntries={hvsEntries} onSaved={onSaved} />
      </TableCell>
      <TableCell>
        {project.projectAdmins.length > 0 ? (
          project.projectAdmins.map((a) => (
            <Typography key={a.userId} variant="body2">
              {a.email}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            None yet
          </Typography>
        )}
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

// The project's questionnaires (PROJECT_QUESTIONNAIRES_PLAN.md), chosen per HVS item — Core
// Fault Management + Stability is one item, since the Core Domain score needs both halves.
function QuestionnaireSelection({
  project,
  hvsEntries,
  onSaved,
}: {
  project: ProjectDto;
  hvsEntries: HvsListItemDto[];
  onSaved: () => void;
}) {
  const isSelected = (entry: HvsListItemDto, codes: string[]) =>
    entry.questionnaireCodes.every((code) => codes.includes(code));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => projectsApi.update(project.id, { questionnaireCodes: draft }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (err) => setError(errorText(err, 'Failed to save questionnaires')),
  });

  const selected = hvsEntries.filter((e) => isSelected(e, project.questionnaireCodes));

  if (!editing) {
    return (
      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="text.secondary">
          {selected.length === hvsEntries.length ? `All (${hvsEntries.length})` : `${selected.length} of ${hvsEntries.length}`}
        </Typography>
        {selected.length < hvsEntries.length && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((e) => (
              <Chip key={e.key} size="small" label={e.name} />
            ))}
          </Stack>
        )}
        <Button
          size="small"
          onClick={() => {
            setDraft(project.questionnaireCodes);
            setError(null);
            setEditing(true);
          }}
        >
          Edit questionnaires
        </Button>
      </Stack>
    );
  }

  return (
    <Stack sx={{ alignItems: 'flex-start' }}>
      {hvsEntries.map((entry) => (
        <FormControlLabel
          key={entry.key}
          label={<Typography variant="body2">{entry.name}</Typography>}
          control={
            <Checkbox
              size="small"
              checked={isSelected(entry, draft)}
              onChange={(e) =>
                setDraft((current) =>
                  e.target.checked
                    ? [...new Set([...current, ...entry.questionnaireCodes])]
                    : current.filter((code) => !entry.questionnaireCodes.includes(code)),
                )
              }
            />
          }
        />
      ))}
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button size="small" variant="contained" disabled={draft.length === 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="small" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </Stack>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  );
}

const STATUS_LABELS: Record<ProjectImportResultDto['rows'][number]['status'], string> = {
  created: 'Created',
  existing: 'Already existed',
  'membership-added': 'Added to organization',
  error: 'Error',
};

const SETUP_ORDER: Record<ProjectImportResultDto['rows'][number]['sheet'], number> = {
  Project: 0,
  Questionnaires: 1,
  NatCos: 2,
  Members: 3,
};

const SETUP_TYPE_LABELS: Record<ProjectImportResultDto['rows'][number]['sheet'], string> = {
  Project: 'Organization',
  Questionnaires: 'Questionnaire',
  NatCos: 'NatCo',
  Members: 'User',
};

function statusLabel(row: ProjectImportResultDto['rows'][number]): string {
  if (row.sheet === 'Questionnaires' && row.status !== 'error') {
    return row.status === 'created' ? 'Selected' : 'Already selected';
  }
  return STATUS_LABELS[row.status];
}

function ProjectImportForm({ hvsNames, onImported }: { hvsNames: string[]; onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const countriesQuery = useQuery({
    queryKey: ['reference-lists', 'COUNTRY'],
    queryFn: () => referenceListsApi.list('COUNTRY'),
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedProjectWorkbook | null>(null);
  const [result, setResult] = useState<ProjectImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Results split into project setup (organizations, questionnaires, NatCos) and users
  // (USERS_TABLE_PLAN.md) — on screen and as two sheets in the downloaded workbook.
  const setupRows = result
    ? [...result.rows.filter((r) => r.sheet !== 'Members')].sort((a, b) => SETUP_ORDER[a.sheet] - SETUP_ORDER[b.sheet])
    : [];
  const userRows = result ? result.rows.filter((r) => r.sheet === 'Members') : [];

  function handleDownloadResults() {
    if (!result) return;
    exportRowsToXlsx(`project-import-${result.project.name}`, [
      {
        name: 'Users',
        columns: [
          { header: 'Email', key: 'label' },
          { header: 'Organization', key: 'organization' },
          { header: 'Role', key: 'role' },
          { header: 'Status', key: 'status' },
          { header: 'Temporary password', key: 'tempPassword' },
          { header: 'Error', key: 'error' },
        ],
        rows: userRows.map((r) => ({ ...r, role: r.role ? MEMBER_ROLE_LABELS[r.role] : '', status: statusLabel(r) })),
      },
      {
        name: 'Project setup',
        columns: [
          { header: 'Type', key: 'type' },
          { header: 'Name', key: 'label' },
          { header: 'Organization', key: 'organization' },
          { header: 'Status', key: 'status' },
          { header: 'Error', key: 'error' },
        ],
        rows: setupRows.map((r) => ({ ...r, type: SETUP_TYPE_LABELS[r.sheet], status: statusLabel(r) })),
      },
    ]);
  }

  const request = parsed?.request;

  return (
    <Box component="section">
      <Typography variant="h6" sx={{ mb: 1 }}>
        Import a project from Excel
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Download the template, fill in the project, its organization(s), questionnaires, NatCos and
        members (Project Admin, Executive or Normal User), then upload it. New accounts get a temporary password —
        download the results afterwards to forward them.
      </Typography>
      <Button
        variant="text"
        onClick={() =>
          downloadProjectTemplate(
            (countriesQuery.data ?? []).map((c) => c.name),
            hvsNames,
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
              <Button variant="contained" disabled={importProject.isPending} onClick={() => importProject.mutate()} sx={{ mr: 1 }}>
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
        <Box>
          <Alert severity="warning" sx={{ mb: 1 }}>
            Temporary passwords are shown only once — download the results now before leaving this page.
          </Alert>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
            Users
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Temporary password / error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userRows.map((r) => (
                  <TableRow key={`${r.sheet}-${r.row}`}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.organization ?? ''}</TableCell>
                    <TableCell>{r.role ? MEMBER_ROLE_LABELS[r.role] : ''}</TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(r)} color={r.status === 'error' ? 'error' : 'success'} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: r.tempPassword ? 'monospace' : undefined }}>
                      {r.tempPassword ?? r.error ?? ''}
                    </TableCell>
                  </TableRow>
                ))}
                {userRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No users in this file.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Project setup
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {setupRows.map((r) => (
                  <TableRow key={`${r.sheet}-${r.row}`}>
                    <TableCell>{SETUP_TYPE_LABELS[r.sheet]}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.sheet === 'NatCos' ? (r.organization ?? '') : ''}</TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(r)} color={r.status === 'error' ? 'error' : 'success'} />
                    </TableCell>
                    <TableCell>{r.error ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="outlined" onClick={handleDownloadResults} sx={{ mr: 1 }}>
            Download results (Excel)
          </Button>
          <Button variant="text" onClick={handleReset}>
            Import another file
          </Button>
        </Box>
      )}
    </Box>
  );
}
