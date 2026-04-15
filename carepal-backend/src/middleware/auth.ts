import { Request, Response, NextFunction } from 'express';
import { getUserByEmail, User } from '../models/user.js';

// Augment Express's Request type to include user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/**
 * Mock auth middleware — reads `x-user-email` header, loads user from DB, attaches to req.user.
 * Swap this file for real Google OAuth when CarePal's GCP project is set up.
 *
 * Behavior:
 * - Missing header → 401 (caller must identify themselves)
 * - Unknown email  → 401 (user not in DB)
 * - Known email    → attaches req.user and continues
 */
export async function mockAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('x-user-email');
  if (!header) {
    res.status(401).json({ error: 'Missing x-user-email header (dev mock auth)' });
    return;
  }

  const user = await getUserByEmail(header.trim().toLowerCase());
  if (!user) {
    res.status(401).json({ error: `No user found for email: ${header}` });
    return;
  }

  req.user = user;
  next();
}
