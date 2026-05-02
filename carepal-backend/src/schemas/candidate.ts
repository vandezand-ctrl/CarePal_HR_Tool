import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const offerCandidateSchema = z.object({
  offerDate: z.string().regex(dateRegex),
});

export const recordJoinSchema = z.object({
  joinDate: z.string().regex(dateRegex),
});

export const createCandidateSchema = z.object({
  reqId: z.string().regex(/^REQ-\d+$/, 'reqId must be in the form REQ-###'),
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().nullable().optional().or(z.literal('')),
  city: z.string().min(1),
  currentRole: z.string().min(1),
  company: z.string().min(1),
  currentCTC: z.number().int().positive().nullable().optional(),
  expectedCTC: z.number().int().positive().nullable().optional(),
  notice: z.string().nullable().optional(),
  ta: z.string().min(1),
  bu: z.enum(['CPM', 'IGIV']),
});

// NOTE: `stage` is intentionally NOT in this schema. Stage changes must go
// through the transition endpoints:
//   POST /api/interviews (schedule R1/R2)
//   PATCH /api/interviews/:id (record result → R1/R2 Complete)
//   POST /api/candidates/:id/offer (R1/R2 Complete → Offered)
//   POST /api/candidates/:id/join (Offered → Joined)
//   POST /api/candidates/:id/start-training (Joined → Training)  — added in PR-E (C3)
//   POST /api/candidates/:id/activate (Training → Active)        — added in PR-E (C3)
// This keeps the pipeline state machine authoritative.
//
// PR-E adds:
// - reqId (C1): re-tag a candidate to a different requisition (FK-checked at the route layer).
// - expectedJoiningDate (C2): TA fills this in once a candidate is Offered.
export const updateCandidateSchema = z.object({
  reqId: z.string().regex(/^REQ-\d+$/, 'reqId must be in the form REQ-###').optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().nullable().optional(),
  currentCTC: z.number().int().positive().nullable().optional(),
  expectedCTC: z.number().int().positive().nullable().optional(),
  notice: z.string().nullable().optional(),
  ta: z.string().min(1).optional(),
  expectedJoiningDate: z.union([z.string().regex(dateRegex), z.null()]).optional(),
}).strict(); // reject unknown keys (including 'stage') with a Zod error
