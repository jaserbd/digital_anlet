# Onboarding emails, case-insensitive login, inline review, visual polish, security review

Source: `admin_management.md` lines 46–50. Decisions taken with the user (2026-11-16):

| Topic | Decision |
|---|---|
| Mail sender (interim) | Try Detecon Microsoft 365 SMTP (`smtp.office365.com:587`, STARTTLS) with `jaserbin.rahman@detecon.com`. Config-only switch to another SMTP provider (Gmail app password, Brevo/Mailgun EU) or the IT shared mailbox later — no code change. |
| Welcome email content | App link + one-time **set-password link** (no password in the email). Clicking it proves the address works = email verification. |
| When to send | "Send welcome email" checkbox (default on) on Create user and both Excel imports; "Resend welcome email" and "Send password reset email" actions in the users table. Generated temporary passwords stay as a manual fallback. |
| Visual refresh | Polish pass, keep Telekom magenta + current layout; before/after screenshots for approval. |
| Security review | Done by Claude (Opus 5.5 — "Fable 5.2" does not exist; latest Fable is 5.1). Report first, then fix agreed items. |

## Research findings

- Forgot-password already exists end-to-end (`auth.service.ts` `requestPasswordReset`/`resetPassword`, `ForgotPasswordPage`, `ResetPasswordPage`, 1-hour hashed single-use token). It only fails because production SMTP is a placeholder (`gcp_deployment.md`, `ADMIN_MANAGEMENT_PLAN.md` Phase 3).
- GCP has no native mail service. Cloud Run blocks outbound port 25 but allows 587/465 → SMTP submission works.
- Microsoft is retiring Basic-auth SMTP AUTH in Exchange Online; Detecon's tenant may already block it (`535 5.7.139 Authentication unsuccessful`). If so → fallback provider or IT's Graph `Mail.Send` app (would need a small Graph transport — only built if needed).
- M365 sending limits: ~30 messages/minute, 10,000 recipients/day → bulk sends must be throttled; a 200-user import can't send inside one request (Cloud Run 300 s timeout, no background CPU after response).
- Emails are case-sensitive everywhere: `findUnique({ where: { email } })` in `login`, `requestPasswordReset`, `createUser`, imports; `User.email @unique` is case-sensitive in Postgres.
- `ReviewStep` gaps call `jumpToQuestion` → `setStepIndex`; the user then has to click Next through every later question to get back to Review.
- Quick security scan: no rate limiting (login, forgot-password), no security headers (helmet), `forgotPasswordHandler` returns 500 if SMTP fails (user-enumeration + noisy), `npm audit`: 15 vulns (2 critical, 10 high) incl. SheetJS `xlsx` (prototype pollution / ReDoS, no npm fix), `zod`, `exceljs → uuid`.

## Phase 1 — Case-insensitive email ✅ live in production (revision anlet-00018-xzg, 2026-11-16)

- Normalize `email.trim().toLowerCase()` at every input boundary: login, forgot-password, create user, add membership, both Excel imports, project-admin candidate lookup, seed `ADMIN_EMAIL`. One helper `normalizeEmail` in `lib/` + zod schemas use it.
- Migration: `UPDATE "User" SET email = lower(trim(email))`, **aborting** if two accounts collide case-insensitively (then merged by hand — check production first via Cloud SQL proxy), plus a unique index on `lower(email)` as a safety net.
- Tests: login with `Jaserbin.Rahman@Detecon.com`, create duplicate differing only in case → membership-added / EmailTaken, import matching.

## Phase 2 — Mail infrastructure ✅ live in production (revision anlet-00019-2xz, 2026-11-16); sending on via interim Gmail `jaser.thesis@gmail.com` (revision anlet-00020-8ds) — test email delivered to the Detecon inbox

- `lib/mailer.ts`: keep nodemailer SMTP; add `SMTP_SECURE`/STARTTLS handling, `MAIL_ENABLED` flag (false in dev/CI → log the link to console instead of sending), a shared branded HTML template (logo, magenta button, plain-text alternative), HTML-escaping of every interpolated value.
- `POST /api/admin/mail/test` (super admin only) + "Send test email" button in the Management Console → verifies the SMTP config from production without creating a user.
- `forgotPasswordHandler`: always 204 even if sending fails (log the error), so mail outages don't reveal registered emails.

## Phase 2b — Email settings in the Management Console ✅ live in production (revision anlet-00023-kcw, 2026-11-16; `anlet-mail-key:1` attached)

