import { Router } from 'express';
import { listUsers } from '../models/user.js';

export const meRouter = Router();

// GET /api/me — returns the currently authenticated user (from mock auth header).
meRouter.get('/api/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.user);
});

// GET /api/users — list all users (used for dev user switcher in the frontend).
// In production this would be admin-only.
meRouter.get('/api/users', async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});
