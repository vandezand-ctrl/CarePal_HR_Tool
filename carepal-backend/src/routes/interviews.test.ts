import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { interviewsRouter } from './interviews.js';
import { scheduleInterview } from '../models/interview.js';
import type { Interview } from '../models/interview.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-interviews-route.sqlite');

let db: Knex;
let app: Express;

// Caller identity for the fake auth middleware. Tests mutate this via
// setCaller() to exercise different RBAC paths. Mirrors the proven pattern
// from src/routes/users.test.ts.
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
  // Fake auth middleware — populates req.user from the test-controlled global.
  // The interviews router's DELETE handler runs requireRole('approver'); this
  // shim is what makes that check actually have a user to evaluate.
  app.use((req, _res, next) => {
    if (currentCaller) req.user = currentCaller;
    next();
  });
  app.use(interviewsRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  // Default caller for all tests is admin — keeps existing tests passing
  // unchanged after PR D added requireRole('approver') to the DELETE handler.
  // RBAC-specific tests below override with setCaller() to exercise other roles.
  setCaller(adminCaller);

  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  await db('users').insert({
    id: 1, email: 's@x.com', name: 'S', role: 'admin', domain: 'x.com', city: null,
  });
  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'T', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
    date: '2026-04-26', status: 'Active', notes: null,
    created_at: new Date(), updated_at: new Date(),
  });
  await db('candidates').insert({
    id: 'C-001', req_id: 'REQ-100', name: 'A', phone: '9876543210', email: null,
    city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
    expected_ctc: null, notice: null, ta: 'Akhlaque', sourced_at: '2026-04-20',
    stage: 'Sourced', bu: 'CPM',
  });
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

const baseSchedule = {
  candidateId: 'C-001',
  round: 1 as const,
  interviewerName: 'Himanshu Jaiswal',
  scheduledDate: '2026-04-28',
  scheduledTime: '10:00',
  mode: 'Virtual' as const,
};

describe('GET /api/interviews — extended filters', () => {
  beforeEach(async () => {
    // Seed a couple of interviews via the model so the candidate stage stays in sync.
    await scheduleInterview({ ...baseSchedule, scheduledDate: '2026-04-28' });
  });

  it('returns all interviews when no filters', async () => {
    const r = await request('GET', '/api/interviews');
    assert.equal(r.status, 200);
    assert.equal((r.body as Interview[]).length, 1);
  });

  it('round filter: ?round=2 returns empty when only round 1 scheduled', async () => {
    const r = await request('GET', '/api/interviews?round=2');
    assert.equal(r.status, 200);
    assert.equal((r.body as Interview[]).length, 0);
  });

  it('result=Scheduled matches IS NULL', async () => {
    const r = await request('GET', '/api/interviews?result=Scheduled');
    assert.equal(r.status, 200);
    assert.equal((r.body as Interview[]).length, 1);
  });

  it('dateFrom filter excludes earlier dates', async () => {
    const r = await request('GET', '/api/interviews?dateFrom=2026-04-30');
    assert.equal(r.status, 200);
    assert.equal((r.body as Interview[]).length, 0);
  });
});

