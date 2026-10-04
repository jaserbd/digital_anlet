// Parses the two Transport Network Fault Management questionnaires (TM Forum GB1523D, Beta)
// out of Transport.xlsx: Microwave and OTN. Two independent HVSs under the "Transport"
// domain — the source defines no combined score (unlike Core FM + Stability). One-time,
// dev/seed-time script only — see parseRanFmXlsx.ts.
//
// Neither questionnaire has an E2E Automation Ratio Checklist sheet, so hasE2ECheck=false.
//
// Known Scoring_Microwave defects, deliberately NOT replicated (scoring.ts's general
// compensation rule applies instead, per the TM Forum compensation explainer):
// - Intent Fulfilment (top score 4) carries a copied "compensate if score = 3" formula.
// - Solution Implementation's compensation average leaves out Intent Fulfilment.
// Criteria numbers themselves are clean and are read from the Scoring sheets as usual.
//
// One Guideline sheet covers both questionnaires. Its section III ("Guideline for
// Answering") has 9 rows matching Microwave's 9 questions in order; OTN has no separate
// "Intent Fulfilment" question, so it skips that row and takes the rest in order.
import XLSX from 'xlsx';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { readFmSheets } from './fmSheetParser';
import { cellText, joinColumnText, readSheetRows, repoRootXlsxPath } from './xlsxParseUtils';

const FILE_LABEL = 'Transport.xlsx';

// Guideline sheet `!ref` is B1:E48, so array index 0 = column B, 2 = D, 3 = E.
const GUIDELINE_TEXT_COLUMN = 0;
const GUIDELINE_INTRO_ROWS: [number, number] = [1, 13]; // B2-B14 "I. Introduction"
const GUIDELINE_MICROWAVE_SUB_SCENARIO_ROWS: [number, number] = [16, 21]; // B17-B22
const GUIDELINE_OTN_SUB_SCENARIO_ROWS: [number, number] = [23, 26]; // B24-B27
const GUIDELINE_GLOSSARY_ROWS: [number, number] = [41, 47]; // B42-B48 abbreviations (SNR, LOS, ...)
const GUIDELINE_ANSWERING_ROWS_START = 31; // row 32 = first "Guideline for Answering" row
const GUIDELINE_QUESTION_COLUMN = 2; // D
const GUIDELINE_ANSWER_COLUMN = 3; // E

function workbookFor(xlsxPath?: string): XLSX.WorkBook {
  return XLSX.readFile(xlsxPath ?? repoRootXlsxPath('Transport.xlsx'));
}

function guidelineText(
  guidelineRows: unknown[][],
  subScenarioRows: [number, number],
): string | null {
  return joinColumnText(guidelineRows, GUIDELINE_TEXT_COLUMN, [
    GUIDELINE_INTRO_ROWS,
    subScenarioRows,
    GUIDELINE_GLOSSARY_ROWS,
  ]);
}

// guideline row index → answering guidance, checking the row's own question text (column D)
// contains `mustContain` so a revised source fails loudly rather than mis-attaching text.
function answeringGuideline(
  guidelineRows: unknown[][],
  row: number,
  mustContain: string,
): string | null {
  const guidelineQuestion =
    cellText(guidelineRows[row]?.[GUIDELINE_QUESTION_COLUMN])?.toLowerCase() ?? '';
  if (!guidelineQuestion.includes(mustContain)) {
    throw new Error(
      `${FILE_LABEL}: Guideline row ${row + 1} no longer describes "${mustContain}" — re-check the question mapping`,
    );
  }
  return cellText(guidelineRows[row]?.[GUIDELINE_ANSWER_COLUMN]);
}

// One phrase per guideline row (rows 32-40), in order.
const GUIDELINE_ROW_PHRASES = [
  'intent translation',
  'intent fulfilment',
  'data collection',
  'prediction of faults',
  'fault identification',
  'fault demarcation',
  'generation of emergency service restoration',
  'evaluation & decision',
  'automatic execution',
];

