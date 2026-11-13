import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SxProps, Theme } from '@mui/material/styles';
import { useRememberedOpen } from '../lib/rememberedOpen';

interface SectionCardProps {
  title?: ReactNode;
  // Rendered top-right, alongside the title — e.g. a "Back to Admin" or "Export" button.
  action?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
  // Titled cards collapse (ADMIN_DASHBOARD_PLAN.md); false keeps one always open.
  collapsible?: boolean;
  // Identifies the card for remembering its collapsed state; defaults to a string title.
  collapseKey?: string;
}

// Replaces the app's original plain <section><h2>...</h2>...</section> + <hr> divider
// pattern (OVERVIEW.md item 5) with a bordered, rounded card with a magenta top accent —
// applied broadly across Admin/Executive/Profile/Results pages so the whole app reads as
// "designed" rather than a stack of plain text sections, echoing the login page's card look.
// A titled card collapses from its title (open by default, remembered per page); collapsed
// content stays mounted so its filters and inputs keep their state.
export function SectionCard({ title, action, children, sx, collapsible = true, collapseKey }: SectionCardProps) {
  const canCollapse = collapsible && !!title;
  const key = collapseKey ?? (typeof title === 'string' ? title : null);
  const [open, toggle] = useRememberedOpen(canCollapse ? key : null);
  const isOpen = !canCollapse || open;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        mb: 3,
        borderTop: '3px solid',
        borderTopColor: 'primary.main',
        ...sx,
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: isOpen ? 2 : 0,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {title && (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: canCollapse ? 'pointer' : undefined }}
              onClick={canCollapse ? toggle : undefined}
            >
              {canCollapse && (
                <IconButton
                  size="small"
                  aria-label={isOpen ? 'Collapse section' : 'Expand section'}
                  aria-expanded={isOpen}
                  sx={{ ml: -1, transform: isOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}
                >
                  <ExpandMoreIcon />
                </IconButton>
              )}
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
            </Box>
          )}
          {isOpen && action}
        </Box>
      )}
      {canCollapse ? (
        <Collapse in={isOpen} timeout="auto">
          {children}
        </Collapse>
      ) : (
        children
      )}
    </Paper>
  );
}
