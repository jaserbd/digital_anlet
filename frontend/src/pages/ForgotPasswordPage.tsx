import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { authApi } from '../api/authApi';
import { ApiError } from '../api/client';
import { SupportContact } from '../components/SupportContact';

// Forgot-password, step 1 (OVERVIEW.md item 12) — public page, reachable from LoginPage's
// "Forgot password?" link. The success message is deliberately generic regardless of whether
// the email is registered, matching the backend's own no-user-enumeration posture
// (requestPasswordReset always resolves the same way).
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forgotPassword = useMutation({
    mutationFn: () => authApi.forgotPassword({ email }),
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to send reset link');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    forgotPassword.mutate();
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
          Reset your password
        </Typography>
        {submitted ? (
          <>
            <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
              If an account exists for that email, we've sent a link to reset your password.
              It's valid for one hour.
            </Alert>
            <Link component={RouterLink} to="/login">
              ← Back to sign in
            </Link>
            <Box sx={{ mt: 2 }}>
              <SupportContact prefix="No email after a few minutes?" />
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your account email and we'll send you a link to set a new password.
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  required
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" size="large" disabled={forgotPassword.isPending} fullWidth>
                  {forgotPassword.isPending ? 'Sending…' : 'Send reset link'}
                </Button>
                <Link component={RouterLink} to="/login" sx={{ textAlign: 'center' }}>
                  ← Back to sign in
                </Link>
                <SupportContact />
              </Stack>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
