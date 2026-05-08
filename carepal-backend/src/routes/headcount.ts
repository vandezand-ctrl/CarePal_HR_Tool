import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { getHeadcountView, updateHeadcountTarget } from '../models/headcount.js';
import { updateHeadcountTargetSchema } from '../schemas/headcount.js';
import { requireRole } from '../middleware/rbac.js';

export const headcountRouter = Router();

// GET /api/headcount?bu=CPM
headcountRouter.get('/api/headcount', async (req, res, next) => {
  try {
    const { bu } = req.query;
    const rows = await getHeadcountView({
      bu: typeof bu === 'string' ? bu : undefined,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/headcount/:city/:bu — admin sets the AOP target. Manual update,
// not driven by any external system (per Apr 29 beta-feedback decision).
headcountRouter.put(
  '/api/headcount/:city/:bu',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { aop } = updateHeadcountTargetSchema.parse(req.body);
      const { city, bu } = req.params;
      if (bu !== 'CPM' && bu !== 'IGIV') {
        return res.status(400).json({ error: `bu must be 'CPM' or 'IGIV', got '${bu}'` });
      }
      // PR-O: pass the actor through so the Dashboard's "changes since you
      // last viewed" toast can filter out the viewer's own edits.
      const actorId = req.user?.id ?? null;
      const updated = await updateHeadcountTarget(city, bu, aop, actorId);
      if (!updated) {
        return res.status(404).json({ error: `No headcount row for city='${city}', bu='${bu}'` });
      }
      return res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', issues: err.issues });
      }
      return next(err);
    }
  },
);

headcountRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[headcount]', err);
  res.status(500).json({ error: 'Internal server error' });
});
