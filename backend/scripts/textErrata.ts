// Locates every text correction the seed applies (prisma/seed/textCorrections.ts) in the original
// TM Forum workbooks — workbook, sheet, cell — and writes them as JSON for the errata report
// (DOCUMENTATION_PLAN.md). Read-only: the workbooks are not changed.
//
//   npx tsx scripts/textErrata.ts <out.json>
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { readWorkbook } from '../prisma/seed/readWorkbook';
import { repoRootXlsxPath } from '../prisma/seed/xlsxParseUtils';
import { REVIEW_QUESTIONNAIRES, reviewQuestionnairePath } from '../prisma/seed/parseReviewQuestionnaires';
import { TEXT_CORRECTIONS, normalizeSpacing, type CorrectionKind } from '../prisma/seed/textCorrections';

interface Source {
  label: string;
  filePath: string;
  fileName: string;
  codes: string[];
}

const SOURCES: Source[] = [
  { label: 'RAN Fault Management (GB1059A)', fileName: 'RAN_FM.xlsx', codes: ['RAN_FM_GB1059A'] },
  { label: 'Core Network Fault Management and Stability (GB1059B)', fileName: 'CORE_FM.xlsx', codes: ['CORE_FM_GB1059B', 'CORE_STABILITY_GB1059B'] },
  { label: 'IP Network Fault Management (GB1523E)', fileName: 'IP_FM.xlsx', codes: ['IP_FM_GB1523E'] },
  { label: 'Transport Microwave and OTN Fault Management (GB1523D)', fileName: 'Transport.xlsx', codes: ['TRANSPORT_MW_FM_GB1523D', 'TRANSPORT_OTN_FM_GB1523D'] },
  { label: 'Fixed Access Network Fault Management (GB1523C)', fileName: 'Fixed_Access.xlsx', codes: ['FIXED_ACCESS_FM_GB1523C'] },
].map((s) => ({ ...s, filePath: repoRootXlsxPath(s.fileName) }));

for (const c of REVIEW_QUESTIONNAIRES) {
  SOURCES.push({ label: c.name, fileName: c.fileName, filePath: reviewQuestionnairePath(c.fileName), codes: [c.code] });
}

export interface ErrataFix {
  sheet: string;
  cell: string;
  kind: CorrectionKind;
  before: string;
  after: string;
  /** The cell text around the first occurrence, before the fix. */
  context: string;
}

export interface SpacingCell {
  sheet: string;
  cell: string;
  issues: string[];
}

const CONTEXT = 50;

// Sheets copied in from another questionnaire (the Core Network template with "Orange" demo
// answers) that this questionnaire does not use — listed as a content issue, not proof-read.
const LEFTOVER_SHEET = /_Orange$|^Core Network Fault Management_O$/;

function excerpt(text: string, find: string): string {
  const at = text.indexOf(find);
  const start = Math.max(0, at - CONTEXT);
  const end = Math.min(text.length, at + find.length + CONTEXT);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`.replace(/\s*\n\s*/g, ' ⏎ ');
}

// What normalizeSpacing changed, in words — invisible differences (trailing spaces, non-breaking
// spaces) are not reported.
function spacingIssues(raw: string): string[] {
  const issues: string[] = [];
  if (/[：，（）、？]/.test(raw)) issues.push('full-width (Chinese) punctuation');
  // Two spaces after a full stop is a typing style, not an error.
  if (/[^\s.:?!][ \t]{2,}(?=\S)/.test(raw.replace(/\u00a0/g, ' '))) issues.push('double spaces');
  if (/\S[ \t]+[,.?;:)](?=\s|$)/.test(raw.replace(/\u00a0/g, ' '))) issues.push('space before punctuation');
  if (/\( +/.test(raw)) issues.push('space after "("');
  return issues;
}

const result = SOURCES.map((source) => {
  const workbook = readWorkbook(source.filePath);
  const fixes: ErrataFix[] = [];
  const spacing: SpacingCell[] = [];
  for (const sheetName of workbook.SheetNames) {
    if (LEFTOVER_SHEET.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName]!;
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue;
      const c = cell as XLSX.CellObject;
      if (c.t !== 's' || typeof c.v !== 'string') continue;
      const raw = c.v;
      const issues = spacingIssues(raw);
      if (issues.length > 0) spacing.push({ sheet: sheetName, cell: address, issues });
      let text = normalizeSpacing(raw);
      for (const fix of TEXT_CORRECTIONS) {
        if (fix.only && !fix.only.some((code) => source.codes.includes(code))) continue;
        if (!text.includes(fix.find)) continue;
        const next = text.split(fix.find).join(fix.replace);
        // e.g. 'Sub-scenario-2:' → 'Sub-scenario-2: ' only changes something without a space already
        if (normalizeSpacing(next) === normalizeSpacing(text)) continue;
        fixes.push({ sheet: sheetName, cell: address, kind: fix.kind, before: fix.find, after: fix.replace, context: excerpt(text, fix.find) });
        text = next;
      }
    }
  }
  return { label: source.label, fileName: path.basename(source.filePath), sheets: workbook.SheetNames.filter((n) => !LEFTOVER_SHEET.test(n)),
    leftoverSheets: workbook.SheetNames.filter((n) => LEFTOVER_SHEET.test(n)), fixes, spacing };
});

// Every correction should be found in some cell; the ones that only match text the parser joins
// from several cells are reported so they can be located by hand.
const found = new Set(result.flatMap((r) => r.fixes.map((f) => `${f.before}\u0000${f.after}`)));
const unlocated = TEXT_CORRECTIONS.filter((c) => !found.has(`${c.find}\u0000${c.replace}`));

const out = process.argv[2] ?? 'errata.json';
fs.writeFileSync(out, JSON.stringify({ sources: result, unlocated }, null, 2));
console.log(
  result.map((r) => `${r.fileName}: ${r.fixes.length} fixes, ${r.spacing.length} spacing cells`).join('\n'),
  `\nunlocated: ${unlocated.length}`,
);
