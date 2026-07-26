# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**MVP + Executive views + Admin benchmarking are demoable.** Admin can create organizations and users, and see a cross-organization benchmarking table (average final score, average E2E rate, and per-sub-scenario averages, one row per org). A Normal User can log in, answer the RAN Fault Management questionnaire, submit, and see a results dashboard (final score + sub-scenario breakdown + E2E checklist). An Executive can see every respondent's status/score and a per-question, per-sub-scenario answer-option distribution, scoped strictly to their own organization. Verified by automated tests (28 passing, including three DB-backed integration tests and a golden-master scoring fixture) and full live browser walkthroughs matching the golden-master numbers exactly (final score 3.91, E2E rate 70%). Not yet built: Core Network FM (GB1059B) — see the phased roadmap in the implementation plan.

## What this project is

An assessment tool for **TM Forum Autonomous Network (AN) maturity levels (L0–L5)**, replacing a manual, Excel-based questionnaire process with a cloud application.

- TM Forum defines Autonomy Levels 0 (fully manual) through 5 (fully autonomous).
- CSPs (telecom operators) are assessed against these levels via standardized questionnaires per **High-Value Scenario (HVS)**.
- HVS categories span Network Layer (Fault Management, Change Management, Quality Management, Energy Management, Resource Management, Planning, Deployment) and Service Layer (Service Assurance, Complaint Handling, Service Delivery, Service Marketing, Service Fault Management), across network types (RAN, Core, IP, Transport, Fixed Access).
- Only two questionnaires are finalized today: **RAN Fault Management (GB1059A)** and **Core Network Fault Management (GB1059B)**. **Initial project scope is RAN Fault Management only** (`RAN_FM.xlsx`); Core Network FM follows the same shape and should reuse the same data model. Other HVS questionnaires do not exist yet — do not build for them speculatively.
- The core workflow being replaced: today `RAN_FM.xlsx` is emailed to ~10 engineers per client, filled in independently, then manually collected and aggregated into a chart. The app must eliminate that manual aggregation and enable direct cross-client benchmarking.

## Source-of-truth documents (read before touching domain logic)

- `RAN_FM.xlsx` — the reference spreadsheet. Its 4 sheets (`Guideline`, `RAN - Fault Management`, `Scoring`, `E2E Automation Ratio Checklist`) are the authoritative source for question text, weights, per-option scoring criteria, and the scoring/E2E formulas — not this file's prose. If this file and the spreadsheet ever disagree, re-derive from the spreadsheet's actual cell formulas (not just cached values) and correct this file.
- `What is ANLET compensation.pdf` — TM Forum's own explainer for the "compensation" mechanic in the Scoring sheet (see below). Read this before modifying `scoring.ts` — it gives the general rule; the xlsx formulas alone only show 8 specific instances of it and are easy to over-fit to.
- `REQUIREMENTS.md` — original raw requirements (roles, stack, workflow).

## Domain model (from `RAN_FM.xlsx`)

1. **Guideline** (reference only, no data entry) — explains the Cognitive Activity model **IAADE** (Intent, Awareness, Analysis, Decision, Execution) and the 5 **sub-scenarios** derived from `alarmType` in 3GPP TS 28.111: Equipment, Processing Error, Communications, Environmental, Security. Each sub-scenario has a fixed **fault-distribution weight** (Equipment 0.15, Processing Error 0.15, Communications 0.3, Environmental 0.3, Security 0.1).

