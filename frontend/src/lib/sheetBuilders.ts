import type { BenchmarkRowDto, CombinedBenchmarkRowDto, RespondentSummaryDto, SubScenarioDto } from '@anlet/shared';
import type { XlsxSheet } from './exportXlsx';
import { formatSubScenarioLabel } from './subScenarioCategories';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
};

// Pure sheet-building functions extracted from each table component's own "Export to Excel"
// handler (MANAGEMENT_REVIEW_3.md item 4), so a page-level "Download all" button can bundle
// every visible table into one workbook without duplicating column/row shapes. Each
// component keeps calling these for its own standalone export button too — behavior is
// unchanged, only the logic moved to one shared place.
export function buildRespondentsSheet(respondents: RespondentSummaryDto[]): XlsxSheet {
  return {
    name: 'Respondents',
    columns: [
      { header: 'Email', key: 'email' },
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Working Domain', key: 'workingDomain' },
      { header: 'Designation', key: 'designation' },
      { header: 'Status', key: 'status' },
      { header: 'Final score', key: 'finalScore' },
    ],
    rows: respondents.map((r) => ({
      email: r.email,
      opCoName: r.opCoName ?? '',
      country: r.country ?? '',
      workingDomain: r.workingDomain ?? '',
      designation: r.designation ?? '',
      status: STATUS_LABEL[r.status] ?? r.status,
      finalScore: r.finalScore ?? '',
    })),
  };
}

export function buildBenchmarkSheet(
  rows: BenchmarkRowDto[],
  subScenarios: SubScenarioDto[],
  hideOrganizationColumn?: boolean,
  // True for questionnaires with Key Effectiveness Indicators (NEW_HVS_PLAN.md Phase B).
  showKeiColumn?: boolean,
): XlsxSheet {
  return {
    name: 'Benchmarking',
    columns: [
      ...(hideOrganizationColumn ? [] : [{ header: 'Organization', key: 'organizationName' }]),
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Respondents', key: 'respondentCount' },
      { header: 'Submitted', key: 'submittedCount' },
      { header: 'Avg. final score', key: 'averageFinalScore' },
      { header: 'Avg. E2E rate', key: 'averageE2eAutomationRate' },
      ...(showKeiColumn ? [{ header: 'Avg. KEI score', key: 'averageKeiScore' }] : []),
      ...subScenarios.map((s) => ({ header: formatSubScenarioLabel(s), key: `sub-${s.id}` })),
    ],
    rows: rows.map((r) => ({
      organizationName: r.organizationName,
      opCoName: r.opCoName,
      country: r.country ?? '',
      respondentCount: r.respondentCount,
      submittedCount: r.submittedCount,
      averageFinalScore: r.averageFinalScore ?? '',
      averageE2eAutomationRate: r.averageE2eAutomationRate ?? '',
      averageKeiScore: r.averageKeiScore ?? '',
      ...Object.fromEntries(
        subScenarios.map((s) => [
          `sub-${s.id}`,
          r.subScenarioAverages.find((a) => a.subScenarioCode === s.code)?.averageScore ?? '',
        ]),
      ),
    })),
  };
}

export function buildCombinedBenchmarkSheet(rows: CombinedBenchmarkRowDto[], hideOrganizationColumn?: boolean): XlsxSheet {
  return {
    name: 'Combined benchmarking',
    columns: [
      ...(hideOrganizationColumn ? [] : [{ header: 'Organization', key: 'organizationName' }]),
      { header: 'NatCo', key: 'opCoName' },
      { header: 'Country', key: 'country' },
      { header: 'Fault Mgmt avg', key: 'faultManagement' },
      { header: 'Stability avg', key: 'stability' },
      { header: 'Combined avg', key: 'combined' },
    ],
    rows: rows.map((r) => ({
      organizationName: r.organizationName,
      opCoName: r.opCoName,
      country: r.country ?? '',
      faultManagement: r.faultManagement.averageFinalScore ?? '',
      stability: r.stability.averageFinalScore ?? '',
      combined: r.combinedAverageFinalScore ?? '',
    })),
  };
}
