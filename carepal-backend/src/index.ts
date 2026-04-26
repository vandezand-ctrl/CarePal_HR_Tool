import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { runMigrations } from './db/index.js';
import { requireAuth } from './middleware/auth.js';
import { healthRouter } from './routes/health.js';
import { docsRouter } from './routes/docs.js';
import { meRouter } from './routes/me.js';
import { usersRouter } from './routes/users.js';
import { requisitionsRouter } from './routes/requisitions.js';
import { candidatesRouter } from './routes/candidates.js';
import { candidatesImportRouter } from './routes/candidatesImport.js';
import { interviewsRouter } from './routes/interviews.js';
import { interviewersRouter } from './routes/interviewers.js';
import { headcountRouter } from './routes/headcount.js';
import { documentsRouter } from './routes/documents.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();

app.use(
  cors({
    origin: true, // reflect request origin (localhost:5173 etc.)
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-user-email', 'Authorization'],
  }),
);
app.use(express.json());

// Public — no auth required
app.use(healthRouter);
app.use(docsRouter);

// Everything under /api/* requires authentication. Behavior depends on
// config.authMode: 'mock' uses x-user-email header (dev/CI), 'google' verifies
// a Google ID token from Authorization: Bearer <id_token> (prod).
app.use('/api', requireAuth());
app.use(meRouter);
app.use(usersRouter);
app.use(requisitionsRouter);
app.use(candidatesRouter);
app.use(candidatesImportRouter);
app.use(interviewsRouter);
app.use(interviewersRouter);
app.use(headcountRouter);
app.use(documentsRouter);
app.use(dashboardRouter);

// In production, serve the built frontend (frontend/dist/) as static files,
// and fall back to index.html for unmatched routes (SPA routing).
// Detected by the presence of a `public/` directory next to the compiled
// backend — the Dockerfile copies the frontend build there.
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // SPA fallback for any non-API, non-health, non-docs route
  app.get(/^(?!\/api|\/health|\/api\/docs).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  console.log(`[carepal-backend] serving static frontend from ${publicDir}`);
}

async function start(): Promise<void> {
  // Run migrations on startup so Cloud Run instances self-configure against
  // a fresh Cloud SQL database (idempotent — knex.migrate.latest is safe).
  if (process.env.DATABASE_URL) {
    console.log('[carepal-backend] running migrations…');
    await runMigrations();
    console.log('[carepal-backend] migrations applied');
  }

  app.listen(config.port, () => {
    console.log(`[carepal-backend] listening on http://localhost:${config.port}`);
    console.log(`[carepal-backend] env: ${config.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error('[carepal-backend] failed to start:', err);
  process.exit(1);
});
