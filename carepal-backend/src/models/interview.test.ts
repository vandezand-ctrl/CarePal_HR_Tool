import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import {
  listInterviews,
  scheduleInterview,
  recordInterviewResult,
  cancelInterview,
} from './interview.js';
import { getCandidate } from './candidate.js';

const TEST_DB_PATH = path.resolve('./data/test-interview-model.sqlite');

let db: Knex;

before(async () => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });
  db = knex({
    client: 'better-sqlite3',
    connection: { filename: TEST_DB_PATH },
    useNullAsDefault: true,
  });
  await db.migrate.latest({ directory: path.resolve('./migrations'), extension: 'js' });
  setDbForTesting(db);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  // Clean slate every test — easier than tracking IDs across tests.
  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  await db('users').insert({
    id: 1, email: 'sahil@carepalmoney.com', name: 'Sahil', role: 'admin',
    domain: 'carepalmoney.com', city: null,
  });
  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'Test', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
    date: '2026-04-26', status: 'Active', notes: null,
    created_at: new Date(), updated_at: new Date(),
  });
  // Three candidates at different stages — easier to set up test scenarios.
  await db('candidates').insert([
    {
      id: 'C-001', req_id: 'REQ-100', name: 'Sourced Sam', phone: '9876543210',
      email: null, city: 'Bangalore', current_role: 'BDA', company: 'Acme',
      current_ctc: null, expected_ctc: null, notice: null, ta: 'Akhlaque',
      sourced_at: '2026-04-20', stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-002', req_id: 'REQ-100', name: 'R1Done Reena', phone: '9876543211',
      email: null, city: 'Bangalore', current_role: 'BDA', company: 'Acme',
      current_ctc: null, expected_ctc: null, notice: null, ta: 'Akhlaque',
      sourced_at: '2026-04-20', stage: 'R1 Complete', bu: 'CPM',
      r1_by: 'Himanshu Jaiswal', r1_date: '2026-04-22', r1_result: 'Select',
    },
    {
      id: 'C-003', req_id: 'REQ-100', name: 'Dont Touch Me', phone: '9876543212',
      email: null, city: 'Bangalore', current_role: 'BDA', company: 'Acme',
      current_ctc: null, expected_ctc: null, notice: null, ta: 'Akhlaque',
      sourced_at: '2026-04-20', stage: 'Sourced', bu: 'CPM',
    },
  ]);
});

const baseSchedule = {
  interviewerName: 'Himanshu Jaiswal',
  scheduledDate: '2026-04-28',
  scheduledTime: '10:00',
  mode: 'Virtual' as const,
  locationOrLink: 'https://meet.google.com/abc',
};

describe('listInterviews filters', () => {
  beforeEach(async () => {
    // Two scheduled R1s + one R2 with a result + one cancelled.
    await scheduleInterview({ ...baseSchedule, candidateId: 'C-001', round: 1, scheduledDate: '2026-04-28' });
    await scheduleInterview({ ...baseSchedule, candidateId: 'C-003', round: 1, scheduledDate: '2026-05-05', interviewerName: 'Khazim Syed' });
    await scheduleInterview({ ...baseSchedule, candidateId: 'C-002', round: 2, scheduledDate: '2026-05-01', interviewerName: 'Soundappan Gopal' });
    const r2 = await listInterviews({ candidateId: 'C-002' });
    await recordInterviewResult(r2[0].id, 'Select');
  });

  it('candidateId filter — returns only that candidate', async () => {
    const rows = await listInterviews({ candidateId: 'C-001' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].candidateId, 'C-001');
  });

  it('dateFrom/dateTo — inclusive range filter', async () => {
    const rows = await listInterviews({ dateFrom: '2026-04-29', dateTo: '2026-05-02' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].candidateId, 'C-002');
  });

  it('round filter', async () => {
    const r1Only = await listInterviews({ round: 1 });
    assert.equal(r1Only.length, 2);
    assert.ok(r1Only.every(r => r.round === 1));
  });

  it('result filter — "Scheduled" pseudo-value matches IS NULL', async () => {
    const scheduled = await listInterviews({ result: 'Scheduled' });
    assert.equal(scheduled.length, 2);
    assert.ok(scheduled.every(r => r.result === null));
  });

  it('result filter — concrete result', async () => {
    const selected = await listInterviews({ result: 'Select' });
    assert.equal(selected.length, 1);
    assert.equal(selected[0].candidateId, 'C-002');
  });

  it('interviewerName filter', async () => {
    const rows = await listInterviews({ interviewerName: 'Khazim Syed' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].candidateId, 'C-003');
  });

  it('cancelled rows hidden by default', async () => {
    const all = await listInterviews({ candidateId: 'C-001' });
    const id = all[0].id;
    await cancelInterview(id);
    const after = await listInterviews({ candidateId: 'C-001' });
    assert.equal(after.length, 0, 'cancelled row hidden');
  });

  it('includeCancelled=true brings them back', async () => {
    const all = await listInterviews({ candidateId: 'C-001' });
    await cancelInterview(all[0].id);
    const after = await listInterviews({ candidateId: 'C-001', includeCancelled: true });
    assert.equal(after.length, 1);
    assert.ok(after[0].cancelledAt);
  });
});

