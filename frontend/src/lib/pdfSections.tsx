import type {
  AnswerDrilldownEntryDto,
  BenchmarkRowDto,
  CombinedBenchmarkRowDto,
  QuestionDto,
  RespondentSummaryDto,
  SubScenarioDto,
} from '@anlet/shared';
import type { CommentCollectionRow } from '../components/CommentCollectionTable';
import type { PdfSection } from './exportPdf';
import { ANSWER_OPTIONS, buildOptionCountsChartData, indexAnswerDistribution } from './answerDistribution';
import { captureChartImage } from './chartCapture';
import { ScoreBarChart, computeScoreBarChartHeight } from '../components/charts/ScoreBarChart';
import { OptionCountsChart, OPTION_COUNTS_CHART_HEIGHT } from '../components/charts/OptionCountsChart';
import { formatSubScenarioLabel } from './subScenarioCategories';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
};

// Fixed capture width for every chart embedded in a report — wide enough for legends/labels,
// then scaled down by exportPdf.ts to fit the page width while preserving aspect ratio.
const CHART_CAPTURE_WIDTH = 640;

// Dashboard PDF report (MANAGEMENT_REVIEW_3.md item 5, extended by MANAGEMENT_REVIEW_4.md
// item 2) — mirrors sheetBuilders.ts's Excel sheets one-for-one, plus (per MANAGEMENT_REVIEW_4.md)
// a captured chart image next to each table and, for Answer distribution, the full
// per-respondent breakdown that's normally only reachable by clicking a count on screen —
// a PDF has no interactivity, so nothing can be left behind a click.
export function buildRespondentsPdfSection(respondents: RespondentSummaryDto[]): PdfSection {
  return {
    kind: 'table',
    heading: 'Respondents',
    head: [['Email', 'NatCo', 'Country', 'Working Domain', 'Designation', 'Status', 'Final score']],
    body: respondents.map((r) => [
      r.email,
      r.opCoName ?? '—',
      r.country ?? '—',
      r.workingDomain ?? '—',
      r.designation ?? '—',
      STATUS_LABEL[r.status] ?? r.status,
      r.finalScore != null ? r.finalScore.toFixed(2) : '—',
    ]),
  };
}

export async function buildRespondentsPdfSections(respondents: RespondentSummaryDto[]): Promise<PdfSection[]> {
  const table = buildRespondentsPdfSection(respondents);
  if (respondents.length === 0) return [table];
  const chartData = respondents.map((r) => ({ label: r.email, score: r.finalScore }));
  const height = computeScoreBarChartHeight(respondents.length);
  const image = await captureChartImage(
    <ScoreBarChart data={chartData} series={[{ key: 'score', name: 'Final score' }]} />,
    CHART_CAPTURE_WIDTH,
    height,
  );
  return [table, { kind: 'image', dataUrl: image.dataUrl, width: image.width, height: image.height }];
}

export function buildBenchmarkPdfSection(
  rows: BenchmarkRowDto[],
  subScenarios: SubScenarioDto[],
  hideOrganizationColumn?: boolean,
): PdfSection {
  return {
    kind: 'table',
    heading: 'Benchmarking',
    head: [
      [
        ...(hideOrganizationColumn ? [] : ['Organization']),
        'NatCo',
        'Country',
        'Respondents',
        'Submitted',
        'Avg. final score',
        'Avg. E2E rate',
        ...subScenarios.map(formatSubScenarioLabel),
      ],
    ],
    body: rows.map((r) => [
      ...(hideOrganizationColumn ? [] : [r.organizationName]),
      r.opCoName,
      r.country ?? '—',
      r.respondentCount,
      r.submittedCount,
      r.averageFinalScore != null ? r.averageFinalScore.toFixed(2) : '—',
      r.averageE2eAutomationRate != null ? `${(r.averageE2eAutomationRate * 100).toFixed(0)}%` : '—',
      ...subScenarios.map((s) => {
        const avg = r.subScenarioAverages.find((a) => a.subScenarioCode === s.code)?.averageScore;
        return avg != null ? avg.toFixed(2) : '—';
      }),
    ]),
  };
}

export async function buildBenchmarkPdfSections(
  rows: BenchmarkRowDto[],
  subScenarios: SubScenarioDto[],
  hideOrganizationColumn?: boolean,
): Promise<PdfSection[]> {
  const table = buildBenchmarkPdfSection(rows, subScenarios, hideOrganizationColumn);
  if (rows.length === 0) return [table];
  const chartData = rows.map((r) => ({
    label: hideOrganizationColumn ? r.opCoName : `${r.organizationName} — ${r.opCoName}`,
    score: r.averageFinalScore,
  }));
  const height = computeScoreBarChartHeight(rows.length);
  const image = await captureChartImage(
    <ScoreBarChart data={chartData} series={[{ key: 'score', name: 'Avg. final score' }]} />,
    CHART_CAPTURE_WIDTH,
    height,
  );
  return [table, { kind: 'image', dataUrl: image.dataUrl, width: image.width, height: image.height }];
}

