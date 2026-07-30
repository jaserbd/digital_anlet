import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';

interface PageShellProps {
  title: string;
  maxWidth?: number;
  children: ReactNode;
}

// Route-level layout shell (OVERVIEW.md items 2/3) — every page previously rendered its own
// <main style={{...}}><AppHeader/>...</main> root independently. Centralizing it here means
// the branded header + legal footer show up everywhere with one component swap per page.
export function PageShell({ title, maxWidth = 900, children }: PageShellProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        // Soft magenta wash anchored behind the header (OVERVIEW.md item 5 — "some colored
        // background", toned down from the login page's full-strength gradient so it doesn't
        // fight with dense tables/forms further down the page).
        background:
          'radial-gradient(1200px 400px at 50% -120px, rgba(226,0,116,0.10), rgba(226,0,116,0) 70%), #f7f5f6',
      }}
    >
      <AppHeader title={title} />
      <Container component="main" maxWidth={false} sx={{ maxWidth, flexGrow: 1, py: 4 }}>
        {children}
      </Container>
      <AppFooter />
    </Box>
  );
}
