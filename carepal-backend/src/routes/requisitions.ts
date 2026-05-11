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
  setApproversSchema,
} from '../schemas/requisition.js';
import { requireRole } from '../middleware/rbac.js';
import { getEffectiveCities } from '../middleware/cityScope.js';
import {
  createInitialApprovals,
  getApprovalsForRequisition,
  getApprovalsForRequisitions,
  recordApproval,
  setPhaseApprovers,
  validateApproverIds,
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

    // Bulk-load approval phases for all returned requisitions
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
    const approvalPhases = await getApprovalsForRequisition(req.params.id);
    return res.json({ ...row, approvalPhases });
  } catch (err) {
    return next(err);
  }
});

// POST /api/requisitions
// TAs, approvers, and admins can raise requisitions.
requisitionsRouter.post(
  '/api/requisitions',
  requireRole('approver', 'ta'),
  async (req, res, next) => {
    try {
      const input = createRequisitionSchema.parse(req.body);

      // Validate that all approver IDs are valid approver/admin users
      await validateApproverIds([...input.phase1Approvers, ...input.phase2Approvers]);

      const created = await createRequisition({
        ...input,
        raisedBy: req.user!.name,
        raisedByUserId: req.user!.id,
      });

      await createInitialApprovals(
        created.id,
        input.phase1Approvers,
        input.phase2Approvers,
        req.user!.id,
      );

      const approvalPhases = await getApprovalsForRequisition(created.id);
      return res.status(201).json({ ...created, approvalPhases });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      if (err instanceof Error && (err.message.includes('Users not found') || err.message.includes('must have role'))) {
        return res.status(400).json({ error: err.message });
      }
      return next(err);
    }
  },
);

// PATCH /api/requisitions/:id
// Status changes restricted to Active and Filled only. Phase transitions
// happen via the dedicated POST /:id/approve endpoint.
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
// Individual approval by an assigned approver on the active phase.
requisitionsRouter.post(
  '/api/requisitions/:id/approve',
  async (req, res, next) => {
    try {
      const reqRow = await getRequisition(req.params.id);
      if (!reqRow) return res.status(404).json({ error: 'Not found' });

      // Determine active phase from status
      let activePhase: 1 | 2;
      if (reqRow.status === 'Phase 1') activePhase = 1;
      else if (reqRow.status === 'Phase 2') activePhase = 2;
      else return res.status(400).json({ error: `Requisition is in status '${reqRow.status}', not awaiting approval` });

      let result;
      try {
        result = await recordApproval(req.params.id, activePhase, req.user!.id);
      } catch (err) {
        if (err instanceof Error && (err.message.includes('not assigned') || err.message.includes('already approved'))) {
          return res.status(403).json({ error: err.message });
        }
        throw err;
      }

      // If phase is complete, advance status
      if (result.phaseComplete) {
        const nextStatus = activePhase === 1 ? 'Phase 2' : 'Approved';
        await updateRequisition(req.params.id, { status: nextStatus });
      }

      const updated = await getRequisition(req.params.id);
      const approvalPhases = await getApprovalsForRequisition(req.params.id);
      return res.json({ ...updated, approvalPhases });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /api/requisitions/:id/approvers
// Change approvers for a specific phase. Only the req owner or admin can do this.
requisitionsRouter.put(
  '/api/requisitions/:id/approvers',
  async (req, res, next) => {
    try {
      const reqRow = await getRequisition(req.params.id);
      if (!reqRow) return res.status(404).json({ error: 'Not found' });

      // Authorization: req owner or admin
      const isOwner = reqRow.raisedByUserId === req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Only the requisition owner or an admin can change approvers' });
      }

      const input = setApproversSchema.parse(req.body);

      try {
        await setPhaseApprovers(req.params.id, input.phase, input.approverIds, req.user!.id);
      } catch (err) {
        if (err instanceof Error && (err.message.includes('Users not found') || err.message.includes('must have role') || err.message.includes('At least one') || err.message.includes('Maximum 3'))) {
          return res.status(400).json({ error: err.message });
        }
        throw err;
      }

      const updated = await getRequisition(req.params.id);
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

// Error handler — Express recognizes 4-arg signature as error middleware.
requisitionsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[requisitions]', err);
  res.status(500).json({ error: 'Internal server error' });
});
