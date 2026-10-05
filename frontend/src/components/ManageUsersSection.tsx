import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MembershipDto, OrganizationDto, Role, UserDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
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
import { organizationsApi } from '../api/organizationsApi';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../lib/roles';
import { SectionCard } from './SectionCard';
import { CollapsibleTable } from './CollapsibleTable';

type MembershipRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;
const MEMBERSHIP_ROLES: MembershipRole[] = ['NORMAL_USER', 'EXECUTIVE'];

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

// Existing users (MULTI_ORG_PLAN.md): each user's organizations and roles (memberships) can be
// added, changed and removed; the global Admin role is granted/removed by the super admin only;
// any admin can generate a temporary password (admin_management.md line 12). The permission
// rules mirror users.service.ts, which enforces them server-side.
export function ManageUsersSection() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  return (
    <SectionCard title="Existing users">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        A user can belong to several organizations, with one role in each. Users with more than
        one organization choose where to work after logging in.
      </Typography>
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
                  <TableCell>Admin</TableCell>
                  <TableCell>Organizations &amp; roles</TableCell>
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
                    <TableCell colSpan={4}>No users yet.</TableCell>
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
  const isSelf = user.id === currentUser?.id;
  const isAdminAccount = user.role === 'ADMIN';
  // Memberships of an admin account: super admin or that admin themself (users.service.ts).
  const canManageMemberships = !isAdminAccount || isSuperAdmin || isSelf;
  const canGrantAdmin = isSuperAdmin && !user.isSuperAdmin && !isSelf;
  const canResetPassword = !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin);
  const canDelete = !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin);

  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  function handleError(fallback: string) {
    return (err: unknown) => setMessage({ kind: 'error', text: errorText(err, fallback) });
  }

  const updateRole = useMutation({
    mutationFn: (role: Role) => usersApi.update(user.id, { role }),
    onSuccess: onSaved,
    onError: handleError('Failed to change admin role'),
  });
  const resetPassword = useMutation({
    mutationFn: () => usersApi.temporaryPassword(user.id),
    onSuccess: (data) => setTemporaryPassword(data.temporaryPassword),
    onError: handleError('Failed to generate a temporary password'),
  });
  const deleteUser = useMutation({
    mutationFn: () => usersApi.delete(user.id),
    onSuccess: onSaved,
    onError: handleError('Failed to delete user'),
  });

  function handleResetPassword() {
    if (!window.confirm(`Generate a new temporary password for "${user.email}"? Their current password stops working.`)) return;
    setMessage(null);
    setTemporaryPassword(null);
    resetPassword.mutate();
  }

  function handleDelete() {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setMessage(null);
    deleteUser.mutate();
  }

  return (
    <TableRow sx={{ verticalAlign: 'top' }}>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          {user.isSuperAdmin ? (
            <Chip size="small" color="primary" label="Super admin" />
          ) : isAdminAccount ? (
            <Chip size="small" label="Admin" />
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
          {canGrantAdmin && (
            <Button
              size="small"
              disabled={updateRole.isPending}
              onClick={() => {
                setMessage(null);
                updateRole.mutate(isAdminAccount ? 'NORMAL_USER' : 'ADMIN');
              }}
            >
              {isAdminAccount ? 'Remove admin' : 'Make admin'}
            </Button>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Stack spacing={1}>
          {user.memberships.map((m) => (
            <MembershipLine
              key={m.id}
              userId={user.id}
              membership={m}
              editable={canManageMemberships}
              onSaved={onSaved}
              onError={handleError('Failed to update membership')}
            />
          ))}
          {user.memberships.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {isAdminAccount ? 'No client organizations' : 'Not in any organization'}
            </Typography>
          )}
          {canManageMemberships && (
            <AddMembership
              userId={user.id}
              organizations={organizations.filter((o) => !user.memberships.some((m) => m.organizationId === o.id))}
              onSaved={onSaved}
              onError={handleError('Failed to add organization')}
            />
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Button
            size="small"
            variant="outlined"
            disabled={!canResetPassword || resetPassword.isPending}
            onClick={handleResetPassword}
          >
            {resetPassword.isPending ? 'Generating…' : 'Temporary password'}
          </Button>
          <Button size="small" color="error" variant="outlined" disabled={!canDelete || deleteUser.isPending} onClick={handleDelete}>
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </Button>
          {temporaryPassword && (
            <Alert severity="success" onClose={() => setTemporaryPassword(null)} sx={{ maxWidth: 320 }}>
              Temporary password: <strong style={{ fontFamily: 'monospace' }}>{temporaryPassword}</strong>
              <br />
              Copy it now and send it to the user — it won&apos;t be shown again. They must choose a
              new password when they log in.
            </Alert>
          )}
          {message && (
            <Typography variant="caption" color={message.kind === 'error' ? 'error' : 'success.main'}>
              {message.text}
            </Typography>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function MembershipLine({
  userId,
  membership,
  editable,
  onSaved,
  onError,
}: {
  userId: string;
  membership: MembershipDto;
  editable: boolean;
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const changeRole = useMutation({
    mutationFn: (role: MembershipRole) => usersApi.updateMembership(userId, membership.id, { role }),
    onSuccess: onSaved,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => usersApi.removeMembership(userId, membership.id),
    onSuccess: onSaved,
    onError,
  });
  const hasResponses = membership.responseCount > 0;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
      <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }}>
        {membership.organizationName}
      </Typography>
      {editable ? (
        <TextField
          select
          size="small"
          value={membership.role}
          disabled={changeRole.isPending}
          onChange={(e) => changeRole.mutate(e.target.value as MembershipRole)}
          sx={{ minWidth: 140 }}
        >
          {MEMBERSHIP_ROLES.map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Typography variant="body2">{ROLE_LABELS[membership.role]}</Typography>
      )}
      {membership.opCoName && (
        <Typography variant="caption" color="text.secondary">
          {membership.opCoName}
        </Typography>
      )}
      {editable && (
        <Button
          size="small"
          color="error"
          disabled={hasResponses || remove.isPending}
          title={hasResponses ? 'Has questionnaire responses in this organization — cannot be removed' : undefined}
          onClick={() => {
            if (window.confirm(`Remove this user from "${membership.organizationName}"?`)) remove.mutate();
          }}
        >
          Remove
        </Button>
      )}
    </Stack>
  );
}

function AddMembership({
  userId,
  organizations,
  onSaved,
  onError,
}: {
  userId: string;
  organizations: OrganizationDto[];
  onSaved: () => void;
  onError: (err: unknown) => void;
}) {
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState<MembershipRole>('NORMAL_USER');
  const add = useMutation({
    mutationFn: () => usersApi.addMembership(userId, { organizationId, role }),
    onSuccess: () => {
      setOrganizationId('');
      onSaved();
    },
    onError,
  });

  if (organizations.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
      <TextField
        select
        size="small"
        label="Add organization"
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
        sx={{ minWidth: 180 }}
      >
        {organizations.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            {o.name}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" value={role} onChange={(e) => setRole(e.target.value as MembershipRole)} sx={{ minWidth: 140 }}>
        {MEMBERSHIP_ROLES.map((r) => (
          <MenuItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </MenuItem>
        ))}
      </TextField>
      <Button size="small" variant="contained" disabled={!organizationId || add.isPending} onClick={() => add.mutate()}>
        Add
      </Button>
    </Stack>
  );
}
