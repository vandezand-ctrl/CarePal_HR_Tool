import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { mockAuth } from './middleware/auth.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { requisitionsRouter } from './routes/requisitions.js';
import { candidatesRouter } from './routes/candidates.js';
import { candidatesImportRouter } from './routes/candidatesImport.js';
import { interviewsRouter } from './routes/interviews.js';
import { interviewersRouter } from './routes/interviewers.js';
import { headcountRouter } from './routes/headcount.js';

const app = express();

app.use(
  cors({
    origin: true, // reflect request origin (localhost:5173 etc.)
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-user-email'],
  }),
);
app.use(express.json());

// Public — no auth required
app.use(healthRouter);

// Everything under /api/* requires mock auth
app.use('/api', mockAuth);
app.use(meRouter);
app.use(requisitionsRouter);
app.use(candidatesRouter);
app.use(candidatesImportRouter);
app.use(interviewsRouter);
app.use(interviewersRouter);
app.use(headcountRouter);

app.listen(config.port, () => {
  console.log(`[carepal-backend] listening on http://localhost:${config.port}`);
  console.log(`[carepal-backend] env: ${config.nodeEnv}`);
});
