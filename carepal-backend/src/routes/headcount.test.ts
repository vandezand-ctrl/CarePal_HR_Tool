import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { headcountRouter } from './headcount.js';
import type { HeadcountRow } from '../models/headcount.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-headcount-route.sqlite');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null,
};
const taCaller: User = {
  id: 2, email: 'ta@x.com', name: 'TA', role: 'ta', city: null, domain: 'x.com', last_login_at: null,
};
const approverCaller: User = {
  id: 3, email: 'app@x.com', name: 'Appr', role: 'approver', city: null, domain: 'x.com', last_login_at: null,
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
  app.use(headcountRouter);
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
  await db('candidate_assignments').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('headcount').del();
  await db('users').del();
  // PR-L: Akhlaque (id=1) is the assignee for all seeded candidates.
  await db('users').insert([
    { id: 1, email: 'a@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com', city: null },
  ]);

  await db('headcount').insert([
    { city: 'Bangalore', bu: 'CPM', aop: 5 },
    { city: 'Hyderabad', bu: 'IGIV', aop: 3 },
  ]);
  await db('requisitions').insert([
    {
      id: 'REQ-CPM', city: 'Bangalore', hospital: 'H1', area: null, bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
      date: '2026-04-26', status: 'Active', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'REQ-IGIV', city: 'Hyderabad', hospital: 'H2', area: null, bd_type: 'Focus',
      bu: 'IGIV', hire_type: 'New', replacement_for: null, raised_by: 'S',
      date: '2026-04-26', status: 'Active', notes: null,
      created_at: new Date(), updated_at: new Date(),
    },
  ]);
  // Stage semantics after PR-E (C3): Active drives the "active" count;
  // Training drives the "training" count; Offered drives the "offered" count.
  // 'Joined' is a transient state (signed but not yet ramping/working) and
  // intentionally not counted by getHeadcountView — surfaced via the funnel.
  await db('candidates').insert([
    {
      id: 'C-CPM-A', req_id: 'REQ-CPM', name: 'Active', phone: '1', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Active', bu: 'CPM',
    },
    {
      id: 'C-CPM-T', req_id: 'REQ-CPM', name: 'Trainee', phone: '2', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Training', bu: 'CPM',
    },
    {
      id: 'C-CPM-O', req_id: 'REQ-CPM', name: 'Offered', phone: '3', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Offered', bu: 'CPM',
    },
    {
      id: 'C-CPM-S', req_id: 'REQ-CPM', name: 'Sourced', phone: '4', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-IGIV-A', req_id: 'REQ-IGIV', name: 'IgivActive', phone: '5', email: null,
      city: 'Hyderabad', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Active', bu: 'IGIV',
    },
  ]);
  await db('candidate_assignments').insert(
    ['C-CPM-A', 'C-CPM-T', 'C-CPM-O', 'C-CPM-S', 'C-IGIV-A'].map((cid) => ({
      candidate_id: cid, user_id: 1,
    })),
  );
});

