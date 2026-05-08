import { Router, Request, Response, NextFunction } from 'express';
import { listCandidates } from '../models/candidate.js';
import { listRequisitions } from '../models/requisition.js';
import { getHeadcountView } from '../models/headcount.js';
import {
  funnelCounts,
  topLineCounts,
  pendingApprovals,
  cityBreakdown,
  shouldShowEmptyTargetsBanner,
} from '../logic/dashboard.js';

export const dashboardRouter = Router();

// GET /api/dashboard?bu=CPM — single aggregated view for the Dashboard page.
dashboardRouter.get('/api/dashboard', async (req, res, next) => {
  try {
    const bu = typeof req.query.bu === 'string' && req.query.bu !== 'all' ? req.query.bu : undefined;

    // Three parallel queries, each with bu filter applied at the DB layer.
    const [candidates, requisitions, headcount] = await Promise.all([
      listCandidates(bu ? { bu } : {}),
      listRequisitions(bu ? { bu } : {}),
      getHeadcountView(bu ? { bu } : {}),
    ]);

    const cityRows = cityBreakdown(headcount, requisitions, candidates);
    const buLabel = (bu ?? 'all') as 'all' | 'CPM' | 'IGIV';
    res.json({
      bu: buLabel,
      totals: topLineCounts(
        requisitions.map((r) => r.status),
        candidates.map((c) => c.stage),
      ),
      funnel: funnelCounts(candidates.map((c) => c.stage)),
      pendingApprovals: pendingApprovals(requisitions),
      cityBreakdown: cityRows,
      showEmptyTargetsBanner: shouldShowEmptyTargetsBanner(cityRows, buLabel),
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[dashboard]', err);
  res.status(500).json({ error: 'Internal server error' });
});
