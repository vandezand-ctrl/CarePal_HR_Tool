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

export const recordResultSchema = z.object({
  result: z.enum(['Select', 'Reject']),
});