async function request(
  method: 'GET' | 'PUT',
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

describe('GET /api/headcount', () => {
  it('returns array with the expected per-row shape', async () => {
    const r = await request('GET', '/api/headcount');
    assert.equal(r.status, 200);
    const rows = r.body as HeadcountRow[];
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.ok(typeof row.city === 'string');
      assert.ok(row.bu === 'CPM' || row.bu === 'IGIV');
      assert.ok(typeof row.aop === 'number');
      assert.ok(typeof row.active === 'number');
      assert.ok(typeof row.offered === 'number');
      assert.ok(typeof row.notice === 'number');
      assert.ok(typeof row.pip === 'number');
      assert.ok(typeof row.training === 'number');
      assert.ok(typeof row.deficit === 'number');
    }
  });

  it('active count derives from candidates at stage=Active (PR-E / C3)', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    const blr = rows.find((row) => row.city === 'Bangalore' && row.bu === 'CPM');
    assert.ok(blr);
    assert.equal(blr.active, 1);
  });

  it('training count derives from candidates at stage=Training (PR-E / C3)', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    const blr = rows.find((row) => row.city === 'Bangalore' && row.bu === 'CPM');
    assert.ok(blr);
    assert.equal(blr.training, 1);
  });

  it('offered count derives from candidates at stage=Offered', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    const blr = rows.find((row) => row.city === 'Bangalore' && row.bu === 'CPM');
    assert.ok(blr);
    assert.equal(blr.offered, 1);
  });

  it('notice / pip placeholders remain 0 until external integration', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    for (const row of rows) {
      assert.equal(row.notice, 0);
      assert.equal(row.pip, 0);
    }
  });

  it('deficit = aop - active', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    for (const row of rows) {
      assert.equal(row.deficit, row.aop - row.active);
    }
  });

  it('?bu=CPM narrows results to the CPM rows only', async () => {
    const r = await request('GET', '/api/headcount?bu=CPM');
    assert.equal(r.status, 200);
    const rows = r.body as HeadcountRow[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bu, 'CPM');
    assert.equal(rows[0].city, 'Bangalore');
  });
});

describe('PUT /api/headcount/:city/:bu', () => {
  it('401 when no caller is authenticated', async () => {
    setCaller(null);
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 10 });
    assert.equal(r.status, 401);
  });

  it('403 when caller is a TA (not admin)', async () => {
    setCaller(taCaller);
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 10 });
    assert.equal(r.status, 403);
  });

  it('403 when caller is an Approver (admin-only endpoint)', async () => {
    setCaller(approverCaller);
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 10 });
    assert.equal(r.status, 403);
  });

  it('400 when aop is missing', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', {});
    assert.equal(r.status, 400);
  });

  it('400 when aop is negative', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: -1 });
    assert.equal(r.status, 400);
  });

  it('400 when aop is fractional', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 5.5 });
    assert.equal(r.status, 400);
  });

  it("400 when bu is not 'CPM' or 'IGIV'", async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/XYZ', { aop: 10 });
    assert.equal(r.status, 400);
  });

  it('404 when no row exists for (city, bu)', async () => {
    const r = await request('PUT', '/api/headcount/Mars/CPM', { aop: 10 });
    assert.equal(r.status, 404);
  });

  it('200 — admin updates aop, returns the updated row with derived fields recomputed', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 12 });
    assert.equal(r.status, 200);
    const row = r.body as HeadcountRow;
    assert.equal(row.city, 'Bangalore');
    assert.equal(row.bu, 'CPM');
    assert.equal(row.aop, 12);
    // Bangalore CPM seed has 1 candidate at stage 'Active' → active=1 → deficit=11
    assert.equal(row.active, 1);
    assert.equal(row.deficit, 11);

    // Persisted to DB.
    const persisted = await db('headcount').where({ city: 'Bangalore', bu: 'CPM' }).first();
    assert.equal(persisted.aop, 12);
  });

  it('200 — aop=0 is allowed (city de-prioritised, not removed)', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 0 });
    assert.equal(r.status, 200);
    const row = r.body as HeadcountRow;
    assert.equal(row.aop, 0);
    // active=1 → deficit = 0-1 = -1 (i.e. one over plan)
    assert.equal(row.deficit, -1);
  });

  // PR-O: route persists req.user.id as updated_by_user_id so the Dashboard
  // toast can attribute changes and exclude self-edits.
  it('200 — persists req.user.id as updated_by_user_id (PR-O)', async () => {
    const r = await request('PUT', '/api/headcount/Bangalore/CPM', { aop: 9 });
    assert.equal(r.status, 200);
    const persisted = await db('headcount').where({ city: 'Bangalore', bu: 'CPM' }).first();
    assert.equal(persisted.updated_by_user_id, adminCaller.id);
  });
});
