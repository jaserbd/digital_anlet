import type { ReferenceListCategory } from '@anlet/shared';
import { useQuery } from '@tanstack/react-query';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { referenceListsApi } from '../api/referenceListsApi';

const CATEGORY_LABELS: Record<ReferenceListCategory, string> = {
  COUNTRY: 'Country',
  WORKING_DOMAIN: 'Working Domain',
  DESIGNATION: 'Designation',
  NATCO_NAME: 'NatCo Name',
};

// Strict dropdown backed by an Admin-managed reference list (see referenceLists module) —
// replaces what used to be free-text entry for Country/Working Domain/Designation/NatCo
// Name, so these fields can no longer drift in spelling. There is no "type a new value"
// escape hatch here by design: an Admin adds new valid values via ManageReferenceListSection
// first.
export function ReferenceListSelect({
  category,
  organizationId,
  label,
  value,
  onChange,
  required = false,
  fullWidth = false,
}: {
  category: ReferenceListCategory;
  organizationId?: string;
  label?: string;
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
  fullWidth?: boolean;
}) {
  const isOrgScoped = category === 'NATCO_NAME';
  const query = useQuery({
    queryKey: ['reference-lists', category, organizationId],
    queryFn: () => referenceListsApi.list(category, organizationId),
    enabled: !isOrgScoped || !!organizationId,
  });

  const entries = query.data ?? [];
  const resolvedLabel = label ?? CATEGORY_LABELS[category];

  return (
    <TextField
      select
      label={required ? resolvedLabel : `${resolvedLabel} (optional)`}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth}
      helperText={
        query.isSuccess && entries.length === 0
          ? `No ${resolvedLabel} options yet — ask your Admin to add one.`
          : undefined
      }
    >
      <MenuItem value="">
        <em>{query.isLoading ? 'Loading…' : `Select ${resolvedLabel}`}</em>
      </MenuItem>
      {entries.map((entry) => (
        <MenuItem key={entry.id} value={entry.name}>
          {entry.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
