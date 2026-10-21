// Reader for the "Guideline" sheet layout shared by the TM Forum in-review questionnaires
// (REVIEW_QUESTIONNAIRES_PLAN.md): an "I. Introduction" section, usually a "II. Sub-scenarios"
// section, then a "Guideline for Answering ANL questionnaire" table whose header row starts
// with "Cognitive Activity (IAADE)" and has "Question" and "Answering Guideline" columns.
//
// Section rows are found by their heading text rather than hardcoded row numbers, and the
// answering rows are matched to questions by Service Capability or question text, never by
// position — several sources' tables skip or reorder questions.
import type XLSX from 'xlsx';
import { cellText, readSheetRows } from './xlsxParseUtils';

export interface StandardGuideline {
  /** Introduction + sub-scenario text, joined by blank lines. */
  text: string | null;
  /** Answering guidance per question sortOrder (questions without a row are absent). */
  answeringGuidelines: Map<number, string>;
  /** Guideline table rows that matched no question (a revised file, or a source defect). */
  unmatchedRows: number[];
}

interface QuestionKey {
  sortOrder: number;
  questionText: string;
  serviceCapability: string;
}

function key(text: string | null, length: number): string {
  return (text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, length);
}

export function readStandardGuideline(
  workbook: XLSX.WorkBook,
  fileLabel: string,
  questions: QuestionKey[],
  sheetName = 'Guideline',
): StandardGuideline {
  const rows = readSheetRows(workbook, sheetName, fileLabel);
  const findRow = (pattern: RegExp) =>
    rows.findIndex((row) => row.some((cell) => pattern.test(cellText(cell) ?? '')));

  const introRow = findRow(/^I\.\s*Introduction/i);
  const answeringHeadingRow = findRow(/Guideline for Answering/i);
  const tableHeaderRow = rows.findIndex(
    (row, i) => i > answeringHeadingRow && row.some((c) => /^Cognitive Activit/i.test(cellText(c) ?? '')),
  );
  if (introRow < 0 || answeringHeadingRow < 0 || tableHeaderRow < 0) {
    throw new Error(`${fileLabel}: "${sheetName}" sheet doesn't have the expected Introduction / Guideline for Answering sections`);
  }

  // Context text: every non-empty cell between the Introduction heading and the answering
  // section, keeping section headings ("II. Sub-scenarios") as their own lines.
  const lines: string[] = [];
  for (let row = introRow + 1; row < answeringHeadingRow; row++) {
    for (const cell of rows[row] ?? []) {
      const text = cellText(cell);
      if (text) lines.push(text);
    }
  }

  const header = rows[tableHeaderRow]!.map((c) => cellText(c)?.toLowerCase() ?? '');
  const questionColumn = header.findIndex((h) => h.startsWith('question'));
  const guidelineColumn = header.findIndex((h) => h.includes('guideline'));
  const capabilityColumn = header.findIndex((h) => h.startsWith('service capabilit'));
  if (questionColumn < 0 || guidelineColumn < 0) {
    throw new Error(`${fileLabel}: Guideline for Answering table lacks a Question or Answering Guideline column`);
  }

  const activityColumn = header.findIndex((h) => h.startsWith('cognitive activit'));
  const answeringGuidelines = new Map<number, string>();
  const unmatchedRows: number[] = [];
  // Guidance for one question may span several rows (one per option, plus "Note:" lines under
  // the question): a row without its own Cognitive Activity / Service Capability that doesn't
  // repeat another question's text continues the block above.
  let current: number | null = null;
  for (let row = tableHeaderRow + 1; row < rows.length; row++) {
    const questionText = cellText(rows[row]?.[questionColumn]);
    const guideline = cellText(rows[row]?.[guidelineColumn]);
    const capability = capabilityColumn >= 0 ? cellText(rows[row]?.[capabilityColumn]) : null;
    const activity = activityColumn >= 0 ? cellText(rows[row]?.[activityColumn]) : null;
    if (!questionText && !guideline && !capability) continue;
    const unused = (q: QuestionKey) => !answeringGuidelines.has(q.sortOrder);
    // Service Capability first, but only an unused one: sources copy-paste in both directions
    // (GB1525D repeats Solution Generation's question text on the Demarcation row; GB1522B
    // repeats a Service Capability above a different question).
    const match =
      (capability ? questions.find((q) => unused(q) && key(q.serviceCapability, 30) === key(capability, 30)) : undefined) ??
      questions.find((q) => unused(q) && key(q.questionText, 40) === key(questionText, 40)) ??
      questions.find((q) => unused(q) && key(q.questionText, 25) === key(questionText, 25));
    if (match) {
      current = match.sortOrder;
      if (guideline) answeringGuidelines.set(match.sortOrder, guideline);
    } else if (!activity && !capability && current != null) {
      if (guideline) {
        const previous = answeringGuidelines.get(current);
        answeringGuidelines.set(current, previous ? `${previous}\n${guideline}` : guideline);
      }
    } else {
      current = null;
      unmatchedRows.push(row + 1);
    }
  }

  return { text: lines.length > 0 ? lines.join('\n\n') : null, answeringGuidelines, unmatchedRows };
}
