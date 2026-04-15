import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
} from '../models/candidate.js';
import { getRequisition } from '../models/requisition.js';
import { createCandidateSchema, updateCandidateSchema } from '../schemas/candidate.js';

export const candidatesRouter = Router();

// GET /api/candidates?bu=CPM&reqId=REQ-001&stage=Sourced&city=Bangalore
candidatesRouter.get('/api/candidates', async (req, res, next) => {
  try {
    const { bu, reqId, stage, city } = req.query;
    const rows = await listCandidates({
      bu: typeof bu === 'string' ? bu : undefined,
      reqId: typeof reqId === 'string' ? reqId : undefined,
      stage: typeof stage === 'string' ? stage : undefined,
      city: typeof city === 'string' ? city : undefined,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/candidates/:id
candidatesRouter.get('/api/candidates/:id', async (req, res, next) => {
  try {
    const row = await getCandidate(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

// POST /api/candidates
// Any authenticated user can add a candidate (TA primarily, but approvers/admin too).
candidatesRouter.post('/api/candidates', async (req, res, next) => {
  try {
    const input = createCandidateSchema.parse(req.body);
    // Normalize empty-string email to null
    const normalizedEmail = input.email === '' ? null : input.email ?? null;
    // Verify FK: req must exist
    const req_ = await getRequisition(input.reqId);
    if (!req_) return res.status(400).json({ error: `Requisition ${input.reqId} not found` });
    const created = await createCandidate({ ...input, email: normalizedEmail });
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    return next(err);
  }
});

// PATCH /api/candidates/:id
candidatesRouter.patch('/api/candidates/:id', async (req, res, next) => {
  try {
    const input = updateCandidateSchema.parse(req.body);
    const updated = await updateCandidate(req.params.id, input);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    return next(err);
  }
});

// Error handler
candidatesRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[candidates]', err);
  res.status(500).json({ error: 'Internal server error' });
});
