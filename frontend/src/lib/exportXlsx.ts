import * as XLSX from 'xlsx';

export interface XlsxColumn {
  header: string;
  key: string;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: Record<string, unknown>[];
}

// Client-side Excel export (MANAGEMENT_VIEW.md item 1) — builds a workbook entirely in the
// browser from data already fetched/filtered on screen, so no new backend export endpoint
// or server-side rendering dependency is needed (keeps the single-host deployment model
// unchanged). `columns` fixes header text/order independent of each row object's own key
// order, and `aoa_to_sheet` (rather than `json_to_sheet`) is used specifically so the header
// row always matches `columns` exactly.
/** Excel refuses two sheets with one name (case-insensitively) — a later one gets " (2)", " (3)"… */
export function uniqueSheetName(name: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`;
    const candidate = name.slice(0, 31 - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

export function exportRowsToXlsx(filename: string, sheets: XlsxSheet[]): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const headerRow = sheet.columns.map((c) => c.header);
    const dataRows = sheet.rows.map((row) => sheet.columns.map((c) => row[c.key] ?? ''));
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
    // Excel worksheet names are capped at 31 characters and reject some punctuation.
    const safeName = sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, uniqueSheetName(safeName, workbook.SheetNames));
  }
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
