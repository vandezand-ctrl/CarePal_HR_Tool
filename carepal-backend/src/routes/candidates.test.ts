import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { candidatesRouter } from './candidates.js';
import type { Candidate } from '../models/candidate.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-candidates-route.sqlite');

let db: Knex;
let app: Express;

// Caller identity for the fake auth middleware. Tests mutate via setCaller().
let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null,
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
  // Fake auth middleware — populates req.user from the test-controlled global.
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(candidatesRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  setCaller(adminCaller);

  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();

  await db('requisitions').insert([
    {
      id: 'REQ-100', city: 'Bangalore', hospital: 'T', area: null, bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
      date: '2026-04-26', status: 'Active', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
    // PR-E (C1) — second req in the same city, used to test re-tagging.
    {
      id: 'REQ-200', city: 'Bangalore', hospital: 'Apollo', area: null, bd_type: 'Floater',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
      date: '2026-04-27', status: 'Active', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
  ]);
  await db('candidates').insert([
    {
      id: 'C-001', req_id: 'REQ-100', name: 'Alice', phone: '9876543210', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-002', req_id: 'REQ-100', name: 'Bob', phone: '9876500000', email: 'bob@x.com',
      city: 'Mumbai', current_role: 'BDA', company: 'Beta', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-21',
      stage: 'R1 Complete', bu: 'CPM',
    },
    {
      id: 'C-003', req_id: 'REQ-100', name: 'Cara', phone: '9876511111', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Gamma', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-22',
      stage: 'Offered', bu: 'IGIV', offer_date: '2026-04-25',
    },
    // PR-E (C3) — Joined / Training fixtures so transition tests start from a known state.
    {
      id: 'C-004', req_id: 'REQ-100', name: 'Dan', phone: '9876522222', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Delta', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-23',
      stage: 'Joined', bu: 'CPM', offer_date: '2026-04-25', join_date: '2026-05-01',
    },
    {
      id: 'C-005', req_id: 'REQ-100', name: 'Eve', phone: '9876533333', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Epsilon', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-24',
      stage: 'Training', bu: 'CPM', offer_date: '2026-04-26', join_date: '2026-05-01',
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

describe('GET /api/candidates', () => {
  it('returns all candidates when no filters', async () => {
    const r = await request('GET', '/api/candidates');
    assert.equal(r.status, 200);
    // 5 seeded: C-001 Sourced, C-002 R1 Complete, C-003 Offered, C-004 Joined, C-005 Training
    assert.equal((r.body as Candidate[]).length, 5);
  });

  it('filters by bu', async () => {
    const r = await request('GET', '/api/candidates?bu=IGIV');
    assert.equal(r.status, 200);
    const rows = r.body as Candidate[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'C-003');
  });

  it('filters by reqId', async () => {
    const r = await request('GET', '/api/candidates?reqId=REQ-100');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate[]).length, 5);
  });

  it('filters by stage', async () => {
    const r = await request('GET', '/api/candidates?stage=Offered');
    assert.equal(r.status, 200);
    const rows = r.body as Candidate[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'C-003');
  });

  it('filters by city', async () => {
    const r = await request('GET', '/api/candidates?city=Bangalore');
    assert.equal(r.status, 200);
    // C-001, C-003, C-004, C-005 are all Bangalore (4)
    assert.equal((r.body as Candidate[]).length, 4);
  });
});

describe('GET /api/candidates/:id', () => {
  it('200 returns candidate', async () => {
    const r = await request('GET', '/api/candidates/C-001');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).id, 'C-001');
  });

  it('404 when candidate does not exist', async () => {
    const r = await request('GET', '/api/candidates/C-999');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/candidates', () => {
  const validBody = {
    reqId: 'REQ-100',
    name: 'Dan',
    phone: '9999999999',
    city: 'Pune',
    currentRole: 'BDA',
    company: 'Delta',
    ta: 'Akhlaque',
    bu: 'CPM' as const,
  };

  it('201 with valid body', async () => {
    const r = await request('POST', '/api/candidates', validBody);
    assert.equal(r.status, 201);
    const body = r.body as Candidate;
    assert.equal(body.name, 'Dan');
    assert.equal(body.stage, 'Sourced');
    assert.equal(body.reqId, 'REQ-100');
  });

  it('400 when required field missing (name)', async () => {
    const { name: _name, ...bad } = validBody;
    const r = await request('POST', '/api/candidates', bad);
    assert.equal(r.status, 400);
  });

  it('400 when reqId references a missing requisition', async () => {
    const r = await request('POST', '/api/candidates', { ...validBody, reqId: 'REQ-999' });
    assert.equal(r.status, 400);
    assert.match((r.body as { error: string }).error, /REQ-999/);
  });

  it('empty-string email is normalised to null', async () => {
    const r = await request('POST', '/api/candidates', { ...validBody, email: '' });
    assert.equal(r.status, 201);
    assert.equal((r.body as Candidate).email, null);

    // Confirm persisted as NULL not empty string.
    const persisted = await db('candidates').where({ id: (r.body as Candidate).id }).first();
    assert.equal(persisted.email, null);
  });
});

describe('PATCH /api/candidates/:id', () => {
  it('200 happy path: updates phone', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { phone: '9000000000' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).phone, '9000000000');
  });

  it('404 when candidate does not exist', async () => {
    const r = await request('PATCH', '/api/candidates/C-999', { phone: '9000000000' });
    assert.equal(r.status, 404);
  });

  it('400 on invalid body (bad email)', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { email: 'not-an-email' });
    assert.equal(r.status, 400);
  });

  it('400 when attempting to set stage (strict schema rejects unknown keys)', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { stage: 'Offered' });
    assert.equal(r.status, 400);
  });
});

