import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { requisitionsRouter } from './requisitions.js';
import type { Requisition } from '../models/requisition.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-requisitions-route.sqlite');

let db: Knex;
let app: Express;

// Caller identity for the fake auth middleware. Tests mutate this via
// setCaller() to exercise different RBAC paths.
let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

// Reusable test users covering each role tier.
const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const approverCaller: User = {
  id: 2, email: 'sg@x.com', name: 'Soundappan', role: 'approver', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const taCaller: User = {
  id: 3, email: 'ak@x.com', name: 'Akhlaque', role: 'ta', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const approver2Caller: User = {
  id: 4, email: 'ap2@x.com', name: 'Approver Two', role: 'approver', city: null, domain: 'x.com', last_login_at: null, cities: [],
};

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

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(requisitionsRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  // Default caller is admin so non-RBAC tests aren't blocked by 401/403.
  setCaller(adminCaller);

  // Wipe child tables first to satisfy any FK relationships.
  await db('requisition_approvals').del();
  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  // Seed users so that FK constraints (raised_by_user_id, requisition_approvals.user_id) work.
  await db('users').insert([
    { id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com' },
    { id: 2, email: 'sg@x.com', name: 'Soundappan', role: 'approver', domain: 'x.com' },
    { id: 3, email: 'ak@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com' },
    { id: 4, email: 'ap2@x.com', name: 'Approver Two', role: 'approver', domain: 'x.com' },
  ]);

  await db('requisitions').insert([
    {
      id: 'REQ-001', city: 'Bangalore', hospital: 'Apollo', area: 'South', bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
      raised_by_user_id: 1,
      date: '2026-04-20', status: 'Phase 1', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'REQ-002', city: 'Mumbai', hospital: 'Fortis', area: null, bd_type: 'Floater',
      bu: 'IGIV', hire_type: 'Replacement', replacement_for: 'Old Person', raised_by: 'Soundappan',
      raised_by_user_id: 2,
      date: '2026-04-22', status: 'Active', notes: 'urgent',
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'REQ-003', city: 'Bangalore', hospital: 'Manipal', area: null, bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
      raised_by_user_id: 1,
      date: '2026-04-25', status: 'Approved', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
  ]);

  // Seed approval rows for REQ-001 (Phase 1 status)
  await db('requisition_approvals').insert([
    { requisition_id: 'REQ-001', phase: 1, user_id: 2, assigned_by: 1 },
    { requisition_id: 'REQ-001', phase: 2, user_id: 1, assigned_by: 1 },
  ]);
});

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  url: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) {
        server.close();
        reject(new Error('no server address'));
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:${addr.port}${url}`, {
          method,
          headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        resolve({ status: res.status, body: parsed });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe('GET /api/requisitions', () => {
  it('returns all 3 seeded requisitions when no filter', async () => {
    const r = await request('GET', '/api/requisitions');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition[]).length, 3);
  });

  it('filter by bu=CPM returns 2', async () => {
    const r = await request('GET', '/api/requisitions?bu=CPM');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.bu === 'CPM'));
  });

  it('filter by city=Mumbai returns 1', async () => {
    const r = await request('GET', '/api/requisitions?city=Mumbai');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'REQ-002');
  });

  it('filter by hospital=Apollo returns 1', async () => {
    const r = await request('GET', '/api/requisitions?hospital=Apollo');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hospital, 'Apollo');
  });

  it('filter by status=Active returns 1', async () => {
    const r = await request('GET', '/api/requisitions?status=Active');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'Active');
  });

  it('combined filters bu=CPM&city=Bangalore returns 2', async () => {
    const r = await request('GET', '/api/requisitions?bu=CPM&city=Bangalore');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition[]).length, 2);
  });

  it('combined filters narrow to a single row', async () => {
    const r = await request('GET', '/api/requisitions?bu=CPM&city=Bangalore&status=Approved');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'REQ-003');
  });

  it('returns empty array when no rows match', async () => {
    const r = await request('GET', '/api/requisitions?city=Atlantis');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, []);
  });

  it('includes approvalPhases in response', async () => {
    const r = await request('GET', '/api/requisitions');
    assert.equal(r.status, 200);
    const rows = r.body as Array<Requisition & { approvalPhases: unknown[] }>;
    const req001 = rows.find((row) => row.id === 'REQ-001');
    assert.ok(req001);
    assert.ok(Array.isArray(req001.approvalPhases));
    assert.equal(req001.approvalPhases.length, 2);
  });
});

describe('GET /api/requisitions/:id', () => {
  it('200 + returns the row when id exists', async () => {
    const r = await request('GET', '/api/requisitions/REQ-001');
    assert.equal(r.status, 200);
    const row = r.body as Requisition;
    assert.equal(row.id, 'REQ-001');
    assert.equal(row.city, 'Bangalore');
    assert.equal(row.bdType, 'Focus');
  });

  it('includes approvalPhases in detail response', async () => {
    const r = await request('GET', '/api/requisitions/REQ-001');
    assert.equal(r.status, 200);
    const row = r.body as Requisition & { approvalPhases: Array<{ phase: number; approvers: unknown[]; complete: boolean }> };
    assert.ok(Array.isArray(row.approvalPhases));
    assert.equal(row.approvalPhases.length, 2);
    assert.equal(row.approvalPhases[0].phase, 1);
    assert.equal(row.approvalPhases[1].phase, 2);
  });

  it('404 when id is missing', async () => {
    const r = await request('GET', '/api/requisitions/REQ-999');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/requisitions RBAC + validation', () => {
  const validBody = {
    city: 'Delhi',
    hospital: 'AIIMS',
    area: null,
    bdType: 'Focus' as const,
    bu: 'CPM' as const,
    hireType: 'New' as const,
    replacementFor: null,
    notes: null,
    phase1Approvers: [2],
    phase2Approvers: [1],
  };

  it('401 when no caller (not authenticated)', async () => {
    setCaller(null);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 401);
  });

  it('201 when caller is TA', async () => {
    setCaller(taCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const created = r.body as Requisition;
    assert.equal(created.raisedBy, 'Akhlaque');
  });

  it('201 when caller is approver', async () => {
    setCaller(approverCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const created = r.body as Requisition;
    assert.equal(created.city, 'Delhi');
    assert.equal(created.raisedBy, 'Soundappan');
    assert.equal(created.status, 'Phase 1');
  });

  it('201 when caller is admin', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    assert.equal((r.body as Requisition).raisedBy, 'Sahil');
  });

  it('returns approvalPhases in creation response', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const body = r.body as Requisition & { approvalPhases: Array<{ phase: number; approvers: unknown[] }> };
    assert.ok(Array.isArray(body.approvalPhases));
    assert.equal(body.approvalPhases.length, 2);
  });

  it('400 when required fields missing (zod failure)', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { city: 'Delhi' });
    assert.equal(r.status, 400);
  });

  it('400 when phase1Approvers is empty', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, phase1Approvers: [] });
    assert.equal(r.status, 400);
  });

  it('400 when phase2Approvers is empty', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, phase2Approvers: [] });
    assert.equal(r.status, 400);
  });

  it('400 when phase1Approvers has more than 3', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, phase1Approvers: [1, 2, 4, 4] });
    assert.equal(r.status, 400);
  });

  it('400 when approver IDs reference non-existent users', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, phase1Approvers: [999] });
    assert.equal(r.status, 400);
  });

  it('400 when approver IDs reference a TA (wrong role)', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, phase1Approvers: [3] });
    assert.equal(r.status, 400);
  });

  it('ignores client-supplied raisedBy and uses req.user.name instead', async () => {
    setCaller(approverCaller);
    const r = await request('POST', '/api/requisitions', {
      ...validBody,
      raisedBy: 'Hacker McSpoof',
    });
    assert.equal(r.status, 201);
    assert.equal((r.body as Requisition).raisedBy, 'Soundappan');
  });
});

describe('PATCH /api/requisitions/:id RBAC + happy path', () => {
  it('401 when no caller', async () => {
    setCaller(null);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Filled' });
    assert.equal(r.status, 401);
  });

  it('403 when caller is TA', async () => {
    setCaller(taCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Filled' });
    assert.equal(r.status, 403);
  });

  it('200 when approver moves Active -> Filled', async () => {
    setCaller(approverCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Filled' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Filled');
  });

  it('400 when trying to set status to Phase 1 via PATCH', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Phase 1' });
    assert.equal(r.status, 400);
  });

  it('400 when trying to set status to Phase 2 via PATCH', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Phase 2' });
    assert.equal(r.status, 400);
  });

  it('400 when trying to set status to Approved via PATCH', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Approved' });
    assert.equal(r.status, 400);
  });

  it('200 when admin updates notes', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { notes: 'updated' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).notes, 'updated');
  });

  it('404 when requisition does not exist', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-999', { status: 'Active' });
    assert.equal(r.status, 404);
  });

  it('400 on invalid status enum value', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { status: 'Bogus' });
    assert.equal(r.status, 400);
  });
});

describe('POST /api/requisitions/:id/approve', () => {
  it('approver assigned to Phase 1 can approve', async () => {
    setCaller(approverCaller); // user_id=2, assigned to phase 1
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 200);
    const body = r.body as Requisition & { approvalPhases: Array<{ phase: number; complete: boolean }> };
    // Single approver on phase 1 → phase completes → status advances to Phase 2
    assert.equal(body.status, 'Phase 2');
  });

  it('two approvers on same phase — first does not advance, second does', async () => {
    // Add a second approver to phase 1
    await db('requisition_approvals').insert({
      requisition_id: 'REQ-001', phase: 1, user_id: 4, assigned_by: 1,
    });

    setCaller(approverCaller); // user_id=2
    const r1 = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r1.status, 200);
    assert.equal((r1.body as Requisition).status, 'Phase 1'); // still Phase 1

    setCaller(approver2Caller); // user_id=4
    const r2 = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r2.status, 200);
    assert.equal((r2.body as Requisition).status, 'Phase 2'); // now advances
  });

  it('completing Phase 2 advances to Approved', async () => {
    // First complete Phase 1
    setCaller(approverCaller);
    await request('POST', '/api/requisitions/REQ-001/approve');
    // Now status is Phase 2, admin (id=1) is on phase 2
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Approved');
  });

  it('403 if user is not assigned to the active phase', async () => {
    // admin (id=1) is assigned to phase 2, not phase 1
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 403);
  });

  it('403 if user has already approved', async () => {
    setCaller(approverCaller);
    await request('POST', '/api/requisitions/REQ-001/approve');
    // Phase advances to Phase 2 (single approver), but let's test double-approve
    // by adding approver back to phase 2 and trying to approve twice
    await db('requisition_approvals').insert({
      requisition_id: 'REQ-001', phase: 2, user_id: 2, assigned_by: 1,
    });
    const r1 = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r1.status, 200);
    const r2 = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r2.status, 403);
  });

  it('400 if requisition is not in a pending-approval status', async () => {
    setCaller(approverCaller);
    const r = await request('POST', '/api/requisitions/REQ-002/approve'); // Active status
    assert.equal(r.status, 400);
  });

  it('404 for non-existent requisition', async () => {
    setCaller(approverCaller);
    const r = await request('POST', '/api/requisitions/REQ-999/approve');
    assert.equal(r.status, 404);
  });
});

describe('PUT /api/requisitions/:id/approvers', () => {
  it('req owner can change approvers', async () => {
    setCaller(adminCaller); // id=1, owner of REQ-001
    const r = await request('PUT', '/api/requisitions/REQ-001/approvers', {
      phase: 1,
      approverIds: [4],
    });
    assert.equal(r.status, 200);
    const body = r.body as Requisition & { approvalPhases: Array<{ phase: number; approvers: Array<{ userId: number }> }> };
    const phase1 = body.approvalPhases.find((p) => p.phase === 1);
    assert.ok(phase1);
    assert.equal(phase1.approvers.length, 1);
    assert.equal(phase1.approvers[0].userId, 4);
  });

  it('admin (non-owner) can change approvers', async () => {
    // REQ-002 is owned by Soundappan (id=2), admin (id=1) should still be allowed
    await db('requisition_approvals').insert([
      { requisition_id: 'REQ-002', phase: 1, user_id: 2, assigned_by: 2 },
      { requisition_id: 'REQ-002', phase: 2, user_id: 1, assigned_by: 2 },
    ]);
    setCaller(adminCaller);
    const r = await request('PUT', '/api/requisitions/REQ-002/approvers', {
      phase: 1,
      approverIds: [1, 4],
    });
    assert.equal(r.status, 200);
  });

  it('403 when non-owner non-admin tries to change approvers', async () => {
    setCaller(taCaller); // id=3, not owner of REQ-001
    const r = await request('PUT', '/api/requisitions/REQ-001/approvers', {
      phase: 1,
      approverIds: [4],
    });
    assert.equal(r.status, 403);
  });

  it('400 when approverIds is empty', async () => {
    setCaller(adminCaller);
    const r = await request('PUT', '/api/requisitions/REQ-001/approvers', {
      phase: 1,
      approverIds: [],
    });
    assert.equal(r.status, 400);
  });

  it('400 when approverIds has more than 3', async () => {
    setCaller(adminCaller);
    const r = await request('PUT', '/api/requisitions/REQ-001/approvers', {
      phase: 1,
      approverIds: [1, 2, 4, 4],
    });
    assert.equal(r.status, 400);
  });

  it('400 when approver ID references a TA', async () => {
    setCaller(adminCaller);
    const r = await request('PUT', '/api/requisitions/REQ-001/approvers', {
      phase: 1,
      approverIds: [3],
    });
    assert.equal(r.status, 400);
  });

  it('404 for non-existent requisition', async () => {
    setCaller(adminCaller);
    const r = await request('PUT', '/api/requisitions/REQ-999/approvers', {
      phase: 1,
      approverIds: [2],
    });
    assert.equal(r.status, 404);
  });
});

describe('PATCH /api/requisitions/:id closure date (PR-D / R3)', () => {
  it('200 — admin sets closureDate, returned + persisted', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { closureDate: '2026-06-15' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).closureDate, '2026-06-15');

    const persisted = await db('requisitions').where({ id: 'REQ-001' }).first();
    // SQLite stores DATE as text; trim any time component if the driver added one.
    const stored = String(persisted.closure_date).slice(0, 10);
    assert.equal(stored, '2026-06-15');
  });

  it('200 — admin clears closureDate by sending null', async () => {
    setCaller(adminCaller);
    await request('PATCH', '/api/requisitions/REQ-001', { closureDate: '2026-06-15' });
    const r = await request('PATCH', '/api/requisitions/REQ-001', { closureDate: null });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).closureDate, null);
  });

  it('400 — bogus closureDate string fails zod validation', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { closureDate: 'tomorrow' });
    assert.equal(r.status, 400);
  });

  it('GET shape includes closureDate (null by default)', async () => {
    setCaller(adminCaller);
    const r = await request('GET', '/api/requisitions/REQ-001');
    assert.equal(r.status, 200);
    const body = r.body as Requisition;
    assert.ok('closureDate' in body, 'closureDate field present in GET response');
    assert.equal(body.closureDate, null);
  });
});

describe('GET /api/requisitions — city scoping', () => {
  it('TA with cities=[Bangalore] only sees Bangalore requisitions', async () => {
    setCaller({ ...taCaller, cities: ['Bangalore'] });
    const r = await request('GET', '/api/requisitions');
    assert.equal(r.status, 200);
    const rows = r.body as Requisition[];
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.city === 'Bangalore'));
  });

  it('TA with no cities sees empty results', async () => {
    setCaller({ ...taCaller, cities: [] });
    const r = await request('GET', '/api/requisitions');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, []);
  });

  it('admin sees all requisitions regardless of cities field', async () => {
    setCaller({ ...adminCaller, cities: [] });
    const r = await request('GET', '/api/requisitions');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition[]).length, 3);
  });
});