2. **`RAN - Fault Management`** (the questionnaire) — one row per question (8 rows: Intent-driven, Data collection & Alarm filtering, Fault Prediction, Fault identification & Impact analysis, Demarcation & Locating, Solution generation, Evaluation and decision-making, Solution implementation). Columns: `Cognitive Activity (IAADE)`, `Service Capability`, `Weight` (question's weight within the questionnaire, all 8 sum to 1.0), `Question` text, `Option A`–`Option D` (A = highest autonomy; some questions only have 3 options), and one **answer column per sub-scenario**. Every question is answered *once per sub-scenario*, not once overall — a full response is 8 questions × 5 sub-scenarios.

3. **Scoring** — derives numeric results from the letter answers.
   - Each question defines numeric **criteria** per option (e.g. A=4, B=3, C=0 — not evenly spaced, and not every option is used). A question's **own top score** is the highest of its option criteria (always Option A's).
   - "Original score" for a sub-scenario/question = the criteria value matching the selected letter.
   - **Compensation** (see `What is ANLET compensation.pdf`): in the AN Level score map, different cognitive-activity tasks reach full automation at different levels — most questions top out at 4, but some top out lower (in this questionnaire: Data collection & Alarm filtering and Fault identification & Impact analysis top out at 3, Solution implementation tops out at 2). When a question's original score equals **its own top score**, it is compensated: bump it up to the average of the *other* questions whose top score is the full ceiling (4), if that average is higher. Without this, a sub-scenario could never reach a perfect score just because one of its tasks has a structurally lower ceiling. This is a **general per-question rule** (`topScore` vs. `questionnaireCeiling`), not a fixed hand-picked list of "anchor" questions — model it that way in code (derive eligibility from each question's own criteria, don't hardcode a list) so it generalizes to Core Network FM's different question set later.
   - "Overall Score" per sub-scenario = weighted sum of the 8 compensated scores, weighted by each question's `Weight`.
   - **Final score** = weighted average of the 5 sub-scenario overall scores, weighted by the sub-scenario fault-distribution weights.
   - A separate "Method 2: Climbing" column set exists per question but is marked "for reference only" in the sheet — Method 1 (Average, above) is the official method to implement.

