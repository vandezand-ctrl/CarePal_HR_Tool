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
    assert.equal((r.body as Candidate[]).length, 3);
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
    assert.equal((r.body as Candidate[]).length, 3);
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
    assert.equal((r.body as Candidate[]).length, 2);
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
