import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  listApplications,
  getApplication,
  createApplication,
  acceptApplication,
  rejectApplication,
  countUnseenApplications,
} from '../models/application.js';
import { getRequisition } from '../models/requisition.js';
import { getCandidate } from '../models/candidate.js';
import { getUserById } from '../models/user.js';
import { readFile } from '../services/storage.js';
import { requireRole } from '../middleware/rbac.js';
import {
  acceptApplicationSchema,
  rejectApplicationSchema,
  createApplicationSchema,
} from '../schemas/application.js';

export const applicationsRouter = Router();

const taOrAdmin = requireRole('ta');

// GET /api/applications?status=pending
applicationsRouter.get('/api/applications', taOrAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const rows = await listApplications({
      status: typeof status === 'string' ? status : undefined,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/applications/unseen-count — must be before :id
applicationsRouter.get('/api/applications/unseen-count', taOrAdmin, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const count = await countUnseenApplications(req.user.id);
    return res.json({ count });
  } catch (err) {
    return next(err);
  }
});

// GET /api/applications/:id
applicationsRouter.get('/api/applications/:id', taOrAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid application id' });
    const app = await getApplication(id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    return res.json(app);
  } catch (err) {
    return next(err);
  }
});

// GET /api/applications/:id/cv — stream the CV file
applicationsRouter.get('/api/applications/:id/cv', taOrAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid application id' });
    const app = await getApplication(id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (!app.cvStorageKey) return res.status(404).json({ error: 'No CV attached' });
    const buffer = await readFile(app.cvStorageKey);
    const ext = app.cvStorageKey.split('.').pop()?.toLowerCase() || 'pdf';
    const mime = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="cv.${ext}"`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
});

// POST /api/applications/:id/accept
applicationsRouter.post('/api/applications/:id/accept', taOrAdmin, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const input = acceptApplicationSchema.parse(req.body);
    const normalizedEmail = input.email === '' ? null : input.email ?? null;

    const reqRow = await getRequisition(input.reqId);
    if (!reqRow) return res.status(400).json({ error: `Requisition ${input.reqId} not found` });

    // PR-L: every taId must resolve to a TA or admin user.
    for (const id of input.taIds) {
      const u = await getUserById(id);
      if (!u) return res.status(400).json({ error: `User id ${id} not found` });
      if (u.role !== 'ta' && u.role !== 'admin') {
        return res.status(400).json({ error: `User '${u.name}' (role ${u.role}) cannot be assigned to a candidate` });
      }
    }

    const appId = Number(req.params.id);
    if (!Number.isInteger(appId) || appId <= 0) return res.status(400).json({ error: 'Invalid application id' });

    const { application, candidateId } = await acceptApplication(
      appId,
      { ...input, email: normalizedEmail },
      req.user.id,
    );
    const candidate = await getCandidate(candidateId);
    return res.json({ application, candidate });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && err.message.includes('already')) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && err.message === 'Application not found') {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// POST /api/applications/:id/reject
applicationsRouter.post('/api/applications/:id/reject', taOrAdmin, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { reason } = rejectApplicationSchema.parse(req.body);
    const appId = Number(req.params.id);
    if (!Number.isInteger(appId) || appId <= 0) return res.status(400).json({ error: 'Invalid application id' });
    const updated = await rejectApplication(appId, req.user.id, reason);
    return res.json(updated);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    if (err instanceof Error && err.message.includes('already')) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof Error && err.message === 'Application not found') {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

// POST /api/applications — admin-only seed endpoint (also used by Gmail watcher)
applicationsRouter.post('/api/applications', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createApplicationSchema.parse(req.body);
    const created = await createApplication(input);
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    }
    return next(err);
  }
});

applicationsRouter.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[applications]', err);
  res.status(500).json({ error: 'Internal server error' });
});
