import { z } from 'zod';
import { PIPELINE_STAGES } from '../models/candidate.js';

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

export const updateCandidateSchema = z.object({
  stage: z.enum(PIPELINE_STAGES).optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().nullable().optional(),
  currentCTC: z.number().int().positive().nullable().optional(),
  expectedCTC: z.number().int().positive().nullable().optional(),
  notice: z.string().nullable().optional(),
  ta: z.string().min(1).optional(),
  r1By: z.string().nullable().optional(),
  r1Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  r1Result: z.enum(['Select', 'Reject']).nullable().optional(),
  r2By: z.string().nullable().optional(),
  r2Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  r2Result: z.enum(['Select', 'Reject']).nullable().optional(),
  offerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
