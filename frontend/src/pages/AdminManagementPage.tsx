import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrganizationDto, Role, UpdateUserRequestDto, UserDto } from '@anlet/shared';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { organizationsApi } from '../api/organizationsApi';
import { opCoApi } from '../api/opCoApi';
import { usersApi } from '../api/usersApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { ApiError } from '../api/client';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { OrganizationAutocomplete } from '../components/OrganizationAutocomplete';
import { BulkCreateUsersForm } from '../components/BulkCreateUsersForm';
import { ReferenceListSelect } from '../components/ReferenceListSelect';
import { ManageReferenceListSection } from '../components/ManageReferenceListSection';
import { CollapsibleTable } from '../components/CollapsibleTable';
import Chip from '@mui/material/Chip';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, assignableRoles } from '../lib/roles';

// Management Console (ADMIN.md item 1) — create/delete for Organization, OpCo, and User, on
// its own route separate from /admin's Benchmarking/Organizations views. Delete is blocked
// (not cascaded) server-side whenever the target still has dependents (see
// organizations.service.ts/opcos.service.ts/users.service.ts's *HasDependentsError types) —
// the 409's message is surfaced inline, same ApiError-handling convention every create form
// here already uses.
export function AdminManagementPage() {
  const navigate = useNavigate();
  return (
    <PageShell title="Management Console" maxWidth={1400}>
      <Button onClick={() => navigate('/admin')} sx={{ mb: 3 }}>
        ← Back to Admin
      </Button>
      <ManageOrganizationsSection />
      <ManageReferenceListSection title="Countries" category="COUNTRY" />
      <ManageReferenceListSection title="Working Domains" category="WORKING_DOMAIN" />
      <ManageReferenceListSection title="Designations" category="DESIGNATION" />
      <ManageOpCosSection />
      <QuestionnaireSettingsSection />
      <CreateUserForm />
      <BulkCreateUsersForm />
      <ManageUsersSection />
    </PageShell>
  );
}

