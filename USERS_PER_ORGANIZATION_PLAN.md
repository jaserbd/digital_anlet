# Users per organization, one organization per user

**Status: in progress**

Source: `admin_management.md` line 30 (2026-10-21), clarified in discussion.

## Findings (production, read-only check on 2026-10-21)

- 19 users; organizations Post Luxemburg (project C056875), Detecon, Anlet (Internal).
- Only one person is a member of two organizations: JustusMax.Redlin@detecon.com — Executive in Anlet (Internal)
  (5 responses, 2 submitted) and in Detecon (none), plus Project Admin of C056875.
- All 6 Project Admins of C056875 are Detecon Executives; two (incl. the super admin) still have Anlet (Internal) as
  home organization.
- Three test accounts (justus@ / jaser2@ / jaser3@test.com) belong to Detecon with no membership.

## Decisions

| Topic | Decision |
|---|---|
| Layout | **One collapsible table per organization** (name + user count), each sortable/filterable; an email search above filters all of them. Columns: Email · Admin · Project · Role · NatCo · Project Admin of · actions. |
| Rule | **Enforced**: a user belongs to exactly one organization (`User.organizationId`). All their Executive / Normal User memberships are in that organization (several projects of it are fine, e.g. yearly rounds). Adding someone to another organization is refused ("already belongs to …"); **Move to…** moves a person with a single membership to another organization (answers move with it). Project Admin memberships in client organizations don't count — consultants stay Detecon members. |
| Detecon consultants | One row per consultant under Detecon, with a **Project Admin of** column; client tables don't list them. |
| Justus | His Anlet (Internal) membership is removed **together with its answers** (test answers); he stays Detecon Executive + Project Admin. |
| Anlet (Internal) | Admins whose home is Anlet (Internal) move to Detecon; the organization is deleted. The seed uses Detecon for the super admin and no longer changes an existing super admin's organization. |
| Test accounts | justus@ / jaser2@ / jaser3@test.com are deleted on production (no memberships, no answers). |

## Steps

1. Backend: one-organization rule in `users.service.ts` (create, add, move) and the project import; migration
   (Justus / Anlet (Internal) clean-up + guard); seed; integration tests.
2. Frontend: per-organization tables, Project Admin of column, actions limited by the rule; tests.
3. Local checks + browser testing, review, CLAUDE.md, merge, Cloud SQL backup, deploy to `anlet-504115`, delete the
   three test accounts, verify production data read-only.
