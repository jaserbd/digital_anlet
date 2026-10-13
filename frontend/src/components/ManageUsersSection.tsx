import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MembershipDto, OrganizationDto, Role, UserDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, assignableMembershipRoles } from '../lib/roles';
import { useManageableOrganizations } from '../lib/manageableOrganizations';
import { SectionCard } from './SectionCard';
import { CollapsibleTable } from './CollapsibleTable';
import { SortableTable, type SortableTableColumn } from './SortableTable';

type MembershipRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE' | 'PROJECT_ADMIN'>;

// One table row per user + organization (USERS_TABLE_PLAN.md); a user without any organization
// gets a single row with `membership: null`.
interface UserRowData {
  user: UserDto;
  membership: MembershipDto | null;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function adminLabel(user: UserDto): string {
  return user.isSuperAdmin ? 'Super admin' : user.role === 'ADMIN' ? ROLE_LABELS.ADMIN : '—';
}

// What the current admin may do to a user — mirrors users.service.ts, which enforces the same
// rules server-side (ADMIN_MANAGEMENT_PLAN.md, MULTI_ORG_PLAN.md, PROJECTS_PLAN.md).
function usePermissions(user: UserDto) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = !!currentUser?.isSuperAdmin;
  const isSelf = user.id === currentUser?.id;
  const isAdminAccount = user.role === 'ADMIN';
  const callerIsProjectAdmin = currentUser?.role === 'PROJECT_ADMIN';
  const isProjectAdminAccount = user.memberships.some((m) => m.role === 'PROJECT_ADMIN');
  // Memberships of an admin account: super admin or that admin themself. Project Admins: only
  // non-admin client members (never another Project Admin).
  const canManageMemberships = callerIsProjectAdmin
    ? !isAdminAccount && !isProjectAdminAccount
    : !isAdminAccount || isSuperAdmin || isSelf;
  return {
    callerIsProjectAdmin,
    isAdminAccount,
    canManageMemberships,
    // Moving between organizations is for Application Admins only.
    canMove: !callerIsProjectAdmin && canManageMemberships,
    canGrantAdmin: isSuperAdmin && !user.isSuperAdmin && !isSelf,
    canResetPassword:
      !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin) && !(callerIsProjectAdmin && isProjectAdminAccount),
    canDelete: !callerIsProjectAdmin && !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin),
  };
}

// Existing users (MULTI_ORG_PLAN.md, USERS_TABLE_PLAN.md): one row per user + organization with
// sortable/filterable columns. Per row: change the role, move to another organization (answers
// move with it), remove. Per user ("User ▾"): temporary password, add organization, Admin role,
// delete. A Project Admin sees only their organization's members.
export function ManageUsersSection() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const orgs = useManageableOrganizations();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string } | null>(null);

  const onSaved = () => void queryClient.invalidateQueries({ queryKey: ['users'] });
  const onError = (fallback: string) => (err: unknown) => setMessage({ kind: 'error', text: errorText(err, fallback) });
  const actions = {
    onSaved,
    onError,
    onMessage: (text: string) => setMessage({ kind: 'success', text }),
    onTemporaryPassword: (email: string, password: string) => setTemporaryPassword({ email, password }),
    organizations: orgs.organizations ?? [],
  };

  const rows: UserRowData[] = (usersQuery.data ?? []).flatMap((user): UserRowData[] =>
    user.memberships.length > 0 ? user.memberships.map((membership) => ({ user, membership })) : [{ user, membership: null }],
  );

  const columns: SortableTableColumn<UserRowData>[] = [
    { key: 'email', header: 'Email', getValue: (r) => r.user.email, filterable: true },
    {
      key: 'admin',
      header: 'Admin',
      getValue: (r) => adminLabel(r.user),
      filterType: 'multiselect',
      render: (r) =>
        r.user.role === 'ADMIN' ? (
          <Chip size="small" color={r.user.isSuperAdmin ? 'primary' : 'default'} label={adminLabel(r.user)} />
        ) : (
          '—'
        ),
    },
    {
      key: 'organization',
      header: 'Organization',
      getValue: (r) => r.membership?.organizationName ?? '—',
      filterType: 'multiselect',
    },
    {
      key: 'role',
      header: 'Role',
      getValue: (r) => (r.membership ? ROLE_LABELS[r.membership.role] : '—'),
      filterType: 'multiselect',
      render: (r) => (r.membership ? <RoleCell user={r.user} membership={r.membership} {...actions} /> : '—'),
    },
    { key: 'natco', header: 'NatCo', getValue: (r) => r.membership?.opCoName ?? '—', filterType: 'multiselect' },
    {
      key: 'actions',
      header: '',
      getValue: () => null,
      render: (r) => <RowActions row={r} {...actions} />,
    },
  ];

  return (
    <SectionCard title="Existing users">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        One row per user and organization — a person in two organizations has two rows. Moving a
        user to another organization keeps their answers, which then count for the new organization.
      </Typography>
      {message && (
        <Alert severity={message.kind} onClose={() => setMessage(null)} sx={{ mb: 1 }}>
          {message.text}
        </Alert>
      )}
      {usersQuery.isLoading || orgs.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !usersQuery.data || !orgs.organizations ? (
        <Typography color="text.secondary">Something went wrong loading users.</Typography>
      ) : (
        <CollapsibleTable label="Existing users" count={usersQuery.data.length}>
          <SortableTable
            columns={columns}
            rows={rows}
            rowKey={(r) => `${r.user.id}:${r.membership?.id ?? 'none'}`}
            emptyMessage="No users yet."
          />
        </CollapsibleTable>
      )}
      <Dialog open={!!temporaryPassword} onClose={() => setTemporaryPassword(null)}>
        <DialogTitle>Temporary password</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>{temporaryPassword?.email}</Typography>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, mb: 1 }}>
            {temporaryPassword?.password}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Copy it now and send it to the user — it won&apos;t be shown again. They must choose a new
            password when they log in.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemporaryPassword(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </SectionCard>
  );
}

