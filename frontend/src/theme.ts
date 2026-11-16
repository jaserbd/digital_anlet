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
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700, letterSpacing: '-0.005em' },
  },
  shape: {
    borderRadius: 8,
  },
  // Visual polish (ONBOARDING_SECURITY_PLAN.md Phase 5): softer table headers, consistent form
  // fonts, rounder alerts/chips, visible keyboard focus — theme-level so every page follows.
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Plain <textarea>/<select>/<input> (comment editors, radio tables) otherwise fall back to
        // the browser's monospace/system font instead of the app's.
        'input, textarea, select, button': { font: 'inherit' },
        textarea: { borderRadius: 8, border: '1px solid #d6cfd3', padding: '8px 10px', backgroundColor: '#fff' },
        'textarea:focus': { outline: '2px solid rgba(226,0,116,0.35)', borderColor: '#e20074' },
        ':focus-visible': { outline: '2px solid #e20074', outlineOffset: 2 },
        'input[type=radio], input[type=checkbox]': { accentColor: '#e20074' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          alignItems: 'center',
          '&.MuiAlert-standardWarning': { border: '1px solid #f3d9a8' },
          '&.MuiAlert-standardInfo': { border: '1px solid #c9e3f5' },
          '&.MuiAlert-standardSuccess': { border: '1px solid #c6e6c9' },
          '&.MuiAlert-standardError': { border: '1px solid #f3c3c3' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#ffffff' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 8, borderRadius: 4, backgroundColor: 'rgba(226,0,116,0.12)' },
        bar: { borderRadius: 4 },
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
          '&:nth-of-type(odd):not(:hover)': { backgroundColor: '#fcfafb' },
          '&:hover': { backgroundColor: 'rgba(226, 0, 116, 0.06)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
        outlined: { borderColor: '#ebe4e8' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // Soft brand tint with a magenta rule instead of a solid magenta bar — dense tables
        // (benchmarks, comment collections) read calmer, and the header still says "brand".
        head: {
          backgroundColor: '#fbeef5',
          color: '#5c0030',
          fontWeight: 700,
          borderBottom: '2px solid #e20074',
        },
        // stickyHeader's own default styling sets its own background and is composed after
        // the `head` variant above, so it otherwise wins the cascade and silently produces
        // an unreadable pale-on-pale header on any table using the `stickyHeader` prop.
        stickyHeader: {
          backgroundColor: '#fbeef5',
          color: '#5c0030',
        },
      },
    },
  },
});
