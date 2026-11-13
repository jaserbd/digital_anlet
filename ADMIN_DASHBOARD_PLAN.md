# Project dashboard, collapsible sections, generated passwords + Project Admin on creation

**Status: done** — merged to `main`, deployed to `anlet-504115` as revision `anlet-00016-wqs` on 2026-11-13 after on-demand Cloud SQL backup `1794594291053` (rollback: revision `anlet-00015-vx8`; no migration). Live smoke test: pages 200, APIs 401 without a session, no pending migrations, no error logs. Verified by tests (backend 697, frontend 52 incl. `questionnaireInitials.test.ts` and new dashboard-count assertions in `projects.integration.test.ts`) and a local headless-Chrome walkthrough as Application Admin (both dashboard views, collapse + view remembered across reload, Generate password, new Detecon user made Project Admin of two projects).

Source: `admin_management.md` lines 34–37 (2026-11-13), clarified in discussion.

## Decisions

| Item | Decision |
|---|---|
| Line 34 — Application Admin import "same process + project/organization creation" | **No change**: the full project import already creates project, organizations, NatCos and members with the same Members columns as the Project Admin import. |
| Line 35 — Create user | **Generate** button fills a random password (shown in clear, with Copy). When the user is placed in Detecon (or is an Application Admin), an optional **Project Admin of** multi-select adds them as Project Admin of the picked projects right after creation (existing `POST /projects/:id/project-admins`). Application Admins only — the Project Admin's form is unchanged apart from the Generate button. |
| Line 36 — Collapsible | Every titled `SectionCard` gets a collapse arrow (whole app). Sub-blocks of crowded sections (Admin Benchmarking table, comment collections) become collapsible blocks too. **Open by default**; what someone collapses is remembered per page + section in browser storage (`localStorage`, guarded). Collapsed content stays mounted (filters/state kept). |
| Line 37 — Project dashboard | New section at the top of the Admin page, **not a table**, with a view toggle: **Cards** (one card per project: project number, organization(s), questionnaire badges, Project Admins, members, submitted/in-progress responses) and **By organization** (organization headings, their projects as compact tiles). Badges = **Domain + HVS** initials (RAN-FM, Core-FM, Core-ST, IP-FM, TR-MW-FM, TR-OTN-FM, FA-FM, …; "(R)" for in-review), full name as tooltip. `ProjectDto` gains `submittedResponses` / `inProgressResponses` (Executive + Normal User memberships only). |

## Steps

1. Backend: response counts on `ProjectDto`; test.
2. Frontend: `SectionCard` collapse + `CollapsibleBlock`; Benchmarking sub-blocks.
3. Frontend: `questionnaireInitials.ts` (+ tests), `ProjectDashboardSection` with the two views.
4. Frontend: Create user — Generate/Copy, Project Admin of.
5. Lint/typecheck/tests, local browser walkthrough, review, CLAUDE.md, merge, push.
