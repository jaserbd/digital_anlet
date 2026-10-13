# Existing users table, moving memberships, import results, template drop-downs

**Status: steps 1–2 done** (backend 287 + frontend 35 tests) — branch `feature/users-table-cleanup`. Remaining: deploy, live testing.

Source: user feedback on 2026-10-13 after the projects release, clarified in discussion.

## Findings

- "Anlet (Internal)" could not be removed for some users because those memberships hold questionnaire answers (3 users
  with 1–2 responses on production): removing a membership with answers is blocked, and there was no way to move a
  membership to another organization — only to change its role.

## Decisions

| Topic | Decision |
|---|---|
| Existing users table | **One row per user + organization**: Email · Admin · Organization · Role · NatCo · actions, sortable and filterable per column. A person in two organizations has two rows; a user without any organization has one row with "—". |
| Moving a membership | New **Move to…** action: changes a membership's organization (e.g. Anlet (Internal) → Detecon). Its answers move with it and then count for the new organization; the NatCo is cleared (it belonged to the old organization), so a Normal User completes the profile again. Not allowed into an organization the user already belongs to. Application Admins only (Project Admins can't move people out of their organization). |
| Import results | **Two tables**: "Project setup" (organizations, questionnaires, NatCos) and "Users" (email, organization, role, status, temporary password); the results Excel gets the same two sheets. |
| Template drop-downs | Real Excel drop-down lists for **Role**, **Organization** (from the Project sheet), **Questionnaire** and **Country**. Built with `exceljs` (SheetJS community edition can't write data validation), loaded only when the template is downloaded. Parsing stays on SheetJS; the server keeps validating everything. |

## Steps

1. Backend: `PATCH /users/:id/memberships/:membershipId` accepts `organizationId` (move), with integration tests.
2. Frontend: flat users table with per-row actions (role, move, remove) and per-user actions (temporary password, add
   organization, admin, delete); split import results; `exceljs` template with drop-downs; tests.
3. Local checks, update CLAUDE.md, merge to `main`, deploy to `anlet-504115`.
4. Live testing on `anlet-504115` with "ZZ Claude Test" data (deleted afterwards): table layout and filters, moving a
   test membership with an answer, two result tables, drop-downs in the downloaded template.
