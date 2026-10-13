import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MembershipDto, Role, UserDto } from '@anlet/shared';
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
import { type Placement, placementKey, placementLabel, usePlacements } from '../lib/placements';
import { SectionCard } from './SectionCard';
import { CollapsibleTable } from './CollapsibleTable';
import { SortableTable, type SortableTableColumn } from './SortableTable';

type MembershipRole = Extract<Role, 'NORMAL_USER' | 'EXECUTIVE'>;

// One table row per user + project + organization (USERS_TABLE_PLAN.md, PROJECTS_V2_PLAN.md); a
// user without any organization gets a single row with `membership: null`.
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
    isProjectAdminAccount,
    canManageMemberships,
    // Moving between organizations is for Application Admins only.
    canMove: !callerIsProjectAdmin && canManageMemberships,
    canGrantAdmin: isSuperAdmin && !user.isSuperAdmin && !isSelf,
    canResetPassword:
      !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin) && !(callerIsProjectAdmin && isProjectAdminAccount),
    canDelete: !callerIsProjectAdmin && !user.isSuperAdmin && !isSelf && (!isAdminAccount || isSuperAdmin),
  };
}

// Existing users (MULTI_ORG_PLAN.md, USERS_TABLE_PLAN.md, PROJECTS_V2_PLAN.md): one row per user +
// project + organization with sortable/filterable columns — filter by Project to see who takes part
// where. Per row: change the role, move to another project/organization (answers move with it),
// remove. Per user ("User ▾"): temporary password, add to a project, Admin role, delete. Project
// Admin rows are read-only here (managed on the Projects list). A Project Admin sees only their
// organization + project's members.
export function ManageUsersSection() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const places = usePlacements();
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string } | null>(null);

  const onSaved = () => void queryClient.invalidateQueries({ queryKey: ['users'] });
  const onError = (fallback: string) => (err: unknown) => setMessage({ kind: 'error', text: errorText(err, fallback) });
  const actions = {
    onSaved,
    onError,
    onMessage: (text: string) => setMessage({ kind: 'success', text }),
    onTemporaryPassword: (email: string, password: string) => setTemporaryPassword({ email, password }),
    placements: places.placements ?? [],
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
      key: 'project',
      header: 'Project',
      getValue: (r) => r.membership?.projectName ?? '—',
      filterType: 'multiselect',
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
        One row per user, project and organization — filter by Project to see who takes part where.
        Moving a user keeps their answers, which then count for the new project and organization.
        Project Admins are added and removed on the Projects list.
      </Typography>
      {message && (
        <Alert severity={message.kind} onClose={() => setMessage(null)} sx={{ mb: 1 }}>
          {message.text}
        </Alert>
      )}
      {usersQuery.isLoading || places.isLoading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : !usersQuery.data || !places.placements ? (
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
  placements: Placement[];
}

/** The project + organization pairs a user isn't in yet. */
function freePlacements(user: UserDto, placements: Placement[]): Placement[] {
  const taken = new Set(user.memberships.map((m) => placementKey(m)));
  return placements.filter((p) => !taken.has(placementKey(p)));
}

function RoleCell({ user, membership, onSaved, onError }: { user: UserDto; membership: MembershipDto } & ActionProps) {
  const { canManageMemberships } = usePermissions(user);
  const roles = assignableMembershipRoles() as MembershipRole[];
  const changeRole = useMutation({
    mutationFn: (role: MembershipRole) => usersApi.updateMembership(user.id, membership.id, { role }),
    onSuccess: onSaved,
    onError: onError('Failed to change the role'),
  });
  // Project Admin memberships are managed on the Projects list (PROJECTS_V2_PLAN.md).
  if (membership.role === 'PROJECT_ADMIN') {
    return (
      <span title="Added and removed on the Projects list">{ROLE_LABELS.PROJECT_ADMIN} (via project)</span>
    );
  }
  if (!canManageMemberships) return <>{ROLE_LABELS[membership.role]}</>;
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
  const { onSaved, onError, onMessage, placements } = props;
  const permissions = usePermissions(user);
  const [moveAnchor, setMoveAnchor] = useState<HTMLElement | null>(null);
  const isProjectAdminRow = membership?.role === 'PROJECT_ADMIN';

  const targets = freePlacements(user, placements);
  const move = useMutation({
    mutationFn: (target: Placement) =>
      usersApi.updateMembership(user.id, membership!.id, {
        organizationId: target.organizationId,
        projectId: target.projectId,
      }),
    onSuccess: (_data, target) => {
      onMessage(`Moved ${user.email} from ${placementLabel(membership!)} to ${placementLabel(target)}`);
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
      {membership && permissions.canMove && !isProjectAdminRow && (
        <>
          <Button size="small" disabled={targets.length === 0 || move.isPending} onClick={(e) => setMoveAnchor(e.currentTarget)}>
            Move to…
          </Button>
          <Menu anchorEl={moveAnchor} open={!!moveAnchor} onClose={() => setMoveAnchor(null)}>
            {targets.map((target) => (
              <MenuItem
                key={placementKey(target)}
                onClick={() => {
                  setMoveAnchor(null);
                  const to = placementLabel(target);
                  const answers = responses > 0 ? ` Their ${responses} response(s) move too and then count for ${to}.` : '';
                  const natCo = target.organizationId !== membership.organizationId ? ' Their NatCo is cleared.' : '';
                  if (window.confirm(`Move ${user.email} from ${placementLabel(membership)} to ${to}?${answers}${natCo}`)) move.mutate(target);
                }}
              >
                {placementLabel(target)}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {membership && permissions.canManageMemberships && !isProjectAdminRow && (
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
            if (window.confirm(`Remove ${user.email} from "${placementLabel(membership)}"?`)) remove.mutate();
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

function UserMenu({ user, onSaved, onError, onTemporaryPassword, placements }: { user: UserDto } & ActionProps) {
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

  const addable = freePlacements(user, placements);
  const items = [
    permissions.canResetPassword && {
      label: 'Temporary password',
      run: () => {
        if (window.confirm(`Generate a new temporary password for ${user.email}? Their current password stops working.`)) {
          resetPassword.mutate();
        }
      },
    },
    permissions.canManageMemberships && addable.length > 0 && { label: 'Add to project / organization…', run: () => setAddOpen(true) },
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
        placements={addable}
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
  placements,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  user: UserDto;
  placements: Placement[];
  onClose: () => void;
  onSaved: () => void;
  onError: (fallback: string) => (err: unknown) => void;
}) {
  const roles = assignableMembershipRoles() as MembershipRole[];
  const [key, setKey] = useState('');
  const [role, setRole] = useState<MembershipRole>('NORMAL_USER');
  const target = placements.find((p) => placementKey(p) === key);
  const add = useMutation({
    mutationFn: () =>
      usersApi.addMembership(user.id, { organizationId: target!.organizationId, projectId: target!.projectId, role }),
    onSuccess: () => {
      setKey('');
      onClose();
      onSaved();
    },
    onError: onError('Failed to add the organization'),
  });

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add {user.email} to a project</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1, minWidth: 360 }}>
          <TextField select label="Project · Organization" value={key} onChange={(e) => setKey(e.target.value)}>
            {placements.map((p) => (
              <MenuItem key={placementKey(p)} value={placementKey(p)}>
                {placementLabel(p)}
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
        <Button variant="contained" disabled={!target || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
