# Build Plan

## Approach: Localhost-first, stage by stage

Backend is built against **local SQLite, mock auth, and local file uploads**. When Ravi unblocks production infrastructure, each of those is a contained swap (env var or single-file replacement), not a rewrite.

Principle: **each stage ends with something clickable in the browser**, not just green tests.

Full plan reference: `.claude/plans/eager-nibbling-bear.md`

## Decisions Made
- **Framework:** Express + TypeScript + Knex + Zod
- **Local DB:** SQLite via `better-sqlite3`; production swaps to RDS MySQL
- **Frontend location:** repo root (`/src/App.jsx`), not `carepal-demo/`
- **Interview scheduling:** Option A — pure form. HR checks Google Calendar in another tab, types date/interviewer into the tool, informs candidate outside the tool. No calendar API integration.

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

## Stage 2 — Mock auth + RBAC — PENDING
`x-user-email` header → loaded user + role. Approvers can approve, TA cannot.

## Stage 3 — Candidates — PENDING
Replicate the Stage 1 pattern for candidates. Add a candidate, see it in Kanban/Table.

## Stage 4 — Interviews + pipeline transitions — PENDING
**Scheduling approach: Option A — pure form.** Tool records scheduled interviews and drives pipeline stage transitions. No Google Calendar API, no .ics, no candidate invites from the tool. HR continues checking calendars in another tab and informing candidates via existing channels (phone/WhatsApp/email).

Schedule R1, record Select, candidate stage updates. Pure transition functions with unit tests. Interviewer list hardcoded initially (management UI deferred — client confirmed interviewers change rarely).

## Stage 5 — Headcount (auto-calculated) — PENDING
Move candidate to "Joined", active +1 and deficit −1. Deficit = Target − Active (NOT subtracting Offered).

## Stage 6 — Spreadsheet import — PENDING
Upload Excel → preview (dry-run) → commit. Candidates appear in pipeline.

## Stage 7 — Document metadata layer — PENDING
Upload to `./uploads/{candidateId}/`, metadata in `documents` table. Swap to Google Drive later.

## Stage 8 — Dashboard aggregations — PENDING
Funnel, pending approvals, city summary queries. Numbers match DB reality.

## Stage 9 — CI + API docs — PENDING
GitHub Actions (lint + test + build), OpenAPI/Swagger at `/api/docs`.

---

## Swap-for-real (after Ravi call)

| Mock | Real | Swap point |
|------|------|-----------|
| Local SQLite | RDS MySQL | `knexfile.js` + `.env` connection string |
| `x-user-email` header | Google OAuth | `src/middleware/auth.ts` |
| `./uploads/` disk | Google Drive API | `src/services/storage.ts` |
| GitHub Pages frontend | Cloud Run / Cloud Storage | Deployment workflow |

---

## Blockers (narrowed)

- **Ravi call** — only blocks the final "swap-for-real" step. Does NOT block Stages 0–9.
- **Akhlaque's conversion rates** — only blocks Target vs Achievement funnel (separate feature, not part of this plan).
