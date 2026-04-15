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

## Auto-Calculated Data
- Active headcount (from candidates reaching "Joined")
- On notice / PIP / In training counts (from employee status)
- Headcount deficit (Target − Active; offered NOT subtracted)
- Dashboard funnel metrics (aggregated from pipeline)

## Documents Uploaded (local disk in dev → Google Drive in production)
- Resume / CV
- Motivation Letter
- Offer Letter
- ID Proof (Aadhaar)
- Previous Org Relieving Letter
- Appointment Letter

## External Systems (Production)
- **Google OAuth** — Login (carepalmoney.com + impactguru.com domains)
- **Google Drive** — Document storage
- **Spreadsheet import** — Bulk candidate upload (in-app)
- **CarePal RDS MySQL** — All structured data

## Local Dev Substitutes

During local-first backend development (before Ravi call unblocks real infra):

| Production | Local dev substitute |
|-----------|---------------------|
| RDS MySQL | Local SQLite file (`carepal-backend/data/carepal.sqlite`) |
| Google OAuth | Mock auth middleware reading `x-user-email` header |
| Google Drive | Local `./uploads/{candidateId}/` directory |
| Cloud Run / Cloud Storage deployment | `npm run dev` on localhost (ports 4000 + 5173) |

See `docs/BUILD_PLAN.md` for the full staged build plan.
