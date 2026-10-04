import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import type { AnswerOption } from '@anlet/shared';

/** Builds a { A?, B?, C?, D? } map from 4 positional values, dropping any that are absent
 * (not every question offers/scores all 4 options). */
export function optionMap<T>(values: [T, T, T, T]): Partial<Record<AnswerOption, T>> {
  const [a, b, c, d] = values;
  const result: Partial<Record<AnswerOption, T>> = {};
  if (a != null) result.A = a;
  if (b != null) result.B = b;
  if (c != null) result.C = c;
  if (d != null) result.D = d;
  return result;
}

/** Resolves a repo-root xlsx file (seed parsers live three levels below it). */
export function repoRootXlsxPath(fileName: string): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../', fileName);
}

/**
 * A sheet as `sheet_to_json({ header: 1 })` row arrays. Note the arrays are trimmed to the
 * sheet's used range (`!ref`): when a sheet's range starts at column B (several Guideline
 * sheets do), array index 0 is column B, not A — check `!ref` before hardcoding indices.
 */
export function readSheetRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileLabel: string,
): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`${fileLabel} is missing the expected "${sheetName}" sheet`);
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

/** Trimmed string cell, or null when empty/absent. */
export function cellText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

/** Fills each null with the last non-null value before it — merged cells (an IAADE group,
 * a sub-scenario category spanning several columns) only carry their value in the first cell. */
export function carryForward(values: (string | null)[]): (string | null)[] {
  let last: string | null = null;
  return values.map((v) => {
    if (v != null) last = v;
    return last;
  });
}

/** "Y"/"Yes" → true, "N"/"No" → false, anything else → null. */
export function parseYesNo(value: unknown): boolean | null {
  const text = cellText(value)?.toLowerCase();
  if (text === 'y' || text === 'yes') return true;
  if (text === 'n' || text === 'no') return false;
  return null;
}

/** Joins the non-empty cells of one column across the given inclusive row ranges. */
export function joinColumnText(
  rows: unknown[][],
  column: number,
  ranges: [number, number][],
): string | null {
  const lines: string[] = [];
  for (const [start, end] of ranges) {
    for (let row = start; row <= end; row++) {
      const text = cellText(rows[row]?.[column]);
      if (text) lines.push(text);
    }
  }
  return lines.length > 0 ? lines.join('\n\n') : null;
}

/** Stable UPPER_SNAKE sub-scenario code from its display name, ignoring any parenthetical
 * ("Link Performance Degradation (QoS/BER)" → "LINK_PERFORMANCE_DEGRADATION"). */
export function toSubScenarioCode(name: string): string {
  return name
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .join('_')
    .toUpperCase();
}

/**
 * Option criteria restricted to options the questionnaire actually offers. Some Scoring
 * sheets fill a criterion for an option that has no text (e.g. Fixed Access's Solution
 * Implementation scores D=0 but only offers A-C) — keeping it would render an empty option.
 */
export function criteriaForOfferedOptions(
  optionText: Partial<Record<AnswerOption, string>>,
  criteria: Partial<Record<AnswerOption, number>>,
): Partial<Record<AnswerOption, number>> {
  const result: Partial<Record<AnswerOption, number>> = {};
  for (const option of Object.keys(optionText) as AnswerOption[]) {
    const value = criteria[option];
    if (value == null) {
      throw new Error(`Option ${option} is offered but has no criteria in the Scoring sheet`);
    }
    result[option] = value;
  }
  return result;
}
