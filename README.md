# CarePal HR Admin

Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces the existing Google Sheets workflow with a structured, single-page admin interface for managing the end-to-end hiring pipeline of field sales agents — called **BDs (Business Development Associates)** — deployed across hospitals in Indian cities.

Two business units share this pipeline:

| Code | Business Unit |
|------|---------------|
| **CPM** | CarePal Money — Lending |
| **IGIV** | CarePal Money — Crowdfunding |

## Documentation

| Doc | What it covers |
|-----|---------------|
| [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) | Tech stack, repo structure, key people, running locally |
| [docs/BUILD_PLAN.md](./docs/BUILD_PLAN.md) | **Source of truth** for build status — 9 stages, what's done, what's next |
| [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) | All data the tool touches, inputs, auto-calculated fields, integrations |
| [docs/DEPLOY_TO_CLOUD_RUN.md](./docs/DEPLOY_TO_CLOUD_RUN.md) | One-time setup guide for deploying to Google Cloud Run + Cloud SQL |
| [docs/MIGRATION_GOTCHAS.md](./docs/MIGRATION_GOTCHAS.md) | SQLite (dev) vs MySQL (prod) differences to watch for when writing migrations |

---

## Current State

> **Production deployed.** Stages 0–10 complete: full backend (requisitions, candidates, interviews + state machine, headcount, spreadsheet import, document uploads, dashboard aggregations, OpenAPI docs), CI, and a single-container Cloud Run deploy backed by Cloud SQL MySQL. Live at **https://carepal-hr-admin-570605259097.asia-south1.run.app**. See [BUILD_PLAN.md](./docs/BUILD_PLAN.md) for the full stage history.

