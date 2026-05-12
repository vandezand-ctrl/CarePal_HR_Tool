# Data Sources & Inputs

## Data Created / Entered

### 1. Job Position Requests (Requisitions)
- **Input by:** City Heads, Regional Heads
- **How:** Form in the app ("New Requisition")
- **Fields:** Business unit (CPM/IGIV), hire type (new/replacement), city, BD type (Focus/Floater), hospital name, area/zone, replacing BD name (if replacement), free-text requirements

### 2. Candidate Profiles
- **Input by:** TA recruiters
- **How:** Spreadsheet import (bulk upload from Excel / Google Sheets)
- **Fields:** Name, phone, email, city, current job title, current company, current & expected CTC, notice period, linked requisition, assigned recruiter

### 3. Interview Schedules
- **Input by:** TA recruiters
- **How:** Form in candidate detail screen (Schedule tab). HR checks interviewer availability in Google Calendar separately (another tab) — the tool does not integrate with calendars.
- **Fields:** Round (R1/R2), mode (virtual/in-person), interviewer, date, time, location/Meet link

### 4. Interview Results
- **Input by:** Interviewers / TA team
- **How:** Form in candidate detail screen
- **Fields:** Select or Reject per round, optional comment

### 5. Offer & Joining Dates
- **Input by:** TA recruiters / HR
- **How:** Form in candidate detail screen
- **Fields:** Offer date, joining date

### 6. Interviewer List
- **Input by:** Admin
- **How:** Hardcoded list initially (changes rarely). Management UI deferred.
- **Fields:** Name, role (City Lead for R1, Regional Head for R2)

### 7. Headcount Targets (AOP)
- **Input by:** Admin / Management
- **How:** Manual entry per city + business unit
- **Fields:** Target headcount number

### 8. Incoming Job Applications (PR-K)
- **Input by:** Candidates emailing CVs to `ta1@impactguru.com`
- **How:** Gmail watcher (`carepal-backend/src/services/gmail-watcher.ts`) polls every 5 min, extracts the first PDF/DOCX attachment, uploads to S3 under `applications/{id}/cv.{ext}`, creates a row in the `applications` table, applies the `carepal-processed` label so polling is idempotent. **Resilience (Stage 11):** the polling loop is a `setTimeout` chain that backs off exponentially on consecutive failures (cap 30 min, resets on success); a `getApplicationByGmailMessageId` dedup check inside `processMessage` prevents duplicate rows when a partial failure (e.g. labeling step) causes the same message to be reprocessed next poll.
- **Fields stored:** sender email/name (from the `From:` header), subject, received_at, cv_storage_key, parsed_name (= sender name), parsed_email (= sender email), parsed_phone (regex from PDF text via `pdf-parse`), body_snippet (first 500 chars).
- **TA workflow:** Inbox sidebar tab (TA + admin only) shows pending applications with an unseen-count badge. Accept opens the Add Candidate form prefilled and atomically copies the CV into the candidate's documents. Reject takes an optional reason.
- **Status (May 2026):** code is in production but the watcher is **gated** — only starts when `GMAIL_CLIENT_EMAIL` + `GMAIL_PRIVATE_KEY` env vars are set. Awaiting Sujeet (VP Engineering) to create a GCP service account with domain-wide delegation on `ta1@impactguru.com`.

## Auto-Calculated Data
- Active headcount (from candidates reaching "Joined")
- On notice / PIP / In training counts (from employee status)
- Headcount deficit (Target − Active; offered NOT subtracted)
- Dashboard funnel metrics (aggregated from pipeline)

## Documents Uploaded (local disk in dev → AWS S3 in production)
- Resume / CV
- Motivation Letter
- Offer Letter
- ID Proof (Aadhaar)
- Previous Org Relieving Letter
- Appointment Letter

Metadata stored in the `documents` table (`s3_key`, `file_type`, `candidate_id`, `uploaded_by`, `uploaded_at`). Folder/key convention not yet agreed with Sujeet — follow up before Stage 7.

## External Systems (Production)
- **Google OAuth** — Login (`@carepalmoney.com` + `@impactguru.com` domains)
- **AWS S3** — Candidate document storage (separate CarePal-owned AWS account, per Apr 15 call with Sujeet)
- **AWS RDS (Postgres or MySQL)** — All structured data for this tool (same dedicated AWS account)
- **CarePal's existing systems** — NOT directly integrated. Only inbound data feed is a list of city managers + BDs, delivered via API or one-time export from Sujeet (pending detailed requirements email)
- **Spreadsheet import** — Bulk candidate upload (in-app)

**Cross-cloud note:** app runs on Google Cloud (Cloud Run), storage + DB on AWS (S3 + RDS).

## Hospitals, Cities, and Requisition Context

Per the Apr 15 ATS discussion, hospitals and cities are **not** stored as separate master lists. The existing CarePal hiring-requisition Google Form (linked to the ATS) captures hospital + city + area name **per requisition**. Our `requisitions` table stores these as fields on each requisition. No sync with an external hospitals/cities table is needed.

BD-to-hospital mapping is expressed per-requisition: one BD may cover multiple hospitals as specified on the requisition.

## Local Dev Substitutes

During local-first backend development (before CarePal provisions the dedicated AWS account):

| Production | Local dev substitute |
|-----------|---------------------|
| AWS RDS (SQL) | Local SQLite file (`carepal-backend/data/carepal.sqlite`) |
| Google OAuth | Mock auth middleware reading `x-user-email` header |
| AWS S3 (documents) | Local `./uploads/{candidateId}/` directory |
| Cloud Run deployment | `npm run dev` on localhost (ports 4000 + 5173) |

See `docs/BUILD_PLAN.md` for the full staged build plan.
