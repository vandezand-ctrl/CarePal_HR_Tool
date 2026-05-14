import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import knex, { Knex } from 'knex';
import { setDbForTesting, closeDb } from '../db/index.js';
import { applicationsRouter } from './applications.js';
import { meRouter } from './me.js';
import type { User } from '../models/user.js';
import type { Application } from '../models/application.js';

const TEST_DB_PATH = path.resolve('./data/test-applications-route.sqlite');

let db: Knex;
let app: Express;

let currentCaller: User | null = null;
function setCaller(c: User | null): void {
  currentCaller = c;
}

const adminCaller: User = {
  id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const taCaller: User = {
  id: 2, email: 'a@x.com', name: 'Akhlaque', role: 'ta', city: null, domain: 'x.com', last_login_at: null, cities: [],
};
const approverCaller: User = {
  id: 3, email: 'app@x.com', name: 'AppRover', role: 'approver', city: null, domain: 'x.com', last_login_at: null, cities: [],
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
  app.use(applicationsRouter);
  app.use(meRouter);
});

after(async () => {
  setDbForTesting(undefined);
  await db.destroy();
  await closeDb();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  setCaller(taCaller);

  await db('documents').del();
  await db('applications').del();
  await db('interviews').del();
  await db('candidates').del();
  await db('requisitions').del();
  await db('users').del();

  await db('users').insert([
    { id: 1, email: 's@x.com', name: 'Sahil', role: 'admin', domain: 'x.com', city: null, created_at: new Date(), updated_at: new Date() },
    { id: 2, email: 'a@x.com', name: 'Akhlaque', role: 'ta', domain: 'x.com', city: null, created_at: new Date(), updated_at: new Date() },
    { id: 3, email: 'app@x.com', name: 'AppRover', role: 'approver', domain: 'x.com', city: null, created_at: new Date(), updated_at: new Date() },
  ]);

  await db('requisitions').insert({
    id: 'REQ-100', city: 'Bangalore', hospital: 'T', area: null, bd_type: 'Focus',
    bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'S',
    date: '2026-04-26', status: 'Active', notes: null,
    created_at: new Date(), updated_at: new Date(),
  });

  await db('applications').insert([
    {
      id: 1, sender_email: 'alice@example.com', sender_name: 'Alice Smith',
      subject: 'Application for BD role', received_at: '2026-05-03T10:00:00Z',
      parsed_name: 'Alice Smith', parsed_phone: '9876543210', parsed_email: 'alice@example.com',
      body_snippet: 'Please find my CV attached.', status: 'pending',
      source_mailbox: 'ta1@impactguru.com',
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 2, sender_email: 'bob@example.com', sender_name: 'Bob Jones',
      subject: 'BD Application', received_at: '2026-05-02T09:00:00Z',
      status: 'pending',
      source_mailbox: 'apply@impactguru.com',
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 3, sender_email: 'charlie@example.com', sender_name: 'Charlie Brown',
      subject: 'Resume', received_at: '2026-05-01T08:00:00Z',
      status: 'rejected', reviewed_by: 1, reviewed_at: '2026-05-01T12:00:00Z',
      reject_reason: 'No relevant experience',
      source_mailbox: 'ta1@impactguru.com',
      created_at: new Date(), updated_at: new Date(),
    },
  ]);
});