export function buildCombinedBenchmarkPdfSection(
  rows: CombinedBenchmarkRowDto[],
  hideOrganizationColumn?: boolean,
): PdfSection {
  return {
    kind: 'table',
    heading: 'Combined benchmarking',
    head: [
      [
        ...(hideOrganizationColumn ? [] : ['Organization']),
        'NatCo',
        'Country',
        'Fault Mgmt avg',
        'Stability avg',
        'Combined avg',
      ],
    ],
    body: rows.map((r) => [
      ...(hideOrganizationColumn ? [] : [r.organizationName]),
      r.opCoName,
      r.country ?? '—',
      r.faultManagement.averageFinalScore != null ? r.faultManagement.averageFinalScore.toFixed(2) : '—',
      r.stability.averageFinalScore != null ? r.stability.averageFinalScore.toFixed(2) : '—',
      r.combinedAverageFinalScore != null ? r.combinedAverageFinalScore.toFixed(2) : '—',
    ]),
  };
}

export async function buildCombinedBenchmarkPdfSections(
  rows: CombinedBenchmarkRowDto[],
  hideOrganizationColumn?: boolean,
): Promise<PdfSection[]> {
  const table = buildCombinedBenchmarkPdfSection(rows, hideOrganizationColumn);
  if (rows.length === 0) return [table];
  const chartData = rows.map((r) => ({
    label: hideOrganizationColumn ? r.opCoName : `${r.organizationName} — ${r.opCoName}`,
    faultManagement: r.faultManagement.averageFinalScore,
    stability: r.stability.averageFinalScore,
    combined: r.combinedAverageFinalScore,
  }));
  const height = computeScoreBarChartHeight(rows.length);
  const image = await captureChartImage(
    <ScoreBarChart
      data={chartData}
      series={[
        { key: 'faultManagement', name: 'Fault Mgmt avg' },
        { key: 'stability', name: 'Stability avg' },
        { key: 'combined', name: 'Combined avg' },
      ]}
    />,
    CHART_CAPTURE_WIDTH,
    height,
  );
  return [table, { kind: 'image', dataUrl: image.dataUrl, width: image.width, height: image.height }];
}

export function buildCommentCollectionPdfSection(rows: CommentCollectionRow[]): PdfSection {
  return {
    kind: 'table',
    heading: 'Comment Collection',
    head: [['Email', 'NatCo', 'Country', 'Designation', 'Cognitive Activity', 'Sub Scenario', 'Comment']],
    body: rows.map((r) => [r.email, r.opCoName ?? '—', r.country ?? '—', r.designation ?? '—', r.cognitiveActivity, r.subScenario, r.comment]),
  };
}

// One heading + counts table + chart image per question (mirroring AnswerDistributionDrilldown's
// collapsible per-question layout on screen), plus — since a PDF can't be clicked — a
// respondent table under every (sub-scenario, option) cell that has at least one respondent,
// mirroring the on-screen click-to-expand RespondentTable.
export async function buildAnswerDistributionPdfSections(
  questions: QuestionDto[],
  subScenarios: SubScenarioDto[],
  entries: AnswerDrilldownEntryDto[],
  opCoScopeId?: string | null,
): Promise<PdfSection[]> {
  const { countsByKey, respondentsByKey } = indexAnswerDistribution(entries, opCoScopeId);

  const sections: PdfSection[] = [{ kind: 'text', heading: 'Answer distribution', lines: [] }];
  for (const q of questions) {
    const availableOptions = new Set(q.options.map((o) => o.option));
    const availableOptionsOrdered = ANSWER_OPTIONS.filter((o) => availableOptions.has(o));

    sections.push({
      kind: 'text',
      heading: `${q.cognitiveActivity} — ${q.serviceCapability}`,
      lines: [q.questionText, ...q.options.map((o) => `${o.option}: ${o.text} (${o.criteria})`)],
    });
    sections.push({
      kind: 'table',
      head: [['Sub-scenario', ...ANSWER_OPTIONS.map((o) => `Option ${o}`)]],
      body: subScenarios.map((s) => {
        const counts = countsByKey.get(`${q.id}:${s.id}`);
        return [formatSubScenarioLabel(s), ...ANSWER_OPTIONS.map((o) => (availableOptions.has(o) ? String(counts?.[o] ?? 0) : '—'))];
      }),
    });

    const chartData = buildOptionCountsChartData(q, subScenarios, countsByKey, availableOptionsOrdered);
    const hasAnyCounts = chartData.some((row) => availableOptionsOrdered.some((o) => Number(row[o] ?? 0) > 0));
    if (hasAnyCounts) {
      const image = await captureChartImage(
        <OptionCountsChart data={chartData} options={availableOptionsOrdered} />,
        CHART_CAPTURE_WIDTH,
        OPTION_COUNTS_CHART_HEIGHT,
      );
      sections.push({ kind: 'image', dataUrl: image.dataUrl, width: image.width, height: image.height });
    }

    for (const s of subScenarios) {
      for (const o of availableOptionsOrdered) {
        const respondents = respondentsByKey.get(`${q.id}:${s.id}:${o}`) ?? [];
        if (respondents.length === 0) continue;
        sections.push({
          kind: 'table',
          heading: `${formatSubScenarioLabel(s)} — Option ${o} respondents`,
          head: [['Email', 'NatCo', 'Country', 'Working Domain', 'Designation', 'Comment']],
          body: respondents.map((r) => [
            r.email,
            r.opCoName ?? '—',
            r.country ?? '—',
            r.workingDomain ?? '—',
            r.designation ?? '—',
            r.comment ?? '—',
          ]),
        });
      }
    }
  }
  return sections;
}
