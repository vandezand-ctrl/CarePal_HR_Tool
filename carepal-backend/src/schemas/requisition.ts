import { z } from 'zod';

export const createRequisitionSchema = z.object({
  city: z.string().min(1),
  hospital: z.string().min(1),
  area: z.string().nullable().optional(),
  bdType: z.enum(['Focus', 'Floater']),
  bu: z.enum(['CPM', 'IGIV']),
  hireType: z.enum(['New', 'Replacement']),
  replacementFor: z.string().nullable().optional(),
  raisedBy: z.string().min(1),
  notes: z.string().nullable().optional(),
}).refine(
  (data) => data.hireType !== 'Replacement' || (data.replacementFor != null && data.replacementFor.length > 0),
  { message: 'replacementFor is required when hireType is Replacement', path: ['replacementFor'] },
);

export const updateRequisitionSchema = z.object({
  status: z.enum(['Pending Approval', 'Approved', 'Active', 'Filled']).optional(),
  notes: z.string().nullable().optional(),
});
