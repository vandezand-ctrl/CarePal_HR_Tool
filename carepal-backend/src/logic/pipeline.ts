import type { PipelineStage } from '../models/candidate.js';

export type InterviewResult = 'Select' | 'Reject' | 'No-show';

export type PipelineEvent =
  | { type: 'SCHEDULE_R1' }
  | { type: 'RECORD_R1_RESULT'; result: InterviewResult }
  | { type: 'SCHEDULE_R2' }
  | { type: 'RECORD_R2_RESULT'; result: InterviewResult }
  | { type: 'CANCEL_R1' }
  | { type: 'CANCEL_R2' }
  | { type: 'MAKE_OFFER' }
  | { type: 'RECORD_JOIN' }
  | { type: 'START_TRAINING' }
  | { type: 'MARK_ACTIVE' };

/**
 * Pure state transition for a candidate's pipeline stage.
 * Returns the new stage, or throws if the transition is invalid.
 *
 * Rejections + No-shows don't move to a terminal "Rejected" stage — they sit
 * in R1 Complete / R2 Complete with the recorded result (matches existing UI
 * and lets the candidate be re-considered later if needed).
 *
 * Cancels apply only to *scheduled-but-not-yet-recorded* interviews. Once a
 * result is recorded, cancellation isn't available — the audit trail of what
 * actually happened wins over a "soft delete." The cancelInterview model
 * function rejects those cases at the route layer with a 400.
 */
export function transitionStage(current: PipelineStage, event: PipelineEvent): PipelineStage {
  switch (event.type) {
    case 'SCHEDULE_R1':
      // Allow rescheduling from Sourced or from R1 Scheduled itself.
      if (current === 'Sourced' || current === 'R1 Scheduled') return 'R1 Scheduled';
      throw new Error(`Cannot schedule R1 from stage '${current}'`);

    case 'RECORD_R1_RESULT':
      if (current === 'R1 Scheduled' || current === 'R1 Complete') return 'R1 Complete';
      throw new Error(`Cannot record R1 result from stage '${current}'`);

    case 'SCHEDULE_R2':
      // Only after an R1 Select; can reschedule from R2 Scheduled too.
      if (current === 'R1 Complete' || current === 'R2 Scheduled') return 'R2 Scheduled';
      throw new Error(`Cannot schedule R2 from stage '${current}'`);

    case 'RECORD_R2_RESULT':
      if (current === 'R2 Scheduled' || current === 'R2 Complete') return 'R2 Complete';
      throw new Error(`Cannot record R2 result from stage '${current}'`);

    case 'CANCEL_R1':
      // Cancelling the only R1 Scheduled drops the candidate back to the
      // pre-scheduling state (Sourced). Cancelling from R1 Complete is invalid
      // because a result was already recorded — preserve the audit trail.
      if (current === 'R1 Scheduled') return 'Sourced';
      throw new Error(`Cannot cancel R1 from stage '${current}'`);

    case 'CANCEL_R2':
      // Cancelling R2 Scheduled drops the candidate back to R1 Complete (the
      // R1 Select that qualified them for R2 still stands).
      if (current === 'R2 Scheduled') return 'R1 Complete';
      throw new Error(`Cannot cancel R2 from stage '${current}'`);

    case 'MAKE_OFFER':
      // Can offer directly from R1 Complete (skip R2 for City Head hires) or from R2 Complete.
      if (current === 'R1 Complete' || current === 'R2 Complete' || current === 'Offered') return 'Offered';
      throw new Error(`Cannot make offer from stage '${current}'`);

    case 'RECORD_JOIN':
      if (current === 'Offered' || current === 'Joined') return 'Joined';
      throw new Error(`Cannot record join from stage '${current}'`);

    case 'START_TRAINING':
      // Allow re-entering Training (idempotent — admin clicks twice).
      if (current === 'Joined' || current === 'Training') return 'Training';
      throw new Error(`Cannot start training from stage '${current}'`);

    case 'MARK_ACTIVE':
      // Allow direct Joined -> Active for hires that skip a training period
      // (rare, but valid). Idempotent re-entry from Active.
      if (current === 'Training' || current === 'Joined' || current === 'Active') return 'Active';
      throw new Error(`Cannot mark active from stage '${current}'`);
  }
}
