import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { listInterviews, getInterview, scheduleInterview, recordInterviewResult } from '../models/interview.js';
import { scheduleInterviewSchema, recordResultSchema } from '../schemas/interview.js';

export const interviewsRouter = Router();

// GET /api/interviews?candidateId=C-001
interviewsRouter.get('/api/interviews', async (req, res, next) => {
  try {
    const { candidateId } = req.query;
    const rows = await listInterviews({
      candidateId: typeof candidateId === 'string' ? candidateId : undefined,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/interviews/:id
interviewsRouter.get('/api/interviews/:id', async (req, res, next) => {
  try {
    const row = await getInterview(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

// POST /api/interviews — schedule or reschedule an interview (upsert on candidate + round).
// Triggers a candidate pipeline stage transition.
interviewsRouter.post('/api/interviews', async (req, res, next) => {
  try {
    const input = scheduleInterviewSchema.parse(req.body);
    const interview = await scheduleInterview(input);
    return res.status(201).json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// PATCH /api/interviews/:id — record the Select/Reject result. Triggers stage transition.
interviewsRouter.patch('/api/interviews/:id', async (req, res, next) => {
  try {
    const { result } = recordResultSchema.parse(req.body);
    const interview = await recordInterviewResult(Number(req.params.id), result);
    return res.json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

interviewsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[interviews]', err);
  res.status(500).json({ error: 'Internal server error' });
});
