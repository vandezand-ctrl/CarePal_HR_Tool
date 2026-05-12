import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listCandidates,
  getCandidate,
  createCandidate,
  updateCandidate,
  offerCandidate,
  recordJoin,
  startTraining,
  markActive,
} from '../models/candidate.js';
import { getRequisition } from '../models/requisition.js';
import { getUserById } from '../models/user.js';
import { setAssignments } from '../models/assignment.js';
import {
  createCandidateSchema,
  updateCandidateSchema,
  offerCandidateSchema,
  recordJoinSchema,
} from '../schemas/candidate.js';
import { requireRole } from '../middleware/rbac.js';

/**
 * PR-L: validate that every TA id resolves to a user with role 'ta' or
 * 'admin'. Approvers cannot be assigned. Returns null on success or an
 * error message on the first invalid id.
 */
async function validateTaIds(taIds: number[]): Promise<string | null> {
  for (const id of taIds) {
    const u = await getUserById(id);
    if (!u) return `User id ${id} not found`;
    if (u.role !== 'ta' && u.role !== 'admin') {
      return `User '${u.name}' (role ${u.role}) cannot be assigned to a candidate`;
    }
  }
  return null;
}

import { getEffectiveCities } from '../middleware/cityScope.js';

export const candidatesRouter = Router();

// GET /api/candidates?bu=CPM&reqId=REQ-001&stage=Sourced&city=Bangalore
candidatesRouter.get('/api/candidates', async (req, res, next) => {
  try {
    const { bu, reqId, stage, city } = req.query;
    const cities = getEffectiveCities(req.user!);
    const rows = await listCandidates({
      bu: typeof bu === 'string' ? bu : undefined,
      reqId: typeof reqId === 'string' ? reqId : undefined,
      stage: typeof stage === 'string' ? stage : undefined,
      city: typeof city === 'string' ? city : undefined,
      cities: cities ?? undefined,
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
// PR-L: requires `taIds` (>=1 user IDs, all role ta or admin).
candidatesRouter.post('/api/candidates', async (req, res, next) => {
  try {
    const input = createCandidateSchema.parse(req.body);
    // Normalize empty-string email to null
    const normalizedEmail = input.email === '' ? null : input.email ?? null;
    // Verify FK: req must exist
    const req_ = await getRequisition(input.reqId);
    if (!req_) return res.status(400).json({ error: `Requisition ${input.reqId} not found` });
    // PR-L: validate every taId resolves to a ta/admin user.
    const taErr = await validateTaIds(input.taIds);
    if (taErr) return res.status(400).json({ error: taErr });
    const created = await createCandidate(
      { ...input, email: normalizedEmail },
      req.user?.id ?? null,
    );
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
    // C1: re-tagging to a different requisition requires that the new req
    // exists. Mirror the same FK check used by POST /api/candidates.
    if (input.reqId !== undefined) {
      const newReq = await getRequisition(input.reqId);
      if (!newReq) return res.status(400).json({ error: `Requisition ${input.reqId} not found` });
    }
    // PR-L: assignment changes (`taIds`) — relaxed permission rules.
    // Any TA or admin can add/remove anyone (TA or admin) from any candidate
    // at any time. Approvers stay locked out. The PR-J.5 "you can only
    // reassign candidates you currently own" rule is removed because
    // multi-assignment makes it incoherent.
    if (input.taIds !== undefined) {
      const target = await getCandidate(req.params.id);
      if (!target) return res.status(404).json({ error: 'Not found' });
      const caller = req.user!;
      if (caller.role === 'approver') {
        return res.status(403).json({ error: 'Approvers cannot change candidate assignments' });
      }
      const taErr = await validateTaIds(input.taIds);
      if (taErr) return res.status(400).json({ error: taErr });
      await setAssignments(req.params.id, input.taIds, caller.id);
    }
    // Non-assignment fields update through the candidates row patch.
    // Build a copy without `taIds` so updateCandidate doesn't see it.
    const { taIds: _ignore, ...rest } = input;
    void _ignore;
    if (Object.keys(rest).length > 0) {
      const updated = await updateCandidate(req.params.id, rest);
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    }
    // taIds-only PATCH: just return the refreshed candidate.
    const fresh = await getCandidate(req.params.id);
    if (!fresh) return res.status(404).json({ error: 'Not found' });
    return res.json(fresh);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    return next(err);
  }
});

// POST /api/candidates/:id/offer — extend an offer. Transitions R1/R2 Complete -> Offered.
candidatesRouter.post('/api/candidates/:id/offer', requireRole('approver'), async (req, res, next) => {
  try {
    const { offerDate } = offerCandidateSchema.parse(req.body);
    const updated = await offerCandidate(req.params.id, offerDate);
    return res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot make offer/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// POST /api/candidates/:id/join — record that the candidate has started. Offered -> Joined.
candidatesRouter.post('/api/candidates/:id/join', requireRole('approver'), async (req, res, next) => {
  try {
    const { joinDate } = recordJoinSchema.parse(req.body);
    const updated = await recordJoin(req.params.id, joinDate);
    return res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && /Cannot record join/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// POST /api/candidates/:id/start-training — Joined -> Training (PR-E / C3).
candidatesRouter.post('/api/candidates/:id/start-training', requireRole('approver'), async (req, res, next) => {
  try {
    const updated = await startTraining(req.params.id);
    return res.json(updated);
  } catch (err) {
    if (err instanceof Error && /Cannot start training/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// POST /api/candidates/:id/activate — Training -> Active (PR-E / C3).
// Drives the "Active Headcount" StatCard on the Dashboard.
candidatesRouter.post('/api/candidates/:id/activate', requireRole('approver'), async (req, res, next) => {
  try {
    const updated = await markActive(req.params.id);
    return res.json(updated);
  } catch (err) {
    if (err instanceof Error && /Cannot mark active/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && /not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// Error handler
candidatesRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[candidates]', err);
  res.status(500).json({ error: 'Internal server error' });
});
