import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { opCoApi } from '../api/opCoApi';
import { authApi } from '../api/authApi';
import { ApiError } from '../api/client';
import { ME_QUERY_KEY, useAuth } from '../context/AuthContext';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { ReferenceListSelect } from '../components/ReferenceListSelect';

// One-time profile completion for a NORMAL_USER or EXECUTIVE before they can reach the
// domain picker (see ProtectedRoute.tsx — a user missing required profile fields is routed
// here, but only from the participation routes, not from their dashboard/Home). Country +
// Company are captured together by picking an admin-managed OpCo; Working Domain and
// Designation are free text. OpCo is mandatory for a NORMAL_USER but optional for an
// EXECUTIVE (MANAGEMENT_REVIEW2.md item 2) — an Executive can skip NatCo entirely.
//
// Now wrapped in PageShell (OVERVIEW.md item 5) — previously the only page with no shared
// header/footer/nav at all.
export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isExecutive = user!.role === 'EXECUTIVE';

  const opCosQuery = useQuery({
    queryKey: ['opcos', user!.organizationId],
    queryFn: () => opCoApi.list(user!.organizationId),
  });

  const [opCoId, setOpCoId] = useState('');
  const [workingDomain, setWorkingDomain] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: () => authApi.updateProfile({ opCoId: opCoId || undefined, workingDomain, designation }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      navigate('/domains', { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    updateProfile.mutate();
  }

  return (
    <PageShell title="Complete your profile" maxWidth={560}>
      <SectionCard>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Before starting an assessment, tell us a bit about yourself.
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField
              select
              label={`Country / Company (OpCo)${isExecutive ? ' (optional)' : ''}`}
              required={!isExecutive}
              value={opCoId}
              onChange={(e) => setOpCoId(e.target.value)}
              fullWidth
              helperText={
                isExecutive
                  ? "As an Executive, you can skip this if you're just answering for yourself."
                  : opCosQuery.data?.length === 0
                    ? 'No OpCos exist for your organization yet — ask your Admin to create one.'
                    : undefined
              }
            >
              <MenuItem value="">
                <em>{opCosQuery.isLoading ? 'Loading…' : isExecutive ? 'Skip (no OpCo)' : 'Select your OpCo'}</em>
              </MenuItem>
              {opCosQuery.data?.map((opCo) => (
                <MenuItem key={opCo.id} value={opCo.id}>
                  {opCo.name} ({opCo.country})
                </MenuItem>
              ))}
            </TextField>
            <ReferenceListSelect
              category="WORKING_DOMAIN"
              required
              value={workingDomain}
              onChange={setWorkingDomain}
              fullWidth
            />
            <ReferenceListSelect
              category="DESIGNATION"
              required
              value={designation}
              onChange={setDesignation}
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={updateProfile.isPending || (!isExecutive && !opCoId)}
            >
              {updateProfile.isPending ? 'Saving…' : 'Continue'}
            </Button>
          </Stack>
        </Box>
      </SectionCard>
    </PageShell>
  );
}
