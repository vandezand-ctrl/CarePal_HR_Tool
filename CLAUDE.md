# CarePal HR Admin — Claude guide

Internal hiring-management tool for CarePal Money's TA team. See [README.md](README.md) and [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the full project brief, stack, and how to run locally.

This file is the operating manual for Claude Code sessions on this repo. Read it before making changes.

## Repo layout (quick reference)

- Frontend: React + Vite, single-file `src/App.jsx` (~2,000 lines), other top-level files for `Login`, `UserManagement`, `ScheduleInterviewModal`, `Search`, `DataContext`, `api.js`
- Backend: Node + Express + TypeScript at `carepal-backend/`. Knex migrations under `carepal-backend/migrations/`
- DB: SQLite locally (`carepal-backend/data/`), Cloud SQL MySQL in production
- Deployed: Cloud Run, asia-south1 — `https://carepal-hr-admin-570605259097.asia-south1.run.app`

## Testing & test discipline

The tool is in beta with real users (Akhlaque @ ImpactGuru, Sahil @ CarePal Money). Every code change must keep the regression net intact.

### Hard rules

1. **Backend route changes require a route test update.** Touch any file in `carepal-backend/src/routes/*.ts`? Add or update the matching `*.test.ts` (route file `foo.ts` → test file `foo.test.ts` in the same directory) before finishing.
2. **Frontend section changes require a Playwright smoke update.** Touch `src/App.jsx`, `src/Login.jsx`, `src/UserManagement.jsx`, `src/ScheduleInterviewModal.jsx`, `src/Search.jsx`, `src/DataContext.jsx`, or `src/api.js`? Add or update an `e2e/*.spec.ts` before finishing.
3. **Tests must pass locally before push.** Run `cd carepal-backend && npm test` and `npm run test:e2e` at repo root. CI will block the merge if either fails.

### How tests are organised

- **Backend unit/integration**: `carepal-backend/src/**/*.test.ts` runs via `npm test` (uses node:test built-in, plus an in-memory SQLite DB per test file). The patterns to copy from:
  - [carepal-backend/src/routes/users.test.ts](carepal-backend/src/routes/users.test.ts) — basic GET/PATCH + RBAC
  - [carepal-backend/src/routes/interviews.test.ts](carepal-backend/src/routes/interviews.test.ts) — multi-table seeding + state-machine flows
- **Frontend smoke (Playwright)**: `e2e/*.spec.ts` runs via `npm run test:e2e` at repo root. Each section of the app has one spec file. Playwright's `webServer` config boots the backend (port 3000) and the frontend (Vite, port 5173) automatically.

### Stop hook

`.claude/hooks/check-tests.mjs` runs on every Claude `Stop` event. It walks `git diff` (committed + staged + unstaged + untracked) and refuses to let Claude finish if a route or section file was changed without a corresponding test. Override only when explicitly justified — and document the override in the PR description.

The hook is registered in [.claude/settings.json](.claude/settings.json) and is checked into git so every contributor's local Claude session enforces it.

### What to do when the hook blocks you

It's telling you a regression net is missing. Two options:

1. Add the test (correct path 99% of the time). Use the existing test pattern; don't invent a new one.
2. If the change really doesn't need a test (e.g. comment-only edit, README change that nonetheless touched a watched file because of a co-located doc) — say so out loud in the PR description and have the user override. Don't silently disable the hook.

### Adding new files to the watched lists

If a new top-level frontend section file is added (e.g. `src/Reports.jsx`), update both:
- The `FRONTEND_FILES` set in [.claude/hooks/check-tests.mjs](.claude/hooks/check-tests.mjs)
- This CLAUDE.md section

## Working style

- Non-technical user (Jesse). Clear, concise communication. Pasted commands one at a time (Windows PowerShell 5.1 — see [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for shell quirks).
- All changes via PR (no direct pushes to `main`). Use `gh pr create`.
- Production deploys are handled by GitHub Actions on merge to `main` — don't deploy manually.

## Backlog

The active beta-feedback backlog lives in `../Bopinc_RP_Tool/hr-tool-backlog.md` (sibling repo, where Jesse keeps cross-project notes). When working through backlog points, follow the **change + tests** pattern above — every PR opens a backlog item and closes it with code, tests, and a working demo.
