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

## Phase 2 — Mail infrastructure ✅ live in production (revision anlet-00019-2xz, 2026-11-16; sending still off)

- `lib/mailer.ts`: keep nodemailer SMTP; add `SMTP_SECURE`/STARTTLS handling, `MAIL_ENABLED` flag (false in dev/CI → log the link to console instead of sending), a shared branded HTML template (logo, magenta button, plain-text alternative), HTML-escaping of every interpolated value.
- `POST /api/admin/mail/test` (super admin only) + "Send test email" button in the Management Console → verifies the SMTP config from production without creating a user.
- `forgotPasswordHandler`: always 204 even if sending fails (log the error), so mail outages don't reveal registered emails.

## Phase 3 — Welcome / set-password emails

- `PasswordResetToken` gains `purpose` (`RESET` | `INVITE`); invite TTL 7 days, reset stays 1 hour. Issuing a new token of the same purpose invalidates older unused ones.
- `User.emailVerifiedAt DateTime?` — set when an invite or reset link is redeemed (or the user logs in and changes password). Shown as "Verified ✓ / Not yet" in the users table.
- Create user with "Send welcome email" on: account created with an unguessable random password, `mustChangePassword` false; invite email = app URL + "Set your password" link → existing `ResetPasswordPage` (wording varies by purpose: "Welcome — set your password"). Off: current behavior (generated/typed temp password shown once).
- Bulk (both imports): accounts are created as today; the frontend then calls `POST /users/welcome-emails { userIds }` in chunks of ≤10, showing "Sending 40 / 200…" with per-user result (sent / failed — reason). Server throttles to stay under 30/min. Failed rows can be retried or fall back to the temp password in the results download.
- Users table actions (same permission rules as temporary passwords, `assertProjectAdminMay*`): **Resend welcome email** (new invite token), **Send password reset email**.
- Production: `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, `SMTP_USER=SMTP_FROM=jaserbin.rahman@detecon.com`; the user adds the password as a new version of the `anlet-smtp-password` secret themselves (never pasted into chat). Update `gcp_deployment.md`.

## Phase 4 — Inline answering on the Review step

- Clicking a gap in `ReviewStep` expands that question **in place** (the same `QuestionCard` with answers + comment editor), not a stepper jump. Several can be open; each has a "Collapse" button.
- Expanded state is kept by question id in `ReviewStep`, independent of the gap list — so the card does not vanish mid-typing when the question becomes covered; it shows a green "Covered ✓" badge instead.
- The gap list, counts and the Submit button below update live (the same `answers`/`comments` state and mutations as the stepper — `QuestionnairePage` passes `handleSelect`/`handleCommentChange` down; no second save path, preserving the `QuestionCommentEditor` single-save fix).
- Same for KEIs: uncovered KEIs expand their `KeiCard` inline.
- "Go to question" stays available as a secondary link for anyone who prefers the full step.

## Phase 5 — Visual polish (keep brand)

Screenshot every main page first, then: login page (hero panel, clearer card), `AppHeader` (compact nav with icons, user menu holding email/context/logout), Home/Domain/HVS picker cards (icons per domain, hover elevation), question stepper (progress bar per Cognitive Activity), question/option cards spacing, tables (softer magenta header, row density), section cards, empty/loading states (skeletons instead of "Loading…"). Theme-level changes in `theme.ts` first so every page benefits. Before/after screenshots → user approval → done.

## Phase 6 — Security review

1. Write `SECURITY_REVIEW.md`: authN/session (JWT lifetime, logout doesn't revoke tokens, password policy), authZ per route (role/org/project scoping, IDOR on `:id` routes, anonymization leaks for Executives), input validation, CSRF (SameSite=Lax + JSON), headers/CSP, rate limiting, file uploads (SheetJS client-side, 2 MB JSON import), email content injection, secrets/IAM (`gcp_deployment.md`: default SA has project `roles/editor`), dependencies (`npm audit`), logging of PII.
2. Fix agreed items — expected: `helmet` + CSP, `express-rate-limit` on login/forgot/reset/test-mail, password-change invalidating old tokens (`passwordChangedAt` vs JWT `iat`), dependency upgrades (zod, nodemailer, exceljs/uuid; SheetJS → official CDN build 0.20.x, which fixes both advisories), dedicated Cloud Run service account.

## Order

1 → 2 → 3 (email depends on normalized addresses) · 4 independent · 5 after 4 (touches the same review UI) · 6 last (also reviews the new email code). Each phase: tests, typecheck, lint, browser walkthrough, commit on a feature branch.
