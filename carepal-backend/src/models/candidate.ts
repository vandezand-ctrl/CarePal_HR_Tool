import { type Knex } from 'knex';
import { getDb } from '../db/index.js';
import { transitionStage } from '../logic/pipeline.js';
import {
  createAssignments,
  getAssignmentsForCandidate,
  getAssignmentsForCandidates,
  type AssignedUser,
} from './assignment.js';

export const PIPELINE_STAGES = [
  'Sourced',
  'R1 Scheduled',
  'R1 Complete',
  'R2 Scheduled',
  'R2 Complete',
  'Offered',
  'Joined',
  'Training',
  'Active',
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
  // PR-L: many-to-many assignment via candidate_assignments. Always >=1 entry.
  // Replaces the legacy single-string `ta` column (dropped in migration 015).
  assignedTas: AssignedUser[];
  sourced: string; // YYYY-MM-DD
  stage: PipelineStage;
  bu: 'CPM' | 'IGIV';
  // Interview details (interviewer, date, result) live on the `interviews`
  // table — fetch via /api/interviews?candidateId=... to display them.
  // The previously-denormalized r1_*/r2_* columns were dropped in
  // migration 20260428_009.
  offerDate: string | null;
  joinDate: string | null;
  expectedJoiningDate: string | null;
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
  sourced_at: string;
  stage: string;
  bu: string;
  offer_date: string | null;
  join_date: string | null;
  expected_joining_date: string | null;
}

// SQLite returns DATE columns as strings already; this normalises Date instances
// (some drivers/JSON paths) back to YYYY-MM-DD so the API shape stays stable.
function toDateString(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v.length >= 10 ? v.slice(0, 10) : v;
}

function rowToCandidate(row: CandidateRow, assignedTas: AssignedUser[]): Candidate {
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
    assignedTas,
    sourced: row.sourced_at,
    stage: row.stage as PipelineStage,
    bu: row.bu as 'CPM' | 'IGIV',
    offerDate: row.offer_date,
    joinDate: row.join_date,
    expectedJoiningDate: toDateString(row.expected_joining_date),
  };
}

export interface CandidateFilters {
  bu?: string;
  reqId?: string;
  stage?: string;
  city?: string;
  cities?: string[];
  assignedToUserId?: number;
}

export async function listCandidates(filters: CandidateFilters = {}): Promise<Candidate[]> {
  const q = getDb()<CandidateRow>('candidates').select('*').orderBy('sourced_at', 'desc');
  if (filters.bu) q.where('bu', filters.bu);
  if (filters.reqId) q.where('req_id', filters.reqId);
  if (filters.stage) q.where('stage', filters.stage);
  if (filters.city) q.where('city', filters.city);
  if (filters.cities) q.whereIn('city', filters.cities);
  if (filters.assignedToUserId != null) {
    q.whereExists(function () {
      this.select(getDb().raw(1))
        .from('candidate_assignments')
        .whereRaw('candidate_assignments.candidate_id = candidates.id')
        .where('candidate_assignments.user_id', filters.assignedToUserId!);
    });
  }
  const rows = await q;
  // Bulk-load assignments to avoid N+1.
  const assignmentsByCandidate = await getAssignmentsForCandidates(rows.map((r) => r.id));
  return rows.map((r) => rowToCandidate(r, assignmentsByCandidate.get(r.id) ?? []));
}

export async function getCandidate(
  id: string,
  conn?: Knex | Knex.Transaction,
): Promise<Candidate | null> {
  const db = conn ?? getDb();
  const row = await db<CandidateRow>('candidates').where({ id }).first();
  if (!row) return null;
  const assignedTas = await getAssignmentsForCandidate(id, conn);
  return rowToCandidate(row, assignedTas);
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
  // PR-L: replaces the legacy `ta` string. Must contain >=1 user IDs, each
  // resolving to a user with role 'ta' or 'admin' (route-level validation).
  taIds: number[];
  bu: 'CPM' | 'IGIV';
}

async function nextCandidateId(conn: Knex | Knex.Transaction): Promise<string> {
  const row = await conn<CandidateRow>('candidates').select('id').orderBy('id', 'desc').first();
  if (!row) return 'C-001';
  const n = Number(row.id.replace('C-', '')) + 1;
  return `C-${String(n).padStart(3, '0')}`;
}