- **Frontend stack:** React + Vite, Lucide icons, inline styles — lives in `/src/`
- **Backend stack:** Node + Express + TypeScript + Knex + SQLite — lives in `/carepal-backend/`
- **Fonts:** Plus Jakarta Sans, DM Mono (Google Fonts)
- **Main frontend file:** `src/App.jsx` — Sidebar navigation layout (chosen by client Apr 9)
- **Live production app:** [https://carepal-hr-admin-570605259097.asia-south1.run.app](https://carepal-hr-admin-570605259097.asia-south1.run.app) (Cloud Run, asia-south1)
- **Live demo (frontend-only prototype, GitHub Pages):** [https://vandezand-ctrl.github.io/CarePal_HR_Tool/](https://vandezand-ctrl.github.io/CarePal_HR_Tool/)
- **Run locally:** two terminals — `cd carepal-backend && npm run dev` + `npm run dev` at repo root. See [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md#running-locally) for full instructions.
- **Deploy updates:** `npm run deploy` (builds with Vite, pushes to `gh-pages` branch)

---

## Sections

### 1. Dashboard

High-level overview of hiring activity.

- **Funnel metrics** — open requisitions, active candidates, offers extended, joins
- **Pending approvals** — requisitions awaiting manager sign-off
- **City summary** — clickable city rows that expand to show hospital-level requisitions

### 2. Requisitions

Manages hiring requests raised by city or regional heads.

- Requisition list with filters: status, city, **hospital**
- **New Requisition form** — city, hospital, area, BD type, business unit, hire type, notes
- Approval flow detail per requisition
- Linked candidates view

### 3. Candidates

The core pipeline view for tracking candidates through the interview process.

- **Kanban board** — cards grouped by pipeline stage
- **Table view** — sortable/filterable candidate list
- **Candidate detail** — contact info, current/expected CTC, interview history, document upload placeholders

### 4. Headcount

Workforce planning view.

- **Target (AOP) vs Active vs Deficit** by city and business unit
- Deficit = Target − Active (Offered is NOT subtracted — per client feedback)
- Tracks employees on notice period, PIP, in training, and with pending offers

### 5. Interview Schedules *(new — added Apr 12)*

Chronological view of all interview activity.

- **Upcoming interviews** — R1/R2 scheduled, with interviewer and date
- **Completed interviews** — R1/R2 results (Select/Reject)
- Summary stats: upcoming count, selected count, total completed

---

## Domain Concepts

### BD Types

| Type | Description |
|------|-------------|
| **Focus BD** | Assigned to a single hospital. Full-time presence at that location. |
| **Floater BD** | Covers multiple hospitals or areas within a city. Rotates between locations. |

### Hire Types

| Type | Description |
|------|-------------|
| **New** | Net-new headcount addition against AOP target. |
| **Replacement** | Backfill for a BD who has left or is on notice. The requisition references the person being replaced. |

### Approval Flow

1. **Raised** — City Head or Regional Head creates a requisition
2. **Pending Approval** — Awaits manager approval
3. **Approved** — Manager approves; HR is notified to begin sourcing
4. **Active** — Candidates are being sourced and interviewed
5. **Filled** — Position has been filled (candidate joined)

### Pipeline Stages

```
Sourced → R1 Scheduled → R1 Complete → R2 Scheduled → R2 Complete → Offered → Joined
```

| Stage | Description |
|-------|-------------|
| **Sourced** | Candidate identified by TA recruiter |
| **R1 Scheduled** | Round 1 interview scheduled |
| **R1 Complete** | Round 1 done, result recorded (Select / Reject) |
| **R2 Scheduled** | Round 2 interview scheduled |
| **R2 Complete** | Round 2 done, result recorded |
| **Offered** | Offer letter extended |
| **Joined** | Candidate has started (enters "In Training" in headcount) |

### Interview Roles

- **R1 interviewer** — City Lead (e.g. Himanshu Jaiswal for Bangalore, Khazim Syed for Hyderabad)
- **R2 interviewer** — Regional Head (e.g. Soundappan Gopal, Ankita Kumari, Bhavesh N)

### User Roles (3 types)

| Role | Who | Access |
|------|-----|--------|
| **Admin** | Sahil, management | Full dashboard, reports, approvals, all data |
| **Approver** | Business heads | Approve requisitions, view pipeline |
| **TA team** | Akhlaque's recruiters | Input data (add candidates, schedule interviews, upload CVs) |

---

## Production Architecture

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | React + Vite (served from the same container as the backend) | `complete` — deployed via Cloud Run |
| Backend | Node + Express + TypeScript + Knex | `complete` — deployed via Cloud Run |
| Database | **Cloud SQL MySQL 8.4** (`carepal-db`, asia-south1) | `complete` — provisional; will swap to AWS RDS once Sujeet provides the dedicated AWS account |
| Authentication | Mock (`x-user-email` header) | `complete (mock)` — Google OAuth swap pending (Stage 2 swap-point) |
| File storage | Local container disk (`./uploads/`) | `complete (local)` — AWS S3 swap pending (Stage 7 swap-point) |
| Secrets | Google Secret Manager (`DATABASE_URL`) | `complete` |
| Container registry | Artifact Registry (`asia-south1-docker.pkg.dev`) | `complete` |
| CI/CD | GitHub Actions → Cloud Run (auto-deploy on push to `main`) | `complete` |

---

## Build Plan

> **Living document.** Updated as we learn things. Each phase is verified working before the next one starts.

### Phase 1: Project Scaffold `complete`
Converted from single JSX file to Vite + React project. Deployed to GitHub Pages. Client reviewed 6 prototype variants on Apr 9 — chose Sidebar layout.

---

### Phase 2: Database Schema `pending — blocked on Ravi call`
Set up database on CarePal's RDS MySQL instance. Jesse needs a call with Ravi (engineering head) to confirm access and deployment approach.

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, email, name, role, city, domain | Roles: admin, approver, ta. Domains: carepalmoney.com, impactguru.com |
| `requisitions` | id, city, hospital, area, bd_type, bu, hire_type, replacement_for, raised_by (FK), status, notes, created_at | Status: pending_approval, approved, active, filled |
| `candidates` | id, req_id (FK), name, phone, email, city, current_role, company, current_ctc, expected_ctc, notice_period, ta (FK), stage, bu, sourced_at | Stage: sourced → r1_scheduled → r1_complete → r2_scheduled → r2_complete → offered → joined |
| `interviews` | id, candidate_id (FK), round (1/2), interviewer_id (FK), scheduled_date, mode, location_or_link, result | Replaces inline r1/r2 fields |
| `headcount` | id, city, bu, aop, active, notice, pip, training, offered | Deficit calculated as aop − active (NOT subtracting offered) |
| `documents` | id, candidate_id (FK), file_type, drive_file_id, uploaded_by, uploaded_at | Links to Google Drive files |

---

### Phase 3: Authentication `pending — after Phase 2`
Google OAuth login — only CarePal and Impact Group workspace users can access.

- Configure Google OAuth in GCP project
- Allow two email domains: `@carepalmoney.com` and `@impactguru.com`
- On first login, upsert user into `users` table
- Route to Admin, Approver, or TA view based on role
- Admin/approver emails stored in `users` table

---

### Phase 4: API Layer `pending — after Phase 2`
REST API endpoints for all CRUD operations.

- `GET /api/requisitions` — list with filters (bu, city, status, hospital)
- `GET /api/candidates` — list with filters (bu, reqId, stage)
- `GET /api/headcount` — list with filters (bu, city)
- `GET /api/interviews` — list with filters (bu, date range)
- `POST /api/requisitions` — create new requisition
- `PATCH /api/requisitions/:id` — update status (approve, activate, fill)
- `POST /api/candidates` — add candidate tagged to a requisition
- `PATCH /api/candidates/:id` — update stage
- `POST /api/interviews` — schedule interview
- `PATCH /api/interviews/:id` — record result (select/reject)
- `PATCH /api/headcount/:id` — update headcount numbers

---

### Phase 5: Connect Frontend to API `pending — after Phase 4`
Replace mock data with live API calls.

- Replace `REQUISITIONS`, `CANDIDATES`, `HEADCOUNT` arrays with fetch calls
- Add loading states and error handling
- Wire New Requisition form to POST endpoint
- Wire approval buttons to PATCH endpoint
- Wire candidate stage transitions
- Wire interview scheduling and result recording

---

### Phase 6: Google Drive Integration `pending`
Document upload on the candidate Documents tab.

- Set up Google Drive API via GCP project
- Create shared folder structure: `CarePal HR / {city} / {candidate_name}`
- Build upload component replacing the placeholder
- Store Drive file IDs in `documents` table
- Display uploaded docs with Drive preview links

---

### Phase 7: Target vs Achievement Funnel `pending — blocked on conversion rates from Akhlaque`
Add a target funnel alongside the current pipeline on the Dashboard.

- Akhlaque to provide conversion rates (sourced → R1 → R2 → offer → join)
- Calculate target numbers per stage based on headcount deficit
- Show target vs actual as dual bar chart on Dashboard
- Support drill-down by city and requisition

---

### Phase 8: Historical Reports `pending — needs real data`
Date-range reports for quarterly appraisals.

- Date range picker (last week, last month, last quarter, custom)
- Aggregated stats: R1s conducted, R2s conducted, offers rolled out, joins
- Filterable by city, BU, recruiter
- Data retention: ~1 year

---

### Phase 9: TA Team Input View `pending`
Simplified interface for Akhlaque's recruiters to input data.

- Add candidate (tagged to a requisition)
- Schedule interviews
- Upload CVs to Google Drive
- Simpler UI than the admin dashboard

---

### Phase 10: Deploy to Production `pending`
Move from GitHub Pages to Google Cloud.

- Deploy frontend to Cloud Run or Cloud Storage + CDN
- Connect to RDS MySQL
- Set up environment variables (DB credentials, OAuth keys, Drive API keys)
- Custom domain if needed

---

## Client Feedback Log

### Apr 9, 2026 — Prototype Review (Sahil + Akhlaque)

**Prototype decision:** Sidebar (A) chosen. Kanban, Dashboard, Activity Feed, Command Palette all rejected.

**Implemented:**
- Deficit calculation fixed: Deficit = Target − Active (do NOT subtract Offered)
- Interview Schedules added as 5th sidebar section (merged from Activity Feed concept)
- Hospital filter added to Requisitions
- City summary rows made expandable to show hospital-level requisitions
- Prototype switcher removed

**Pending (blocked on client input):**
- Target vs Achievement funnel — waiting for conversion rates from Akhlaque
- Database decision — waiting for call with Ravi (engineering head)
- Historical reports — needs real data
- TA team input view — after core backend is built
