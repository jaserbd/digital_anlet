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

// Forgot-password, step 2 (OVERVIEW.md item 12) — reached via the link emailed from
// ForgotPasswordPage, token carried as a URL query param. Public page (no auth) since the
// token itself, not a session, is what authorizes the change.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetPassword = useMutation({
    mutationFn: () => authApi.resetPassword({ token, newPassword }),
    onSuccess: () => navigate('/login', { replace: true }),
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
          Set a new password
        </Typography>
        {!token ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            This reset link is missing its token. Please use the link from your email, or
            request a new one.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a new password for your account.
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="New password"
                  type="password"
                  required
                  fullWidth
                  slotProps={{ htmlInput: { minLength: 8 } }}
                  helperText="At least 8 characters"
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
      </Paper>
    </Box>
  );
}
