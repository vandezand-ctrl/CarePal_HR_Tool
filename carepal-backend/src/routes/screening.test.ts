import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { screeningRouter } from './screening.js';
import { uploadDocument } from '../models/document.js';
import { setScreenerStubForTesting } from '../services/cvScreener.js';
import type { Candidate } from '../models/candidate.js';
import type { User } from '../models/user.js';

const TEST_DB_PATH = path.resolve('./data/test-screening-route.sqlite');
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

let userIds: Record<string, number> = {};
function callerFor(name: string, role: 'admin' | 'ta' | 'approver', email: string): User {
  return {
    id: userIds[name],
    email,
    name,
    role,
    city: null,
    domain: 'x.com',
    last_login_at: null,
    cities: [],
  };
}

const adminCaller: User = {
  id: 0,
  email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
};

// Default screener stub — returns a deterministic score so the happy-path
// test can assert exact values. Individual tests override via _setStub.
const defaultStub = async () => ({
  score: 72,
  explanation: 'Three years of BD experience at a regional hospital, based in Bangalore.',
});

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
  app.use(screeningRouter);
});

after(async () => {
  setScreenerStubForTesting(null);
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  // Clean up any files created under uploads/
  for (const cid of ['C-001', 'C-002', 'C-003']) {
    const dir = path.join(UPLOAD_ROOT, cid);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  // Reset stub to the deterministic default — individual tests may override.
  setScreenerStubForTesting(defaultStub);

  await db('documents').del();
  await db('candidate_assignments').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  await db('users').insert([
    { email: 's@x.com',   name: 'Sahil',    role: 'admin',    domain: 'x.com', city: null },
    { email: 'a@x.com',   name: 'Akhlaque', role: 'ta',       domain: 'x.com', city: null },
    { email: 'p@x.com',   name: 'Payal',    role: 'ta',       domain: 'x.com', city: null },
    { email: 'app@x.com', name: 'AppRover', role: 'approver', domain: 'x.com', city: null },
  ]);
  const allUsers = await db('users').select('id', 'name');
  userIds = Object.fromEntries(allUsers.map((u: { id: number; name: string }) => [u.name, u.id]));
  Object.assign(adminCaller, callerFor('Sahil', 'admin', 's@x.com'));
  setCaller(adminCaller);

  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'Manipal', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
    date: '2026-04-26', status: 'Active', notes: 'Need someone with healthcare experience',
    created_at: new Date(), updated_at: new Date(),
  });
  await db('candidates').insert([
    {
      id: 'C-001', req_id: 'REQ-100', name: 'Alice', phone: '9876543210', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Acme', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-20',
      stage: 'Sourced', bu: 'CPM',
    },
    {
      id: 'C-002', req_id: 'REQ-100', name: 'Bob', phone: '9876500000', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'Beta', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-21',
      stage: 'Sourced', bu: 'CPM',
    },
  ]);
  await db('candidate_assignments').insert([
    { candidate_id: 'C-001', user_id: userIds['Akhlaque'], assigned_at: new Date(), assigned_by: null },
    { candidate_id: 'C-002', user_id: userIds['Akhlaque'], assigned_at: new Date(), assigned_by: null },
  ]);
});

async function uploadResume(candidateId: string, text = 'Alice — Business Development Associate. 3 years at Apollo Hospitals, Bangalore. Healthcare sales experience.'): Promise<void> {
  await uploadDocument({
    candidateId,
    docType: 'Resume',
    filename: 'cv.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(text, 'utf-8'),
    uploadedByUserId: userIds['Sahil'],
  });
}

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

describe('POST /api/candidates/:id/screen — happy path', () => {
  it('200 with score + explanation when CV + req both present', async () => {
    await uploadResume('C-001');
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    const body = r.body as Candidate;
    assert.equal(body.id, 'C-001');
    assert.equal(body.aiScore, 72);
    assert.match(body.aiScoreExplanation ?? '', /Bangalore/);
  });

  it('re-screening overwrites the previous score', async () => {
    await uploadResume('C-001');
    await request('POST', '/api/candidates/C-001/screen'); // first → 72
    setScreenerStubForTesting(async () => ({ score: 41, explanation: 'Second pass said the CV is weaker than first read.' }));
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).aiScore, 41);
  });

  it('passes the requisition context to the screener', async () => {
    let capturedReqId: string | null = null;
    let capturedCity: string | null = null;
    setScreenerStubForTesting(async (_text, req) => {
      capturedReqId = req.id;
      capturedCity = req.city;
      return { score: 50, explanation: 'Captured for assertion.' };
    });
    await uploadResume('C-001');
    await request('POST', '/api/candidates/C-001/screen');
    assert.equal(capturedReqId, 'REQ-100');
    assert.equal(capturedCity, 'Bangalore');
  });
});

