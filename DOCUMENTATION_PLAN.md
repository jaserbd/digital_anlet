# Project Admin manual and TM Forum text-errata report

**Status: done (2026-11-19).** Source: `documentation.md` (local notes), clarified 2026-11-19.

## Decisions

| Topic | Decision |
|---|---|
| Manual audience | **Project Admins only** (Manage project, dashboard, Executive view, answering as a user). Application Admin features (projects, roles, mail settings) are left out. |
| Screenshots | **Local app with invented demo data** ("Demo Telco Group", made-up NatCos and `@demo.example` users) in a separate local database `anlet_manual` — the normal dev database is not touched. No real client names or emails. |
| TM Forum report | **Text fixes + content issues**: every spelling / grammar / spacing fix per workbook with sheet and cell, plus a separate section of content problems we found but did not change. |
| Workbooks | The 24 files in the repo are complete (5 released, covering 7 questionnaires, + 19 in review). |

## Deliverables (in `docs/`)

1. `docs/Anlet_Project_Admin_Manual.pdf` — built from `docs/manual/manual.html` + `docs/manual/screenshots/*.png`.
2. `docs/TMF_Questionnaire_Text_Errata.pdf` — built from `docs/errata/errata.html`.

## How

- **Errata**: a script (`backend/scripts/textErrata.ts`) opens every sheet/cell of the 24 workbooks and applies
  `prisma/seed/textCorrections.ts`'s `normalizeSpacing` + `TEXT_CORRECTIONS` (scoped to the questionnaires of
  that file) to each cell, recording workbook · sheet · cell · kind · before → after. So the report lists exactly
  the fixes the app applies, located in the original files. Content issues come from the parser header comments,
  `REVIEW_SPELLING_PLAN.md` and CLAUDE.md's "Known source defects".
- **Manual**: separate DB, migrate + questionnaires seed, a demo-data script (one project, one organization with
  3 NatCos, a Project Admin, Executives, Normal Users, some submitted answers and comments),
  production build on :4000, screenshots with headless Chrome (puppeteer-core in the scratchpad), HTML → PDF with
  Chrome's print-to-PDF.

## Steps

1. Errata script + HTML + PDF.
2. Demo database and data.
3. Screenshots (Project Admin, Executive, Normal User).
4. Manual text + PDF.
5. Review both PDFs, then hand over.

## Result

- `docs/Anlet_Project_Admin_Manual.pdf` — 25 pages, 32 screenshots (`docs/manual/screenshots/`), source `docs/manual/manual.html`. Screenshots come from a local production build on a separate `anlet_manual` database with invented demo data ("Demo Telco Group", project "AN Maturity Assessment 2026").
- `docs/TMF_Questionnaire_Text_Errata.pdf` — 57 pages covering all 24 workbooks: 729 corrections (166 spelling, 344 grammar, 219 punctuation), 40 content issues, and 271 cells with spacing problems only (Appendix A).

## Regenerating

```bash
# Errata: scan the workbooks, then build the HTML and the PDF
cd backend && npx tsx scripts/textErrata.ts ../docs/errata/errata.json && cd ..
node docs/errata/buildErrata.mjs
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --print-to-pdf=docs/TMF_Questionnaire_Text_Errata.pdf "file://$PWD/docs/errata/errata.html"

# Manual: edit docs/manual/manual.html (and replace screenshots as needed), then
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer \
  --print-to-pdf=docs/Anlet_Project_Admin_Manual.pdf "file://$PWD/docs/manual/manual.html"
```

The errata reads `TEXT_CORRECTIONS`, so new fixes in `prisma/seed/textCorrections.ts` appear in it on the next run.
