// Builds errata.html (→ TMF_Questionnaire_Text_Errata.pdf) from errata.json, which
// backend/scripts/textErrata.ts writes. See DOCUMENTATION_PLAN.md.
//
//   node docs/errata/buildErrata.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, 'errata.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Makes whitespace-only differences visible: "·" for a space at the edge of a phrase, "⏎" for a line break.
const show = (s) => esc(s).replace(/\n/g, '⏎').replace(/^ | $/g, '·');

function cellOrder(address) {
  const [, col, row] = /^([A-Z]+)(\d+)$/.exec(address);
  const c = [...col].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return Number(row) * 1000 + c;
}

function highlight(context, find, cls) {
  const at = context.indexOf(find.replace(/\s*\n\s*/g, ' ⏎ '));
  if (at < 0) return esc(context);
  const f = find.replace(/\s*\n\s*/g, ' ⏎ ');
  return `${esc(context.slice(0, at))}<mark class="${cls}">${show(f)}</mark>${esc(context.slice(at + f.length))}`;
}

// A fix that only adds a trailing space ('Sub-scenario-2:' → 'Sub-scenario-2: ') reads better
// with the word that follows it in the cell.
function withNextWord(f) {
  if (!/\s$/.test(f.after)) return [f.before, f.after];
  const flat = f.before.replace(/\s*\n\s*/g, ' ⏎ ');
  const at = f.context.indexOf(flat);
  const next = at < 0 ? '' : (/^\S*/.exec(f.context.slice(at + flat.length)) ?? [''])[0];
  return [f.before + next, f.after + next];
}

const KIND = { spelling: 'Spelling', grammar: 'Grammar', spacing: 'Punctuation' };

// Content problems found while loading the workbooks into the tool. Not changed by us — they
// change scoring or meaning, so TM Forum has to decide.
const CONTENT_ISSUES = {
  'CORE_FM.xlsx': [
    'Sheet "Core Network Fault Management": the inline Option A–D criteria columns (K–N) for "Service verification" give a top score of 4 with an Option D, which disagrees with the "Scoring-Fault Management" sheet (whose formulas we used).',
    'Sheet "Core Network Stability": three numeric criteria cells contain the letter "A" instead of a number. The "Scoring-Stability" sheet has the correct numbers.',
    'Sheet "Core Network Fault Management", row 5: an "Intent" row with weight 0 and question text "n/a". It is a placeholder (the Guideline says intent is not yet included) — consider removing or marking it.',
  ],
  'IP_FM.xlsx': [
    'Sheet "IP Network - Fault Management": the inline criteria are missing for "Solution Generation" and for Awareness option D. The "Scoring" sheet has them.',
  ],
  'Transport.xlsx': [
    'Sheet "Scoring_Microwave": "Intent Fulfilment" (top score 4) carries a copied "compensate if score = 3" formula from another row.',
    'Sheet "Scoring_Microwave": the compensation average for Solution Implementation leaves out Intent Fulfilment.',
    'Sheet "Scoring_Microwave": the Key Effectiveness Indicator block refers to the OTN sheet for its weights and its score shows #REF!.',
    'Sheet "Scoring_Microwave": the 4th demo answer column answers D on two questions that only offer options A–C.',
  ],
  'Fixed_Access.xlsx': [
    'Sheet "E2E Automation Ratio Checklist": the "achieved" formula ranges over C6:C12 and so also leaves out Data Collection (only Intent should be excluded, as in the other Fault Management questionnaires).',
    'Sheet "Scoring": the Execution question is scored for an Option D (= 0) although the question only offers A–C.',
    'Sheet "Guideline", section III: 8 rows for 9 questions, and the Service Capability labels are shifted against the rows\' own question text (e.g. the row labelled "Fault Prediction" describes fault identification). Fault Prediction has no guideline row.',
  ],
  GB1521E: [
    'Question 5 contains what looks like a leftover reviewer comment: "Notes: why capacity demand is generated here?"',
    'Question 5 guideline (option D) says "Recovery solutions", apparently copied from Fault Management.',
  ],
  GB1524A: [
    'A "High Value Scenario score" is labelled in the Scoring sheet but never computed.',
    '"Other sub-scenarios (to be defined)" column with weight 0 / TBD.',
  ],
  GB1524B: [
    'Sheet "Scoring": each sub-scenario is scored as an unweighted AVERAGE of the question scores, ignoring the question weights; cell U12 refers to row 7.',
  ],
  GB1525A: [
    'Sheet "Scoring": each sub-scenario is scored as an unweighted AVERAGE of the question scores; the compensation averages start with an empty argument (AVERAGE(,P5,…)), which counts as an extra 0.',
    'A "High Value Scenario score" is labelled but never computed.',
    'Question 1 guideline: option C runs into option D ("Human manually evaluate D) the effect…").',
  ],
  GB1525D: [
    'Sheet "Scoring": scores a single answer column although the questionnaire defines 3 weighted sub-scenarios.',
    'The Guideline text is the generic Service Assurance template ("assess the autonomy level of Service Assurance High Value Scenarios. To be used as the Template of Service Assurance Questionnaires"), not OTN Quality Optimization text.',
  ],
  GB1525E: [
    'Question 3 has the Cognitive Activity "Perceived" instead of "Awareness".',
    'Question 1, option D: the sentence is broken across two lines.',
    '"Other sub-scenarios (to be defined)" column with weight 0 / TBD.',
  ],
  GB1526A: [
    'A "High Value Scenario score" is labelled with 0.75 / 0.25 weights but never computed.',
    'The KEI note refers to spreadsheet cells ("E16:", "F16-Option A:").',
  ],
  GB1502D: [
    'Sheet "Scoring": no compensation is applied.',
    'KEI ranges have gaps and overlaps: 30–50 % and 35–55 % are not covered; 50–60 % lies between options C and D.',
  ],
  GB1503A: ['Question 1 answering guideline is only "A)".'],
  GB1503B: ['Sheet "Scoring": no criteria for the Key Effectiveness Indicators.'],
  GB1503H: [
    'Sheet "Scoring": scores a single answer column although the questionnaire defines weighted sub-scenarios.',
    'Questions 3 and 4, option B: the sentence is broken across two lines.',
  ],
  GB1505A: ['KEI "MTTR": option C ">= 4 hour" overlaps option D ">= 8 hour".'],
};

