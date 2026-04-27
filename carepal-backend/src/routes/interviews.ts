import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listInterviews,
  getInterview,
  scheduleInterview,
  recordInterviewResult,
  cancelInterview,
  type ListInterviewsFilters,
  type InterviewResult,
} from '../models/interview.js';
import {
  scheduleInterviewSchema,
  recordResultSchema,
  cancelInterviewSchema,
} from '../schemas/interview.js';

export const interviewsRouter = Router();

// Helpers — Express query strings are messy (string | string[] | parsed obj),
// so coerce defensively.
function strParam(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function boolParam(v: unknown): boolean | undefined {
  if (typeof v !== 'string') return undefined;
  return v.toLowerCase() === 'true';
}

function roundParam(v: unknown): 1 | 2 | undefined {
  if (v === '1') return 1;
  if (v === '2') return 2;
  return undefined;
}

function resultParam(v: unknown): ListInterviewsFilters['result'] | undefined {
  const allowed: ListInterviewsFilters['result'][] = [
    'Select', 'Reject', 'No-show', 'Scheduled',
  ];
  return typeof v === 'string' && (allowed as string[]).includes(v)
    ? (v as ListInterviewsFilters['result'])
    : undefined;
}

// GET /api/interviews
//   ?candidateId=C-001
//   &dateFrom=2026-04-01 &dateTo=2026-04-30
//   &round=1|2
//   &result=Select|Reject|No-show|Scheduled
//   &interviewerName=Soundappan%20Gopal
//   &includeCancelled=true|false  (default false)
interviewsRouter.get('/api/interviews', async (req, res, next) => {
  try {
    const rows = await listInterviews({
      candidateId: strParam(req.query.candidateId),
      dateFrom: strParam(req.query.dateFrom),
      dateTo: strParam(req.query.dateTo),
      round: roundParam(req.query.round),
      result: resultParam(req.query.result),
      interviewerName: strParam(req.query.interviewerName),
      includeCancelled: boolParam(req.query.includeCancelled),
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
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// PATCH /api/interviews/:id — record the Select/Reject/No-show result. Triggers stage transition.
interviewsRouter.patch('/api/interviews/:id', async (req, res, next) => {
  try {
    const { result } = recordResultSchema.parse(req.body);
    const interview = await recordInterviewResult(
      Number(req.params.id),
      result as InterviewResult,
    );
    return res.json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// DELETE /api/interviews/:id?reason=... — soft-cancel a scheduled interview.
// Reverts the candidate's pipeline stage by one step in the same transaction.
// Rejected (400) if the interview already has a recorded result — the audit
// trail of what actually happened wins over a soft delete.
interviewsRouter.delete('/api/interviews/:id', async (req, res, next) => {
  try {
    const { reason } = cancelInterviewSchema.parse({
      reason: strParam(req.query.reason),
    });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid interview id' });
    }
    const interview = await cancelInterview(id, reason);
    return res.json(interview);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot (schedule|record|cancel|make)/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /Cannot cancel an interview with a recorded result/.test(err.message)) {
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
