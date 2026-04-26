import { Router } from 'express';

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
