# Deploy to Google Cloud Run — Setup Guide

One-time setup for deploying the app to Cloud Run with a Cloud SQL MySQL
backing store. Expected time: **30–45 minutes** if this is your first GCP
project. Most of it is waiting for resources to provision.

When done, every push to `main` (or manual run of the workflow) will build
the image and deploy automatically.

---

## Prerequisites

- A Google account with billing enabled (or trial credits)
- Repo admin access to add GitHub secrets
- The `gcloud` CLI installed locally is **optional** — the guide uses the web console for every step

---

## 1. Create the GCP project

1. Open the [Google Cloud Console](https://console.cloud.google.com/)
2. Top bar → project dropdown → **New Project**
3. Name: `carepal-hr-admin` (or similar). Note the **Project ID** (auto-suggested slug)
4. Link it to your billing account

> **Save the Project ID** — you'll need it as a GitHub secret later.

## 2. Enable the required APIs

In the console, go to **APIs & Services → Library**, then enable each of:

- **Cloud Run Admin API** (`run.googleapis.com`)
- **Cloud SQL Admin API** (`sqladmin.googleapis.com`)
- **Artifact Registry API** (`artifactregistry.googleapis.com`)
- **Secret Manager API** (`secretmanager.googleapis.com`)
- **Cloud Build API** (`cloudbuild.googleapis.com`) — used by Cloud Run builds

Or run once:
```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

## 3. Create the Artifact Registry repository

This is where Docker images get pushed.

1. **Artifact Registry → Repositories → Create Repository**
2. Name: `carepal-hr-admin`
3. Format: **Docker**
4. Location type: **Region**
5. Region: `asia-south1` (Mumbai — closest to CarePal users)
6. Click **Create**

Or CLI:
```bash
gcloud artifacts repositories create carepal-hr-admin \
  --repository-format=docker \
  --location=asia-south1
```

## 4. Create the Cloud SQL MySQL instance

1. **SQL → Create Instance → MySQL**
2. Instance ID: `carepal-db`
3. Choose a **root password** (save it — needed below)
4. Database version: **MySQL 8.0**
5. Region: `asia-south1` (match Cloud Run region)
6. Zonal availability: **Single zone** (cheapest; Zonal HA for prod if you want)
7. Machine type: **Shared core → db-f1-micro** (~$7/mo)
8. Storage: 10 GB SSD, enable auto-increase
9. **Create Instance** — takes ~5 min

Once created, open the instance:

1. **Databases tab → Create Database**
   - Name: `carepal`
2. **Users tab → Add User Account**
   - Username: `carepal_app`
   - Password: (generate a strong one, save it)
   - Host: `%` (any host — we'll restrict via Cloud Run connector)

> **Save these three values:**
> - The **Connection name** (looks like `project-id:asia-south1:carepal-db`) — shown on the instance's Overview page
> - `carepal_app` **password**
> - Database name: `carepal`

## 5. Store the DATABASE_URL in Secret Manager

Cloud Run reads this secret at runtime so it never sits in environment variables in the clear.

1. **Security → Secret Manager → Create Secret**
2. Name: `DATABASE_URL`
3. Secret value:
   ```
   mysql://carepal_app:YOUR_PASSWORD@localhost/carepal?socketPath=/cloudsql/PROJECT_ID:asia-south1:carepal-db
   ```
   Replace `YOUR_PASSWORD` and `PROJECT_ID`. The `?socketPath=` parameter is how Cloud Run + Cloud SQL proxy connect — the `localhost` host is a convention.

   > ⚠️ **Use `socketPath`, not `socket`.** `mysql2` (the driver Knex uses here) only recognizes `socketPath` as a query parameter; passing `socket` will be silently ignored and the driver falls back to TCP `localhost:3306`, which has nothing listening inside the container. The container will fail with `ECONNREFUSED 127.0.0.1:3306` and Cloud Run reports "container failed to start and listen on port 8080". See troubleshooting below.
4. **Create Secret**

## 6. Create a deploy service account

This is the identity GitHub Actions uses to push images and trigger deploys.

1. **IAM & Admin → Service Accounts → Create Service Account**
2. Name: `github-deploy`
3. Grant these roles:
   - **Cloud Run Admin** (`roles/run.admin`)
   - **Artifact Registry Writer** (`roles/artifactregistry.writer`)
   - **Cloud SQL Client** (`roles/cloudsql.client`)
   - **Service Account User** (`roles/iam.serviceAccountUser`)
   - **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`)
