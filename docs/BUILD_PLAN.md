# Build Plan

## Approach: Localhost-first, stage by stage

Backend is built against **local SQLite, mock auth, and local file uploads**. When Sujeet (CarePal VP Engineering) provides a dedicated AWS account, each of those is a contained swap (env var or single-file replacement), not a rewrite.

Principle: **each stage ends with something clickable in the browser**, not just green tests.

Full plan reference: `.claude/plans/eager-nibbling-bear.md`

## Decisions Made
- **Framework:** Express + TypeScript + Knex + Zod
- **Local DB:** SQLite via `better-sqlite3`; production swaps to AWS-hosted SQL (Postgres or MySQL — Sujeet open to either)
- **Frontend location:** repo root (`/src/App.jsx`), not `carepal-demo/`
- **Interview scheduling:** Option A — pure form. HR checks Google Calendar in another tab, types date/interviewer into the tool, informs candidate outside the tool. No calendar API integration.
- **Document storage:** AWS S3 (NOT Google Drive). Decided on the Apr 15 call with Sujeet Yadav. Stage 7 now targets S3 directly rather than Google Drive.
- **Infrastructure topology (per Apr 15 call):** CarePal creates a **separate AWS account** dedicated to this tool, isolated from existing CarePal systems. After setup/integration, CarePal takes over credentials and ownership.
- **Hospitals / cities:** NOT master-list tables. The existing CarePal hiring-requisition Google Form (linked to the ATS) captures hospital + city + area per requisition, and our `requisitions` table already stores them as fields. No separate hospitals/cities master lists required.
- **Only CarePal-DB integration needed:** a list of city managers + BDs (for user access / headcount). Sujeet to provide via API or one-time export — pending Jesse's email with exact columns.

---

## Stage 0 — Foundation — COMPLETE
Node + Express + TypeScript scaffold in `carepal-backend/`. `/health` endpoint returns 200. ESLint + Prettier configured. `.env.local` loading via dotenv. No Docker — SQLite chosen for local DB.

**Verified:** `npm run dev` → `curl localhost:3000/health` → `{"ok":true,"uptime":...,"timestamp":"..."}`

## Stage 1 — Requisitions (vertical slice) — COMPLETE
SQLite + Knex. `requisitions` table migrated, seeded with 8 rows. API endpoints: `GET /api/requisitions` (with filters bu/city/hospital/status), `GET /api/requisitions/:id`, `POST`, `PATCH`. Zod validation enforcing `replacementFor` required for Replacement hires. Frontend (`/src/App.jsx`) wired via new `DataContext` — replaces static REQUISITIONS array. NewReqModal submits via POST. Loading/error states added.

**Verified:** POST/PATCH tested via curl; rejected payloads return 400 with Zod issues; both servers run in parallel (backend:3000, frontend:5173); 10 rows after E2E test.

**Files added:**
- Backend: `knexfile.js`, `migrations/20260414_001_create_requisitions.js`, `seeds/01_requisitions.js`, `src/db/index.ts`, `src/models/requisition.ts`, `src/schemas/requisition.ts`, `src/routes/requisitions.ts`
- Frontend: `src/api.js`, `src/DataContext.jsx`

**Data location:** `carepal-backend/data/carepal.sqlite` (gitignored)

## Stage 2 — Mock auth + RBAC — COMPLETE
`users` table migrated, seeded with 18 users (1 admin, 10 approvers, 7 TA). Mock auth middleware reads `x-user-email` header, loads user from DB, attaches to `req.user`. RBAC middleware (`requireRole`) — admins bypass all checks. Applied to requisition endpoints: POST + PATCH require `approver`. `/api/me` and `/api/users` endpoints expose the current user + list. Frontend sends `x-user-email` with every request (from localStorage, default = Akhlaque/TA). Dev-mode user switcher in the Header — change role on the fly to test RBAC. "New Requisition" button hidden for TA. "Approve Requisition" button added to detail slide-out for approvers on Pending status.

**Verified:**
- No header → 401
- Unknown email → 401
- TA → POST 403 ("Role 'ta' cannot perform this action")
- TA → PATCH approve 403
- Approver → POST/PATCH 200
- Admin → all actions 200 (role bypass)
- `raisedBy` now comes from authenticated user, not client payload

**Files added:**
- Backend: `migrations/20260415_002_create_users.js`, `seeds/02_users.js`, `src/models/user.ts`, `src/middleware/auth.ts`, `src/middleware/rbac.ts`, `src/routes/me.ts`
- Frontend: updates to `src/api.js` (adds `x-user-email` header + `me()`/`listUsers()`), `src/DataContext.jsx` (loads me + users + switchUser), `src/App.jsx` (Header user switcher, role-gated New/Approve buttons)

