# CarePal HR Admin

Internal hiring-management tool for CarePal Money's talent acquisition team. Replaces the existing Google Sheets workflow with a structured, single-page admin interface for managing the end-to-end hiring pipeline of field sales agents — called **BDs (Business Development Associates)** — deployed across hospitals in Indian cities.

Two business units share this pipeline:

| Code | Business Unit |
|------|---------------|
| **CPM** | CarePal Money — Lending |
| **IGIV** | CarePal Money — Crowdfunding |

---

## Current State

> **Prototype phase.** All data is mocked. No backend, no authentication, no persistence.

- **Stack:** React + Vite, Lucide icons, inline styles
- **Fonts:** Plus Jakarta Sans, DM Mono (Google Fonts)
- **Live demo:** [https://vandezand-ctrl.github.io/CarePal_HR_Tool/](https://vandezand-ctrl.github.io/CarePal_HR_Tool/)
- **Run locally:** `npm install && npm run dev` → opens at `http://localhost:5173`

---

## Prototypes

Three UI prototypes are available, switchable via a toggle bar at the top of the app. The client can compare approaches during a demo call.

| Prototype | File | Description |
|-----------|------|-------------|
| **A · Sidebar Navigation** | `src/App.jsx` | Classic admin panel. Fixed left sidebar with 4 sections (Dashboard, Requisitions, Candidates, Headcount). Separate pages per section. |
| **B · Kanban-First** | `src/AppKanban.jsx` | The kanban board IS the app. No page navigation. Metrics in top bar, candidates as cards in stage columns, headcount in a slide-out panel. |
| **C · Single Dashboard** | `src/AppDashboard.jsx` | Everything on one scrollable screen. Collapsible panels for funnel, requisitions, and headcount. Click a requisition to expand and see its candidates inline. |

### Switching prototypes

**Live demo:** Use the dark toggle bar at the top of the page.

**Locally during development:** Change the import in `src/main.jsx`:
```jsx
import App from './AppSwitcher.jsx'  // All prototypes with toggle bar
// import App from './App.jsx'       // Only Prototype A
// import App from './AppKanban.jsx'  // Only Prototype B
// import App from './AppDashboard.jsx' // Only Prototype C
```

### Deploying updates
```bash
npm run deploy
```
This builds with Vite and pushes to the `gh-pages` branch. The site updates at the GitHub Pages URL within 1-2 minutes. Hard-refresh (`Ctrl+Shift+R`) if the browser shows a cached version.

---

## Sections

### 1. Dashboard

High-level overview of hiring activity.

- **Funnel metrics** — open requisitions, active candidates, offers extended, joins
- **Pending approvals** — requisitions awaiting manager sign-off
- **City summary** — at-a-glance status per city

### 2. Requisitions

Manages hiring requests raised by city or regional heads.

- Requisition list with status filtering (Pending Approval, Approved, Active, Filled)
- **New Requisition form** — city, hospital, area, BD type, business unit, hire type, notes
- Approval flow detail per requisition

### 3. Candidates

The core pipeline view for tracking candidates through the interview process.

- **Kanban board** — cards grouped by pipeline stage
- **Table view** — sortable/filterable candidate list
- **Candidate detail** — contact info, current/expected CTC, interview history, document upload placeholders

### 4. Headcount

Workforce planning view.

- **Target (AOP) vs Active vs Deficit** by city and business unit
- Tracks employees on notice period, PIP, in training, and with pending offers

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
| **Joined** | Candidate has started |

### Interview Roles

- **R1 interviewer** — City Lead (e.g. Himanshu Jaiswal for Bangalore, Khazim Syed for Hyderabad)
- **R2 interviewer** — Regional Head (e.g. Soundappan Gopal, Ankita Kumari, Bhavesh N)

---

## Production Architecture

| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | React + Vite | Phase 1 |
| Database | Supabase (Postgres) | Phase 2 |
| Authentication | Google OAuth via Supabase (CarePal Google Workspace) | Phase 3 |
| File storage | Google Drive API (CV uploads, offer letters, documents) | Phase 7 |
| Deployment | Google Cloud (Cloud Storage + CDN or Cloud Run) | Phase 9 |

---

## Build Plan

> **Living document.** This plan will be updated as we learn things in later phases that affect earlier assumptions. Each phase is a self-contained step — verified working before the next one starts.

### Phase 1: Project Scaffold `complete`
Converted from single JSX file to Vite + React project. Deployed to GitHub Pages.

**Key files:** `package.json`, `vite.config.js`, `index.html`, `src/App.jsx`, `src/main.jsx`

---

### Phase 2: Database Schema `not started`
Set up Supabase project and define all tables.

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, email, name, role, city | Roles: ta, city_lead, regional_head, hr_admin |
| `requisitions` | id, city, hospital, area, bd_type, bu, hire_type, replacement_for, raised_by (FK), status, notes | Status: pending_approval, approved, active, filled |
| `candidates` | id, req_id (FK), name, phone, email, city, current_role, company, current_ctc, expected_ctc, notice_period, ta (FK), stage, bu | Stage: sourced → r1_scheduled → r1_complete → r2_scheduled → r2_complete → offered → joined |
| `interviews` | id, candidate_id (FK), round (1/2), interviewer_id (FK), scheduled_date, result | Replaces the inline r1/r2 fields from the prototype |
| `headcount` | id, city, bu, aop, active, notice, pip, training, offered | Workforce planning targets |

**Key files:** `supabase/migrations/001_schema.sql`

---

### Phase 3: Authentication `not started`
Google OAuth via Supabase — only CarePal Workspace users can access the app.

- Configure Google OAuth provider in Supabase dashboard
- Create Supabase client (`src/lib/supabase.js`)
- Create auth context (`src/context/AuthContext.jsx`)
- Build login page with Google sign-in
- Gate all app content behind auth
- Upsert user into `users` table on first login
- Set up Row Level Security (RLS) on all tables

**Key files:** `src/lib/supabase.js`, `src/context/AuthContext.jsx`, `src/components/LoginPage.jsx`, `.env`

---

### Phase 4: Data Layer — Read Path `not started`
Replace mock arrays with live Supabase queries. Read-only — no mutations yet.

- Create query functions for requisitions, candidates, headcount
- Seed the database with current mock data
- Update all section components to fetch from Supabase
- Verify all four sections render identically with live data

**Key files:** `src/lib/queries.js`, `supabase/seed.sql`

---

### Phase 5: Write Path — Requisitions `not started`
First mutation: creating and approving requisitions.

- Wire New Requisition form to `INSERT INTO requisitions`
- Add Approve button on pending requisitions
- Implement status transition logic (pending → approved → active → filled)
- Optimistic UI updates or refetch after mutation

**Key files:** `src/lib/mutations.js`

---

### Phase 6: Write Path — Candidates `not started`
Candidate mutations and pipeline stage transitions.

- Wire Add Candidate form to insert
- Build stage transition logic (button-based: "Move to R1 Scheduled", etc.)
- Wire interview scheduling — create `interviews` records
- Wire interview result recording — auto-advance stage on result

**Key files:** `src/lib/mutations.js`, stage transition logic in App

---

### Phase 7: File Storage — Google Drive `not started`
Document upload on the candidate Documents tab.

- Set up Google Drive API via GCP project
- Create shared folder structure: `CarePal HR / {city} / {candidate_name}`
- Build upload component replacing the placeholder in candidate modal
- Store Drive file IDs in a `documents` table
- Display uploaded docs with Drive preview links

**Key files:** `src/lib/drive.js`, `src/components/DocumentUpload.jsx`

---

### Phase 8: Headcount Write Path `not started`
Make headcount editable.

- Allow HR admins to update AOP targets and counts
- Auto-derive offered count from candidates in "Offered" stage where possible

---

### Phase 9: Deploy to Google Cloud `not started`
Build and deploy.

- `npm run build` (Vite production build)
- Deploy to Google Cloud Storage + Cloud CDN, or Cloud Run (containerised)
- Custom domain setup if needed
- (Optional) Chrome Extension packaging if still desired

**Key files:** `Dockerfile` or GCS deploy config, `cloudbuild.yaml`

---

### Phase 10: TA Performance View `not started`
Recruiter-level metrics.

- Candidates sourced per recruiter
- Conversion rates (sourced → joined)
- Average time-to-fill
- New section/tab in the app

**Key files:** `src/components/TAPerformance.jsx`
