import { z } from 'zod';

export const acceptApplicationSchema = z.object({
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
  // PR-L: replaces single `ta`. >=1 user IDs, validated against user roles
  // at the route layer.
  taIds: z.array(z.number().int().positive()).min(1),
  bu: z.enum(['CPM', 'IGIV']),
});

export const rejectApplicationSchema = z.object({
  reason: z.string().optional(),
});

export const createApplicationSchema = z.object({
  senderEmail: z.string().email(),
  senderName: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  receivedAt: z.string().min(1),
  parsedName: z.string().nullable().optional(),
  parsedPhone: z.string().nullable().optional(),
  parsedEmail: z.string().nullable().optional(),
  bodySnippet: z.string().nullable().optional(),
  sourceMailbox: z.string().nullable().optional(),
});
