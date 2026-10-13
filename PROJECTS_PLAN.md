# Projects + Project Admins + Excel project import

**Status: steps 1–4 done** (backend 284 + frontend 33 tests, browser walkthrough). Remaining: merge, deploy.

Source: `admin_management.md` line 20 (local notes), clarified in discussion on 2026-10-13. Revives, in a different
shape, the cancelled "Projects / external admins" phase of `ADMIN_MANAGEMENT_PLAN.md`.

## Decisions

| Topic | Decision |
|---|---|
| Project | A named client engagement grouping organizations. **Normally one organization per project** (the org can have several NatCos, or none); the model allows more. An organization belongs to at most one project. |
| Roles | **Super admin** (unchanged) > **Application Admin** (today's Admin: all projects) > **Project Admin** (Detecon consultant, rights only in their project) > **Executive** / **Normal User** (client members, unchanged). |
| Project Admin rights | Executive dashboard for their project's organizations **with full identities** (like an Application Admin, not anonymized); answer questionnaires; manage members (add/remove/change Executive ↔ Normal User, temporary passwords); manage NatCos; open/close questionnaires. Nothing outside their project; cannot create projects or grant Project Admin / Admin. |
| Project Admin answers | **Test only**: stored, scored and shown on their own results page, but **excluded** from every org average, respondent list, benchmark, drill-down and comment collection. |
| Reset button | New "Reset my answers" on the questionnaire/results page, for **Project Admins and Application Admins only** (on their own response in the active organization), while the questionnaire is accepting responses. Deletes the response; next visit starts fresh. |
| Excel import | Application Admin downloads a template, fills **Project, Organization, NatCos and members (email + role)**, uploads it. No password column: new accounts get a **generated temporary password**; a results Excel (email, role, status, temp password) downloads after import. Existing emails just get the new membership. |
| Existing data | Migration creates **one project per existing client organization** (named after it; the internal "Anlet (Internal)" org is skipped). No Project Admins yet. |

## Design

- **Schema**: `Project { id, name @unique }`; `Organization.projectId String?`. `Role` gains `PROJECT_ADMIN`, used only on
  `Membership` (Admin stays global on `User.role`). A Project Admin of project P = a `PROJECT_ADMIN` membership in each
  of P's organizations — so the existing working-context switcher, per-membership responses and own-org checks apply
  unchanged ("Client A — Project Admin" in the switcher).
- **Authorization**: a small helper `canManageOrganization(user, orgId)` = Application Admin, or active context is
  `PROJECT_ADMIN` of that org. Used by: users (list/create/memberships/temp password — target must be a non-admin whose
  memberships all lie in orgs the caller project-admins, and roles limited to Executive/Normal User), OpCos +
  per-org NatCo-name catalog, accepting-responses toggle. Insights org-scoped routes admit `PROJECT_ADMIN` with the
  own-org check; `anonymize` stays `role === 'EXECUTIVE'`.
- **Exclusion**: insights already counts only `RESPONDENT_ROLES` (`NORMAL_USER`, `EXECUTIVE`) for membership lists;
  every response/answer/comment/KEI query there gets the same membership-role filter.
- **Projects module**: `GET/POST /projects`, `PATCH /projects/:id` (rename, assign/unassign orgs),
  `DELETE /projects/:id` (only when empty), `POST /projects/import` (parsed rows; per-row results). Application Admin
  only. Import is idempotent-ish: existing project/org/NatCo/membership are reused and reported, never duplicated.
- **Excel template** (built client-side with `xlsx`, which the frontend already uses): sheets `Instructions`,
  `Project` (Project name, Organization), `NatCos` (Organization, NatCo, Country — Country from the Country list),
  `Members` (Organization, Email, Role = Project Admin / Executive / Normal User, First name, Last name). The browser
  parses it and posts JSON to `/projects/import`; the server validates everything again.
- **Frontend**: Admin page gets a **Projects** section (list with orgs + Project Admins, create, assign org, download
  template, import, download results). Project Admin lands on the Executive dashboard (full identities) and gets a
  **Manage project** page (members, NatCos, open/close) reusing `ManageUsersSection`/NatCo/settings components with an
  organization scope. Domain picker/answering open to `PROJECT_ADMIN` with a "test answers — not counted" notice and
  the Reset button. Profile completion is not required for Project Admins.

## Steps

1. Schema + migration (enum value, `Project`, `Organization.projectId`, backfill one project per client org).
2. Backend: projects module + import; `PROJECT_ADMIN` authorization across users/opcos/referenceLists/questionnaire
   accepting/insights; exclusion of Project Admin responses; reset-response endpoint. Integration tests per rule.
3. Frontend: Projects section + template/import/results; Project Admin landing, Manage project page, answering
   notice + Reset button; role labels/switcher.
4. Local verification: typecheck, lint, all tests, browser walkthrough (Application Admin imports a project; Project
   Admin manages members/NatCos, toggles acceptance, answers + resets, sees identities; Executive still anonymized;
   averages exclude the Project Admin).
5. Update CLAUDE.md, merge to `main`, deploy to `anlet-504115` (Cloud Build → Cloud Run; migration runs on start),
   verify the live app.
