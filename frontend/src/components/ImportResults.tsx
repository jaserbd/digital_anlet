import { useEffect, useRef, useState } from 'react';
import type { AccountEmailResultDto, ProjectImportResultRowDto } from '@anlet/shared';
import LinearProgress from '@mui/material/LinearProgress';
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
import { usersApi } from '../api/usersApi';
import { ApiError } from '../api/client';
import { WELCOME_EMAIL_BATCH_SIZE, accountEmailOutcomeText } from '../lib/accountEmails';

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

/** Sends the new accounts' welcome emails (ONBOARDING_SECURITY_PLAN.md Phase 3) in batches, so
 * no request runs long and progress shows; results keyed by user id. */
function useWelcomeEmails(userIds: string[], enabled: boolean) {
  const [results, setResults] = useState<Map<string, AccountEmailResultDto>>(new Map());
  const [running, setRunning] = useState(false);
  const started = useRef(false);

  async function send(ids: string[]) {
    setRunning(true);
    for (let i = 0; i < ids.length; i += WELCOME_EMAIL_BATCH_SIZE) {
      const batch = ids.slice(i, i + WELCOME_EMAIL_BATCH_SIZE);
      let batchResults: AccountEmailResultDto[];
      try {
        batchResults = await usersApi.sendWelcomeEmails(batch);
      } catch (err) {
        const error = err instanceof ApiError ? err.message : 'Request failed';
        batchResults = batch.map((userId) => ({ userId, email: '', outcome: 'failed' as const, error }));
      }
      setResults((prev) => {
        const next = new Map(prev);
        for (const r of batchResults) next.set(r.userId, r);
        return next;
      });
    }
    setRunning(false);
  }

  useEffect(() => {
    // Once per result set (React's dev double-mount included).
    if (!enabled || started.current || userIds.length === 0) return;
    started.current = true;
    void send(userIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const retryIds = userIds.filter((id) => results.get(id)?.outcome === 'failed');
  return { results, running, retry: () => void send(retryIds), retryCount: retryIds.length };
}

export function ImportResults({
  rows,
  fileName,
  onReset,
  sendWelcomeEmails = false,
}: {
  rows: ProjectImportResultRowDto[];
  fileName: string;
  onReset: () => void;
  // Email every newly created account a set-password link right away.
  sendWelcomeEmails?: boolean;
}) {
  // Results split into project setup (organizations, questionnaires, NatCos) and users
  // (USERS_TABLE_PLAN.md) — on screen and as two sheets in the downloaded workbook.
  const setupRows = rows.filter((r) => r.sheet !== 'Members').sort((a, b) => SETUP_ORDER[a.sheet] - SETUP_ORDER[b.sheet]);
  const userRows = rows.filter((r) => r.sheet === 'Members');
  const newUserIds = userRows.flatMap((r) => (r.userId ? [r.userId] : []));
  const welcome = useWelcomeEmails(newUserIds, sendWelcomeEmails);
  const welcomeOf = (r: ProjectImportResultRowDto) => (r.userId ? welcome.results.get(r.userId) : undefined);
  // Once the welcome email went out, the temporary password isn't needed (or kept) anymore.
  const passwordOf = (r: ProjectImportResultRowDto) => (welcomeOf(r)?.outcome === 'sent' ? undefined : r.tempPassword);
  const sentCount = newUserIds.filter((id) => welcome.results.get(id)?.outcome === 'sent').length;
  const pendingPasswords = userRows.some((r) => passwordOf(r));

  function handleDownload() {
    exportRowsToXlsx(fileName, [
      {
        name: 'Users',
        columns: [
          { header: 'Email', key: 'label' },
          { header: 'Organization', key: 'organization' },
          { header: 'Role', key: 'role' },
          { header: 'Status', key: 'status' },
          ...(sendWelcomeEmails ? [{ header: 'Welcome email', key: 'welcome' }] : []),
          { header: 'Temporary password', key: 'tempPassword' },
          { header: 'Error', key: 'error' },
          { header: 'Note', key: 'warning' },
        ],
        rows: userRows.map((r) => {
          const w = welcomeOf(r);
          return {
            ...r,
            role: r.role ? MEMBER_ROLE_LABELS[r.role] : '',
            status: statusLabel(r),
            welcome: w ? accountEmailOutcomeText(w) : '',
            tempPassword: passwordOf(r) ?? '',
          };
        }),
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
      {sendWelcomeEmails && newUserIds.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {welcome.running
              ? `Sending welcome emails… ${welcome.results.size} / ${newUserIds.length}`
              : `Welcome emails sent: ${sentCount} / ${newUserIds.length}`}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(welcome.results.size / newUserIds.length) * 100}
            sx={{ height: 6, borderRadius: 3 }}
          />
          {!welcome.running && welcome.retryCount > 0 && (
            <Button size="small" onClick={welcome.retry} sx={{ mt: 0.5 }}>
              Retry {welcome.retryCount} failed
            </Button>
          )}
        </Box>
      )}
      {pendingPasswords && !welcome.running && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Temporary passwords are shown only once — download the results now before leaving this page.
          {sendWelcomeEmails && ' They are listed only for people whose welcome email was not sent.'}
        </Alert>
      )}
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
              <TableCell>{sendWelcomeEmails ? 'Welcome email / password / error' : 'Temporary password / error'}</TableCell>
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
                <TableCell>
                  {welcomeOf(r) && (
                    <Typography variant="body2" color={welcomeOf(r)!.outcome === 'sent' ? 'success.main' : 'warning.dark'}>
                      {accountEmailOutcomeText(welcomeOf(r)!)}
                    </Typography>
                  )}
                  {sendWelcomeEmails && r.userId && !welcomeOf(r) ? (
                    <Typography variant="body2" color="text.secondary">
                      Waiting…
                    </Typography>
                  ) : passwordOf(r) ? (
                    <Box component="span" sx={{ fontFamily: 'monospace' }}>
                      {passwordOf(r)}
                    </Box>
                  ) : (
                    (r.error ?? '')
                  )}
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
      <Button variant="outlined" onClick={handleDownload} disabled={welcome.running} sx={{ mr: 1 }}>
        Download results (Excel)
      </Button>
      <Button variant="text" onClick={onReset}>
        Import another file
      </Button>
    </Box>
  );
}
