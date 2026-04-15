# carepal-backend

Backend API for the CarePal HR Admin tool.

## Stack
- Node.js + Express + TypeScript
- ESLint + Prettier
- `tsx` for dev hot-reload
- Database: TBD (SQLite vs MySQL — decided in Stage 1)

## Setup

```bash
cd carepal-backend
npm install
cp .env.example .env.local
npm run dev
```

Server runs at http://localhost:4000.

## Scripts
- `npm run dev` — start with hot reload
- `npm run build` — compile TypeScript to `dist/`
- `npm run start` — run compiled build
- `npm run lint` — check code
- `npm run lint:fix` — auto-fix issues
- `npm run format` — format with Prettier
- `npm run typecheck` — type-check without emitting

## Verify Stage 0
```bash
curl http://localhost:4000/health
# {"ok":true,"uptime":...,"timestamp":"..."}
```

## Current Stage
Stage 0 — Foundation. See `.claude/plans/eager-nibbling-bear.md` for the full staged plan.