- Requested 2026-11-16: switch to IT's shared mailbox from the UI instead of GCP commands. Interim sender stays `jaser.thesis@gmail.com`.
- `MailSettings` row (wins over env), password encrypted with `MAIL_ENCRYPTION_KEY` (new secret `anlet-mail-key`), login verified before saving, optional Reply-To, Microsoft 365 / Gmail presets, reset to server defaults. Super admin edits; other Application Admins read.

## Phase 3 — Welcome / set-password emails ✅ live in production (revision anlet-00024-bsp, 2026-11-16)

Built as below, with one deliberate change: sending a welcome/reset email **never resets the password** (a "Resend" to someone already active must not lock them out) — the link just lets them set one. New accounts created with the checkbox get an unknown random password.


- `PasswordResetToken` gains `purpose` (`RESET` | `INVITE`); invite TTL 7 days, reset stays 1 hour. Issuing a new token of the same purpose invalidates older unused ones.
- `User.emailVerifiedAt DateTime?` — set when an invite or reset link is redeemed (or the user logs in and changes password). Shown as "Verified ✓ / Not yet" in the users table.
- Create user with "Send welcome email" on: account created with an unguessable random password, `mustChangePassword` false; invite email = app URL + "Set your password" link → existing `ResetPasswordPage` (wording varies by purpose: "Welcome — set your password"). Off: current behavior (generated/typed temp password shown once).
- Bulk (both imports): accounts are created as today; the frontend then calls `POST /users/welcome-emails { userIds }` in chunks of ≤10, showing "Sending 40 / 200…" with per-user result (sent / failed — reason). Server throttles to stay under 30/min. Failed rows can be retried or fall back to the temp password in the results download.
- Users table actions (same permission rules as temporary passwords, `assertProjectAdminMay*`): **Resend welcome email** (new invite token), **Send password reset email**.
- Production: `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, `SMTP_USER=SMTP_FROM=jaserbin.rahman@detecon.com`; the user adds the password as a new version of the `anlet-smtp-password` secret themselves (never pasted into chat). Update `gcp_deployment.md`.

## Phase 4 — Inline answering on the Review step ✅ live in production (revision anlet-00025-mw9, 2026-11-16)

- Clicking a gap in `ReviewStep` expands that question **in place** (the same `QuestionCard` with answers + comment editor), not a stepper jump. Several can be open; each has a "Collapse" button.
- Expanded state is kept by question id in `ReviewStep`, independent of the gap list — so the card does not vanish mid-typing when the question becomes covered; it shows a green "Covered ✓" badge instead.
- The gap list, counts and the Submit button below update live (the same `answers`/`comments` state and mutations as the stepper — `QuestionnairePage` passes `handleSelect`/`handleCommentChange` down; no second save path, preserving the `QuestionCommentEditor` single-save fix).
- Same for KEIs: uncovered KEIs expand their `KeiCard` inline.
- "Go to question" stays available as a secondary link for anyone who prefers the full step.
- Built as planned ("Answer here" / "Close", "Open as step"; more than 3 missing sub-scenarios show as one count chip with names on hover). `QuestionnairePage`'s `renderQuestionCard`/`renderKeiCard` are shared by the steps and the Review step.
- Found while testing: closing a card (or clicking Next) within the 500 ms comment debounce dropped the comment. `QuestionCommentEditor` now flushes a pending save on unmount, like `KeiCard`.
- Verified in Chrome (IP FM, 8 sub-scenarios + 3 KEIs): answered and commented inline, counts and Submit updated live, a comment typed right before Close was saved, submitted from the Review page.

## Phase 5 — Visual polish (keep brand) ✅ live in production (revision anlet-00026-pzs, 2026-11-16)

Screenshot every main page first, then: login page (hero panel, clearer card), `AppHeader` (compact nav with icons, user menu holding email/context/logout), Home/Domain/HVS picker cards (icons per domain, hover elevation), question stepper (progress bar per Cognitive Activity), question/option cards spacing, tables (softer magenta header, row density), section cards, empty/loading states (skeletons instead of "Loading…"). Theme-level changes in `theme.ts` first so every page benefits. Before/after screenshots → user approval → done.

Built (before/after screenshots approved by the user):
- `theme.ts`: soft brand table headers (`#fbeef5` + magenta rule) instead of solid magenta, inherited fonts for plain inputs/textareas, rounder alerts (bordered) and chips, magenta focus ring and radio/checkbox accent, white outlined inputs, `LinearProgress` styling.
- `AppHeader`: icon nav links (icon-only on phones), email + Log out in an account menu (`UserMenu`), compact one-row header on phones. `LogoutButton` stays for `ChangePasswordPage`.
- `ChoiceCard` takes an `icon` (`lib/choiceIcons.tsx`, per domain / HVS).
- Answering: progress bar (answered or covered / required) in `QuestionnairePage`; `QuestionStepper` pills (coverage colours kept — a FORTH_REVIEW.md status signal); `QuestionCard`/`KeiCard` as cards with a numbered badge and weight tag (`components/questionCardStyles.ts`); the answer table scrolls sideways on phones.
- Results: one score card (score, bar out of 4, KEI score, Export to PDF) beside the spider chart; every section a `SectionCard` keyed per questionnaire code (the Core page shows two details). `E2EChecklistTable` header matches.
- `components/Loading.tsx` (`PageLoading`, `InlineLoading`) replaces "Loading…".
- Login: original line-art illustration `public/branding/login-illustration.svg` (cell tower, core, network mesh, L0–L5 scale), hidden on phones.

