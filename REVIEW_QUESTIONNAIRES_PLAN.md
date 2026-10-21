# In-review questionnaires plan (`new_questionaries.md`)

Add the questionnaires listed on TM Forum's "Questionnaire Library - In Review" wiki page
(ANP space, last modified 2025-05-18) to the tool, tagged **(R)** next to the HVS.

Branch: `feature/review-questionnaires`. Source files: `review_questionnaires/` (downloaded
2026-10-21 from the wiki's attachment pages; `question/` is an earlier partial copy — byte-identical
files minus GB1504A — not used, not committed).

## Decisions already taken (2026-10-21)

- Files go into the repo (`review_questionnaires/`), parsed by the seed like the existing xlsx.
- **RAN FM v3.0.0 (GB1523A) and Core FM v2.3.0 (GB1523B) are skipped** — the deployed RAN/Core stay.
- Already in the tool, skipped: GB1523E IP FM v2.0.2 (same version), GB1523D Transport FM
  v2.0.0 (we run the newer v2.1.0).
- All other questionnaires are in scope, built in batches (network layer first).
- **(R) questionnaires are opt-in per project** — not added to existing projects; new projects
  also start without them (Admins enable them in "Edit questionnaires").
- Not available / not questionnaires: GB1502A and GB1503D (no file attached on the wiki); the
  eight "Template" entries (GB1503, GB1504, GB1521, GB1522, GB1523, GB1524, GB1525, GB1528).

## Findings per file

Every file uses the same model as the existing questionnaires: IAADE rows (columns B-I =
Cognitive Activity, Service Capability, Weight, Question, Option A-D), per-sub-scenario answer
columns with a weight row, a Scoring sheet with A-D criteria and the "compensate if = own top
score → average of the 4-ceiling questions" rule, optional KEIs and E2E checklist. **No scoring
engine or schema change is needed beyond the (R) flag** — `fmSheetParser.ts` needs a few new
layout options (listed under "Parser work").

| # | Code | Questionnaire (file version, maturity) | Qs | Sub-scenarios (weights) | KEIs | E2E | Notes |
|---|------|------|----|------|----|----|----|
| 1 | GB1521E | IP Network Planning v1.1.0 | 7 | 3 (0.4/0.3/0.3) | – | Y | criteria inline in questionnaire J-M and Scoring E-H (shifted columns); sub-scenario name spread over 2 rows |
| 2 | GB1522A | Wireless Network Deployment v2.0.0, Beta | 8 | 4 (0.3/0.3/0.3/0.1) | – | – | sub-scenario weights only on the Scoring sheet (row 3) |
| 3 | GB1522B | Core Network Deployment v1.0.0, Alpha | 8 | 2 (0.8/0.2) | – | – | |
| 4 | GB1524A | Wireless Change Management with indicators V2.0.0, Beta | 9 | 6, last = "Other … (% TBD)" | 2 (A-D) | – | Scoring has empty "HVS score" blend labels — not implemented in the source, KEI stays a separate score |
| 5 | GB1524B | Core Network Change Management v1.1.0 | 9 | 4 incl. "Other … to be defined" 0.1 | – | – | **Scoring uses unweighted `AVERAGE`** of the 9 question scores; one compensation cell (U12) points at row 7 |
| 6 | GB1524E | IP Change Management v1.1.0 | 9 | 6 in 3 categories (Device / Configuration / Service) | – | Y | category row like IP FM |
| 7 | GB1525A | RAN Network Quality Optimization V1.1.0, Beta | 7 | 6 (0.15×5, 0.25) | 2 (A-C) | – | **unweighted `AVERAGE`**; some compensation averages start with an empty argument (`AVERAGE(,P5,…)`, counts as 0). v7/v8/v9 are older Alpha drafts; the two v1.1.0 files differ only in their Status cell — the "Team-Approved" one is used |
| 8 | GB1525D | Transport (OTN) Quality Optimization v1.0.0 | 8 | 3 header columns (0.6/0.25/0.15) | – | – | **Scoring sheet scores a single answer column** — the sub-scenario columns are never used; weights sum 0.9999… |
| 9 | GB1525E | IP Network Quality Optimization v2.0.1, Beta | 7 | 4, last = "Other Subscenario" weight 0 | 1 (A-C) | Y | one Cognitive Activity is "Perceived" (not IAADE), one "analysis" lower-case |
| 10 | GB1526A | RAN Energy Efficiency Optimization v2.0.0, Beta | 9 | 3 (0.2/0.4/0.4) | 1 (A-C) | – | two v2.0.0 files: same questions; the underscore-named one has the KEI footnotes and internal formulas — used |
| 11 | GB1528A | RAN Routine Maintenance V1.0.0 | 8 | 4 incl. "Other Sub-scenarios" 0.05 | – | – | column B header "Category"; Method 2 Climbing "for reference" ignored as in RAN |
| 12 | GB1529 | Proactive Security v1.0.0 (file named "Template") | 9 | 4 incl. "Other sub-scenarios" 0.05 | – | – | Scoring sheet's HVS column says "Fault Management - Maintenance" (copy leftover) |
| 13 | GB1502D | Private Line Service Delivery V1.0.0, Alpha | 9 | none (single answer) | 4 (A-D) | – | like Core Stability → synthetic `OVERALL` sub-scenario; some weights typed as "10%" text; Scoring answer cells link to a different sheet name |
| 14 | GB1503B | Home Broadband Service Assurance v2.0.0, Beta | 7 | 3 (0.35/0.35/0.3, weight inside the name "Stuttering/lag (35%)") | 2 (A-D) | Y | sheet name typo "HBB Servie Assurance" |
| 15 | GB1503H | IP Private Line Service Assurance v1.0.0, Alpha | 8 | 5 header columns (0.2 each) | – | – | same as GB1525D: **only one answer column is scored**. Four GB1503H/GB1503X files on the wiki; the v1.0.0 file with standard Document Title/Notice/Appendix sheets is used (others are working copies with "_Orange" sheets) |
| 16 | GB1504A | Individual Services Complaint Handling v1.1.0, Beta | 9 | 3 (0.55/0.35/0.1) | – | – | file is the "with tracking version"; questionnaire sheet "Customer Complaint(Clear)" |
| 17 | GB1504B | Home Broadband Complaint Handling v2.0.0 Beta | 8 | 3 (0.4/0.35/0.25) | – | Y | weights row above names; criteria inline J-M |
| 18 | GB1505A | Individual Service Fault Management v2.0.0 | 8 | 2 (0.7/0.3) | 2 (A-D) | Y | Scoring labels "Capability final score (70%)" but has no blend formula — KEI stays separate |
| – | GB1503A | Individual Services Service Assurance v2.0.0 | | | | | **file not downloaded yet** |

