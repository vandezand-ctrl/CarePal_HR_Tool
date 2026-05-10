# Migration Gotchas (SQLite dev → MySQL prod)

The backend uses **SQLite locally** and **MySQL 8 in production** (Cloud SQL). Knex migrations are written once and run against both, but the two databases disagree on a handful of important details. Migrations that pass tests locally can still fail on first deploy. This page is the catalog of what we have already hit, plus the patterns that prevent it.

---

## 1. `increments()` produces UNSIGNED columns in MySQL

`table.increments(''id'')` makes a column with type:

| Database | Type emitted |
|---|---|
| SQLite | `INTEGER PRIMARY KEY AUTOINCREMENT` (typeless) |
| MySQL | `int UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY` |

Any foreign key referencing such a column **must also be unsigned** in MySQL, or you get:

```
Error: alter table `documents` add constraint `documents_uploaded_by_user_id_foreign`
foreign key (`uploaded_by_user_id`) references `users` (`id`)
- Referencing column ''uploaded_by_user_id'' and referenced column ''id'' in foreign key constraint are incompatible.
errno: 3780, code: ''ER_FK_INCOMPATIBLE_COLUMNS''
```

SQLite is typeless, so the same migration runs cleanly there — the bug only surfaces in production.

**Fix:** add `.unsigned()` to every integer FK that references a `.increments()` column.

```js
// ❌ Local works, prod fails
table.integer(''uploaded_by_user_id'').references(''id'').inTable(''users'');

// ✅ Both
table.integer(''uploaded_by_user_id'').unsigned().references(''id'').inTable(''users'');
```

The canonical example in this repo is `migrations/20260415_006_create_documents.js` (commit `2dae5c9` retro-fixed it).

---

## 2. MySQL does not roll back DDL inside a transaction

Knex wraps each migration in a transaction by default. In SQLite that means a failed migration leaves the schema unchanged. In MySQL it does **not** — `CREATE TABLE` and `ALTER TABLE` auto-commit and survive an aborted transaction.

So if migration `006` does this:

```js
await knex.schema.createTable(''documents'', ...);   // creates the table
// ...some FK setup that fails...
```

…then on the next deploy you get:

```
Error: Table ''documents'' already exists  (errno 1050, code: ''ER_TABLE_EXISTS_ERROR'')
```

…because the table is there but `knex_migrations` has no row marking 006 as applied, so Knex tries to run it from scratch.

**Recovery options, in increasing surgical-ness:**

1. **Drop and recreate the database** (easiest before there is real data). Cloud SQL → `carepal-db` → Databases → delete `carepal` → Create database `carepal`. Re-run the deploy.
2. **Drop the orphan tables manually**, then redeploy. Cloud SQL Studio → run `DROP TABLE documents;` (or whichever table the failed migration created), then deploy.
3. **Hand-mark the migration as applied** by inserting a row into `knex_migrations` with the migration filename. Only do this if the schema state is actually correct.

**Prevention:** keep migrations small (one logical change per file). When a migration creates multiple objects, write them so that the ones likely to fail (FKs, complex constraints) come first — that way a failure does not leave behind a half-built table.

---

## 3. `mysql2` URL parameter is `socketPath`, not `socket`

When connecting from Cloud Run to Cloud SQL via the Unix socket (`/cloudsql/PROJECT:REGION:INSTANCE`), the `DATABASE_URL` must use `?socketPath=`:

```
✅ mysql://user:pass@localhost/db?socketPath=/cloudsql/PROJECT:REGION:INSTANCE
❌ mysql://user:pass@localhost/db?socket=/cloudsql/PROJECT:REGION:INSTANCE
```

If you use `socket=`, `mysql2` logs a warning (`Ignoring invalid configuration option passed to Connection: socket`) and falls back to TCP `localhost:3306` — which has nothing listening inside the container. Result:

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

…and Cloud Run reports the generic "container failed to start and listen on port 8080" error.