function issuesFor(source) {
  const key = Object.keys(CONTENT_ISSUES).find((k) => source.fileName === k || source.fileName.startsWith(`${k}_`));
  const list = [...(key ? CONTENT_ISSUES[key] : [])];
  if (source.leftoverSheets.length > 0) {
    list.push(
      `The workbook contains extra sheets from other questionnaires or filled-in copies (${source.leftoverSheets.map((s) => `"${s}"`).join(', ')}). They were not proof-read and should probably be removed before publication.`,
    );
  }
  return list;
}

const sources = data.sources.map((s) => ({
  ...s,
  docNumber: (/GB\d{4}[A-Z]?/.exec(s.label) ?? /^(GB\d{4}[A-Z]?)/.exec(s.fileName) ?? [''])[0],
  fixes: [...s.fixes].sort(
    (a, b) => s.sheets.indexOf(a.sheet) - s.sheets.indexOf(b.sheet) || cellOrder(a.cell) - cellOrder(b.cell),
  ),
  issues: issuesFor(s),
}));

const count = (s, kind) => s.fixes.filter((f) => f.kind === kind).length;
const total = (kind) => sources.reduce((n, s) => n + (kind ? count(s, kind) : s.fixes.length), 0);
const totalIssues = sources.reduce((n, s) => n + s.issues.length, 0);
const totalSpacing = sources.reduce((n, s) => n + s.spacing.length, 0);
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const anchor = (i) => `wb${i + 1}`;

const summaryRows = sources
  .map(
    (s, i) => `<tr>
      <td>${i + 1}</td>
      <td><a href="#${anchor(i)}">${esc(s.label)}</a><div class="file">${esc(s.fileName)}</div></td>
      <td class="n">${count(s, 'spelling')}</td><td class="n">${count(s, 'grammar')}</td><td class="n">${count(s, 'spacing')}</td>
      <td class="n strong">${s.fixes.length}</td><td class="n">${s.issues.length}</td><td class="n">${s.spacing.length}</td>
    </tr>`,
  )
  .join('');

