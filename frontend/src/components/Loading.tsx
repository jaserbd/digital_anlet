import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

// Loading states (ONBOARDING_SECURITY_PLAN.md Phase 5) instead of a bare "Loading…" line.

/** A whole page (or route) waiting for its data. */
export function PageLoading() {
  return (
    <Box role="status" aria-label="Loading" sx={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <CircularProgress size={36} />
    </Box>
  );
}

/** A section or table waiting for its data: placeholder rows roughly the shape of the content. */
export function InlineLoading({ rows = 3 }: { rows?: number }) {
  return (
    <Stack role="status" aria-label="Loading" spacing={1}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={28} width={i === rows - 1 ? '60%' : '100%'} />
      ))}
    </Stack>
  );
}
