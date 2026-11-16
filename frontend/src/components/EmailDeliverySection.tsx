import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MailStatusDto, UpdateMailSettingsRequestDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { mailApi } from '../api/mailApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SectionCard } from './SectionCard';

const STATUS_KEY = ['mail-status'];

// Common providers, to fill server + port in one click (the login and password still come from
// the mailbox owner — for Gmail an app password, for Microsoft 365 the mailbox password).
const PRESETS = [
  { label: 'Microsoft 365', host: 'smtp.office365.com', port: 587 },
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587 },
];

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

// Email delivery settings (ONBOARDING_SECURITY_PLAN.md Phases 2/2b): what the server sends with;
// the super admin can change them (e.g. to IT's shared mailbox) — the server checks the login
// before saving — and send a test email to their own address.
export function EmailDeliverySection() {
  const { user } = useAuth();
  const statusQuery = useQuery({ queryKey: STATUS_KEY, queryFn: mailApi.status });
  const testMutation = useMutation({ mutationFn: mailApi.sendTest });
  const [editing, setEditing] = useState(false);
  const status = statusQuery.data;
  const canEdit = !!user?.isSuperAdmin && !!status?.editable;

  return (
    <SectionCard title="Email delivery">
      {statusQuery.isLoading && <Typography color="text.secondary">Loading…</Typography>}
      {statusQuery.isError && <Alert severity="error">Could not load the email settings.</Alert>}
      {status && (
        <Stack spacing={2}>
          {status.problem && <Alert severity="warning">{status.problem}</Alert>}
          {editing ? (
            <MailSettingsForm status={status} onDone={() => setEditing(false)} />
          ) : (
            <>
              <MailSettingsSummary status={status} />
              {!status.enabled && (
                <Typography variant="body2" color="text.secondary">
                  Emails (password reset links) are not sent while sending is off. Use temporary passwords meanwhile.
                </Typography>
              )}
              {user?.isSuperAdmin && (
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
                  {canEdit && (
                    <Button variant="contained" onClick={() => setEditing(true)}>
                      Change settings
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate()}
                  >
                    {testMutation.isPending ? 'Sending…' : 'Send test email to me'}
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Test goes to {user.email}.
                  </Typography>
                </Stack>
              )}
              {user?.isSuperAdmin && !status.editable && (
                <Typography variant="body2" color="text.secondary">
                  The server has no MAIL_ENCRYPTION_KEY, so these settings can only be changed in GCP
                  (gcp_deployment.md).
                </Typography>
              )}
              {testMutation.isSuccess && (
                <Alert severity="success">Sent — check the inbox (and spam folder) of {user?.email}.</Alert>
              )}
              {testMutation.isError && (
                <Alert severity="error">{errorText(testMutation.error, 'Sending the test email failed.')}</Alert>
              )}
            </>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}

function MailSettingsSummary({ status }: { status: MailStatusDto }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Chip size="small" color={status.enabled ? 'success' : 'default'} label={status.enabled ? 'Sending on' : 'Sending off'} />
        <Chip
          size="small"
          variant="outlined"
          label={status.source === 'database' ? 'Saved in Management Console' : 'Server defaults'}
        />
      </Stack>
      <Typography variant="body2">
        Sender: {status.fromName} &lt;{status.from}&gt;
        {status.replyTo && <> · Replies go to {status.replyTo}</>}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Server {status.host}:{status.port} · login {status.user}
        {status.updatedAt && (
          <>
            {' '}
            · changed {new Date(status.updatedAt).toLocaleString()}
            {status.updatedByEmail && <> by {status.updatedByEmail}</>}
          </>
        )}
      </Typography>
    </Stack>
  );
}

function MailSettingsForm({ status, onDone }: { status: MailStatusDto; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    enabled: status.enabled,
    host: status.host,
    port: String(status.port),
    user: status.user,
    password: '',
    from: status.from,
    fromName: status.fromName,
    replyTo: status.replyTo ?? '',
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (field: keyof typeof form) => (value: string | boolean) => setForm((f) => ({ ...f, [field]: value }));
  // The server keeps the current password only for the same server + login.
  const passwordNeeded = form.host.trim() !== status.host || form.user.trim() !== status.user;

  const onSaved = (next: MailStatusDto) => {
    queryClient.setQueryData(STATUS_KEY, next);
    void queryClient.invalidateQueries({ queryKey: ['mail-enabled'] });
    onDone();
  };
  const saveMutation = useMutation({
    mutationFn: (input: UpdateMailSettingsRequestDto) => mailApi.update(input),
    onSuccess: onSaved,
  });
  const resetMutation = useMutation({ mutationFn: mailApi.reset, onSuccess: onSaved });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      enabled: form.enabled,
      host: form.host.trim(),
      port: Number(form.port),
      user: form.user.trim(),
      from: form.from.trim(),
      fromName: form.fromName.trim(),
      replyTo: form.replyTo.trim() || null,
      ...(form.password ? { password: form.password } : {}),
    });
  }

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit} sx={{ maxWidth: 640 }}>
      <FormControlLabel
        control={<Switch checked={form.enabled} onChange={(e) => set('enabled')(e.target.checked)} />}
        label={form.enabled ? 'Sending on' : 'Sending off (emails are only logged)'}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Fill in server for:
        </Typography>
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            size="small"
            onClick={() => setForm((f) => ({ ...f, host: p.host, port: String(p.port) }))}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField label="SMTP server" required fullWidth value={form.host} onChange={(e) => set('host')(e.target.value)} />
        <TextField
          label="Port"
          required
          type="number"
          value={form.port}
          onChange={(e) => set('port')(e.target.value)}
          helperText="587 (STARTTLS) or 465"
          sx={{ width: 160 }}
        />
      </Stack>
      <TextField
        label="Login (mailbox address)"
        required
        value={form.user}
        onChange={(e) => set('user')(e.target.value)}
        autoComplete="off"
      />
      <TextField
        label="Password"
        type="password"
        required={passwordNeeded}
        value={form.password}
        onChange={(e) => set('password')(e.target.value)}
        autoComplete="new-password"
        helperText={
          passwordNeeded
            ? 'Required for a new server or login. For Gmail use an app password.'
            : 'Leave empty to keep the current password.'
        }
      />
      <Stack direction="row" spacing={2}>
        <TextField label="Sender address" required type="email" fullWidth value={form.from} onChange={(e) => set('from')(e.target.value)} />
        <TextField label="Sender name" required fullWidth value={form.fromName} onChange={(e) => set('fromName')(e.target.value)} />
      </Stack>
      <TextField
        label="Reply-To address (optional)"
        type="email"
        value={form.replyTo}
        onChange={(e) => set('replyTo')(e.target.value)}
        helperText="Where replies to ANLET emails go, e.g. your Detecon address."
      />
      {saveMutation.isError && <Alert severity="error">{errorText(saveMutation.error, 'Saving failed.')}</Alert>}
      {resetMutation.isError && <Alert severity="error">{errorText(resetMutation.error, 'Reset failed.')}</Alert>}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (form.enabled ? 'Checking login…' : 'Saving…') : 'Save'}
        </Button>
        <Button onClick={onDone} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        {status.source === 'database' &&
          (confirmReset ? (
            <Button color="error" variant="outlined" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
              Confirm: use server defaults
            </Button>
          ) : (
            <Button color="error" onClick={() => setConfirmReset(true)}>
              Reset to server defaults
            </Button>
          ))}
      </Stack>
      {form.enabled && (
        <Typography variant="body2" color="text.secondary">
          Save first logs in to the mail server with these details; nothing is saved if it refuses.
        </Typography>
      )}
    </Stack>
  );
}