interface ActionProps {
  onSaved: () => void;
  onError: (fallback: string) => (err: unknown) => void;
  onMessage: (text: string) => void;
  onTemporaryPassword: (email: string, password: string) => void;
  organizations: OrganizationDto[];
}

function RoleCell({ user, membership, onSaved, onError }: { user: UserDto; membership: MembershipDto } & ActionProps) {
  const { user: currentUser } = useAuth();
  const { canManageMemberships, callerIsProjectAdmin } = usePermissions(user);
  const roles = assignableMembershipRoles(currentUser!.role) as MembershipRole[];
  const changeRole = useMutation({
    mutationFn: (role: MembershipRole) => usersApi.updateMembership(user.id, membership.id, { role }),
    onSuccess: onSaved,
    onError: onError('Failed to change the role'),
  });
  // A Project Admin can't change another Project Admin membership.
  const editable = canManageMemberships && !(callerIsProjectAdmin && membership.role === 'PROJECT_ADMIN');
  if (!editable) return <>{ROLE_LABELS[membership.role]}</>;
  return (
    <TextField
      select
      size="small"
      value={membership.role}
      disabled={changeRole.isPending}
      onChange={(e) => changeRole.mutate(e.target.value as MembershipRole)}
      sx={{ minWidth: 150 }}
    >
      {roles.map((r) => (
        <MenuItem key={r} value={r}>
          {ROLE_LABELS[r]}
        </MenuItem>
      ))}
    </TextField>
  );
}

