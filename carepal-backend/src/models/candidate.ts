import { getDb } from '../db/index.js';
import { transitionStage } from '../logic/pipeline.js';

export const PIPELINE_STAGES = [
  'Sourced',
  'R1 Scheduled',
  'R1 Complete',
  'R2 Scheduled',
  'R2 Complete',
  'Offered',
  'Joined',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface Candidate {
  id: string;
  reqId: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  currentRole: string;
  company: string;
  currentCTC: number | null;
  expectedCTC: number | null;
  notice: string | null;
  ta: string;
  sourced: string; // YYYY-MM-DD
  stage: PipelineStage;
  bu: 'CPM' | 'IGIV';
  // Transitional interview fields (will move to `interviews` table in Stage 4)
  r1By: string | null;
  r1Date: string | null;
  r1Result: 'Select' | 'Reject' | null;
  r2By: string | null;
  r2Date: string | null;
  r2Result: 'Select' | 'Reject' | null;
  offerDate: string | null;
  joinDate: string | null;
}

interface CandidateRow {
  id: string;
  req_id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string;
  current_role: string;
  company: string;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice: string | null;
  ta: string;
  sourced_at: string;
  stage: string;
  bu: string;
  r1_by: string | null;
  r1_date: string | null;
  r1_result: string | null;
  r2_by: string | null;
  r2_date: string | null;
  r2_result: string | null;
  offer_date: string | null;
  join_date: string | null;
}

function rowToCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    reqId: row.req_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    currentRole: row.current_role,
    company: row.company,
    currentCTC: row.current_ctc,
    expectedCTC: row.expected_ctc,
    notice: row.notice,
    ta: row.ta,
    sourced: row.sourced_at,
    stage: row.stage as PipelineStage,
    bu: row.bu as 'CPM' | 'IGIV',
    r1By: row.r1_by,
    r1Date: row.r1_date,
    r1Result: row.r1_result as Candidate['r1Result'],
    r2By: row.r2_by,
    r2Date: row.r2_date,
    r2Result: row.r2_result as Candidate['r2Result'],
    offerDate: row.offer_date,
    joinDate: row.join_date,
  };
}

export interface CandidateFilters {
  bu?: string;
  reqId?: string;
  stage?: string;
  city?: string;
}

export async function listCandidates(filters: CandidateFilters = {}): Promise<Candidate[]> {
  const q = getDb()<CandidateRow>('candidates').select('*').orderBy('sourced_at', 'desc');
  if (filters.bu) q.where('bu', filters.bu);
  if (filters.reqId) q.where('req_id', filters.reqId);
  if (filters.stage) q.where('stage', filters.stage);
  if (filters.city) q.where('city', filters.city);
  const rows = await q;
  return rows.map(rowToCandidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const row = await getDb()<CandidateRow>('candidates').where({ id }).first();
  return row ? rowToCandidate(row) : null;
}

export interface CreateCandidateInput {
  reqId: string;
  name: string;
  phone: string;
  email?: string | null;
  city: string;
  currentRole: string;
  company: string;
  currentCTC?: number | null;
  expectedCTC?: number | null;
  notice?: string | null;
  ta: string;
  bu: 'CPM' | 'IGIV';
}

async function nextCandidateId(): Promise<string> {
  const row = await getDb()<CandidateRow>('candidates').select('id').orderBy('id', 'desc').first();
  if (!row) return 'C-001';
  const n = Number(row.id.replace('C-', '')) + 1;
  return `C-${String(n).padStart(3, '0')}`;
}

export async function createCandidate(input: CreateCandidateInput): Promise<Candidate> {
  const id = await nextCandidateId();
  const today = new Date().toISOString().slice(0, 10);
  await getDb()('candidates').insert({
    id,
    req_id: input.reqId,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    city: input.city,
    current_role: input.currentRole,
    company: input.company,
    current_ctc: input.currentCTC ?? null,
    expected_ctc: input.expectedCTC ?? null,
    notice: input.notice ?? null,
    ta: input.ta,
    sourced_at: today,
    stage: 'Sourced',
    bu: input.bu,
  });
  const created = await getCandidate(id);
  if (!created) throw new Error('Failed to create candidate');
  return created;
}

/**
 * Internal-use union covering all candidate fields we might write during
 * transitions (interview scheduling, result recording, offer, join).
 * The PATCH /api/candidates/:id endpoint restricts this to a safe subset
 * via `updateCandidateSchema` (no stage, no interview fields).
 */
export interface UpdateCandidateInput {
  stage?: PipelineStage;   // internal use only (interview.ts, offerCandidate, recordJoin)
  phone?: string;
  email?: string | null;
  currentCTC?: number | null;
  expectedCTC?: number | null;
  notice?: string | null;
  ta?: string;
  r1By?: string | null;
  r1Date?: string | null;
  r1Result?: 'Select' | 'Reject' | null;
  r2By?: string | null;
  r2Date?: string | null;
  r2Result?: 'Select' | 'Reject' | null;
  offerDate?: string | null;
  joinDate?: string | null;
}

export async function updateCandidate(
  id: string,
  input: UpdateCandidateInput,
): Promise<Candidate | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.currentCTC !== undefined) patch.current_ctc = input.currentCTC;
  if (input.expectedCTC !== undefined) patch.expected_ctc = input.expectedCTC;
  if (input.notice !== undefined) patch.notice = input.notice;
  if (input.ta !== undefined) patch.ta = input.ta;
  if (input.r1By !== undefined) patch.r1_by = input.r1By;
  if (input.r1Date !== undefined) patch.r1_date = input.r1Date;
  if (input.r1Result !== undefined) patch.r1_result = input.r1Result;
  if (input.r2By !== undefined) patch.r2_by = input.r2By;
  if (input.r2Date !== undefined) patch.r2_date = input.r2Date;
  if (input.r2Result !== undefined) patch.r2_result = input.r2Result;
  if (input.offerDate !== undefined) patch.offer_date = input.offerDate;
  if (input.joinDate !== undefined) patch.join_date = input.joinDate;

  const affected = await getDb()('candidates').where({ id }).update(patch);
  if (affected === 0) return null;
  return getCandidate(id);
}

/**
 * Transition R1/R2 Complete -> Offered. Sets offer_date.
 * Validates via the pipeline state machine.
 */
export async function offerCandidate(id: string, offerDate: string): Promise<Candidate> {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error(`Candidate ${id} not found`);
  const newStage = transitionStage(candidate.stage, { type: 'MAKE_OFFER' });
  await getDb()('candidates').where({ id }).update({
    stage: newStage,
    offer_date: offerDate,
    updated_at: new Date().toISOString(),
  });
  const fresh = await getCandidate(id);
  if (!fresh) throw new Error('Failed to load candidate after offer');
  return fresh;
}

/**
 * Transition Offered -> Joined. Sets join_date.
 */
export async function recordJoin(id: string, joinDate: string): Promise<Candidate> {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error(`Candidate ${id} not found`);
  const newStage = transitionStage(candidate.stage, { type: 'RECORD_JOIN' });
  await getDb()('candidates').where({ id }).update({
    stage: newStage,
    join_date: joinDate,
    updated_at: new Date().toISOString(),
  });
  const fresh = await getCandidate(id);
  if (!fresh) throw new Error('Failed to load candidate after join');
  return fresh;
}
