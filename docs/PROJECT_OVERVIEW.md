# CarePal HR Admin — Project Overview

## What is it?
Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces Google Sheets for managing BD (Business Development Associate) hiring across hospitals in Indian cities.

## Two Business Units
- **CPM** — CarePal Money (Lending)
- **IGIV** — CarePal Money (Crowdfunding / Impact Guru)

## Current State (May 2026)
- **Production deployed.** Live at **https://carepal-hr-admin-570605259097.asia-south1.run.app** (Cloud Run, asia-south1).
- **Stages 0–10 complete + Apr 29 backlog (PRs A–I) shipped.** Full backend (requisitions, candidates, interviews + state machine, headcount, spreadsheet import, document uploads, dashboard aggregations), CI/CD on push to `main`, and OpenAPI docs at `/api/docs`.
- **Production stack:** Cloud Run + Cloud SQL MySQL 8.4 + Cloud Secret Manager + Artifact Registry + AWS S3 (document storage, wired Apr 30), all in `asia-south1`. Auth is Google OAuth (Workspace allowlist + admin gmail).
- **Next operational steps:**
  1. Rotate the initial `carepal_app` DB password (was visible during deploy debugging) — Cloud SQL → Users → change password → Secret Manager → new `DATABASE_URL` version → redeploy.

## Key People
| Name | Role |
|------|------|
| Sahil Lakshmanan | Admin / Management |
| Akhlaque Khan | TA team lead (admin role — sees everything across recruiters) |
| **Sujeet Yadav** | **VP of Engineering at CarePal** — technical contact for infra + data integration |
| Javeed Pasha | City Lead (R1 interviewer) |
| Toheed Shaikh | City Lead (R1 interviewer) |
| Hemanth Ranganath | City Lead (R1 interviewer) |
| Sachin Savalkar | City Lead (R1 interviewer) |
| Kiran | City Lead (R1 interviewer) |
| Saurav Kumar | City Lead (R1 interviewer) |
| Aman Kumar | City Lead (R1 interviewer) |
| Mohammed Rafi | City Lead (R1 interviewer) |
| Lazar Desmond | Regional Head (R2 interviewer) |
| Harish Goud | Regional Head (R2 interviewer) |
| Ashutosh Sharma | Regional Head (R2 interviewer) |
| Soundappan Gopal | Regional Head (R2 interviewer) |
| Abhishek Sah | Regional Head (R2 interviewer) |

> Roster updated PR-I (May 2026) to match the IG Master Employee sheet — earlier names (Himanshu Jaiswal, Khazim Syed, Ankita Kumari, Bhavesh N) are no longer in the active interviewer roster. Canonical list: [carepal-backend/src/routes/interviewers.ts](../carepal-backend/src/routes/interviewers.ts).
> Earlier docs and the `Ravi_Meeting_Questions*.docx` files reference "Ravi" as the engineering contact. That was superseded on Apr 15 — the actual technical contact is **Sujeet Yadav**.

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
| GCP project | `carepal-hr-admin` (number `570605259097`) | Owned by Jesse's personal Google account (`jessevandezand@gmail.com`) — not a Workspace org. Transfer to CarePal's Google Workspace once their AWS account is ready. The GitHub repo lives on `vandezand@bopinc.org`; the two are independent. |
| Deploy SA | `github-deploy@carepal-hr-admin.iam.gserviceaccount.com` | Has Cloud Run Admin, Artifact Registry Writer, Cloud SQL Client, Service Account User, Secret Manager Secret Accessor |

For ad-hoc DB queries against prod: use [Cloud SQL Studio](https://console.cloud.google.com/sql/instances/carepal-db/studio?project=carepal-hr-admin), authenticate as `carepal_app`. For first-time bootstrap (the prod `users` table starts empty so the frontend errors), see the [DEPLOY_TO_CLOUD_RUN.md bootstrap section](./DEPLOY_TO_CLOUD_RUN.md#first-deploy-bootstrap-production-db-starts-empty).

## Tech Stack

### Frontend (repo root)
- React + Vite, Lucide icons, inline styles
- Plus Jakarta Sans, DM Mono (Google Fonts)
- `src/App.jsx` — main app, ~2400 lines, sidebar layout
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