This is documented and demonstrated in [DEPLOY_TO_CLOUD_RUN.md](./DEPLOY_TO_CLOUD_RUN.md#troubleshooting); fixed in the deploy guide as part of the Apr 19 first deploy.

---

## 4. Production seeds do not run automatically

`src/index.ts` runs `knex.migrate.latest()` on startup but deliberately does **not** run seeds — production should not lose data on every redeploy. So a fresh prod database has the right schema but zero rows.

Symptom: the frontend defaults the user-switcher to `akhlaque@carepalmoney.com`, the backend looks that user up in an empty `users` table, returns 401, and every page shows `No user found for email: ...`.

**Fix:** insert at least one user via Cloud SQL Studio. Full SQL is in [DEPLOY_TO_CLOUD_RUN.md → First-deploy bootstrap](./DEPLOY_TO_CLOUD_RUN.md#first-deploy-bootstrap-production-db-starts-empty).

---

## 5. `db:reset` cannot rollback when FKs span migrations (SQLite)

The original `db:reset` script was `migrate:rollback --all && migrate:latest && seed:run`. When PR-K added the `applications` table (with FKs to `users.id` and `candidates.id`), the rollback step started failing on existing local SQLite databases:

```
SqliteError: DROP TABLE "users" - FOREIGN KEY constraint failed
```

Knex tries to drop tables in reverse migration order, but SQLite's FK enforcement (when `PRAGMA foreign_keys = ON`) refuses to drop a parent table while child rows still hold references. Because rollback runs each `down()` migration in its own transaction with FKs on, the sequence trips on tables added in later migrations that reference earlier ones.

**Fix (PR-K, May 2026):** rewrote `db:reset` to delete the SQLite file outright before re-running migrations:

```json
"db:reset": "node -e \"try{require('fs').unlinkSync('data/carepal.sqlite')}catch{}\" && knex migrate:latest && knex seed:run"
```

This is local-only — production uses `migrate:latest` on every deploy without rollback. If you ever need to truly roll back in dev, delete the file manually and re-migrate.

---

## 6. Other MySQL 8 / SQLite differences worth keeping in mind

These have not yet bitten us, but they are the next class of bugs to expect:

| Difference | SQLite behaviour | MySQL 8 behaviour | Mitigation |
|---|---|---|---|
| Default string length | TEXT (unbounded) | `varchar(255)` from `.string()` | Use `.string(col, length)` when you need more than 255 chars; use `.text(col)` for free-form long fields |
| Strict mode on insert | lax — SQLite stores anything, even type-mismatched data | strict — rejects bad types, missing required columns | Mirror MySQL strictness in tests; do not rely on SQLite''s leniency |
| `ON DELETE CASCADE` | enforced only if `PRAGMA foreign_keys = ON` is set | always enforced | Be explicit with `.onDelete(''CASCADE'')` in every FK |
| Boolean type | stored as `0`/`1` integer | `tinyint(1)` from `.boolean()` | Read code that compares to `true`/`1` should work; do not compare to `''true''`/`''false''` strings |
| `JSON` columns | stored as TEXT | proper `JSON` column type | Use `.json()` consistently; avoid hand-rolled JSON serialization |
| Case-insensitive collation | depends on collation | usually `utf8mb4_0900_ai_ci` (case-insensitive) | Do not rely on case-sensitive uniqueness; lowercase emails before storing |

---

## 7. `knex.raw()` result shape differs between SQLite and MySQL

`knex.raw('SELECT ...')` returns **different shapes** depending on the driver:

| Database | Return value |
|---|---|
| SQLite (`better-sqlite3`) | `[{col: val}, {col: val}, ...]` — a plain array of row objects |
| MySQL (`mysql2`) | `[[{col: val}, ...], [fieldDef, ...]]` — a tuple of `[rows, fields]` |

Both are arrays, so `Array.isArray(result)` returns `true` for both — but iterating the outer array on MySQL gives you `[rows_array, fields_array]` instead of individual row objects. Any `.map(r => r.someColumn)` silently produces `undefined` values, which Knex sends to MySQL as `DEFAULT`, triggering:

```
ER_NO_DEFAULT_FOR_FIELD: Field 'city' doesn't have a default value
```

**Pattern that works for both:**

```js
const raw = await knex.raw('SELECT city FROM ...');
// If the first element is an array, we're on MySQL — unwrap.
const rows = Array.isArray(raw[0]) ? raw[0] : raw;
const cities = rows.map(r => r.city);
```

The canonical example is `migrations/20260510_019_backfill_user_cities.js` and `src/models/userCity.ts` (PR-P, commit `17b2b53`).

**Prefer the query builder** (`knex('table').select(...)`) over `knex.raw()` whenever possible — the builder returns rows directly regardless of driver.

---

## When you write a new migration

A short pre-flight checklist:

1. Every integer FK to an `.increments()` column has `.unsigned()`.
2. The migration is idempotent enough that re-running it on a partially-applied database fails clearly (better: keep them tiny so partial application is unlikely).
3. Strings that may exceed 255 chars use `.text()` or an explicit length.
4. Delete cascades are explicit (`.onDelete(''CASCADE'')`).
5. Run the migration **against MySQL** at least once before merging to `main`. The fastest way: spin up a local MySQL via Docker and point `DATABASE_URL` at it for one test run.
6. If using `knex.raw()`, unwrap the MySQL `[rows, fields]` tuple — see gotcha #7 above.
