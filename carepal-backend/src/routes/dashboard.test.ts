import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { dashboardRouter } from './dashboard.js';
import { PIPELINE_STAGES } from '../models/candidate.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-dashboard-route.sqlite');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
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
  app.use(dashboardRouter);
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
  // PR-L: assignments need a real user. Akhlaque (id=1) covers all seed candidates.
  await db('users').insert([
    { id: 1, email: 'a@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com', city: null },
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

interface DashboardResponse {
  bu: string;
  totals: {
    openPositions: number;
    candidatesInPipe: number;
    offersExtended: number;
    confirmedJoins: number;
  };
  funnel: { stage: string; count: number }[];
  pendingApprovals: { id: string }[];
  cityBreakdown: {
    city: string;
    aopTotal: number;
    activeTotal: number;
    noticeTotal: number;
    pipTotal: number;
    trainingTotal: number;
    offeredTotal: number;
    deficitTotal: number;
    openReqs: number;
    candidates: number;
    hospitals: { hospital: string; openReqs: number }[];
  }[];
}

async function seedTwoBus(): Promise<void> {
  await db('requisitions').insert([
    {
      id: 'REQ-CPM', city: 'Bangalore', hospital: 'H1', area: null, bd_type: 'Focus',
      bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
      date: '2026-04-26', status: 'Pending Approval', notes: null,
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
      id: 'C-CPM-1', req_id: 'REQ-CPM', name: 'A', phone: '1', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-IGIV-1', req_id: 'REQ-IGIV', name: 'B', phone: '2', email: null,
      city: 'Hyderabad', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Joined', bu: 'IGIV',
    },
  ]);
  await db('candidate_assignments').insert([
    { candidate_id: 'C-CPM-1', user_id: 1 },
    { candidate_id: 'C-IGIV-1', user_id: 1 },
  ]);
  await db('headcount').insert([
    { city: 'Bangalore', bu: 'CPM', aop: 5 },
    { city: 'Hyderabad', bu: 'IGIV', aop: 3 },
  ]);
}

describe('GET /api/dashboard', () => {
  it('returns the expected top-level shape', async () => {
    await seedTwoBus();
    const r = await request('GET', '/api/dashboard');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.bu, 'all');
    assert.ok(body.totals);
    assert.ok(Array.isArray(body.funnel));
    assert.ok(Array.isArray(body.pendingApprovals));
    assert.ok(Array.isArray(body.cityBreakdown));
  });

  it('returns sane defaults on empty DB (no crash)', async () => {
    const r = await request('GET', '/api/dashboard');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.bu, 'all');
    assert.deepEqual(body.totals, {
      openPositions: 0,
      candidatesInPipe: 0,
      offersExtended: 0,
      confirmedJoins: 0,
    });
    assert.equal(body.pendingApprovals.length, 0);
    assert.equal(body.cityBreakdown.length, 0);
    // Funnel always has fixed shape — one entry per pipeline stage.
    assert.equal(body.funnel.length, PIPELINE_STAGES.length);
  });

  it('funnel array contains all canonical pipeline stages', async () => {
    const r = await request('GET', '/api/dashboard');
    const body = r.body as DashboardResponse;
    const stages = body.funnel.map((f) => f.stage);
    for (const s of PIPELINE_STAGES) assert.ok(stages.includes(s), `missing stage ${s}`);
  });

  it('?bu=CPM narrows results to CPM only', async () => {
    await seedTwoBus();
    const r = await request('GET', '/api/dashboard?bu=CPM');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.bu, 'CPM');
    // Pending Approval req is the CPM one; IGIV req is Active.
    assert.equal(body.pendingApprovals.length, 1);
    assert.equal(body.pendingApprovals[0].id, 'REQ-CPM');
    // Only the CPM Sourced candidate is in pipe; IGIV-Joined is filtered out.
    assert.equal(body.totals.confirmedJoins, 0);
    assert.equal(body.totals.candidatesInPipe, 1);
    assert.equal(body.cityBreakdown.length, 1);
    assert.equal(body.cityBreakdown[0].city, 'Bangalore');
  });

  it('?bu=IGIV narrows results to IGIV only', async () => {
    await seedTwoBus();
    const r = await request('GET', '/api/dashboard?bu=IGIV');
    const body = r.body as DashboardResponse;
    assert.equal(body.bu, 'IGIV');
    assert.equal(body.totals.confirmedJoins, 1);
    assert.equal(body.pendingApprovals.length, 0);
    assert.equal(body.cityBreakdown[0].city, 'Hyderabad');
  });

  it('cityBreakdown rows include the headcount fields the merged Dashboard relies on', async () => {
    await seedTwoBus();
    const r = await request('GET', '/api/dashboard');
    const body = r.body as DashboardResponse;
    const blr = body.cityBreakdown.find((c) => c.city === 'Bangalore');
    assert.ok(blr);
    assert.equal(blr.aopTotal, 5);
    // active = candidates at stage Joined; the Bangalore CPM seed has none.
    assert.equal(blr.activeTotal, 0);
    assert.equal(blr.deficitTotal, 5);
    // Notice/PIP/Training are placeholder zeros until Sujeet integration —
    // assert they're present and zero so a future regression is caught.
    assert.equal(blr.noticeTotal, 0);
    assert.equal(blr.pipTotal, 0);
    assert.equal(blr.trainingTotal, 0);
    // offered = candidates at stage Offered; seed has none in Bangalore.
    assert.equal(blr.offeredTotal, 0);
  });
});

describe('GET /api/dashboard — city scoping', () => {
  it('TA with cities=[Bangalore] only sees Bangalore data', async () => {
    await seedTwoBus();
    setCaller({
      id: 1, email: 'a@x.com', name: 'Akhlaque', role: 'ta', city: null,
      domain: 'x.com', last_login_at: null, cities: ['Bangalore'],
    });
    const r = await request('GET', '/api/dashboard');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.cityBreakdown.length, 1);
    assert.equal(body.cityBreakdown[0].city, 'Bangalore');
    assert.equal(body.totals.candidatesInPipe, 1);
    assert.equal(body.totals.confirmedJoins, 0);
  });

  it('TA with no cities sees empty dashboard', async () => {
    await seedTwoBus();
    setCaller({
      id: 1, email: 'a@x.com', name: 'Akhlaque', role: 'ta', city: null,
      domain: 'x.com', last_login_at: null, cities: [],
    });
    const r = await request('GET', '/api/dashboard');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.cityBreakdown.length, 0);
    assert.equal(body.totals.candidatesInPipe, 0);
    assert.equal(body.totals.openPositions, 0);
  });

  it('admin sees all data regardless of cities field', async () => {
    await seedTwoBus();
    setCaller(adminCaller);
    const r = await request('GET', '/api/dashboard');
    assert.equal(r.status, 200);
    const body = r.body as DashboardResponse;
    assert.equal(body.cityBreakdown.length, 2);
  });
});
