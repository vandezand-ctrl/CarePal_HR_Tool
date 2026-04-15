import { Router, Request, Response, NextFunction } from 'express';
import { getHeadcountView } from '../models/headcount.js';

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

headcountRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[headcount]', err);
  res.status(500).json({ error: 'Internal server error' });
});
