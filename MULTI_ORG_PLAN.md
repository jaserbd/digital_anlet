# Multi-organization memberships + admin temporary passwords

Source: `admin_management.md` lines 10 and 12 (local notes), clarified in discussion on 2026-10-05.

## Decisions

| Topic | Decision |
|---|---|
| Model | **Admin stays a global, Detecon-only role** (super admin as today). On top, a user can hold any number of **memberships** = *organization + role* (`EXECUTIVE` or `NORMAL_USER`), **one role per organization**. Example: `jaserbin.rahman@detecon.com` = Admin + Executive of Client A + Normal User of Client B. |
| Working context | After login the user **picks an active context** — "Admin (all clients)" or one membership ("Client A — Executive"); a switcher in the header changes it any time. Every screen behaves exactly as today for the active organization + role. Only one context → chosen automatically. |
| Answers | **Separate per organization**: a response belongs to a membership, so the same person answers IP FM once for Client A and once for Client B; each counts only toward that organization. |
| Profile | **Per membership**: NatCo, Working Domain and Designation are completed once per organization the user answers for. |
| Who manages memberships | **Any admin** adds/removes Executive/Normal User memberships; granting Admin stays super-admin-only. |
| Bulk CSV | A row whose email already exists **adds a membership** (password unchanged); same organization again → reported "already a member". New emails create the account as today. |
| Temporary password | **Any admin** can generate one for a non-admin user (only the super admin for another admin). Shown once to copy and forward; the user must change it at next login (existing `mustChangePassword` flow). |
| Deploy | After tests + browser check pass, deploy to `anlet-504115` step by step with approval. |

Defaults (say if wrong): Executive in an organization can still "Answer as user" there, so a separate Normal User membership in the same organization isn't needed; removing a membership that has responses is blocked (like deleting a user with responses).

## Design

- **Schema**: new `Membership { userId, organizationId, role, opCoId?, workingDomain?, designation? }`, unique per
  (user, organization). `QuestionnaireResponse.membershipId` (unique per membership + questionnaire) replaces
  "one response per user per questionnaire". Migration converts each existing non-admin user into one membership and
  links their responses to it; `User.role` keeps only the global meaning (Admin or not).
- **Active context in the login token**: the JWT carries the chosen membership (or Admin), so existing handlers that
  read "the caller's organization/role" keep working unchanged; `POST /auth/context` switches it (re-validated against
  the database).
- **Analytics**: respondent counts, benchmarking, drill-downs and comments group by the response's membership
  (organization / NatCo / profile) instead of the user's single fields.
- **Admin UI**: Existing users shows each user's memberships (add / change role / remove), plus "Generate temporary
  password". Create user gains "add to existing user" behaviour.

## Steps

1. Schema + migration (with a data-migration test on a copy of the current shape).
2. Backend: memberships service + routes, context switching, responses per membership, analytics regrouping,
   bulk-CSV membership rows, temporary password endpoint. Integration tests per rule.
3. Frontend: context picker after login + header switcher, per-membership profile, membership management in Existing
   users, temporary password dialog, bulk CSV result "membership added".
4. Full test suite + browser walkthrough (multi-org user, switching, separate answers, Executive views, admin resets).
5. Commit, merge to `main`; you push.
6. Deploy to `anlet-504115` (build → deploy; migration runs on start) with your OK at each step.
