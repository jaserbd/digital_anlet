import { Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from './LogoutButton';

interface AppHeaderProps {
  title: string;
}

// Shared page header (THIRD_REVIEW.md item 5, redesigned per OVERVIEW.md item 2/3 onto an MUI
// AppBar with the Detecon logo) — every page previously repeated its own <h1>...</h1>/logout
// div independently, with no way back to the domain picker/dashboard short of the browser back
// button. The Home link relies entirely on HomePage's existing role-based redirect (admin ->
// /admin, normal user -> /domains, executive -> /executive) rather than duplicating that logic
// here.
//
// Results link (FORTH_REVIEW.md item 6): for a NORMAL_USER or EXECUTIVE this opens the new
// Domain -> HVS results picker (ResultsPickerPage) for their own personal submissions — an
// Executive can now answer questionnaires too (MANAGEMENT_VIEW.md item 2), so they get the
// same personal-results entry point. Admin has no personal submissions, so its "Results" link
// just points back to its own dashboard.
//
// "Answer as user" (MANAGEMENT_VIEW.md item 2): an Executive's primary landing (via Home) is
// their aggregate dashboard (/executive) — this extra link is their way into the same personal
// question-answering flow a Normal User gets, without changing what Home does.
export function AppHeader({ title }: AppHeaderProps) {
  const { user } = useAuth();
  const resultsHref = user?.role === 'ADMIN' ? '/admin' : '/results';

  return (
    <AppBar
      position="static"
      color="default"
      sx={{ bgcolor: 'background.paper', borderBottom: '4px solid', borderColor: 'primary.main' }}
    >
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
        <Box
          component="img"
          src="/branding/detecon-logo.png"
          alt="Detecon"
          sx={{ height: 28 }}
        />
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1, color: 'text.primary', fontWeight: 800 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          {user && (
            <Typography variant="body2" color="text.secondary">
              {user.email}
            </Typography>
          )}
          <Link component={RouterLink} to="/" underline="hover">
            Home
          </Link>
          {user?.role === 'EXECUTIVE' && (
            <Link component={RouterLink} to="/domains" underline="hover">
              Answer as user
            </Link>
          )}
          {user && (
            <Link component={RouterLink} to={resultsHref} underline="hover">
              Results
            </Link>
          )}
          <LogoutButton />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
