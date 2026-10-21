// Shared reader for the TM Forum Fault Management questionnaire layout used by IP_FM.xlsx,
// Transport.xlsx (Microwave + OTN) and Fixed_Access.xlsx: one row per question with
// columns B-I = Cognitive Activity, Service Capability, Weight, Question, Option A-D, and a
// block of per-sub-scenario answer columns whose header rows hold (optionally) a category,
// the sub-scenario name and its fault-distribution weight. Each file differs only in row and
// column offsets, so callers pass a layout rather than re-implementing the loop.
//
// As with the RAN/Core parsers, option *criteria* always come from the separate Scoring
// sheet, never the questionnaire sheet's own inline criteria (IP_FM.xlsx's inline columns
// are missing Solution Generation entirely and Awareness's option D) — see CLAUDE.md.
import type XLSX from 'xlsx';
import type { AnswerOption } from '@anlet/shared';
import type {
  ParsedEffectivenessIndicator,
  ParsedQuestion,
  ParsedSubScenario,
} from './parsedQuestionnaire.types';
import {
  carryForward,
  cellText,
  criteriaForOfferedOptions,
  joinColumnText,
  optionMap,
  parseYesNo,
  readSheetRows,
  toSubScenarioCode,
} from './xlsxParseUtils';

export interface FmSheetLayout {
  fileLabel: string;
  questionSheet: string;
  scoringSheet: string;
  /** 0-based row index of the header row holding sub-scenario categories, if the sheet has one. */
  categoryRow: number | null;
  /** 0-based row indices of the sub-scenario name and weight header rows. A null weight row
   * means the weights live on the Scoring sheet instead (`scoringSubScenarioWeights`). */
  subScenarioNameRow: number;
  subScenarioWeightRow: number | null;
  /** Sub-scenario weights from the Scoring sheet: one 0-based column per sub-scenario. */
  scoringSubScenarioWeights?: { row: number; columns: number[] };
  /** Optional row with a longer description below each sub-scenario name. */
  subScenarioDescriptionRow?: number;
  /** Drops "Other sub-scenarios (to be defined)" columns whose weight is 0 or not a number
   * ("% TBD") — placeholders nobody can answer meaningfully (REVIEW_QUESTIONNAIRES_PLAN.md). */
  dropPlaceholderSubScenarios?: boolean;
  /** 0-based column index of the first sub-scenario answer column, and how many there are. */
  subScenarioColumnStart: number;
  subScenarioCount: number;
  /** Inclusive 0-based question row range on the questionnaire sheet. */
  questionRows: [number, number];
  /** Scoring sheet row index = questionnaire row index + this offset. */
  scoringRowOffset: number;
  /** 0-based column of the Scoring sheet's Option A criterion (B-D follow). Default 5 (F). */
  scoringCriteriaColumn?: number;
  /** When set, the Scoring sheet cell in this column must repeat the question's text (or its
   * Service Capability) — a guard against the row offset drifting in a revised file. */
  scoringTextCheckColumn?: number;
  /** 0-based columns for the standards-compliance flag and source text, if present. */
  complianceColumn: number | null;
  standardSourceColumn: number | null;
}

// Fixed across every file using this layout (questionnaire sheet columns B-I and Scoring
// sheet criteria columns F-I).
const COGNITIVE_ACTIVITY_COLUMN = 1;
const SERVICE_CAPABILITY_COLUMN = 2;
const WEIGHT_COLUMN = 3;
const QUESTION_TEXT_COLUMN = 4;
const OPTION_TEXT_COLUMNS = [5, 6, 7, 8] as const;
const DEFAULT_SCORING_CRITERIA_COLUMN = 5;

/** A weight cell as a number — some sources type weights as text ("10%", "0.15 "). */
export function parseWeight(value: unknown): number | null {
  if (typeof value === 'number') return value;
  const text = cellText(value);
  if (!text) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(text);
  if (!match) return null;
  return match[2] ? Number(match[1]) / 100 : Number(match[1]);
}

function normalizedPrefix(text: string | null, length = 25): string {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, length);
}

export interface FmSheetData {
  subScenarios: ParsedSubScenario[];
  /** Questions without answeringGuideline filled in — callers map that from their Guideline sheet. */
  questions: Omit<ParsedQuestion, 'answeringGuideline'>[];
}

