// Parses the IP Network Fault Management questionnaire (TM Forum GB1523E) out of IP_FM.xlsx.
// One-time, dev/seed-time script only — see parseRanFmXlsx.ts's header comment for why
// xlsx/SheetJS's advisories are acceptable here.
//
// Unlike RAN/Core, this file's context sheet is named "Introduction" (not "Guideline") and
// has no per-question answering guidance — several questions instead carry a "Note:" inside
// the question text itself, which is kept inline as-is. The 8 sub-scenarios are grouped
// under 3 categories (Equipment / Communication / Quality of service) by a merged header row.
import XLSX from 'xlsx';
import type { ParsedQuestionnaire } from './parsedQuestionnaire.types';
import { extractNumberedSubScenarioLines, readFmSheets } from './fmSheetParser';
import { joinColumnText, readSheetRows, repoRootXlsxPath } from './xlsxParseUtils';

const FILE_LABEL = 'IP_FM.xlsx';

// "Introduction" sheet (`!ref` A1:C71, so array index 0 = column A): numbered points 1-5 in
// rows 2-6. Point 3 (row 4) also lists each sub-scenario's scope/causes.
const INTRO_TEXT_COLUMN = 0;
const INTRO_ROWS: [number, number] = [1, 5];
const INTRO_SUB_SCENARIO_ROW = 3;

export function parseIpFmXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = XLSX.readFile(xlsxPath ?? repoRootXlsxPath('IP_FM.xlsx'));

  const { subScenarios, questions } = readFmSheets(workbook, {
    fileLabel: FILE_LABEL,
    questionSheet: 'IP Network - Fault Management',
    scoringSheet: 'Scoring',
    categoryRow: 1, // row 2: Equipment | Communication (merged Q-U) | Quality of service (merged V-W)
    subScenarioNameRow: 2,
    subScenarioWeightRow: 3,
    subScenarioColumnStart: 15, // column P
    subScenarioCount: 8,
    questionRows: [4, 11], // rows 5-12
    scoringRowOffset: 0, // Scoring sheet question rows are at the same row numbers
    complianceColumn: 9, // J: "Consistency of standards Yes/No"
    standardSourceColumn: 10, // K
  });

  const introRows = readSheetRows(workbook, 'Introduction', FILE_LABEL);
  const subScenarioLines = extractNumberedSubScenarioLines([
    introRows[INTRO_SUB_SCENARIO_ROW]?.[INTRO_TEXT_COLUMN] as string | null,
  ]);

  return {
    code: 'IP_FM_GB1523E',
    name: 'IP Network Fault Management',
    networkType: 'IP',
    hvsCategory: 'Fault Management',
    hasE2ECheck: true,
    guidelineText: joinColumnText(introRows, INTRO_TEXT_COLUMN, [INTRO_ROWS]),
    subScenarios: subScenarios.map((s) => ({
      ...s,
      description: subScenarioLines.get(s.sortOrder + 1) ?? s.description,
    })),
    questions: questions.map((q) => ({ ...q, answeringGuideline: null })),
  };
}
