# CarePal HR Admin — Project Overview

## What is it?
Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces Google Sheets for managing BD (Business Development Associate) hiring across hospitals in Indian cities.

## Two Business Units
- **CPM** — CarePal Money (Lending)
- **IGIV** — CarePal Money (Crowdfunding / Impact Guru)

## Current State (Apr 19, 2026)
- **Production deployed.** Live at **https://carepal-hr-admin-570605259097.asia-south1.run.app** (Cloud Run, asia-south1).
- **Stages 0–10 complete.** Full backend (requisitions, candidates, interviews + state machine, headcount, spreadsheet import, document uploads, dashboard aggregations), CI/CD on push to `main`, and OpenAPI docs at `/api/docs`.
- **Provisional production stack:** Cloud Run + Cloud SQL MySQL 8.4 + Cloud Secret Manager + Artifact Registry, all in `asia-south1`. Mock auth (`x-user-email` header) and local-disk document storage are in place pending swap to Google OAuth + AWS S3 once Sujeet provides the dedicated AWS account.
- **Next operational steps:**
  1. Rotate the initial `carepal_app` DB password (was visible during deploy debugging) — Cloud SQL → Users → change password → Secret Manager → new `DATABASE_URL` version → redeploy.
  2. Email Sujeet the detailed data requirements (exact columns + AWS account specs).
  3. Bootstrap a few production admin users via Cloud SQL Studio (see [DEPLOY_TO_CLOUD_RUN.md](./DEPLOY_TO_CLOUD_RUN.md#first-deploy-bootstrap-production-db-starts-empty)).

## Key People
| Name | Role |
|------|------|
| Sahil | Admin / Management |
| Akhlaque Khan | TA team lead (recruiters report to him) |
| **Sujeet Yadav** | **VP of Engineering at CarePal** — technical contact for infra + data integration |
| Soundappan Gopal | Regional Head (R2 interviewer) |
| Ankita Kumari | Regional Head (R2 interviewer) |
| Bhavesh N | Regional Head (R2 interviewer) |
| Himanshu Jaiswal | City Lead Bangalore (R1 interviewer) |
| Khazim Syed | City Lead Hyderabad (R1 interviewer) |

> Note: earlier docs and the `Ravi_Meeting_Questions*.docx` files reference "Ravi" as the engineering contact. That was superseded on Apr 15 — the actual technical contact is **Sujeet Yadav**.

## Production Access

| Resource | Where | Notes |
|---|---|---|
| Live app | https://carepal-hr-admin-570605259097.asia-south1.run.app | Cloud Run service `carepal-hr-admin`, region `asia-south1` |
| Health check | `/health` | Public, returns `{ok:true,...}` |
| API docs | `/api/docs` | Public, Swagger UI |
| Database | Cloud SQL `carepal-db` | MySQL 8.4, `db-f1-micro`, single zone, asia-south1, database name `carepal`, user `carepal_app` |
| DB password | Secret Manager `DATABASE_URL` | Pull the latest version with `gcloud secrets versions access latest --secret=DATABASE_URL` |
| Container images | Artifact Registry `asia-south1-docker.pkg.dev/carepal-hr-admin/carepal-hr-admin/` | Tagged with the commit SHA |
| Deploy pipeline | `.github/workflows/deploy.yml` | Triggers on push to `main` and on manual `workflow_dispatch` |
| GCP project | `carepal-hr-admin` (number `570605259097`) | Owned by `vandezand@bopinc.org` for now; transfer to CarePal once their AWS account is ready |
| Deploy SA | `github-deploy@carepal-hr-admin.iam.gserviceaccount.com` | Has Cloud Run Admin, Artifact Registry Writer, Cloud SQL Client, Service Account User, Secret Manager Secret Accessor |

For ad-hoc DB queries against prod: use [Cloud SQL Studio](https://console.cloud.google.com/sql/instances/carepal-db/studio?project=carepal-hr-admin), authenticate as `carepal_app`. For first-time bootstrap (the prod `users` table starts empty so the frontend errors), see the [DEPLOY_TO_CLOUD_RUN.md bootstrap section](./DEPLOY_TO_CLOUD_RUN.md#first-deploy-bootstrap-production-db-starts-empty).

## Tech Stack

### Frontend (repo root)
- React + Vite, Lucide icons, inline styles
- Plus Jakarta Sans, DM Mono (Google Fonts)
- `src/App.jsx` — main app, ~1050 lines, sidebar layout
- `src/DataContext.jsx` + `src/api.js` — backend API wiring

### Backend (`carepal-backend/`)
- Node + Express + TypeScript
- Knex migrations, better-sqlite3 (local), Zod validation
- ESLint + Prettier

## Repo Structure

```
CarePal_HR_Tool/
  README.md              # Intro, points at docs/
  docs/                  # Project documentation
    PROJECT_OVERVIEW.md  # This file
    BUILD_PLAN.md        # Staged build plan + status
    DATA_SOURCES.md      # Data inputs and integrations
  src/                   # Frontend (React + Vite) — the REAL app
    App.jsx
    DataContext.jsx
    api.js
    main.jsx
    AppCommand.jsx       # Rejected prototype
    AppDashboard.jsx     # Rejected prototype
    AppKanban.jsx        # Rejected prototype
    AppTimeline.jsx      # Rejected prototype
    AppSwitcher.jsx      # Legacy prototype switcher
  package.json           # Frontend (name: carepal-hr-admin)
  vite.config.js
  index.html
  carepal-backend/       # Backend (Stages 0–1 complete)
    src/
      index.ts
      config.ts
      db/index.ts
      models/requisition.ts
      schemas/requisition.ts
      routes/health.ts
      routes/requisitions.ts
    migrations/
    seeds/
    knexfile.js
    package.json
  carepal-demo/          # LEGACY Vite starter template — NOT the real app
  CarePal_Data_Overview_Ravi_Call.docx  # Brief for Ravi call
```

**IMPORTANT:** The real frontend is at the repo root (`/src/App.jsx`), NOT in `carepal-demo/`. The `carepal-demo/` directory is a leftover Vite template and can be ignored (or deleted).

## Running Locally

Two terminals:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd carepal-backend
npm install
npm run migrate      # create SQLite DB + tables
npm run seed         # insert example data
npm run dev          # start server with hot reload

# Terminal 2 — frontend (http://localhost:5173/CarePal_HR_Tool/)
npm install          # (at repo root)
npm run dev
```

To reset the local DB: `cd carepal-backend && npm run db:reset`

## Live URLs
- **Production:** https://carepal-hr-admin-570605259097.asia-south1.run.app (Cloud Run; full backend + frontend)
- **Frontend-only prototype (GitHub Pages):** https://vandezand-ctrl.github.io/CarePal_HR_Tool/ (kept around for legacy demo links; uses mock data — no real backend)

## Repo conventions

**Personal working files** (call transcripts, draft notes you're iterating on, scratch Flowy diagrams) belong in one of the following gitignored locations so they never end up in commits or pull requests:

- `/Transcipts/` — call/meeting transcripts (yes, the typo is intentional; matches the existing folder)
- `/flowy/` — scratch HTML diagrams produced by the Flowy plugin
- `/personal/` — anything else (drafts, notes-to-self, working docx files)
- `*.local.docx` — any docx file ending in `.local.docx`

These four patterns are listed in [.gitignore](../.gitignore). If you have a working `.docx` you don't want committed, save it as `something.local.docx` or move it under `/personal/`.

The committed `.docx` files at the repo root (`CarePal_Data_Overview_Ravi_Call.docx`, `Ravi_Meeting_Questions_Filled.docx`) are **project deliverables** and stay tracked — they're the briefs we sent to CarePal. Don't blanket-ignore `*.docx`.

## Further Documentation
- **Build status and stages:** [docs/BUILD_PLAN.md](./BUILD_PLAN.md)
- **Data inputs and integrations:** [docs/DATA_SOURCES.md](./DATA_SOURCES.md)