describe('DELETE /api/interviews/:id (cancel)', () => {
  it('400 on non-numeric id', async () => {
    const r = await request('DELETE', '/api/interviews/abc');
    assert.equal(r.status, 400);
  });

  it('404 when interview does not exist', async () => {
    const r = await request('DELETE', '/api/interviews/99999');
    assert.equal(r.status, 404);
  });

  it('200 happy path: returns updated row, candidate stage reverts', async () => {
    const interview = await scheduleInterview(baseSchedule);
    // Confirm pre-state.
    const before = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(before.stage, 'R1 Scheduled');

    const r = await request('DELETE', `/api/interviews/${interview.id}?reason=test%20reason`);
    assert.equal(r.status, 200);
    const body = r.body as Interview;
    assert.ok(body.cancelledAt, 'cancelled_at populated');
    assert.equal(body.cancelledReason, 'test reason');

    const after = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(after.stage, 'Sourced', 'candidate reverted to Sourced');
    // Interview row soft-cancelled (visible via includeCancelled).
    const allForC001 = await db('interviews').where({ candidate_id: 'C-001' });
    assert.equal(allForC001.length, 1);
    assert.ok(allForC001[0].cancelled_at, 'interview row marked cancelled');
  });

  it('400 when cancelling a completed interview (audit trail preserved)', async () => {
    const interview = await scheduleInterview(baseSchedule);
    // Record a result first.
    await request('PATCH', `/api/interviews/${interview.id}`, { result: 'Select' });

    const r = await request('DELETE', `/api/interviews/${interview.id}`);
    assert.equal(r.status, 400);

    // Confirm nothing got soft-cancelled.
    const fresh = await db('interviews').where({ id: interview.id }).first();
    assert.equal(fresh.cancelled_at, null);
  });
});

describe('PATCH /api/interviews/:id with No-show result', () => {
  it('200 — accepts No-show, candidate stage stays at R1 Complete', async () => {
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('PATCH', `/api/interviews/${interview.id}`, { result: 'No-show' });
    assert.equal(r.status, 200);
    assert.equal((r.body as Interview).result, 'No-show');

    // Candidate stage advances. Result lives only on the interview row —
    // candidate.r1_result is no longer dual-written (PR B), and that column
    // gets dropped entirely in PR C.
    const cand = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(cand.stage, 'R1 Complete');
    const updatedInterview = await db('interviews').where({ id: interview.id }).first();
    assert.equal(updatedInterview.result, 'No-show');
  });

  it('400 on bogus result value', async () => {
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('PATCH', `/api/interviews/${interview.id}`, { result: 'maybe' });
    assert.equal(r.status, 400);
  });
});

// PR D — RBAC tightening on the cancel endpoint. Schedule (POST) and outcome
// recording (PATCH) stay open to all authenticated users; only DELETE requires
// approver / admin.
describe('DELETE /api/interviews/:id RBAC (PR D)', () => {
  it('401 when no user is authenticated', async () => {
    setCaller(null);
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('DELETE', `/api/interviews/${interview.id}`);
    assert.equal(r.status, 401);
    // Confirm side-effects didn't fire: the interview row should still be
    // active (cancelled_at = null).
    const fresh = await db('interviews').where({ id: interview.id }).first();
    assert.equal(fresh.cancelled_at, null);
  });

  it('403 when caller is a TA', async () => {
    setCaller(taCaller);
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('DELETE', `/api/interviews/${interview.id}`);
    assert.equal(r.status, 403);
    // Stage shouldn't have reverted either.
    const cand = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(cand.stage, 'R1 Scheduled');
  });

  it('200 when caller is an Approver', async () => {
    setCaller(approverCaller);
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('DELETE', `/api/interviews/${interview.id}`);
    assert.equal(r.status, 200);
    assert.ok((r.body as Interview).cancelledAt, 'cancelled_at populated');
  });

  it('200 when caller is an Admin (admin-bypass via requireRole)', async () => {
    setCaller(adminCaller);
    const interview = await scheduleInterview(baseSchedule);
    const r = await request('DELETE', `/api/interviews/${interview.id}`);
    assert.equal(r.status, 200);
    assert.ok((r.body as Interview).cancelledAt, 'cancelled_at populated');
  });

  it('TAs can still POST (schedule) and PATCH (record outcome) — RBAC only gates DELETE', async () => {
    setCaller(taCaller);

    // POST schedule still works for TA.
    const r1 = await request('POST', '/api/interviews', { ...baseSchedule, candidateId: 'C-001' });
    assert.equal(r1.status, 201, 'TA can schedule');

    // PATCH (record outcome) still works for TA.
    const interview = (r1.body as Interview);
    const r2 = await request('PATCH', `/api/interviews/${interview.id}`, { result: 'Select' });
    assert.equal(r2.status, 200, 'TA can record outcome');
  });
});
