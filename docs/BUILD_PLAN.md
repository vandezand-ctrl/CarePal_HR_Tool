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

## Stage 4 — Interviews + pipeline transitions — COMPLETE
`interviews` table migrated (FK to candidates, unique per candidate+round), seeded from existing r1/r2 data. Pure `transitionStage(current, event)` state machine in `src/logic/pipeline.ts` with **23 unit tests** covering SCHEDULE_R1, RECORD_R1_RESULT, SCHEDULE_R2, RECORD_R2_RESULT, MAKE_OFFER, RECORD_JOIN (valid + invalid paths). Uses Node's built-in test runner (`node --test`). Interview API: `GET /api/interviews`, `GET /:id`, `POST` (schedule/upsert), `PATCH` (record result). Both POST and PATCH drive candidate stage transitions atomically. Hardcoded interviewers list at `GET /api/interviewers`.

**Scheduling approach: Option A — pure form (as decided).** Tool records scheduled interviews and drives pipeline stage transitions. No Google Calendar API, no .ics, no candidate invites from the tool.

Frontend: Schedule tab in CandidateModal is now fully wired — controlled form state, validation, submit via `DataContext.scheduleInterview()`, auto-navigates to Interviews tab after save. Interviews tab shows Select/Reject buttons on each scheduled round with no result yet; clicking them calls `PATCH /api/interviews/:id` and the candidate's stage updates live in the UI. Round-specific interviewer filter (R1 shows city leads, R2 shows regional heads).

**Verified end-to-end via Vite proxy:**
- C-006 (Sourced) → schedule R1 → stage becomes `R1 Scheduled`
- Record Select → stage becomes `R1 Complete`
- Schedule R2 from `R1 Complete` → stage becomes `R2 Scheduled`
- Attempting to schedule R2 from `Sourced` → 400 with `"Cannot schedule R2 from stage 'Sourced'"`
- 23/23 unit tests pass on every run

**Files added:**
- Backend: `migrations/20260415_004_create_interviews.js`, `seeds/04_interviews.js`, `src/models/interview.ts`, `src/schemas/interview.ts`, `src/routes/interviews.ts`, `src/routes/interviewers.ts`, `src/logic/pipeline.ts`, `src/logic/pipeline.test.ts`
- `npm test` script using Node's built-in test runner via tsx
- Frontend: updates to `src/api.js`, `src/DataContext.jsx`, `src/App.jsx` (CandidateModal fully rewritten for controlled form + result recording)

## Stage 5 — Headcount (auto-calculated) — COMPLETE
`headcount` table holds only AOP targets (one row per city+BU, 14 rows seeded). Everything else is derived: `active` = count of candidates at stage `Joined` per city+BU, `offered` = count at `Offered`, `deficit` = calculated via pure function `calculateDeficit(target, active)` (4 unit tests). `notice/pip/training` return 0 for now — these require external BD data from Sujeet's API/export; we deliberately did NOT add a manual-override field (clean approach, per user decision Apr 15).

`GET /api/headcount?bu=` returns the joined view (target + live counts) in a single query. Frontend Headcount section now reads from context; Dashboard also pulls from the same data. Moving a candidate to Joined via the UI or API triggers an automatic `refreshHeadcount()` — the numbers update without a page reload.

**Verified end-to-end via Vite proxy:**
- Kolkata IGIV baseline: aop=4, active=0, offered=1, deficit=4
- PATCH C-007 → stage=Joined
- Kolkata IGIV after: aop=4, **active=1, offered=0, deficit=3** ✓
- 27/27 unit tests pass (23 pipeline + 4 headcount)

**Files added:**
- Backend: `migrations/20260415_005_create_headcount.js`, `seeds/05_headcount.js`, `src/logic/headcount.ts`, `src/logic/headcount.test.ts`, `src/models/headcount.ts`, `src/routes/headcount.ts`
- Frontend: updates to `src/api.js` (listHeadcount), `src/DataContext.jsx` (loads headcount, auto-refreshes on stage changes), `src/App.jsx` (Dashboard + Headcount components read from context)

