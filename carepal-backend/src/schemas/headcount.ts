import { z } from 'zod';

// Body for PUT /api/headcount/:city/:bu — admin updates the AOP target manually.
// Negative values are nonsensical for headcount; we cap at 0+ and require an
// integer (no half-people).
export const updateHeadcountTargetSchema = z.object({
  aop: z.number().int().min(0),
});
