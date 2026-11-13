# Project Admins choose the project's questionnaires; Project Admins collapsed on dashboard cards

**Status: done** — merged to `main`, deployed to `anlet-504115` as revision `anlet-00017-vs7` on 2026-11-13 after on-demand Cloud SQL backup `1794597210433` (rollback: revision `anlet-00016-wqs`; no migration). Live smoke test: pages 200, APIs 401 without a session, no pending migrations, no error logs. Verified by 4 new integration tests in `projectMemberImport.integration.test.ts` (backend 701, frontend 52 passing) and a local headless-Chrome walkthrough (Project Admin deselects IP FM and selects RAN QO (R), Save disabled with nothing selected, their answer picker follows; the Application Admin's card shows the change and lists Project Admins only after a click).

Source: `admin_management.md` lines 42 and 44 (2026-11-13), clarified in discussion.

## Decisions

| Topic | Decision |
|---|---|
| What | Project Admins select / deselect the project's **questionnaires** (not single questions) — the same per-HVS-item selection the Application Admin has ("Edit questionnaires"); Core FM + Stability stay one item; at least one must stay selected. |
| Which | All active questionnaires, **including in-review "(R)"** ones. |
| Deselecting answered ones | **Allowed** (as for Application Admins): no new responses can start; existing answers and results stay reachable; re-selecting brings it back. |
| Where | Manage project page, new "Questionnaires" section, for the project of the active context. Backend: `GET` / `PUT /project-members/questionnaires` (Project Admin only), reusing `updateProject`'s validation. |
| Dashboard | Project Admins on the Application Admin's project cards are collapsed behind a "Project Admins (n)" toggle; names show only when clicked. |

## Steps

1. Backend endpoints + integration tests (selection, group all-or-nothing, empty refused, scope, answers kept).
2. Frontend: `QuestionnaireSelection` extracted into a shared component; Project Admin section; dashboard toggle.
3. Lint/typecheck/tests, local browser walkthrough as Project Admin, review, CLAUDE.md, merge, push.
