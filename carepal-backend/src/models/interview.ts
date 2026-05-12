import { getDb } from '../db/index.js';
import { transitionStage, PipelineEvent, InterviewResult } from '../logic/pipeline.js';
import { getCandidate } from './candidate.js';

export type InterviewMode = 'Virtual' | 'In-Person';
// Re-export for callers that don't want to reach into logic/pipeline.
export type { InterviewResult } from '../logic/pipeline.js';

export interface Interview {
  id: number;
  candidateId: string;
  round: 1 | 2;
  interviewerName: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null;
  mode: InterviewMode;
  locationOrLink: string | null;
  result: InterviewResult | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
}

interface InterviewRow {
  id: number;
  candidate_id: string;
  round: number;
  interviewer_name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  mode: string;
  location_or_link: string | null;
  result: string | null;
  cancelled_at: string | Date | null;
  cancelled_reason: string | null;
}

function rowToInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    round: row.round as 1 | 2,
    interviewerName: row.interviewer_name,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    mode: row.mode as InterviewMode,
    locationOrLink: row.location_or_link,
    result: row.result as InterviewResult | null,
    cancelledAt:
      row.cancelled_at instanceof Date
        ? row.cancelled_at.toISOString()
        : row.cancelled_at,
    cancelledReason: row.cancelled_reason,
  };
}

export interface ListInterviewsFilters {
  candidateId?: string;
  dateFrom?: string;          // YYYY-MM-DD inclusive
  dateTo?: string;            // YYYY-MM-DD inclusive
  round?: 1 | 2;
  result?: InterviewResult | 'Scheduled'; // 'Scheduled' = result IS NULL
  interviewerName?: string;
  includeCancelled?: boolean; // default false — cancelled rows hidden unless asked
}

export async function listInterviews(filters: ListInterviewsFilters = {}): Promise<Interview[]> {
  const q = getDb()<InterviewRow>('interviews').select('*').orderBy('scheduled_date', 'desc');
  if (filters.candidateId) q.where('candidate_id', filters.candidateId);
  if (filters.dateFrom) q.where('scheduled_date', '>=', filters.dateFrom);
  if (filters.dateTo) q.where('scheduled_date', '<=', filters.dateTo);
  if (filters.round) q.where('round', filters.round);
  if (filters.interviewerName) q.where('interviewer_name', filters.interviewerName);
  if (filters.result) {
    if (filters.result === 'Scheduled') q.whereNull('result');
    else q.where('result', filters.result);
  }
  if (!filters.includeCancelled) q.whereNull('cancelled_at');
  const rows = await q;
  return rows.map(rowToInterview);
}

export async function getInterview(id: number): Promise<Interview | null> {
  const row = await getDb()<InterviewRow>('interviews').where({ id }).first();
  return row ? rowToInterview(row) : null;
}

export interface ScheduleInterviewInput {
  candidateId: string;
  round: 1 | 2;
  interviewerName: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  mode: InterviewMode;
  locationOrLink?: string | null;
}

/**
 * Create or update (upsert) an interview schedule. Transitions the candidate's
 * pipeline stage and updates the denormalized r1/r2 cache on candidates.
 *
 * NOTE on the cache fields (`candidates.r1_*` / `r2_*`): they're transitional
 * — PR C drops them. While they exist we keep them in sync so the legacy
 * frontend keeps rendering correctly.
 */
export async function scheduleInterview(input: ScheduleInterviewInput): Promise<Interview> {
  const candidate = await getCandidate(input.candidateId);
  if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);

  const event: PipelineEvent = input.round === 1 ? { type: 'SCHEDULE_R1' } : { type: 'SCHEDULE_R2' };
  const newStage = transitionStage(candidate.stage, event);

  if (input.round === 2) {
    const r1 = await getDb()<InterviewRow>('interviews')
      .where({ candidate_id: input.candidateId, round: 1 })
      .whereNull('cancelled_at')
      .first();
    if (!r1 || r1.result !== 'Select') {
      throw new Error('Cannot schedule R2: candidate was not selected at R1');
    }
  }

  const db = getDb();
  return db.transaction(async (trx) => {
    const existing = await trx<InterviewRow>('interviews')
      .where({ candidate_id: input.candidateId, round: input.round })
      .first();

    let id: number;
    if (existing) {
      await trx('interviews').where({ id: existing.id }).update({
        interviewer_name: input.interviewerName,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime ?? null,
        mode: input.mode,
        location_or_link: input.locationOrLink ?? null,
        cancelled_at: null,
        cancelled_reason: null,
        updated_at: new Date(),
      });
      id = existing.id;
    } else {
      const [newId] = await trx('interviews').insert({
        candidate_id: input.candidateId,
        round: input.round,
        interviewer_name: input.interviewerName,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime ?? null,
        mode: input.mode,
        location_or_link: input.locationOrLink ?? null,
        result: null,
      });
      id = newId as number;
    }

    await trx('candidates').where({ id: input.candidateId }).update({
      stage: newStage,
      updated_at: new Date(),
    });

    const fresh = await trx<InterviewRow>('interviews').where({ id }).first();
    if (!fresh) throw new Error('Failed to load interview after scheduling');
    return rowToInterview(fresh);
  });
}