## Decisions on source defects (2026-10-21)

1. **Scoring is always the tool's general weighted rule.** GB1524B and GB1525A (the only two
   files using an unweighted `AVERAGE` per sub-scenario; GB1525A also has `AVERAGE(,…)` phantom
   zeros) are scored weighted like the other 16 — their golden-master tests use hand-computed
   values, not Excel's cached ones.
2. **"Other sub-scenarios" placeholders**: columns with weight 0 or "TBD" (GB1524A, GB1525E) are
   dropped; ones with a real weight (GB1524B 0.1, GB1528A 0.05, GB1529 0.05, GB1504A "Other
   Network-Related" 0.1) stay as normal sub-scenarios.
3. **GB1525D / GB1503H are answered per sub-scenario** (questionnaire sheet), not once as their
   Scoring sheets do.
4. GB1503A: the user adds the file; it joins batch B.
5. Domain / HVS names: the proposal below (no objection raised — change before deploy if needed).

### Proposed Domain (networkType) and HVS (hvsCategory)

| Code | HVS | Domain |
|------|-----|--------|
| GB1521E | Planning | IP |
| GB1522A / GB1522B | Deployment | RAN (Wireless) / Core |
| GB1524A / B / E | Change Management | RAN (Wireless) / Core / IP |
| GB1525A / D / E | Quality Optimization | RAN / Transport (OTN) / IP |
| GB1526A | Energy Efficiency Optimization | RAN |
| GB1528A | Routine Maintenance | RAN |
| GB1529 | Proactive Security | Security (cross-domain) |
| GB1502D | Service Delivery | Private Line |
| GB1503A / B / H | Service Assurance | Individual Services / Home Broadband / IP Private Line |
| GB1504A / B | Complaint Handling | Individual Services / Home Broadband |
| GB1505A | Service Fault Management | Individual Services |

## Implementation steps

1. **(R) flag**: `Questionnaire.inReview Boolean @default(false)` (migration), `ParsedQuestionnaire.inReview`,
   `QuestionnaireDto.inReview`, `HvsEntryDto` too. Frontend helper `formatHvsName(q)` → "Change
   Management (R)" with a tooltip "In review at TM Forum — content may still change", used in the
   HVS/domain picker, page headers, results, Executive/Deep-Dive selectors, project questionnaire
   selection and the Excel/PDF exports.
2. **Opt-in per project**: `createProject` and the migration only grant non-`inReview`
   questionnaires; the project template's Questionnaire drop-down lists (R) ones as well.
3. **Parser work** (`fmSheetParser.ts` layout options): sub-scenario weights from the Scoring
   sheet (GB1522A) or parsed from the name (GB1503B); criteria column offset (GB1521E, GB1504B);
   multi-row sub-scenario names; percentage-string weights (GB1502D); no-sub-scenario mode;
   optional exclusion of placeholder columns. One small parser file per questionnaire (layout +
   guideline mapping), same pattern as `parseIpFmXlsx.ts`.
4. **Tests per questionnaire**: parsed structure (counts, weights sum to 1, criteria from the
   Scoring sheet), and a golden master of the workbook's demo answers through `computeScoreResult`
   vs Excel's cached values — where the source formula is defective, the test documents the
   difference and checks against a hand-computed value instead.
5. **Text corrections** (`textCorrections.ts`) for obvious typos found while seeding.
6. Batches: A = network layer (1-12), B = service layer (13-18 + GB1503A). Each: branch → review →
   merge → Cloud SQL backup → deploy `anlet-504115` → self-test (local headless walkthrough, then
   production smoke check) → record revision + rollback target here.
7. Update CLAUDE.md (new section, questionnaire count, source-defect list).

## Status

### Batch A — network layer (12 questionnaires) — built 2026-10-21

- `Questionnaire.inReview` (migration `20261021120000_questionnaire_in_review`); the seed appends
  " (R)" to the stored name, so every picker, header, selector and Excel/PDF export shows it.
  `lib/inReview.ts` tags labels built from other fields: an HVS card gets "(R)" plus the note "In
  review at TM Forum — the questionnaire content may still change" when every questionnaire under
  it is in review; domain cards and the Comment Collection's HVS label get "(R)" too.
- `createProject` (and a project created by the Excel import) starts without (R) questionnaires
  (`defaultQuestionnaireIds`); Admins add them in "Edit questionnaires" or the template's
  Questionnaires sheet, where a name matches with or without " (R)". Seeding never touches project
  selections. Memberships outside projects (Detecon) see everything, as before.
- One config-driven parser, `prisma/seed/parseReviewQuestionnaires.ts`, plus
  `standardGuideline.ts` (Introduction / Sub-scenarios text, per-question answering guidance
  matched by Service Capability or question text, multi-row blocks joined). `fmSheetParser.ts`
  gained: Scoring-sheet sub-scenario weights, a description row, placeholder dropping, a criteria
  column offset, a Scoring-row text guard, percentage weights, "(including …)" / "(35%)" /
  "Sub-scenario-1:" name clean-up, capitalized Cognitive Activities, KEIs without / with a
  multi-row note.
- Tests: `parseReviewQuestionnaires.test.ts` (structure per questionnaire, golden masters of the
  workbooks' demo answers where Excel's cached value is meaningful, hand-computed fixtures for
  GB1524B / GB1525A / GB1525D), a project test for the opt-in default.
- Found while testing locally: `ResultsPage` showed the "Core Domain combined score" for every
  questionnaire with networkType Core — now only for Core FM / Stability (`CoreDomainSummary`'s
  `questionnaireCode`).
- Further source notes: GB1525D scores C = 0 on its Intent and Decision questions and D = 0
  everywhere (Scoring sheet, used as is); GB1525E's sub-scenario weights add up to 0.9 (scores are
  normalized; its E2E rate maxes out at 0.9, as Core FM's does); GB1525E's "Perceived" Cognitive
  Activity is kept as its own group; GB1526A's Scoring sheet has unused "% of Autonomy 0.75 / % of
  Indicators 0.25" cells.

#### Batch A release (2026-10-21)

- Merged to `main` (e3123b9); on-demand Cloud SQL backup "before review-questionnaires batch A".
- Deployed revision **anlet-00013-dvb** (rollback target: **anlet-00012-cp7** — the old code ignores
  the new `inReview` column, so traffic can simply be moved back).
- `npm run db:seed:questionnaires` on production: 12 questionnaires with `inReview` + 7 released;
  0 project selections include an (R) questionnaire (opt-in per project).
- Self-tests: all workspaces' tests, lint and typecheck; local headless walkthrough (HVS picker
  with (R) cards, an (R) questionnaire page, submit → results, project member not seeing (R)
  questionnaires); production smoke check (home 200, `/api/auth/me` 401). A logged-in production
  walkthrough needs an account I can't sign in with.

### Batch B — service layer (next)

GB1502D, GB1503B, GB1503H, GB1504A, GB1504B, GB1505A, plus GB1503A once its file is in
`review_questionnaires/`. GB1502D has no sub-scenarios (single `OVERALL` like Core Stability).
