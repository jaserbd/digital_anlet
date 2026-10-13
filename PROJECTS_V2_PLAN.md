# Projects v2 — organizations in many projects, project-level Project Admins, answers per project

**Status: planned** — branch `feature/projects-many-to-many`.

Source: user feedback on 2026-10-13 (Detecon in every project; Mike is Project Admin of Project A but not B; add/remove
Project Admins without Excel; a Project column in the users table; an organization in several projects), clarified in
discussion.

## Decisions

| Topic | Decision |
|---|---|
| Organizations ↔ projects | **Many-to-many**: an organization can be in several projects (e.g. "Vodafone 2026" and "Vodafone 2027"). |
| Detecon | Not added to projects any more. Its people stay members of the Detecon organization and are picked as Project Admins per project. |
| Membership | **Per project + organization** (`Membership.projectId`): own role, NatCo profile and answers per project. Organizations without a project (Anlet (Internal), Detecon) keep project-less memberships. The Working-as switcher shows e.g. "C056875 · Post Luxemburg — Executive". |
| Answers | **Separate per project** (they belong to the membership). Executive / Project Admin dashboards show the active project only. |
| Project Admins | Chosen per project from a **drop-down of Application Admins + members of the organization named "Detecon"**; add and remove on the Projects list. A Project Admin gets the Project Admin role in each of the project's organizations (and automatically in organizations added later). Removing one takes effect immediately. |
| Users table | New **Project** column (one row per user + project + organization, filterable), so you can see who takes part in which and how many projects. "Add to project…" / "Move to…" choose a project + organization. |
| Open/close | **Per project + organization** (closing RAN for "Vodafone 2026" doesn't affect "Vodafone 2027"). Project-less organizations keep today's per-organization setting. |
| Benchmarking / Deep-Dive | Rows become **Project · Organization · NatCo**; the Deep-Dive gets a project selector. |
| Questionnaires per project | Unchanged (already per project); a member's available questionnaires come from their membership's project. |

## Migration of existing data (production today)

- Every organization's current project becomes a project link; every membership in an organization that is in a
  project gets that `projectId`; QuestionnaireOrgSetting rows are copied per project.
- **Detecon**: removed from its project(s). For each Project Admin membership in Detecon within project P, the person
  becomes Project Admin of P (Project Admin role in each other organization of P — for C056875: Post Luxemburg) and
  keeps a project-less Detecon membership (role Executive) that holds any existing test answers.
  On production this turns the 6 consultants into Project Admins of C056875 / Post Luxemburg.
- A Cloud SQL backup is taken right before the deploy.

## Steps

1. Schema + data migration (tested on a copy of production-shaped data locally).
2. Backend: context = membership (project + organization); membership/user/project services; Project Admin
   add/remove; project-scoped questionnaires, accepting toggle, insights, benchmarking; integration tests.
3. Frontend: Projects list (organizations from any project, Project Admin drop-down), users table Project column +
   add/move with project, context labels, open/close and Deep-Dive project selectors, benchmark Project column.
4. Local checks, docs, merge, backup, deploy to `anlet-504115`, live testing with "ZZ Claude Test" data (deleted
   afterwards) — including an organization in two projects with separate answers, and adding/removing a Project Admin.
