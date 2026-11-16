import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectMembersImportResultDto } from '@anlet/shared';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { projectMembersApi } from '../api/projectMembersApi';
import { ApiError } from '../api/client';
import {
  MEMBER_ROLE_LABELS,
  buildMembersTemplate,
  downloadWorkbook,
  readMembersWorkbook,
  type ParsedMembersWorkbook,
} from '../lib/projectTemplate';
import { useTemplateLists } from '../lib/templateLists';
import { ImportResults } from './ImportResults';
import { WelcomeEmailCheckbox } from './WelcomeEmailCheckbox';
import { useWelcomeEmailChoice } from '../lib/accountEmails';
import { SectionCard } from './SectionCard';

// A Project Admin's Excel member import (PROJECT_ADMIN_IMPORT_PLAN.md): Executives and Normal
// Users, with NatCo / Country / Working domain / Designation, into any organization of the
// project of the active context.
export function MembersImportSection() {
  const queryClient = useQueryClient();
  const contextQuery = useQuery({ queryKey: ['project-members', 'context'], queryFn: projectMembersApi.context });
  const templateLists = useTemplateLists();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMembersWorkbook | null>(null);
  const [result, setResult] = useState<ProjectMembersImportResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { sendWelcome, setSendWelcome, mailEnabled } = useWelcomeEmailChoice();
  // Fixed at import time, so unticking afterwards doesn't stop the sending.
  const [welcomeOnImport, setWelcomeOnImport] = useState(false);

  const importMembers = useMutation({
    mutationFn: () => projectMembersApi.import(parsed!.members!),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['opcos'] });
      void queryClient.invalidateQueries({ queryKey: ['reference-lists'] });
      void queryClient.invalidateQueries({ queryKey: ['project-members'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Import failed'),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError(null);
    try {
      setParsed(await readMembersWorkbook(file));
    } catch {
      setParsed(null);
      setError('Could not read this file as an Excel workbook');
    }
  }

  function handleReset() {
    setFileName(null);
    setParsed(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const context = contextQuery.data;
  const members = parsed?.members;

  return (
    <SectionCard title="Import members from Excel">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Add Executives and Normal Users to any organization of project <strong>{context?.projectName ?? '…'}</strong>{' '}
        in one go: download the template, fill in one row per person — with NatCo, Country, Working domain and
        Designation, so they don&apos;t have to complete their profile — and upload it. New accounts get a temporary
        password; download the results afterwards to forward them.
      </Typography>
      <Button
        variant="text"
        disabled={!context}
        onClick={() =>
          void buildMembersTemplate(context!, templateLists).then((workbook) =>
            downloadWorkbook(workbook, `anlet-members-${context!.projectName}.xlsx`),
          )
        }
        sx={{ mb: 2, mr: 1 }}
      >
        Download Excel template
      </Button>
      <Button variant="outlined" component="label" sx={{ mb: 2 }}>
        {fileName ?? 'Choose Excel file'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => void handleFileChange(e)}
        />
      </Button>

      {parsed && !result && (
        <Box sx={{ mb: 2 }}>
          {parsed.errors.map((e) => (
            <Alert key={e} severity="error" sx={{ mb: 1 }}>
              {e}
            </Alert>
          ))}
          {parsed.skipped.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              These rows will be skipped:
              <ul style={{ margin: 0 }}>
                {parsed.skipped.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Alert>
          )}
          {members && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {members.length} member{members.length === 1 ? '' : 's'} (
                {(['EXECUTIVE', 'NORMAL_USER'] as const)
                  .map((role) => `${members.filter((m) => m.role === role).length} ${MEMBER_ROLE_LABELS[role]}`)
                  .join(', ')}
                ) in {[...new Set(members.map((m) => m.organization))].join(', ')}.
              </Typography>
              <WelcomeEmailCheckbox checked={sendWelcome} onChange={setSendWelcome} mailEnabled={mailEnabled} plural />
              <Button variant="contained" disabled={importMembers.isPending} onClick={() => {
                  setWelcomeOnImport(sendWelcome);
                  importMembers.mutate();
                }} sx={{ mr: 1 }}>
                {importMembers.isPending ? 'Importing…' : 'Import members'}
              </Button>
            </>
          )}
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

      {result && <ImportResults rows={result.rows} fileName={`member-import-${result.projectName}`} onReset={handleReset} sendWelcomeEmails={welcomeOnImport} />}
    </SectionCard>
  );
}
