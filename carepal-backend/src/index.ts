import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { cvParseRouter } from './routes/cvParse.js';
import { interviewsRouter } from './routes/interviews.js';
import { interviewersRouter } from './routes/interviewers.js';
import { headcountRouter } from './routes/headcount.js';
import { documentsRouter } from './routes/documents.js';
import { dashboardRouter } from './routes/dashboard.js';

const app = express();
app.set('trust proxy', true);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // Google Sign-In popup needs window communication
  }),
);

// Serve static frontend BEFORE CORS so that Vite's <script crossorigin>
// tags don't get blocked by the origin allowlist.
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log(`[carepal-backend] serving static frontend from ${publicDir}`);
}

const CLOUD_RUN_URL = 'https://carepal-hr-admin-570605259097.asia-south1.run.app';
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4000', CLOUD_RUN_URL];

app.use(
  cors({
    origin: (incoming, cb) => {
      if (!incoming || allowedOrigins.includes(incoming)) cb(null, true);
      else cb(new Error(`Origin ${incoming} not allowed by CORS`));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-user-email', 'Authorization'],
  }),
);
app.use(express.json());

if (config.nodeEnv === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
  app.use('/api', apiLimiter);
}

// Public — no auth required
app.use(healthRouter);

// Everything under /api/* requires authentication. Behavior depends on
// config.authMode: 'mock' uses x-user-email header (dev/CI), 'google' verifies
// a Google ID token from Authorization: Bearer <id_token> (prod).
app.use('/api', requireAuth());
app.use(docsRouter); // API docs now require authentication
app.use(meRouter);
app.use(usersRouter);
app.use(requisitionsRouter);
app.use(candidatesRouter);
app.use(candidatesImportRouter);
app.use(cvParseRouter);
app.use(interviewsRouter);
app.use(interviewersRouter);
app.use(headcountRouter);
app.use(documentsRouter);
app.use(dashboardRouter);

// Global fallback error handler — catches errors that slip past per-router handlers.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[carepal-backend] unhandled route error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA fallback — after all API routes so /api/* is handled first. The
// static middleware was registered earlier (before CORS) so assets are
// already served; this only catches client-side routes like /dashboard.
if (fs.existsSync(publicDir)) {
  app.get(/^(?!\/api|\/health|\/api\/docs).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
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

process.on('unhandledRejection', (reason) => {
  console.error('[carepal-backend] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[carepal-backend] uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  console.error('[carepal-backend] failed to start:', err);
  process.exit(1);
});
