import { Router } from 'express';
import { ZodError } from 'zod';
import { listUsers, getUserById, updateUserRole } from '../models/user.js';
import { updateUserRoleSchema, updateUserCitiesSchema } from '../schemas/user.js';
import { requireRole } from '../middleware/rbac.js';
import { listAllCities, setUserCities, getCitiesForUser } from '../models/userCity.js';

export const usersRouter = Router();

// GET /api/users — list all users.
//
// Open to any authenticated user (not admin-gated): used by the dev-mode
// user-switcher dropdown, which needs to enumerate users regardless of who's
// signed in. The data (name, email, role, city, domain) is non-sensitive
// within this internal team. The sensitive operation is changing roles —
// that's gated below.
usersRouter.get('/api/users', async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/role — change a user's role. Admin only.
//
// Body: { role: 'admin' | 'approver' | 'ta' }
// Returns the updated user. 404 if no user with that id, 400 on bad role.
usersRouter.patch(
  '/api/users/:id/role',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid user id' });
        return;
      }

      const { role } = updateUserRoleSchema.parse(req.body);
      const updated = await updateUserRole(id, role);
      if (!updated) {
        res.status(404).json({ error: `No user with id ${id}` });
        return;
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Invalid body', issues: err.issues });
        return;
      }
      next(err);
    }
  },
);

// GET /api/cities — distinct city list for the city-access checkbox UI.
usersRouter.get('/api/cities', async (_req, res, next) => {
  try {
    const cities = await listAllCities();
    res.json(cities);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id/cities — admin sets which cities a user can access.
usersRouter.put(
  '/api/users/:id/cities',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid user id' });
        return;
      }
      const user = await getUserById(id);
      if (!user) {
        res.status(404).json({ error: `No user with id ${id}` });
        return;
      }
      const { cities } = updateUserCitiesSchema.parse(req.body);
      await setUserCities(id, cities, req.user!.id);
      const updatedCities = await getCitiesForUser(id);
      res.json({ ...user, cities: updatedCities });
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Invalid body', issues: err.issues });
        return;
      }
      next(err);
    }
  },
);