## Phase 6 — Security review ✅ fixes live in production (revision anlet-00027-hx8, 2026-11-16); dedicated runtime account (revision anlet-00028-5xf)

Review done (15 findings); the agreed set — 1–5, 7–11 and the upload ignore file from 15 — is built:

1. **Sign-in guessing**: `express-rate-limit` per client address on login / forgot-password / reset-password (per instance; `trust proxy` = `TRUST_PROXY_HOPS`, default 1), plus a per-account pause in the database — 10 wrong passwords in a row pause sign-in for 15 minutes (`User.failedLoginCount` / `lockedUntil`; a reset or temporary password lifts it). New passwords: at least 12 characters (existing shorter ones keep working).
2. **Temporary passwords**: `middleware/auth.ts` answers 403 `PASSWORD_CHANGE_REQUIRED` for everything except `/auth/me`, `/auth/context`, `/auth/change-password` while `mustChangePassword` is set.
3. **Sessions end on a password change**: `User.passwordChangedAt` compared with the token's `iat` (whole seconds) in `resolveRequestUser`; the caller's own cookie is re-issued on change-password.
4. **Deactivate / Reactivate**: `PUT /users/:id/active` (rules as temporary passwords; Project Admins for their own members), "User ▾" menu; a deactivated account cannot sign in, keeps no session, gets no emails and cannot redeem a link.
5. **Security headers**: `helmet` with a same-origin CSP (inline styles for MUI, `data:`/`blob:` images for charts and PDFs), no framing, HSTS. Checked in a browser against the production build (pages, Excel and PDF downloads).
7. **Dependencies**: express 4.22.3 (body-parser/qs), nodemailer 10, `xlsx` 0.20.3 from SheetJS's own site (the npm copy is unmaintained) — seed parsers read files through `prisma/seed/readWorkbook.ts`.
8. **Timing**: a dummy bcrypt check for unknown addresses at sign-in; a comparable wait in forgot-password for unknown addresses.
9. **Container** runs as `node`, not root (local prisma binary instead of `npx`) — started and migrated cleanly in production.
10. **`JWT_SECRET`** must be ≥ 32 characters and not a placeholder in production (the server refuses to start otherwise).
11. **Length limits**: comments 5000, names 100, passwords 200 (`backend/src/lib/limits.ts`, frontend copies in `shared/src/enums.ts`).
15. `.gcloudignore`.

Also fixed on the way: "Download all (Excel)" failed for the combined Core view (two sheets named alike — now prefixed per questionnaire, and `uniqueSheetName` as a safety net); every block of the Executive / Deep-Dive detail collapses from its heading.

Trade-off to know: the account pause lets someone who knows an address keep that person out for 15 minutes at a time; a password reset link lifts it.

6. **Dedicated service account** `anlet-run` (Cloud SQL client + its five secrets only); `roles/editor` removed from the default Compute SA, which now only builds (`roles/cloudbuild.builds.builder`) — see `gcp_deployment.md`.

Open: 12–14, the seed guard from 15, and the default Compute SA's leftover project-wide database / secret roles.

## Order

1 → 2 → 3 (email depends on normalized addresses) · 4 independent · 5 after 4 (touches the same review UI) · 6 last (also reviews the new email code). Each phase: tests, typecheck, lint, browser walkthrough, commit on a feature branch.