## Stage 6 — Spreadsheet import — COMPLETE
`POST /api/candidates/import` accepts a multipart file (xlsx, xls, csv). Parses via `xlsx`, normalises column headers (case-insensitive, punctuation-agnostic — accepts `Full Name` / `Email ID` / `Mobile Number` / etc.), validates each row with the same Zod rules as single POST, then FK-checks the `reqId` against live requisitions. Per-row success — invalid rows are skipped with readable reasons, valid rows continue.

Two modes:
- **Dry run** (default `?dryRun=true`): returns a preview with `{ valid, invalid }` — nothing written
- **Commit** (`?dryRun=false`): inserts the valid rows; invalid remain in the response for display

5 unit tests covering header mapping (exact, case/punctuation, aliases, unknown) and row parsing (clean row, mixed valid/invalid, CTC cleaning, empty sheet).

Frontend: "Import from Excel" button on the Pipeline section opens a modal with file picker → auto-preview → confirm-to-commit flow. Shows counts (total / valid / invalid), a table of valid rows, and a table of invalid rows with error messages.

**Security note:** The `xlsx` package from npm has unpatched CVEs (ReDoS + prototype pollution). For this internal tool (only authenticated TA recruiters upload), the blast radius is bounded; flagged for swap to `exceljs` if we ever expose uploads more broadly. Documented in `carepal-backend/package.json` comments.

**Verified end-to-end:**
- 4-row sheet: 2 valid, 1 invalid (missing FK REQ-999), 1 invalid (empty name)
- Dry run returns `validCount=2 invalidCount=2` with correct error messages
- Commit creates C-010 + C-011, leaves invalid rows untouched
- Candidate count jumps from 9 → 11
- 36/36 unit tests pass

**Files added:**
- Backend: `src/logic/candidateImport.ts`, `src/logic/candidateImport.test.ts`, `src/routes/candidatesImport.ts`
- Frontend: `ImportCandidatesModal` in `src/App.jsx`, `api.importCandidates()` in `src/api.js`

## Stage 7 — Document metadata layer — COMPLETE
`documents` table stores metadata: candidate FK (cascade), doc type, filename, storage key, size, MIME type, uploader user, timestamp. Unique `(candidate_id, doc_type)` constraint — one active doc per type per candidate (re-upload replaces).

Storage abstracted in `src/services/storage.ts` with 3 functions: `saveFile`, `readFile`, `deleteFile`. Local implementation writes to `./uploads/{candidateId}/{slug}.ext`. Swap to AWS S3 is **one file replacement** — no other code changes needed. Path-traversal guard on storage keys.

API:
- `GET /api/candidates/:id/documents` — list docs
- `POST /api/candidates/:id/documents` — multipart upload with `docType` field (upsert; deletes old file if extension changes)
- `GET /api/documents/:id/download` — streams bytes with original filename + MIME
- `DELETE /api/documents/:id` — remove row + file (idempotent)

10 MB cap per document. Only authenticated users can upload; `uploaded_by_user_id` recorded.

Frontend: Documents tab rebuilt. Shows all 6 doc types with live state (uploaded shows filename + size; not uploaded shows placeholder). Each row has Upload / Replace / Download / Remove actions. File-size and name shown inline. Busy states per row.

**Verified end-to-end:**
- List empty → upload resume → list shows it with filename + size
- Download returns exact bytes (34 → matches)
- File on disk at `carepal-backend/uploads/C-003/resume.txt`
- Re-upload keeps same DB id (upsert), replaces file
- Delete removes both row and file

**Files added:**
- Backend: `migrations/20260415_006_create_documents.js`, `src/services/storage.ts`, `src/models/document.ts`, `src/routes/documents.ts`
- Frontend: `src/api.js` (4 document methods), `src/App.jsx` (Documents tab rewritten in CandidateModal)

