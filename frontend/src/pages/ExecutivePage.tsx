import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useAuth } from '../context/AuthContext';
import { questionnaireApi } from '../api/questionnaireApi';
import { insightsApi } from '../api/insightsApi';
import { PageShell } from '../components/PageShell';
import { SectionCard } from '../components/SectionCard';
import { BenchmarkTable } from '../components/BenchmarkTable';
import { CombinedBenchmarkTable } from '../components/CombinedBenchmarkTable';
import { QuestionnaireExecutiveDetail, useQuestionnaireExecutiveData } from '../components/QuestionnaireExecutiveDetail';
import { exportRowsToXlsx } from '../lib/exportXlsx';
import {
  buildOrganizationReportPdfSections,
  buildOrganizationReportSheets,
  type OrganizationReportBenchmarkPart,
  type OrganizationReportDetail,
} from '../lib/organizationReport';
import { exportSectionsToPdf } from '../lib/exportPdf';

export function ExecutivePage() {
  const { user } = useAuth();
  const organizationId = user!.organizationId;
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // A synchronous guard, not just the isGeneratingPdf state: a single click can dispatch two
  // click events in the same tick, both of which would see the pre-update `isGeneratingPdf`
  // value (React hasn't re-rendered with the disabled button yet) and start a second,
  // overlapping report generation.
  const isGeneratingPdfRef = useRef(false);

  // listHvsEntries (FORTH_REVIEW.md items 5/6) collapses Core Fault Management + Stability
  // into one selectable HVS entry — see AdminPage.tsx's BenchmarkingSection for the same
  // pattern.
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
    const sheets = buildOrganizationReportSheets(benchmark, reportDetails);
    exportRowsToXlsx(`executive-${effectiveEntry.key}-all`, sheets);
  }

  async function handleDownloadPdf() {
    if (!effectiveEntry || !reportReady || isGeneratingPdfRef.current) return;
    isGeneratingPdfRef.current = true;
    setIsGeneratingPdf(true);
    try {
      const { benchmark, details: reportDetails } = reportInputs();
      const sections = await buildOrganizationReportPdfSections(benchmark, reportDetails);
      exportSectionsToPdf(`executive-${effectiveEntry.key}-report`, `${effectiveEntry.name} — Organization report`, sections);
    } finally {
      isGeneratingPdfRef.current = false;
      setIsGeneratingPdf(false);
    }
  }

  if (hvsEntriesQuery.isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <PageShell title="Organization Overview" maxWidth={1400}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2, mb: 3 }}>
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

      {isGroup && effectiveEntry ? (
        <>
          <SectionCard title="OpCo benchmarking (submitted responses only)">
            {combinedQuery.data ? (
              <>
                <CombinedBenchmarkTable
                  rows={combinedQuery.data.rows}
                  exportFileNamePrefix={`executive-${effectiveEntry.key}`}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Combined avg is the 50/50 blend of Fault Management and Stability per the Core
                  Domain guideline.
                </Typography>
              </>
            ) : (
              <Typography color="text.secondary">Loading…</Typography>
            )}
          </SectionCard>

          {effectiveEntry.questionnaireCodes.map((code) => (
            <Box key={code} sx={{ mb: 3 }}>
              <QuestionnaireExecutiveDetail organizationId={organizationId} questionnaireCode={code} />
            </Box>
          ))}
        </>
      ) : questionnaireQuery.data ? (
        <>
          <SectionCard title="OpCo benchmarking (submitted responses only)">
            {opCoBenchmarkQuery.isLoading && <Typography color="text.secondary">Loading…</Typography>}
            {opCoBenchmarkQuery.data && (
              <BenchmarkTable
                rows={opCoBenchmarkQuery.data.rows}
                subScenarios={questionnaireQuery.data.subScenarios}
                exportFileNamePrefix={`executive-${questionnaireQuery.data.code}`}
              />
            )}
          </SectionCard>

          <Box sx={{ mb: 3 }}>
            <QuestionnaireExecutiveDetail
              organizationId={organizationId}
              questionnaireCode={questionnaireQuery.data.code}
            />
          </Box>
        </>
      ) : (
        <Typography color="text.secondary">Loading…</Typography>
      )}
    </PageShell>
  );
}
