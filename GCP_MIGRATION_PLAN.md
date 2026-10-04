# GCP migration plan — `anlet-504021` → `anlet-504115`

Source request: `admin_management.md` (last paragraph), clarified in discussion. Companion: `gcp_deployment.md`
(how the current project is set up).

## Decisions

| Topic | Decision |
|---|---|
| Data | **Start fresh** — new empty database, loaded only by the seed (7 questionnaires + KEIs, reference lists, internal org, super admin). Existing users/responses are not carried over. |
| Version | **Latest code**: Phase 1 committed, `feature/new_fm_domain` merged into `main`, `main` deployed. |
| Old project | **Stopped right after** the new one is verified: delete the old Cloud Run service (no data) and stop the old Cloud SQL instance (data kept, restartable). Nothing deleted permanently. |
| Hardening | Enable **daily Cloud SQL backups + point-in-time recovery**. Otherwise same shape as today. |
| Execution | Claude runs `gcloud` from your machine **step by step, asking before every step that creates, changes or stops anything**. Passwords you choose (super admin) you type yourself. |
| Region | **europe-west3 (Frankfurt)** — allowed by the company location policy (today: europe-west1). |
| URL | Changes to the new project's `*.run.app` URL (contains the new project number). `APP_BASE_URL` is updated after the first deploy. |

## What the read-only check of `anlet-504115` found (2026-10-04)

- Owner access for `jaserbin.rahman@detecon.com`; billing active; project sits in a company folder.
- Org policies: public access (`allUsers`) allowed; Cloud Run ingress allowed; Cloud SQL public IP allowed;
  **resource locations restricted to EU** — `europe-west1` (today's region) is allowed.
- Needed APIs not yet enabled (Cloud Run, Cloud SQL Admin, Artifact Registry, Cloud Build, Secret Manager).

## Steps (each confirmed before it runs)

**Status (2026-10-04): steps 1–10 done.** New app live at <https://anlet-602185048647.europe-west3.run.app>; super
admin login verified by Jaserbin. Deviations from the plan: secrets use user-managed replication in `europe-west3` and
Cloud Build runs regionally with a regional source bucket — both required by the EU location policy. The super admin
password was generated (not typed) and lives only in `anlet-admin-password`. Step 11 pending.

1. **Prepare code** — commit Phase 1, merge `feature/new_fm_domain` into `main`, run lint/typecheck/tests.
2. **Enable APIs** on `anlet-504115`: `run`, `sqladmin`, `artifactregistry`, `cloudbuild`, `secretmanager`.
3. **Cloud SQL** — instance `anlet-db` (Postgres 16, `db-f1-micro`, europe-west3, 10GB SSD) with **daily backups +
   PITR**; database `anlet`; app user with a generated password (never printed).
4. **Secrets** — `anlet-database-url` (Cloud SQL socket URL, generated), `anlet-jwt-secret` (generated),
   `anlet-admin-password` (**you type it**), `anlet-smtp-password` (placeholder until Phase 3 of the admin plan).
5. **Artifact Registry** repo `anlet` (europe-west3); grant the runtime service account Cloud SQL Client + Secret
   Manager Secret Accessor.
6. **Build** the image with Cloud Build into the new registry.
7. **Deploy** Cloud Run service `anlet` (same CPU/memory/scaling as today, public), `ADMIN_EMAIL=jaserbin.rahman@detecon.com`;
   then set `APP_BASE_URL` to the new URL. The container applies schema migrations on start.
8. **Seed** the new database from this machine through the Cloud SQL Auth Proxy (installed via `brew install cloud-sql-proxy`) (questionnaires need the xlsx files,
   which aren't in the image).
9. **Verify** — log in as super admin, check the domain picker, open a questionnaire, Admin pages; check logs.
10. **Switch over** — share the new URL; update `gcp_deployment.md` for the new project.
11. **Stop the old project** — delete old Cloud Run service; stop old Cloud SQL instance (data kept).

Estimated running cost in the new project ≈ today's (db-f1-micro + small backup storage; Cloud Run scales to zero).