export async function createCandidate(
  input: CreateCandidateInput,
  assignedBy: number | null = null,
  outerTrx?: Knex.Transaction,
): Promise<Candidate> {
  if (!input.taIds || input.taIds.length === 0) {
    throw new Error('At least one TA must be assigned to the candidate');
  }

  const run = async (trx: Knex.Transaction): Promise<Candidate> => {
    const id = await nextCandidateId(trx);
    const today = new Date().toISOString().slice(0, 10);
    await trx('candidates').insert({
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
      sourced_at: today,
      stage: 'Sourced',
      bu: input.bu,
    });
    await createAssignments(id, input.taIds, assignedBy, trx);

    await trx('requisitions')
      .where({ id: input.reqId, status: 'Approved' })
      .update({ status: 'Active', updated_at: new Date() });

    const created = await getCandidate(id, trx);
    if (!created) throw new Error('Failed to create candidate');
    return created;
  };

  return outerTrx ? run(outerTrx) : getDb().transaction(run);
}

/**
 * Internal-use union covering all candidate fields we might write during
 * transitions (interview scheduling, result recording, offer, join).
 * The PATCH /api/candidates/:id endpoint restricts this to a safe subset
 * via `updateCandidateSchema` (no stage, no interview fields).
 */
export interface UpdateCandidateInput {
  stage?: PipelineStage;   // internal use only (interview.ts, offerCandidate, recordJoin)
  reqId?: string;          // re-tag candidate to a different requisition (C1)
  phone?: string;
  email?: string | null;
  currentCTC?: number | null;
  expectedCTC?: number | null;
  notice?: string | null;
  // PR-L: assignment changes go through `setAssignments` rather than the
  // candidates row patch. The route layer handles `taIds` separately.
  offerDate?: string | null;
  joinDate?: string | null;
  expectedJoiningDate?: string | null;
}

export async function updateCandidate(
  id: string,
  input: UpdateCandidateInput,
): Promise<Candidate | null> {
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.reqId !== undefined) patch.req_id = input.reqId;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.currentCTC !== undefined) patch.current_ctc = input.currentCTC;
  if (input.expectedCTC !== undefined) patch.expected_ctc = input.expectedCTC;
  if (input.notice !== undefined) patch.notice = input.notice;
  if (input.offerDate !== undefined) patch.offer_date = input.offerDate;
  if (input.joinDate !== undefined) patch.join_date = input.joinDate;
  if (input.expectedJoiningDate !== undefined) patch.expected_joining_date = input.expectedJoiningDate;

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

  if (candidate.stage === 'R1 Complete') {
    const r1 = await getDb()('interviews')
      .where({ candidate_id: id, round: 1 })
      .whereNull('cancelled_at')
      .first();
    if (!r1 || r1.result !== 'Select') {
      throw new Error('Cannot offer: candidate was not selected at R1');
    }
  }
  if (candidate.stage === 'R2 Complete') {
    const r2 = await getDb()('interviews')
      .where({ candidate_id: id, round: 2 })
      .whereNull('cancelled_at')
      .first();
    if (!r2 || r2.result !== 'Select') {
      throw new Error('Cannot offer: candidate was not selected at R2');
    }
  }

  const newStage = transitionStage(candidate.stage, { type: 'MAKE_OFFER' });
  await getDb()('candidates').where({ id }).update({
    stage: newStage,
    offer_date: offerDate,
    updated_at: new Date(),
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
    updated_at: new Date(),
  });
  const fresh = await getCandidate(id);
  if (!fresh) throw new Error('Failed to load candidate after join');
  return fresh;
}

/**
 * Transition Joined -> Training. Captures the start of the onboarding period.
 * Per Apr 29 backlog (C3): Sahil wants the dashboard to reflect candidates'
 * post-join state so he knows who's ramping vs who's productive.
 */
export async function startTraining(id: string): Promise<Candidate> {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error(`Candidate ${id} not found`);
  const newStage = transitionStage(candidate.stage, { type: 'START_TRAINING' });
  await getDb()('candidates').where({ id }).update({
    stage: newStage,
    updated_at: new Date(),
  });
  const fresh = await getCandidate(id);
  if (!fresh) throw new Error('Failed to load candidate after start-training');
  return fresh;
}

/**
 * Transition Training -> Active. Marks the candidate as fully ramped /
 * deployed. This is the stage that drives the "Active Headcount" StatCard.
 */
export async function markActive(id: string): Promise<Candidate> {
  const candidate = await getCandidate(id);
  if (!candidate) throw new Error(`Candidate ${id} not found`);
  const newStage = transitionStage(candidate.stage, { type: 'MARK_ACTIVE' });
  await getDb()('candidates').where({ id }).update({
    stage: newStage,
    updated_at: new Date(),
  });
  const fresh = await getCandidate(id);
  if (!fresh) throw new Error('Failed to load candidate after mark-active');
  return fresh;
}
