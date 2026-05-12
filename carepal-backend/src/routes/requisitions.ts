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
import {
  createInitialApprovals,
  getApprovalsForRequisition,
  getApprovalsForRequisitions,
  recordApproval,
} from '../models/requisitionApproval.js';

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

    const ids = rows.map((r) => r.id);
    const approvalsMap = await getApprovalsForRequisitions(ids);
    const enriched = rows.map((r) => ({
      ...r,
      approvalPhases: approvalsMap.get(r.id) ?? [],
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// GET /api/requisitions/:id
requisitionsRouter.get('/api/requisitions/:id', async (req, res, next) => {
  try {
    const row = await getRequisition(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const cities = getEffectiveCities(req.user!);
    if (cities && !cities.includes(row.city)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const approvalPhases = await getApprovalsForRequisition(req.params.id);
    return res.json({ ...row, approvalPhases });
  } catch (err) {
    return next(err);
  }
});

// POST /api/requisitions
// TAs, approvers, and admins can raise requisitions.
// Req-approval approvers are auto-assigned based on BU.
requisitionsRouter.post(
  '/api/requisitions',
  requireRole('approver', 'ta'),
  async (req, res, next) => {
    try {
      const input = createRequisitionSchema.parse(req.body);

      const created = await createRequisition({
        ...input,
        raisedBy: req.user!.name,
        raisedByUserId: req.user!.id,
      });

      await createInitialApprovals(created.id, input.bu);

      const approvalPhases = await getApprovalsForRequisition(created.id);
      return res.status(201).json({ ...created, approvalPhases });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

// PATCH /api/requisitions/:id
// Status changes restricted to Active and Filled only. Req-approval
// transitions happen via the dedicated POST /:id/approve endpoint.
requisitionsRouter.patch(
  '/api/requisitions/:id',
  requireRole('approver'),
  async (req, res, next) => {
    try {
      const input = updateRequisitionSchema.parse(req.body);
      const updated = await updateRequisition(req.params.id, input);
      if (!updated) return res.status(404).json({ error: 'Not found' });
      const approvalPhases = await getApprovalsForRequisition(req.params.id);
      return res.json({ ...updated, approvalPhases });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

// POST /api/requisitions/:id/approve
// Req-approval: any assigned BU approver or admin can approve.
requisitionsRouter.post(
  '/api/requisitions/:id/approve',
  requireRole('approver'),
  async (req, res, next) => {
    try {
      const reqRow = await getRequisition(req.params.id);
      if (!reqRow) return res.status(404).json({ error: 'Not found' });

      if (reqRow.status !== 'Pending Approval') {
        return res.status(400).json({ error: `Requisition is in status '${reqRow.status}', not awaiting approval` });
      }

      let result;
      try {
        result = await recordApproval(req.params.id, req.user!.id);
      } catch (err) {
        if (err instanceof Error && (err.message.includes('not assigned') || err.message.includes('already approved'))) {
          return res.status(403).json({ error: err.message });
        }
        throw err;
      }

      if (result.phaseComplete) {
        await updateRequisition(req.params.id, { status: 'Approved' });
      }

      const updated = await getRequisition(req.params.id);
      const approvalPhases = await getApprovalsForRequisition(req.params.id);
      return res.json({ ...updated, approvalPhases });
    } catch (err) {
      return next(err);
    }
  },
);

// Error handler — Express recognizes 4-arg signature as error middleware.
requisitionsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[requisitions]', err);
  res.status(500).json({ error: 'Internal server error' });
});
