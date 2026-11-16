import { MIN_PASSWORD_LENGTH } from '@anlet/shared';
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { authApi } from '../api/authApi';
import { ApiError } from '../api/client';
import { SupportContact } from '../components/SupportContact';

// Forgot-password, step 2 (OVERVIEW.md item 12) — reached via the link emailed from
// ForgotPasswordPage, token carried as a URL query param. Public page (no auth) since the
// token itself, not a session, is what authorizes the change. Welcome emails for new accounts
// (ONBOARDING_SECURITY_PLAN.md Phase 3) link here too, with `welcome=1` for their wording.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const isWelcome = searchParams.get('welcome') === '1';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetPassword = useMutation({
    mutationFn: () => authApi.resetPassword({ token, newPassword }),
    onSuccess: ({ email }) => navigate('/login', { replace: true, state: { passwordSetFor: email } }),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    resetPassword.mutate();
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <Paper elevation={2} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {isWelcome ? 'Welcome to ANLET' : 'Set a new password'}
        </Typography>
        {!token ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            This link is missing its token. Please use the link from your email, or request a new
            one.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {isWelcome
                ? 'Choose a password for your new account. You will then sign in with your email address and this password.'
                : 'Choose a new password for your account.'}
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="New password"
                  type="password"
                  required
                  fullWidth
                  slotProps={{ htmlInput: { minLength: MIN_PASSWORD_LENGTH } }}
                  helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  required
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" size="large" disabled={resetPassword.isPending} fullWidth>
                  {resetPassword.isPending ? 'Saving…' : 'Set password'}
                </Button>
              </Stack>
            </Box>
          </>
        )}
        <Box sx={{ mt: 2 }}>
          <SupportContact prefix="Link not working?" />
        </Box>
      </Paper>
    </Box>
  );
}
