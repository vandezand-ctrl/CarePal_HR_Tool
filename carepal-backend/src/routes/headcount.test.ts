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
  await db('candidates').del();
  await db('requisitions').del();
  await db('headcount').del();

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
  await db('candidates').insert([
    {
      id: 'C-CPM-J', req_id: 'REQ-CPM', name: 'Joiner', phone: '1', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
      stage: 'Joined', bu: 'CPM',
    },
    {
      id: 'C-CPM-O', req_id: 'REQ-CPM', name: 'Offered', phone: '2', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
      stage: 'Offered', bu: 'CPM',
    },
    {
      id: 'C-CPM-S', req_id: 'REQ-CPM', name: 'Sourced', phone: '3', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-IGIV-J', req_id: 'REQ-IGIV', name: 'IgivJoin', phone: '4', email: null,
      city: 'Hyderabad', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
      stage: 'Joined', bu: 'IGIV',
    },
  ]);
});

async function request(
  method: 'GET',
  url: string,
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
        const res = await fetch(`http://127.0.0.1:${addr.port}${url}`, { method });
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

  it('active count derives from candidates at stage=Joined', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    const blr = rows.find((row) => row.city === 'Bangalore' && row.bu === 'CPM');
    assert.ok(blr);
    assert.equal(blr.active, 1);
  });

  it('offered count derives from candidates at stage=Offered', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    const blr = rows.find((row) => row.city === 'Bangalore' && row.bu === 'CPM');
    assert.ok(blr);
    assert.equal(blr.offered, 1);
  });

  it('notice / pip / training all 0 (placeholder until external integration)', async () => {
    const r = await request('GET', '/api/headcount');
    const rows = r.body as HeadcountRow[];
    for (const row of rows) {
      assert.equal(row.notice, 0);
      assert.equal(row.pip, 0);
      assert.equal(row.training, 0);
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
