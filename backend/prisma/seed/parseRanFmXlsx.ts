// Parses the RAN Fault Management questionnaire out of RAN_FM.xlsx into structured seed
// data. This is a one-time, dev/seed-time script only — never imported by the running
// server (xlsx/SheetJS has known ReDoS/prototype-pollution advisories with no fix
// available, but this only ever parses our own trusted, repo-committed file, never
// user-uploaded input).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import type { AnswerOption, SubScenarioCode } from '@anlet/shared';

export interface ParsedQuestion {
  sortOrder: number;
  cognitiveActivity: string;
  serviceCapability: string;
  questionText: string;
  weight: number;
  optionText: Partial<Record<AnswerOption, string>>;
  optionCriteria: Partial<Record<AnswerOption, number>>;
  complianceWithStandards: boolean | null;
  standardSource: string | null;
  includeInE2ECheck: boolean;
}

export interface ParsedSubScenario {
  code: SubScenarioCode;
  name: string;
  description: string;
  faultDistributionWeight: number;
  sortOrder: number;
}

export interface ParsedQuestionnaire {
  code: string;
  name: string;
  networkType: string;
  hvsCategory: string;
  subScenarios: ParsedSubScenario[];
  questions: ParsedQuestion[];
}

const SUB_SCENARIO_CODE_BY_PREFIX: Array<{ prefix: string; code: SubScenarioCode }> = [
  { prefix: 'Equipment', code: 'EQUIPMENT' },
  { prefix: 'Processing Error', code: 'PROCESSING_ERROR' },
  { prefix: 'Communications', code: 'COMMUNICATIONS' },
  { prefix: 'Environmental', code: 'ENVIRONMENTAL' },
  { prefix: 'Security', code: 'SECURITY' },
];

// Sub-scenario answer columns (Equipment..Security) start at column L (0-based index 11)
// in the "RAN - Fault Management" sheet, and are laid out at the same offset on the
// "Scoring" sheet's criteria block start (column F, 0-based index 5).
const SUB_SCENARIO_COLUMN_START = 11;
const QUESTION_ROWS_START = 3; // row 4 (1-based) = "Intent-driven", 0-based index 3
const QUESTION_ROWS_END = 10; // row 11 (1-based) = "Solution implementation"
const SCORING_ROW_OFFSET = 1; // Scoring sheet's question rows are RAN-FM's rows + 1

function codeFor(description: string): SubScenarioCode {
  const match = SUB_SCENARIO_CODE_BY_PREFIX.find((s) => description.startsWith(s.prefix));
  if (!match) {
    throw new Error(`Could not map sub-scenario description to a code: "${description}"`);
  }
  return match.code;
}

function optionMap<T>(values: [T, T, T, T]): Partial<Record<AnswerOption, T>> {
  const [a, b, c, d] = values;
  const result: Partial<Record<AnswerOption, T>> = {};
  if (a != null) result.A = a;
  if (b != null) result.B = b;
  if (c != null) result.C = c;
  if (d != null) result.D = d;
  return result;
}

export function parseRanFmXlsx(xlsxPath?: string): ParsedQuestionnaire {
  const resolvedPath =
    xlsxPath ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../RAN_FM.xlsx');

  const workbook = XLSX.readFile(resolvedPath);
  const questionSheet = workbook.Sheets['RAN - Fault Management'];
  const scoringSheet = workbook.Sheets['Scoring'];
  if (!questionSheet || !scoringSheet) {
    throw new Error('RAN_FM.xlsx is missing the expected "RAN - Fault Management" or "Scoring" sheet');
  }

  const questionRows: unknown[][] = XLSX.utils.sheet_to_json(questionSheet, {
    header: 1,
    defval: null,
  });
  const scoringRows: unknown[][] = XLSX.utils.sheet_to_json(scoringSheet, { header: 1, defval: null });

  const subScenarioDescriptions = questionRows[1]?.slice(
    SUB_SCENARIO_COLUMN_START,
    SUB_SCENARIO_COLUMN_START + 5,
  ) as string[];
  const subScenarioWeights = questionRows[2]?.slice(
    SUB_SCENARIO_COLUMN_START,
    SUB_SCENARIO_COLUMN_START + 5,
  ) as number[];

  const subScenarios: ParsedSubScenario[] = subScenarioDescriptions.map((description, i) => ({
    code: codeFor(description),
    name: description.split('\n')[0]!.trim(),
    description: description.trim(),
    faultDistributionWeight: subScenarioWeights[i]!,
    sortOrder: i,
  }));

  const questions: ParsedQuestion[] = [];
  let lastCognitiveActivity = '';
  for (let row = QUESTION_ROWS_START; row <= QUESTION_ROWS_END; row++) {
    const qRow = questionRows[row]!;
    const sRow = scoringRows[row + SCORING_ROW_OFFSET]!;

    // Cognitive activity is only populated on the first row of each IAADE group in the
    // sheet (merged cells); carry the last seen value forward for the rows beneath it.
    const cognitiveActivity = (qRow[1] as string | null)?.trim() || lastCognitiveActivity;
    lastCognitiveActivity = cognitiveActivity;

    const optionText = optionMap([qRow[5], qRow[6], qRow[7], qRow[8]] as [
      string,
      string,
      string,
      string,
    ]);
    const optionCriteria = optionMap([sRow[5], sRow[6], sRow[7], sRow[8]] as [
      number,
      number,
      number,
      number,
    ]);

    questions.push({
      sortOrder: row - QUESTION_ROWS_START,
      cognitiveActivity,
      serviceCapability: (qRow[2] as string).trim(),
      questionText: (qRow[4] as string).trim(),
      weight: qRow[3] as number,
      optionText,
      optionCriteria,
      complianceWithStandards: qRow[9] === 'Y' ? true : qRow[9] === 'N' ? false : null,
      standardSource: (qRow[10] as string | null)?.trim() ?? null,
      // Intent is the only cognitive activity excluded from the E2E Automation Ratio
      // Checklist — its formula (`E2E Automation Ratio Checklist!C12`) only ranges over
      // the Awareness-through-Execution rows. See CLAUDE.md "Domain model".
      includeInE2ECheck: cognitiveActivity !== 'Intent',
    });
  }

  return {
    code: 'RAN_FM_GB1059A',
    name: 'RAN Fault Management',
    networkType: 'RAN',
    hvsCategory: 'Fault Management',
    subScenarios,
    questions,
  };
}