function RowActions({ row, ...props }: { row: UserRowData } & ActionProps) {
  const { user, membership } = row;
  const { onSaved, onError, onMessage, organizations } = props;
  const permissions = usePermissions(user);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);

  const otherOrganizations = organizations.filter((o) => !user.memberships.some((m) => m.organizationId === o.id));
  const move = useMutation({
    mutationFn: (organization: OrganizationDto) =>
      usersApi.updateMembership(user.id, membership!.id, { organizationId: organization.id }),
    onSuccess: (_data, organization) => {
      onMessage(`Moved ${user.email} from ${membership!.organizationName} to ${organization.name}`);
      onSaved();
    },
    onError: onError('Failed to move the user'),
  });
  const remove = useMutation({
    mutationFn: () => usersApi.removeMembership(user.id, membership!.id),
    onSuccess: onSaved,
    onError: onError('Failed to remove the user from the organization'),
  });
  const responses = membership?.responseCount ?? 0;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
      {membership && permissions.canMove && (
        <>
          <Button size="small" disabled={otherOrganizations.length === 0 || move.isPending} onClick={(e) => setMoveAnchor(e.currentTarget)}>
            Move to…
          </Button>
          <Menu anchorEl={moveAnchor} open={!!moveAnchor} onClose={() => setMoveAnchor(null)}>
            {otherOrganizations.map((o) => (
              <MenuItem
                key={o.id}
                onClick={() => {
                  setMoveAnchor(null);
                  const answers = responses > 0 ? ` Their ${responses} response(s) move too and then count for ${o.name}.` : '';
                  if (window.confirm(`Move ${user.email} from ${membership.organizationName} to ${o.name}?${answers} Their NatCo is cleared.`)) move.mutate(o);
                }}
              >
                {o.name}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {membership && permissions.canManageMemberships && !(permissions.callerIsProjectAdmin && membership.role === 'PROJECT_ADMIN') && (
        <Button
          size="small"
          color="error"
          disabled={responses > 0 || remove.isPending}
          title={
            responses > 0
              ? `Has ${responses} questionnaire response(s) in this organization — move it instead of removing`
              : undefined
          }
          onClick={() => {
            if (window.confirm(`Remove ${user.email} from "${membership.organizationName}"?`)) remove.mutate();
          }}
        >
          Remove
        </Button>
      )}
      <UserMenu user={user} {...props} />
      {membership && responses > 0 && (
        <Typography variant="caption" color="text.secondary">
          {responses} response{responses === 1 ? '' : 's'}
        </Typography>
      )}
    </Stack>
  );
}

function UserMenu({ user, onSaved, onError, onTemporaryPassword, organizations }: { user: UserDto } & ActionProps) {
  const permissions = usePermissions(user);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const updateAdmin = useMutation({
    mutationFn: () => usersApi.update(user.id, { role: permissions.isAdminAccount ? 'NORMAL_USER' : 'ADMIN' }),
    onSuccess: onSaved,
    onError: onError('Failed to change the Admin role'),
  });
  const resetPassword = useMutation({
    mutationFn: () => usersApi.temporaryPassword(user.id),
    onSuccess: (data) => onTemporaryPassword(user.email, data.temporaryPassword),
    onError: onError('Failed to generate a temporary password'),
  });
  const deleteUser = useMutation({
    mutationFn: () => usersApi.delete(user.id),
    onSuccess: onSaved,
    onError: onError('Failed to delete the user'),
  });

  const addable = organizations.filter((o) => !user.memberships.some((m) => m.organizationId === o.id));
  const items = [
    permissions.canResetPassword && {
      label: 'Temporary password',
      run: () => {
        if (window.confirm(`Generate a new temporary password for ${user.email}? Their current password stops working.`)) {
          resetPassword.mutate();
        }
      },
    },
    permissions.canManageMemberships && addable.length > 0 && { label: 'Add organization…', run: () => setAddOpen(true) },
    permissions.canGrantAdmin && {
      label: permissions.isAdminAccount ? 'Remove Application Admin' : 'Make Application Admin',
      run: () => updateAdmin.mutate(),
    },
    permissions.canDelete && {
      label: 'Delete user',
      run: () => {
        if (window.confirm(`Delete user ${user.email}? This cannot be undone.`)) deleteUser.mutate();
      },
    },
  ].filter((i): i is { label: string; run: () => void } => !!i);

  if (items.length === 0) return null;
  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchor(e.currentTarget)}>
        User ▾
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => {
              setAnchor(null);
              item.run();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
      <AddMembershipDialog
        open={addOpen}
        user={user}
        organizations={addable}
        onClose={() => setAddOpen(false)}
        onSaved={onSaved}
        onError={onError}
      />
    </>
  );
}

function AddMembershipDialog({
  open,
  user,
  organizations,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  user: UserDto;
  organizations: OrganizationDto[];
  onClose: () => void;
  onSaved: () => void;
  onError: (fallback: string) => (err: unknown) => void;
}) {
  const { user: currentUser } = useAuth();
  const roles = assignableMembershipRoles(currentUser!.role) as MembershipRole[];
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState<MembershipRole>('NORMAL_USER');
  const add = useMutation({
    mutationFn: () => usersApi.addMembership(user.id, { organizationId, role }),
    onSuccess: () => {
      setOrganizationId('');
      onClose();
      onSaved();
    },
    onError: onError('Failed to add the organization'),
  });

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add {user.email} to an organization</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
          <TextField select label="Organization" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            {organizations.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as MembershipRole)}>
            {roles.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!organizationId || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