## Stage 3 — Candidates — COMPLETE
`candidates` table migrated (FK to requisitions, with r1/r2 interview fields as a transitional measure until Stage 4 moves them to their own table). Seeded with all 9 existing candidates. API: `GET /api/candidates` (filters: bu/reqId/stage/city), `GET /:id`, `POST`, `PATCH`. Zod validation on both POST and PATCH. Foreign-key check on POST (reject if `reqId` doesn't exist → 400). Frontend DataContext now loads candidates in parallel with requisitions/users/me; 4 components (Dashboard, Requisitions, Pipeline, Interviews) pull from context instead of the static array.

**Also in this stage:** Vite proxy added (`/api/*` → backend on `:4000`), so the frontend makes same-origin relative calls; CORS no longer needed in dev; behaviour matches production.

**Verified:**
- `GET /api/candidates` returns 9 seeded + any created via API
- `POST` with unknown `reqId` → 400 "Requisition REQ-XXX not found"
- `POST` with invalid payload → 400 with Zod issues
- Frontend loads Kanban + Table views with data from backend
- Dashboard funnel counts match DB reality
- Vite proxy verified: `curl localhost:5173/api/candidates` returns candidates via the proxy

**Files added:**
- Backend: `migrations/20260415_003_create_candidates.js`, `seeds/03_candidates.js`, `src/models/candidate.ts`, `src/schemas/candidate.ts`, `src/routes/candidates.ts`
- Frontend: updates to `src/api.js` (candidate methods, relative paths), `src/DataContext.jsx` (loads + exposes candidates), `src/App.jsx` (4 components destructure `candidates` from context)
- Config: `vite.config.js` (proxy block)

## Stage 4 — Interviews + pipeline transitions — PENDING
**Scheduling approach: Option A — pure form.** Tool records scheduled interviews and drives pipeline stage transitions. No Google Calendar API, no .ics, no candidate invites from the tool. HR continues checking calendars in another tab and informing candidates via existing channels (phone/WhatsApp/email).

Schedule R1, record Select, candidate stage updates. Pure transition functions with unit tests. Interviewer list hardcoded initially (management UI deferred — client confirmed interviewers change rarely).

## Stage 5 — Headcount (auto-calculated) — PENDING
Move candidate to "Joined", active +1 and deficit −1. Deficit = Target − Active (NOT subtracting Offered).

## Stage 6 — Spreadsheet import — PENDING
Upload Excel → preview (dry-run) → commit. Candidates appear in pipeline.

## Stage 7 — Document metadata layer — PENDING
Upload to `./uploads/{candidateId}/` locally; metadata in `documents` table. Swap to **AWS S3** (not Google Drive) when CarePal provides the S3 bucket + AWS credentials. `documents` table will store `s3_key` (not `drive_file_id`). Folder/key structure not yet agreed with Sujeet — follow up via email.

## Stage 8 — Dashboard aggregations — PENDING
Funnel, pending approvals, city summary queries. Numbers match DB reality.

## Stage 9 — CI + API docs — PENDING
GitHub Actions (lint + test + build), OpenAPI/Swagger at `/api/docs`.

---

## Swap-for-real (after Sujeet provides AWS account)

| Mock | Real | Swap point |
|------|------|-----------|
| Local SQLite | AWS-hosted SQL (Postgres or MySQL on RDS) | `knexfile.js` + `.env` connection string |
| `x-user-email` header | Google OAuth (Workspace: @carepalmoney.com, @impactguru.com) | `src/middleware/auth.ts` |
| `./uploads/` disk | **AWS S3 bucket** (in dedicated CarePal AWS account) | `src/services/storage.ts` |
| GitHub Pages frontend | Google Cloud Run (Jesse's preference) | Deployment workflow |

**Note:** Cross-cloud setup is deliberate — app runs on Google Cloud, storage + DB on AWS. Acceptable for this project; flag on the email to Sujeet so network/latency expectations are set.

---

## Blockers (narrowed)

- **Jesse to email Sujeet** — detailed data requirements (exact columns, resources needed). Blocks: AWS credentials delivery, BD list delivery.
- **Akhlaque's conversion rates** — only blocks Target vs Achievement funnel (separate feature, not part of this plan).
- **S3 folder structure** — not discussed on call; follow up via email before Stage 7 starts.
- **Retention policy** — CarePal hasn't confirmed; follow up via email.

## Meeting context — Apr 15 ATS discussion

Technical contact: **Sujeet Yadav (VP Engineering)**, not Ravi.
Participants: Jesse van de Zand, Akhlaque Khan, Sujeet Yadav.
Key outputs: separate AWS account, S3 for docs, requisition form is the source of hospital/city per requisition (no master lists needed).
See `Ravi_Meeting_Questions_Filled.docx` for full Q&A.
