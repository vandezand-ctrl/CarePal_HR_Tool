import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.js';

/**
 * Role guard factory. Usage: `router.patch('/x', requireRole('approver', 'admin'), handler)`.
 * Admins always pass any role check.
 */
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (req.user.role === 'admin' || allowed.includes(req.user.role)) {
      next();
      return;
    }
    res.status(403).json({
      error: `Role '${req.user.role}' cannot perform this action. Required: ${allowed.join(' or ')}.`,
    });
  };
}
