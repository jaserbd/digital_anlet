import { createTheme } from '@mui/material/styles';

// Deutsche Telekom-brand design tokens, ported from the former theme.css into an MUI theme
// (OVERVIEW.md item 3 — replacing hand-rolled inline styles with a real design system).
export const theme = createTheme({
  palette: {
    primary: {
      main: '#e20074',
      dark: '#a40058',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1c1c1c',
    },
    background: {
      default: '#f7f5f6',
      paper: '#ffffff',
    },
    text: {
      primary: '#1c1c1c',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: [
      'Segoe UI',
      'system-ui',
      '-apple-system',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:nth-of-type(odd):not(:hover)': { backgroundColor: '#fafafa' },
          '&:hover': { backgroundColor: 'rgba(226, 0, 116, 0.06)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: '#e20074',
          color: '#ffffff',
          fontWeight: 600,
        },
        // stickyHeader's own default styling sets its own background and is composed after
        // the `head` variant above, so it otherwise wins the cascade and silently produces
        // an unreadable pale-on-pale header on any table using the `stickyHeader` prop.
        stickyHeader: {
          backgroundColor: '#e20074',
          color: '#ffffff',
        },
      },
    },
  },
});
