import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

interface ChoiceCardProps {
  label: ReactNode;
  description?: ReactNode;
  // Domain / HVS icon (lib/choiceIcons.tsx), shown in a tinted badge left of the label.
  icon?: ReactNode;
  onClick: () => void;
  sx?: SxProps<Theme>;
}

// Elevated tile for "pick one of these" screens (OVERVIEW.md item 5) — the Domain/HVS/
// assessment pickers previously rendered plain stacked <button>s. Reserved for genuine choice
// screens with a handful of prominent options; dense admin lists intentionally keep a
// compact List/table treatment instead (see CLAUDE.md's design-system notes in theme.ts).
export function ChoiceCard({ label, description, icon, onClick, sx }: ChoiceCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: { xs: '100%', sm: 260 },
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
        transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
        '&:hover': { boxShadow: '0 8px 24px rgba(226,0,116,0.14)', transform: 'translateY(-2px)', borderColor: 'primary.main' },
        ...sx,
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 2 }}>
        {icon && (
          <Box
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(226,0,116,0.08)',
              color: 'primary.main',
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
            {label}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}