describe('POST /api/candidates/:id/offer', () => {
  it('200 happy path: R1 Complete -> Offered', async () => {
    const r = await request('POST', '/api/candidates/C-002/offer', { offerDate: '2026-04-30' });
    assert.equal(r.status, 200);
    const body = r.body as Candidate;
    assert.equal(body.stage, 'Offered');
    assert.equal(body.offerDate, '2026-04-30');
  });

  it('400 on illegal stage transition (from Sourced)', async () => {
    const r = await request('POST', '/api/candidates/C-001/offer', { offerDate: '2026-04-30' });
    assert.equal(r.status, 400);
  });

  it('404 when candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/offer', { offerDate: '2026-04-30' });
    assert.equal(r.status, 404);
  });

  it('400 on invalid offerDate', async () => {
    const r = await request('POST', '/api/candidates/C-002/offer', { offerDate: 'tomorrow' });
    assert.equal(r.status, 400);
  });
});

describe('POST /api/candidates/:id/join', () => {
  it('200 happy path: Offered -> Joined', async () => {
    const r = await request('POST', '/api/candidates/C-003/join', { joinDate: '2026-05-15' });
    assert.equal(r.status, 200);
    const body = r.body as Candidate;
    assert.equal(body.stage, 'Joined');
    assert.equal(body.joinDate, '2026-05-15');
  });

  it('400 on illegal transition (from Sourced)', async () => {
    const r = await request('POST', '/api/candidates/C-001/join', { joinDate: '2026-05-15' });
    assert.equal(r.status, 400);
  });

  it('404 when candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/join', { joinDate: '2026-05-15' });
    assert.equal(r.status, 404);
  });
});

// PR-E / C1 — re-tag a candidate to a different requisition.
describe('PATCH /api/candidates/:id reqId (C1 — re-tag)', () => {
  it('200 — admin re-tags C-001 from REQ-100 to REQ-200', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { reqId: 'REQ-200' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).reqId, 'REQ-200');
    const persisted = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(persisted.req_id, 'REQ-200');
  });

  it('400 — re-tag to a non-existent requisition is rejected (FK guard)', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { reqId: 'REQ-999' });
    assert.equal(r.status, 400);
  });

  it('400 — reqId in wrong format fails the schema regex', async () => {
    const r = await request('PATCH', '/api/candidates/C-001', { reqId: 'not-a-req' });
    assert.equal(r.status, 400);
  });
});

// PR-E / C2 — Expected Joining Date.
describe('PATCH /api/candidates/:id expectedJoiningDate (C2)', () => {
  it('200 — admin sets expectedJoiningDate', async () => {
    const r = await request('PATCH', '/api/candidates/C-003', { expectedJoiningDate: '2026-06-15' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).expectedJoiningDate, '2026-06-15');
  });

  it('200 — admin clears expectedJoiningDate by sending null', async () => {
    await request('PATCH', '/api/candidates/C-003', { expectedJoiningDate: '2026-06-15' });
    const r = await request('PATCH', '/api/candidates/C-003', { expectedJoiningDate: null });
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).expectedJoiningDate, null);
  });

  it('400 — bogus expectedJoiningDate string fails zod', async () => {
    const r = await request('PATCH', '/api/candidates/C-003', { expectedJoiningDate: 'soon' });
    assert.equal(r.status, 400);
  });

  it('GET shape includes expectedJoiningDate (null by default)', async () => {
    const r = await request('GET', '/api/candidates/C-001');
    assert.equal(r.status, 200);
    const body = r.body as Candidate;
    assert.ok('expectedJoiningDate' in body);
    assert.equal(body.expectedJoiningDate, null);
  });
});

// PR-E / C3 — extended stages: start-training and activate transitions.
describe('POST /api/candidates/:id/start-training (C3)', () => {
  it('200 — Joined -> Training', async () => {
    const r = await request('POST', '/api/candidates/C-004/start-training');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).stage, 'Training');
  });

  it('200 — idempotent re-entry from Training', async () => {
    const r = await request('POST', '/api/candidates/C-005/start-training');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).stage, 'Training');
  });

  it('400 — illegal from Sourced', async () => {
    const r = await request('POST', '/api/candidates/C-001/start-training');
    assert.equal(r.status, 400);
  });

  it('404 — candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/start-training');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/candidates/:id/activate (C3)', () => {
  it('200 — Training -> Active (the canonical path)', async () => {
    const r = await request('POST', '/api/candidates/C-005/activate');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).stage, 'Active');
  });

  it('200 — Joined -> Active (fast hires skip training)', async () => {
    const r = await request('POST', '/api/candidates/C-004/activate');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).stage, 'Active');
  });

  it('400 — illegal from Offered (must record join first)', async () => {
    const r = await request('POST', '/api/candidates/C-003/activate');
    assert.equal(r.status, 400);
  });

  it('404 — candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/activate');
    assert.equal(r.status, 404);
  });
});
