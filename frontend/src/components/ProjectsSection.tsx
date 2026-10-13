import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrganizationDto, ProjectDto, ProjectImportResultDto } from '@anlet/shared';
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
import { referenceListsApi } from '../api/referenceListsApi';
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
        A project is a client engagement — normally one organization with its NatCos. Its Project
        Admins (Detecon consultants) manage members, NatCos and open/close for that organization
        only, see its dashboard and can test-answer questionnaires (not counted in any results).
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
                <TableCell>Project Admins</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {projectsQuery.data?.map((project) => (
                <ProjectRow key={project.id} project={project} unassigned={unassigned} onSaved={refresh} />
              ))}
              {projectsQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>No projects yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CollapsibleTable>
      <ProjectImportForm onImported={refresh} />
    </SectionCard>
  );
}

function ProjectRow({
  project,
  unassigned,
  onSaved,
}: {
  project: ProjectDto;
  unassigned: OrganizationDto[];
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

const STATUS_LABELS: Record<ProjectImportResultDto['rows'][number]['status'], string> = {
  created: 'Created',
  existing: 'Already existed',
  'membership-added': 'Added to organization',
  error: 'Error',
};

function ProjectImportForm({ onImported }: { onImported: () => void }) {
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

  function handleDownloadResults() {
    if (!result) return;
    exportRowsToXlsx(`project-import-${result.project.name}`, [
      {
        name: 'Results',
        columns: [
          { header: 'Sheet', key: 'sheet' },
          { header: 'Organization', key: 'organization' },
          { header: 'Item', key: 'label' },
          { header: 'Role', key: 'role' },
          { header: 'Status', key: 'status' },
          { header: 'Temporary password', key: 'tempPassword' },
          { header: 'Error', key: 'error' },
        ],
        rows: result.rows.map((r) => ({
          ...r,
          role: r.role ? MEMBER_ROLE_LABELS[r.role] : '',
          status: STATUS_LABELS[r.status],
        })),
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
        Download the template, fill in the project, its organization(s), NatCos and members (Project
        Admin, Executive or Normal User), then upload it. New accounts get a temporary password —
        download the results afterwards to forward them.
      </Typography>
      <Button
        variant="text"
        onClick={() => downloadProjectTemplate((countriesQuery.data ?? []).map((c) => c.name))}
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
                <strong>{request.organizations.join(', ')}</strong>, {request.natCos.length} NatCo
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
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sheet</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Temporary password / error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={`${r.sheet}-${r.row}`}>
                    <TableCell>{r.sheet}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.role ? MEMBER_ROLE_LABELS[r.role] : ''}</TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_LABELS[r.status]} color={r.status === 'error' ? 'error' : 'success'} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: r.tempPassword ? 'monospace' : undefined }}>
                      {r.tempPassword ?? r.error ?? ''}
                    </TableCell>
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
