# Anonymous answers for Executives

**Status: steps 1–3 done** (274 backend + 30 frontend tests; browser check as Executive, Admin and participant). Remaining: commit, deploy.

Source: `admin_management.md` line 18 (local notes), clarified in discussion on 2026-10-12.

## Decisions

| Topic | Decision |
|---|---|
| Who | **Executives only** see anonymous data. Detecon Admins keep full identities (Admin pages, Organization Deep-Dive) — e.g. to support users. |
| Label | **Stable pseudonym** "Participant 1", "Participant 2"… — the same person has the same label across the answer drill-down, KEIs, comments and exports of one assessment. |
| Details kept | **NatCo, Country, Working Domain.** Email, name and Designation are removed. |
| Respondents table | **Counts per NatCo** (participants, submitted, in progress, not started, average score) — no per-person rows or individual scores. |
| Small groups | **No threshold** — every NatCo is shown as is. |
| Notice | **Yes**: one line above the questionnaire — "Your organization's executives see your answers and comments without your name or email." |
| Deploy | When tests and the browser check pass: commit, merge, push, build, deploy (no database change). |

## Design

- **Enforced on the server**, not hidden in the browser: when the caller's active context is Executive, the
  questionnaire-summary and answer-drill-down endpoints never send emails, names, designations or user ids.
  - Summary: `respondents` is empty and `natCoStatus` holds the per-NatCo counts; `anonymized: true`.
  - Drill-down: every respondent identity becomes `{ label "Participant N", NatCo, Country, Working Domain }`
    with designation null and a pseudonymous id; `anonymized: true`.
- **Pseudonym numbering** is per organization + assessment, ordered by a hash of the membership id — not by
  email, name or submission time — so the numbers reveal nothing. Numbers can shift when a new participant
  submits.
- Benchmarking and spider-chart endpoints are already aggregate-only — unchanged.
- **Frontend**: when `anonymized`, tables/exports show a "Participant" column instead of "Email" and drop
  "Designation"; the Respondents section becomes a NatCo status table + average-score chart per NatCo (screen,
  Excel, PDF, "Download all"). Admin views unchanged.
- Executive's own "Answer as user" results are unaffected (their own data).

## Steps

1. Backend: anonymizing service options + controller wiring; integration tests (Executive gets no identities,
   pseudonyms consistent across answers/comments/KEIs; Admin unchanged).
2. Frontend: anonymized variants of Respondents, Answer distribution, KEI distribution, Comment Collection,
   Answer Matrix and PDF/Excel exports; participant notice.
3. Typecheck, lint, tests; browser check as Executive and as Admin.
4. Commit, merge to `main`, push; build + deploy to `anlet-504115`.
