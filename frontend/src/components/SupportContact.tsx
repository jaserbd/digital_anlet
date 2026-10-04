import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

// Who to contact when someone can't log in or reset their password (admin_management.md item 5).
const SUPPORT_EMAIL = 'jaserbin.rahman@detecon.com';

export function SupportContact({ prefix = 'Having trouble logging in?' }: { prefix?: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
      {prefix} Contact{' '}
      <Link href={`mailto:${SUPPORT_EMAIL}`} underline="hover">
        {SUPPORT_EMAIL}
      </Link>
      .
    </Typography>
  );
}
