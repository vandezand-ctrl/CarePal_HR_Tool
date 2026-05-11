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

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

// Reusable test users.
// IDs 2 + 4 are CPM approvers (email matches BU_APPROVER_EMAILS.CPM).
// ID 5 is an IGIV approver.
const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const cpmApproverCaller: User = {
  id: 2, email: 'soundappan@carepalmoney.com', name: 'Soundappan', role: 'approver', city: null, domain: 'carepalmoney.com', last_login_at: null, cities: [],
};
const taCaller: User = {
  id: 3, email: 'ak@x.com', name: 'Akhlaque', role: 'ta', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const cpmApprover2Caller: User = {
  id: 4, email: 'rashi.kharari@impactguru.com', name: 'Rashi', role: 'approver', city: null, domain: 'impactguru.com', last_login_at: null, cities: [],
};
const igivApproverCaller: User = {
  id: 5, email: 'neer.samtani@impactguru.com', name: 'Neer', role: 'approver', city: null, domain: 'impactguru.com', last_login_at: null, cities: [],
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
  setCaller(adminCaller);

  await db('requisition_approvals').del();
  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  // Seed users — emails must match BU_APPROVER_EMAILS for auto-routing to work.
  await db('users').insert([
    { id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com' },
    { id: 2, email: 'soundappan@carepalmoney.com', name: 'Soundappan', role: 'approver', domain: 'carepalmoney.com' },
    { id: 3, email: 'ak@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com' },
    { id: 4, email: 'rashi.kharari@impactguru.com', name: 'Rashi', role: 'approver', domain: 'impactguru.com' },
    { id: 5, email: 'neer.samtani@impactguru.com', name: 'Neer', role: 'approver', domain: 'impactguru.com' },
    { id: 6, email: 'lazer@carepalmoney.com', name: 'Lazar', role: 'approver', domain: 'carepalmoney.com' },
    { id: 7, email: 'ashutosh.sharma@impactguru.com', name: 'Ashutosh', role: 'approver', domain: 'impactguru.com' },
    { id: 8, email: 'harish.goud@impactguru.com', name: 'Harish', role: 'approver', domain: 'impactguru.com' },
  ]);

  await db('requisitions').insert([
    {
      id: 'REQ-001', city: 'Bangalore', hospital: 'Apollo', area: 'South', bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
      raised_by_user_id: 1,
      date: '2026-04-20', status: 'Pending Approval', notes: null,
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

  // Seed approval rows for REQ-001 (CPM BU approvers)
  await db('requisition_approvals').insert([
    { requisition_id: 'REQ-001', phase: 1, user_id: 2, assigned_by: null },  // Soundappan (CPM)
    { requisition_id: 'REQ-001', phase: 1, user_id: 4, assigned_by: null },  // Rashi (CPM)
    { requisition_id: 'REQ-001', phase: 1, user_id: 7, assigned_by: null },  // Ashutosh (CPM)
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
    assert.equal(req001.approvalPhases.length, 1);
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
    assert.equal(row.approvalPhases.length, 1);
    assert.equal(row.approvalPhases[0].phase, 1);
  });

  it('404 when id is missing', async () => {
    const r = await request('GET', '/api/requisitions/REQ-999');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/requisitions — RBAC + auto-routing', () => {
  const validBody = {
    city: 'Delhi',
    hospital: 'AIIMS',
    area: null,
    bdType: 'Focus' as const,
    bu: 'CPM' as const,
    hireType: 'New' as const,
    replacementFor: null,
    notes: null,
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
    setCaller(cpmApproverCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const created = r.body as Requisition;
    assert.equal(created.city, 'Delhi');
    assert.equal(created.raisedBy, 'Soundappan');
    assert.equal(created.status, 'Pending Approval');
  });

  it('201 when caller is admin', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    assert.equal((r.body as Requisition).raisedBy, 'Sahil');
  });

  it('auto-assigns CPM BU approvers on creation', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const body = r.body as Requisition & { approvalPhases: Array<{ phase: number; approvers: Array<{ userId: number }> }> };
    assert.ok(Array.isArray(body.approvalPhases));
    assert.equal(body.approvalPhases.length, 1);
    const approverIds = body.approvalPhases[0].approvers.map((a) => a.userId).sort();
    // CPM approvers: Soundappan(2), Rashi(4), Ashutosh(7)
    assert.deepEqual(approverIds, [2, 4, 7]);
  });

  it('auto-assigns IGIV BU approvers on creation', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { ...validBody, bu: 'IGIV' });
    assert.equal(r.status, 201);
    const body = r.body as Requisition & { approvalPhases: Array<{ phase: number; approvers: Array<{ userId: number }> }> };
    const approverIds = body.approvalPhases[0].approvers.map((a) => a.userId).sort();
    // IGIV approvers: Neer(5), Lazar(6), Harish(8)
    assert.deepEqual(approverIds, [5, 6, 8]);
  });

  it('400 when required fields missing (zod failure)', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { city: 'Delhi' });
    assert.equal(r.status, 400);
  });

  it('ignores client-supplied raisedBy and uses req.user.name instead', async () => {
    setCaller(cpmApproverCaller);
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
    setCaller(cpmApproverCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Filled' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Filled');
  });

  it('400 when trying to set status to Pending Approval via PATCH', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { status: 'Pending Approval' });
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

describe('POST /api/requisitions/:id/approve — single-step any-one-of', () => {
  it('CPM approver can approve and status advances to Approved', async () => {
    setCaller(cpmApproverCaller); // user_id=2, CPM approver
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 200);
    const body = r.body as Requisition;
    assert.equal(body.status, 'Approved');
  });

  it('any-one-of: first approval is sufficient even with multiple approvers', async () => {
    setCaller(cpmApprover2Caller); // user_id=4, also CPM approver
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Approved');
  });

  it('403 if IGIV approver tries to approve a CPM req', async () => {
    setCaller(igivApproverCaller); // user_id=5, IGIV approver — not assigned to REQ-001 (CPM)
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 403);
  });

  it('403 if user has already approved', async () => {
    setCaller(cpmApproverCaller);
    await request('POST', '/api/requisitions/REQ-001/approve');
    // Re-create a pending req to test double-approve
    await db('requisitions').where('id', 'REQ-001').update({ status: 'Pending Approval' });
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 403);
  });

  it('400 if requisition is not Pending Approval', async () => {
    setCaller(cpmApproverCaller);
    const r = await request('POST', '/api/requisitions/REQ-002/approve'); // Active status
    assert.equal(r.status, 400);
  });

  it('404 for non-existent requisition', async () => {
    setCaller(cpmApproverCaller);
    const r = await request('POST', '/api/requisitions/REQ-999/approve');
    assert.equal(r.status, 404);
  });

  it('admin can approve any BU req (even when not explicitly assigned)', async () => {
    // Wipe approval rows and re-insert without admin
    await db('requisition_approvals').where('requisition_id', 'REQ-001').del();
    await db('requisition_approvals').insert([
      { requisition_id: 'REQ-001', phase: 1, user_id: 1, assigned_by: null },
    ]);
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions/REQ-001/approve');
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Approved');
  });
});

describe('PATCH /api/requisitions/:id closure date (PR-D / R3)', () => {
  it('200 — admin sets closureDate, returned + persisted', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { closureDate: '2026-06-15' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).closureDate, '2026-06-15');

    const persisted = await db('requisitions').where({ id: 'REQ-001' }).first();
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
