import { z } from 'zod';

// Client payload — raisedBy is added server-side from the authenticated user.
// Req-approval approvers are auto-assigned based on BU — not client-supplied.
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

// PATCH — only Active and Filled are valid targets. The req-approval
// transition happens through the dedicated approve endpoint, not via PATCH.
export const updateRequisitionSchema = z.object({
  status: z.enum(['Active', 'Filled']).optional(),
  notes: z.string().nullable().optional(),
  closureDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
});