const workbookSections = sources
  .map((s, i) => {
    const rows = s.fixes
      .map(
        (f) => `<tr>
        <td class="loc">${esc(f.sheet)}<br><b>${f.cell}</b></td>
        <td><span class="kind ${f.kind}">${KIND[f.kind]}</span></td>
        <td class="ctx">${highlight(f.context, f.before, 'del')}</td>
        <td class="fix">${((b, a) => `<span class="was">${show(b)}</span> → <span class="now">${show(a)}</span>`)(...withNextWord(f))}</td>
      </tr>`,
      )
      .join('');
    const table = s.fixes.length
      ? `<table class="fixes"><thead><tr><th style="width:17%">Sheet · cell</th><th style="width:12%">Type</th><th style="width:42%">Text in the workbook</th><th style="width:29%">Correction</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="none">No spelling, grammar or punctuation errors found.</p>';
    const issues = s.issues.length
      ? `<h3>Content issues (not corrected)</h3><ul class="issues">${s.issues.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '';
    return `<section class="wb" id="${anchor(i)}">
      <h2><span class="num">${i + 1}</span>${esc(s.label)}</h2>
      <p class="file">${esc(s.fileName)} · ${s.fixes.length} correction${s.fixes.length === 1 ? '' : 's'}</p>
      ${table}
      ${issues}
    </section>`;
  })
  .join('');

const spacingSections = sources
  .filter((s) => s.spacing.length)
  .map((s) => {
    const byIssue = new Map();
    for (const c of s.spacing) for (const issue of c.issues) {
      if (!byIssue.has(issue)) byIssue.set(issue, []);
      byIssue.get(issue).push(c);
    }
    const lines = [...byIssue]
      .map(([issue, cells]) => {
        const bySheet = new Map();
        for (const c of cells) bySheet.set(c.sheet, [...(bySheet.get(c.sheet) ?? []), c.cell]);
        const where = [...bySheet]
          .map(([sheet, list]) => `<i>${esc(sheet)}</i>: ${list.sort((a, b) => cellOrder(a) - cellOrder(b)).join(', ')}`)
          .join('; ');
        return `<li><b>${esc(issue)}</b> — ${where}</li>`;
      })
      .join('');
    return `<div class="sp"><h4>${esc(s.label)} <span class="file">${esc(s.fileName)}</span></h4><ul>${lines}</ul></div>`;
  })
  .join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Questionnaire Text Errata</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  :root { --ink:#1d2433; --muted:#5d6678; --rule:#d9dde5; --brand:#1f3c88; --accent:#c2185b; --del:#fde2e4; --ins:#dff3e4; }
  * { box-sizing: border-box; }
  body { font: 9.5pt/1.45 "Helvetica Neue", Arial, sans-serif; color: var(--ink); margin: 0; background: #fff; }
  h1 { font-size: 24pt; color: var(--brand); margin: 0 0 6mm; line-height: 1.15; }
  h2 { font-size: 13pt; color: var(--brand); margin: 0 0 1mm; display: flex; gap: 3mm; align-items: baseline; }
  h2 .num { font-size: 10pt; color: #fff; background: var(--brand); border-radius: 3px; padding: 0 2mm; }
  h3 { font-size: 10.5pt; margin: 5mm 0 2mm; color: var(--accent); }
  h4 { font-size: 9.5pt; margin: 3mm 0 1mm; }
  a { color: var(--brand); text-decoration: none; }
  .cover { height: 255mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; border-left: 4mm solid var(--brand); padding-left: 10mm; }
  .cover .sub { font-size: 13pt; color: var(--muted); margin-bottom: 14mm; }
  .cover dl { display: grid; grid-template-columns: 38mm 1fr; gap: 2mm 4mm; font-size: 10.5pt; }
  .cover dt { color: var(--muted); }
  .kpis { display: flex; gap: 5mm; margin: 12mm 0 0; }
  .kpi { border: 1px solid var(--rule); border-radius: 2mm; padding: 4mm 5mm; min-width: 34mm; }
  .kpi b { display: block; font-size: 20pt; color: var(--brand); }
  .kpi span { color: var(--muted); font-size: 9pt; }
  .page { page-break-after: always; }
  p { margin: 0 0 3mm; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #eef1f8; border-bottom: 2px solid var(--accent); padding: 1.6mm 2mm; font-size: 8.5pt; }
  td { border-bottom: 1px solid var(--rule); padding: 1.4mm 2mm; vertical-align: top; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 700; }
  .file { color: var(--muted); font-size: 8pt; word-break: break-all; }
  .summary td { font-size: 8.8pt; }
  .summary tr.total td { font-weight: 700; border-top: 2px solid var(--ink); }
  section.wb { page-break-before: always; }
  .fixes { font-size: 8.4pt; table-layout: fixed; }
  .fixes .loc { width: 17%; color: var(--muted); font-size: 7.8pt; overflow-wrap: anywhere; }
  .fixes .loc b { color: var(--ink); font-size: 8.4pt; }
  .fixes .ctx { width: 42%; }
  .fixes th:nth-child(2) { width: 12%; }
  .fixes .fix { width: 29%; }
  mark.del { background: var(--del); padding: 0 .5px; border-radius: 2px; }
  .was { background: var(--del); text-decoration: line-through; text-decoration-color: #b4232c; }
  .now { background: var(--ins); font-weight: 600; }
  .kind { font-size: 7.5pt; padding: .3mm 1.4mm; border-radius: 2mm; white-space: nowrap; }
  .kind.spelling { background: #fde2e4; color: #8a1621; }
  .kind.grammar { background: #e3e9fb; color: #1f3c88; }
  .kind.spacing { background: #eceef2; color: #444c5c; }
  .issues li { margin-bottom: 1.5mm; }
  .none { color: var(--muted); font-style: italic; }
  .note { background: #f6f7fa; border-left: 3px solid var(--brand); padding: 3mm 4mm; margin: 4mm 0; }
  .sp ul { margin: 0 0 2mm; padding-left: 5mm; font-size: 8.3pt; }
  .sp h4 .file { font-weight: 400; margin-left: 2mm; }
</style></head><body>

<div class="cover">
  <h1>TM Forum Autonomous Networks<br>Questionnaire Text Errata</h1>
  <div class="sub">Spelling, grammar and punctuation errors found in the ANL assessment questionnaire workbooks, with their location and a suggested correction</div>
  <dl>
    <dt>Workbooks reviewed</dt><dd>${sources.length} (5 released, covering 7 questionnaires, and 19 in review)</dd>
    <dt>Date</dt><dd>${today}</dd>
  </dl>
  <div class="kpis">
    <div class="kpi"><b>${total()}</b><span>corrections</span></div>
    <div class="kpi"><b>${total('spelling')}</b><span>spelling</span></div>
    <div class="kpi"><b>${total('grammar')}</b><span>grammar / wrong word</span></div>
    <div class="kpi"><b>${total('spacing')}</b><span>punctuation / spacing</span></div>
    <div class="kpi"><b>${totalIssues}</b><span>content issues</span></div>
  </div>
</div>

<div class="page">
  <h2>About this report</h2>
  <p>We use the TM Forum ANL questionnaires in an assessment tool. While loading the workbooks we proof-read every text that participants see — guideline, sub-scenario descriptions, questions, options, answering guidelines and Key Effectiveness Indicators — and correct obvious errors in the tool. The original workbooks are not changed. This report lists those errors so they can be fixed at the source.</p>
  <div class="note">
    <b>What is in scope.</b> Real typos, wrong words, clear grammar errors and punctuation/spacing. We did <b>not</b> change meaning or re-word TM Forum text, and we left British and American spelling as found (fulfilment / fulfillment, behaviour). Sub-scenario names were not changed.
  </div>
  <p><b>How to read the tables.</b> Each row is one correction in one cell. <i>Sheet · cell</i> is the location in the original workbook. <i>Text in the workbook</i> shows the cell text around the error, with the error <mark class="del">highlighted</mark> (⏎ marks a line break in the cell). <i>Correction</i> shows the original phrase <span class="was">struck through</span> and the suggested text <span class="now">in green</span>; a dot (·) marks a space at the start or end of a phrase. A cell with several errors appears once per error. The same error often appears in several cells (e.g. in the questionnaire sheet and again in the Scoring sheet), and each occurrence is listed.</p>
  <p><b>Content issues</b> at the end of each workbook section are problems we noticed but did not correct, because fixing them changes scoring or meaning: formula errors, criteria that disagree between sheets, copied text and leftover sheets.</p>
  <p><b>Appendix A</b> lists cells with only whitespace problems (double spaces, a space before punctuation, Chinese full-width punctuation) — minor, but they show up in the published text.</p>

  <h3>Summary</h3>
  <table class="summary">
    <thead><tr><th>#</th><th>Questionnaire / workbook</th><th class="n">Spelling</th><th class="n">Grammar</th><th class="n">Punct.</th><th class="n">Total</th><th class="n">Content issues</th><th class="n">Spacing cells (App. A)</th></tr></thead>
    <tbody>${summaryRows}
    <tr class="total"><td></td><td>Total</td><td class="n">${total('spelling')}</td><td class="n">${total('grammar')}</td><td class="n">${total('spacing')}</td><td class="n">${total()}</td><td class="n">${totalIssues}</td><td class="n">${totalSpacing}</td></tr></tbody>
  </table>
</div>

${workbookSections}

<section class="wb">
  <h2>Appendix A — Cells with whitespace or full-width punctuation only</h2>
  <p class="file">Double spaces between words (not after a full stop), a space before "," "." "?" ";" ":" ")", a space after "(", and Chinese full-width punctuation (：，（）、？). ${totalSpacing} cells.</p>
  ${spacingSections}
</section>
</body></html>`;

fs.writeFileSync(path.join(dir, 'errata.html'), html);
console.log(`errata.html: ${total()} corrections, ${totalIssues} content issues, ${totalSpacing} spacing cells`);
