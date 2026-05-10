import { Router, Request, Response, NextFunction } from 'express';
import { listCandidates } from '../models/candidate.js';
import { listRequisitions } from '../models/requisition.js';
import { getHeadcountView, getUnseenAopChanges } from '../models/headcount.js';
import {
  funnelCounts,
  topLineCounts,
  pendingApprovals,
  cityBreakdown,
  shouldShowEmptyTargetsBanner,
} from '../logic/dashboard.js';
import { getEffectiveCities } from '../middleware/cityScope.js';

export const dashboardRouter = Router();

// GET /api/dashboard?bu=CPM — single aggregated view for the Dashboard page.
dashboardRouter.get('/api/dashboard', async (req, res, next) => {
  try {
    const bu = typeof req.query.bu === 'string' && req.query.bu !== 'all' ? req.query.bu : undefined;
    const cities = getEffectiveCities(req.user!);
    const cityFilter = cities ?? undefined;

    // Three parallel queries, each with bu + city-scope filters applied at the DB layer.
    const [candidates, requisitions, headcount] = await Promise.all([
      listCandidates({ ...(bu ? { bu } : {}), cities: cityFilter }),
      listRequisitions({ ...(bu ? { bu } : {}), cities: cityFilter }),
      getHeadcountView({ ...(bu ? { bu } : {}), cities: cityFilter }),
    ]);

    const cityRows = cityBreakdown(headcount, requisitions, candidates);
    const buLabel = (bu ?? 'all') as 'all' | 'CPM' | 'IGIV';
    // PR-O: only admins get the "changes since you last viewed" list. TAs and
    // approvers can't change AOP and the toast wouldn't make sense for them.
    const unseenAopChanges =
      req.user?.role === 'admin' ? await getUnseenAopChanges(req.user.id) : [];
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
      unseenAopChanges,
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[dashboard]', err);
  res.status(500).json({ error: 'Internal server error' });
});
