# Pre-launch checklist

The production app is **deployed but the database is empty** (no users → nobody can sign in). This document is the step-by-step playbook to flip the tool from "deployed" to "ready for Sahil + Akhlaque to do a real test session."

Three hard blockers covered. **Blocker 3 (DB password rotation) is owned by CarePal** at handover and not in this doc.

---

## Section 0 — Diagnose first

Before running anything below, **find out what state production is actually in**. Run this in [Cloud SQL Studio](https://console.cloud.google.com/sql/instances/carepal-db/studio?project=carepal-hr-admin) (web UI — *not* PowerShell; SQL doesn't run in a terminal):

```sql
SELECT id, email, name, role, last_login_at FROM users ORDER BY id;
```

Three possible states:

| Result | What it means | What to do |
|---|---|---|
| **Empty result** | No one has signed in yet. | Run Section 1 → Section 2 → Section 3 in order. |
| **Only `sahil@carepalmoney.com` (or other allowlisted emails) as `ta`** | Google auth is already live (Section 2 is done). The first sign-in auto-provisioned them as TA. | Skip Section 2's flip step (do the verify only). Run Section 1 — its `ON DUPLICATE KEY UPDATE` will overwrite Sahil's `ta` row with `admin` and the proper name. |
| **Multiple rows including the master-sheet emails** | Someone already bootstrapped. | Cross-check against the master sheet; re-run Section 1 only if rows are stale or missing. |

> **Confirmed state as of May 2 2026** (per Jesse): scenario 2. Sahil signed in via Google OAuth on the live Cloud Run app and was auto-provisioned as `ta`. Other 22 employees not yet in the table. Section 2 is **already done**; do the verify-only step.

---

## Section 1 — Bootstrap production users

**Source:** `IG Master Employee sheet List.xlsx` (sent by Sahil, May 2 2026). 23 employees.

**Role mapping:**

| Source role | Tool role | Count | Reason |
|---|---|---|---|
| CEO + VP Tech + Akhlaque (TA team lead) | `admin` | 3 | Sahil owns the tool; Sujeet needs admin for system support; Akhlaque runs the recruiter team and needs full access |
| National Head, National Sales Head, Regional Head, City Lead | `approver` | 16 | Senior staff who approve requisitions + run R1/R2 interviews |
| TA (excluding Akhlaque) | `ta` | 4 | Recruiters reporting to Akhlaque (Nirmala, Ashwini, Shubham, Jagruti) |

**Cleanup of pre-existing rows** (per Section 0 diagnose, May 2 2026):

| Row | Decision | Reason |
|---|---|---|
| `akhlaque@carepalmoney.com` (admin, never used) | **Delete** | Stale duplicate — Akhlaque signs in via the IG account |
| `vandezand@bopinc.org` (ta, never used) | **Delete** | Bopinc isn't an allowlisted domain — can't be used to sign in |
| `jessevandezand@gmail.com` (admin, used) | **Keep** | Jesse's documented personal allowlist exception for dev access |
| `ta@impactguru.com` (ta, never used) | **Keep** | Shared TA mailbox |

**How to run it:**

1. Open [Cloud SQL Studio](https://console.cloud.google.com/sql/instances/carepal-db/studio?project=carepal-hr-admin)
2. Authenticate as `carepal_app` (DB password lives in Secret Manager → `DATABASE_URL`)
3. Pick database `carepal`
4. Paste the SQL block below and run it

The block does cleanup + UPSERT bootstrap + verify in one shot. Idempotent — `INSERT … ON DUPLICATE KEY UPDATE` keys on the unique `email` column, so re-running only refreshes name/role/domain on existing rows rather than duplicating.

```sql
-- ─── Step 1: Clean up stale rows ─────────────────────────────────────────
DELETE FROM users WHERE email = 'akhlaque@carepalmoney.com';
DELETE FROM users WHERE email = 'vandezand@bopinc.org';

-- ─── Step 2: Bootstrap from IG Master Employee sheet ─────────────────────
INSERT INTO users (email, name, role, domain) VALUES
  -- TA team (Akhlaque promoted to admin per Jesse — TA team lead)
  ('akhlaque.khan@impactguru.com',         'Akhlaque Khan',       'admin',    'impactguru.com'),
  ('nirmala.roa@impactguru.com',           'Nirmala Roa',         'ta',       'impactguru.com'),
  ('ashwini.pawar@impactguru.com',         'Ashwini Pawar',       'ta',       'impactguru.com'),
  ('shubham.samel@impactguru.com',         'Shubham Samel',       'ta',       'impactguru.com'),
  ('jagruti.chiplunkar@impactguru.com',    'Jagruti Chiplunkar',  'ta',       'impactguru.com'),
  -- Admin (CEO + VP Tech)
  ('sahil@carepalmoney.com',               'Sahil Lakshmanan',    'admin',    'carepalmoney.com'),
  ('sujeet.yadav@impactguru.com',          'Sujeet Yadav',        'admin',    'impactguru.com'),
  -- National Head / National Sales Head
  ('rashi.kharari@impactguru.com',         'Rashi',               'approver', 'impactguru.com'),
  ('neer.samtani@impactguru.com',          'Neernidhi Samtani',   'approver', 'impactguru.com'),
  ('siddhartha.pathak@impactguru.com',     'Siddhartha Pathak',   'approver', 'impactguru.com'),
  -- Regional Heads
  ('lazar.fernando@impactguru.com',        'Lazar Desmond',       'approver', 'impactguru.com'),
  ('harish.goud@impactguru.com',           'Harish Goud',         'approver', 'impactguru.com'),
  ('ashutosh.sharma@impactguru.com',       'Ashutosh Sharma',     'approver', 'impactguru.com'),
  ('soundappan.gopal@impactguru.com',      'Soundappan Gopal',    'approver', 'impactguru.com'),
  ('abhishek.sah@carepalmoney.com',        'Abhishek Sah',        'approver', 'carepalmoney.com'),
  -- City Leads
  ('javeed.pasha@impactguru.com',          'Javeed Pasha',        'approver', 'impactguru.com'),
  ('toheed.shaikh@impactguru.com',         'Toheed Shaikh',       'approver', 'impactguru.com'),
  ('ranganath.hemanth@impactguru.com',     'Hemanth Ranganath',   'approver', 'impactguru.com'),
  ('sachin.savalkar@carepalmoney.com',     'Sachin Savalkar',     'approver', 'carepalmoney.com'),
  ('kiran.h@impactguru.com',               'Kiran',               'approver', 'impactguru.com'),
  ('sauravkumar.singh@impactguru.com',     'Saurav Kumar',        'approver', 'impactguru.com'),
  ('aman.kumar@impactguru.com',            'Aman Kumar',          'approver', 'impactguru.com'),
  ('mohammed.rafi@impactguru.com',         'Mohammed Rafi',       'approver', 'impactguru.com')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  domain = VALUES(domain),
  updated_at = NOW();

-- ─── Step 3: Verify ──────────────────────────────────────────────────────
SELECT role, COUNT(*) AS n FROM users GROUP BY role ORDER BY role;
-- Expected: admin=4, approver=16, ta=5
--   admin = Sahil Lakshmanan + Sujeet + Akhlaque + Jesse (gmail exception)
--   approver = 3 National + 5 Regional + 8 City Leads
--   ta = 4 master-sheet TAs + the TA Inbox shared mailbox

SELECT id, email, name, role FROM users ORDER BY role, email;
-- Expected: 25 rows total
```

---

## Section 2 — Verify Google auth is live

> **Already done as of May 2 2026** — Sahil signed in via the real Google OAuth flow on the live Cloud Run URL, which proves `AUTH_MODE=google` is set and `GOOGLE_CLIENT_ID` is correct. This section is now **verify-only** — re-run if you ever suspect prod has drifted back to `mock`.

### 2a. Verify command

```bash
gcloud run services describe carepal-hr-admin \
  --region asia-south1 \
  --project carepal-hr-admin \
  --format='yaml(spec.template.spec.containers[0].env)'
```

Expected: `AUTH_MODE: google` and a non-empty `GOOGLE_CLIENT_ID` (looks like `796536378060-….apps.googleusercontent.com`).

If `AUTH_MODE` is missing or `mock`, prod is currently trusting an unauthenticated `x-user-email` header — flip it back with:

```bash
gcloud run services update carepal-hr-admin \
  --region asia-south1 \
  --project carepal-hr-admin \
  --update-env-vars=AUTH_MODE=google
```

(If `GOOGLE_CLIENT_ID` is missing, set it via the same `--update-env-vars` flag before flipping `AUTH_MODE` — the backend boot crashes if google mode is set without a client ID per `carepal-backend/src/config.ts:18-27`. The OAuth client ID lives in GCP Console → APIs & Services → Credentials.)

### 2b. Smoke test (after Section 1)

1. Visit https://carepal-hr-admin-570605259097.asia-south1.run.app in a private/incognito window
2. Google sign-in screen appears (not a dev-mode header switcher)
3. Sign in with `sahil@carepalmoney.com`
4. Land on the Dashboard — no 401/403
5. Open *User Management* in the sidebar — should list all 23 users from Section 1. **If Sahil only saw 0 or 1 user before, that's the proof Section 1 hadn't run yet.**

If the Dashboard loads but `User Management` shows zero rows, the Section 1 SQL didn't actually commit — re-run it.

---

## Section 3 — Real data load

### 3a. Real requisitions (current open hiring)

The codebase already has an importer for the **GTM Hiring Tracker** xlsx Sahil shared earlier. It can either write to a local SQLite DB *or* emit a SQL file you paste into Cloud SQL Studio. Use the SQL mode for production:

```bash
cd carepal-backend
node scripts/import_hiring_tracker.mjs \
  --xlsx "/path/to/GTM - Hiring Tracker.xlsx" \
  --mode=sql \
  --sql-out=../personal/hiring-tracker.sql
```

Then open the generated `personal/hiring-tracker.sql` and paste its contents into Cloud SQL Studio. The script writes UPSERT-shaped statements so re-running is safe.

When Sahil refreshes the tracker (weekly, monthly, whenever), repeat the import to bring prod up to date.

### 3b. Real headcount targets (AOP)

Sahil sets these manually from the annual operating plan. **Easiest path is in-tool**, no SQL needed:

1. Sign in as Sahil (admin)
2. Open the Dashboard
3. Switch the BU filter to **CPM · Lending**
4. In the city table, click the small ✏️ pencil next to each city's *Target HC* cell, type the number, hit Enter
5. Repeat for the **IGIV · Crowdfunding** BU

If there are many cities and Sahil prefers a one-shot bulk load, send him this SQL template to fill in and we paste it into Cloud SQL Studio:

```sql
-- Bulk load AOP targets — fill in the numbers
INSERT INTO headcount (city, bu, aop) VALUES
  ('Bangalore', 'CPM',  /* number */),
  ('Bangalore', 'IGIV', /* number */),
  ('Mumbai',    'CPM',  /* number */),
  ('Mumbai',    'IGIV', /* number */),
  ('Delhi',     'CPM',  /* number */),
  ('Delhi',     'IGIV', /* number */),
  ('Chennai',   'CPM',  /* number */),
  ('Chennai',   'IGIV', /* number */),
  ('Hyderabad', 'CPM',  /* number */),
  ('Hyderabad', 'IGIV', /* number */)
ON DUPLICATE KEY UPDATE aop = VALUES(aop), updated_at = NOW();
```

### 3c. Real candidates (in-flight pipeline)

This is the data that doesn't have a clean source yet. Akhlaque's TA team is currently tracking candidates across WhatsApp / spreadsheets / inboxes. Two practical options:

| Option | What | Effort |
|---|---|---|
| **Bulk import** | Akhlaque exports the current pipeline as a single .xlsx with the columns the existing importer expects (`carepal-backend/src/routes/candidatesImport.ts` + `src/logic/candidateImport.ts` for column names), then admin uploads via the *Candidates → Import* button (or the API). | Half a day for Akhlaque to gather, minutes to import |
| **Cold start** | Don't backfill. From day 1 of using the tool, all NEW candidates go in via the tool. Existing in-flight candidates stay in WhatsApp/spreadsheets until they close out. | Zero, but the dashboard is misleading until the existing pipeline drains |

**Recommend**: bulk import. Tool's value comes from being a single source of truth — starting half-empty undermines that.

---

## Follow-ups (not blockers)

These came up while preparing the bootstrap and should be tracked separately:

### Stale hardcoded interviewer list

`carepal-backend/src/routes/interviewers.ts` hardcodes 7 interviewers (Himanshu Jaiswal, Khazim Syed, Lazer Rajan, Gaurav Sharma, Soundappan Gopal, Ankita Kumari, Bhavesh N). **Only Soundappan Gopal exists in the new master employee sheet.**

This affects the new mailto-invite flow (PR-G): when scheduling an interview with one of the stale interviewers, the email-lookup against the `users` table finds nothing and the candidate's email goes out alone (with a warning that the interviewer email is missing).

Three ways to fix, needs a decision from Sahil:

- (a) **Update the hardcoded list** to the master sheet's City Leads (R1) + Regional Heads (R2). Quick code change once Sahil maps "who interviews for which round, in which city."
- (b) **Add the missing interviewers** to the master sheet — if Himanshu, Khazim, etc. are still active staff who happen to be missing from the export
- (c) **Build a small Admin → Manage interviewers UI** so Sahil edits the list in-tool. Right thing long-term, but a real PR (~1 day).

Suggested next step: ask Sahil during the first real-use session who runs R1 and R2 interviews today, then pick (a), (b) or (c).

### Sahil's name

The master sheet has just `"Sahil"` (no last name). Honoring what Sahil sent. If the Dashboard / chips look weird without a surname, edit in *Admin → User Management* once signed in.

### Personal-account ownership of GCP project

`docs/PROJECT_OVERVIEW.md` flags that the `carepal-hr-admin` GCP project is currently owned by Jesse's personal Google account, not a CarePal Workspace org. Long-term concern, not blocking launch — covered by the documented "transfer to CarePal Workspace once their AWS account is ready" handover step.

---

## After this checklist runs cleanly

- The tool is **safely live** behind Google sign-in
- 23 real users exist; Sahil can sign in and see the User Management list
- Real requisitions + AOP targets are loaded; the Dashboard's StatCards reflect actual CarePal numbers
- Akhlaque can either start adding candidates fresh, or bulk-import what's already in flight
- You can hand the URL to Sahil for his first real-use session

**Then come the operational items** (monitoring, backups verification, GCP ownership transfer, any UX gaps surfaced during real use). Those don't block launch, but they're worth tackling in the week or two after.
