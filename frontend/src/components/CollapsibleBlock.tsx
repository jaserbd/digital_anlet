import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useRememberedOpen } from '../lib/rememberedOpen';

// A collapsible sub-block inside a SectionCard (ADMIN_DASHBOARD_PLAN.md) — e.g. the benchmark
// table and each comment collection of a crowded section. Open by default, remembered per page.
// `heading` renders the title at section size (the per-questionnaire blocks of the dashboards).
export function CollapsibleBlock({
  title,
  id,
  heading = false,
  children,
}: {
  title: string;
  id?: string;
  heading?: boolean;
  children: ReactNode;
}) {
  const [open, toggle] = useRememberedOpen(id ?? title);
  return (
    <Box sx={{ mb: heading ? 3 : 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', mb: open ? 1 : 0 }} onClick={toggle}>
        <IconButton
          size="small"
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          aria-expanded={open}
          sx={{ ml: -1, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
        <Typography variant={heading ? 'h6' : 'subtitle1'} sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>
      <Collapse in={open} timeout="auto">
        {children}
      </Collapse>
    </Box>
  );
}
