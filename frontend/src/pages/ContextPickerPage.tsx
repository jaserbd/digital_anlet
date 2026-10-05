import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { PageShell } from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { contextKey, formatContextLabel } from '../lib/contexts';

// Shown right after login to users with more than one organization/role (MULTI_ORG_PLAN.md);
// also reachable any time. Picking one switches the session to it and goes Home.
export function ContextPickerPage() {
  const { user, switchContext } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function choose(membershipId: string | null) {
    setError(null);
    setPending(contextKey(membershipId));
    try {
      await switchContext(membershipId);
      navigate('/', { replace: true });
    } catch {
      setError('Could not switch. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <PageShell title="Choose where to work" maxWidth={560}>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        You have access to more than one organization. Pick one to continue — you can switch at
        any time from &quot;Working as&quot; in the header.
      </Typography>
      <Stack spacing={1.5}>
        {user?.contexts.map((c) => {
          const key = contextKey(c.membershipId);
          const isActive = key === contextKey(user.activeMembershipId);
          return (
            <Button
              key={key}
              variant={isActive ? 'contained' : 'outlined'}
              size="large"
              disabled={pending !== null}
              onClick={() => void choose(c.membershipId)}
              sx={{ justifyContent: 'flex-start' }}
            >
              {pending === key ? 'Switching…' : formatContextLabel(c)}
            </Button>
          );
        })}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </PageShell>
  );
}
