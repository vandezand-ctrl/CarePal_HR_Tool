import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listRequisitions,
  getRequisition,
  createRequisition,
  updateRequisition,
} from '../models/requisition.js';
import {
  createRequisitionSchema,
  updateRequisitionSchema,
} from '../schemas/requisition.js';
import { requireRole } from '../middleware/rbac.js';
import { getEffectiveCities } from '../middleware/cityScope.js';

export const requisitionsRouter = Router();

// GET /api/requisitions?bu=CPM&city=Bangalore&status=Active&hospital=...
requisitionsRouter.get('/api/requisitions', async (req, res, next) => {
  try {
    const { bu, city, hospital, status } = req.query;
    const cities = getEffectiveCities(req.user!);
    const rows = await listRequisitions({
      bu: typeof bu === 'string' ? bu : undefined,
      city: typeof city === 'string' ? city : undefined,
      hospital: typeof hospital === 'string' ? hospital : undefined,
      status: typeof status === 'string' ? status : undefined,
      cities: cities ?? undefined,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/requisitions/:id
requisitionsRouter.get('/api/requisitions/:id', async (req, res, next) => {
  try {
    const row = await getRequisition(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

// POST /api/requisitions
// City heads and regional heads (approvers) raise requisitions. Admin allowed via rbac fallback.
requisitionsRouter.post(
  '/api/requisitions',
  requireRole('approver'),
  async (req, res, next) => {
    try {
      const input = createRequisitionSchema.parse(req.body);
      // raisedBy comes from the authenticated user, not the client payload.
      const created = await createRequisition({ ...input, raisedBy: req.user!.name });
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

// PATCH /api/requisitions/:id
// Approver or admin required for status changes.
// Approval flow: only approver/admin can move a req to Approved/Active/Filled.
requisitionsRouter.patch(
  '/api/requisitions/:id',
  requireRole('approver'),
  async (req, res, next) => {
    try {
      const input = updateRequisitionSchema.parse(req.body);
      const updated = await updateRequisition(req.params.id, input);
      if (!updated) return res.status(404).json({ error: 'Not found' });
      return res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

// Error handler — Express recognizes 4-arg signature as error middleware.
requisitionsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[requisitions]', err);
  res.status(500).json({ error: 'Internal server error' });
});