async function req(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) { server.close(); reject(new Error('no addr')); return; }
      try {
        const opts: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json' },
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(`http://127.0.0.1:${addr.port}${url}`, opts);
        const text = await res.text();
        resolve({ status: res.status, body: text ? JSON.parse(text) : null });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe('GET /api/applications', () => {
  it('returns all applications', async () => {
    const r = await req('GET', '/api/applications');
    assert.equal(r.status, 200);
    const apps = r.body as Application[];
    assert.equal(apps.length, 3);
  });

  it('filters by status=pending', async () => {
    const r = await req('GET', '/api/applications?status=pending');
    assert.equal(r.status, 200);
    const apps = r.body as Application[];
    assert.equal(apps.length, 2);
    assert.ok(apps.every(a => a.status === 'pending'));
  });

  it('filters by status=rejected', async () => {
    const r = await req('GET', '/api/applications?status=rejected');
    assert.equal(r.status, 200);
    const apps = r.body as Application[];
    assert.equal(apps.length, 1);
    assert.equal(apps[0].senderEmail, 'charlie@example.com');
  });
});

describe('GET /api/applications/:id', () => {
  it('returns a single application with sourceMailbox', async () => {
    const r = await req('GET', '/api/applications/1');
    assert.equal(r.status, 200);
    const a = r.body as Application;
    assert.equal(a.senderEmail, 'alice@example.com');
    assert.equal(a.parsedName, 'Alice Smith');
    assert.equal(a.sourceMailbox, 'ta1@impactguru.com');
  });

  it('404 for non-existent', async () => {
    const r = await req('GET', '/api/applications/999');
    assert.equal(r.status, 404);
  });
});

describe('POST /api/applications/:id/accept', () => {
  // PR-L: accept-body now uses taIds (array of user IDs) instead of `ta`
  // (single string).
  const acceptBody = {
    reqId: 'REQ-100',
    name: 'Alice Smith',
    phone: '9876543210',
    email: 'alice@example.com',
    city: 'Bangalore',
    currentRole: 'BDA',
    company: 'Acme',
    taIds: [2], // Akhlaque
    bu: 'CPM',
  };

  it('creates candidate with assignedTas and links application; cvCopyFailed is false', async () => {
    const r = await req('POST', '/api/applications/1/accept', acceptBody);
    assert.equal(r.status, 200);
    const { application, candidate, cvCopyFailed } = r.body as {
      application: Application;
      candidate: { id: string; name: string; assignedTas: { name: string }[] };
      cvCopyFailed: boolean;
    };
    assert.equal(application.status, 'accepted');
    assert.ok(application.candidateId);
    assert.equal(candidate.name, 'Alice Smith');
    assert.deepEqual(candidate.assignedTas.map((t) => t.name), ['Akhlaque']);
    assert.equal(cvCopyFailed, false);
  });

  it('200 with multiple taIds', async () => {
    const r = await req('POST', '/api/applications/1/accept', { ...acceptBody, taIds: [1, 2] });
    assert.equal(r.status, 200);
    const { candidate } = r.body as { candidate: { assignedTas: { name: string }[] } };
    const names = candidate.assignedTas.map((t) => t.name).sort();
    assert.deepEqual(names, ['Akhlaque', 'Sahil']);
  });

  it('400 when taIds is empty', async () => {
    const r = await req('POST', '/api/applications/1/accept', { ...acceptBody, taIds: [] });
    assert.equal(r.status, 400);
  });

  it('400 when taIds includes an approver', async () => {
    const r = await req('POST', '/api/applications/1/accept', { ...acceptBody, taIds: [3] });
    assert.equal(r.status, 400);
    assert.match((r.body as { error: string }).error, /cannot be assigned/);
  });

  it('400 when application is already accepted', async () => {
    await req('POST', '/api/applications/1/accept', acceptBody);
    const r = await req('POST', '/api/applications/1/accept', acceptBody);
    assert.equal(r.status, 400);
    assert.ok((r.body as { error: string }).error.includes('already'));
  });

  it('400 when reqId is invalid', async () => {
    const r = await req('POST', '/api/applications/1/accept', { ...acceptBody, reqId: 'REQ-999' });
    assert.equal(r.status, 400);
  });

  it('404 for non-existent application', async () => {
    const r = await req('POST', '/api/applications/999/accept', acceptBody);
    assert.equal(r.status, 404);
  });
});

describe('POST /api/applications/:id/reject', () => {
  it('rejects with reason', async () => {
    const r = await req('POST', '/api/applications/1/reject', { reason: 'Not qualified' });
    assert.equal(r.status, 200);
    const a = r.body as Application;
    assert.equal(a.status, 'rejected');
    assert.equal(a.rejectReason, 'Not qualified');
  });

  it('rejects without reason', async () => {
    const r = await req('POST', '/api/applications/2/reject', {});
    assert.equal(r.status, 200);
    const a = r.body as Application;
    assert.equal(a.status, 'rejected');
  });

  it('400 when already rejected', async () => {
    const r = await req('POST', '/api/applications/3/reject', {});
    assert.equal(r.status, 400);
    assert.ok((r.body as { error: string }).error.includes('already'));
  });
});

describe('GET /api/applications/unseen-count', () => {
  it('returns count of all pending when last_inbox_seen_at is null', async () => {
    const r = await req('GET', '/api/applications/unseen-count');
    assert.equal(r.status, 200);
    assert.equal((r.body as { count: number }).count, 2);
  });

  it('returns 0 after marking inbox seen', async () => {
    await req('POST', '/api/me/inbox-seen');
    const r = await req('GET', '/api/applications/unseen-count');
    assert.equal(r.status, 200);
    assert.equal((r.body as { count: number }).count, 0);
  });
});

describe('RBAC', () => {
  it('approver gets 403 on list', async () => {
    setCaller(approverCaller);
    const r = await req('GET', '/api/applications');
    assert.equal(r.status, 403);
  });

  it('approver gets 403 on accept', async () => {
    setCaller(approverCaller);
    const r = await req('POST', '/api/applications/1/accept', {
      reqId: 'REQ-100', name: 'X', phone: '1234567', city: 'B',
      currentRole: 'R', company: 'C', taIds: [2], bu: 'CPM',
    });
    assert.equal(r.status, 403);
  });

  it('approver gets 403 on reject', async () => {
    setCaller(approverCaller);
    const r = await req('POST', '/api/applications/1/reject', {});
    assert.equal(r.status, 403);
  });

  it('admin can access applications', async () => {
    setCaller(adminCaller);
    const r = await req('GET', '/api/applications');
    assert.equal(r.status, 200);
  });
});

describe('getApplicationByGmailMessageId (SF-3 dedup)', () => {
  it('returns the application when gmail_message_id matches', async () => {
    await db('applications').where({ id: 1 }).update({ gmail_message_id: 'msg-abc-123' });
    const { getApplicationByGmailMessageId } = await import('../models/application.js');
    const app = await getApplicationByGmailMessageId('msg-abc-123');
    assert.ok(app);
    assert.equal(app!.id, 1);
    assert.equal(app!.gmailMessageId, 'msg-abc-123');
  });

  it('returns null when no match exists', async () => {
    const { getApplicationByGmailMessageId } = await import('../models/application.js');
    const app = await getApplicationByGmailMessageId('nonexistent-id');
    assert.equal(app, null);
  });
});

describe('POST /api/applications (seed endpoint)', () => {
  it('admin can create an application', async () => {
    setCaller(adminCaller);
    const r = await req('POST', '/api/applications', {
      senderEmail: 'new@example.com',
      senderName: 'New Applicant',
      subject: 'Job Application',
      receivedAt: '2026-05-04T10:00:00Z',
    });
    assert.equal(r.status, 201);
    const a = r.body as Application;
    assert.equal(a.senderEmail, 'new@example.com');
    assert.equal(a.status, 'pending');
  });

  it('admin can create an application with sourceMailbox', async () => {
    setCaller(adminCaller);
    const r = await req('POST', '/api/applications', {
      senderEmail: 'new2@example.com',
      senderName: 'Another Applicant',
      subject: 'Application',
      receivedAt: '2026-05-04T11:00:00Z',
      sourceMailbox: 'apply@impactguru.com',
    });
    assert.equal(r.status, 201);
    const a = r.body as Application;
    assert.equal(a.sourceMailbox, 'apply@impactguru.com');
  });

  it('TA gets 403 on create', async () => {
    setCaller(taCaller);
    const r = await req('POST', '/api/applications', {
      senderEmail: 'new@example.com',
      receivedAt: '2026-05-04T10:00:00Z',
    });
    assert.equal(r.status, 403);
  });
});
