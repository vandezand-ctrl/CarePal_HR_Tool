# CarePal HR Admin — Project Overview

## What is it?
Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces Google Sheets for managing BD (Business Development Associate) hiring across hospitals in Indian cities.

## Two Business Units
- **CPM** — CarePal Money (Lending)
- **IGIV** — CarePal Money (Crowdfunding / Impact Guru)

## Current State (Apr 15, 2026)
- **Frontend prototype complete** — React + Vite, deployed to GitHub Pages
- **Client-approved UI** — Sidebar layout chosen Apr 9
- **Backend in progress** — Stages 0–2 complete (scaffold + requisitions end-to-end + mock auth/RBAC); Stage 3 (candidates) underway
- **Production infra decided (Apr 15 call with Sujeet):** dedicated AWS account for this tool — RDS SQL + S3 — with the app running on Google Cloud. Cross-cloud setup.
- **Next operational step** — Jesse to email Sujeet the detailed data requirements (exact columns + resources). Unblocks AWS credentials delivery and BD list export.

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

## Live Demo (frontend prototype only)
https://vandezand-ctrl.github.io/CarePal_HR_Tool/

## Further Documentation
- **Build status and stages:** [docs/BUILD_PLAN.md](./BUILD_PLAN.md)
- **Data inputs and integrations:** [docs/DATA_SOURCES.md](./DATA_SOURCES.md)
