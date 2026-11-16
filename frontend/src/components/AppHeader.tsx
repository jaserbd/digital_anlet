import { useState, type ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';
import { ContextSwitcher } from './ContextSwitcher';

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
function NavLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  const { pathname } = useLocation();
  const active = to === '/' ? false : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <>
      {/* Icon + text from sm up; icon only (with tooltip) on phones, where the header used to
          wrap into half the screen. */}
      <Button
        component={RouterLink}
        to={to}
        startIcon={icon}
        size="small"
        sx={{
          display: { xs: 'none', sm: 'inline-flex' },
          color: active ? 'primary.main' : 'text.primary',
          bgcolor: active ? 'rgba(226,0,116,0.08)' : undefined,
          fontWeight: 600,
          px: 1.25,
        }}
      >
        {label}
      </Button>
      <Tooltip title={label}>
        <IconButton
          component={RouterLink}
          to={to}
          aria-label={label}
          size="small"
          sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: active ? 'primary.main' : 'text.primary' }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    </>
  );
}

// The signed-in person's menu: their email (previously always shown in the bar) and Log out.
function UserMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={email}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu" size="small">
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}>
            {email.charAt(0).toUpperCase()}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Signed in as
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={onLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>
    </>
  );
}

export function AppHeader({ title }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const resultsHref = user?.role === 'ADMIN' ? '/admin' : '/results';

  return (
    <AppBar
      position="static"
      color="default"
      sx={{ bgcolor: 'background.paper', borderBottom: '3px solid', borderColor: 'primary.main' }}
    >
      <Toolbar sx={{ gap: { xs: 1, sm: 2 }, py: 1, minHeight: { xs: 56, sm: 64 } }}>
        <Box component="img" src="/branding/detecon-logo.png" alt="Detecon" sx={{ height: { xs: 22, sm: 28 } }} />
        <Typography
          variant="h5"
          component="h1"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            color: 'text.primary',
            fontWeight: 800,
            fontSize: { xs: '1.05rem', sm: '1.5rem' },
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography>
        <Stack direction="row" spacing={{ xs: 0, sm: 0.5 }} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <ContextSwitcher />
          <NavLink to="/" icon={<HomeOutlinedIcon fontSize="small" />} label="Home" />
          {user?.role === 'PROJECT_ADMIN' && (
            <NavLink to="/project" icon={<ManageAccountsOutlinedIcon fontSize="small" />} label="Manage project" />
          )}
          {(user?.role === 'EXECUTIVE' || user?.role === 'PROJECT_ADMIN') && (
            <NavLink to="/domains" icon={<EditNoteOutlinedIcon fontSize="small" />} label="Answer as user" />
          )}
          {user && <NavLink to={resultsHref} icon={<InsightsOutlinedIcon fontSize="small" />} label="Results" />}
          {user && <UserMenu email={user.email} onLogout={() => void logout()} />}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
