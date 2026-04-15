import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transitionStage } from './pipeline.js';

describe('transitionStage', () => {
  describe('SCHEDULE_R1', () => {
    it('moves Sourced -> R1 Scheduled', () => {
      assert.equal(transitionStage('Sourced', { type: 'SCHEDULE_R1' }), 'R1 Scheduled');
    });
    it('allows reschedule from R1 Scheduled', () => {
      assert.equal(transitionStage('R1 Scheduled', { type: 'SCHEDULE_R1' }), 'R1 Scheduled');
    });
    it('rejects from R2 Scheduled', () => {
      assert.throws(() => transitionStage('R2 Scheduled', { type: 'SCHEDULE_R1' }));
    });
    it('rejects from Joined', () => {
      assert.throws(() => transitionStage('Joined', { type: 'SCHEDULE_R1' }));
    });
  });

  describe('RECORD_R1_RESULT', () => {
    it('R1 Scheduled + Select -> R1 Complete', () => {
      assert.equal(transitionStage('R1 Scheduled', { type: 'RECORD_R1_RESULT', result: 'Select' }), 'R1 Complete');
    });
    it('R1 Scheduled + Reject -> R1 Complete (rejection stays in R1 Complete)', () => {
      assert.equal(transitionStage('R1 Scheduled', { type: 'RECORD_R1_RESULT', result: 'Reject' }), 'R1 Complete');
    });
    it('allows updating result from R1 Complete (re-record)', () => {
      assert.equal(transitionStage('R1 Complete', { type: 'RECORD_R1_RESULT', result: 'Select' }), 'R1 Complete');
    });
    it('rejects from Sourced (no R1 scheduled yet)', () => {
      assert.throws(() => transitionStage('Sourced', { type: 'RECORD_R1_RESULT', result: 'Select' }));
    });
  });

  describe('SCHEDULE_R2', () => {
    it('R1 Complete -> R2 Scheduled', () => {
      assert.equal(transitionStage('R1 Complete', { type: 'SCHEDULE_R2' }), 'R2 Scheduled');
    });
    it('allows reschedule from R2 Scheduled', () => {
      assert.equal(transitionStage('R2 Scheduled', { type: 'SCHEDULE_R2' }), 'R2 Scheduled');
    });
    it('rejects from R1 Scheduled (R1 not complete yet)', () => {
      assert.throws(() => transitionStage('R1 Scheduled', { type: 'SCHEDULE_R2' }));
    });
    it('rejects from Sourced', () => {
      assert.throws(() => transitionStage('Sourced', { type: 'SCHEDULE_R2' }));
    });
  });

  describe('RECORD_R2_RESULT', () => {
    it('R2 Scheduled + Select -> R2 Complete', () => {
      assert.equal(transitionStage('R2 Scheduled', { type: 'RECORD_R2_RESULT', result: 'Select' }), 'R2 Complete');
    });
    it('R2 Scheduled + Reject -> R2 Complete', () => {
      assert.equal(transitionStage('R2 Scheduled', { type: 'RECORD_R2_RESULT', result: 'Reject' }), 'R2 Complete');
    });
    it('rejects from R1 Complete (R2 not scheduled)', () => {
      assert.throws(() => transitionStage('R1 Complete', { type: 'RECORD_R2_RESULT', result: 'Select' }));
    });
  });

  describe('MAKE_OFFER', () => {
    it('R2 Complete -> Offered', () => {
      assert.equal(transitionStage('R2 Complete', { type: 'MAKE_OFFER' }), 'Offered');
    });
    it('R1 Complete -> Offered (skip R2 for senior hires)', () => {
      assert.equal(transitionStage('R1 Complete', { type: 'MAKE_OFFER' }), 'Offered');
    });
    it('rejects from Sourced', () => {
      assert.throws(() => transitionStage('Sourced', { type: 'MAKE_OFFER' }));
    });
    it('rejects from R1 Scheduled', () => {
      assert.throws(() => transitionStage('R1 Scheduled', { type: 'MAKE_OFFER' }));
    });
  });

  describe('RECORD_JOIN', () => {
    it('Offered -> Joined', () => {
      assert.equal(transitionStage('Offered', { type: 'RECORD_JOIN' }), 'Joined');
    });
    it('allows re-recording Join (idempotent)', () => {
      assert.equal(transitionStage('Joined', { type: 'RECORD_JOIN' }), 'Joined');
    });
    it('rejects from R2 Complete (must offer first)', () => {
      assert.throws(() => transitionStage('R2 Complete', { type: 'RECORD_JOIN' }));
    });
  });

  describe('Happy path — full pipeline', () => {
    it('walks Sourced -> Joined end to end', () => {
      let stage: ReturnType<typeof transitionStage> = 'Sourced';
      stage = transitionStage(stage, { type: 'SCHEDULE_R1' });
      assert.equal(stage, 'R1 Scheduled');
      stage = transitionStage(stage, { type: 'RECORD_R1_RESULT', result: 'Select' });
      assert.equal(stage, 'R1 Complete');
      stage = transitionStage(stage, { type: 'SCHEDULE_R2' });
      assert.equal(stage, 'R2 Scheduled');
      stage = transitionStage(stage, { type: 'RECORD_R2_RESULT', result: 'Select' });
      assert.equal(stage, 'R2 Complete');
      stage = transitionStage(stage, { type: 'MAKE_OFFER' });
      assert.equal(stage, 'Offered');
      stage = transitionStage(stage, { type: 'RECORD_JOIN' });
      assert.equal(stage, 'Joined');
    });
  });
});
