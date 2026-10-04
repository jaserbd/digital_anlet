import { useState, type FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { SupportContact } from '../components/SupportContact';

// Detecon-style split layout (OVERVIEW.md items 2/5) — a branded panel (generated on-brand
// background, no external photo — see hero-background.svg's comment) alongside the login
// form, matching detecon.com's logo-and-imagery hero treatment.
export function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const year = new Date().getFullYear();

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: '100vh' }}>
      <Box
        sx={{
          flex: { xs: 'none', md: '1 1 55%' },
          minHeight: { xs: 240, md: 'auto' },
          backgroundImage: 'url(/branding/hero-background.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { xs: 3, md: 6 },
        }}
      >
        <Stack direction="row" spacing={2}>
          <Paper sx={{ p: 1.5, display: 'inline-flex' }}>
            <Box component="img" src="/branding/detecon-logo.png" alt="Detecon" sx={{ height: 32 }} />
          </Paper>
          <Paper sx={{ p: 1.5, display: 'inline-flex' }}>
            <Box component="img" src="/branding/tm-forum-logo.png" alt="TM Forum" sx={{ height: 32 }} />
          </Paper>
        </Stack>
        <Box>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Anlet
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', mb: 3 }}>
            Autonomous Network Maturity Assessment
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block', maxWidth: 480 }}>
            This application is the proprietary property of Detecon International GmbH, a
            member of the Deutsche Telekom Group. The questionnaires and assessment
            methodology used within it are the proprietary property of TM Forum. © {year}{' '}
            Detecon International GmbH. All rights reserved.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          flex: { xs: 'none', md: '1 1 45%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 3, md: 6 },
          bgcolor: 'background.default',
        }}
      >
        <Paper elevation={2} sx={{ p: 4, width: '100%', maxWidth: 380 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your credentials to continue
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
              <TextField
                label="Password"
                type="password"
                required
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && (
                <Alert severity="error">
                  {/\.\s*$/.test(error) ? error : `${error}.`} If you keep having problems, use &quot;Forgot password?&quot; below or contact
                  support.
                </Alert>
              )}
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting} fullWidth>
                {isSubmitting ? 'Logging in…' : 'Log in'}
              </Button>
              <Link component={RouterLink} to="/forgot-password" sx={{ textAlign: 'center' }}>
                Forgot password?
              </Link>
              <SupportContact />
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
