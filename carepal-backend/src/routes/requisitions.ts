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

export const requisitionsRouter = Router();

// GET /api/requisitions?bu=CPM&city=Bangalore&status=Active&hospital=...
requisitionsRouter.get('/api/requisitions', async (req, res, next) => {
  try {
    const { bu, city, hospital, status } = req.query;
    const rows = await listRequisitions({
      bu: typeof bu === 'string' ? bu : undefined,
      city: typeof city === 'string' ? city : undefined,
      hospital: typeof hospital === 'string' ? hospital : undefined,
      status: typeof status === 'string' ? status : undefined,
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
requisitionsRouter.post('/api/requisitions', async (req, res, next) => {
  try {
    const input = createRequisitionSchema.parse(req.body);
    const created = await createRequisition(input);
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    return next(err);
  }
});

// PATCH /api/requisitions/:id
requisitionsRouter.patch('/api/requisitions/:id', async (req, res, next) => {
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
});

// Error handler — Express recognizes 4-arg signature as error middleware.
requisitionsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[requisitions]', err);
  res.status(500).json({ error: 'Internal server error' });
});