function ManageOrganizationsSection() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string } | null>(null);

  const createOrg = useMutation({
    mutationFn: () => organizationsApi.create(name),
    onSuccess: (org) => {
      setMessage({ kind: 'success', text: `Created organization "${org.name}"` });
      setName('');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err) => {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to create organization',
      });
    },
  });

  const deleteOrg = useMutation({
    mutationFn: (id: string) => organizationsApi.delete(id),
    onSuccess: () => {
      setRowMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (err, id) => {
      setRowMessage({
        id,
        text: err instanceof ApiError ? err.message : 'Failed to delete organization',
      });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createOrg.mutate();
  }

  function handleDelete(org: OrganizationDto) {
    if (!window.confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;
    setRowMessage(null);
    deleteOrg.mutate(org.id);
  }

  return (
    <SectionCard title="Organizations">
      <Stack component="form" onSubmit={handleSubmit} direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          required
          placeholder="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
        />
        <Button type="submit" variant="contained" disabled={createOrg.isPending}>
          {createOrg.isPending ? 'Creating…' : 'Create'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.kind === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <CollapsibleTable label="Organizations" count={orgsQuery.data?.length ?? 0}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {orgsQuery.data?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>{org.name}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={deleteOrg.isPending}
                      onClick={() => handleDelete(org)}
                    >
                      Delete
                    </Button>
                    {rowMessage?.id === org.id && (
                      <Typography component="span" variant="caption" color="error" sx={{ ml: 1 }}>
                        {rowMessage.text}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orgsQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>No organizations yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CollapsibleTable>
    </SectionCard>
  );
}

function ManageOpCosSection() {
  const queryClient = useQueryClient();
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string } | null>(null);

  const opCosQuery = useQuery({
    queryKey: ['opcos', organizationId],
    queryFn: () => opCoApi.list(organizationId),
    enabled: !!organizationId,
  });

  const createOpCo = useMutation({
    mutationFn: () => opCoApi.create({ name, country, organizationId }),
    onSuccess: (opCo) => {
      setMessage({ kind: 'success', text: `Created OpCo "${opCo.name}" (${opCo.country})` });
      setName('');
      setCountry('');
      void queryClient.invalidateQueries({ queryKey: ['opcos', organizationId] });
    },
    onError: (err) => {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to create OpCo',
      });
    },
  });

  const deleteOpCo = useMutation({
    mutationFn: (id: string) => opCoApi.delete(id),
    onSuccess: () => {
      setRowMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['opcos', organizationId] });
    },
    onError: (err, id) => {
      setRowMessage({ id, text: err instanceof ApiError ? err.message : 'Failed to delete OpCo' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createOpCo.mutate();
  }

  function handleDelete(opCo: { id: string; name: string }) {
    if (!window.confirm(`Delete OpCo "${opCo.name}"? This cannot be undone.`)) return;
    setRowMessage(null);
    deleteOpCo.mutate(opCo.id);
  }

  return (
    <SectionCard title="OpCos">
      <Stack spacing={2} sx={{ maxWidth: 360, mb: 2 }}>
        <TextField
          select
          label="Organization"
          required
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <MenuItem value="" disabled>
            {orgsQuery.isLoading ? 'Loading…' : 'Select an organization'}
          </MenuItem>
          {orgsQuery.data?.map((org) => (
            <MenuItem key={org.id} value={org.id}>
              {org.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {organizationId && (
        <ManageReferenceListSection
          title="NatCo Names for this organization"
          category="NATCO_NAME"
          organizationId={organizationId}
        />
      )}
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360, mb: 2 }}>
        <ReferenceListSelect
          category="NATCO_NAME"
          label="OpCo / NatCo name"
          organizationId={organizationId}
          required
          value={name}
          onChange={setName}
        />
        <ReferenceListSelect category="COUNTRY" required value={country} onChange={setCountry} />
        <Button
          type="submit"
          variant="contained"
          disabled={createOpCo.isPending || !organizationId}
        >
          {createOpCo.isPending ? 'Creating…' : 'Create OpCo'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.kind === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      {organizationId && (
        <CollapsibleTable label="OpCos" count={opCosQuery.data?.length ?? 0}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {opCosQuery.data?.map((opCo) => (
                  <TableRow key={opCo.id}>
                    <TableCell>{opCo.name}</TableCell>
                    <TableCell>{opCo.country}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        disabled={deleteOpCo.isPending}
                        onClick={() => handleDelete(opCo)}
                      >
                        Delete
                      </Button>
                      {rowMessage?.id === opCo.id && (
                        <Typography component="span" variant="caption" color="error" sx={{ ml: 1 }}>
                          {rowMessage.text}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {opCosQuery.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}>No OpCos for this organization yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CollapsibleTable>
      )}
    </SectionCard>
  );
}

// Admin-controlled open/close toggle per (questionnaire, organization) pair (THIRD_REVIEW.md
// item 7 — was a single global toggle; moved here from the main /admin page by ADMIN_2.md
// item 2, alongside the rest of this page's admin-setup actions). While accepting, users in
// that organization can edit and re-submit their responses at any time; once closed, every
// response for that organization locks permanently (matches the app's original behavior),
// independently of every other organization.
function QuestionnaireSettingsSection() {
  const queryClient = useQueryClient();
  const questionnairesQuery = useQuery({
    queryKey: ['questionnaires'],
    queryFn: questionnaireApi.list,
  });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });
  const [questionnaireCode, setQuestionnaireCode] = useState('');
  const [organization, setOrganization] = useState<OrganizationDto | null>(null);
  const effectiveCode = questionnaireCode || questionnairesQuery.data?.[0]?.code || '';

  const statusQuery = useQuery({
    queryKey: ['accepting-status', effectiveCode, organization?.id],
    queryFn: () => questionnaireApi.getAcceptingStatus(effectiveCode, organization!.id),
    enabled: !!effectiveCode && !!organization,
  });

  const toggleMutation = useMutation({
    mutationFn: (accepting: boolean) =>
      questionnaireApi.setAcceptingResponses(effectiveCode, organization!.id, accepting),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['accepting-status', effectiveCode, organization?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['questionnaire', effectiveCode] });
    },
  });

  if (questionnairesQuery.isLoading || orgsQuery.isLoading) {
    return (
      <SectionCard title="Questionnaire settings">
        <Typography color="text.secondary">Loading…</Typography>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Questionnaire settings">
      <Stack spacing={2} sx={{ maxWidth: 360, mb: 2 }}>
        <TextField
          select
          label="Assessment"
          value={effectiveCode}
          onChange={(e) => setQuestionnaireCode(e.target.value)}
        >
          {questionnairesQuery.data?.map((q) => (
            <MenuItem key={q.code} value={q.code}>
              {q.name}
            </MenuItem>
          ))}
        </TextField>
        <Stack spacing={0.5}>
          <Typography variant="body2" color="text.secondary">
            Organization
          </Typography>
          <OrganizationAutocomplete
            organizations={orgsQuery.data ?? []}
            onSelect={setOrganization}
          />
        </Stack>
      </Stack>
      {organization && statusQuery.data && (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
          <Typography>
            Status for <strong>{organization.name}</strong>:{' '}
            <strong>
              {statusQuery.data.acceptingResponses ? 'Accepting responses' : 'Closed'}
            </strong>
          </Typography>
          <Button
            variant="contained"
            color={statusQuery.data.acceptingResponses ? 'error' : 'primary'}
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(!statusQuery.data!.acceptingResponses)}
          >
            {toggleMutation.isPending
              ? 'Saving…'
              : statusQuery.data.acceptingResponses
                ? 'Close (lock all responses for this org)'
                : 'Reopen'}
          </Button>
        </Stack>
      )}
      <Typography variant="body2" color="text.secondary">
        Select an organization above to view/toggle its status for this assessment. While accepting,
        users in that organization can edit and re-submit their responses at any time; once closed,
        every response for that organization locks permanently — other organizations are unaffected.
      </Typography>
    </SectionCard>
  );
}

function CreateUserForm() {
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState<Role>('NORMAL_USER');
  const [organizationId, setOrganizationId] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const createUser = useMutation({
    mutationFn: () => usersApi.create({ email, password, role, organizationId }),
    onSuccess: (user) => {
      setMessage({ kind: 'success', text: `Created user "${user.email}"` });
      setEmail('');
      setPassword('');
    },
    onError: (err) => {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to create user',
      });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createUser.mutate();
  }

  return (
    <SectionCard title="Create user">
      <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 360 }}>
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          required
          slotProps={{ htmlInput: { minLength: 8 } }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          {assignableRoles(!!currentUser?.isSuperAdmin).map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Organization"
          required
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <MenuItem value="" disabled>
            {orgsQuery.isLoading ? 'Loading…' : 'Select an organization'}
          </MenuItem>
          {orgsQuery.data?.map((org) => (
            <MenuItem key={org.id} value={org.id}>
              {org.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          type="submit"
          variant="contained"
          disabled={createUser.isPending || !organizationId}
        >
          {createUser.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.kind === 'error' ? 'error' : 'success'} sx={{ mt: 2 }}>
          {message.text}
        </Alert>
      )}
    </SectionCard>
  );
}

// Admin can only create brand-new users elsewhere (CreateUserForm) — this lets Admin
// reassign an *existing* account's Organization (and OpCo) without recreating it
// (SECOND_REVIEW.md item 8), change its role, and delete it (ADMIN.md item 1). Reassigning
// org clears OpCo server-side (an OpCo belongs to a specific org), which naturally re-triggers
// profile completion for a NORMAL_USER on their next visit. Role changes follow
// ADMIN_MANAGEMENT_PLAN.md: Normal User <-> Executive for any admin; admin accounts (and
// granting Admin) for the super admin only; the super admin's own account is read-only.
function ManageUsersSection() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  return (
    <SectionCard title="Existing users">
      {usersQuery.isLoading || orgsQuery.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !usersQuery.data || !orgsQuery.data ? (
        <Typography color="text.secondary">Something went wrong loading users.</Typography>
      ) : (
        <CollapsibleTable label="Existing users" count={usersQuery.data.length}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>OpCo</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {usersQuery.data.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    organizations={orgsQuery.data!}
                    onSaved={() => void queryClient.invalidateQueries({ queryKey: ['users'] })}
                  />
                ))}
                {usersQuery.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No users yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CollapsibleTable>
      )}
    </SectionCard>
  );
}

function UserRow({
  user,
  organizations,
  onSaved,
}: {
  user: UserDto;
  organizations: OrganizationDto[];
  onSaved: () => void;
}) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = !!currentUser?.isSuperAdmin;
  // Read-only rows: the super admin account, the caller's own account, and — for a regular
  // admin — any other admin account. Mirrors users.service.ts's rules.
  const readOnly = user.isSuperAdmin || user.id === currentUser?.id || (user.role === 'ADMIN' && !isSuperAdmin);
  const [organizationId, setOrganizationId] = useState(user.organizationId);
  const [role, setRole] = useState<Role>(user.role);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const opCosQuery = useQuery({
    queryKey: ['opcos', organizationId],
    queryFn: () => opCoApi.list(organizationId),
  });

  const updateUser = useMutation({
    mutationFn: (input: UpdateUserRequestDto) => usersApi.update(user.id, input),
    onSuccess: () => {
      setMessage({ kind: 'success', text: 'Saved' });
      onSaved();
    },
    onError: (err) => {
      setMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Failed to save' });
    },
  });

  const deleteUser = useMutation({
    mutationFn: () => usersApi.delete(user.id),
    onSuccess: onSaved,
    onError: (err) => {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to delete user',
      });
    },
  });

  function handleDelete() {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setMessage(null);
    deleteUser.mutate();
  }

  const orgChanged = organizationId !== user.organizationId;
  const dirty = orgChanged || role !== user.role;

  return (
    <TableRow>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        {readOnly ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <span>{ROLE_LABELS[user.role]}</span>
            {user.isSuperAdmin && <Chip size="small" color="primary" label="Super admin" />}
          </Stack>
        ) : (
          <TextField
            select
            size="small"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            sx={{ minWidth: 140 }}
          >
            {assignableRoles(isSuperAdmin).map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
        )}
      </TableCell>
      <TableCell>
        <TextField
          select
          size="small"
          value={organizationId}
          disabled={readOnly}
          onChange={(e) => setOrganizationId(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          {organizations.map((org) => (
            <MenuItem key={org.id} value={org.id}>
              {org.name}
            </MenuItem>
          ))}
        </TextField>
      </TableCell>
      <TableCell>
        {orgChanged
          ? '— will be cleared —'
          : (opCosQuery.data?.find((o) => o.id === user.opCoId)?.name ?? '—')}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            size="small"
            variant="contained"
            disabled={readOnly || !dirty || updateUser.isPending}
            onClick={() => {
              setMessage(null);
              updateUser.mutate({
                ...(orgChanged ? { organizationId } : {}),
                ...(role !== user.role ? { role } : {}),
              });
            }}
          >
            {updateUser.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            disabled={readOnly || deleteUser.isPending}
            onClick={handleDelete}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </Button>
          {message && (
            <Typography
              component="span"
              variant="caption"
              color={message.kind === 'error' ? 'error' : 'success.main'}
            >
              {message.text}
            </Typography>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}
