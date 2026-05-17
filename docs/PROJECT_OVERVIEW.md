# CarePal HR Admin — Project Overview

## What is it?
Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces Google Sheets for managing BD (Business Development Associate) hiring across hospitals in Indian cities.

## Two Business Units
- **CPM** — CarePal Money (Lending)
- **IGIV** — CarePal Money (Crowdfunding / Impact Guru)

## Current State (May 2026)
- **Production deployed.** Live at **https://carepal-hr-admin-570605259097.asia-south1.run.app** (Cloud Run, asia-south1).
- **Stages 0–10 + backlog PRs A–Q + post-launch hardening shipped.** Full backend (requisitions, candidates, interviews + state machine, headcount, spreadsheet import, document uploads, dashboard aggregations, **multi-TA assignment**, **AOP-edit UX**, **admin change notifications**, **per-user city-access scoping**, **BU-based auto-routing of req approval**, **rejection emails**, **interview invite emails with ICS**, **interviewer-city enforcement**), CI/CD on push to `main`, and OpenAPI docs at `/api/docs`. As of May 17 2026 the entire Apr 29 beta-feedback backlog, all 36 findings from the May code review, and the first batch of May 15 feedback features (F1/F4/F5) are closed.
- **Recent additions (May 2026):**
  - **PR-J / PR-J.5** — TA recruiter view: filter-by-owner dropdown on Candidates, TA reassignment modal (admin can reassign without confirmation, TAs needed a confirm step at the time — superseded by PR-L), Add Candidate form's "Assigned to (TA)" is now a dropdown.
  - **PR-K** — ~~Inbox / Applications Queue~~ **REMOVED (May 17 2026).** The inbox/auto-upload feature was removed — candidates are always entered manually. The `applications` table, Gmail watcher, Inbox sidebar section, and all related code have been deleted. Migration `20260517_026_drop_applications.js` drops the table and `last_inbox_seen_at` column.
  - **PR-L** — Multi-TA assignment. The `candidates.ta` string column is gone, replaced by a `candidate_assignments` join table (FK candidate_id + user_id). A candidate now has an `assignedTas: User[]` array on the API and must always have ≥1 assignment. Permission rules relaxed from PR-J.5: any TA or admin can add/remove anyone (TA or admin) freely; approvers stay 403. The candidate detail panel now shows a checkbox group instead of a single-select; the Add Candidate / Accept Application form does the same. Filter-by-owner dropdown now includes admins (so Akhlaque appears) and the kanban/table show comma-separated names with `+N more` truncation. The PR-J.5 confirmation modal was removed (multi-assign makes "you can't take this candidate back" meaningless).
  - **PR-N** — AOP target editing UX on the Dashboard. Two coupled fixes for the cold-start admin flow Jesse hit during prod bootstrap: (1) an empty-state amber banner that surfaces when no AOP targets are set in All-BUs view and disappears the moment any target is saved; (2) the `bu !== 'all'` gate is gone — admins can now edit from the default landing view via a two-input editor (CPM + IGIV) that opens on pencil click, while single-BU views keep the fast inline form. Pencil restyled (11px → 13px, lighter→darker grey) so it reads as an action. Backend exposes `aopByBu` per city + a `showEmptyTargetsBanner` boolean — single source of truth, no client-side overlay.
  - **PR-P** — Per-user city-access scoping. `user_cities` many-to-many join table lets admins assign a set of cities to each non-admin user via a slide-out edit panel in User Management. Non-admin users only see requisitions, candidates, headcount, and dashboard data for their assigned cities; admins always see everything. Default for new users: sees nothing until an admin grants access. Existing users backfilled with all cities on migration so nothing breaks. New endpoints: `GET /api/cities` (distinct city list for the checkbox UI), `PUT /api/users/:id/cities` (admin-only). Frontend User Management rewritten with City Access column (teal chips), slide-out edit panel with role dropdown + city checkbox list + Select all/Deselect all.
  - **PR-O** — Admin "changes since you last viewed" toast on the Dashboard. When another admin edits an AOP target, a passive blue toast surfaces the change list (city, BU, new value, actor name + timestamp) for the viewer next time they open the Dashboard. "Got it" bumps `users.last_aop_seen_at` and the toast disappears via the dash refetch. Self-edits filtered out by `updated_by_user_id != viewer.id`. Pre-PR-O rows have `updated_by_user_id = NULL` and are intentionally invisible to the toast — no spurious notifications on first deploy. Out of scope: email/Slack (revisit if the in-tool toast is missed); before/after values (sticks to "current value + actor + when" — upgrade to a real `activity_log` table the day someone asks).
  - **PR-Q** — Single-step BU-based auto-routing for requisition approval.
  - **May 15 feedback — F1 (rejection email)** — When a candidate with an email address is rejected at interview, a modal shows a pre-filled rejection email template that the TA can edit and send. Backend: `POST /api/candidates/:id/rejection-email` fires via the Gmail API service account (`GMAIL_SEND_AS` env var controls sender). Frontend: "Reject & Notify" button on interview result triggers the modal.
  - **May 15 feedback — F5 (interview invite emails)** — Scheduling an interview now sends fire-and-forget ICS calendar invitations (via `ical-generator` + Gmail API) to both the candidate and the interviewer, if emails are available and email is configured. Non-blocking: scheduling succeeds even if emails fail.
  - **May 15 feedback — F4 (city enforcement)** — Interviewers are only shown in the Schedule Interview dropdown if their assigned city matches the candidate's city. Backend also rejects mismatched city on `POST /api/interviews`. Null city = no filtering (backwards-compatible).
  - **Security hardening (PR #49, May 2026)** — Helmet HTTP security headers, explicit CORS origin allowlist (`ALLOWED_ORIGINS` env var), rate limiting on `/api` (300 req / 15 min, production only), server-side MIME type + extension validation on document uploads, Swagger UI gated behind authentication, `AUTH_MODE=mock` blocked at boot in production.
  - **Code-review hardening batch (PRs #50–#55, May 2026)** — Closed all 36 findings from a structured code review. Highlights: transactional DB ops + fix for the ID-generation race; reject-state guards on R2 scheduling and offers; RBAC tightening across pipeline transitions, interview recording, document mgmt, and import; route-param validation; missing error handlers + process-level crash guards; `useEffect` cleanup in `CandidateModal`; city-scope guards on single-item GETs (lists were already scoped); silent-failure logging in document deletion, CV-copy on inbox accept (`cvCopyFailed` flag surfaced to UI), and `touchLastLogin`; Gmail watcher resilience (`setTimeout`-chain backoff + dedup via `gmail_message_id`); `CancelInterviewModal` replacing `window.confirm`/`window.prompt`; keyboard focus trap on every modal via `react-focus-lock`; terminology cleanup (sidebar route key renamed `pipeline` → `candidates`, `Target Headcount` subtitle reworded so it no longer conflates AOP with requisition approval).
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

## Known data quirks (prod vs. local seeds)

These are non-blocking but worth knowing if you're debugging prod data or tracing a user that doesn't appear locally:

- **Akhlaque's email**: prod has him as `akhlaque.khan@impactguru.com` / name `"Akhlaque Khan"` / role `admin`. The local seed at `carepal-backend/seeds/02_users.js` uses `akhlaque@carepalmoney.com` / `"Akhlaque"` (a placeholder from PR-J — his actual prod record came from a Google OAuth first-sign-in). Doesn't break anything (different DBs) but if you script anything against prod, query by partial name or check the `impactguru.com` domain.
- **Pre-PR-L `ta` strings**: before PR-L (May 2026) the candidates table had a free-text `ta` string column. One prod row (`C-002` Ravikumar) had `ta='akhlaque'` (lowercase). Cleaned up to `'Akhlaque Khan'` before PR-L's backfill migration ran. The migration itself is case-insensitive, but the audit query in the migration header is what catches orphans pre-deploy.
- **Test users in prod**: `ta@impactguru.com` (TA Test, role `ta`) was inserted manually for end-to-end testing of the recruiter view — see commit `80ee0cc`.

## Production Access

| Resource | Where | Notes |
|---|---|---|
| Live app | https://carepal-hr-admin-570605259097.asia-south1.run.app | Cloud Run service `carepal-hr-admin`, region `asia-south1` |
| Health check | `/health` | Public, returns `{ok:true,...}` |
| API docs | `/api/docs` | Requires authentication (gated behind `requireAuth()` since security hardening PR) |
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
- `src/App.jsx` — main app, ~2800 lines, sidebar layout
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
