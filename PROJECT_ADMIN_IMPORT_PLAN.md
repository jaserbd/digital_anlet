# Project Admin member import (Excel), with NatCo / Country / Working Domain / Designation

**Status: done locally** — merged to `main` and pushed; not yet deployed to `anlet-504115`. Verified by `projectMemberImport.integration.test.ts` (6), template tests (10 total) and a local headless-Chrome walkthrough as a Project Admin (template download → fill → upload across two organizations → imported users skip the profile step when NatCo/working domain/designation were given).

Source: `admin_management.md` line 32 (2026-11-13), clarified in discussion.

## Goal

The Application Admin only sets up the project (name, organizations) and assigns its Project Admin(s). The Project
Admin then creates the client accounts in one go from Excel — role, NatCo (+ country), working domain and
designation included — so members don't have to be completed by hand afterwards.

## Decisions

| Topic | Decision |
|---|---|
| Who | Project Admins get an Excel member import on **Manage project**. Application Admins keep the full project import (same new Members columns). |
| Scope | A Project Admin may add members to **every organization of the project** they administer (not only the active one). Roles: Executive / Normal User only (Project Admins stay Application-Admin-managed). |
| Members columns | Organization · Email · Role · First name · Last name · **NatCo** · **Country** · **Working domain** · **Designation**. The four new ones are optional; old files without them still import. |
| NatCo | Matched against the organization's NatCos ignoring case, spacing and punctuation. Unknown NatCo + Country → created (and added to the NatCo Name list); unknown NatCo without a valid Country → user still created, row gets a warning. |
| Working domain / Designation | Matched against the global lists ignoring case, spacing and punctuation ("Sr. Engineer" = "sr engineer" = "SR-Engineer"); the existing spelling is used. Values not in the list are **added** to it (deduplicated within the file too). |
| Existing members | Fill **empty** fields only — never overwrite NatCo / working domain / designation a user or admin already set. |
| Profile step | Skipped when everything it asks is already filled: the gate now requires working domain **and** designation (plus NatCo for Normal Users), so a partly-imported profile still asks for the rest. |
| Template | Project Admin template: Instructions, Members, Lists. Drop-downs for Organization (project's organizations), Role, NatCo (existing NatCos), Country; Working domain / Designation drop-downs accept other values (new entries). |

## Steps

1. Shared: `designationKey`-style normalization (`normalizeLabel`) in the backend; DTOs — member fields `natCo`, `country`, `workingDomain`, `designation`; result row `warning`; `ProjectMembersImportRequestDto`, `ProjectMemberImportContextDto`.
2. Backend: `projectMembers` module (`GET /project-members/context`, `POST /project-members/import`, Project Admin only), sharing one `importMembers` with `importProject`; profile fill-in (empty fields only); reference-list matching/adding.
3. Frontend: template + parser columns, Project Admin template variant, `ProjectImportForm` generalized into a members-import mode on `ManageProjectPage`; profile gate.
4. Tests: integration (PA import across orgs, NatCo auto-create, designation matching, fill-empty-only, scope refusals), parser tests; browser walkthrough as Project Admin.
5. Review, merge, backup, deploy to `anlet-504115`, smoke test.
