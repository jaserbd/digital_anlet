# Spelling and typo corrections

**Status: steps 1–3 done** (list approved 2026-10-08: 110 visible fixes + 62 spacing-only; tests; local questionnaires-only re-seed verified — answers and super admin untouched). Remaining: merge, deploy, production re-seed.

Source: `admin_management.md` line 16 (local notes), clarified in discussion on 2026-10-08.

## Decisions

| Topic | Decision |
|---|---|
| Scope | **Typos + spacing/punctuation + clear grammar/word errors** (e.g. "nature language" → "natural language"). Never change meaning or rewrite TM Forum wording. |
| UK / US | **Leave as in Excel** — fulfilment/fulfillment, unauthorised etc. are both correct; only real errors change. |
| Where | **Correction list in the app**: the xlsx files stay untouched as the original source; the seed applies a documented list of fixes when loading them. |
| Review | **You approve the full before/after list** before anything goes live. |
| Deploy | Same flow: tests, commit, merge, push, build, deploy, then re-seed production questionnaires. |

## Findings (first pass)

- App's own screen text and messages (frontend + backend): no spelling errors found.
- All 7 questionnaires (570 text items, ~21,000 words) — clear misspellings: "Sub-scenairo" ×8, "identifty" ×2,
  "fileting" ×3, "unaccessable" ×2, "intructions", "petential", "milisecond", "serive", "nonconsequential";
  ~25 spacing/punctuation issues ("Collection& Alarm", "Identification ,Risk", "fulfilment ?", "tool,but",
  "expertise(such as"); wording candidates such as "nature language user interface". A full read-through for
  grammar/word errors is step 1.

## Design

- `prisma/seed/textCorrections.ts`: an ordered list of `{ questionnaire?, find, replace, reason }` fixes, applied
  by one function to every parsed text field (names, guideline, sub-scenarios, questions, options, guidelines,
  KEIs) between parsing and seeding. Covers all 7 questionnaires in one place.
- **Each fix must match**: a test fails if a fix no longer finds its text (e.g. a future Excel already corrected
  it), so the list never silently goes stale. Parser golden-master tests stay on the original text.
- Production: the seed updates text in place (same question/option ids), so existing answers and comments are
  kept. New seed option **questionnaires only** so re-seeding production doesn't also reset the super admin's
  password (the current seed does that).

## Steps

1. Full read-through of all questionnaire text; publish the before/after correction list for your approval.
2. Implement `textCorrections.ts` + tests + the questionnaires-only seed option; apply your approved list.
3. Typecheck, lint, tests; local re-seed and browser spot-check.
4. Commit, merge to `main`, push.
5. Build + deploy to `anlet-504115`, then re-seed production questionnaires (via Cloud SQL proxy), with your OK.
