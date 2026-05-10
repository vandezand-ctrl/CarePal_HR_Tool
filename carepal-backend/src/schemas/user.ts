import { z } from 'zod';

// Three-tier role model from the README: admin / approver / TA team (DB role 'ta').
export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'approver', 'ta']),
});

export const updateUserCitiesSchema = z.object({
  cities: z.array(z.string().min(1)).default([]),
});
