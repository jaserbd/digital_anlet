# Question / note / answer styling

**Status: steps 1–4 done** (29 frontend tests, browser check of IP/Core questions, KEI step, Executive view, sample PDF). Remaining: merge, deploy.

Source: `admin_management.md` line 13 (local notes), clarified in discussion on 2026-10-08.

## Decisions

| Topic | Decision |
|---|---|
| Style | **Color + font**: question text larger, bold, dark blue; notes smaller, italic, grey, in a light box with a left border; A–D options each in a light tinted card with a colored letter badge (`A · 4`) and normal text. |
| Answers | **Both**: the option descriptions *and* the user's selected answer per sub-scenario (the chosen radio shows as a highlighted chip, so picked answers stand out from the rest). |
| Scope | **Question screens** (all 7 questionnaires), **KEI step**, and **Results & PDF** (plus the Executive/Deep-Dive answer-distribution question view, which shows the same question/options). |
| Deploy | Same flow as last time: tests + browser check, commit, merge to `main`, you push, build + deploy to `anlet-504115` with your OK. |

## Findings

- Question text, notes and options all render as plain text today (`QuestionCard.tsx`, `KeiCard.tsx`, `AnswerDistributionDrilldown.tsx`); only the `A (4).` prefix is bold.
- **Notes are embedded in the question text**, not a separate field: 23 of 58 questions (RAN 2, Core FM 2, Core Stability 4, IP 5, Transport OTN 2, Fixed Access 8) contain a paragraph starting `Note:`, `Note :`, `NOTE:` or `NOTE 1:` after the question sentence. These can be split reliably on the first line that starts with that marker — **frontend-only, no database or seed change**.

## Design

- New `lib/questionText.ts`: `splitQuestionNote(text)` → `{ question, note | null }` (first line matching `^\s*note\s*\d*\s*:`, case-insensitive; Windows line endings normalized). Unit-tested against the real marker variants above.
- New shared components (one place for the look, reused everywhere):
  - `QuestionText` — question part styled, note part in the note box.
  - `OptionList` — A–D option cards with letter + criteria badge.
- Answer table (`QuestionCard`): the selected option's label becomes a filled chip in the option's color; "No answer" stays grey. Existing amber "unanswered" row highlight kept.
- KEI cards: indicator description styled as question text; options as option cards (the radio sits inside the card); selected card highlighted.
- Executive / Deep-Dive answer distribution: `QuestionText` + `OptionList` (compact, read-only).
- PDF (`QuestionnaireResultDetail` "Questions & options", `pdfSections` answer distribution): question line bold/dark blue, note lines italic/grey, options normal — needs `exportPdf.ts` text sections to support per-line style (small additive change). Excel export unchanged.
- Colors from the existing MUI `theme.ts` palette, checked for contrast (WCAG AA) — color is never the only signal (bold/italic/box also differ).

## Steps

1. `splitQuestionNote` + tests.
2. `QuestionText` / `OptionList`; apply to `QuestionCard` (incl. selected-answer chip), `KeiCard`, `AnswerDistributionDrilldown`.
3. PDF per-line styling; apply to both PDF builders.
4. Typecheck, lint, tests; browser check on RAN, Core, IP, Fixed Access, a KEI step, Executive view and a PDF.
5. Commit, merge to `main`; you push.
6. Build + deploy to `anlet-504115` with your OK.
