# Admin management plan — super admin, internal/external admins, projects

Source request: `admin_management.md` (5 items), clarified in discussion.

## Decisions

| Topic | Decision |
|---|---|
| Super admin | An `isSuperAdmin` flag on an ADMIN account (implemented as a flag rather than a separate role value, so every existing Admin check keeps admitting the super admin): every Admin right plus admin management. `jaserbin.rahman@detecon.com` becomes super admin — the seed sets the flag on the bootstrap `ADMIN_EMAIL` account, so production's `ADMIN_EMAIL` must be that address. |
| Who grants Admin | **Super admin only** — creates internal/external admins, promotes/demotes admins, assigns external admins to projects. |
| Role changes | Admins (internal) can switch any non-admin user between Normal User and Executive. |
| Admin kinds | `INTERNAL` admin: all clients, as today. `EXTERNAL` admin (e.g. a contractor hired for one engagement): only their projects. |
| Project | **Detecon-internal access scope only**: `Project = { name, Organization (client), chosen HVSs }`. No client users are assigned to projects; client Executives/Normal Users are unaffected. Each existing organization gets a default project covering all HVSs. |
| External admin | Organization **and** at least one project in it are mandatory. May **view results** (benchmarking, deep-dive, answer distribution, comments, KEIs, Excel/PDF exports) for their projects' organization, limited to those projects' HVSs, and **open/close** those questionnaires for that organization. No user/NatCo/organization/reference-list management, no other clients. |
| Open/close | Stays per organization (an external admin closing IP for Client A closes it for all of Client A). |
| Executives | Unchanged — see their whole organization. |
| Bulk CSV | Existing upload kept; add a **Download template** (CSV header `email,role,organization,password` + example row). Bulk roles stay Normal User / Executive — admins are created individually by the super admin. |
| Forgot password | Already built (link on login → emailed 1-hour reset link). Production SMTP is still a placeholder — **decide provider later**; document the exact env vars/secret to set. |
| Contact message | Login page, login error and forgot-password page show "Having trouble logging in? Contact jaserbin.rahman@detecon.com" (one shared constant). |

Assumption to confirm: earlier we discussed projects limiting which HVSs *client users* can answer. Since projects
are Detecon-internal only, a project's HVS list limits only what its **external admins** can see — client users keep
answering whatever their organization has open. Say if users should be restricted too.

## Phase 1 — roles, super admin, role changes, template, contact message

**Status (2026-10-04): done and verified** — `User.isSuperAdmin` (migration `add_super_admin_flag`), role
changes in `users.service.ts` (Normal User ↔ Executive any admin; to/from Admin and any change to another admin
account super admin only; super admin account read-only; no self role change), Admin role in Create user for the
super admin, CSV template download, `SupportContact` on login/forgot/reset pages. 140 backend tests (incl. 6 new
role-rule integration tests) and 21 frontend tests pass; browser-checked as super admin and as a regular admin.

1. Schema: `Role.SUPER_ADMIN`; `User.adminType` (`INTERNAL` | `EXTERNAL`, null for non-admins). Seed: bootstrap admin → `SUPER_ADMIN`.
2. Backend: `requireRole('ADMIN')` also admits `SUPER_ADMIN`; `updateUser` allows role change Normal User ↔ Executive
   (any internal admin) and to/from Admin (super admin only); guards: can't change own role, can't remove the last
   super admin. Tests.
3. Frontend: role column/select in Manage Users; super-admin-only Admin options; CSV template download; contact message.

## Phase 2 — projects and external admins

1. Schema: `Project { name, organizationId }`, `ProjectQuestionnaire` (HVSs), `ProjectAdmin` (external admin ↔ project);
   migration creates a default project per organization with all HVSs.
2. Backend: one authorization helper deciding, per request, whether the caller may see organization X /
   questionnaire Y (Executive: own org; internal/super admin: all; external admin: their projects' org + HVSs), used by
   every insights/benchmarking/deep-dive/accepting-toggle route; management routes stay internal-admin only.
   Cross-org Admin views return only the external admin's organization. Integration tests per role.
3. Frontend: Projects section (internal/super admin: create project, pick org + HVSs, assign external admins);
   create-admin form (super admin: internal/external, project picker, org/project mandatory for external);
   Admin page for an external admin shows only their client, their HVSs and the open/close toggle.

## Phase 3 — production email (when credentials exist)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM` env vars and the `anlet-smtp-password` secret on Cloud Run;
send one test reset email.
