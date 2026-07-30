import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import type { BulkCreateUsersResultDto, BulkCreateUsersRowDto } from '@anlet/shared';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import { organizationsApi } from '../api/organizationsApi';
import { usersApi } from '../api/usersApi';
import { ApiError } from '../api/client';
import { exportRowsToXlsx } from '../lib/exportXlsx';

const ROLE_VALUES = new Set(['NORMAL_USER', 'EXECUTIVE']);

interface ParsedRow {
  row: number;
  data: BulkCreateUsersRowDto | null;
  parseError: string | null;
}

function parseCsv(text: string): ParsedRow[] {
  const workbook = XLSX.read(text, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName]!;
  const table = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false });
  const [header, ...dataRows] = table;
  if (!header) return [];

  const colIndex = (name: string) => header.findIndex((h) => String(h).trim().toLowerCase() === name);
  const emailCol = colIndex('email');
  const roleCol = colIndex('role');
  const orgCol = colIndex('organization');
  const passwordCol = colIndex('password');

  return dataRows.map((cells, i) => {
    const row = i + 1;
    const email = emailCol >= 0 ? String(cells[emailCol] ?? '').trim() : '';
    const roleRaw = roleCol >= 0 ? String(cells[roleCol] ?? '').trim().toUpperCase() : '';
    const organization = orgCol >= 0 ? String(cells[orgCol] ?? '').trim() : '';
    const password = passwordCol >= 0 ? String(cells[passwordCol] ?? '').trim() : '';

    if (!email) return { row, data: null, parseError: 'Missing email' };
    if (!ROLE_VALUES.has(roleRaw)) return { row, data: null, parseError: 'Role must be NORMAL_USER or EXECUTIVE' };
    if (!organization) return { row, data: null, parseError: 'Missing organization' };

    return {
      row,
      data: {
        email,
        role: roleRaw as 'NORMAL_USER' | 'EXECUTIVE',
        organization,
        password: password || undefined,
      },
      parseError: null,
    };
  });
}

// CSV bulk user creation (OVERVIEW.md item 4) — parsed entirely client-side with the
// already-installed `xlsx` package (this is the first file upload in the app; parsing in the
// browser and posting a plain JSON array avoids adding multer/multipart middleware for it).
// A bad row (unknown org, taken email, weak password) is reported per-row rather than
// aborting the whole batch — see users.service.ts's createUsersBulk.
export function BulkCreateUsersForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orgsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<BulkCreateUsersResultDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bulkCreate = useMutation({
    mutationFn: (rows: BulkCreateUsersRowDto[]) => usersApi.bulkCreate(rows),
    onSuccess: (data) => {
      setResults(data);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to upload CSV');
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setParsedRows(parseCsv(String(reader.result ?? '')));
      } catch {
        setError('Could not parse this file as CSV');
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  }

  const validRows = parsedRows.filter((r): r is ParsedRow & { data: BulkCreateUsersRowDto } => r.data != null);
  const invalidCount = parsedRows.length - validRows.length;

  function handleUpload() {
    setError(null);
    bulkCreate.mutate(validRows.map((r) => r.data));
  }

  function handleReset() {
    setFileName(null);
    setParsedRows([]);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDownloadResults() {
    if (!results) return;
    exportRowsToXlsx('bulk-user-creation-results', [
      {
        name: 'Results',
        columns: [
          { header: 'Row', key: 'row' },
          { header: 'Email', key: 'email' },
          { header: 'Status', key: 'status' },
          { header: 'Temp password', key: 'tempPassword' },
          { header: 'Error', key: 'error' },
        ],
        rows: results.map((r) => ({ ...r })),
      },
    ]);
  }

  return (
    <Box component="section">
      <Typography variant="h6" sx={{ mb: 1 }}>
        Bulk-create users from CSV
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Header row: <code>email,role,organization,password</code> — <code>password</code> is
        optional (a one-time password is generated if left blank), <code>role</code> is{' '}
        <code>NORMAL_USER</code> or <code>EXECUTIVE</code>, and <code>organization</code> must
        match an existing organization's name exactly.
        {orgsQuery.data && orgsQuery.data.length > 0 && (
          <>
            {' '}
            Existing organizations:{' '}
            {orgsQuery.data.map((o) => (
              <Chip key={o.id} label={o.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
            ))}
          </>
        )}
      </Typography>

      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        {fileName ?? 'Choose CSV file'}
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />
      </Button>

      {parsedRows.length > 0 && !results && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {validRows.length} row{validRows.length === 1 ? '' : 's'} ready to upload
            {invalidCount > 0 && `, ${invalidCount} row${invalidCount === 1 ? '' : 's'} with errors (will be skipped)`}.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300, mb: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Password</TableCell>
                  <TableCell>Issue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsedRows.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.data?.email ?? '—'}</TableCell>
                    <TableCell>{r.data?.role ?? '—'}</TableCell>
                    <TableCell>{r.data?.organization ?? '—'}</TableCell>
                    <TableCell>{r.data?.password ? '(set)' : 'generated'}</TableCell>
                    <TableCell>
                      {r.parseError && (
                        <Typography component="span" variant="caption" color="error">
                          {r.parseError}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={validRows.length === 0 || bulkCreate.isPending}
            sx={{ mr: 1 }}
          >
            {bulkCreate.isPending ? 'Uploading…' : `Create ${validRows.length} user${validRows.length === 1 ? '' : 's'}`}
          </Button>
          <Button variant="text" onClick={handleReset}>
            Cancel
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {results && (
        <Box>
          <Alert severity="warning" sx={{ mb: 1 }}>
            One-time passwords below are shown only once — copy or download them now before
            leaving this page.
          </Alert>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Temp password / error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.status === 'created' ? 'Created' : 'Error'}
                        color={r.status === 'created' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: r.tempPassword ? 'monospace' : undefined }}>
                      {r.tempPassword ?? r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="outlined" onClick={handleDownloadResults} sx={{ mr: 1 }}>
            Download results (Excel)
          </Button>
          <Button variant="text" onClick={handleReset}>
            Upload another file
          </Button>
        </Box>
      )}
    </Box>
  );
}
