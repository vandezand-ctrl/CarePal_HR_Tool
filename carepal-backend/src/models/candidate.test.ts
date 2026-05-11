import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { createCandidate } from './candidate.js';
import { getRequisition } from './requisition.js';

// Auto-transition behavior: when a candidate is added to a requisition that
// was 'Approved', the req should flip to 'Active'. Other statuses untouched.

const TEST_DB_PATH = path.resolve('./data/test-candidate-model.sqlite');

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

// PR-L: candidates need at least one assignment. The user 'Akhlaque' is
// inserted in beforeEach so createCandidate({ taIds: [akhlaqueId] }) works.
let akhlaqueId: number;

beforeEach(async () => {
  await db('candidate_assignments').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();
  await db('users').insert([
    { id: 1, email: 'a@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com', city: null },
  ]);
  akhlaqueId = 1;
  // Three reqs in different states so we can assert each transition path.
  await db('requisitions').insert([
    { id: 'REQ-100', city: 'Bangalore', hospital: 'Test Hospital', area: null, bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil', date: '2026-04-26', status: 'Approved', notes: null, created_at: new Date(), updated_at: new Date() },
    { id: 'REQ-101', city: 'Bangalore', hospital: 'Test Hospital', area: null, bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil', date: '2026-04-26', status: 'Pending Approval', notes: null, created_at: new Date(), updated_at: new Date() },
    { id: 'REQ-102', city: 'Bangalore', hospital: 'Test Hospital', area: null, bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil', date: '2026-04-26', status: 'Active', notes: null, created_at: new Date(), updated_at: new Date() },
    { id: 'REQ-103', city: 'Bangalore', hospital: 'Test Hospital', area: null, bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil', date: '2026-04-26', status: 'Filled', notes: null, created_at: new Date(), updated_at: new Date() },
  ]);
});

const baseCandidate = () => ({
  name: 'Test Person',
  phone: '9876543210',
  email: null,
  city: 'Bangalore',
  currentRole: 'BDA',
  company: 'Acme',
  currentCTC: null,
  expectedCTC: null,
  notice: null,
  taIds: [akhlaqueId],
  bu: 'CPM' as const,
});

describe('createCandidate auto-transitions requisition status', () => {
  it('promotes Approved -> Active on first candidate', async () => {
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-100' });
    const req = await getRequisition('REQ-100');
    assert.equal(req?.status, 'Active');
  });

  it('does NOT touch a Pending Approval req (cant short-circuit approval)', async () => {
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-101' });
    const req = await getRequisition('REQ-101');
    assert.equal(req?.status, 'Pending Approval');
  });

  it('leaves an already-Active req as Active (idempotent)', async () => {
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-102' });
    const req = await getRequisition('REQ-102');
    assert.equal(req?.status, 'Active');
  });

  it('leaves a Filled req as Filled (does not reopen)', async () => {
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-103' });
    const req = await getRequisition('REQ-103');
    assert.equal(req?.status, 'Filled');
  });

  it('only the first candidate triggers the transition (subsequent are no-ops)', async () => {
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-100' });
    // First candidate: req is now Active.
    assert.equal((await getRequisition('REQ-100'))?.status, 'Active');
    // Second candidate against the same (now Active) req: status stays Active.
    // The conditional UPDATE matches zero rows when status != 'Approved'.
    await createCandidate({ ...baseCandidate(), reqId: 'REQ-100', name: 'Second' });
    assert.equal((await getRequisition('REQ-100'))?.status, 'Active');
  });
});
