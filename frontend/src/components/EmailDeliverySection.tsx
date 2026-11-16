import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { mailApi } from '../api/mailApi';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SectionCard } from './SectionCard';

// Email delivery settings (ONBOARDING_SECURITY_PLAN.md Phase 2): what the server sends with, and
// — for the super admin — a test email to their own address to prove the SMTP settings work.
export function EmailDeliverySection() {
  const { user } = useAuth();
  const statusQuery = useQuery({ queryKey: ['mail-status'], queryFn: mailApi.status });
  const testMutation = useMutation({ mutationFn: mailApi.sendTest });
  const status = statusQuery.data;

  return (
    <SectionCard title="Email delivery">
      {statusQuery.isLoading && <Typography color="text.secondary">Loading…</Typography>}
      {statusQuery.isError && <Alert severity="error">Could not load the email settings.</Alert>}
      {status && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Chip
              size="small"
              color={status.enabled ? 'success' : 'default'}
              label={status.enabled ? 'Sending on' : 'Sending off'}
            />
            <Typography variant="body2">
              {status.fromName} &lt;{status.from}&gt; via {status.host}:{status.port} (login {status.user})
            </Typography>
          </Stack>
          {!status.enabled && (
            <Typography variant="body2" color="text.secondary">
              Emails (password reset links) are not sent until MAIL_ENABLED is set to &quot;true&quot; on the server.
              Use temporary passwords meanwhile.
            </Typography>
          )}
          {user?.isSuperAdmin && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
              <Button variant="outlined" disabled={testMutation.isPending} onClick={() => testMutation.mutate()}>
                {testMutation.isPending ? 'Sending…' : 'Send test email to me'}
              </Button>
              <Typography variant="body2" color="text.secondary">
                Goes to {user.email}.
              </Typography>
            </Stack>
          )}
          {testMutation.isSuccess && (
            <Alert severity="success">Sent — check the inbox (and spam folder) of {user?.email}.</Alert>
          )}
          {testMutation.isError && (
            <Alert severity="error">
              {testMutation.error instanceof ApiError ? testMutation.error.message : 'Sending the test email failed.'}
            </Alert>
          )}
        </Stack>
      )}
    </SectionCard>
  );
}
