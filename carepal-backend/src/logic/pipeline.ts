import type { PipelineStage } from '../models/candidate.js';

export type PipelineEvent =
  | { type: 'SCHEDULE_R1' }
  | { type: 'RECORD_R1_RESULT'; result: 'Select' | 'Reject' }
  | { type: 'SCHEDULE_R2' }
  | { type: 'RECORD_R2_RESULT'; result: 'Select' | 'Reject' }
  | { type: 'MAKE_OFFER' }
  | { type: 'RECORD_JOIN' };

/**
 * Pure state transition for a candidate's pipeline stage.
 * Returns the new stage, or throws if the transition is invalid.
 *
 * Rejections don't move to a terminal "Rejected" stage — they sit in
 * R1 Complete / R2 Complete with result=Reject (matches existing UI).
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

    case 'MAKE_OFFER':
      // Can offer directly from R1 Complete (skip R2 for City Head hires) or from R2 Complete.
      if (current === 'R1 Complete' || current === 'R2 Complete' || current === 'Offered') return 'Offered';
      throw new Error(`Cannot make offer from stage '${current}'`);

    case 'RECORD_JOIN':
      if (current === 'Offered' || current === 'Joined') return 'Joined';
      throw new Error(`Cannot record join from stage '${current}'`);
  }
}
