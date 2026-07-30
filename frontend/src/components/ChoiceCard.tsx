import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

interface ChoiceCardProps {
  label: ReactNode;
  description?: ReactNode;
  onClick: () => void;
  sx?: SxProps<Theme>;
}

// Elevated tile for "pick one of these" screens (OVERVIEW.md item 5) — the Domain/HVS/
// assessment pickers previously rendered plain stacked <button>s. Reserved for genuine choice
// screens with a handful of prominent options; dense admin lists intentionally keep a
// compact List/table treatment instead (see CLAUDE.md's design-system notes in theme.ts).
export function ChoiceCard({ label, description, onClick, sx }: ChoiceCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: { xs: '100%', sm: 260 },
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
        transition: 'box-shadow 0.15s, transform 0.15s',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
        ...sx,
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </CardActionArea>
    </Card>
  );
}