describe('cancelInterview', () => {
  it('R1 Scheduled -> Sourced + clears r1_* cache', async () => {
    const interview = await scheduleInterview({ ...baseSchedule, candidateId: 'C-001', round: 1 });
    // Pre-condition: candidate is now R1 Scheduled with r1 cache populated.
    let candidate = await getCandidate('C-001');
    assert.equal(candidate?.stage, 'R1 Scheduled');
    assert.equal(candidate?.r1By, 'Himanshu Jaiswal');

    const cancelled = await cancelInterview(interview.id, 'interviewer sick');

    assert.ok(cancelled.cancelledAt, 'interview row marked cancelled');
    assert.equal(cancelled.cancelledReason, 'interviewer sick');

    candidate = await getCandidate('C-001');
    assert.equal(candidate?.stage, 'Sourced', 'candidate reverted to Sourced');
    assert.equal(candidate?.r1By, null, 'r1_by cleared');
    assert.equal(candidate?.r1Date, null, 'r1_date cleared');
    assert.equal(candidate?.r1Result, null, 'r1_result cleared');
  });

  it('R2 Scheduled -> R1 Complete + clears r2_* cache, keeps r1_* intact', async () => {
    // C-002 starts at R1 Complete with R1 Select. Schedule R2.
    const r2 = await scheduleInterview({ ...baseSchedule, candidateId: 'C-002', round: 2, interviewerName: 'Soundappan Gopal' });
    let candidate = await getCandidate('C-002');
    assert.equal(candidate?.stage, 'R2 Scheduled');

    await cancelInterview(r2.id);

    candidate = await getCandidate('C-002');
    assert.equal(candidate?.stage, 'R1 Complete', 'reverted to R1 Complete');
    assert.equal(candidate?.r2By, null, 'r2_by cleared');
    assert.equal(candidate?.r1Result, 'Select', 'r1_result preserved (was Select before)');
    assert.equal(candidate?.r1By, 'Himanshu Jaiswal', 'r1_by preserved');
  });

  it('cancel of an already-completed interview returns 400-shaped error', async () => {
    const interview = await scheduleInterview({ ...baseSchedule, candidateId: 'C-001', round: 1 });
    await recordInterviewResult(interview.id, 'Select');
    await assert.rejects(
      () => cancelInterview(interview.id),
      /Cannot cancel an interview with a recorded result/,
    );
    // Confirm side-effects didn't fire: candidate stage and interview row untouched.
    const candidate = await getCandidate('C-001');
    assert.equal(candidate?.stage, 'R1 Complete');
    const fresh = (await listInterviews({ candidateId: 'C-001' }))[0];
    assert.equal(fresh.cancelledAt, null);
  });

  it('idempotent — cancelling an already-cancelled interview returns the same row, no second-revert', async () => {
    const interview = await scheduleInterview({ ...baseSchedule, candidateId: 'C-001', round: 1 });
    const first = await cancelInterview(interview.id, 'first reason');
    // After first cancel: candidate at Sourced.
    const candAfterFirst = await getCandidate('C-001');
    assert.equal(candAfterFirst?.stage, 'Sourced');

    // Second cancel: should be a no-op for stage.
    const second = await cancelInterview(interview.id, 'should be ignored');
    assert.equal(second.cancelledReason, 'first reason', 'reason from first cancel preserved');
    assert.equal(second.cancelledAt, first.cancelledAt, 'cancelled_at from first cancel preserved');
  });

  it('cancel of nonexistent interview throws not found', async () => {
    await assert.rejects(() => cancelInterview(99999), /Interview not found/);
  });
});

describe('No-show result preserves stage', () => {
  it('R1 Scheduled + No-show -> R1 Complete with result=No-show', async () => {
    const i = await scheduleInterview({ ...baseSchedule, candidateId: 'C-001', round: 1 });
    const recorded = await recordInterviewResult(i.id, 'No-show');
    assert.equal(recorded.result, 'No-show');
    const candidate = await getCandidate('C-001');
    assert.equal(candidate?.stage, 'R1 Complete');
    assert.equal(candidate?.r1Result, 'No-show');
  });
});