export function parseTransportMicrowaveXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = workbookFor(xlsxPath);
  const { subScenarios, questions } = readFmSheets(workbook, {
    fileLabel: FILE_LABEL,
    questionSheet: 'Questionnaire Microwave',
    scoringSheet: 'Scoring_Microwave',
    categoryRow: 1, // row 2: Communication (L-M) | Equipment (N) | Environmental (O)
    subScenarioNameRow: 2,
    subScenarioWeightRow: 3,
    subScenarioColumnStart: 11, // column L
    subScenarioCount: 4,
    questionRows: [4, 12], // rows 5-13
    scoringRowOffset: -1, // Scoring_Microwave question rows are one row higher
    complianceColumn: 9, // J
    standardSourceColumn: 10, // K
  });
  const guidelineRows = readSheetRows(workbook, 'Guideline', FILE_LABEL);

  return {
    code: 'TRANSPORT_MW_FM_GB1523D',
    name: 'Transport Microwave Fault Management',
    networkType: 'Transport',
    hvsCategory: 'Fault Management',
    hasE2ECheck: false,
    guidelineText: guidelineText(guidelineRows, GUIDELINE_MICROWAVE_SUB_SCENARIO_ROWS),
    // The Microwave sub-scenario list in the Guideline (B19-B22) is "Name: causes..." in the
    // same order as the questionnaire columns.
    subScenarios: subScenarios.map((s) => ({
      ...s,
      description:
        cellText(
          guidelineRows[GUIDELINE_MICROWAVE_SUB_SCENARIO_ROWS[0] + 2 + s.sortOrder]?.[
            GUIDELINE_TEXT_COLUMN
          ],
        ) ?? s.description,
    })),
    questions: questions.map((q) => {
      const row = GUIDELINE_ANSWERING_ROWS_START + q.sortOrder;
      return {
        ...q,
        answeringGuideline: answeringGuideline(
          guidelineRows,
          row,
          GUIDELINE_ROW_PHRASES[q.sortOrder]!,
        ),
      };
    }),
  };
}

export function parseTransportOtnXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = workbookFor(xlsxPath);
  const { subScenarios, questions } = readFmSheets(workbook, {
    fileLabel: FILE_LABEL,
    questionSheet: 'OTN Questionnaire',
    scoringSheet: 'Scoring_OTN',
    categoryRow: 1, // row 2: Equipment (L) | Communication (M-P) | Environmental (Q)
    subScenarioNameRow: 2,
    subScenarioWeightRow: 3,
    subScenarioColumnStart: 11, // column L
    subScenarioCount: 6,
    questionRows: [4, 11], // rows 5-12
    scoringRowOffset: 0, // Scoring_OTN question rows are at the same row numbers
    complianceColumn: 9, // J
    standardSourceColumn: 10, // K
  });
  const guidelineRows = readSheetRows(workbook, 'Guideline', FILE_LABEL);

  return {
    code: 'TRANSPORT_OTN_FM_GB1523D',
    name: 'Transport OTN Fault Management',
    networkType: 'Transport',
    hvsCategory: 'Fault Management',
    hasE2ECheck: false,
    guidelineText: guidelineText(guidelineRows, GUIDELINE_OTN_SUB_SCENARIO_ROWS),
    // The OTN Guideline section only describes the 3 categories, not individual
    // sub-scenarios (that text is in guidelineText), so descriptions keep the header text.
    subScenarios,
    questions: questions.map((q) => {
      // Skip guideline row 33 ("Intent Fulfilment") — OTN has a single Intent question.
      const guidelineIndex = q.sortOrder === 0 ? 0 : q.sortOrder + 1;
      const row = GUIDELINE_ANSWERING_ROWS_START + guidelineIndex;
      return {
        ...q,
        answeringGuideline: answeringGuideline(
          guidelineRows,
          row,
          GUIDELINE_ROW_PHRASES[guidelineIndex]!,
        ),
      };
    }),
  };
}
