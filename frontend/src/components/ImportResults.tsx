import type { ProjectImportResultRowDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import { MEMBER_ROLE_LABELS } from '../lib/projectTemplate';

// Results of an Excel import — the Application Admin's project import and the Project Admin's
// member import (PROJECT_ADMIN_IMPORT_PLAN.md): users (with temporary passwords) and, for a
// project import, the project setup; on screen and as a downloadable workbook.

const STATUS_LABELS: Record<ProjectImportResultRowDto['status'], string> = {
  created: 'Created',
  existing: 'Already existed',
  'membership-added': 'Added to organization',
  error: 'Error',
};

const SETUP_ORDER: Record<ProjectImportResultRowDto['sheet'], number> = {
  Project: 0,
  Questionnaires: 1,
  NatCos: 2,
  Members: 3,
};

const SETUP_TYPE_LABELS: Record<ProjectImportResultRowDto['sheet'], string> = {
  Project: 'Organization',
  Questionnaires: 'Questionnaire',
  NatCos: 'NatCo',
  Members: 'User',
};

function statusLabel(row: ProjectImportResultRowDto): string {
  if (row.sheet === 'Questionnaires' && row.status !== 'error') {
    return row.status === 'created' ? 'Selected' : 'Already selected';
  }
  return STATUS_LABELS[row.status];
}

export function ImportResults({
  rows,
  fileName,
  onReset,
}: {
  rows: ProjectImportResultRowDto[];
  fileName: string;
  onReset: () => void;
}) {
  // Results split into project setup (organizations, questionnaires, NatCos) and users
  // (USERS_TABLE_PLAN.md) — on screen and as two sheets in the downloaded workbook.
  const setupRows = rows.filter((r) => r.sheet !== 'Members').sort((a, b) => SETUP_ORDER[a.sheet] - SETUP_ORDER[b.sheet]);
  const userRows = rows.filter((r) => r.sheet === 'Members');

  function handleDownload() {
    exportRowsToXlsx(fileName, [
      {
        name: 'Users',
        columns: [
          { header: 'Email', key: 'label' },
          { header: 'Organization', key: 'organization' },
          { header: 'Role', key: 'role' },
          { header: 'Status', key: 'status' },
          { header: 'Temporary password', key: 'tempPassword' },
          { header: 'Error', key: 'error' },
          { header: 'Note', key: 'warning' },
        ],
        rows: userRows.map((r) => ({ ...r, role: r.role ? MEMBER_ROLE_LABELS[r.role] : '', status: statusLabel(r) })),
      },
      ...(setupRows.length > 0
        ? [
            {
              name: 'Project setup',
              columns: [
                { header: 'Type', key: 'type' },
                { header: 'Name', key: 'label' },
                { header: 'Organization', key: 'organization' },
                { header: 'Status', key: 'status' },
                { header: 'Error', key: 'error' },
              ],
              rows: setupRows.map((r) => ({ ...r, type: SETUP_TYPE_LABELS[r.sheet], status: statusLabel(r) })),
            },
          ]
        : []),
    ]);
  }

  return (
    <Box>
      <Alert severity="warning" sx={{ mb: 1 }}>
        Temporary passwords are shown only once — download the results now before leaving this page.
      </Alert>
      <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>
        Users
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Temporary password / error</TableCell>
              <TableCell>Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {userRows.map((r) => (
              <TableRow key={`${r.sheet}-${r.row}`}>
                <TableCell>{r.label}</TableCell>
                <TableCell>{r.organization ?? ''}</TableCell>
                <TableCell>{r.role ? MEMBER_ROLE_LABELS[r.role] : ''}</TableCell>
                <TableCell>
                  <Chip size="small" label={statusLabel(r)} color={r.status === 'error' ? 'error' : 'success'} />
                </TableCell>
                <TableCell sx={{ fontFamily: r.tempPassword ? 'monospace' : undefined }}>
                  {r.tempPassword ?? r.error ?? ''}
                </TableCell>
                <TableCell sx={{ color: 'warning.dark' }}>{r.warning ?? ''}</TableCell>
              </TableRow>
            ))}
            {userRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>No users in this file.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {setupRows.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Project setup
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1, maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {setupRows.map((r) => (
                  <TableRow key={`${r.sheet}-${r.row}`}>
                    <TableCell>{SETUP_TYPE_LABELS[r.sheet]}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.sheet === 'NatCos' ? (r.organization ?? '') : ''}</TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(r)} color={r.status === 'error' ? 'error' : 'success'} />
                    </TableCell>
                    <TableCell>{r.error ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      <Button variant="outlined" onClick={handleDownload} sx={{ mr: 1 }}>
        Download results (Excel)
      </Button>
      <Button variant="text" onClick={onReset}>
        Import another file
      </Button>
    </Box>
  );
}
