import { Router } from 'express';
import { markAopSeen } from '../models/user.js';
import { requireRole } from '../middleware/rbac.js';

export const meRouter = Router();

// GET /api/me — returns the currently authenticated user.
// Auth middleware (mock or google) populates req.user before this handler runs.
meRouter.get('/api/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.user);
});

// PR-O: POST /api/me/aop-seen — admin clicked "Got it" on the Dashboard's
// "changes since you last viewed" toast.
meRouter.post('/api/me/aop-seen', requireRole('admin'), async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
    await markAopSeen(req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