export function readFmSheets(workbook: XLSX.WorkBook, layout: FmSheetLayout): FmSheetData {
  const questionRows = readSheetRows(workbook, layout.questionSheet, layout.fileLabel);
  const scoringRows = readSheetRows(workbook, layout.scoringSheet, layout.fileLabel);

  const columns = Array.from(
    { length: layout.subScenarioCount },
    (_, i) => layout.subScenarioColumnStart + i,
  );
  const categories =
    layout.categoryRow == null
      ? columns.map(() => null)
      : carryForward(columns.map((c) => cellText(questionRows[layout.categoryRow!]?.[c])));

  const weightCell = (i: number, column: number): unknown =>
    layout.subScenarioWeightRow != null
      ? questionRows[layout.subScenarioWeightRow]?.[column]
      : scoringRows[layout.scoringSubScenarioWeights!.row]?.[
          layout.scoringSubScenarioWeights!.columns[i]!
        ];

  const subScenarios: ParsedSubScenario[] = [];
  columns.forEach((column, i) => {
    const header = cellText(questionRows[layout.subScenarioNameRow]?.[column]);
    const weight = parseWeight(weightCell(i, column));
    if (
      layout.dropPlaceholderSubScenarios &&
      header &&
      /^other\b/i.test(header) &&
      (weight == null || weight === 0)
    ) {
      return;
    }
    if (!header || weight == null) {
      throw new Error(
        `${layout.fileLabel}: sub-scenario column ${column} has no name or numeric weight`,
      );
    }
    // Some headers carry a parenthetical scope note on a second line, e.g. "Hardware
    // Failure\n(should include but not limit to ...)" — the first line is the name. A
    // "Sub-scenario-1:" prefix and a trailing weight ("Slowness (35%)") are dropped.
    const name = header
      .replace(/^sub-?scenario[\s-]*\d+\s*:\s*/i, '')
      .split(/\r?\n/)[0]!
      .replace(/\s*\(\d+(?:\.\d+)?\s*%\)\s*$/, '')
      // "RAN Voice KPIs (including but not limited to …)" — the scope note stays in the description.
      .replace(/\s*\(including\b.*$/i, '')
      .trim();
    const description =
      layout.subScenarioDescriptionRow != null
        ? cellText(questionRows[layout.subScenarioDescriptionRow]?.[column])
        : null;
    subScenarios.push({
      code: toSubScenarioCode(name),
      name,
      description: (description ?? header).replace(/\s+/g, ' '),
      category: categories[i] ?? null,
      faultDistributionWeight: weight,
      sortOrder: subScenarios.length,
    });
  });

  const questions: FmSheetData['questions'] = [];
  const [firstRow, lastRow] = layout.questionRows;
  let lastCognitiveActivity = '';
  for (let row = firstRow; row <= lastRow; row++) {
    const qRow = questionRows[row]!;
    const sRow = scoringRows[row + layout.scoringRowOffset]!;

    // Cognitive activity is only set on the first row of each IAADE group (merged cells).
    // Capitalized: one source types "analysis" on a continuation row of "Analysis".
    const ownActivity = cellText(qRow[COGNITIVE_ACTIVITY_COLUMN]);
    const cognitiveActivity = ownActivity
      ? ownActivity.charAt(0).toUpperCase() + ownActivity.slice(1)
      : lastCognitiveActivity;
    lastCognitiveActivity = cognitiveActivity;

    const optionText = optionMap(
      OPTION_TEXT_COLUMNS.map((c) => cellText(qRow[c])) as [string, string, string, string],
    );
    const criteriaColumn = layout.scoringCriteriaColumn ?? DEFAULT_SCORING_CRITERIA_COLUMN;
    const scoringCriteria = optionMap(
      [0, 1, 2, 3].map((i) => {
        const value = sRow[criteriaColumn + i];
        return typeof value === 'number' ? value : null;
      }) as [
        number,
        number,
        number,
        number,
      ],
    );

    const serviceCapability = cellText(qRow[SERVICE_CAPABILITY_COLUMN]);
    const questionText = cellText(qRow[QUESTION_TEXT_COLUMN]);
    const weight = parseWeight(qRow[WEIGHT_COLUMN]);
    if (!serviceCapability || !questionText || weight == null) {
      throw new Error(
        `${layout.fileLabel}: question row ${row + 1} is missing capability, text or weight`,
      );
    }
    if (layout.scoringTextCheckColumn != null) {
      const scoringText = normalizedPrefix(cellText(sRow[layout.scoringTextCheckColumn]));
      if (
        scoringText !== normalizedPrefix(questionText) &&
        scoringText !== normalizedPrefix(serviceCapability)
      ) {
        throw new Error(
          `${layout.fileLabel}: ${layout.scoringSheet} row ${row + layout.scoringRowOffset + 1} doesn't match question row ${row + 1} ("${serviceCapability}")`,
        );
      }
    }

    questions.push({
      sortOrder: row - firstRow,
      cognitiveActivity,
      serviceCapability,
      questionText,
      weight,
      optionText,
      optionCriteria: criteriaForOfferedOptions(
        optionText,
        scoringCriteria as Partial<Record<AnswerOption, number>>,
      ),
      complianceWithStandards:
        layout.complianceColumn == null ? null : parseYesNo(qRow[layout.complianceColumn]),
      standardSource:
        layout.standardSourceColumn == null ? null : cellText(qRow[layout.standardSourceColumn]),
      // Intent is excluded from every E2E Automation Ratio Checklist ("at the AN L4 stage,
      // E2E automation is achieved ... in Awareness, Analysis, Decision-Making, and
      // Execution"). Irrelevant for questionnaires with hasE2ECheck=false.
      includeInE2ECheck: cognitiveActivity !== 'Intent',
    });
  }

  return { subScenarios, questions };
}

/** Text of each "Sub-scenario N: ..." line in an introduction cell or column, keyed by N. */
export function extractNumberedSubScenarioLines(texts: (string | null)[]): Map<number, string> {
  const result = new Map<number, string>();
  for (const text of texts) {
    for (const line of (text ?? '').split(/\r?\n|\r/)) {
      // Both spellings occur in the sources ("Sub-scenario 1:", "Sub-scenairo-1:").
      // ... and "Sub-scenario1:" / "Sub-scenario-1." in the in-review questionnaires.
      const match = /^\s*Sub-scen(?:ario|airo)[\s-]*(\d+)\s*[:.]\s*(.+)$/i.exec(line);
      if (match) result.set(Number(match[1]), match[2]!.trim());
    }
  }
  return result;
}

export interface KeiLayout {
  fileLabel: string;
  questionSheet: string;
  scoringSheet: string;
  /** Inclusive 0-based KEI row range on the questionnaire sheet (name in A, weight in D,
   * description in E, option texts in F-I). */
  rows: [number, number];
  /** Scoring sheet row index = questionnaire row index + this offset. */
  scoringRowOffset: number;
  /** 0-based column of the Scoring sheet's Option A criterion (B-D follow). */
  scoringCriteriaColumn: number;
  /** 0-based questionnaire-sheet row (or inclusive row range) holding the note(s) under the
   * KEI block, if any. */
  noteRow: number | [number, number] | null;
}

const KEI_NAME_COLUMN = 0; // A
const KEI_WEIGHT_COLUMN = 3; // D
const KEI_DESCRIPTION_COLUMN = 4; // E

/**
 * Reads a Key Effectiveness Indicator block (NEW_HVS_PLAN.md Phase B). Weights and texts come
 * from the questionnaire sheet; criteria from the Scoring sheet, whose row must carry the
 * same indicator name — a guard against row drift, and against Scoring_Microwave's KEI
 * block, whose weight/answer cells point at the OTN sheet (only its criteria are usable).
 */
export function readKeis(
  workbook: XLSX.WorkBook,
  layout: KeiLayout,
): { effectivenessIndicators: ParsedEffectivenessIndicator[]; keiNote: string | null } {
  const rows = readSheetRows(workbook, layout.questionSheet, layout.fileLabel);
  const scoringRows = readSheetRows(workbook, layout.scoringSheet, layout.fileLabel);

  const effectivenessIndicators: ParsedEffectivenessIndicator[] = [];
  const [first, last] = layout.rows;
  for (let row = first; row <= last; row++) {
    const name = cellText(rows[row]?.[KEI_NAME_COLUMN]);
    const weight = parseWeight(rows[row]?.[KEI_WEIGHT_COLUMN]);
    const description = cellText(rows[row]?.[KEI_DESCRIPTION_COLUMN]);
    if (!name || weight == null || !description) {
      throw new Error(
        `${layout.fileLabel}: KEI row ${row + 1} is missing its name, weight or description`,
      );
    }
    const sRow = scoringRows[row + layout.scoringRowOffset];
    const scoringName = cellText(sRow?.[KEI_NAME_COLUMN]);
    if (scoringName?.replace(/\s+/g, ' ') !== name.replace(/\s+/g, ' ')) {
      throw new Error(
        `${layout.fileLabel}: ${layout.scoringSheet} row ${row + layout.scoringRowOffset + 1} is "${scoringName}", expected KEI "${name}"`,
      );
    }
    const optionText = optionMap(
      OPTION_TEXT_COLUMNS.map((c) => cellText(rows[row]?.[c])) as [string, string, string, string],
    );
    const criteria = optionMap(
      [0, 1, 2, 3].map((i) => sRow?.[layout.scoringCriteriaColumn + i] as number | null) as [
        number,
        number,
        number,
        number,
      ],
    );
    effectivenessIndicators.push({
      sortOrder: row - first,
      name,
      description,
      weight,
      optionText,
      optionCriteria: criteriaForOfferedOptions(optionText, criteria),
    });
  }

  return {
    effectivenessIndicators,
    keiNote:
      layout.noteRow == null
        ? null
        : joinColumnText(
            rows,
            KEI_NAME_COLUMN,
            [typeof layout.noteRow === 'number' ? [layout.noteRow, layout.noteRow] : layout.noteRow],
          ),
  };
}
