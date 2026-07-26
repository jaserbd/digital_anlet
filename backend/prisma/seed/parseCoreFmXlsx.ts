// Parses the two Core Network questionnaires (Fault Management, Stability) out of
// CORE_FM.xlsx. One-time, dev/seed-time script only — see parseRanFmXlsx.ts's header
// comment for why xlsx/SheetJS's advisories are acceptable here.
//
// Both questionnaire sheets ("Core Network Fault Management" / "Core Network Stability")
// have their own inline Option A-D *criteria* columns (K-N), but those are stale/wrong in
// several rows (verified against the real compensation formulas in the Scoring sheets —
// see CLAUDE.md). Criteria always come from the separate "Scoring-*" sheets, matching the
// RAN FM parser's convention; the questionnaire sheets are used for text/weight/options
// only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import type { ParsedQuestion, ParsedQuestionnaire, ParsedSubScenario } from './parsedQuestionnaire.types';
import { optionMap } from './xlsxParseUtils';

function defaultXlsxPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../CORE_FM.xlsx');
}

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`CORE_FM.xlsx is missing the expected "${sheetName}" sheet`);
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

// --- Core Network Fault Management --------------------------------------------------

// Row5 (1-based) is a non-functional placeholder: Category "Intent", weight 0, question
// text literally "n/a". The Guideline sheet explicitly says intent isn't included in fault
// management yet — excluded here rather than seeded as a real question (confirmed with
// the user rather than guessed).
const FM_QUESTION_ROWS_START = 5; // row6 (1-based) = "Data collection / Alarm correlation"
const FM_QUESTION_ROWS_END = 13; // row14 (1-based) = "Service verification"
const FM_SCORING_ROW_OFFSET = -1; // Scoring-Fault Management's rows are this sheet's rows - 1
const FM_SUB_SCENARIO_COLUMN_START = 14; // column O

export function parseCoreFaultManagementXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = XLSX.readFile(xlsxPath ?? defaultXlsxPath());
  const questionRows = readSheetRows(workbook, 'Core Network Fault Management');
  const scoringRows = readSheetRows(workbook, 'Scoring-Fault Management');

  const subScenarioNames = questionRows[1]?.slice(
    FM_SUB_SCENARIO_COLUMN_START,
    FM_SUB_SCENARIO_COLUMN_START + 2,
  ) as string[];
  const subScenarioDescriptions = questionRows[2]?.slice(
    FM_SUB_SCENARIO_COLUMN_START,
    FM_SUB_SCENARIO_COLUMN_START + 2,
  ) as string[];
  const subScenarioWeights = questionRows[3]?.slice(
    FM_SUB_SCENARIO_COLUMN_START,
    FM_SUB_SCENARIO_COLUMN_START + 2,
  ) as number[];
  const subScenarioCodes = ['EQUIPMENT', 'COMMUNICATION_QOS'];

  const subScenarios: ParsedSubScenario[] = subScenarioNames.map((name, i) => ({
    code: subScenarioCodes[i]!,
    name,
    description: (subScenarioDescriptions[i] ?? '').trim(),
    faultDistributionWeight: subScenarioWeights[i]!,
    sortOrder: i,
  }));

  const questions: ParsedQuestion[] = [];
  let lastCognitiveActivity = '';
  for (let row = FM_QUESTION_ROWS_START; row <= FM_QUESTION_ROWS_END; row++) {
    const qRow = questionRows[row]!;
    const sRow = scoringRows[row + FM_SCORING_ROW_OFFSET]!;

    // Category is only populated on the first row of each IAADE group (merged cells);
    // carry the last seen value forward, same technique as the RAN FM parser.
    const cognitiveActivity = (qRow[1] as string | null)?.trim() || lastCognitiveActivity;
    lastCognitiveActivity = cognitiveActivity;

    const optionText = optionMap([qRow[5], qRow[6], qRow[7], qRow[8]] as [string, string, string, string]);
    const optionCriteria = optionMap([sRow[5], sRow[6], sRow[7], sRow[8]] as [
      number,
      number,
      number,
      number,
    ]);

    questions.push({
      sortOrder: row - FM_QUESTION_ROWS_START,
      cognitiveActivity,
      serviceCapability: (qRow[2] as string).trim(),
      questionText: (qRow[4] as string).trim(),
      weight: qRow[3] as number,
      optionText,
      optionCriteria,
      complianceWithStandards: null, // this sheet has no separate Y/N compliance column
      standardSource: (qRow[9] as string | null)?.trim() ?? null,
      includeInE2ECheck: true, // Intent (the only exclusion) isn't seeded as a question at all
    });
  }

  return {
    code: 'CORE_FM_GB1059B',
    name: 'Core Network Fault Management',
    networkType: 'Core',
    hvsCategory: 'Fault Management',
    hasE2ECheck: true,
    subScenarios,
    questions,
  };
}

// --- Core Network Stability -----------------------------------------------------------
// No sub-scenarios (one answer per question, not one per sub-scenario) and no E2E
// checklist — modeled as a single synthetic "OVERALL" sub-scenario with weight 1 so the
// existing generic Answer/scoring model needs no special-casing (see CLAUDE.md).

const STABILITY_QUESTION_ROWS_START = 1; // row2 (1-based) = "Stable deployment architecture"
const STABILITY_QUESTION_ROWS_END = 7; // row8 (1-based) = "Service degradation recovery"
const STABILITY_SCORING_ROW_OFFSET = 2; // Scoring-Stability's rows are this sheet's rows + 2

export function parseCoreStabilityXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const workbook = XLSX.readFile(xlsxPath ?? defaultXlsxPath());
  const questionRows = readSheetRows(workbook, 'Core Network Stability');
  const scoringRows = readSheetRows(workbook, 'Scoring-Stability');

  const questions: ParsedQuestion[] = [];
  let lastCognitiveActivity = '';
  for (let row = STABILITY_QUESTION_ROWS_START; row <= STABILITY_QUESTION_ROWS_END; row++) {
    const qRow = questionRows[row]!;
    const sRow = scoringRows[row + STABILITY_SCORING_ROW_OFFSET]!;

    const cognitiveActivity = (qRow[1] as string | null)?.trim() || lastCognitiveActivity;
    lastCognitiveActivity = cognitiveActivity;

    const optionText = optionMap([qRow[5], qRow[6], qRow[7], qRow[8]] as [string, string, string, string]);
    // Criteria authoritatively from Scoring-Stability (the questionnaire sheet's own K-N
    // columns have malformed entries for several rows — see module header comment).
    const optionCriteria = optionMap([sRow[5], sRow[6], sRow[7], sRow[8]] as [
      number,
      number,
      number,
      number,
    ]);

    questions.push({
      sortOrder: row - STABILITY_QUESTION_ROWS_START,
      cognitiveActivity,
      serviceCapability: (qRow[2] as string).trim(),
      questionText: (qRow[4] as string).trim(),
      weight: qRow[3] as number,
      optionText,
      optionCriteria,
      complianceWithStandards: null,
      standardSource: (qRow[9] as string | null)?.trim() ?? null,
      includeInE2ECheck: true, // irrelevant: this questionnaire has hasE2ECheck=false
    });
  }

  const subScenarios: ParsedSubScenario[] = [
    { code: 'OVERALL', name: 'Overall', description: '', faultDistributionWeight: 1, sortOrder: 0 },
  ];

  return {
    code: 'CORE_STABILITY_GB1059B',
    name: 'Core Network Stability',
    networkType: 'Core',
    hvsCategory: 'Stability',
    hasE2ECheck: false,
    subScenarios,
    questions,
  };
}
