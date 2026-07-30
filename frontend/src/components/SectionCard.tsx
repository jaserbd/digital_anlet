import type { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

interface SectionCardProps {
  title?: ReactNode;
  // Rendered top-right, alongside the title — e.g. a "Back to Admin" or "Export" button.
  action?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

// Replaces the app's original plain <section><h2>...</h2>...</section> + <hr> divider
// pattern (OVERVIEW.md item 5) with a bordered, rounded card with a magenta top accent —
// applied broadly across Admin/Executive/Profile/Results pages so the whole app reads as
// "designed" rather than a stack of plain text sections, echoing the login page's card look.
export function SectionCard({ title, action, children, sx }: SectionCardProps) {
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          {title && (
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
          )}
          {action}
        </Box>
      )}
      {children}
    </Paper>
  );
}
