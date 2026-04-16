import { getDb } from '../db/index.js';
import { transitionStage, PipelineEvent } from '../logic/pipeline.js';
import { getCandidate, updateCandidate } from './candidate.js';

export type InterviewMode = 'Virtual' | 'In-Person';
export type InterviewResult = 'Select' | 'Reject';

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
  };
}

export async function listInterviews(filters: { candidateId?: string } = {}): Promise<Interview[]> {
  const q = getDb()<InterviewRow>('interviews').select('*').orderBy('scheduled_date', 'desc');
  if (filters.candidateId) q.where('candidate_id', filters.candidateId);
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
 */
export async function scheduleInterview(input: ScheduleInterviewInput): Promise<Interview> {
  const candidate = await getCandidate(input.candidateId);
  if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);

  // Compute new stage first — throws if transition is invalid.
  const event: PipelineEvent = input.round === 1 ? { type: 'SCHEDULE_R1' } : { type: 'SCHEDULE_R2' };
  const newStage = transitionStage(candidate.stage, event);

  const db = getDb();
  const existing = await db<InterviewRow>('interviews')
    .where({ candidate_id: input.candidateId, round: input.round })
    .first();

  let id: number;
  if (existing) {
    await db('interviews').where({ id: existing.id }).update({
      interviewer_name: input.interviewerName,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime ?? null,
      mode: input.mode,
      location_or_link: input.locationOrLink ?? null,
      updated_at: new Date(),
    });
    id = existing.id;
  } else {
    const [newId] = await db('interviews').insert({
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

  // Update candidate stage + denormalized r1/r2 cache.
  if (input.round === 1) {
    await updateCandidate(input.candidateId, {
      stage: newStage,
      r1By: input.interviewerName,
      r1Date: input.scheduledDate,
    });
  } else {
    await updateCandidate(input.candidateId, {
      stage: newStage,
      r2By: input.interviewerName,
      r2Date: input.scheduledDate,
    });
  }

  const fresh = await getInterview(id);
  if (!fresh) throw new Error('Failed to load interview after scheduling');
  return fresh;
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

  await db('interviews').where({ id }).update({
    result,
    updated_at: new Date(),
  });

  if (existing.round === 1) {
    await updateCandidate(candidate.id, { stage: newStage, r1Result: result });
  } else {
    await updateCandidate(candidate.id, { stage: newStage, r2Result: result });
  }

  const fresh = await getInterview(id);
  if (!fresh) throw new Error('Failed to load interview after recording result');
  return fresh;
}
