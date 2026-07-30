import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// Proprietary/legal notice (OVERVIEW.md item 2, logos added per item 15) — drafted text,
// shown on every page's footer and on the login page.
export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        py: 3,
        px: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="column" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
          <Box component="img" src="/branding/detecon-logo.png" alt="Detecon" sx={{ height: 24 }} />
          <Box component="img" src="/branding/tm-forum-logo.png" alt="TM Forum" sx={{ height: 24 }} />
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'center', maxWidth: 640 }}
        >
          This application is the proprietary property of Detecon International GmbH, a member
          of the Deutsche Telekom Group. The questionnaires and assessment methodology used
          within it are the proprietary property of TM Forum. © {year} Detecon International
          GmbH. All rights reserved.
        </Typography>
      </Stack>
    </Box>
  );
}
