import { useState } from 'react';
import type { OrganizationDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

interface OrganizationAutocompleteProps {
  organizations: OrganizationDto[];
  onSelect: (org: OrganizationDto) => void;
  placeholder?: string;
}

// Typeahead org search (THIRD_REVIEW.md item 8) — replaces a plain "type the exact org name"
// filter box. Client-side substring filtering is fine here: organization counts are small
// (Admin-managed, not self-service), so there's no need for a server-side `?search=` param.
// Generic enough to serve two call sites with different onSelect behavior: item 7's
// QuestionnaireSettingsSection (selecting just sets local state) and item 8's benchmarking
// table Organization column (selecting navigates to the Organization Deep-Dive page).
export function OrganizationAutocomplete({
  organizations,
  onSelect,
  placeholder = 'Type an organization name…',
}: OrganizationAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const matches =
    query.trim().length === 0
      ? organizations
      : organizations.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));

  function handleSelect(org: OrganizationDto) {
    setQuery(org.name);
    setIsOpen(false);
    onSelect(org);
  }

  return (
    <Box sx={{ position: 'relative', maxWidth: 320 }}>
      <TextField
        value={query}
        placeholder={placeholder}
        size="small"
        fullWidth
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && matches.length > 0 && (
        <Paper
          elevation={4}
          sx={{ position: 'absolute', zIndex: 1, top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto' }}
        >
          <List dense disablePadding>
            {matches.map((org) => (
              <ListItemButton key={org.id} onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(org)}>
                <ListItemText primary={org.name} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}