/**
 * Record an interview result. Transitions the candidate's pipeline stage and
 * updates the denormalized cache.
 */
export async function recordInterviewResult(id: number, result: InterviewResult): Promise<Interview> {
  const db = getDb();
  const existing = await db<InterviewRow>('interviews').where({ id }).first();
  if (!existing) throw new Error('Interview not found');

  const candidate = await getCandidate(existing.candidate_id);
  if (!candidate) throw new Error('Candidate not found');

  const event: PipelineEvent =
    existing.round === 1
      ? { type: 'RECORD_R1_RESULT', result }
      : { type: 'RECORD_R2_RESULT', result };
  const newStage = transitionStage(candidate.stage, event);

  return db.transaction(async (trx) => {
    await trx('interviews').where({ id }).update({
      result,
      updated_at: new Date(),
    });

    await trx('candidates').where({ id: candidate.id }).update({
      stage: newStage,
      updated_at: new Date(),
    });

    const fresh = await trx<InterviewRow>('interviews').where({ id }).first();
    if (!fresh) throw new Error('Failed to load interview after recording result');
    return rowToInterview(fresh);
  });
}

/**
 * Soft-cancel a scheduled interview AND revert the candidate's stage in a
 * single transaction. Atomicity matters: a cancelled interview row paired
 * with a stuck-at-Scheduled candidate is a worse state than either failure
 * alone.
 *
 * Throws if:
 *   - Interview doesn't exist (caller maps to 404)
 *   - Interview already has a result recorded — cancellation would erase the
 *     audit trail of what actually happened (caller maps to 400)
 *   - Interview is already cancelled — idempotency guard, no-op (returns it)
 *
 * Side-effect on success: candidate.stage walks back one step
 * (R1 Scheduled -> Sourced; R2 Scheduled -> R1 Complete) AND the matching
 * r1_/r2_ cache fields (r1_by, r1_date, r1_result for R1; r2_* for R2) are cleared.
 *
 * Both writes (interview soft-cancel + candidate update) happen inside the
 * same trx — the candidate update is inlined here rather than calling
 * updateCandidate(), because that helper uses getDb() and wouldn't honour
 * the trx context. Inlining is a bit duplicative but is the only way to get
 * true atomicity in MySQL (where SQLite would serialize anyway).
 */
export async function cancelInterview(id: number, reason?: string): Promise<Interview> {
  const db = getDb();

  return db.transaction(async (trx) => {
    const existing = await trx<InterviewRow>('interviews').where({ id }).first();
    if (!existing) throw new Error('Interview not found');

    // Idempotency: if it's already cancelled, just return the row as-is.
    if (existing.cancelled_at) {
      return rowToInterview(existing);
    }

    // Cancelling an already-completed interview would lose audit trail.
    if (existing.result !== null) {
      throw new Error('Cannot cancel an interview with a recorded result');
    }

    // Look up the candidate inside the txn so a concurrent stage change
    // would be visible. Read raw row so we can rebuild later.
    const candidateRow = await trx('candidates').where({ id: existing.candidate_id }).first();
    if (!candidateRow) throw new Error('Candidate not found');

    // Compute new stage — throws if e.g. the candidate is already past
    // Scheduled (race condition, shouldn't normally happen).
    const event: PipelineEvent =
      existing.round === 1 ? { type: 'CANCEL_R1' } : { type: 'CANCEL_R2' };
    const newStage = transitionStage(candidateRow.stage, event);

    const now = new Date();

    // 1. Soft-cancel the interview row.
    await trx('interviews').where({ id }).update({
      cancelled_at: now,
      cancelled_reason: reason ?? null,
      updated_at: now,
    });

    // 2. Walk the candidate back. Inline UPDATE rather than updateCandidate()
    //    so it runs inside the trx (the helper uses getDb() and would skip
    //    the trx context).
    //
    //    Note: prior to PR C this also had to clear the deprecated r1_*/r2_*
    //    cache columns. Those were dropped in migration 20260428_009 — stage
    //    is the only thing left to update.
    await trx('candidates').where({ id: candidateRow.id }).update({
      stage: newStage,
      updated_at: now,
    });

    const fresh = await trx<InterviewRow>('interviews').where({ id }).first();
    if (!fresh) throw new Error('Failed to load interview after cancellation');
    return rowToInterview(fresh);
  });
}
