import { z } from 'zod';

// Client payload — raisedBy is added server-side from the authenticated user.
export const createRequisitionSchema = z.object({
  city: z.string().min(1),
  hospital: z.string().min(1),
  area: z.string().nullable().optional(),
  bdType: z.enum(['Focus', 'Floater']),
  bu: z.enum(['CPM', 'IGIV']),
  hireType: z.enum(['New', 'Replacement']),
  replacementFor: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).refine(
  (data) => data.hireType !== 'Replacement' || (data.replacementFor != null && data.replacementFor.length > 0),
  { message: 'replacementFor is required when hireType is Replacement', path: ['replacementFor'] },
);

export const updateRequisitionSchema = z.object({
  status: z.enum(['Pending Approval', 'Approved', 'Active', 'Filled']).optional(),
  notes: z.string().nullable().optional(),
  // ISO YYYY-MM-DD or null. Optional so the existing status/notes patches
  // continue to work without sending a date.
  closureDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
});
