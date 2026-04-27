import { z } from 'zod';

export const scheduleInterviewSchema = z.object({
  candidateId: z.string().regex(/^C-\d+$/),
  round: z.union([z.literal(1), z.literal(2)]),
  interviewerName: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  mode: z.enum(['Virtual', 'In-Person']),
  locationOrLink: z.string().nullable().optional(),
});

// 'No-show' added Apr 27 2026 — operations need to mark interviews where the
// candidate didn't turn up. Treated like a soft Reject (stage stays at
// R1/R2 Complete) — see logic/pipeline.ts.
export const recordResultSchema = z.object({
  result: z.enum(['Select', 'Reject', 'No-show']),
});

// Optional reason for soft-cancelling an interview ("interviewer sick",
// "candidate withdrew", etc.). Free-form so ops aren't constrained.
export const cancelInterviewSchema = z.object({
  reason: z.string().max(500).optional(),
});
