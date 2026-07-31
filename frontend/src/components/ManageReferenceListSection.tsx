import { useState, type FormEvent } from 'react';
import type { ReferenceListCategory } from '@anlet/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { referenceListsApi } from '../api/referenceListsApi';
import { ApiError } from '../api/client';
import { SectionCard } from './SectionCard';
import { CollapsibleTable } from './CollapsibleTable';

// Admin CRUD for one of the four reference-list categories backing the Country/Working
// Domain/Designation/NatCo Name dropdowns (see ReferenceListSelect.tsx) — mirrors
// AdminManagementPage.tsx's ManageOrganizationsSection shape. For the org-scoped NATCO_NAME
// category, the parent supplies organizationId (shares the same org selector as
// ManageOpCosSection so Admin picks an org once for both).
export function ManageReferenceListSection({
  title,
  category,
  organizationId,
}: {
  title: string;
  category: ReferenceListCategory;
  organizationId?: string;
}) {
  const queryClient = useQueryClient();
  const isOrgScoped = category === 'NATCO_NAME';
  const listQuery = useQuery({
    queryKey: ['reference-lists', category, organizationId],
    queryFn: () => referenceListsApi.list(category, organizationId),
    enabled: !isOrgScoped || !!organizationId,
  });

  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string } | null>(null);

  const createEntry = useMutation({
    mutationFn: () => referenceListsApi.create({ category, name, organizationId }),
    onSuccess: (entry) => {
      setMessage({ kind: 'success', text: `Added "${entry.name}"` });
      setName('');
      void queryClient.invalidateQueries({
        queryKey: ['reference-lists', category, organizationId],
      });
    },
    onError: (err) => {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'Failed to add entry',
      });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => referenceListsApi.delete(id),
    onSuccess: () => {
      setRowMessage(null);
      void queryClient.invalidateQueries({
        queryKey: ['reference-lists', category, organizationId],
      });
    },
    onError: (err, id) => {
      setRowMessage({ id, text: err instanceof ApiError ? err.message : 'Failed to delete entry' });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    createEntry.mutate();
  }

  function handleDelete(id: string, entryName: string) {
    if (!window.confirm(`Delete "${entryName}"? This cannot be undone.`)) return;
    setRowMessage(null);
    deleteEntry.mutate(id);
  }

  if (isOrgScoped && !organizationId) {
    return (
      <SectionCard title={title}>
        <Typography color="text.secondary">
          Select an organization above to manage its NatCo Name list.
        </Typography>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={title}>
      <Stack component="form" onSubmit={handleSubmit} direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          required
          placeholder="New value"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
        />
        <Button type="submit" variant="contained" disabled={createEntry.isPending}>
          {createEntry.isPending ? 'Adding…' : 'Add'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.kind === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <CollapsibleTable label={title} count={listQuery.data?.length ?? 0}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.name}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={deleteEntry.isPending}
                      onClick={() => handleDelete(entry.id, entry.name)}
                    >
                      Delete
                    </Button>
                    {rowMessage?.id === entry.id && (
                      <Typography component="span" variant="caption" color="error" sx={{ ml: 1 }}>
                        {rowMessage.text}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {listQuery.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>No entries yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CollapsibleTable>
    </SectionCard>
  );
}
