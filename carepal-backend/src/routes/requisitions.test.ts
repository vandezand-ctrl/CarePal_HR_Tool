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
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null,
};
const approverCaller: User = {
  id: 2, email: 'sg@x.com', name: 'Soundappan', role: 'approver', city: null, domain: 'x.com', last_login_at: null,
};
const taCaller: User = {
  id: 3, email: 'ak@x.com', name: 'Akhlaque', role: 'ta', city: null, domain: 'x.com', last_login_at: null,
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
  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();

  await db('requisitions').insert([
    {
      id: 'REQ-001', city: 'Bangalore', hospital: 'Apollo', area: 'South', bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
      date: '2026-04-20', status: 'Pending Approval', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'REQ-002', city: 'Mumbai', hospital: 'Fortis', area: null, bd_type: 'Floater',
      bu: 'IGIV', hire_type: 'Replacement', replacement_for: 'Old Person', raised_by: 'Soundappan',
      date: '2026-04-22', status: 'Active', notes: 'urgent',
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'REQ-003', city: 'Bangalore', hospital: 'Manipal', area: null, bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Sahil',
      date: '2026-04-25', status: 'Approved', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
  ]);
});

async function request(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  };

  it('401 when no caller (not authenticated)', async () => {
    setCaller(null);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 401);
  });

  it('403 when caller is TA', async () => {
    setCaller(taCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 403);
  });

  it('201 when caller is approver', async () => {
    setCaller(approverCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    const created = r.body as Requisition;
    assert.equal(created.city, 'Delhi');
    // raisedBy is sourced from req.user.name, never the request body.
    assert.equal(created.raisedBy, 'Soundappan');
    assert.equal(created.status, 'Pending Approval');
  });

  it('201 when caller is admin', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', validBody);
    assert.equal(r.status, 201);
    assert.equal((r.body as Requisition).raisedBy, 'Sahil');
  });

  it('400 when required fields missing (zod failure)', async () => {
    setCaller(adminCaller);
    const r = await request('POST', '/api/requisitions', { city: 'Delhi' });
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
    const r = await request('PATCH', '/api/requisitions/REQ-001', { status: 'Approved' });
    assert.equal(r.status, 401);
  });

  it('403 when caller is TA', async () => {
    setCaller(taCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { status: 'Approved' });
    assert.equal(r.status, 403);
  });

  it('200 when approver moves Pending Approval -> Approved', async () => {
    setCaller(approverCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { status: 'Approved' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).status, 'Approved');

    const persisted = await db('requisitions').where({ id: 'REQ-001' }).first();
    assert.equal(persisted.status, 'Approved');
  });

  it('200 when admin updates notes', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-002', { notes: 'updated' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Requisition).notes, 'updated');
  });

  it('404 when requisition does not exist', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-999', { status: 'Approved' });
    assert.equal(r.status, 404);
  });

  it('400 on invalid status enum value', async () => {
    setCaller(adminCaller);
    const r = await request('PATCH', '/api/requisitions/REQ-001', { status: 'Bogus' });
    assert.equal(r.status, 400);
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
