# New HVS plan — IP, Transport (Microwave & OTN), Fixed Access + KEIs

Source request: `new_ip_fm.md`, extended in discussion to also cover `Transport.xlsx` and
`Fixed_Access.xlsx`, sub-scenario categories, and Key Effectiveness Indicators (KEIs).

## Source files

| File | TM Forum doc | Status | Questionnaires |
|---|---|---|---|
| `IP_FM.xlsx` | GB1523E v2.0.2 | GA / Production | IP Network Fault Management — 8 questions, 8 sub-scenarios in 3 categories, E2E checklist, 3 KEIs |
| `Transport.xlsx` | GB1523D v2.1.0 | Beta / Pre-production | Microwave FM — 9 questions, 4 sub-scenarios in 3 categories, 2 KEIs; OTN FM — 8 questions, 6 sub-scenarios in 3 categories, 4 KEIs. No E2E checklist |
| `Fixed_Access.xlsx` | GB1523C v1.0.0 | Alpha / Pre-production | Fixed Access (PON) FM — 9 questions, 4 sub-scenarios (no categories), E2E checklist, no KEIs |

RAN_FM.xlsx and CORE_FM.xlsx contain **no** KEIs.

## Decisions

| Topic | Decision |
|---|---|
| Scope | IP FM + Transport Microwave + Transport OTN + Fixed Access: 4 new questionnaires, 3 new domains |
| Codes / domains | `IP_FM_GB1523E` (IP), `TRANSPORT_MW_FM_GB1523D` + `TRANSPORT_OTN_FM_GB1523D` (Transport), `FIXED_ACCESS_FM_GB1523C` (Fixed Access) |
| Sub-scenario categories | New nullable `SubScenario.category`; grouped headers shown when present. RAN/Core have none → unchanged |
| Criteria numbers | Always from the Scoring sheets (IP's questionnaire tab is missing Solution Generation criteria and Awareness option D) |
| Compensation | General rule in `scoring.ts`, unchanged — including for Microwave, whose Scoring sheet has copy-paste formula errors (Intent Fulfilment B-answer compensated; Execution average excludes Intent Fulfilment) |
| Transport | Two independent HVSs, no combined Transport score; `hasE2ECheck = false` (no checklist in source) |
| Question "Note:" text | Kept inline in the question text, as in the xlsx |
| Fixed Access answering guideline | Guideline sheet's 8 rows are shifted vs. the 9 questions — matched by question text, mapping reviewed before seeding; unmatched questions get none |
| Transport answering guideline | Guideline sheet section III is written for Microwave's 9 questions; matched by service capability where it applies to OTN |
| KEIs | Generic feature, populated for IP, Microwave, OTN. Options A/B/C scored 4/3/2. Microwave's Scoring sheet KEI block is broken (`#REF!`, references OTN) → use the Microwave questionnaire tab's own KEIs (MTTR 0.6, automation rate 0.4) |
| KEI score | Separate "Effective Indicator Score" (weighted average), shown beside the Capability Score — never blended |
| KEI required | Mandatory for submit, but may be skipped when covered by a comment; skipped KEIs are excluded and the weights re-normalized |
| KEI indicator value | Optional measured-value field per KEI; shown in drill-downs/exports, not scored |

## Phase A — 4 questionnaires + sub-scenario categories

**Status (2026-10-04): done and verified** — migration + seed applied on a local Postgres (seed
re-run is idempotent), 121 backend tests (incl. `tests/newHvs.integration.test.ts`, a DB-backed
answer → submit → benchmark → drill-down round trip for all 4 questionnaires) and 15 frontend tests
pass, plus a browser walkthrough as Normal User / respondent / Executive. Fixes from the walkthrough:
Transport's two questionnaires now use hvsCategory "Fault Management" (the picker is HVS-first —
Fault Management → Transport Domain → Microwave / OTN); QuestionCard shows categories as heading rows.

Additional source defects found while building it: Fixed Access's E2E formula (`C6:C12`) also excludes
Data Collection — the general Intent-only rule is used; Microwave's 4th demo column answers D on two
A–C-only questions, so only its first 3 cached sub-scenario scores are reproducible.

1. **Schema**: `SubScenario.category String?` + migration; `ParsedSubScenario.category`; `SubScenarioDto.category`.
2. **Parsers** (each with a test file):
   - `parseIpFmXlsx.ts`
   - `parseFixedAccessXlsx.ts`
   - `parseTransportXlsx.ts` (exports Microwave + OTN parsers)
   - Tests verify weights, criteria from Scoring sheets, guideline extraction, and reproduce each file's cached
     demo results through `computeScoreResult` (IP capability 0.9 / E2E 0; Fixed Access 4.0 / E2E 1;
     Microwave 2.41). A mismatch is reported, not papered over.
3. **Seed**: add the 4 questionnaires to `seed.ts` (idempotent; `QuestionnaireOrgSetting` backfill is automatic).
4. **Frontend**: category header row above sub-scenario columns/rows in `QuestionCard`,
   `ScoreBreakdownTable`, `E2EChecklistTable`, answer-distribution tables; check layout with 6–8 sub-scenarios.
5. **Docs**: CLAUDE.md domain-model sections; commit the 3 xlsx files.

## Phase B — KEIs

1. **Schema**: `EffectivenessIndicator` (questionnaire, sortOrder, name, description, weight, option A–C text
   and criteria); `ResponseKei` (response, indicator, option?, indicatorValue?, comment?);
   `ScoreResult.keiScore Float?`.
2. **Scoring**: pure `computeKeiScore()` in `scoring.ts`; golden master from IP_FM.xlsx demo (B, C, C → 2.4).
3. **Backend**: KEI upsert/delete endpoints; `submitResponse` blocks on uncovered KEIs (same 422 mechanism);
   KEI score recomputed on re-submit; insights — average KEI score in benchmark rows, KEI answer
   distribution + per-respondent drill-down, KEI comments in the comment lists.
4. **Frontend**: "Effective Indicators" step after Execution, before Review; KEI gaps in Review (clickable);
   Results; Executive/Admin/Deep-Dive benchmark columns + charts; Comment Collection; Excel/PDF exports.

## Deployment / verification

- After deploy, re-run the idempotent seed on the GCP database.
- `npm run lint`, `npm run typecheck`, `npm test`; browser walkthrough per new questionnaire as
  Normal User, Executive and Admin.
- Transport (Beta) and Fixed Access (Alpha) are pre-production drafts — a TM Forum revision means
  re-running the parsers, but wording may change under existing responses.
