# Questionnaires per project + retire bulk CSV user creation

**Status: done** — merged to `main`, deployed to `anlet-504115` as revision `anlet-00007-s59` on 2026-10-13 (migration `20261013150000_add_project_questionnaires` applied; rollback target `anlet-00006-d8z`), live-tested with a "ZZ Claude Test" project that was deleted afterwards.

Source: `admin_management.md` line 22 (local notes), clarified in discussion on 2026-10-13. Builds on `PROJECTS_PLAN.md`.

## Decisions

| Topic | Decision |
|---|---|
| Bulk CSV | **Removed** ("Bulk-create users from CSV" on the Management Console and the Manage project page, plus `POST /users/bulk`) — the project Excel import replaces it. The single **Create user** form stays (adding one person later). |
| Selection unit | **Whole questionnaires**, chosen per project — all or a few. Scoring is unchanged. Core Network Fault Management + Core Network Stability are **one selectable item** ("Core Network Fault Management & Stability Assessment"), since the Core Domain score and combined views need both halves. |
| Effect | Members of a project's organizations (Normal Users, Executives, Project Admins) only see, answer and view dashboards for the project's questionnaires. Starting a response for any other questionnaire is refused by the server. Existing responses/results stay readable. Organizations without a project (e.g. the internal org) and the Application Admin context keep seeing everything; admin benchmarking is unchanged. |
| Where set | **Projects section** (checkbox list per project) **and** an optional **Questionnaires sheet** in the import template — empty or missing sheet = all questionnaires for a new project, and no change for an existing one. |
| Defaults | Migration gives every existing project all questionnaires; a project created in the UI starts with all. A questionnaire seeded later is not added to existing projects automatically (tick it in the UI). |
| Live testing | All testing on `anlet-504115` with clearly named test data ("ZZ Claude Test …"), **deleted afterwards**. |

## Design

- **Schema**: `ProjectQuestionnaire { projectId, questionnaireId }` (composite PK, cascade on project delete). Migration
  backfills every (project, questionnaire) pair.
- **Backend**: `questionnaire.service.ts`'s listings take the caller's organization: if it belongs to a project, filter
  to the project's questionnaires (`listQuestionnaires` → domain picker / settings, `listHvsEntries` → dashboards and
  results pickers). `getOrCreateResponse` refuses a questionnaire outside the project (`QuestionnaireNotInProjectError`
  → 403). Projects API: `ProjectDto.questionnaireCodes`, `PATCH /projects/:id { questionnaireCodes }` (a group code
  pair must be all-or-nothing), import accepts optional `questionnaires` (names or codes; HVS group names expand).
- **Frontend**: Projects table gets a Questionnaires cell (chips + "Edit" checkbox list per HVS item); template gets a
  `Questionnaires` sheet and the questionnaire names on `Lists`; `BulkCreateUsersForm` deleted.

## Steps

1. Schema + migration; backend filtering, response guard, projects API/import; remove `/users/bulk`. Integration tests.
2. Frontend: questionnaire selection UI + template sheet; remove bulk CSV UI; unit tests.
3. Local checks (typecheck, lint, all tests), update CLAUDE.md, merge to `main`, deploy to `anlet-504115`.
4. Live testing on `anlet-504115`: import a test project limited to two questionnaires; verify a member only sees and
   can only start those, the Executive/Project Admin dashboards list only those, the UI edit changes it, and the bulk CSV
   form is gone. Then delete all test data.
