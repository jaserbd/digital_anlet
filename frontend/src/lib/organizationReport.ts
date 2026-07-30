import type {
  AnswerDrilldownDto,
  BenchmarkRowDto,
  CombinedBenchmarkRowDto,
  OrganizationQuestionnaireSummaryDto,
  QuestionnaireDto,
  SubScenarioDto,
} from '@anlet/shared';
import { buildCommentCollectionRows, buildCommentCollectionSheet } from '../components/CommentCollectionTable';
import { buildAnswerMatrix } from './answerMatrix';
import { buildBenchmarkSheet, buildCombinedBenchmarkSheet, buildRespondentsSheet } from './sheetBuilders';
import type { XlsxSheet } from './exportXlsx';
import {
  buildAnswerDistributionPdfSections,
  buildBenchmarkPdfSections,
  buildCombinedBenchmarkPdfSections,
  buildCommentCollectionPdfSection,
  buildRespondentsPdfSections,
} from './pdfSections';
import type { PdfSection } from './exportPdf';

// One loaded member questionnaire's worth of data — the same shape
// QuestionnaireExecutiveDetail.tsx's useQuestionnaireExecutiveData resolves to once all three
// of its queries have data (callers check readiness before building a report).
export interface OrganizationReportDetail {
  questionnaire: QuestionnaireDto;
  summary: OrganizationQuestionnaireSummaryDto;
  drilldown: AnswerDrilldownDto | undefined;
}

export type OrganizationReportBenchmarkPart =
  | { kind: 'single'; rows: BenchmarkRowDto[]; subScenarios: SubScenarioDto[] }
  | { kind: 'combined'; rows: CombinedBenchmarkRowDto[] }
  | null;

// Shared by ExecutivePage.tsx (own org) and OrganizationDeepDivePage.tsx (any org) — both
// bundle the same shape of "organization overview" report: an optional benchmark/combined
// table, plus one Respondents + Comment Collection + Answer Matrix set per member
// questionnaire (1 for a plain HVS, 2 for the Core FM+Stability group). Only
// `hideOrganizationColumn` differs between the two callers (Executive's own-org view shows
// it, Deep-Dive's single-org view hides it, matching each page's on-screen table).
export function buildOrganizationReportSheets(
  benchmark: OrganizationReportBenchmarkPart,
  details: OrganizationReportDetail[],
  options?: { hideOrganizationColumn?: boolean },
): XlsxSheet[] {
  const sheets: XlsxSheet[] = [];
  if (benchmark?.kind === 'combined') {
    sheets.push(buildCombinedBenchmarkSheet(benchmark.rows, options?.hideOrganizationColumn));
  } else if (benchmark?.kind === 'single') {
    sheets.push(buildBenchmarkSheet(benchmark.rows, benchmark.subScenarios, options?.hideOrganizationColumn));
  }
  for (const { questionnaire, summary, drilldown } of details) {
    sheets.push(buildRespondentsSheet(summary.respondents));
    sheets.push(
      buildCommentCollectionSheet(
        buildCommentCollectionRows(drilldown?.comments ?? [], questionnaire.questions, questionnaire.subScenarios),
      ),
    );
    sheets.push(...buildAnswerMatrix(questionnaire.questions, questionnaire.subScenarios, drilldown?.entries ?? []));
  }
  return sheets;
}

export async function buildOrganizationReportPdfSections(
  benchmark: OrganizationReportBenchmarkPart,
  details: OrganizationReportDetail[],
  options?: { hideOrganizationColumn?: boolean },
): Promise<PdfSection[]> {
  const sections: PdfSection[] = [];
  if (benchmark?.kind === 'combined') {
    sections.push(...(await buildCombinedBenchmarkPdfSections(benchmark.rows, options?.hideOrganizationColumn)));
  } else if (benchmark?.kind === 'single') {
    sections.push(
      ...(await buildBenchmarkPdfSections(benchmark.rows, benchmark.subScenarios, options?.hideOrganizationColumn)),
    );
  }
  for (const { questionnaire, summary, drilldown } of details) {
    sections.push(...(await buildRespondentsPdfSections(summary.respondents)));
    sections.push(
      buildCommentCollectionPdfSection(
        buildCommentCollectionRows(drilldown?.comments ?? [], questionnaire.questions, questionnaire.subScenarios),
      ),
    );
    sections.push(
      ...(await buildAnswerDistributionPdfSections(questionnaire.questions, questionnaire.subScenarios, drilldown?.entries ?? [])),
    );
  }
  return sections;
}