4. **`E2E Automation Ratio Checklist`** — derives an end-to-end automation ratio per sub-scenario:
   - Per question/sub-scenario cell: `S` (System) if the answer is "A", else `P` (People).
   - **The Intent question is excluded from this check** (`E2E Automation Ratio Checklist!C12`'s formula only ranges over the Awareness→Execution rows) — a sub-scenario can still achieve E2E "Y" even if its Intent answer isn't "A". Don't infer this from "all questions are A"; it's specifically all questions *except Intent*.
   - Per sub-scenario: E2E automation achieved (`Y`) only if every non-Intent question scored `S`.
   - **E2E Automation Rate** = sum of the fault-distribution weights of only the sub-scenarios that achieved `Y`.

**Golden-master test fixture** (verified against the xlsx's own demo answers — use as the first `scoring.test.ts` case): answers `[A,B,A,A,A]`, `[A,A,B,A,A]`, then all-`A` for the remaining 6 questions (Equipment/ProcessingError/Communications/Environmental/Security order) → sub-scenario scores Equipment=4, ProcessingError=3.83, Communications=3.8, Environmental=4, Security=4; **final score = 3.9145**; E2E Y/N = Y,Y,N,Y,Y → **E2E rate = 0.7**.

## Architecture

Monorepo, npm workspaces (plain npm, no Turborepo/Nx): `shared/`, `backend/`, `frontend/`.

- **`shared/`** (`@anlet/shared`) — types/enums only (`Role`, `AnswerOption`, API/score DTO shapes), consumed as TS source directly by both other workspaces (no build step). Keeps frontend/backend from drifting on shared vocabulary. No runtime logic lives here — scoring stays backend-only/authoritative.
- **`backend/`** (`@anlet/backend`) — Express + Prisma + PostgreSQL. Domain modules live under `src/modules/<domain>/{routes,controller,service}`; the scoring engine (`src/modules/scoring/scoring.ts`, Phase 1) is a pure-function module with zero Prisma/Express imports so it's unit-testable without a DB.
- **`frontend/`** (`@anlet/frontend`) — Vite + React + TypeScript, React Router, TanStack Query.
- **Single-host deployment**: one Cloud Run service / one Docker container. `frontend`'s Vite build writes directly to `backend/public` (see `frontend/vite.config.ts` `outDir`); `backend/src/app.ts` serves `/api/*` routes, then that directory as static assets, then falls back to `index.html` for client-side routes. There is no separately-hosted frontend and no CORS layer (same-origin in production). Local dev still runs two processes (Vite dev server + `tsx watch`) for HMR — that's a dev-time convenience, not a contradiction of the single-host production model.
- **Auth**: custom email/password, bcrypt-hashed, JWT in an httpOnly/Secure/SameSite=Lax cookie. No external auth vendor, no self-signup — Admin creates all users (seeded into an internal "Anlet (Internal)" organization; the bootstrap Admin itself comes from `ADMIN_EMAIL`/`ADMIN_PASSWORD` via `prisma/seed/seed.ts`, idempotent).
- **Backend modules built so far**: `auth` (login/logout/me), `organizations` + `users` (Admin-only create), `questionnaire` (read-only structure, criteria numbers stripped from the response so answers can't be reverse-engineered client-side), `responses` (answer/submit/result, ownership-guarded), `insights` (org-scoped questionnaire summary for Executive/Admin — respondent statuses/scores + per-question/per-sub-scenario answer distribution — plus a cross-org `getBenchmarkingSummary` for Admin, both aggregated over `SUBMITTED` responses only; an org with zero submissions gets `null` averages, never a misleading `0`). `responses.service.ts`'s `getOrCreateResponse` is **single-shot per user per questionnaire**: it returns the user's existing response (whatever its status) rather than creating a new one, so revisiting `/questionnaire` after submitting redirects to the existing results instead of silently starting a second attempt — this was a real bug caught during manual browser testing (the original version only checked for an `IN_PROGRESS` response, so a `SUBMITTED` one meant "create a fresh one").
- **Route-mounting gotcha** (also caught by manual testing, not by tests): a router-level `router.use(authenticate, requireRole(...))` with no path applies to **every** sub-path under that router's mount prefix, not just its own defined routes. Mounting a second router at the same prefix (e.g. `/organizations`) does not give it an independent role check — the first router's blanket middleware intercepts the request first and can short-circuit with a 403 before the second router is ever reached. `organizations.routes.ts` now applies `authenticate`/`requireRole` per-route instead of via a blanket `router.use(...)`, since it hosts three routes with different role requirements (Admin-only org CRUD, Admin-only `/benchmarking`, Executive-or-Admin `/:orgId/questionnaire-summary`) at the same prefix. Keep this in mind before adding a second router at an existing mount point, or before assuming a `router.use()` guard only affects that router's own routes.
- **Frontend pages built so far**: `LoginPage`, `QuestionnairePage` (5-step sub-scenario flow with autosave-per-answer and resume support), `ResultsPage` (score summary + E2E checklist grid mirroring the xlsx sheet), `AdminPage` (create org, create user, cross-org benchmarking table with a single-hue bar for the average-score column), `ExecutivePage` (respondents table + per-sub-scenario answer-distribution table, own org only). Routing/role-gating in `App.tsx` via `ProtectedRoute`.
- Full schema/module design and the phased roadmap (MVP → Executive views → Admin benchmarking → Core Network FM → deployment hardening) live in the implementation plan; re-derive from current repo state if that plan file is unavailable, don't assume it's still accurate once later phases are underway.

## Commands

```bash
# Install (workspace-aware)
npm install

# Local Postgres (docker-compose), then copy env files once:
docker compose up -d
cp .env.example .env
cp backend/.env.example backend/.env    # edit ADMIN_EMAIL/ADMIN_PASSWORD/JWT_SECRET as needed

# Apply migrations, then seed (internal org + bootstrap Admin + RAN FM questionnaire
# parsed from RAN_FM.xlsx). Idempotent — safe to re-run.
cd backend && npx prisma migrate dev
cd backend && npm run db:seed

# Dev (backend :4000 via tsx watch, frontend :5173 via Vite, proxying /api -> :4000)
npm run dev

# Lint / typecheck / test (all workspaces)
npm run lint
npm run typecheck
npm test

# Run a single backend test file
npm test -w backend -- src/modules/scoring/scoring.test.ts

# Production-style build + single-host run, without Docker
npm run build && npm start   # serves built frontend from backend/public on :4000 (local) / :8080 (Docker default)

# Docker (single-host image)
docker build -t anlet .
docker run -p 8080:8080 -e DATABASE_URL=... -e JWT_SECRET=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... anlet
```

Note: the backend's default dev port is `4000` (set via `backend/.env`'s `PORT`), not `8080` — chosen to dodge a local port conflict during scaffolding; Cloud Run/Docker still default to `8080` (`env.ts`'s fallback), which is what `EXPOSE`/Cloud Run expect. If `8080` is free on your machine, you can safely set `PORT=8080` locally instead and update `frontend/vite.config.ts`'s proxy target to match.
