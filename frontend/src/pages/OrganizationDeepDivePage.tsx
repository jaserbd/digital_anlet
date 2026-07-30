import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import { organizationsApi } from '../api/organizationsApi';
import { opCoApi } from '../api/opCoApi';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { BenchmarkTable } from '../components/BenchmarkTable';
import { CombinedBenchmarkTable } from '../components/CombinedBenchmarkTable';
import { QuestionnaireExecutiveDetail, useQuestionnaireExecutiveData } from '../components/QuestionnaireExecutiveDetail';
import { GroupedCommentsList, type CommentEntry } from '../components/GroupedCommentsList';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import {
  buildOrganizationReportPdfSections,
  buildOrganizationReportSheets,
  type OrganizationReportBenchmarkPart,
  type OrganizationReportDetail,
} from '../lib/organizationReport';
import { exportSectionsToPdf } from '../lib/exportPdf';

// Admin's per-organization deep-dive (THIRD_REVIEW.md item 8, brought to full parity with
// ExecutivePage.tsx's own view by ADMIN.md item 2) — reached by typing/selecting an
// organization in AdminPage's benchmarking table, or clicking it in the new Organizations
// list. Shows that org's NatCos, an HVS selector (including the Core FM+Stability combined
// group, like Executive), the same Respondents/Answer-distribution/Comment-Collection tables
// an Executive of this org would see, plus admin-exclusive extras: a Comments column with
// per-NatCo comment drill-down, and per-NatCo answer-distribution scoping.
export function OrganizationDeepDivePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const organizationId = orgId!;
  const navigate = useNavigate();

  const organizationsQuery = useQuery({ queryKey: ['organizations'], queryFn: organizationsApi.list });
  const organization = organizationsQuery.data?.find((o) => o.id === organizationId);

  const opCosQuery = useQuery({
    queryKey: ['opcos', organizationId],
    queryFn: () => opCoApi.list(organizationId),
  });

  const hvsEntriesQuery = useQuery({ queryKey: ['hvs-entries'], queryFn: questionnaireApi.listHvsEntries });
  const [hvsKey, setHvsKey] = useState('');
  const effectiveEntry = hvsEntriesQuery.data?.find((e) => e.key === hvsKey) ?? hvsEntriesQuery.data?.[0];
  const isGroup = effectiveEntry?.kind === 'group';

  const opCoBenchmarkQuery = useQuery({
    queryKey: ['opco-benchmarking', organizationId, effectiveEntry?.key],
    queryFn: () => insightsApi.getOpCoBenchmarkingSummary(organizationId, effectiveEntry!.key),
    enabled: !!effectiveEntry && !isGroup,
  });
  const combinedQuery = useQuery({
    queryKey: ['combined-opco-benchmarking', organizationId, effectiveEntry?.key],
    queryFn: () => insightsApi.getCombinedOpCoBenchmarkingSummary(organizationId, effectiveEntry!.key),
    enabled: !!effectiveEntry && isGroup,
  });
  const questionnaireQuery = useQuery({
    queryKey: ['questionnaire', effectiveEntry?.key],
    queryFn: () => questionnaireApi.get(effectiveEntry!.questionnaireCodes[0]!),
    enabled: !!effectiveEntry && !isGroup,
  });

  // Same two query-key slots regardless of branch (Rules of Hooks) — codeB is simply
  // undefined (queries disabled) outside the Core FM+Stability group case.
  const codeA = effectiveEntry?.questionnaireCodes[0];
  const codeB = effectiveEntry?.questionnaireCodes[1];
  const detailA = useQuestionnaireExecutiveData(organizationId, codeA);
  const detailB = useQuestionnaireExecutiveData(organizationId, isGroup ? codeB : undefined);
  const details = isGroup ? [detailA, detailB] : [detailA];

  const [selectedOpCoId, setSelectedOpCoId] = useState<string | null>(null);
  const [commentsForOpCoId, setCommentsForOpCoId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // Synchronous guard against a click dispatching two events in the same tick — both would
  // otherwise see the pre-update isGeneratingPdf value and start overlapping generations
  // (MANAGEMENT_REVIEW_4.md item 4's PDF-generation race, found via browser testing).
  const isGeneratingPdfRef = useRef(false);

  const benchmarkReady = isGroup ? !!combinedQuery.data : !!(opCoBenchmarkQuery.data && questionnaireQuery.data);
  const detailsReady = details.every((d) => d.questionnaireQuery.data && d.summaryQuery.data && d.drilldownQuery.data);
  const reportReady = !!effectiveEntry && benchmarkReady && detailsReady;

  function reportInputs(): { benchmark: OrganizationReportBenchmarkPart; details: OrganizationReportDetail[] } {
    const benchmark: OrganizationReportBenchmarkPart =
      isGroup && combinedQuery.data
        ? { kind: 'combined', rows: combinedQuery.data.rows }
        : opCoBenchmarkQuery.data && questionnaireQuery.data
          ? { kind: 'single', rows: opCoBenchmarkQuery.data.rows, subScenarios: questionnaireQuery.data.subScenarios }
          : null;
    const reportDetails: OrganizationReportDetail[] = details.map((d) => ({
      questionnaire: d.questionnaireQuery.data!,
      summary: d.summaryQuery.data!,
      drilldown: d.drilldownQuery.data,
    }));
    return { benchmark, details: reportDetails };
  }

  function handleDownloadAll() {
    if (!effectiveEntry || !reportReady) return;
    const { benchmark, details: reportDetails } = reportInputs();
    const sheets = buildOrganizationReportSheets(benchmark, reportDetails, { hideOrganizationColumn: true });
    exportRowsToXlsx(`org-${organizationId}-${effectiveEntry.key}-all`, sheets);
  }

  async function handleDownloadPdf() {
    if (!effectiveEntry || !reportReady || isGeneratingPdfRef.current) return;
    isGeneratingPdfRef.current = true;
    setIsGeneratingPdf(true);
    try {
      const { benchmark, details: reportDetails } = reportInputs();
      const sections = await buildOrganizationReportPdfSections(benchmark, reportDetails, { hideOrganizationColumn: true });
      exportSectionsToPdf(
        `org-${organizationId}-${effectiveEntry.key}-report`,
        `${organization?.name ?? 'Organization'} — ${effectiveEntry.name} report`,
        sections,
      );
    } finally {
      isGeneratingPdfRef.current = false;
      setIsGeneratingPdf(false);
    }
  }

  if (hvsEntriesQuery.isLoading || opCosQuery.isLoading) {
    return (
      <PageShell title="Organization" maxWidth={1400}>
        <Typography color="text.secondary">Loading…</Typography>
      </PageShell>
    );
  }

  const opCoName = (opCoId: string | null) => opCosQuery.data?.find((o) => o.id === opCoId)?.name;

  const commentEntries: CommentEntry[] = commentsForOpCoId
    ? (detailA.drilldownQuery.data?.comments ?? [])
        .filter((c) => c.respondent.opCoId === commentsForOpCoId)
        .map((c) => ({
          questionId: c.questionId,
          commentText: c.commentText,
          subScenarioIds: c.subScenarioIds,
          appliesToNone: c.appliesToNone,
          respondent: {
            email: c.respondent.email,
            opCoName: c.respondent.opCoName,
            country: c.respondent.country,
            workingDomain: c.respondent.workingDomain,
            designation: c.respondent.designation,
          },
        }))
    : [];

  return (
    <PageShell title={organization?.name ?? 'Organization'} maxWidth={1400}>
      <Button onClick={() => navigate('/admin')} sx={{ mb: 3 }}>
        ← Back to Admin
      </Button>

      <SectionCard title="NatCos">
        <List disablePadding>
          {(opCosQuery.data ?? []).map((o) => (
            <ListItem key={o.id} disableGutters>
              <ListItemText primary={`${o.name} (${o.country})`} />
            </ListItem>
          ))}
          {(opCosQuery.data ?? []).length === 0 && (
            <Typography color="text.secondary">
              No NatCos yet — for a small organization like this, NatCo and Organization are the same.
            </Typography>
          )}
        </List>
      </SectionCard>

      <SectionCard title="Comparison">
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <TextField
            select
            label="Assessment"
            value={effectiveEntry?.key ?? ''}
            onChange={(e) => setHvsKey(e.target.value)}
            sx={{ minWidth: 320 }}
          >
            {hvsEntriesQuery.data?.map((entry) => (
              <MenuItem key={entry.key} value={entry.key}>
                {entry.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" onClick={handleDownloadAll} disabled={!reportReady}>
              Download all (Excel)
            </Button>
            <Button variant="contained" onClick={handleDownloadPdf} disabled={!reportReady || isGeneratingPdf}>
              {isGeneratingPdf ? 'Generating PDF…' : 'Download PDF report'}
            </Button>
          </Stack>
        </Stack>

        {isGroup ? (
          combinedQuery.data ? (
            <>
              <CombinedBenchmarkTable
                rows={combinedQuery.data.rows}
                hideOrganizationColumn
                exportFileNamePrefix={`org-${organizationId}-${effectiveEntry?.key ?? 'benchmarking'}`}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Combined avg is the 50/50 blend of Fault Management and Stability per the Core
                Domain guideline.
              </Typography>
            </>
          ) : (
            <Typography color="text.secondary">Loading…</Typography>
          )
        ) : (
          <>
            {opCoBenchmarkQuery.isLoading && <Typography color="text.secondary">Loading…</Typography>}
            {opCoBenchmarkQuery.data && questionnaireQuery.data && (
              <BenchmarkTable
                rows={opCoBenchmarkQuery.data.rows}
                subScenarios={questionnaireQuery.data.subScenarios}
                hideOrganizationColumn
                showCommentsColumn
                onCommentsClick={(row) => setCommentsForOpCoId(row.opCoId)}
                onRowClick={(row) => setSelectedOpCoId(row.opCoId)}
                exportFileNamePrefix={`org-${organizationId}-${questionnaireQuery.data.code}`}
              />
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Click a NatCo to scope the answer distribution below to it. Click a Comments count
              to see every comment collected from that NatCo, grouped by Cognitive Activity.
            </Typography>
          </>
        )}
      </SectionCard>

      {commentsForOpCoId && effectiveEntry && !isGroup && questionnaireQuery.data && (
        <SectionCard
          title={`Comments — ${opCoName(commentsForOpCoId) ?? organization?.name}`}
          action={
            <Button size="small" onClick={() => setCommentsForOpCoId(null)}>
              Close
            </Button>
          }
        >
          <GroupedCommentsList
            questions={questionnaireQuery.data.questions}
            subScenarios={questionnaireQuery.data.subScenarios}
            comments={commentEntries}
            domain={questionnaireQuery.data.networkType}
            hvs={questionnaireQuery.data.hvsCategory}
          />
        </SectionCard>
      )}

      {selectedOpCoId && !isGroup && (
        <Button variant="outlined" onClick={() => setSelectedOpCoId(null)} sx={{ mb: 2 }}>
          Show all NatCos
        </Button>
      )}

      {(effectiveEntry?.questionnaireCodes ?? []).map((code) => (
        <Box key={code} sx={{ mb: 3 }}>
          <QuestionnaireExecutiveDetail
            organizationId={organizationId}
            questionnaireCode={code}
            opCoScopeId={isGroup ? null : selectedOpCoId}
            organizationSwitcher={{
              organizations: organizationsQuery.data ?? [],
              currentOrganizationId: organizationId,
              onChange: (id) => navigate(`/admin/organizations/${id}`),
            }}
          />
        </Box>
      ))}
    </PageShell>
  );
}
