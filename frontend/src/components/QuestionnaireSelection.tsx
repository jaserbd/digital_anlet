import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { HvsListItemDto } from '@anlet/shared';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ApiError } from '../api/client';

// A project's questionnaires (PROJECT_QUESTIONNAIRES_PLAN.md), chosen per HVS item — Core
// Fault Management + Stability is one item, since the Core Domain score needs both halves.
// Shared by the Application Admin's Projects list and the Project Admin's Manage project page
// (PROJECT_ADMIN_QUESTIONNAIRES_PLAN.md); `onSave` sends the selection to the right endpoint.
export function QuestionnaireSelection({
  selectedCodes,
  hvsEntries,
  onSave,
  onSaved,
  showSelectedChips = false,
}: {
  selectedCodes: string[];
  hvsEntries: HvsListItemDto[];
  onSave: (questionnaireCodes: string[]) => Promise<unknown>;
  onSaved: () => void;
  // List the selected items even when all are selected (a page with room for it).
  showSelectedChips?: boolean;
}) {
  const isSelected = (entry: HvsListItemDto, codes: string[]) =>
    entry.questionnaireCodes.every((code) => codes.includes(code));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => onSave(draft),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save questionnaires'),
  });

  const selected = hvsEntries.filter((e) => isSelected(e, selectedCodes));

  if (!editing) {
    return (
      <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <Typography variant="body2" color="text.secondary">
          {selected.length === hvsEntries.length ? `All (${hvsEntries.length})` : `${selected.length} of ${hvsEntries.length}`}
        </Typography>
        {(showSelectedChips || selected.length < hvsEntries.length) && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((e) => (
              <Chip key={e.key} size="small" label={e.name} />
            ))}
          </Stack>
        )}
        <Button
          size="small"
          onClick={() => {
            setDraft(selectedCodes);
            setError(null);
            setEditing(true);
          }}
        >
          Edit questionnaires
        </Button>
      </Stack>
    );
  }

  return (
    <Stack sx={{ alignItems: 'flex-start' }}>
      {hvsEntries.map((entry) => (
        <FormControlLabel
          key={entry.key}
          label={<Typography variant="body2">{entry.name}</Typography>}
          control={
            <Checkbox
              size="small"
              checked={isSelected(entry, draft)}
              onChange={(e) =>
                setDraft((current) =>
                  e.target.checked
                    ? [...new Set([...current, ...entry.questionnaireCodes])]
                    : current.filter((code) => !entry.questionnaireCodes.includes(code)),
                )
              }
            />
          }
        />
      ))}
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <Button size="small" variant="contained" disabled={draft.length === 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="small" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </Stack>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Stack>
  );
}