describe('POST /api/candidates/:id/screen — soft failures', () => {
  it('returns screened:false when candidate has no Resume', async () => {
    // C-001 has no documents — should not crash, just report.
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    const body = r.body as { screened: boolean; reason: string };
    assert.equal(body.screened, false);
    assert.match(body.reason, /No Resume/i);
  });

  it('returns screened:false when API key + stub are both missing', async () => {
    setScreenerStubForTesting(null); // simulate "not configured"
    await uploadResume('C-001');
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    const body = r.body as { screened: boolean; reason: string };
    assert.equal(body.screened, false);
    assert.match(body.reason, /not configured/i);
  });

  it('returns screened:false when the CV has no readable text', async () => {
    await uploadResume('C-001', '  '); // 2 spaces → trimmed below 30 chars
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    const body = r.body as { screened: boolean; reason: string };
    assert.equal(body.screened, false);
    assert.match(body.reason, /no readable text/i);
  });

  it('returns 500 when linked requisition is missing (treated as data corruption)', async () => {
    // Disable FK so we can create the corruption the route guards against.
    // In prod the FK should prevent this; if it ever fires it's a real bug.
    await db.raw('PRAGMA foreign_keys = OFF');
    await db('candidates').insert({
      id: 'C-003', req_id: 'REQ-999', name: 'Orphan', phone: '9000000003', email: null,
      city: 'Bangalore', current_role: 'BDA', company: 'X', current_ctc: null,
      expected_ctc: null, notice: null, sourced_at: '2026-04-22',
      stage: 'Sourced', bu: 'CPM',
    });
    await db.raw('PRAGMA foreign_keys = ON');
    await db('candidate_assignments').insert({
      candidate_id: 'C-003', user_id: userIds['Akhlaque'],
      assigned_at: new Date(), assigned_by: null,
    });
    await uploadResume('C-003');
    const r = await request('POST', '/api/candidates/C-003/screen');
    assert.equal(r.status, 500);
    assert.match((r.body as { error: string }).error, /requisition/i);
  });

  it('returns 422 when the Resume is a corrupt PDF (extraction throws)', async () => {
    // Upload garbage bytes labelled as application/pdf — pdf-parse throws
    // on the unparseable buffer, which the route catches as 422.
    await uploadDocument({
      candidateId: 'C-001', docType: 'Resume',
      filename: 'corrupt.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('definitely not a real PDF file'),
      uploadedByUserId: userIds['Sahil'],
    });
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 422);
    assert.match((r.body as { error: string }).error, /corrupted|unsupported/i);
  });
});

describe('POST /api/candidates/:id/screen — 404 paths', () => {
  it('404 when candidate does not exist', async () => {
    const r = await request('POST', '/api/candidates/C-999/screen');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/candidates/:id/screen — RBAC / TA scoping', () => {
  it('TA can screen a candidate assigned to them', async () => {
    await uploadResume('C-001');
    setCaller(callerFor('Akhlaque', 'ta', 'a@x.com'));
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).aiScore, 72);
  });

  it('TA gets 404 for a candidate NOT assigned to them', async () => {
    await uploadResume('C-001');
    setCaller(callerFor('Payal', 'ta', 'p@x.com'));
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 404);
  });

  it('admin can screen any candidate regardless of assignment', async () => {
    await uploadResume('C-002');
    setCaller(adminCaller);
    const r = await request('POST', '/api/candidates/C-002/screen');
    assert.equal(r.status, 200);
    assert.equal((r.body as Candidate).aiScore, 72);
  });

  it('approver can screen any candidate', async () => {
    await uploadResume('C-001');
    setCaller(callerFor('AppRover', 'approver', 'app@x.com'));
    const r = await request('POST', '/api/candidates/C-001/screen');
    assert.equal(r.status, 200);
  });
});

describe('Candidate model exposes AI score fields after screening', () => {
  it('subsequent fetch via the model returns the persisted score', async () => {
    await uploadResume('C-001');
    await request('POST', '/api/candidates/C-001/screen');
    const row = await db('candidates').where({ id: 'C-001' }).first();
    assert.equal(row.ai_score, 72);
    assert.match(row.ai_score_explanation, /Bangalore/);
  });
});
