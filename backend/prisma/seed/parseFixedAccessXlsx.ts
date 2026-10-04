// Parses the Fixed Access Network Fault Management questionnaire (TM Forum GB1523C, Alpha)
// out of Fixed_Access.xlsx. One-time, dev/seed-time script only — see parseRanFmXlsx.ts.
//
// The 4 sub-scenarios share one header ("Fixed Access (PON) Major Fault Scenarios") rather
// than distinct categories, so category stays null.
//
// The Guideline sheet's section III ("Guideline for Answering") has 8 rows for the
// questionnaire's 9 questions, and its Service Capability labels are shifted against the
// rows' own question text (e.g. the row labelled "Fault Prediction" describes fault
// identification & risk). Rows are therefore matched to questions by their question text,
// not by row order — see GUIDELINE_ROW_FOR_QUESTION. Fault Prediction (question 3) has no
// guideline row in the source, so it gets none.
import XLSX from 'xlsx';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { extractNumberedSubScenarioLines, readFmSheets } from './fmSheetParser';
import { cellText, joinColumnText, readSheetRows, repoRootXlsxPath } from './xlsxParseUtils';

const FILE_LABEL = 'Fixed_Access.xlsx';

// Guideline sheet `!ref` is B1:E30, so array index 0 = column B, 2 = D, 3 = E.
const GUIDELINE_TEXT_COLUMN = 0;
const GUIDELINE_INTRO_ROWS: [number, number] = [1, 11]; // B2-B12 "I. Introduction"
const GUIDELINE_SUB_SCENARIO_ROWS: [number, number] = [14, 18]; // B15-B19 "II. Sub-scenarios"
const GUIDELINE_QUESTION_COLUMN = 2; // D
const GUIDELINE_ANSWER_COLUMN = 3; // E

// question sortOrder → guideline row index, with a phrase that must appear in that guideline
// row's question text (column D) so a revised source file fails loudly instead of silently
// attaching guidance to the wrong question.
const GUIDELINE_ROW_FOR_QUESTION: Record<number, { row: number; mustContain: string }> = {
  0: { row: 22, mustContain: 'translate and process intents' },
  1: { row: 23, mustContain: 'data collection' },
  3: { row: 24, mustContain: 'fault identification' },
  4: { row: 25, mustContain: 'fault demarcation' },
  5: { row: 26, mustContain: 'root cause' },
  6: { row: 27, mustContain: 'generation of fault recovery' },
  7: { row: 28, mustContain: 'evaluation and decision' },
  8: { row: 29, mustContain: 'solution implementation' },
};

function answeringGuidelineFor(guidelineRows: unknown[][], sortOrder: number): string | null {
  const mapping = GUIDELINE_ROW_FOR_QUESTION[sortOrder];
  if (!mapping) return null;
  const row = guidelineRows[mapping.row];
  const guidelineQuestion = cellText(row?.[GUIDELINE_QUESTION_COLUMN])?.toLowerCase() ?? '';
  if (!guidelineQuestion.includes(mapping.mustContain)) {
    throw new Error(
      `${FILE_LABEL}: Guideline row ${mapping.row + 1} no longer describes "${mapping.mustContain}" — re-check the question mapping`,
    );
  }
  return cellText(row?.[GUIDELINE_ANSWER_COLUMN]);
}

export function parseFixedAccessXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = XLSX.readFile(xlsxPath ?? repoRootXlsxPath('Fixed_Access.xlsx'));

  const { subScenarios, questions } = readFmSheets(workbook, {
    fileLabel: FILE_LABEL,
    questionSheet: 'Questionnaire',
    scoringSheet: 'Scoring',
    categoryRow: null,
    subScenarioNameRow: 2,
    subScenarioWeightRow: 3,
    subScenarioColumnStart: 9, // column J
    subScenarioCount: 4,
    questionRows: [4, 12], // rows 5-13
    scoringRowOffset: -1, // Scoring sheet question rows are one row higher
    complianceColumn: null, // this sheet has no standards-compliance columns
    standardSourceColumn: null,
  });

  const guidelineRows = readSheetRows(workbook, 'Guideline', FILE_LABEL);
  const subScenarioLines = extractNumberedSubScenarioLines(
    guidelineRows
      .slice(GUIDELINE_SUB_SCENARIO_ROWS[0], GUIDELINE_SUB_SCENARIO_ROWS[1] + 1)
      .map((r) => cellText(r[GUIDELINE_TEXT_COLUMN])),
  );

  return {
    code: 'FIXED_ACCESS_FM_GB1523C',
    name: 'Fixed Access Network Fault Management',
    networkType: 'Fixed Access',
    hvsCategory: 'Fault Management',
    hasE2ECheck: true,
    guidelineText: joinColumnText(guidelineRows, GUIDELINE_TEXT_COLUMN, [
      GUIDELINE_INTRO_ROWS,
      GUIDELINE_SUB_SCENARIO_ROWS,
    ]),
    subScenarios: subScenarios.map((s) => ({
      ...s,
      description: subScenarioLines.get(s.sortOrder + 1) ?? s.description,
    })),
    questions: questions.map((q) => ({
      ...q,
      answeringGuideline: answeringGuidelineFor(guidelineRows, q.sortOrder),
    })),
    effectivenessIndicators: [], // no Key Effectiveness Indicator block in this source
    keiNote: null,
  };
}