**Swap-to-S3 plan:** replace `src/services/storage.ts` with an AWS SDK-backed version that calls `PutObject` / `GetObject` / `DeleteObject` on the bucket Sujeet provides. Storage keys keep the same shape (`{candidateId}/{slug}.ext`). No migration needed — the DB column is named `storage_key`, not `file_path`.

## Stage 8 — Dashboard aggregations — COMPLETE
`GET /api/dashboard?bu=` returns all dashboard numbers in one request: `totals` (open positions, candidates in pipe, offers extended, confirmed joins), `funnel` (count per pipeline stage, fixed 7-stage shape), `pendingApprovals` (slim list of awaiting-approval requisitions), `cityBreakdown` (per-city aggregation: AOP total, Active total, Deficit total, open req count, candidate count, hospital-level open req breakdown).

Pure aggregation functions in `src/logic/dashboard.ts` (no DB deps — caller provides filtered arrays). 7 new unit tests cover funnelCounts (shape, zero-count stages, canonical order), topLineCounts, pendingApprovals (filter + projection), and cityBreakdown (totals, open-req grouping, sorted output).

Frontend Dashboard now fetches from the endpoint on mount and on BU change, and re-fetches whenever the requisitions/candidates arrays in context mutate (approval, stage transition, import, etc.) — so changes from other sections propagate live. Demo-padding in the funnel chart removed; real data stands on its own.

**Verified end-to-end via Vite proxy:**
- Approving REQ-004: pending 3 → 2 ✓
- Full pipeline C-004 to Joined: joins 1 → 2, offers 2 → 3, Bangalore active 1 → 2, deficit 11 → 10 ✓
- BU filter: `?bu=CPM` returns correctly scoped totals and city list
- 42/42 unit tests pass (pipeline + headcount + candidateImport + dashboard)

**Files added:**
- Backend: `src/logic/dashboard.ts`, `src/logic/dashboard.test.ts`, `src/routes/dashboard.ts`
- Frontend: `api.getDashboard(bu)` in `src/api.js`, Dashboard component rewritten in `src/App.jsx` to consume the endpoint

## Stage 9 — CI + API docs — COMPLETE
**CI:** `.github/workflows/ci.yml` runs on every push to `main` and every PR. Two jobs in parallel — backend (lint → typecheck → test → build) and frontend (lint → build). Both jobs use Node 22 with `npm ci` for reproducible installs and npm cache enabled.

**API docs:** full OpenAPI 3 spec hand-written in `carepal-backend/src/openapi.yaml` — 18 endpoints across 8 tags (health, auth, requisitions, candidates, interviews, headcount, documents, dashboard), with schemas for User, Requisition, Candidate, Interview, Document, HeadcountRow. Mock-auth security scheme documented (x-user-email header). Served via `swagger-ui-express`:
- `GET /api/docs` — Swagger UI (public, no auth)
- `GET /api/docs.json` — raw spec for external tools (Postman import, codegen)

Build step copies `openapi.yaml` into `dist/` so production image has the spec available.

**Pre-existing lint/config fixes found during Stage 9:**
- Frontend ESLint was walking `carepal-backend/dist/` after running `npm run build` → added `'carepal-backend/**', 'docs/**'` to `globalIgnores`.
- Dashboard had a leftover unused `cands` variable from the Stage 8 refactor → removed.

**Verified:**
- `/health` responds unauthenticated
- `/api/docs` returns the Swagger HTML UI
- `/api/docs.json` returns parsed spec with 18 paths
- All CI steps green locally: both lint, both builds, 42 unit tests, backend typecheck.

**Files added:**
- `.github/workflows/ci.yml`
- Backend: `src/openapi.yaml`, `src/routes/docs.ts`, new `swagger-ui-express` + `yaml` deps

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