4. Click **Done**
5. Open the service account → **Keys tab → Add Key → Create new key → JSON**
6. A `.json` file downloads — keep it safe, you'll paste its contents into GitHub in step 7.

## 7. Add the three GitHub repo secrets

Go to your repo on GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Add:

| Secret name | Value |
|---|---|
| `GCP_PROJECT_ID` | Your project ID from step 1 (e.g. `carepal-hr-admin-123456`) |
| `GCP_SA_KEY` | The **entire contents** of the JSON key file from step 6 (copy-paste, including the `{` and `}`) |
| `CLOUD_SQL_CONNECTION_NAME` | The connection name from step 4 (e.g. `project-id:asia-south1:carepal-db`) |

## 8. Grant the Cloud Run runtime service account access to the secret

Cloud Run runs containers under its own default service account (different from the deploy one). That runtime account needs permission to read `DATABASE_URL`.

1. **IAM & Admin → IAM**
2. Find the entry for `PROJECT_NUMBER-compute@developer.gserviceaccount.com` (that's the default Compute Engine service account, used by Cloud Run)
3. Edit → add role **Secret Manager Secret Accessor**
4. Save

(If you prefer a dedicated runtime SA, that's cleaner — but the default works for now.)

## 9. Trigger the first deploy

You have two options:

**Option A — manual**
1. Go to your GitHub repo → **Actions → Deploy to Cloud Run → Run workflow → Run workflow**
2. Watch the logs

**Option B — auto, on push**
The workflow is already wired to `push: branches: [main]`. Just merge anything to `main` and it deploys.

The first build takes ~3–5 minutes. On success, the job's logs print the deployed URL, something like:
```
https://carepal-hr-admin-xxxx-as.a.run.app
```

## 10. Verify

Open the URL. You should see:

- `GET /` → the CarePal HR Admin frontend
- `GET /health` → `{"ok":true,...}`
- `GET /api/docs` → the Swagger UI
- Login as any seeded user by setting the `x-user-email` header (the frontend's dev user-switcher already handles this)

> ⚠️ **On first deploy, the MySQL DB is empty.** Migrations run automatically on server startup, so the 6 tables are created. But **seed data is NOT loaded** (that's dev-only — we don't want to wipe and re-seed prod on every deploy). If you need sample data, you can either:
> - SSH into the Cloud SQL proxy from your laptop and run `npm run seed` locally pointing at the Cloud SQL URL, or
> - Import candidates via the app's own spreadsheet-import UI (Stage 6)

## Costs (rough monthly)

| Resource | Tier | Cost |
|---|---|---|
| Cloud Run | Free tier covers ~2M requests/mo | $0 for demo traffic |
| Cloud SQL (db-f1-micro) | Shared core, 10 GB SSD | ~$7/mo |
| Artifact Registry | First 500 MB free | $0 |
| Secret Manager | First 6 secrets free | $0 |
| Egress to user | | negligible |

**Total for demo/staging: ~$7/month**

To stop the bill entirely: pause the Cloud SQL instance (Overview → Pause). Everything else is free-tier.

---

## First-deploy bootstrap (production DB starts empty)

Migrations run automatically on every container start (idempotent), but **seed data is NOT loaded in production** — that is dev-only behaviour. The first time you load the app it will show errors like `No user found for email: ...` because the `users` table has zero rows and the frontend default user-switcher email does not match anyone.

To get past this, insert at least one user via [Cloud SQL Studio](https://console.cloud.google.com/sql/instances/carepal-db/studio):

1. Open the studio, log in as `carepal_app` against the `carepal` database (password from the `DATABASE_URL` secret).
2. Run:
   ```sql
   INSERT INTO users (email, name, role, city, domain, created_at, updated_at) VALUES
     (''akhlaque@carepalmoney.com'', ''Akhlaque Khan'', ''ta'', NULL, ''carepalmoney.com'', NOW(), NOW()),
     (''sahil@carepalmoney.com'',     ''Sahil Kumar'',   ''admin'', NULL, ''carepalmoney.com'', NOW(), NOW()),
     (''YOUR_EMAIL@bopinc.org'',      ''Your Name'',     ''admin'', NULL, ''bopinc.org'',       NOW(), NOW());
   ```
3. Refresh the app. The errors disappear; use the Header user-switcher to pick yourself.

For a fuller seeding pass (all 18 dev users + sample requisitions/candidates), use the Cloud SQL Auth Proxy from your laptop and run `npm run seed` against the prod `DATABASE_URL`. Or just import candidates via the Stage 6 spreadsheet UI.

---

## Troubleshooting

### Deploy fails with "Permission denied" on Artifact Registry
The `github-deploy` service account is missing the **Artifact Registry Writer** role. Re-check step 6.

### Container failed to start, logs show `ECONNREFUSED 127.0.0.1:3306`
The `DATABASE_URL` secret uses `?socket=` instead of `?socketPath=`. `mysql2` ignores the `socket` parameter and falls back to TCP, which has nothing to connect to inside the container. Update the secret in Secret Manager (add a new version) with `?socketPath=/cloudsql/PROJECT_ID:asia-south1:carepal-db`, then re-run the deploy workflow.

### Migration fails with `Table ''X'' already exists`
A previous deploy ran migrations partially: it created tables in the database but then a later migration step failed, so Knex never marked the migration as "applied" in `knex_migrations`. MySQL does **not** roll back DDL inside transactions, so the half-created tables stick around. Easiest recovery: delete and recreate the empty `carepal` database (Cloud SQL → carepal-db → Databases → delete `carepal` → Create), then re-run the deploy. Surgical alternative: connect via Cloud SQL Studio and either drop the orphan tables, or insert rows into `knex_migrations` to mark the partially-applied migrations as done.

### Migration fails with `FK constraint incompatible columns` (errno 3780, ER_FK_INCOMPATIBLE_COLUMNS)
`Knex.increments()` produces `int UNSIGNED` columns in MySQL. Foreign keys referencing those columns must also be `unsigned`, otherwise MySQL 8 rejects the FK with "Referencing column and referenced column are incompatible". SQLite is typeless so the same migration runs cleanly locally. Fix: add `.unsigned()` to the integer FK column in the migration file, drop+recreate the prod database, redeploy. See `migrations/20260415_006_create_documents.js` for the canonical pattern.

### Cloud Run starts but immediately crashes with "can't connect to MySQL"
- The `--add-cloudsql-instances` flag needs the connection name from step 4
- `DATABASE_URL` must use the `?socket=/cloudsql/PROJECT_ID:REGION:INSTANCE` path (not a host+port)
- Check that the Cloud SQL Admin API is enabled (step 2)

### Cloud Run returns 500 on every request after deploy
- Check logs: **Cloud Run → carepal-hr-admin → Logs tab**
- Migrations may have failed — look for `[carepal-backend] running migrations…` in the logs
- If the first migration ran partially, you may need to drop and recreate the `carepal` database once

### Frontend loads but `/api/*` calls fail with HTML instead of JSON
The SPA fallback regex isn't excluding `/api` — verify it matches `/^(?!\/api|\/health|\/api\/docs).*/` in `carepal-backend/src/index.ts`.

### `/api/docs` returns "file not found"
The build step didn't copy `openapi.yaml` into `dist/`. Check `carepal-backend/package.json`'s `build` script runs the `copyFileSync`.

---

## What to swap later (when Sujeet's AWS is ready)

| What changes | How |
|---|---|
| DB host | Update the `DATABASE_URL` secret in Secret Manager to point at AWS RDS MySQL instead of Cloud SQL |
| Storage (Stage 7) | Replace `carepal-backend/src/services/storage.ts` with an S3 implementation |
| Auth (Stage 2) | Replace `carepal-backend/src/middleware/auth.ts` with Google OAuth verification |

No other code changes, no migrations, no redeploy pipeline changes. The Dockerfile and Cloud Run config stay the same.
